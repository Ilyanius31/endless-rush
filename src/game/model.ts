import { speedAt, WORLD } from './config';
import type { Lane } from './config';
import { sweptOrbCollision } from './geometry';
import { chooseReachableLane } from './reachability';

export { WORLD } from './config';
export type { Lane } from './config';
export type RunState = 'ready' | 'running' | 'paused' | 'over';
export type MotionState = { kind: 'settled'; lane: Lane } | { kind: 'switching'; from: Lane; to: Lane };

export interface Obstacle {
  id: number;
  lane: Lane;
  y: number;
  passed: boolean;
}

export class RunModel {
  state: RunState = 'ready';
  motion: MotionState = { kind: 'settled', lane: 0 };
  playerX: number = WORLD.lanes[0];
  elapsed = 0;
  distance = 0;
  passed = 0;
  obstacles: Obstacle[] = [];
  private spawnCountdown = 0.7;
  private nextId = 0;
  private stepRemainder = 0;

  constructor(private readonly random: () => number = Math.random) {}

  get speed(): number {
    return speedAt(this.elapsed);
  }

  get lane(): Lane {
    return this.motion.kind === 'settled' ? this.motion.lane : this.motion.to;
  }

  get score(): number {
    return Math.floor(this.distance / WORLD.distancePerPoint) + this.passed * WORLD.passBonus;
  }

  start(): void {
    this.state = 'running';
    this.motion = { kind: 'settled', lane: 0 };
    this.playerX = WORLD.lanes[0];
    this.elapsed = 0;
    this.distance = 0;
    this.passed = 0;
    this.obstacles = [];
    this.spawnCountdown = 0.7;
    this.nextId = 0;
    this.stepRemainder = 0;
  }

  switchLane(): void {
    if (this.state !== 'running' || this.motion.kind !== 'settled') return;
    this.motion = { kind: 'switching', from: this.motion.lane, to: this.motion.lane === 0 ? 1 : 0 };
  }

  pause(): void {
    if (this.state === 'running') this.state = 'paused';
  }

  resume(): void {
    if (this.state === 'paused') this.state = 'running';
  }

  update(deltaSeconds: number): void {
    if (this.state !== 'running' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    // Ограничение задержки и фиксированный шаг исключают пролёт сквозь препятствие.
    this.stepRemainder += Math.min(deltaSeconds, 0.1);
    const step = WORLD.fixedStep;
    while (this.stepRemainder >= step && this.state === 'running') {
      this.tick(step);
      this.stepRemainder -= step;
    }
  }

  private tick(dt: number): void {
    this.elapsed += dt;
    const previousX = this.playerX;
    const targetX = WORLD.lanes[this.lane];
    const movement = (WORLD.lanes[1] - WORLD.lanes[0]) / WORLD.switchDuration * dt;
    this.playerX += Math.sign(targetX - this.playerX) * Math.min(Math.abs(targetX - this.playerX), movement);
    if (this.playerX === targetX) this.motion = { kind: 'settled', lane: this.lane };
    this.distance += this.speed * dt;

    this.spawnCountdown -= dt;
    if (this.spawnCountdown <= 0) {
      const lane = chooseReachableLane(this.obstacles, this.elapsed, this.random() < 0.5 ? 0 : 1);
      if (lane !== null) {
        this.obstacles.push({ id: this.nextId++, lane, y: WORLD.spawnY, passed: false });
        this.spawnCountdown += Math.max(WORLD.minSpawnGap, 1.42 - this.elapsed * 0.006) + this.random() * 0.2;
      } else {
        // Если ни одна полоса не даёт безопасного маршрута, откладываем ряд.
        this.spawnCountdown += WORLD.switchDuration;
      }
    }

    for (const obstacle of this.obstacles) {
      const previousY = obstacle.y;
      obstacle.y += this.speed * dt;
      if (sweptOrbCollision(previousX, this.playerX, WORLD.lanes[obstacle.lane], previousY, obstacle.y)) {
        this.state = 'over';
        return;
      }
      if (!obstacle.passed && obstacle.y > WORLD.playerY + WORLD.playerRadius + WORLD.obstacleHeight / 2) {
        obstacle.passed = true;
        this.passed += 1;
      }
    }
    this.obstacles = this.obstacles.filter(obstacle => obstacle.y < WORLD.height + 60);
  }
}
