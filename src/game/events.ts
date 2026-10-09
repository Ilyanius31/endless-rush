import type { Lane } from './config';

export type SwitchRating = 'GOOD' | 'PERFECT' | 'ULTRA_PERFECT';
export type PatternKind = 'standard' | 'alternating' | 'rhythm';
export interface PerfectSwitchEvent {
  type: 'perfect-switch';
  obstacleId: number;
  rating: SwitchRating;
  points: number;
  combo: number;
  multiplier: number;
}
export type GameEvent = PerfectSwitchEvent
  | { type: 'switch'; lane: Lane }
  | { type: 'combo'; combo: number }
  | { type: 'overdrive-start' | 'overdrive-end' | 'collision' }
  | { type: 'crystal'; id: number; x: number; y: number; points: number }
  | { type: 'pattern'; kind: PatternKind };
