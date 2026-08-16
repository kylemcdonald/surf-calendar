"use client";

import type {
  LngLatBoundsLike,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SurfSpot } from "./surf-data";

const INITIAL_MAP_BOUNDS: LngLatBoundsLike = [
  [-179.9, -52],
  [179.9, 68],
];
const OSM_BRIGHT_STYLE_URL =
  "https://openmaptiles.github.io/osm-bright-gl-style/style-cdn.json";
const OPENFREEMAP_TILEJSON_URL = "https://tiles.openfreemap.org/planet";
const OPENFREEMAP_FONT_ROOT = "https://tiles.openfreemap.org/fonts/";
export const MARKER_MIN_SEPARATION_PX = 16;

type MapLibreApi = (typeof import("./load-maplibre"))["default"];

interface WorldMapProps {
  spots: SurfSpot[];
  selectedId: string | null;
  onSelect: (spotId: string) => void;
}

interface RenderedMarker {
  element: HTMLButtonElement;
  marker: MapLibreMarker;
  spot: SurfSpot;
}

function transformOsmBrightRequest(url: string) {
  if (
    url.startsWith(
      "https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json",
    )
  ) {
    return { url: OPENFREEMAP_TILEJSON_URL };
  }

  if (url.startsWith("https://api.maptiler.com/fonts/")) {
    const fontPath = new URL(url).pathname.replace(/^\/fonts\//, "");
    return { url: `${OPENFREEMAP_FONT_ROOT}${fontPath}` };
  }

  return { url };
}

function setMarkerOffset(
  renderedMarker: RenderedMarker,
  offset: readonly [number, number],
) {
  const [offsetX, offsetY] = offset;
  const displaced = Math.hypot(offsetX, offsetY) >= 0.5;
  const { element, marker } = renderedMarker;
  const leader = element.querySelector<HTMLElement>(".map-marker-leader");
  const anchor = element.querySelector<HTMLElement>(".map-marker-anchor");

  marker.setOffset([offsetX, offsetY]);
  element.dataset.displaced = String(displaced);
  element.dataset.offsetX = String(offsetX);
  element.dataset.offsetY = String(offsetY);

  if (!leader || !anchor) return;

  leader.hidden = !displaced;
  anchor.hidden = !displaced;
  if (!displaced) return;

  const leaderLength = Math.hypot(offsetX, offsetY);
  const leaderAngle = (Math.atan2(-offsetY, -offsetX) * 180) / Math.PI;
  leader.style.width = `${leaderLength}px`;
  leader.style.transform = `translateY(-50%) rotate(${leaderAngle}deg)`;
  anchor.style.left = `calc(50% + ${-offsetX}px)`;
  anchor.style.top = `calc(50% + ${-offsetY}px)`;
}

export function applyMarkerCollisionLayout(
  map: MapLibreMap,
  renderedMarkers: RenderedMarker[],
) {
  if (renderedMarkers.length === 0) return;

  const projectedPoints = renderedMarkers.map(({ spot }) =>
    map.project([spot.lon, spot.lat]),
  );
  const parents = renderedMarkers.map((_, index) => index);

  function find(index: number): number {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  }

  function join(firstIndex: number, secondIndex: number) {
    const firstRoot = find(firstIndex);
    const secondRoot = find(secondIndex);
    if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
  }

  for (
    let firstIndex = 0;
    firstIndex < projectedPoints.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < projectedPoints.length;
      secondIndex += 1
    ) {
      const firstPoint = projectedPoints[firstIndex];
      const secondPoint = projectedPoints[secondIndex];
      if (
        Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y) <
        MARKER_MIN_SEPARATION_PX
      ) {
        join(firstIndex, secondIndex);
      }
    }
  }

  const collisionGroups = new Map<number, number[]>();
  renderedMarkers.forEach((_, index) => {
    const root = find(index);
    collisionGroups.set(root, [
      ...(collisionGroups.get(root) ?? []),
      index,
    ]);
  });

  collisionGroups.forEach((indices) => {
    if (indices.length === 1) {
      setMarkerOffset(renderedMarkers[indices[0]], [0, 0]);
      return;
    }

    const centroid = indices.reduce(
      (point, index) => ({
        x: point.x + projectedPoints[index].x / indices.length,
        y: point.y + projectedPoints[index].y / indices.length,
      }),
      { x: 0, y: 0 },
    );
    const radius = Math.max(
      10,
      MARKER_MIN_SEPARATION_PX /
        (2 * Math.sin(Math.PI / indices.length)) +
        1,
    );

    indices.forEach((markerIndex, groupIndex) => {
      const angle =
        -Math.PI / 2 + (groupIndex * Math.PI * 2) / indices.length;
      const projectedPoint = projectedPoints[markerIndex];
      const offset: readonly [number, number] = [
        Math.round(centroid.x + Math.cos(angle) * radius - projectedPoint.x),
        Math.round(centroid.y + Math.sin(angle) * radius - projectedPoint.y),
      ];
      setMarkerOffset(renderedMarkers[markerIndex], offset);
    });
  });
}

function createMarkerElement(
  spot: SurfSpot,
  selected: boolean,
  onSelect: () => void,
  onHover: (spotId: string | null) => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `map-marker${selected ? " is-selected" : ""}`;
  button.setAttribute("aria-label", `Select ${spot.name}, ${spot.country}`);
  button.setAttribute("aria-pressed", String(selected));
  button.dataset.displaced = "false";
  button.dataset.label = spot.name;
  button.dataset.latitude = String(spot.lat);
  button.dataset.longitude = String(spot.lon);
  button.dataset.offsetX = "0";
  button.dataset.offsetY = "0";

  const leader = document.createElement("span");
  leader.className = "map-marker-leader";
  leader.hidden = true;
  button.append(leader);

  const anchor = document.createElement("span");
  anchor.className = "map-marker-anchor";
  anchor.hidden = true;
  button.append(anchor);

  const dot = document.createElement("span");
  dot.className = "map-marker-dot";
  button.append(dot);

  const accessibleName = document.createElement("span");
  accessibleName.className = "sr-only";
  accessibleName.textContent = spot.name;
  button.append(accessibleName);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect();
  });
  button.addEventListener("mouseenter", () => onHover(spot.id));
  button.addEventListener("mouseleave", () => onHover(null));
  button.addEventListener("focus", () => onHover(spot.id));
  button.addEventListener("blur", () => onHover(null));

  return button;
}

export function WorldMap({ spots, selectedId, onSelect }: WorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLibreRef = useRef<MapLibreApi | null>(null);
  const markersRef = useRef<RenderedMarker[]>([]);
  const collisionFrameRef = useRef<number | null>(null);
  const scheduleMarkerLayoutRef = useRef<() => void>(() => undefined);
  const onSelectRef = useRef(onSelect);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(0);

  const hoveredSpot = useMemo(
    () => spots.find((spot) => spot.id === hoveredSpotId) ?? null,
    [hoveredSpotId, spots],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;

    async function initializeMap() {
      try {
        const maplibregl = (await import("./load-maplibre")).default;
        if (cancelled || !mapContainerRef.current) return;

        mapLibreRef.current = maplibregl;
        map = new maplibregl.Map({
          attributionControl: false,
          bounds: INITIAL_MAP_BOUNDS,
          container: mapContainerRef.current,
          dragRotate: false,
          fitBoundsOptions: { padding: 14 },
          maxPitch: 0,
          maxZoom: 12,
          minZoom: -0.75,
          pitchWithRotate: false,
          style: OSM_BRIGHT_STYLE_URL,
          transformRequest: transformOsmBrightRequest,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();

        const scheduleMarkerLayout = () => {
          if (collisionFrameRef.current !== null) return;
          collisionFrameRef.current = window.requestAnimationFrame(() => {
            collisionFrameRef.current = null;
            if (map) applyMarkerCollisionLayout(map, markersRef.current);
          });
        };
        scheduleMarkerLayoutRef.current = scheduleMarkerLayout;

        const updateMapLayout = () => {
          if (!map) return;
          setMapZoom(map.getZoom());
          scheduleMarkerLayout();
        };

        map.on("move", updateMapLayout);
        map.on("resize", scheduleMarkerLayout);
        map.on("load", () => {
          if (cancelled || !map) return;
          setMapZoom(map.getZoom());
          setMapReady(true);
          scheduleMarkerLayout();
        });
      } catch (error) {
        console.error("Unable to initialize MapLibre", error);
        if (!cancelled) setMapError("The interactive map could not load.");
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
      if (collisionFrameRef.current !== null) {
        window.cancelAnimationFrame(collisionFrameRef.current);
        collisionFrameRef.current = null;
      }
      scheduleMarkerLayoutRef.current = () => undefined;
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
      mapLibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = mapLibreRef.current;
    if (!map || !maplibregl || !mapReady) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = spots.map((spot) => {
      const markerElement = createMarkerElement(
        spot,
        spot.id === selectedId,
        () => onSelectRef.current(spot.id),
        setHoveredSpotId,
      );
      const marker = new maplibregl.Marker({
        element: markerElement,
        anchor: "center",
        offset: [0, 0],
        subpixelPositioning: true,
      })
        .setLngLat([spot.lon, spot.lat])
        .addTo(map);

      return { element: markerElement, marker, spot };
    });
    scheduleMarkerLayoutRef.current();

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
    };
  }, [mapReady, selectedId, spots]);

  return (
    <div
      className="world-map"
      data-basemap="openmaptiles-osm-bright"
      data-map-ready={mapReady}
      data-map-system="maplibre-web-mercator"
      data-marker-separation-px={MARKER_MIN_SEPARATION_PX}
      data-testid="world-map"
      data-zoom={mapZoom.toFixed(3)}
    >
      <h2 className="sr-only" id="world-map-title">
        Interactive world surf map
      </h2>
      <p className="sr-only" id="world-map-description">
        Surf spots on an OSM Bright street map. Select a marker for its break
        profile, drag to pan, and use a mouse wheel, double-click, or touch
        gesture to zoom.
      </p>

      {mapError ? (
        <div className="map-error" role="status">
          {mapError}
        </div>
      ) : (
        <>
          {hoveredSpot ? (
            <div aria-live="polite" className="map-hover-card">
              <strong>{hoveredSpot.name}</strong>
              <span>
                {hoveredSpot.place} · {hoveredSpot.country}
              </span>
              <small>
                {Math.abs(hoveredSpot.lat).toFixed(3)}°
                {hoveredSpot.lat >= 0 ? "N" : "S"} ·{" "}
                {Math.abs(hoveredSpot.lon).toFixed(3)}°
                {hoveredSpot.lon >= 0 ? "E" : "W"}
              </small>
            </div>
          ) : null}

          <div
            aria-labelledby="world-map-title world-map-description"
            className="maplibre-map"
            ref={mapContainerRef}
            role="application"
          />
          <div aria-label="Map attribution" className="map-attribution">
            <a href="https://openmaptiles.org/" rel="noreferrer" target="_blank">
              © OpenMapTiles
            </a>{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="noreferrer"
              target="_blank"
            >
              © OpenStreetMap contributors
            </a>
          </div>
        </>
      )}
    </div>
  );
}
