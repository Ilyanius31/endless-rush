import { PATTERNS, speedAt, WORLD } from './config';
import type { Lane } from './config';
import type { PatternKind } from './events';

export function selectPattern(elapsed: number, random: () => number): PatternKind {
  if (elapsed < PATTERNS.alternatingAfter) return 'standard';
  const choice = random();
  if (elapsed >= PATTERNS.rhythmAfter && choice > PATTERNS.rhythmThreshold) return 'rhythm';
  return choice > PATTERNS.standardWeight ? 'alternating' : 'standard';
}

export function createPattern(kind: PatternKind, elapsed: number, firstLane: Lane, random: () => number) {
  const count = kind === 'standard' ? 1 : kind === 'alternating' ? 3 : 3 + Math.floor(random() * 3);
  const gap = Math.max(PATTERNS.minimumSpacingSpeed, speedAt(elapsed)) * (kind === 'rhythm' ? PATTERNS.rhythmGap : PATTERNS.alternatingGap);
  const rows = Array.from({ length: count }, (_, index) => ({ lane: (index % 2 ? 1 - firstLane : firstLane) as Lane, y: WORLD.spawnY - index * gap }));
  const recovery = kind === 'standard' ? Math.max(WORLD.minSpawnGap, 1.42 - elapsed * 0.006) + random() * 0.2 : PATTERNS.recovery;
  return { kind, rows, span: (count - 1) * gap, recovery };
}
