"use client";

import { geoEqualEarth, geoPath } from "d3-geo";
import type { FeatureCollection, Sphere } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";
import type { SurfSpot } from "./surf-data";

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 500;
const sphere: Sphere = { type: "Sphere" };
const projection = geoEqualEarth().fitExtent(
  [
    [18, 18],
    [VIEWBOX_WIDTH - 18, VIEWBOX_HEIGHT - 18],
  ],
  sphere,
);
const path = geoPath(projection);

const topology = worldData as unknown as Topology<{
  countries: GeometryCollection;
}>;
const countries = feature(
  topology,
  topology.objects.countries,
) as FeatureCollection;

const countryPaths = countries.features
  .map((country) => path(country))
  .filter((countryPath): countryPath is string => Boolean(countryPath));
const spherePath = path(sphere) ?? "";

const markerOffsets: Record<string, readonly [number, number]> = {
  pipeline: [-28, -12],
  "sunset-beach": [-8, -26],
  waikiki: [-26, 16],
  "honolua-bay": [12, 18],
  jaws: [26, -12],
  "lower-trestles": [-10, -12],
  malibu: [14, 4],
  mavericks: [-6, -18],
  "ribeira-dilhas": [-24, -14],
  supertubos: [2, -24],
  arrifana: [-18, 18],
  nazare: [24, 8],
  "anchor-point": [-13, -13],
  imsouane: [14, 14],
  uluwatu: [-30, 18],
  canggu: [-18, -18],
  "g-land": [16, 16],
  macaronis: [-22, -24],
  nias: [20, -18],
  "arugam-bay": [14, -12],
  hikkaduwa: [-14, 12],
  "snapper-rocks": [12, -13],
  "bells-beach": [-14, 14],
};

interface WorldMapProps {
  spots: SurfSpot[];
  selectedId: string;
  onSelect: (spotId: string) => void;
}

export function WorldMap({ spots, selectedId, onSelect }: WorldMapProps) {
  const points = spots.map((spot) => {
    const projected = projection([spot.lon, spot.lat]) ?? [0, 0];
    const offset = markerOffsets[spot.id] ?? [0, 0];
    const actualX = Math.round(projected[0] * 1000) / 1000;
    const actualY = Math.round(projected[1] * 1000) / 1000;

    return {
      spot,
      actualX,
      actualY,
      displayX: actualX + offset[0],
      displayY: actualY + offset[1],
      offset,
    };
  });

  return (
    <div className="world-map" data-testid="world-map">
      <svg
        aria-labelledby="world-map-title world-map-description"
        className="world-map-art"
        role="img"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      >
        <title id="world-map-title">World map of 50 surf spots</title>
        <desc id="world-map-description">
          Select any plotted surf spot to see its break profile and monthly
          conditions.
        </desc>
        <path className="map-ocean" d={spherePath} />
        <g aria-hidden="true">
          {countryPaths.map((countryPath, index) => (
            <path className="map-country" d={countryPath} key={index} />
          ))}
        </g>
        <g aria-hidden="true" className="map-leaders">
          {points.map(({ actualX, actualY, displayX, displayY, offset, spot }) =>
            offset[0] !== 0 || offset[1] !== 0 ? (
              <line
                key={spot.id}
                x1={actualX}
                x2={displayX}
                y1={actualY}
                y2={displayY}
              />
            ) : null,
          )}
        </g>
      </svg>

      <div className="map-markers" aria-label="Surf spot map markers">
        {points.map(({ displayX, displayY, spot }) => {
          const selected = selectedId === spot.id;

          return (
            <button
              aria-label={`Select ${spot.name}, ${spot.country}`}
              aria-pressed={selected}
              className={`map-marker${selected ? " is-selected" : ""}`}
              data-label={spot.name}
              key={spot.id}
              onClick={() => onSelect(spot.id)}
              style={{
                left: `${((displayX / VIEWBOX_WIDTH) * 100).toFixed(4)}%`,
                top: `${((displayY / VIEWBOX_HEIGHT) * 100).toFixed(4)}%`,
              }}
              type="button"
            >
              <span className="sr-only">{spot.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
