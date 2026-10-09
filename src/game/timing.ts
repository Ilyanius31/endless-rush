import { SKILL, speedAt, WORLD } from './config';
import type { Lane } from './config';
import type { SwitchRating } from './events';
import { sweptOrbCollision } from './geometry';
import { travelTime } from './reachability';

export interface TimingObstacle { id: number; lane: Lane; y: number; passed: boolean; timingClaimed?: boolean }
export interface TimingAttempt { obstacleId: number; rating: SwitchRating; destination: Lane }

export function timeToDanger(y: number, elapsed: number): number {
  const distance = WORLD.playerY - y - WORLD.playerRadius - WORLD.obstacleHeight / 2;
  // Консервативная поправка на интегрирование скорости в конце шага.
  return Math.max(0, travelTime(distance, elapsed) - WORLD.fixedStep);
}

export function rateTiming(seconds: number): SwitchRating | null {
  if (seconds < WORLD.switchDuration + 2 * WORLD.fixedStep) return null;
  for (const rating of ['ULTRA_PERFECT', 'PERFECT', 'GOOD'] as const) {
    const [min, max] = SKILL.windows[rating];
    if (seconds + 1e-9 >= min && (seconds < max - 1e-9 || (rating === 'GOOD' && seconds <= max + 1e-9))) return rating;
  }
  return null;
}

export function safeTransition(obstacles: readonly TimingObstacle[], departure: Lane, destination: Lane, elapsed: number, horizon: number): boolean {
  let x: number = WORLD.lanes[departure];
  let distance = 0;
  const movement = (WORLD.lanes[1] - WORLD.lanes[0]) * WORLD.fixedStep / WORLD.switchDuration;
  for (let tick = 1; tick <= Math.ceil(horizon / WORLD.fixedStep) + 1; tick++) {
    const previousX = x;
    const previousDistance = distance;
    x += Math.sign(WORLD.lanes[destination] - x) * Math.min(Math.abs(WORLD.lanes[destination] - x), movement);
    distance += speedAt(elapsed + tick * WORLD.fixedStep) * WORLD.fixedStep;
    for (const obstacle of obstacles) {
      if (sweptOrbCollision(previousX, x, WORLD.lanes[obstacle.lane], obstacle.y + previousDistance, obstacle.y + distance)) return false;
    }
  }
  return true;
}

export function evaluateSwitch(obstacles: readonly TimingObstacle[], departure: Lane, elapsed: number): TimingAttempt | null {
  const destination = departure === 0 ? 1 : 0;
  const threat = obstacles.filter(obstacle => obstacle.lane === departure && !obstacle.passed && obstacle.y < WORLD.playerY)
    .sort((a, b) => b.y - a.y)[0];
  if (!threat || threat.timingClaimed) return null;
  const rating = rateTiming(timeToDanger(threat.y, elapsed));
  if (!rating) return null;
  const horizon = travelTime(WORLD.playerY + WORLD.playerRadius + WORLD.obstacleHeight / 2 - threat.y, elapsed) + WORLD.fixedStep;
  if (!safeTransition(obstacles, departure, destination, elapsed, Math.max(horizon, WORLD.switchDuration))) return null;
  return { obstacleId: threat.id, rating, destination };
}
