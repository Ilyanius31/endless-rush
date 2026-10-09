import { PATTERNS, SKILL, speedAt, WORLD } from './config';
import type { Lane } from './config';
import { sweptCircleCollection, sweptOrbCollision } from './geometry';
import { findRouteFromPosition } from './reachability';
import { createPattern, selectPattern } from './patterns';
import { RunProgression } from './progression';
import { evaluateSwitch } from './timing';
import type { TimingAttempt } from './timing';
import type { GameEvent, PatternKind } from './events';

export { WORLD } from './config';
export type { Lane } from './config';
export type RunState = 'ready' | 'running' | 'paused' | 'over';
export type MotionState = { kind: 'settled'; lane: Lane } | { kind: 'switching'; from: Lane; to: Lane };
export interface Obstacle { id: number; lane: Lane; y: number; passed: boolean; timingClaimed?: boolean; pattern?: PatternKind }
export interface Crystal { id: number; lane: Lane; y: number; collected: boolean }
const EMPTY_EVENTS: readonly GameEvent[] = [];

export class RunModel {
  state: RunState = 'ready';
  motion: MotionState = { kind: 'settled', lane: 0 };
  playerX: number = WORLD.lanes[0];
  elapsed = 0;
  distance = 0;
  passed = 0;
  collected = 0;
  practice = false;
  obstacles: Obstacle[] = [];
  crystals: Crystal[] = [];
  readonly progression = new RunProgression();
  lastPattern: PatternKind = 'standard';
  patternCount = 0;
  private nextPatternDistance = 0;
  private nextId = 0;
  private nextCrystalId = 0;
  private stepRemainder = 0;
  private pending: TimingAttempt | null = null;
  private events: GameEvent[] = [];

  constructor(private readonly random: () => number = Math.random, private readonly spawning = true) {}
  get speed(): number { return speedAt(this.elapsed); }
  get lane(): Lane { return this.motion.kind === 'settled' ? this.motion.lane : this.motion.to; }
  get score(): number { return Math.floor(this.distance / WORLD.distancePerPoint + this.progression.bonus); }
  get pendingAttempt(): Readonly<TimingAttempt> | null { return this.pending; }

  start(practice = false): void {
    this.state = 'running';
    this.motion = { kind: 'settled', lane: 0 };
    this.playerX = WORLD.lanes[0];
    this.elapsed = 0;
    this.distance = 0;
    this.passed = 0;
    this.collected = 0;
    this.practice = practice;
    this.obstacles = [];
    this.crystals = [];
    this.nextPatternDistance = 0;
    this.nextId = 0;
    this.nextCrystalId = 0;
    this.stepRemainder = 0;
    this.pending = null;
    this.events = [];
    this.progression.reset();
    this.patternCount = 0;
    this.lastPattern = 'standard';
  }

  switchLane(): void {
    if (this.state !== 'running' || this.motion.kind !== 'settled') return;
    // Новый принятый переход отменяет неподтверждённую попытку. Исходная
    // преграда остаётся помеченной, поэтому повторно наградить её нельзя.
    this.pending = evaluateSwitch(this.obstacles, this.motion.lane, this.elapsed);
    if (this.pending) {
      const obstacle = this.obstacles.find(item => item.id === this.pending!.obstacleId);
      if (obstacle) obstacle.timingClaimed = true;
    }
    this.motion = { kind: 'switching', from: this.motion.lane, to: this.motion.lane === 0 ? 1 : 0 };
    this.emit({ type: 'switch', lane: this.motion.to });
  }

  pause(): void { if (this.state === 'running') this.state = 'paused'; }
  resume(): void { if (this.state === 'paused') this.state = 'running'; }
  menu(): void {
    this.state = 'ready';
    this.pending = null;
    this.progression.resetTemporary();
    this.events = [];
    this.obstacles = [];
    this.crystals = [];
  }
  drainEvents(): readonly GameEvent[] { return this.events.length ? this.events.splice(0) : EMPTY_EVENTS; }

  update(deltaSeconds: number): void {
    if (this.state !== 'running' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    this.stepRemainder += Math.min(deltaSeconds, 0.1);
    while (this.stepRemainder + 1e-12 >= WORLD.fixedStep && this.state === 'running') {
      this.tick(WORLD.fixedStep);
      this.stepRemainder = Math.max(0, this.stepRemainder - WORLD.fixedStep);
    }
  }

  private emit(event: GameEvent): void {
    if (this.events.length === 64) this.events.shift();
    this.events.push(event);
  }

  private spawnPattern(): void {
    const kind = selectPattern(this.elapsed, this.random);
    const firstLane: Lane = this.random() < 0.5 ? 0 : 1;
    const pattern = createPattern(kind, this.elapsed, firstLane, this.random);
    if (this.obstacles.length + pattern.rows.length <= PATTERNS.maxObstacles) {
      for (const mirror of [false, true]) {
        const rows = pattern.rows.map(row => ({ lane: (mirror ? 1 - row.lane : row.lane) as Lane, y: row.y }));
        if (!findRouteFromPosition([...this.obstacles, ...rows], this.elapsed, this.playerX, this.lane)) continue;
        for (const row of rows) {
          this.obstacles.push({ id: this.nextId++, ...row, passed: false, pattern: kind });
          if (this.random() < SKILL.crystalChance) this.crystals.push({ id: this.nextCrystalId++, lane: row.lane === 0 ? 1 : 0, y: row.y, collected: false });
        }
        this.lastPattern = kind;
        this.patternCount++;
        this.nextPatternDistance = this.distance + pattern.span + this.speed * pattern.recovery;
        this.emit({ type: 'pattern', kind });
        return;
      }
    }
    this.nextPatternDistance = this.distance + this.speed * WORLD.switchDuration;
  }

  private tick(dt: number): void {
    this.elapsed += dt;
    if (this.progression.tick()) this.emit({ type: 'overdrive-end' });
    const previousX = this.playerX;
    const targetX = WORLD.lanes[this.lane];
    const movement = (WORLD.lanes[1] - WORLD.lanes[0]) / WORLD.switchDuration * dt;
    this.playerX += Math.sign(targetX - this.playerX) * Math.min(Math.abs(targetX - this.playerX), movement);
    if (this.playerX === targetX) this.motion = { kind: 'settled', lane: this.lane };
    const displacement = this.speed * dt;
    this.distance += displacement;

    let collision = false;
    for (const obstacle of this.obstacles) {
      const previousY = obstacle.y;
      obstacle.y += displacement;
      if (sweptOrbCollision(previousX, this.playerX, WORLD.lanes[obstacle.lane], previousY, obstacle.y)) collision = true;
    }
    if (collision) {
      this.state = 'over';
      this.pending = null;
      this.progression.resetTemporary();
      this.emit({ type: 'collision' });
      return;
    }

    for (const obstacle of this.obstacles) {
      if (!obstacle.passed && obstacle.y > WORLD.playerY + WORLD.playerRadius + WORLD.obstacleHeight / 2) {
        obstacle.passed = true;
        this.passed++;
        this.progression.addScore(WORLD.passBonus);
      }
    }
    if (this.pending) {
      const obstacle = this.obstacles.find(item => item.id === this.pending!.obstacleId);
      if (!obstacle) this.pending = null;
      else if (obstacle.passed && this.motion.kind === 'settled' && this.lane === this.pending.destination) {
        const attempt = this.pending;
        this.pending = null;
        const reward = this.progression.confirm(attempt.rating);
        this.emit({ type: 'perfect-switch', obstacleId: attempt.obstacleId, rating: attempt.rating, points: reward.points, combo: this.progression.combo, multiplier: reward.multiplier });
        if (reward.milestone) this.emit({ type: 'combo', combo: this.progression.combo });
        if (reward.activated) this.emit({ type: 'overdrive-start' });
      }
    }
    for (const crystal of this.crystals) {
      const previousY = crystal.y;
      crystal.y += displacement;
      if (!crystal.collected && sweptCircleCollection(previousX, this.playerX, WORLD.lanes[crystal.lane], previousY, crystal.y, SKILL.crystalRadius)) {
        crystal.collected = true;
        this.collected++;
        const points = this.progression.addScore(SKILL.crystalScore);
        this.emit({ type: 'crystal', id: crystal.id, x: WORLD.lanes[crystal.lane], y: crystal.y, points });
      }
    }
    this.obstacles = this.obstacles.filter(obstacle => obstacle.y < WORLD.height + 60);
    this.crystals = this.crystals.filter(crystal => !crystal.collected && crystal.y < WORLD.height + 60);
    // Проверяем появление после перемещения всех объектов, в едином состоянии шага.
    if (this.spawning && !this.practice && this.elapsed >= 0.7 && this.distance >= this.nextPatternDistance) this.spawnPattern();
  }
}
