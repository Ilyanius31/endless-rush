import { speedAt, WORLD } from './config';
import type { Lane } from './config';

interface Barrier { lane: Lane; y: number }
interface Window { lane: Lane; start: number; end: number }
export interface SafeRoute {
  initialLane: Lane;
  switches: { time: number; lane: Lane }[];
}

// Время прохождения расстояния с тем же ускорением и ограничением скорости,
// что у модели. Буфер в окнах ниже покрывает округление фиксированного шага.
export function travelTime(distance: number, elapsed: number): number {
  if (distance <= 0) return 0;
  const speed = speedAt(elapsed);
  const timeToCap = (WORLD.maxSpeed - speed) / WORLD.acceleration;
  const distanceToCap = speed * timeToCap + WORLD.acceleration * timeToCap ** 2 / 2;
  if (distance >= distanceToCap) return timeToCap + (distance - distanceToCap) / WORLD.maxSpeed;
  return (Math.sqrt(speed ** 2 + 2 * WORLD.acceleration * distance) - speed) / WORLD.acceleration;
}

export function findSafeRoute(barriers: readonly Barrier[], elapsed: number, initialLane?: Lane): SafeRoute | null {
  const windows: Window[] = [];
  for (const obstacle of barriers) {
    for (const lane of [0, 1] as const) {
      const horizontalDistance = Math.max(0, Math.abs(WORLD.lanes[lane] - WORLD.lanes[obstacle.lane]) - WORLD.obstacleWidth / 2);
      if (horizontalDistance > WORLD.playerRadius) continue;
      const extent = WORLD.obstacleHeight / 2 + Math.sqrt(WORLD.playerRadius ** 2 - horizontalDistance ** 2);
      const buffer = WORLD.maxSpeed * WORLD.fixedStep;
      const exitDistance = WORLD.playerY - obstacle.y + extent + buffer;
      if (exitDistance <= 0) continue;
      windows.push({
        lane,
        start: travelTime(WORLD.playerY - obstacle.y - extent - buffer, elapsed),
        end: travelTime(exitDistance, elapsed) + WORLD.fixedStep,
      });
    }
  }
  let routes: (SafeRoute | null)[] = [
    initialLane === 1 ? null : { initialLane: 0, switches: [] },
    initialLane === 0 ? null : { initialLane: 1, switches: [] },
  ];
  const boundaries = [...new Set([0, ...windows.flatMap(window => [window.start, window.end])])].sort((a, b) => a - b);
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const midpoint = (start + end) / 2;
    const blocked = [false, false];
    for (const window of windows) if (window.start <= midpoint && window.end >= midpoint) blocked[window.lane] = true;
    routes = routes.map((route, lane) => blocked[lane] ? null : route);
    if (!routes[0] && !routes[1]) return null;
    // Смена разрешается только в полностью свободном временном промежутке.
    // Это консервативное доказательство безопасного маршрута: во время перехода
    // свободны обе полосы, а перед действием остаётся запас на реакцию.
    if (!blocked[0] && !blocked[1] && end - start >= WORLD.switchDuration + WORLD.reactionMargin) {
      for (const lane of [0, 1] as const) {
        const source = routes[lane === 0 ? 1 : 0];
        if (!routes[lane] && source) routes[lane] = {
          initialLane: source.initialLane,
          switches: [...source.switches, { time: start + WORLD.reactionMargin, lane }],
        };
      }
    }
  }
  return routes.find(route => route !== null) ?? null;
}

export function chooseReachableLane(barriers: readonly Barrier[], elapsed: number, preferredLane: Lane): Lane | null {
  for (const lane of [preferredLane, preferredLane === 0 ? 1 : 0] as const) {
    if (findSafeRoute([...barriers, { lane, y: WORLD.spawnY }], elapsed)) return lane;
  }
  return null;
}
