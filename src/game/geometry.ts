import { WORLD } from './config';

function segmentIntersectsBox(x0: number, y0: number, x1: number, y1: number, halfWidth: number, halfHeight: number): boolean {
  let enter = 0;
  let exit = 1;
  for (const [origin, delta, extent] of [[x0, x1 - x0, halfWidth], [y0, y1 - y0, halfHeight]]) {
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(origin) > extent) return false;
      continue;
    }
    const first = (-extent - origin) / delta;
    const last = (extent - origin) / delta;
    enter = Math.max(enter, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
    if (enter > exit) return false;
  }
  return true;
}

// Непрерывная проверка: относительный отрезок движения против прямоугольника,
// расширенного на радиус сферы. Скруглённые углы проверяются отдельно.
export function sweptOrbCollision(playerX0: number, playerX1: number, obstacleX: number, obstacleY0: number, obstacleY1: number): boolean {
  const reachX = WORLD.obstacleWidth / 2 + WORLD.playerRadius;
  const reachY = WORLD.obstacleHeight / 2 + WORLD.playerRadius;
  if (Math.max(playerX0, playerX1) < obstacleX - reachX || Math.min(playerX0, playerX1) > obstacleX + reachX) return false;
  if (Math.max(obstacleY0, obstacleY1) < WORLD.playerY - reachY || Math.min(obstacleY0, obstacleY1) > WORLD.playerY + reachY) return false;
  const x0 = playerX0 - obstacleX;
  const x1 = playerX1 - obstacleX;
  const y0 = WORLD.playerY - obstacleY0;
  const y1 = WORLD.playerY - obstacleY1;
  const halfWidth = WORLD.obstacleWidth / 2;
  const halfHeight = WORLD.obstacleHeight / 2;
  const radius = WORLD.playerRadius;
  if (segmentIntersectsBox(x0, y0, x1, y1, halfWidth + radius, halfHeight)) return true;
  if (segmentIntersectsBox(x0, y0, x1, y1, halfWidth, halfHeight + radius)) return true;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  for (const cx of [-halfWidth, halfWidth]) {
    for (const cy of [-halfHeight, halfHeight]) {
      const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / lengthSquared));
      if ((x0 + fraction * dx - cx) ** 2 + (y0 + fraction * dy - cy) ** 2 <= radius ** 2) return true;
    }
  }
  return false;
}
