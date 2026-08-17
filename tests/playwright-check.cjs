/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");

const baseUrl = process.env.SURF_ATLAS_URL || "http://localhost:3001/";
const outputDirectory = "test-results";
const markerOverlapThresholdPx = 5.5;
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

async function getMarkerPlacements(page) {
  return page.locator(".map-marker").evaluateAll((markers) =>
    markers.map((marker) => {
      const dotBounds = marker
        .querySelector(".map-marker-dot")
        .getBoundingClientRect();
      const offsetX = Number(marker.getAttribute("data-offset-x"));
      const offsetY = Number(marker.getAttribute("data-offset-y"));
      const screenX = dotBounds.left + dotBounds.width / 2;
      const screenY = dotBounds.top + dotBounds.height / 2;

      return {
        displaced: marker.getAttribute("data-displaced") === "true",
        label: marker.getAttribute("data-label"),
        offsetX,
        offsetY,
        screenX,
        screenY,
        trueX: screenX - offsetX,
        trueY: screenY - offsetY,
      };
    }),
  );
}

function assertOverlapOnlyLayout(markers) {
  markers.forEach((marker, index) => {
    const overlapsAtTrueLocation = markers.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        Math.hypot(
          marker.trueX - candidate.trueX,
          marker.trueY - candidate.trueY,
        ) < markerOverlapThresholdPx,
    );
    const hasOffset = Math.hypot(marker.offsetX, marker.offsetY) >= 0.5;

    assert.equal(
      marker.displaced,
      hasOffset,
      `${marker.label} displacement state should match its rendered offset`,
    );
    if (!overlapsAtTrueLocation) {
      assert.equal(
        hasOffset,
        false,
        `${marker.label} should stay exactly on its coordinates when it does not overlap`,
      );
    }
  });
}

async function run() {
  mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    colorScheme: "light",
    viewport: { width: 1440, height: 1000 },
  });
  const consoleErrors = [];
  let openFreeMapResourceResponses = 0;
  let osmBrightStyleResponses = 0;
  let mapTilerRequests = 0;

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("api.maptiler.com/")) mapTilerRequests += 1;
  });
  page.on("response", (response) => {
    if (response.ok()) {
      if (
        response
          .url()
          .includes("openmaptiles.github.io/osm-bright-gl-style/style-cdn.json")
      ) {
        osmBrightStyleResponses += 1;
      }
      if (response.url().includes("tiles.openfreemap.org/")) {
        openFreeMapResourceResponses += 1;
      }
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page
    .locator('[data-testid="world-map"][data-map-ready="true"]')
    .waitFor({ state: "visible" });
  assert.equal(await page.locator(".map-marker").count(), 50);
  assert.equal(await page.locator(".season-cell").count(), 600);
  assert.equal(await page.locator("td.season-cell").count(), 0);
  assert.equal(await page.locator("button.season-cell").count(), 600);
  assert.equal(await page.locator(".season-cell[aria-pressed]").count(), 0);
  assert.equal(await page.locator(".maplibregl-canvas").count(), 1);
  assert.equal(
    await page.getByTestId("world-map").getAttribute("data-map-system"),
    "maplibre-web-mercator",
  );
  assert.equal(
    await page.getByTestId("world-map").getAttribute("data-basemap"),
    "openmaptiles-osm-bright",
  );
  assert.equal(await page.locator(".maplibregl-ctrl-zoom-in").count(), 0);
  assert.equal(await page.locator(".maplibregl-ctrl-zoom-out").count(), 0);
  assert.equal(await page.locator(".maplibregl-ctrl-group").count(), 0);
  assert.equal(await page.locator(".maplibregl-ctrl-attrib").count(), 0);
  assert.equal(await page.locator(".maplibregl-ctrl-attrib-button").count(), 0);
  assert.equal(await page.locator(".map-zoom-controls").count(), 0);
  assert.match(
    await page.locator(".map-attribution").innerText(),
    /OpenMapTiles.*OpenStreetMap contributors/s,
  );
  assert.equal(osmBrightStyleResponses > 0, true);
  assert.equal(openFreeMapResourceResponses > 0, true);
  assert.equal(mapTilerRequests, 0);
  assert.equal(
    await page
      .getByTestId("world-map")
      .getAttribute("data-marker-overlap-threshold-px"),
    "5.5",
  );
  const markerDotBounds = await page
    .locator(".map-marker-dot")
    .first()
    .boundingBox();
  assert.ok(markerDotBounds);
  assert.equal(markerOverlapThresholdPx, markerDotBounds.width * 0.5);
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".map-marker")].some(
      (marker) => marker.getAttribute("data-displaced") === "true",
    ),
  );
  const initialMarkerPlacements = await getMarkerPlacements(page);
  assertOverlapOnlyLayout(initialMarkerPlacements);
  assert.equal(
    initialMarkerPlacements.some((marker) => marker.displaced),
    true,
    "Overlapping markers should be separated at the initial world zoom",
  );
  assert.equal(
    initialMarkerPlacements.some((marker) => !marker.displaced),
    true,
    "Isolated markers should remain exactly on their locations",
  );
  assert.equal(await page.getByText("When every break comes alive").count(), 0);
  assert.equal(await page.getByText("50 breaks, one orbit").count(), 0);
  assert.equal(await page.getByText("How to read the atlas").count(), 0);
  assert.equal(await page.getByText("The world view", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Select a dot", { exact: true }).count(), 0);
  const topKeyBounds = await page.locator(".matrix-key").boundingBox();
  assert.ok(topKeyBounds);
  assert.equal(topKeyBounds.y <= 1, true, "The page content should start at the top");
  assert.equal(
    await page.locator(".matrix-key").evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    ),
    "0px",
  );
  assert.equal(await page.getByTestId("spot-detail").count(), 0);
  assert.equal(await page.locator(".map-marker.is-selected").count(), 0);
  assert.equal(await page.locator(".is-selected-row").count(), 0);
  assert.equal(await page.locator(".is-selected-cell").count(), 0);

  const scoreLabels = await page
    .locator(".matrix-key .score-key")
    .allInnerTexts();
  assert.deepEqual(scoreLabels.map((label) => label.trim()), [
    "Poor fit",
    "Excellent",
  ]);
  assert.equal(await page.locator(".matrix-key .score-key").count(), 2);

  const boardOptions = page.locator(".board-option");
  assert.deepEqual(
    await boardOptions.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ),
    ["true", "false"],
  );
  const shortboardScores = await page
    .locator(".season-cell")
    .allInnerTexts();
  await page.getByTestId("board-longboard").click();
  const longboardScores = await page.locator(".season-cell").allInnerTexts();
  assert.equal(shortboardScores.length, 600);
  assert.equal(
    shortboardScores.filter((score, index) => score !== longboardScores[index])
      .length > 500,
    true,
    "Changing boards should recompute nearly all month scores",
  );
  assert.deepEqual(
    await boardOptions.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ),
    ["false", "true"],
  );
  await page.getByTestId("board-shortboard").click();

  const currentMonthIndex = await page.evaluate(() => new Date().getMonth());
  const currentMonthHeader = page.locator("th.is-current-month");
  assert.equal(await currentMonthHeader.count(), 1);
  assert.equal(
    (await currentMonthHeader.innerText()).startsWith(
      monthNames[currentMonthIndex].toUpperCase(),
    ),
    true,
  );
  assert.equal(await page.locator(".is-current-month-cell").count(), 50);

  const firstSpotRow = page.locator("tbody tr:not(.region-row)").first();
  const mapSectionPaddingTop = await page.locator(".map-section").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).paddingTop),
  );
  assert.equal(
    mapSectionPaddingTop >= 10,
    true,
    "The map should have a small amount of space above it",
  );
  const interfaceFontSizes = await page.evaluate(() => ({
    filter: Number.parseFloat(
      getComputedStyle(document.querySelector(".level-filter")).fontSize,
    ),
    location: Number.parseFloat(
      getComputedStyle(document.querySelector(".spot-identity small")).fontSize,
    ),
    month: Number.parseFloat(
      getComputedStyle(
        document.querySelector(".season-matrix thead th:not(.spot-column)"),
      ).fontSize,
    ),
    spot: Number.parseFloat(
      getComputedStyle(document.querySelector(".spot-identity strong")).fontSize,
    ),
  }));
  assert.equal(interfaceFontSizes.filter >= 11, true);
  assert.equal(interfaceFontSizes.location >= 10, true);
  assert.equal(interfaceFontSizes.month >= 10, true);
  assert.equal(interfaceFontSizes.spot >= 14, true);
  const lastLevelPillBounds = await firstSpotRow
    .locator(".row-levels i")
    .last()
    .boundingBox();
  const firstRatingBounds = await firstSpotRow
    .locator(".season-cell")
    .first()
    .boundingBox();
  assert.equal(
    Boolean(
      lastLevelPillBounds &&
        firstRatingBounds &&
        firstRatingBounds.x -
          (lastLevelPillBounds.x + lastLevelPillBounds.width) >=
          8,
    ),
    true,
    "Level pills should not touch the rating cells",
  );

  const desktopMapBounds = await page.getByTestId("world-map").boundingBox();
  assert.equal(
    Boolean(
      desktopMapBounds &&
        desktopMapBounds.width >= 500 &&
        desktopMapBounds.height >= 250,
    ),
    true,
  );

  const seasonCellText = await page
    .locator(".season-cell")
    .evaluateAll((cells) => cells.map((cell) => cell.innerText.trim()));
  assert.equal(
    seasonCellText.every((text) => /^[1-5]\.\d$/.test(text)),
    true,
  );
  const levelFilters = page.locator(".level-filter");
  assert.deepEqual(
    await levelFilters.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ),
    ["true", "true", "true"],
  );

  await page.getByRole("button", { name: "Show only Beginner breaks" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".map-marker").length > 0 &&
      document.querySelectorAll(".map-marker").length < 50,
  );
  const beginnerMarkerCount = await page.locator(".map-marker").count();
  assert.equal(beginnerMarkerCount > 0 && beginnerMarkerCount < 50, true);
  assert.equal(
    await page.locator(".season-cell").count(),
    beginnerMarkerCount * 12,
  );
  assert.equal(
    await page.locator(".is-current-month-cell").count(),
    beginnerMarkerCount,
  );
  assert.deepEqual(
    await levelFilters.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ),
    ["true", "false", "false"],
  );
  assertOverlapOnlyLayout(await getMarkerPlacements(page));

  await page.getByRole("button", { name: "Show all skill levels" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".map-marker").length === 50,
  );
  assert.equal(await page.locator(".map-marker").count(), 50);
  assert.equal(await page.locator(".season-cell").count(), 600);
  assert.deepEqual(
    await levelFilters.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ),
    ["true", "true", "true"],
  );

  const initialZoom = Number(
    await page.getByTestId("world-map").getAttribute("data-zoom"),
  );
  assert.equal(Number.isFinite(initialZoom), true);
  const initiallyDisplacedMarker = initialMarkerPlacements.find(
    (marker) => marker.displaced,
  );
  assert.ok(initiallyDisplacedMarker);
  const zoomMapBounds = await page.getByTestId("world-map").boundingBox();
  assert.ok(zoomMapBounds);
  await page.mouse.move(
    zoomMapBounds.x + zoomMapBounds.width / 2,
    zoomMapBounds.y + zoomMapBounds.height / 2,
  );
  for (let step = 0; step < 13; step += 1) {
    await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(240);
  }
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector('[data-testid="world-map"]')?.getAttribute(
          "data-zoom",
        ),
      ) > 9.5,
  );
  const zoomedIn = Number(
    await page.getByTestId("world-map").getAttribute("data-zoom"),
  );
  assert.equal(zoomedIn > initialZoom, true);
  await page.waitForFunction(
    (label) => {
      const marker = [...document.querySelectorAll(".map-marker")].find(
        (candidate) => candidate.getAttribute("data-label") === label,
      );
      return marker?.getAttribute("data-displaced") === "false";
    },
    initiallyDisplacedMarker.label,
  );
  const highZoomPlacements = await getMarkerPlacements(page);
  assertOverlapOnlyLayout(highZoomPlacements);
  const resolvedMarker = highZoomPlacements.find(
    (marker) => marker.label === initiallyDisplacedMarker.label,
  );
  assert.ok(resolvedMarker);
  assert.equal(resolvedMarker.displaced, false);
  assert.equal(resolvedMarker.offsetX, 0);
  assert.equal(resolvedMarker.offsetY, 0);

  await page.reload({ waitUntil: "networkidle" });
  await page
    .locator('[data-testid="world-map"][data-map-ready="true"]')
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelectorAll(".map-marker").length === 50,
  );

  const desktopOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  assert.equal(
    desktopOverflow <= 1,
    true,
    `Desktop overflow: ${desktopOverflow}px`,
  );

  await page.screenshot({
    path: `${outputDirectory}/surf-atlas-desktop.png`,
    fullPage: false,
  });

  await page
    .getByRole("button", { name: "Show details for Zicatela, Mexico" })
    .click();
  const zicatelaDetail = page.getByTestId("spot-detail");
  assert.equal(
    await zicatelaDetail
      .getByRole("heading", { name: "Zicatela" })
      .isVisible(),
    true,
  );
  assert.equal(await zicatelaDetail.locator(".detail-month").count(), 12);
  assert.equal(await zicatelaDetail.locator(".month-score").count(), 0);
  assert.equal(await zicatelaDetail.locator(".mini-season").count(), 0);
  assert.equal(
    await zicatelaDetail.locator('[class*="rating-"]').count(),
    12,
  );
  assert.equal(await zicatelaDetail.locator(".score-factor").count(), 5);
  assert.equal(
    await zicatelaDetail.getByText(/ft face · .*s · Steep \/ hollow/).count(),
    1,
  );
  assert.equal(
    await zicatelaDetail.getByText(/kt AM · .*% clean/).count(),
    1,
  );
  assert.equal(
    await zicatelaDetail.getByText(/% of days with a surfable window/).count(),
    1,
  );
  const detailFontSizes = await zicatelaDetail.evaluate((detail) => ({
    fact: Number.parseFloat(
      getComputedStyle(detail.querySelector(".break-facts dd")).fontSize,
    ),
    kicker: Number.parseFloat(
      getComputedStyle(detail.querySelector(".detail-kicker")).fontSize,
    ),
    note: Number.parseFloat(
      getComputedStyle(detail.querySelector(".detail-notes p")).fontSize,
    ),
    summary: Number.parseFloat(
      getComputedStyle(detail.querySelector(".detail-summary")).fontSize,
    ),
  }));
  assert.equal(detailFontSizes.fact >= 13, true);
  assert.equal(detailFontSizes.kicker >= 10, true);
  assert.equal(detailFontSizes.note >= 13, true);
  assert.equal(detailFontSizes.summary >= 16, true);
  const zicatelaMapsLink = zicatelaDetail.getByRole("link", {
    name: "Open Zicatela in Google Maps",
  });
  const zicatelaMapsUrl = new URL(await zicatelaMapsLink.getAttribute("href"));
  assert.equal(zicatelaMapsUrl.hostname, "www.google.com");
  assert.equal(zicatelaMapsUrl.pathname, "/maps/search/");
  assert.equal(zicatelaMapsUrl.searchParams.get("api"), "1");
  assert.equal(zicatelaMapsUrl.searchParams.get("query"), "15.85,-97.056");
  assert.equal(await zicatelaMapsLink.getAttribute("target"), "_blank");

  assert.equal(
    await zicatelaDetail.evaluate(
      (detail) => getComputedStyle(detail).position,
    ),
    "sticky",
  );
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(100);
  const firstStickyBounds = await zicatelaDetail.boundingBox();
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(100);
  const secondStickyBounds = await zicatelaDetail.boundingBox();
  assert.equal(
    Boolean(
      firstStickyBounds &&
        secondStickyBounds &&
        Math.abs(firstStickyBounds.y - 12) <= 1 &&
        Math.abs(secondStickyBounds.y - 12) <= 1,
    ),
    true,
    "The desktop spot card should stay pinned at the top while the matrix scrolls",
  );

  assert.equal(await page.locator(".is-selected-row").count(), 1);
  assert.match(await page.locator(".is-selected-row").innerText(), /Zicatela/);
  assert.equal(await page.locator(".is-selected-cell").count(), 1);

  await page.getByRole("button", { name: "Select Cloudbreak, Fiji" }).click();
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByRole("heading", { name: "Cloudbreak" })
      .isVisible(),
    true,
  );
  assert.equal(await page.locator(".is-selected-cell").count(), 1);
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByRole("link", { name: "Open Cloudbreak in Google Maps" })
      .isVisible(),
    true,
  );
  await page.getByTestId("spot-detail").screenshot({
    path: `${outputDirectory}/surf-atlas-desktop-detail.png`,
  });

  const markerBounds = await page
    .locator(".map-marker")
    .evaluateAll((markers) =>
      markers.map((marker) => {
        const bounds = marker.getBoundingClientRect();
        return {
          height: bounds.height,
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
        };
      }),
    );
  assert.equal(
    markerBounds.every((bounds) => bounds.width >= 10 && bounds.height >= 10),
    true,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page
    .locator('[data-testid="world-map"][data-map-ready="true"]')
    .waitFor({ state: "visible" });
  assert.equal(await page.getByTestId("spot-detail").count(), 0);
  assert.equal(await page.locator(".map-marker.is-selected").count(), 0);
  const mobileOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  assert.equal(
    mobileOverflow <= 1,
    true,
    `Mobile overflow: ${mobileOverflow}px`,
  );
  assert.equal(await page.getByTestId("world-map").isVisible(), true);
  assert.equal(await page.getByTestId("season-matrix").isVisible(), true);
  const mobileMapBounds = await page.getByTestId("world-map").boundingBox();
  assert.equal(
    Boolean(
      mobileMapBounds &&
        mobileMapBounds.x >= 0 &&
        mobileMapBounds.x + mobileMapBounds.width <= 390,
    ),
    true,
    "The mobile map should stay inside the viewport",
  );

  await page.screenshot({
    path: `${outputDirectory}/surf-atlas-mobile.png`,
    fullPage: false,
  });

  await page
    .getByRole("button", {
      name: "Show details for Arugam Bay, Sri Lanka",
    })
    .click();
  await page.waitForTimeout(500);
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByRole("heading", { name: "Arugam Bay" })
      .isVisible(),
    true,
  );
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByRole("link", { name: "Open Arugam Bay in Google Maps" })
      .isVisible(),
    true,
  );
  assert.equal(
    await page.getByTestId("spot-detail").locator(".mini-season").count(),
    0,
  );
  assert.equal(
    await page.getByTestId("spot-detail").locator(".detail-month").count(),
    12,
  );
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .evaluate((detail) => getComputedStyle(detail).position),
    "static",
  );
  await page.getByTestId("spot-detail").screenshot({
    path: `${outputDirectory}/surf-atlas-mobile-detail.png`,
  });

  assert.deepEqual(consoleErrors, []);
  await browser.close();
  process.stdout.write(
    "Playwright checks passed at desktop and mobile sizes.\n",
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
