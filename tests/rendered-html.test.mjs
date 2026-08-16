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
  assert.match(html, /The world view/);
  assert.match(html, /Interactive world surf map/);
  assert.match(html, /data-testid="world-map"/);
  assert.match(html, /class="maplibre-map"/);
  assert.match(html, /Banzai Pipeline/);
  assert.match(html, /Cloudbreak/);
  assert.equal((html.match(/class="season-cell/g) ?? []).length, 600);
  assert.equal((html.match(/class="level-filter"/g) ?? []).length, 3);
  assert.equal((html.match(/class="score-key"/g) ?? []).length, 2);
  assert.equal((html.match(/is-current-month-cell/g) ?? []).length, 50);
  assert.equal((html.match(/class="is-current-month"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-testid="spot-detail"/);
  assert.doesNotMatch(html, /mini-season|month-score|detail-month/);
  assert.doesNotMatch(html, /class="season-cell[^"]*"[^>]*>[1-5]<\/button>/);
  assert.doesNotMatch(
    html,
    /Find your next|When every break comes alive|50 breaks, one orbit|How to read the atlas|Regional source library|Back to top/,
  );
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships product data and removes starter preview infrastructure", async () => {
  const [page, layout, packageJson, surfAtlas, surfData] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/surf-atlas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/surf-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<SurfAtlas \/>/);
  assert.match(layout, /Swell Season — Global Surf Atlas/);
  assert.doesNotMatch(page, /codex-preview|_sites-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(surfAtlas, /www\.google\.com\/maps\/search/);
  assert.doesNotMatch(surfAtlas, /getSource|Regional source/);
  assert.equal((surfData.match(/^ {4}country:/gm) ?? []).length, 50);

  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});
