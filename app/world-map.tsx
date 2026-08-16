"use client";

import { geoEqualEarth, geoPath } from "d3-geo";
import type { FeatureCollection, Sphere } from "geojson";
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";
import type { SurfSpot } from "./surf-data";

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
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
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mapView, setMapView] = useState({ zoom: 1, x: 0, y: 0 });

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

  function clampOffsets(x: number, y: number, zoom: number) {
    const bounds = mapRef.current?.getBoundingClientRect();
    if (!bounds || zoom <= MIN_ZOOM) return { x: 0, y: 0 };

    const maxX = (bounds.width * (zoom - 1)) / 2;
    const maxY = (bounds.height * (zoom - 1)) / 2;

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  function zoomBy(
    amount: number,
    clientPoint?: { clientX: number; clientY: number },
  ) {
    setMapView((current) => {
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, current.zoom + amount),
      );
      if (nextZoom === current.zoom) return current;

      let nextX = current.x;
      let nextY = current.y;
      const bounds = mapRef.current?.getBoundingClientRect();

      if (bounds && clientPoint) {
        const pointX = clientPoint.clientX - bounds.left - bounds.width / 2;
        const pointY = clientPoint.clientY - bounds.top - bounds.height / 2;
        const localX = (pointX - current.x) / current.zoom;
        const localY = (pointY - current.y) / current.zoom;
        nextX = pointX - localX * nextZoom;
        nextY = pointY - localY * nextZoom;
      }

      const clamped = clampOffsets(nextX, nextY, nextZoom);
      return { zoom: nextZoom, ...clamped };
    });
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP, event);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as Element;
    if (mapView.zoom <= MIN_ZOOM || target.closest("button")) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: mapView.x,
      startOffsetY: mapView.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const clamped = clampOffsets(
      drag.startOffsetX + event.clientX - drag.startClientX,
      drag.startOffsetY + event.clientY - drag.startClientY,
      mapView.zoom,
    );
    setMapView((current) => ({ ...current, ...clamped }));
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
  }

  const stageStyle = {
    "--map-marker-scale": 1 / mapView.zoom,
    transform: `translate3d(${mapView.x}px, ${mapView.y}px, 0) scale(${mapView.zoom})`,
  } as CSSProperties;

  return (
    <div
      className={`world-map${mapView.zoom > MIN_ZOOM ? " is-zoomed" : ""}${
        isDragging ? " is-dragging" : ""
      }`}
      data-testid="world-map"
      data-zoom={mapView.zoom}
      onPointerCancel={finishDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onWheel={handleWheel}
      ref={mapRef}
    >
      <div className="world-map-stage" style={stageStyle}>
        <svg
          aria-labelledby="world-map-title world-map-description"
          className="world-map-art"
          role="img"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        >
          <title id="world-map-title">Interactive world surf map</title>
          <desc id="world-map-description">
            Select any plotted surf spot to see its break profile and monthly
            conditions. Use the map controls or mouse wheel to zoom, then drag
            to explore.
          </desc>
          <path className="map-ocean" d={spherePath} />
          <g aria-hidden="true">
            {countryPaths.map((countryPath, index) => (
              <path className="map-country" d={countryPath} key={index} />
            ))}
          </g>
          <g aria-hidden="true" className="map-leaders">
            {points.map(
              ({ actualX, actualY, displayX, displayY, offset, spot }) =>
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

      <div
        aria-label="Map zoom controls"
        className="map-zoom-controls"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Zoom out map"
          disabled={mapView.zoom <= MIN_ZOOM}
          onClick={() => zoomBy(-ZOOM_STEP)}
          type="button"
        >
          −
        </button>
        <button
          aria-label="Reset map zoom"
          disabled={
            mapView.zoom === MIN_ZOOM && mapView.x === 0 && mapView.y === 0
          }
          onClick={() => setMapView({ zoom: 1, x: 0, y: 0 })}
          type="button"
        >
          ↺
        </button>
        <button
          aria-label="Zoom in map"
          disabled={mapView.zoom >= MAX_ZOOM}
          onClick={() => zoomBy(ZOOM_STEP)}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}
