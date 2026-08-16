/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");

const baseUrl = process.env.SURF_ATLAS_URL || "http://localhost:3001/";
const outputDirectory = "test-results";

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
  assert.equal(await page.locator(".map-marker").count(), 50);
  assert.equal(await page.locator(".season-cell").count(), 600);
  assert.equal((await page.locator(".map-country").count()) > 100, true);
  assert.equal(await page.getByText("When every break comes alive").count(), 0);
  assert.equal(await page.getByText("50 breaks, one orbit").count(), 0);
  assert.equal(await page.getByText("How to read the atlas").count(), 0);
  assert.equal(
    await page.getByRole("heading", { name: "Banzai Pipeline" }).isVisible(),
    true,
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
  const miniSeasonText = await page
    .locator(".mini-season button")
    .evaluateAll((cells) => cells.map((cell) => cell.innerText.trim()));
  assert.equal(
    miniSeasonText.every((text) => !/[1-5]/.test(text)),
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
  const beginnerMarkerCount = await page.locator(".map-marker").count();
  assert.equal(beginnerMarkerCount > 0 && beginnerMarkerCount < 50, true);
  assert.equal(
    await page.locator(".season-cell").count(),
    beginnerMarkerCount * 12,
  );
  assert.deepEqual(
    await levelFilters.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ),
    ["true", "false", "false"],
  );

  await page.getByRole("button", { name: "Show all skill levels" }).click();
  assert.equal(await page.locator(".map-marker").count(), 50);
  assert.equal(await page.locator(".season-cell").count(), 600);
  assert.deepEqual(
    await levelFilters.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ),
    ["true", "true", "true"],
  );

  await page.getByRole("button", { name: "Zoom in map" }).click();
  assert.equal(
    await page.getByTestId("world-map").getAttribute("data-zoom"),
    "1.5",
  );
  await page.getByRole("button", { name: "Reset map zoom" }).click();
  assert.equal(
    await page.getByTestId("world-map").getAttribute("data-zoom"),
    "1",
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
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByRole("heading", { name: "Zicatela" })
      .isVisible(),
    true,
  );
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByText("May", { exact: true })
      .first()
      .isVisible(),
    true,
  );

  await page.getByRole("button", { name: "Select Cloudbreak, Fiji" }).click();
  assert.equal(
    await page
      .getByTestId("spot-detail")
      .getByRole("heading", { name: "Cloudbreak" })
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
