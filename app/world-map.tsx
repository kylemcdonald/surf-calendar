"use client";

import type {
  LngLatBoundsLike,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SurfSpot } from "./surf-data";

const EARTH_RADIUS_MILES = 3958.7613;
const INITIAL_MAP_BOUNDS: LngLatBoundsLike = [
  [-179.9, -52],
  [179.9, 68],
];
export const MARKER_CLUSTER_DISTANCE_MILES = 100;

type MapLibreApi = (typeof import("./load-maplibre"))["default"];

interface WorldMapProps {
  spots: SurfSpot[];
  selectedId: string | null;
  onSelect: (spotId: string) => void;
}

interface MarkerPlacement {
  clustered: boolean;
  offset: readonly [number, number];
  spot: SurfSpot;
}

function createDarkMatterStyle(): StyleSpecification {
  return {
    version: 8,
    name: "CARTO Dark Matter",
    sources: {
      "carto-dark-matter": {
        type: "raster",
        tiles: [
          "https://tiles.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
        maxzoom: 20,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      },
    },
    layers: [
      {
        id: "dark-background",
        type: "background",
        paint: { "background-color": "#111a1f" },
      },
      {
        id: "carto-dark-matter",
        type: "raster",
        source: "carto-dark-matter",
        paint: {
          "raster-fade-duration": 0,
          "raster-opacity": 1,
          "raster-resampling": "linear",
        },
      },
    ],
  };
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMiles(first: SurfSpot, second: SurfSpot) {
  const latitudeDelta = degreesToRadians(second.lat - first.lat);
  const longitudeDelta = degreesToRadians(second.lon - first.lon);
  const firstLatitude = degreesToRadians(first.lat);
  const secondLatitude = degreesToRadians(second.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(haversine));
}

export function createMarkerPlacements(spots: SurfSpot[]): MarkerPlacement[] {
  const parents = spots.map((_, index) => index);

  function find(index: number): number {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  }

  function join(firstIndex: number, secondIndex: number) {
    const firstRoot = find(firstIndex);
    const secondRoot = find(secondIndex);
    if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
  }

  for (let firstIndex = 0; firstIndex < spots.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < spots.length;
      secondIndex += 1
    ) {
      if (
        distanceMiles(spots[firstIndex], spots[secondIndex]) <=
        MARKER_CLUSTER_DISTANCE_MILES
      ) {
        join(firstIndex, secondIndex);
      }
    }
  }

  const clusters = new Map<number, number[]>();
  spots.forEach((_, index) => {
    const root = find(index);
    clusters.set(root, [...(clusters.get(root) ?? []), index]);
  });

  const placements = spots.map<MarkerPlacement>((spot) => ({
    clustered: false,
    offset: [0, 0],
    spot,
  }));

  clusters.forEach((indices) => {
    if (indices.length < 2) return;

    const radius =
      indices.length === 2 ? 12 : indices.length === 3 ? 17 : 22;
    indices.forEach((spotIndex, clusterIndex) => {
      const angle = -Math.PI / 2 + (clusterIndex * Math.PI * 2) / indices.length;
      placements[spotIndex] = {
        clustered: true,
        offset: [
          Math.round(Math.cos(angle) * radius),
          Math.round(Math.sin(angle) * radius),
        ],
        spot: spots[spotIndex],
      };
    });
  });

  return placements;
}

function createMarkerElement(
  placement: MarkerPlacement,
  selected: boolean,
  onSelect: () => void,
  onHover: (spotId: string | null) => void,
) {
  const { clustered, offset, spot } = placement;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `map-marker${selected ? " is-selected" : ""}`;
  button.setAttribute("aria-label", `Select ${spot.name}, ${spot.country}`);
  button.setAttribute("aria-pressed", String(selected));
  button.dataset.clustered = String(clustered);
  button.dataset.label = spot.name;
  button.dataset.latitude = String(spot.lat);
  button.dataset.longitude = String(spot.lon);
  button.dataset.offsetX = String(offset[0]);
  button.dataset.offsetY = String(offset[1]);

  if (clustered) {
    const leaderLength = Math.hypot(offset[0], offset[1]);
    const leaderAngle =
      (Math.atan2(-offset[1], -offset[0]) * 180) / Math.PI;
    const leader = document.createElement("span");
    leader.className = "map-marker-leader";
    leader.style.width = `${leaderLength}px`;
    leader.style.transform = `translateY(-50%) rotate(${leaderAngle}deg)`;
    button.append(leader);

    const anchor = document.createElement("span");
    anchor.className = "map-marker-anchor";
    anchor.style.left = `calc(50% - ${offset[0]}px)`;
    anchor.style.top = `calc(50% - ${offset[1]}px)`;
    button.append(anchor);
  }

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
  const markersRef = useRef<MapLibreMarker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(0);

  const placements = useMemo(() => createMarkerPlacements(spots), [spots]);
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
          attributionControl: { compact: true },
          bounds: INITIAL_MAP_BOUNDS,
          container: mapContainerRef.current,
          dragRotate: false,
          fitBoundsOptions: { padding: 14 },
          maxPitch: 0,
          maxZoom: 12,
          minZoom: -0.75,
          pitchWithRotate: false,
          style: createDarkMatterStyle(),
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(
          new maplibregl.NavigationControl({
            showCompass: false,
            showZoom: true,
          }),
          "top-left",
        );

        map.on("zoom", () => setMapZoom(map?.getZoom() ?? 0));
        map.on("load", () => {
          if (cancelled || !map) return;
          setMapZoom(map.getZoom());
          setMapReady(true);
        });
      } catch (error) {
        console.error("Unable to initialize MapLibre", error);
        if (!cancelled) setMapError("The interactive map could not load.");
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
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

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = placements.map((placement) => {
      const markerElement = createMarkerElement(
        placement,
        placement.spot.id === selectedId,
        () => onSelectRef.current(placement.spot.id),
        setHoveredSpotId,
      );

      return new maplibregl.Marker({
        element: markerElement,
        anchor: "center",
        offset: [placement.offset[0], placement.offset[1]],
        subpixelPositioning: true,
      })
        .setLngLat([placement.spot.lon, placement.spot.lat])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [mapReady, placements, selectedId]);

  return (
    <div
      className="world-map world-map-dark"
      data-basemap="carto-dark-matter"
      data-cluster-distance-miles={MARKER_CLUSTER_DISTANCE_MILES}
      data-map-ready={mapReady}
      data-map-system="maplibre-web-mercator"
      data-testid="world-map"
      data-zoom={mapZoom.toFixed(3)}
    >
      <h2 className="sr-only" id="world-map-title">
        Interactive world surf map
      </h2>
      <p className="sr-only" id="world-map-description">
        Surf spots on a Dark Matter street map. Select a marker for its break
        profile, drag to pan, and use the standard controls, mouse wheel, or
        touch gesture to zoom.
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
        </>
      )}
    </div>
  );
}
