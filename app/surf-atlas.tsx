"use client";

import { useMemo, useRef, useState } from "react";
import {
  BOARD_LABELS,
  CROWD_LABELS,
  getBestMonths,
  getMonthlyProfiles,
  getRelativeSeasonBand,
  getScoreLabel,
  getSurfProfile,
  RUBRIC,
  SHAPE_LABELS,
  TIDE_LABELS,
  type Board,
  type ScoreContribution,
  type SurfMonthProfile,
} from "./surf-model";
import {
  MONTHS,
  REGIONS,
  SURF_SPOTS,
  type Level,
} from "./surf-data";
import { WorldMap } from "./world-map";

const seasonLegend = [
  { band: 1, label: "Lower for spot" },
  { band: 5, label: "Prime for spot" },
] as const;

const levelShort: Record<Level, string> = {
  Beginner: "B",
  Intermediate: "I",
  Advanced: "A",
};

const CURRENT_MONTH_INDEX = new Date().getMonth();

export default function SurfAtlas() {
  const [board, setBoard] = useState<Board>("shortboard");
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(
    CURRENT_MONTH_INDEX,
  );
  const [activeLevel, setActiveLevel] = useState<Level | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const visibleSpots = useMemo(
    () =>
      activeLevel
        ? SURF_SPOTS.filter((spot) => spot.levels.includes(activeLevel))
        : SURF_SPOTS,
    [activeLevel],
  );

  const selectedSpot =
    SURF_SPOTS.find((spot) => spot.id === selectedSpotId) ?? null;
  const selectedSpotNumber = selectedSpot
    ? visibleSpots.findIndex((spot) => spot.id === selectedSpot.id)
    : -1;
  const selectedProfile = selectedSpot
    ? getSurfProfile(selectedSpot, selectedMonthIndex, board)
    : null;
  const primeMonths = selectedSpot ? getBestMonths(selectedSpot, board) : [];
  const googleMapsUrl = selectedSpot
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedSpot.lat},${selectedSpot.lon}`)}`
    : "";

  const groupedSpots = useMemo(
    () =>
      REGIONS.map((region) => ({
        region,
        spots: visibleSpots.filter((spot) => spot.region === region),
      })).filter(({ spots }) => spots.length > 0),
    [visibleSpots],
  );

  function selectSpot(spotId: string, monthIndex = selectedMonthIndex) {
    setSelectedSpotId(spotId);
    setSelectedMonthIndex(monthIndex);

    if (window.matchMedia("(max-width: 1279px)").matches) {
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  function selectLevel(level: Level) {
    const nextLevel = activeLevel === level ? null : level;
    setActiveLevel(nextLevel);

    if (nextLevel && selectedSpot && !selectedSpot.levels.includes(nextLevel)) {
      setSelectedSpotId(null);
    }
  }

  return (
    <div className="site-shell" data-board={board}>
      <main>
        <div className="atlas-frame">
          <div className="matrix-key" aria-label="Atlas controls and legend">
            <div
              aria-label="Choose surfboard"
              className="board-picker"
              role="group"
            >
              <span className="key-title">I’m riding</span>
              {(["shortboard", "longboard"] as Board[]).map((option) => (
                <button
                  aria-pressed={board === option}
                  className="board-option"
                  data-testid={`board-${option}`}
                  key={option}
                  onClick={() => setBoard(option)}
                  type="button"
                >
                  {BOARD_LABELS[option]}
                </button>
              ))}
            </div>

            <div className="key-group score-legend">
              <span className="key-title">Season strength</span>
              {seasonLegend.map(({ band, label }) => (
                <span className="score-key" key={band}>
                  <i
                    aria-hidden="true"
                    className={`rating-swatch season-band-${band}`}
                  />
                  <span className="key-label">{label}</span>
                </span>
              ))}
              <details className="rubric-popover">
                <summary>Rubric</summary>
                <p>
                  {RUBRIC.map(
                    (factor) => `${factor.label} ${factor.weight}%`,
                  ).join(" · ")}
                </p>
              </details>
            </div>

            <div className="key-group level-key">
              <span className="key-title">Breaks for</span>
              {(["Beginner", "Intermediate", "Advanced"] as Level[]).map(
                (level) => (
                  <button
                    aria-label={
                      activeLevel === level
                        ? "Show all skill levels"
                        : `Show only ${level} breaks`
                    }
                    aria-pressed={activeLevel === null || activeLevel === level}
                    className="level-filter"
                    key={level}
                    onClick={() => selectLevel(level)}
                    type="button"
                  >
                    <i
                      aria-hidden="true"
                      className={`level-dot level-${level.toLowerCase()}`}
                    />
                    {level}
                  </button>
                ),
              )}
            </div>
          </div>

          <section className="atlas-layout" aria-label="Interactive surf atlas">
            <div className="matrix-panel">
              <div className="matrix-scroll" data-testid="season-matrix">
                <table className="season-matrix">
                  <caption className="sr-only">
                    Seasonal strength for 50 surf spots across January through
                    December. Cell color is normalized within each spot from
                    its lowest-scoring to highest-scoring month, so colors do
                    not compare quality between spots. Select a cell to inspect
                    its absolute modeled score. Scores currently assume a{" "}
                    {BOARD_LABELS[board]}. The current filter shows{" "}
                    {visibleSpots.length} spots.
                  </caption>
                  <thead>
                    <tr>
                      <th className="spot-column" scope="col">
                        Spot / level
                      </th>
                      {MONTHS.map((month, monthIndex) => (
                        <th
                          className={
                            CURRENT_MONTH_INDEX === monthIndex
                              ? "is-current-month"
                              : undefined
                          }
                          key={month}
                          scope="col"
                        >
                          {month}
                          {CURRENT_MONTH_INDEX === monthIndex ? (
                            <span className="sr-only">, current month</span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedSpots.map(({ region, spots }) => (
                      <RegionRows
                        board={board}
                        currentMonthIndex={CURRENT_MONTH_INDEX}
                        key={region}
                        region={region}
                        selectedMonthIndex={selectedMonthIndex}
                        selectedSpotId={selectedSpot?.id ?? null}
                        spots={spots}
                        onSelect={selectSpot}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="atlas-sidebar" aria-label="Map and spot details">
              <section
                aria-label="Interactive world surf map"
                className="map-section"
              >
                <WorldMap
                  onSelect={(spotId) => selectSpot(spotId)}
                  selectedId={selectedSpot?.id ?? null}
                  spots={visibleSpots}
                />
              </section>

              {selectedSpot && selectedProfile ? (
                <SpotDetail
                  board={board}
                  googleMapsUrl={googleMapsUrl}
                  primeMonths={primeMonths}
                  profile={selectedProfile}
                  ref={detailRef}
                  selectedSpot={selectedSpot}
                  selectedSpotNumber={selectedSpotNumber}
                  totalSpots={visibleSpots.length}
                  onSelectMonth={setSelectedMonthIndex}
                />
              ) : null}
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}

interface SpotDetailProps {
  board: Board;
  googleMapsUrl: string;
  primeMonths: readonly string[];
  profile: SurfMonthProfile;
  ref: React.Ref<HTMLElement>;
  selectedSpot: (typeof SURF_SPOTS)[number];
  selectedSpotNumber: number;
  totalSpots: number;
  onSelectMonth: (monthIndex: number) => void;
}

function SpotDetail({
  board,
  googleMapsUrl,
  primeMonths,
  profile,
  ref,
  selectedSpot,
  selectedSpotNumber,
  totalSpots,
  onSelectMonth,
}: SpotDetailProps) {
  const monthlyProfiles = getMonthlyProfiles(selectedSpot, board);

  return (
    <article
      aria-live="polite"
      className="spot-detail"
      data-testid="spot-detail"
      ref={ref}
    >
      <div className="detail-kicker">
        <span>
          {String(selectedSpotNumber + 1).padStart(2, "0")} / {totalSpots}
        </span>
        <span>{selectedSpot.region}</span>
      </div>

      <div className="detail-title-row">
        <div>
          <h2>{selectedSpot.name}</h2>
          <p>
            {selectedSpot.place} · {selectedSpot.country}
          </p>
        </div>
        <div className="level-list" aria-label="Suitable levels">
          {selectedSpot.levels.map((level) => (
            <span
              className={`level-badge level-${level.toLowerCase()}`}
              key={level}
            >
              {level}
            </span>
          ))}
        </div>
      </div>

      <p className="detail-summary">{selectedSpot.summary}</p>

      <section className="score-card" aria-label="Monthly score breakdown">
        <div className="score-card-heading">
          <div>
            <p>
              {profile.month} · {BOARD_LABELS[board]}
            </p>
            <h3>{getScoreLabel(profile.score)}</h3>
          </div>
          <strong aria-label={`${profile.score} out of 5`}>
            {profile.score.toFixed(1)}
            <small>/5</small>
          </strong>
        </div>

        <div
          aria-label="Choose a month for the score breakdown"
          className="detail-months"
          role="group"
        >
          {monthlyProfiles.map((monthProfile) => {
            const relativeBand = getRelativeSeasonBand(
              monthlyProfiles,
              monthProfile.monthIndex,
            );

            return (
              <button
                aria-label={`${monthProfile.month}: ${monthProfile.score.toFixed(1)} out of 5`}
                aria-pressed={profile.monthIndex === monthProfile.monthIndex}
                className={`detail-month season-band-${relativeBand}`}
                data-relative-band={relativeBand}
                key={monthProfile.month}
                onClick={() => onSelectMonth(monthProfile.monthIndex)}
                type="button"
              >
                <span>{monthProfile.month}</span>
                <strong>{monthProfile.score.toFixed(1)}</strong>
              </button>
            );
          })}
        </div>

        <div className="score-factors">
          {profile.contributions.map((contribution) => (
            <ScoreFactor
              contribution={contribution}
              key={contribution.key}
              profile={profile}
            />
          ))}
        </div>

        <p className="model-note">
          Modeled monthly typicals, not a forecast. Each row shows its points
          toward the 100-point rubric before conversion to a 1–5 score.
        </p>
      </section>

      <dl className="break-facts">
        <div>
          <dt>Break</dt>
          <dd>{selectedSpot.breakType}</dd>
        </div>
        <div>
          <dt>Line</dt>
          <dd>{selectedSpot.direction}</dd>
        </div>
        <div>
          <dt>Prime for this board</dt>
          <dd>{primeMonths.join(" · ")}</dd>
        </div>
      </dl>

      <div className="detail-notes">
        <div>
          <h3>Season read</h3>
          <p>{selectedSpot.seasonNote}</p>
          <p>{selectedSpot.conditions}</p>
        </div>
        <div className="caution-note">
          <h3>Know before you go</h3>
          <p>{selectedSpot.caution}</p>
        </div>
      </div>

      <a
        aria-label={`Open ${selectedSpot.name} in Google Maps`}
        className="maps-link"
        href={googleMapsUrl}
        rel="noreferrer"
        target="_blank"
      >
        <span>
          Open in Google Maps
          <small>
            {selectedSpot.place} · {selectedSpot.country}
          </small>
        </span>
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

function ScoreFactor({
  contribution,
  profile,
}: {
  contribution: ScoreContribution;
  profile: SurfMonthProfile;
}) {
  return (
    <div className="score-factor">
      <div className="factor-copy">
        <span>{contribution.label}</span>
        <small>{getFactorDetail(contribution.key, profile)}</small>
      </div>
      <div className="factor-meter" aria-hidden="true">
        <i style={{ width: `${contribution.rawScore}%` }} />
      </div>
      <strong>
        {contribution.points.toFixed(1)}
        <small>/{contribution.weight}</small>
      </strong>
    </div>
  );
}

function getFactorDetail(
  key: ScoreContribution["key"],
  profile: SurfMonthProfile,
) {
  switch (key) {
    case "wave":
      return `${profile.waveFaceFt.toFixed(1)} ft face · ${profile.swellPeriodS.toFixed(1)}s · ${SHAPE_LABELS[profile.shape]}`;
    case "wind":
      return `${profile.windAlignment} · ${profile.windSpeedKts} kt AM · ${profile.cleanWindPercent}% clean`;
    case "consistency":
      return `${profile.consistencyPercent}% of days with a surfable window`;
    case "tide":
      return TIDE_LABELS[profile.tideFlex];
    case "crowd":
      return `${CROWD_LABELS[profile.crowdLevel]} · ${profile.crowdLevel}/5 pressure`;
  }
}

interface RegionRowsProps {
  board: Board;
  currentMonthIndex: number;
  region: string;
  selectedMonthIndex: number;
  spots: typeof SURF_SPOTS;
  selectedSpotId: string | null;
  onSelect: (spotId: string, monthIndex?: number) => void;
}

function RegionRows({
  board,
  currentMonthIndex,
  region,
  selectedMonthIndex,
  spots,
  selectedSpotId,
  onSelect,
}: RegionRowsProps) {
  return (
    <>
      <tr className="region-row">
        <th colSpan={MONTHS.length + 1} scope="rowgroup">
          {region}
        </th>
      </tr>
      {spots.map((spot) => {
        const spotIndex = SURF_SPOTS.findIndex((item) => item.id === spot.id);
        const selected = spot.id === selectedSpotId;
        const profiles = getMonthlyProfiles(spot, board);

        return (
          <tr
            className={selected ? "is-selected-row" : undefined}
            key={spot.id}
          >
            <th className="spot-column" scope="row">
              <button
                aria-label={`Show details for ${spot.name}, ${spot.country}`}
                aria-pressed={selected}
                className="spot-trigger"
                onClick={() => onSelect(spot.id)}
                type="button"
              >
                <span className="spot-number">
                  {String(spotIndex + 1).padStart(2, "0")}
                </span>
                <span className="spot-identity">
                  <strong>{spot.name}</strong>
                  <small>
                    {spot.place} · {spot.country}
                  </small>
                </span>
                <span
                  className="row-levels"
                  aria-label={spot.levels.join(", ")}
                >
                  {spot.levels.map((level) => (
                    <i
                      aria-hidden="true"
                      className={`level-${level.toLowerCase()}`}
                      key={level}
                    >
                      {levelShort[level]}
                    </i>
                  ))}
                </span>
              </button>
            </th>
            {profiles.map((profile) => {
              const selectedCell =
                selected && selectedMonthIndex === profile.monthIndex;
              const relativeBand = getRelativeSeasonBand(
                profiles,
                profile.monthIndex,
              );

              return (
                <td
                  className={`season-cell-shell${
                    currentMonthIndex === profile.monthIndex
                      ? " is-current-month-cell"
                      : ""
                  }${selectedCell ? " is-selected-cell" : ""}`}
                  key={`${spot.id}-${profile.month}`}
                >
                  <button
                    aria-label={`${spot.name}, ${profile.month}, ${BOARD_LABELS[board]}: ${profile.score.toFixed(1)} out of 5, ${getScoreLabel(profile.score)}. Show breakdown.`}
                    className={`season-cell season-band-${relativeBand}`}
                    data-absolute-score={profile.score.toFixed(1)}
                    data-relative-band={relativeBand}
                    onClick={() => onSelect(spot.id, profile.monthIndex)}
                    type="button"
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
