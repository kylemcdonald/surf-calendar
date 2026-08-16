"use client";

import { useMemo, useRef, useState } from "react";
import {
  bestMonths,
  MONTHS,
  REGIONS,
  SURF_SPOTS,
  type Level,
  type Rating,
} from "./surf-data";
import { WorldMap } from "./world-map";

const ratingLabels: Record<Rating, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Mixed",
  4: "Good",
  5: "Very good",
};

const levelShort: Record<Level, string> = {
  Beginner: "B",
  Intermediate: "I",
  Advanced: "A",
};

const CURRENT_MONTH_INDEX = new Date().getMonth();

export default function SurfAtlas() {
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
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
  const primeMonths = selectedSpot ? bestMonths(selectedSpot) : [];
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

  function selectSpot(spotId: string) {
    setSelectedSpotId(spotId);

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
    <div className="site-shell">
      <main>
        <div className="atlas-frame">
          <div className="matrix-key" aria-label="Chart legends and filters">
            <div className="key-group">
              <span className="key-title">Score</span>
              {([1, 5] as Rating[]).map((rating) => (
                <span className="score-key" key={rating}>
                  <i
                    aria-hidden="true"
                    className={`rating-swatch rating-${rating}`}
                  />
                  <span className="key-label">{ratingLabels[rating]}</span>
                </span>
              ))}
            </div>
            <div className="key-group level-key">
              <span className="key-title">Breaks for</span>
              {(["Beginner", "Intermediate", "Advanced"] as Level[]).map(
                (level) => (
                  <button
                    aria-label={
                      activeLevel === level
                        ? `Show all skill levels`
                        : `Show only ${level} breaks`
                    }
                    aria-pressed={activeLevel === null || activeLevel === level}
                    className="level-filter"
                    key={level}
                    onClick={() => selectLevel(level)}
                    type="button"
                  >
                    <i className={`level-dot level-${level.toLowerCase()}`} />
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
                    Seasonal ratings from 1, very poor, to 5, very good, for 50
                    surf spots across January through December. The current
                    filter shows {visibleSpots.length} spots.
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
                        key={region}
                        currentMonthIndex={CURRENT_MONTH_INDEX}
                        region={region}
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
              <div className="sidebar-sticky">
                <section
                  aria-label="Interactive world surf map"
                  className="map-section"
                >
                  <WorldMap
                    onSelect={selectSpot}
                    selectedId={selectedSpot?.id ?? null}
                    spots={visibleSpots}
                  />
                </section>

                {selectedSpot ? (
                  <article
                    aria-live="polite"
                    className="spot-detail"
                    data-testid="spot-detail"
                    ref={detailRef}
                  >
                    <div className="detail-kicker">
                      <span>
                        {String(selectedSpotNumber + 1).padStart(2, "0")} /{" "}
                        {visibleSpots.length}
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
                        <dt>Prime months</dt>
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
                ) : null}
              </div>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}

interface RegionRowsProps {
  currentMonthIndex: number;
  region: string;
  spots: typeof SURF_SPOTS;
  selectedSpotId: string | null;
  onSelect: (spotId: string) => void;
}

function RegionRows({
  currentMonthIndex,
  region,
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
            {spot.ratings.map((rating, monthIndex) => (
              <td
                aria-label={`${spot.name}, ${MONTHS[monthIndex]}: ${rating} out of 5, ${ratingLabels[rating]}`}
                className={`season-cell rating-${rating}${
                  currentMonthIndex === monthIndex
                    ? " is-current-month-cell"
                    : ""
                }`}
                key={`${spot.id}-${MONTHS[monthIndex]}`}
              />
            ))}
          </tr>
        );
      })}
    </>
  );
}
