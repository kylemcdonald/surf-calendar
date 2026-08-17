import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete surf atlas", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Swell Season — Global Surf Atlas<\/title>/i);
  assert.match(html, /Interactive world surf map/);
  assert.match(html, /data-testid="world-map"/);
  assert.match(html, /data-map-system="maplibre-web-mercator"/);
  assert.match(html, /data-basemap="openmaptiles-osm-bright"/);
  assert.match(html, /data-marker-overlap-threshold-px="5\.5"/);
  assert.match(html, /class="maplibre-map"/);
  assert.match(html, /class="map-attribution"/);
  assert.match(html, /© OpenMapTiles/);
  assert.match(html, /© OpenStreetMap contributors/);
  assert.match(html, /Banzai Pipeline/);
  assert.match(html, /Cloudbreak/);
  assert.equal(
    (html.match(/class="season-cell season-band-/g) ?? []).length,
    600,
  );
  assert.equal((html.match(/class="board-option"/g) ?? []).length, 2);
  assert.equal((html.match(/class="level-filter"/g) ?? []).length, 3);
  assert.equal((html.match(/class="score-key"/g) ?? []).length, 2);
  assert.equal((html.match(/is-current-month-cell/g) ?? []).length, 50);
  assert.equal((html.match(/class="is-current-month"/g) ?? []).length, 1);
  assert.match(html, /I’m riding/);
  assert.match(html, /Season strength/);
  assert.match(html, /Lower for spot/);
  assert.match(html, /Prime for spot/);
  assert.match(html, /colors do not compare quality between spots/);
  assert.match(html, /Board \+ wave fit 40%/);
  assert.match(html, /data-absolute-score="3\.[0-9]"/);
  assert.doesNotMatch(html, />[1-5]\.[0-9]<\/button>/);
  assert.doesNotMatch(html, /data-testid="spot-detail"/);
  assert.doesNotMatch(html, /mini-season|month-score/);
  assert.match(html, /<button[^>]*class="season-cell/);
  assert.doesNotMatch(
    html,
    /Find your next|When every break comes alive|50 breaks, one orbit|How to read the atlas|Regional source library|Back to top|The world view|Select a dot/,
  );
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships product data and removes starter preview infrastructure", async () => {
  const [
    globals,
    page,
    layout,
    packageJson,
    surfAtlas,
    surfData,
    surfModel,
    worldMap,
  ] =
    await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/surf-atlas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/surf-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/surf-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/world-map.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<SurfAtlas \/>/);
  assert.match(layout, /Swell Season — Global Surf Atlas/);
  assert.doesNotMatch(page, /codex-preview|_sites-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(surfAtlas, /www\.google\.com\/maps\/search/);
  assert.doesNotMatch(surfAtlas, /getSource|Regional source/);
  assert.match(surfAtlas, /selectedMonthIndex/);
  assert.match(surfAtlas, /is-selected-cell/);
  assert.match(surfAtlas, /board-\$\{option\}/);
  assert.match(surfModel, /Board \+ wave fit/);
  assert.match(surfModel, /cleanWindPercent/);
  assert.match(surfModel, /consistencyPercent/);
  assert.match(surfModel, /crowdLevel/);
  assert.match(surfModel, /tideFlex/);
  assert.match(surfModel, /getRelativeSeasonBand/);
  assert.equal((surfModel.match(/: model\(/g) ?? []).length, 50);
  assert.equal((surfData.match(/^ {4}seasonality:/gm) ?? []).length, 50);
  assert.doesNotMatch(surfData, /^ {4}ratings:/m);
  assert.match(globals, /--sea-pale: hsl\(210 67% 85%\)/);
  assert.doesNotMatch(globals, /#075961|#2f8f8a|#88c8bf|#cadfda/);
  assert.match(worldMap, /osm-bright-gl-style\/style-cdn\.json/);
  assert.match(worldMap, /tiles\.openfreemap\.org\/planet/);
  assert.match(worldMap, /MARKER_OVERLAP_THRESHOLD_PX/);
  assert.match(worldMap, /map\.project/);
  assert.match(worldMap, /attributionControl: false/);
  assert.doesNotMatch(
    worldMap,
    /CARTO Dark Matter|NavigationControl|createDarkMatterStyle|distanceMiles|MARKER_CLUSTER_DISTANCE_MILES/,
  );
  assert.doesNotMatch(
    worldMap,
    /proj4|EqualEarth|equal-earth|fitMapToWorld|enforceMapBounds/,
  );
  assert.doesNotMatch(
    packageJson,
    /proj4|topojson-client|world-atlas|topojson-specification/,
  );
  assert.equal((surfData.match(/^ {4}country:/gm) ?? []).length, 50);

  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});

test("configures a static GitHub Pages deployment", async () => {
  const [nextConfig, packageJson, pagesWorkflow, preparePages] =
    await Promise.all([
      readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(
        new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../scripts/prepare-pages.mjs", import.meta.url), "utf8"),
    ]);

  assert.match(nextConfig, /assetPrefix: "\/surf-calendar"/);
  assert.match(nextConfig, /output: "export"/);
  assert.match(packageJson, /"build:pages"/);
  assert.match(pagesWorkflow, /actions\/deploy-pages@v4/);
  assert.match(pagesWorkflow, /path: dist\/client/);
  assert.match(preparePages, /surf-calendar\/_next/);
  await access(new URL("../public/.nojekyll", import.meta.url));
});
