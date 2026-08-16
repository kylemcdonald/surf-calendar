"use client";

import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification,
} from "maplibre-gl";
import proj4 from "proj4";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";
import type { SurfSpot } from "./surf-data";

const MAPLIBRE_ZOOM_STEP = Math.log2(1.45);
const MAPLIBRE_MAX_ZOOM_DELTA = 4;
const MAPLIBRE_ZOOM_EPSILON = 0.01;
const MAPLIBRE_WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-180, -65.542],
  [180, 65.542],
];
const MAPLIBRE_WORLD_FIT_PADDING = 12;
const MAPLIBRE_EQUAL_EARTH_GRID_FACTOR =
  20037508.3427892 / 17243959.06;
const EARTH_RADIUS_MILES = 3958.7613;

export const MARKER_CLUSTER_DISTANCE_MILES = 100;

type MapLibreApi = (typeof import("./load-maplibre"))["default"];

interface WorldMapProps {
  spots: SurfSpot[];
  selectedId: string;
  onSelect: (spotId: string) => void;
}

interface MarkerPlacement {
  clustered: boolean;
  offset: readonly [number, number];
  spot: SurfSpot;
}

const topology = worldData as unknown as Topology<{
  countries: GeometryCollection;
}>;
const geographicCountries = feature(
  topology,
  topology.objects.countries,
) as FeatureCollection<Polygon | MultiPolygon>;

proj4.defs(
  "EPSG:8857",
  "+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +R=6371008.7714 +units=m +no_defs +type=crs",
);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
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

function geographicToEqualEarthMercator(coordinate: Position): Position {
  const sourceLongitude = Number(coordinate[0]);
  const sourceLatitude = Number(coordinate[1]);
  const equalEarthMeters = proj4("EPSG:4326", "EPSG:8857", [
    clamp(sourceLongitude, -180, 180),
    clamp(sourceLatitude, -90, 90),
  ]);
  const transformed = proj4("EPSG:3857", "EPSG:4326", [
    equalEarthMeters[0] * MAPLIBRE_EQUAL_EARTH_GRID_FACTOR,
    equalEarthMeters[1] * MAPLIBRE_EQUAL_EARTH_GRID_FACTOR,
  ]);

  let transformedLongitude = transformed[0];
  if (sourceLongitude <= -179.999 && transformedLongitude > 0) {
    transformedLongitude = -Math.abs(transformedLongitude);
  } else if (sourceLongitude >= 179.999 && transformedLongitude < 0) {
    transformedLongitude = Math.abs(transformedLongitude);
  }

  return [
    clamp(transformedLongitude, -180, 180),
    clamp(transformed[1], -85, 85),
    ...coordinate.slice(2),
  ];
}

function transformCountryGeometry(
  geometry: Polygon | MultiPolygon,
): Polygon | MultiPolygon {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring) =>
        ring.map(geographicToEqualEarthMercator),
      ),
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((polygon) =>
      polygon.map((ring) => ring.map(geographicToEqualEarthMercator)),
    ),
  };
}

const equalEarthCountries: FeatureCollection<Polygon | MultiPolygon> = {
  type: "FeatureCollection",
  features: geographicCountries.features.map((country) => ({
    ...country,
    geometry: transformCountryGeometry(country.geometry),
  })),
};

function createEqualEarthLineFeature(
  id: string,
  coordinates: Position[],
): Feature<LineString> {
  return {
    type: "Feature",
    properties: { id },
    geometry: {
      type: "LineString",
      coordinates: coordinates.map(geographicToEqualEarthMercator),
    },
  };
}

function createEqualEarthGraticule(): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];

  for (let longitude = -170; longitude <= 170; longitude += 10) {
    const coordinates: Position[] = [];
    for (let latitude = -90; latitude <= 90; latitude += 1) {
      coordinates.push([longitude, latitude]);
    }
    features.push(
      createEqualEarthLineFeature(`meridian-${longitude}`, coordinates),
    );
  }

  for (let latitude = -80; latitude <= 80; latitude += 10) {
    const coordinates: Position[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 1) {
      coordinates.push([longitude, latitude]);
    }
    features.push(
      createEqualEarthLineFeature(`parallel-${latitude}`, coordinates),
    );
  }

  return { type: "FeatureCollection", features };
}

function createEqualEarthSphere(): FeatureCollection<Polygon> {
  const leftEdge: Position[] = [];
  const rightEdge: Position[] = [];

  for (let latitude = -90; latitude <= 90; latitude += 2) {
    leftEdge.push(geographicToEqualEarthMercator([-180, latitude]));
  }
  for (let latitude = 90; latitude >= -90; latitude -= 2) {
    rightEdge.push(geographicToEqualEarthMercator([180, latitude]));
  }

  const ring = [...leftEdge, ...rightEdge];
  ring.push(ring[0]);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
      },
    ],
  };
}

const equalEarthGraticule = createEqualEarthGraticule();
const equalEarthSphere = createEqualEarthSphere();

function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      "equal-earth-sphere": {
        type: "geojson",
        data: equalEarthSphere,
      },
      "equal-earth-graticule": {
        type: "geojson",
        data: equalEarthGraticule,
      },
      countries: {
        type: "geojson",
        data: equalEarthCountries,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#ffffff" },
      },
      {
        id: "equal-earth-sphere-fill",
        type: "fill",
        source: "equal-earth-sphere",
        paint: {
          "fill-color": "#fafafa",
          "fill-outline-color": "#999999",
        },
      },
      {
        id: "equal-earth-graticule",
        type: "line",
        source: "equal-earth-graticule",
        paint: {
          "line-color": "#d9d9d9",
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 4, 1],
          "line-opacity": 0.95,
        },
      },
      {
        id: "equal-earth-country-fill",
        type: "fill",
        source: "countries",
        paint: { "fill-color": "#f2f2f2" },
      },
      {
        id: "equal-earth-country-outline",
        type: "line",
        source: "countries",
        layout: { "line-join": "round" },
        paint: {
          "line-color": "#b6b6b6",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.38,
            4,
            0.78,
          ],
          "line-opacity": 0.84,
        },
      },
      {
        id: "equal-earth-sphere-outline",
        type: "line",
        source: "equal-earth-sphere",
        paint: {
          "line-color": "#999999",
          "line-width": 1,
        },
      },
    ],
  };
}

function fitMapToWorld(
  map: MapLibreMap,
  minZoomRef: { current: number },
  setZoom: (zoom: number) => void,
  preserveZoom = false,
) {
  const previousZoom = map.getZoom();
  const previousCenter = map.getCenter();
  const wasAtMinimumZoom =
    previousZoom <= minZoomRef.current + MAPLIBRE_ZOOM_EPSILON;

  map.fitBounds(MAPLIBRE_WORLD_BOUNDS, {
    padding: MAPLIBRE_WORLD_FIT_PADDING,
    duration: 0,
  });

  const minimumZoom = map.getZoom();
  minZoomRef.current = minimumZoom;
  map.setMinZoom(minimumZoom);
  map.setMaxZoom(minimumZoom + MAPLIBRE_MAX_ZOOM_DELTA);

  if (preserveZoom && !wasAtMinimumZoom) {
    map.jumpTo({
      center: previousCenter,
      zoom: clamp(
        previousZoom,
        minimumZoom,
        minimumZoom + MAPLIBRE_MAX_ZOOM_DELTA,
      ),
    });
  } else {
    map.jumpTo({ center: [0, 0], zoom: minimumZoom });
  }

  setZoom(map.getZoom());
  return minimumZoom;
}

function getConstrainedCenter(map: MapLibreMap, minimumZoom: number) {
  const bounds = map.getBounds();
  const center = map.getCenter();
  const [[west, south], [east, north]] = MAPLIBRE_WORLD_BOUNDS;
  const visibleWest = bounds.getWest();
  const visibleEast = bounds.getEast();
  const visibleSouth = bounds.getSouth();
  const visibleNorth = bounds.getNorth();
  const visibleLongitudeSpan = visibleEast - visibleWest;
  const visibleLatitudeSpan = visibleNorth - visibleSouth;
  let longitude = center.lng;
  let latitude = center.lat;

  if (map.getZoom() <= minimumZoom + MAPLIBRE_ZOOM_EPSILON) {
    longitude = 0;
    latitude = 0;
  } else {
    if (visibleLongitudeSpan >= east - west) {
      longitude = 0;
    } else {
      if (visibleWest < west) longitude += west - visibleWest;
      if (visibleEast > east) longitude += east - visibleEast;
    }

    if (visibleLatitudeSpan >= north - south) {
      latitude = 0;
    } else {
      if (visibleSouth < south) latitude += south - visibleSouth;
      if (visibleNorth > north) latitude += north - visibleNorth;
    }
  }

  return [
    clamp(longitude, west, east),
    clamp(latitude, south, north),
  ] as [number, number];
}

function enforceMapBounds(
  map: MapLibreMap,
  minimumZoom: number,
  clampingRef: { current: boolean },
) {
  if (clampingRef.current) return;

  const center = map.getCenter();
  const [longitude, latitude] = getConstrainedCenter(map, minimumZoom);
  if (
    Math.abs(longitude - center.lng) <= 0.000001 &&
    Math.abs(latitude - center.lat) <= 0.000001
  ) {
    return;
  }

  clampingRef.current = true;
  map.jumpTo({ center: [longitude, latitude] });
  clampingRef.current = false;
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
  const minimumZoomRef = useRef(0);
  const clampingRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [minimumZoom, setMinimumZoom] = useState(0);
  const [mapZoom, setMapZoom] = useState(0);

  const placements = useMemo(() => createMarkerPlacements(spots), [spots]);
  const hoveredSpot = useMemo(
    () => spots.find((spot) => spot.id === hoveredSpotId) ?? null,
    [hoveredSpotId, spots],
  );
  const canZoomIn =
    mapReady &&
    mapZoom <
      minimumZoom + MAPLIBRE_MAX_ZOOM_DELTA - MAPLIBRE_ZOOM_EPSILON;
  const canZoomOut =
    mapReady && mapZoom > minimumZoom + MAPLIBRE_ZOOM_EPSILON;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function initializeMap() {
      try {
        const maplibregl = (await import("./load-maplibre")).default;
        if (cancelled || !mapContainerRef.current) return;

        mapLibreRef.current = maplibregl;
        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: createMapStyle(),
          center: [0, 0],
          zoom: 0,
          attributionControl: false,
          renderWorldCopies: false,
          dragRotate: false,
          pitchWithRotate: false,
          maxPitch: 0,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();

        map.on("zoom", () => setMapZoom(map?.getZoom() ?? 0));
        map.on("moveend", () => {
          if (map) {
            enforceMapBounds(map, minimumZoomRef.current, clampingRef);
          }
        });
        map.on("load", () => {
          if (cancelled || !map) return;
          setMinimumZoom(
            fitMapToWorld(map, minimumZoomRef, setMapZoom),
          );
          setMapReady(true);
        });

        resizeObserver = new ResizeObserver(() => {
          window.requestAnimationFrame(() => {
            if (cancelled || !map) return;
            map.resize();
            setMinimumZoom(
              fitMapToWorld(map, minimumZoomRef, setMapZoom, true),
            );
            enforceMapBounds(map, minimumZoomRef.current, clampingRef);
          });
        });
        resizeObserver.observe(mapContainerRef.current);
      } catch (error) {
        console.error("Unable to initialize MapLibre", error);
        if (!cancelled) setMapError("The interactive map could not load.");
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
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
      const coordinate = geographicToEqualEarthMercator([
        placement.spot.lon,
        placement.spot.lat,
      ]);

      return new maplibregl.Marker({
        element: markerElement,
        anchor: "center",
        offset: [placement.offset[0], placement.offset[1]],
        subpixelPositioning: true,
      })
        .setLngLat([coordinate[0], coordinate[1]])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [mapReady, placements, selectedId]);

  function zoomMap(delta: number) {
    const map = mapRef.current;
    if (!map) return;

    const nextZoom = clamp(
      map.getZoom() + delta,
      minimumZoomRef.current,
      minimumZoomRef.current + MAPLIBRE_MAX_ZOOM_DELTA,
    );
    if (Math.abs(nextZoom - map.getZoom()) <= MAPLIBRE_ZOOM_EPSILON / 10) {
      return;
    }

    map.easeTo({
      center: getConstrainedCenter(map, minimumZoomRef.current),
      zoom: nextZoom,
      duration: 180,
    });
  }

  return (
    <div
      className="world-map"
      data-cluster-distance-miles={MARKER_CLUSTER_DISTANCE_MILES}
      data-map-ready={mapReady}
      data-testid="world-map"
      data-zoom={mapZoom.toFixed(3)}
    >
      <h2 className="sr-only" id="world-map-title">
        Interactive world surf map
      </h2>
      <p className="sr-only" id="world-map-description">
        Select a surf marker for its break profile. Drag to pan and use the
        controls, mouse wheel, or touch gesture to zoom.
      </p>

      {mapError ? (
        <div className="map-error" role="status">
          {mapError}
        </div>
      ) : (
        <>
          <div aria-label="Map controls" className="map-zoom-controls">
            <button
              aria-label="Zoom in"
              disabled={!canZoomIn}
              onClick={() => zoomMap(MAPLIBRE_ZOOM_STEP)}
              type="button"
            >
              <span aria-hidden="true" className="map-zoom-icon map-zoom-plus" />
            </button>
            <button
              aria-label="Zoom out"
              disabled={!canZoomOut}
              onClick={() => zoomMap(-MAPLIBRE_ZOOM_STEP)}
              type="button"
            >
              <span aria-hidden="true" className="map-zoom-icon" />
            </button>
          </div>

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
