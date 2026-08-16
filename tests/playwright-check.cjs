/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");

const baseUrl = process.env.SURF_ATLAS_URL || "http://localhost:3001/";
const outputDirectory = "test-results";
const clusterDistanceMiles = 100;
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

function distanceMiles(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * 3958.7613 * Math.asin(Math.sqrt(haversine));
}

async function getMarkerPlacements(page) {
  return page.locator(".map-marker").evaluateAll((markers) =>
    markers.map((marker) => ({
      clustered: marker.getAttribute("data-clustered") === "true",
      label: marker.getAttribute("data-label"),
      latitude: Number(marker.getAttribute("data-latitude")),
      longitude: Number(marker.getAttribute("data-longitude")),
      offsetX: Number(marker.getAttribute("data-offset-x")),
      offsetY: Number(marker.getAttribute("data-offset-y")),
    })),
  );
}

function assertExactMarkerRule(markers) {
  markers.forEach((marker, index) => {
    const hasNearbyMarker = markers.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        distanceMiles(marker, candidate) <= clusterDistanceMiles,
    );
    const hasOffset = marker.offsetX !== 0 || marker.offsetY !== 0;

    assert.equal(
      marker.clustered,
      hasNearbyMarker,
      `${marker.label} cluster status should match the 100-mile rule`,
    );
    assert.equal(
      hasOffset,
      hasNearbyMarker,
      `${marker.label} should be offset only when another point is within 100 miles`,
    );
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

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page
    .locator('[data-testid="world-map"][data-map-ready="true"]')
    .waitFor({ state: "visible" });
  assert.equal(await page.locator(".map-marker").count(), 50);
  assert.equal(await page.locator(".season-cell").count(), 600);
  assert.equal(await page.locator(".maplibregl-canvas").count(), 1);
  assert.equal(
    await page.getByTestId("world-map").getAttribute("data-cluster-distance-miles"),
    "100",
  );
  assertExactMarkerRule(await getMarkerPlacements(page));
  assert.equal(await page.getByText("When every break comes alive").count(), 0);
  assert.equal(await page.getByText("50 breaks, one orbit").count(), 0);
  assert.equal(await page.getByText("How to read the atlas").count(), 0);
  assert.equal(await page.getByTestId("spot-detail").count(), 0);
  assert.equal(await page.locator(".map-marker.is-selected").count(), 0);
  assert.equal(await page.locator(".is-selected-row").count(), 0);
  assert.equal(await page.locator(".is-selected-cell").count(), 0);

  const scoreLabels = await page
    .locator(".matrix-key .score-key")
    .allInnerTexts();
  assert.deepEqual(scoreLabels.map((label) => label.trim()), [
    "Very poor",
    "Very good",
  ]);
  assert.equal(await page.locator(".matrix-key .score-key").count(), 2);

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
    seasonCellText.every((text) => text === ""),
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
  assertExactMarkerRule(await getMarkerPlacements(page));

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
  assert.equal(
    await page.getByRole("button", { name: "Zoom out" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForFunction(
    (zoom) =>
      Number(
        document.querySelector('[data-testid="world-map"]')?.getAttribute(
          "data-zoom",
        ),
      ) > zoom + 0.1,
    initialZoom,
  );
  const zoomedIn = Number(
    await page.getByTestId("world-map").getAttribute("data-zoom"),
  );
  assert.equal(zoomedIn > initialZoom, true);
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.waitForFunction(
    (zoom) =>
      Math.abs(
        Number(
          document.querySelector('[data-testid="world-map"]')?.getAttribute(
            "data-zoom",
          ),
        ) - zoom,
      ) < 0.05,
    initialZoom,
  );
  await page.waitForFunction(
    () =>
      document.querySelector('button[aria-label="Zoom out"]')?.disabled ===
      true,
  );
  assert.equal(
    await page.getByRole("button", { name: "Zoom out" }).isDisabled(),
    true,
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
    .getByRole("button", { name: "Zicatela, May: 5 out of 5, Very good" })
    .click();
  const zicatelaDetail = page.getByTestId("spot-detail");
  assert.equal(
    await zicatelaDetail
      .getByRole("heading", { name: "Zicatela" })
      .isVisible(),
    true,
  );
  assert.equal(await zicatelaDetail.locator(".detail-month").count(), 0);
  assert.equal(await zicatelaDetail.locator(".month-score").count(), 0);
  assert.equal(await zicatelaDetail.locator(".mini-season").count(), 0);
  assert.equal(
    await zicatelaDetail.locator('[class*="rating-"]').count(),
    0,
  );
  assert.equal(await zicatelaDetail.getByText(/^[1-5]\/5$/).count(), 0);
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
    await page.locator(".is-selected-cell").getAttribute("aria-label"),
    "Zicatela, May: 5 out of 5, Very good",
  );

  await page.getByRole("button", { name: "Select Cloudbreak, Fiji" }).click();
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByRole("heading", { name: "Cloudbreak" })
      .isVisible(),
    true,
  );
  assert.equal(await page.locator(".is-selected-cell").count(), 0);
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
    .getByRole("button", { name: "Arugam Bay, Jul: 5 out of 5, Very good" })
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
