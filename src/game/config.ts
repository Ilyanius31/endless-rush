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

export function speedAt(elapsed: number): number {
  return Math.min(WORLD.maxSpeed, WORLD.initialSpeed + elapsed * WORLD.acceleration);
}
