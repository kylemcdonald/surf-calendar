import { MONTHS, type Month, type Rating, type SurfSpot } from "./surf-data";

export type Board = "shortboard" | "longboard";

export type WaveShape =
  | "rolling"
  | "open-face"
  | "performance"
  | "hollow"
  | "heavy";

export type WindAlignment =
  | "Mostly offshore / light"
  | "Often cross-offshore"
  | "Variable"
  | "Often cross-onshore"
  | "Mostly onshore";

type WindPatternId =
  | "north-pacific-winter"
  | "california-fall"
  | "temperate-fall"
  | "tropical-dry-north"
  | "tropical-south-swell"
  | "offshore-trades"
  | "south-pacific-winter"
  | "north-atlantic-winter"
  | "europe-autumn"
  | "indonesia-dry"
  | "philippines-autumn"
  | "sri-lanka-east"
  | "sri-lanka-west"
  | "maldives"
  | "australia-autumn"
  | "south-atlantic-autumn"
  | "tropical-stable";

interface WindMonth {
  cleanPercent: number;
  speedKts: number;
}

interface SpotModel {
  minFaceFt: number;
  maxFaceFt: number;
  peakPeriodS: number;
  shape: WaveShape;
  crowdBase: number;
  tideFlex: number;
  peakConsistency: number;
  windPattern: WindPatternId;
  windCleanShift: number;
}

export interface ScoreContribution {
  key: "wave" | "wind" | "consistency" | "tide" | "crowd";
  label: string;
  weight: number;
  rawScore: number;
  points: number;
}

export interface SurfMonthProfile {
  board: Board;
  month: Month;
  monthIndex: number;
  score: number;
  band: Rating;
  waveFaceFt: number;
  swellPeriodS: number;
  shape: WaveShape;
  windSpeedKts: number;
  windAlignment: WindAlignment;
  cleanWindPercent: number;
  consistencyPercent: number;
  crowdLevel: Rating;
  tideFlex: Rating;
  contributions: ScoreContribution[];
}

export const BOARD_LABELS: Record<Board, string> = {
  shortboard: "Shortboard",
  longboard: "Longboard",
};

export const SHAPE_LABELS: Record<WaveShape, string> = {
  rolling: "Slow / rolling",
  "open-face": "Open face",
  performance: "Fast / performance",
  hollow: "Steep / hollow",
  heavy: "Heavy / specialist",
};

export const CROWD_LABELS: Record<Rating, string> = {
  1: "Quiet",
  2: "Light",
  3: "Moderate",
  4: "Busy",
  5: "Packed",
};

export const TIDE_LABELS: Record<Rating, string> = {
  1: "Very narrow window",
  2: "Narrow window",
  3: "Somewhat tide-sensitive",
  4: "Broad window",
  5: "Works through most tides",
};

export const RUBRIC = [
  { key: "wave", label: "Board + wave fit", weight: 40 },
  { key: "wind", label: "Clean wind", weight: 20 },
  { key: "consistency", label: "Consistency", weight: 20 },
  { key: "tide", label: "Tide flexibility", weight: 10 },
  { key: "crowd", label: "Crowd pressure", weight: 10 },
] as const;

const windPatterns: Record<WindPatternId, readonly WindMonth[]> = {
  "north-pacific-winter": wind(
    [66, 66, 63, 58, 53, 50, 48, 49, 53, 58, 63, 66],
    [10, 10, 11, 12, 13, 14, 14, 14, 13, 12, 11, 10],
  ),
  "california-fall": wind(
    [62, 64, 66, 67, 68, 70, 71, 74, 79, 78, 69, 63],
    [7, 7, 8, 9, 10, 10, 10, 9, 7, 7, 7, 7],
  ),
  "temperate-fall": wind(
    [47, 49, 54, 59, 61, 59, 56, 58, 68, 72, 61, 50],
    [13, 13, 12, 11, 10, 9, 9, 9, 9, 10, 12, 13],
  ),
  "tropical-dry-north": wind(
    [78, 78, 75, 70, 63, 57, 54, 55, 59, 66, 73, 77],
    [8, 8, 8, 8, 7, 7, 7, 7, 7, 7, 8, 8],
  ),
  "tropical-south-swell": wind(
    [62, 63, 66, 71, 75, 76, 76, 75, 72, 68, 64, 62],
    [7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 7, 7],
  ),
  "offshore-trades": wind(
    [83, 83, 82, 80, 77, 74, 72, 72, 74, 77, 80, 82],
    [10, 10, 10, 9, 9, 9, 9, 9, 9, 9, 10, 10],
  ),
  "south-pacific-winter": wind(
    [57, 58, 62, 67, 72, 75, 76, 75, 72, 68, 62, 58],
    [9, 9, 9, 10, 11, 12, 12, 12, 11, 10, 9, 9],
  ),
  "north-atlantic-winter": wind(
    [64, 64, 62, 58, 52, 47, 44, 46, 61, 70, 70, 67],
    [11, 11, 11, 10, 10, 11, 12, 12, 10, 9, 10, 11],
  ),
  "europe-autumn": wind(
    [52, 54, 59, 63, 64, 61, 56, 59, 73, 77, 69, 56],
    [12, 12, 11, 10, 9, 9, 10, 10, 8, 9, 10, 12],
  ),
  "indonesia-dry": wind(
    [45, 46, 54, 65, 74, 78, 79, 79, 77, 70, 57, 48],
    [6, 6, 6, 7, 9, 10, 11, 11, 10, 8, 7, 6],
  ),
  "philippines-autumn": wind(
    [46, 47, 48, 50, 53, 58, 62, 67, 74, 78, 75, 58],
    [12, 11, 10, 9, 8, 8, 8, 8, 9, 10, 11, 12],
  ),
  "sri-lanka-east": wind(
    [42, 43, 49, 62, 72, 76, 78, 77, 73, 63, 49, 43],
    [11, 10, 9, 8, 8, 9, 10, 10, 9, 8, 9, 10],
  ),
  "sri-lanka-west": wind(
    [76, 76, 73, 65, 51, 43, 41, 42, 44, 52, 66, 75],
    [7, 7, 7, 8, 10, 11, 12, 12, 11, 10, 8, 7],
  ),
  maldives: wind(
    [62, 64, 68, 70, 63, 69, 73, 74, 75, 72, 62, 60],
    [9, 9, 8, 8, 10, 11, 12, 12, 11, 10, 9, 9],
  ),
  "australia-autumn": wind(
    [59, 65, 70, 73, 73, 70, 66, 64, 66, 64, 60, 58],
    [10, 9, 9, 9, 10, 11, 12, 12, 11, 10, 10, 10],
  ),
  "south-atlantic-autumn": wind(
    [60, 63, 70, 73, 70, 65, 61, 62, 70, 72, 65, 60],
    [10, 9, 9, 9, 10, 11, 11, 11, 10, 9, 10, 10],
  ),
  "tropical-stable": wind(
    [66, 67, 68, 69, 68, 66, 65, 66, 68, 69, 68, 67],
    [9, 9, 9, 9, 10, 10, 10, 10, 10, 9, 9, 9],
  ),
};

const spotModels: Record<string, SpotModel> = {
  pipeline: model(2, 10, 16, "hollow", 4.5, 2, 82, "north-pacific-winter"),
  "sunset-beach": model(2, 12, 16, "heavy", 4, 2, 82, "north-pacific-winter", -2),
  waikiki: model(0.8, 4, 13, "rolling", 5, 5, 82, "tropical-stable", 4),
  "honolua-bay": model(1, 8, 15, "performance", 4, 2, 67, "north-pacific-winter", 8),
  jaws: model(2, 25, 18, "heavy", 2, 2, 24, "north-pacific-winter", -5),
  "lower-trestles": model(1.2, 5, 14, "performance", 5, 4, 86, "california-fall"),
  malibu: model(0.8, 4, 14, "rolling", 5, 4, 78, "california-fall", 5),
  mavericks: model(2, 22, 18, "heavy", 2, 2, 28, "temperate-fall", -8),
  "cox-bay": model(1.5, 8, 15, "open-face", 3, 4, 88, "temperate-fall"),
  sayulita: model(0.8, 4, 12, "rolling", 4, 4, 76, "tropical-dry-north", 2),
  zicatela: model(2, 10, 16, "hollow", 4, 3, 88, "tropical-south-swell"),
  "scorpion-bay": model(0.8, 5, 15, "rolling", 2, 3, 58, "california-fall", -4),
  "witchs-rock": model(1.5, 6, 14, "open-face", 2, 4, 80, "tropical-dry-north", 4),
  pavones: model(1, 6, 15, "open-face", 4, 3, 76, "tropical-south-swell", 3),
  popoyo: model(1.5, 7, 15, "performance", 3, 3, 88, "offshore-trades"),
  "punta-roca": model(1.2, 7, 15, "performance", 4, 2, 82, "tropical-south-swell"),
  montanita: model(1, 5, 13, "open-face", 4, 4, 84, "tropical-south-swell"),
  chicama: model(0.8, 5, 16, "rolling", 3, 4, 70, "south-pacific-winter", 4),
  "punta-de-lobos": model(2, 9, 16, "heavy", 3, 3, 83, "south-pacific-winter"),
  joaquina: model(1.2, 6, 13, "open-face", 3, 4, 85, "south-atlantic-autumn"),
  "soup-bowl": model(1.5, 7, 14, "hollow", 4, 2, 77, "tropical-dry-north"),
  hossegor: model(1.2, 8, 15, "hollow", 5, 3, 84, "europe-autumn"),
  "cote-des-basques": model(0.8, 5, 14, "rolling", 5, 4, 80, "europe-autumn", 4),
  mundaka: model(1, 7, 16, "hollow", 4, 1, 48, "europe-autumn", 4),
  "ribeira-dilhas": model(1.2, 6, 15, "performance", 4, 3, 82, "europe-autumn"),
  supertubos: model(1.2, 8, 15, "hollow", 4, 3, 80, "europe-autumn"),
  arrifana: model(0.8, 5, 14, "open-face", 3, 4, 80, "europe-autumn", 5),
  nazare: model(3, 30, 18, "heavy", 3, 3, 32, "north-atlantic-winter", -4),
  fistral: model(1.2, 6, 14, "open-face", 4, 4, 84, "temperate-fall"),
  bundoran: model(1.5, 9, 16, "heavy", 3, 3, 80, "north-atlantic-winter"),
  "anchor-point": model(1.2, 7, 16, "performance", 4, 3, 78, "north-atlantic-winter", 4),
  imsouane: model(0.8, 4, 15, "rolling", 4, 4, 68, "north-atlantic-winter", 7),
  "ngor-right": model(1, 6, 14, "hollow", 3, 2, 68, "tropical-dry-north"),
  "jeffreys-bay": model(1.2, 7, 16, "performance", 5, 3, 82, "south-pacific-winter"),
  "skeleton-bay": model(0.8, 7, 17, "hollow", 2, 2, 38, "south-pacific-winter", 2),
  uluwatu: model(1.5, 8, 16, "hollow", 5, 3, 88, "indonesia-dry"),
  canggu: model(1.2, 6, 14, "performance", 5, 4, 86, "indonesia-dry"),
  "g-land": model(1.2, 9, 17, "hollow", 3, 2, 76, "indonesia-dry"),
  macaronis: model(1.2, 7, 16, "performance", 3, 3, 82, "indonesia-dry"),
  nias: model(1.5, 8, 16, "hollow", 4, 3, 78, "indonesia-dry"),
  "cloud-9": model(1.2, 7, 14, "hollow", 4, 2, 68, "philippines-autumn"),
  "arugam-bay": model(0.8, 5, 14, "rolling", 5, 4, 78, "sri-lanka-east"),
  hikkaduwa: model(0.8, 5, 13, "open-face", 4, 3, 76, "sri-lanka-west"),
  "pasta-point": model(1.2, 6, 14, "performance", 3, 3, 74, "maldives", 2),
  "snapper-rocks": model(1.2, 7, 15, "performance", 5, 3, 88, "australia-autumn"),
  "bells-beach": model(1.5, 8, 16, "open-face", 4, 3, 86, "australia-autumn"),
  "margaret-river": model(2, 10, 17, "heavy", 3, 3, 92, "australia-autumn"),
  raglan: model(1.2, 7, 16, "open-face", 4, 3, 88, "australia-autumn", 2),
  teahupoo: model(1.5, 10, 17, "hollow", 4, 1, 76, "south-pacific-winter"),
  cloudbreak: model(2, 12, 17, "hollow", 4, 2, 84, "south-pacific-winter", -2),
};

const sizeCurves: Record<Board, readonly [number, number][]> = {
  shortboard: [
    [0, 0],
    [0.8, 12],
    [1.5, 38],
    [2, 62],
    [3, 90],
    [4, 100],
    [7, 100],
    [9, 90],
    [12, 64],
    [16, 34],
    [24, 8],
    [32, 0],
  ],
  longboard: [
    [0, 0],
    [0.5, 28],
    [1, 68],
    [1.5, 94],
    [2, 100],
    [3.5, 100],
    [5, 78],
    [6.5, 48],
    [8, 20],
    [10, 5],
    [14, 0],
  ],
};

const periodCurves: Record<Board, readonly [number, number][]> = {
  shortboard: [
    [5, 20],
    [7, 42],
    [9, 68],
    [11, 88],
    [13, 100],
    [17, 100],
    [20, 88],
  ],
  longboard: [
    [5, 45],
    [7, 70],
    [9, 94],
    [11, 100],
    [13, 96],
    [16, 80],
    [20, 60],
  ],
};

const shapeFit: Record<Board, Record<WaveShape, number>> = {
  shortboard: {
    rolling: 45,
    "open-face": 80,
    performance: 100,
    hollow: 94,
    heavy: 63,
  },
  longboard: {
    rolling: 100,
    "open-face": 86,
    performance: 64,
    hollow: 26,
    heavy: 12,
  },
};

export function getSurfProfile(
  spot: SurfSpot,
  monthIndex: number,
  board: Board,
): SurfMonthProfile {
  const spotModel = spotModels[spot.id];

  if (!spotModel) {
    throw new Error(`Missing surf model for ${spot.id}`);
  }

  const month = MONTHS[monthIndex];
  const seasonalIndex = spot.seasonality[monthIndex];
  const season = Math.pow((seasonalIndex - 1) / 4, 0.9);
  const windMonth = windPatterns[spotModel.windPattern][monthIndex];
  const waveFaceFt = roundTo(
    spotModel.minFaceFt +
      (spotModel.maxFaceFt - spotModel.minFaceFt) * season,
    1,
  );
  const swellPeriodS = roundTo(7 + (spotModel.peakPeriodS - 7) * season, 1);
  const consistencyFloor = Math.max(8, spotModel.peakConsistency - 62);
  const consistencyPercent = Math.round(
    consistencyFloor +
      (spotModel.peakConsistency - consistencyFloor) * season,
  );
  const cleanWindPercent = Math.round(
    clamp(windMonth.cleanPercent + spotModel.windCleanShift, 20, 92),
  );
  const crowdLevel = toRating(
    Math.round(spotModel.crowdBase + season * 0.75),
  );
  const tideFlex = toRating(spotModel.tideFlex);

  const sizeScore = interpolate(sizeCurves[board], waveFaceFt);
  const periodScore = interpolate(periodCurves[board], swellPeriodS);
  const waveScore =
    sizeScore * 0.45 +
    periodScore * 0.2 +
    shapeFit[board][spotModel.shape] * 0.35;
  const crowdScore = 120 - crowdLevel * 20;
  const tideScore = tideFlex * 20;

  const inputs = [
    { key: "wave", label: "Board + wave fit", weight: 40, rawScore: waveScore },
    {
      key: "wind",
      label: "Clean wind",
      weight: 20,
      rawScore: cleanWindPercent,
    },
    {
      key: "consistency",
      label: "Consistency",
      weight: 20,
      rawScore: consistencyPercent,
    },
    {
      key: "tide",
      label: "Tide flexibility",
      weight: 10,
      rawScore: tideScore,
    },
    {
      key: "crowd",
      label: "Crowd pressure",
      weight: 10,
      rawScore: crowdScore,
    },
  ] satisfies Omit<ScoreContribution, "points">[];

  const contributions: ScoreContribution[] = inputs.map((input) => ({
    ...input,
    key: input.key,
    rawScore: roundTo(input.rawScore, 0),
    points: roundTo((input.rawScore * input.weight) / 100, 1),
  }));
  const total = contributions.reduce(
    (sum, contribution) => sum + contribution.points,
    0,
  );
  const score = roundTo(1 + (total / 100) * 4, 1);

  return {
    board,
    month,
    monthIndex,
    score,
    band: toRating(Math.round(score)),
    waveFaceFt,
    swellPeriodS,
    shape: spotModel.shape,
    windSpeedKts: Math.max(1, windMonth.speedKts),
    windAlignment: getWindAlignment(cleanWindPercent),
    cleanWindPercent,
    consistencyPercent,
    crowdLevel,
    tideFlex,
    contributions,
  };
}

export function getMonthlyProfiles(spot: SurfSpot, board: Board) {
  return MONTHS.map((_, monthIndex) =>
    getSurfProfile(spot, monthIndex, board),
  );
}

export function getBestMonths(spot: SurfSpot, board: Board) {
  const profiles = getMonthlyProfiles(spot, board);
  const maximum = Math.max(...profiles.map((profile) => profile.score));
  const threshold = Math.max(4, maximum - 0.2);
  const best = profiles
    .filter((profile) => profile.score >= threshold)
    .map((profile) => profile.month);

  return best.length > 0
    ? best
    : profiles
        .filter((profile) => profile.score === maximum)
        .map((profile) => profile.month);
}

export function getScoreLabel(score: number) {
  if (score >= 4.5) return "Excellent";
  if (score >= 3.7) return "Very good";
  if (score >= 2.9) return "Worth a look";
  if (score >= 2.1) return "Compromised";
  return "Poor fit";
}

function wind(clean: number[], speed: number[]) {
  return MONTHS.map((_, monthIndex) => ({
    cleanPercent: clean[monthIndex],
    speedKts: speed[monthIndex],
  }));
}

function model(
  minFaceFt: number,
  maxFaceFt: number,
  peakPeriodS: number,
  shape: WaveShape,
  crowdBase: number,
  tideFlex: number,
  peakConsistency: number,
  windPattern: WindPatternId,
  windCleanShift = 0,
): SpotModel {
  return {
    minFaceFt,
    maxFaceFt,
    peakPeriodS,
    shape,
    crowdBase,
    tideFlex,
    peakConsistency,
    windPattern,
    windCleanShift,
  };
}

function getWindAlignment(cleanPercent: number): WindAlignment {
  if (cleanPercent >= 75) return "Mostly offshore / light";
  if (cleanPercent >= 63) return "Often cross-offshore";
  if (cleanPercent >= 51) return "Variable";
  if (cleanPercent >= 39) return "Often cross-onshore";
  return "Mostly onshore";
}

function interpolate(points: readonly [number, number][], value: number) {
  if (value <= points[0][0]) return points[0][1];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];

    if (value <= next[0]) {
      const progress = (value - previous[0]) / (next[0] - previous[0]);
      return previous[1] + (next[1] - previous[1]) * progress;
    }
  }

  return points.at(-1)?.[1] ?? 0;
}

function toRating(value: number): Rating {
  return clamp(Math.round(value), 1, 5) as Rating;
}

function roundTo(value: number, decimalPlaces: number) {
  const multiplier = 10 ** decimalPlaces;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
