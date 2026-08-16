"use client";

import { useMemo, useRef, useState } from "react";
import {
  bestMonths,
  getSource,
  MONTHS,
  REGIONS,
  SOURCES,
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

export default function SurfAtlas() {
  const [selectedSpotId, setSelectedSpotId] = useState("pipeline");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(10);
  const detailRef = useRef<HTMLElement>(null);

  const selectedSpot =
    SURF_SPOTS.find((spot) => spot.id === selectedSpotId) ?? SURF_SPOTS[0];
  const selectedSpotNumber = SURF_SPOTS.findIndex(
    (spot) => spot.id === selectedSpot.id,
  );
  const selectedRating = selectedSpot.ratings[selectedMonthIndex];
  const source = getSource(selectedSpot.sourceId);
  const primeMonths = bestMonths(selectedSpot);

  const groupedSpots = useMemo(
    () =>
      REGIONS.map((region) => ({
        region,
        spots: SURF_SPOTS.filter((spot) => spot.region === region),
      })),
    [],
  );

  function selectSpot(spotId: string, monthIndex?: number) {
    setSelectedSpotId(spotId);
    if (monthIndex !== undefined) setSelectedMonthIndex(monthIndex);

    if (window.matchMedia("(max-width: 1099px)").matches) {
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  return (
    <div className="site-shell">
      <header className="masthead">
        <a aria-label="Swell Season home" className="wordmark" href="#top">
          <span>SWELL</span>
          <span>SEASON</span>
        </a>
        <div className="masthead-note">
          <span>THE GLOBAL SURF ATLAS</span>
          <span>EDITION 01 · 2026</span>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Chase the right wave at the right time</p>
          <h1 id="hero-title">
            Find your next
            <span>perfect season.</span>
          </h1>
          <div className="hero-bottom">
            <p className="hero-copy">
              A month-by-month field guide to 50 essential breaks—balancing
              swell, wind, rain, warmth, and the kind of surfer each wave
              rewards.
            </p>
            <p className="hero-count" aria-label="Atlas coverage">
              <strong>50</strong> breaks <i aria-hidden="true" />
              <strong>28</strong> countries + territories <i aria-hidden="true" />
              <strong>600</strong> season scores
            </p>
          </div>
        </section>

        <section className="atlas-layout" aria-label="Interactive surf atlas">
          <div className="matrix-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">The annual read</p>
                <h2>When every break comes alive</h2>
              </div>
              <p>
                Select a score or spot name for the full break profile. Ratings
                blend surf quality with seasonal weather.
              </p>
            </div>

            <div className="matrix-key" aria-label="Chart legends">
              <div className="key-group">
                <span className="key-title">Score</span>
                {([1, 2, 3, 4, 5] as Rating[]).map((rating) => (
                  <span className="score-key" key={rating}>
                    <i className={`rating-swatch rating-${rating}`} />
                    <span>{rating}</span>
                    <span className="key-label">{ratingLabels[rating]}</span>
                  </span>
                ))}
              </div>
              <div className="key-group level-key">
                <span className="key-title">Breaks for</span>
                {(["Beginner", "Intermediate", "Advanced"] as Level[]).map(
                  (level) => (
                    <span className="level-key-item" key={level}>
                      <i className={`level-dot level-${level.toLowerCase()}`} />
                      {level}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="matrix-scroll" data-testid="season-matrix">
              <table className="season-matrix">
                <caption className="sr-only">
                  Seasonal ratings from 1, very poor, to 5, very good, for 50
                  surf spots across January through December.
                </caption>
                <thead>
                  <tr>
                    <th className="spot-column" scope="col">
                      Spot / level
                    </th>
                    {MONTHS.map((month, monthIndex) => (
                      <th
                        className={
                          selectedMonthIndex === monthIndex
                            ? "is-selected-month"
                            : undefined
                        }
                        key={month}
                        scope="col"
                      >
                        {month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedSpots.map(({ region, spots }) => (
                    <RegionRows
                      key={region}
                      region={region}
                      selectedMonthIndex={selectedMonthIndex}
                      selectedSpotId={selectedSpot.id}
                      spots={spots}
                      onSelect={selectSpot}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="atlas-sidebar" aria-label="Map and selected spot">
            <div className="sidebar-sticky">
              <section className="map-section" aria-labelledby="map-heading">
                <div className="map-heading-row">
                  <div>
                    <p className="eyebrow">The world view</p>
                    <h2 id="map-heading">50 breaks, one orbit</h2>
                  </div>
                  <span>Select a dot</span>
                </div>
                <WorldMap
                  onSelect={selectSpot}
                  selectedId={selectedSpot.id}
                  spots={SURF_SPOTS}
                />
              </section>

              <article
                aria-live="polite"
                className="spot-detail"
                data-testid="spot-detail"
                ref={detailRef}
              >
                <div className="detail-kicker">
                  <span>
                    {String(selectedSpotNumber + 1).padStart(2, "0")} / 50
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

                <div className="detail-month">
                  <div className="month-score">
                    <div>
                      <span>{MONTHS[selectedMonthIndex]}</span>
                      <strong>{ratingLabels[selectedRating]}</strong>
                    </div>
                    <b className={`rating-${selectedRating}`}>
                      {selectedRating}
                      <small>/5</small>
                    </b>
                  </div>
                  <div className="mini-season" aria-label="Full-year ratings">
                    {MONTHS.map((month, index) => (
                      <button
                        aria-label={`${month}: ${selectedSpot.ratings[index]} out of 5, ${ratingLabels[selectedSpot.ratings[index]]}`}
                        aria-pressed={selectedMonthIndex === index}
                        className={`rating-${selectedSpot.ratings[index]}`}
                        key={month}
                        onClick={() => setSelectedMonthIndex(index)}
                        type="button"
                      >
                        <span>{month.slice(0, 1)}</span>
                        <strong>{selectedSpot.ratings[index]}</strong>
                      </button>
                    ))}
                  </div>
                </div>

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
                  className="source-link"
                  href={source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>
                    Regional source
                    <small>{source.publisher}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </a>
              </article>
            </div>
          </aside>
        </section>

        <section
          className="methodology"
          id="methodology"
          aria-labelledby="methodology-title"
        >
          <div className="methodology-copy">
            <p className="eyebrow">How to read the atlas</p>
            <h2 id="methodology-title">Season, not forecast.</h2>
            <p>
              Scores are a planning guide. Wave quality and consistency lead;
              prevailing wind, rain, temperature, daylight, and tropical-storm
              exposure adjust the result. A 5 means prime for the surfer the
              break demands—it never overrides local warnings or ability.
            </p>
            <p className="methodology-date">Research reviewed August 16, 2026.</p>
          </div>

          <details className="source-drawer">
            <summary>
              <span>Regional source library</span>
              <span>{SOURCES.length} references</span>
            </summary>
            <div className="source-grid">
              {SOURCES.map((item) => (
                <a
                  href={item.url}
                  key={item.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{item.label}</span>
                  <small>{item.publisher} ↗</small>
                </a>
              ))}
            </div>
          </details>
        </section>
      </main>

      <footer>
        <span>SWELL SEASON · GLOBAL SURF ATLAS</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </div>
  );
}

interface RegionRowsProps {
  region: string;
  spots: typeof SURF_SPOTS;
  selectedSpotId: string;
  selectedMonthIndex: number;
  onSelect: (spotId: string, monthIndex?: number) => void;
}

function RegionRows({
  region,
  spots,
  selectedSpotId,
  selectedMonthIndex,
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
          <tr className={selected ? "is-selected-row" : undefined} key={spot.id}>
            <th className="spot-column" scope="row">
              <button
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
                <span className="row-levels" aria-label={spot.levels.join(", ")}>
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
            {spot.ratings.map((rating, monthIndex) => {
              const selectedCell =
                selected && selectedMonthIndex === monthIndex;

              return (
                <td key={`${spot.id}-${MONTHS[monthIndex]}`}>
                  <button
                    aria-label={`${spot.name}, ${MONTHS[monthIndex]}: ${rating} out of 5, ${ratingLabels[rating]}`}
                    aria-pressed={selectedCell}
                    className={`season-cell rating-${rating}${
                      selectedCell ? " is-selected-cell" : ""
                    }`}
                    onClick={() => onSelect(spot.id, monthIndex)}
                    type="button"
                  >
                    {rating}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
