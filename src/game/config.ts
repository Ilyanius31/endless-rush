export const WORLD = {
  width: 420,
  height: 760,
  lanes: [128, 292],
  playerY: 622,
  playerRadius: 16,
  obstacleWidth: 108,
  obstacleHeight: 30,
  spawnY: -40,
  switchDuration: 0.12,
  reactionMargin: 0.18,
  minSpawnGap: 0.94,
  initialSpeed: 230,
  acceleration: 3.5,
  maxSpeed: 440,
  fixedStep: 1 / 120,
  distancePerPoint: 23,
  passBonus: 25,
} as const;

export type Lane = 0 | 1;

export const SKILL = {
  windows: { GOOD: [0.30, 0.45], PERFECT: [0.20, 0.30], ULTRA_PERFECT: [0.14, 0.20] },
  rewards: { GOOD: 50, PERFECT: 100, ULTRA_PERFECT: 175 },
  charge: { GOOD: 10, PERFECT: 20, ULTRA_PERFECT: 30 },
  comboTiers: [{ combo: 0, multiplier: 1 }, { combo: 3, multiplier: 1.5 }, { combo: 6, multiplier: 2 }, { combo: 10, multiplier: 3 }],
  maxCharge: 100,
  overdriveDuration: 6,
  overdriveMultiplier: 2,
  maxMultiplier: 6,
  crystalScore: 40,
  crystalRadius: 9,
  crystalChance: 0.45,
} as const;

export const PATTERNS = {
  alternatingAfter: 12,
  rhythmAfter: 28,
  alternatingGap: 1.05,
  rhythmGap: 0.82,
  recovery: 1.6,
  maxObstacles: 12,
  standardWeight: 0.25,
  rhythmThreshold: 0.6,
  minimumSpacingSpeed: 320,
} as const;

export const EFFECTS = { maxParticles: 64, particleLife: 0.55, feedbackDuration: 1.5, blendSpeed: 3, particleScale: 1, shakeIntensity: 0.004 } as const;

export function speedAt(elapsed: number): number {
  return Math.min(WORLD.maxSpeed, WORLD.initialSpeed + elapsed * WORLD.acceleration);
}
