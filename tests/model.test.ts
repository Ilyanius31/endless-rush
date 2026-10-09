import { describe, expect, it } from 'vitest';
import { RunModel, WORLD } from '../src/game/model';
import { PATTERNS } from '../src/game/config';
import { seededRandom } from '../src/game/random';

function advance(run: RunModel, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 120); i++) run.update(1 / 120);
}

describe('RunModel', () => {
  it('не двигается до старта и полностью сбрасывается при перезапуске', () => {
    const run = new RunModel(() => 0);
    advance(run, 1);
    expect(run.score).toBe(0);
    run.switchLane();
    expect(run.lane).toBe(0);
    run.start();
    run.switchLane();
    advance(run, 1);
    expect(run.score).toBeGreaterThan(0);
    expect(run.obstacles).toHaveLength(1);
    run.start();
    expect(run.state).toBe('running');
    expect(run.score).toBe(0);
    expect(run.obstacles).toEqual([]);
    expect(run.playerX).toBe(WORLD.lanes[0]);
    expect(run.speed).toBe(230);
  });

  it('меняет полосу за заданное время с непрерывным движением', () => {
    const run = new RunModel();
    run.start();
    run.switchLane();
    advance(run, 0.05);
    expect(run.playerX).toBeGreaterThan(WORLD.lanes[0]);
    expect(run.playerX).toBeLessThan(WORLD.lanes[1]);
    advance(run, 0.1);
    expect(run.playerX).toBe(WORLD.lanes[1]);
    run.switchLane();
    advance(run, 0.15);
    expect(run.playerX).toBe(WORLD.lanes[0]);
  });

  it('быстрые повторные нажатия не отменяют и не разворачивают незавершённый переход', () => {
    const run = new RunModel();
    run.start();
    run.switchLane();
    for (let i = 0; i < 20; i++) run.switchLane();
    expect(run.motion).toEqual({ kind: 'switching', from: 0, to: 1 });
    advance(run, 0.15);
    expect(run.motion).toEqual({ kind: 'settled', lane: 1 });
    expect(run.playerX).toBe(WORLD.lanes[1]);
    run.switchLane();
    expect(run.motion).toEqual({ kind: 'switching', from: 1, to: 0 });
  });

  it('дистанция учитывает скорость, а счёт растёт с пройденным расстоянием', () => {
    const run = new RunModel();
    run.start();
    advance(run, 0.5);
    expect(run.distance).toBeGreaterThan(WORLD.initialSpeed * 0.5);
    expect(run.score).toBe(Math.floor(run.distance / WORLD.distancePerPoint));
    run.start();
    expect(run.distance).toBe(0);
  });

  it('пауза останавливает время, препятствия и управление', () => {
    const run = new RunModel();
    run.start();
    advance(run, 1);
    run.pause();
    const before = JSON.stringify({ elapsed: run.elapsed, obstacles: run.obstacles, score: run.score });
    run.switchLane();
    advance(run, 2);
    expect(JSON.stringify({ elapsed: run.elapsed, obstacles: run.obstacles, score: run.score })).toBe(before);
    expect(run.lane).toBe(0);
    run.resume();
    advance(run, 0.1);
    expect(run.elapsed).toBeGreaterThan(1);
  });

  it('столкновение завершает забег и фиксирует счёт', () => {
    const run = new RunModel(() => 0);
    run.start();
    run.obstacles = [{ id: 0, lane: 0, y: WORLD.playerY - 40, passed: false }];
    advance(run, 0.1);
    expect(run.state).toBe('over');
    const score = run.score;
    advance(run, 3);
    run.switchLane();
    expect(run.score).toBe(score);
    expect(run.lane).toBe(0);
  });

  it('учитывает столкновение во время перехода между полосами', () => {
    const run = new RunModel();
    run.start();
    run.switchLane();
    run.obstacles = [{ id: 0, lane: 1, y: WORLD.playerY - 10, passed: false }];
    advance(run, 0.12);
    expect(run.state).toBe('over');
    expect(run.playerX).toBeLessThan(WORLD.lanes[1]);
  });

  it('начисляет бонус один раз за безопасный проход и удаляет старые преграды', () => {
    const run = new RunModel(() => 0);
    run.start();
    run.obstacles = [{ id: -1, lane: 1, y: WORLD.playerY, passed: false }];
    advance(run, 0.3);
    expect(run.state).toBe('running');
    expect(run.passed).toBe(1);
    expect(run.score).toBe(28);
    advance(run, 0.3);
    expect(run.passed).toBe(1);
    advance(run, 0.5);
    expect(run.obstacles.some(obstacle => obstacle.id === -1)).toBe(false);
  });

  it('не пропускает столкновение при большой задержке кадра', () => {
    const run = new RunModel();
    run.start();
    run.elapsed = 100;
    run.obstacles = [{ id: 0, lane: 0, y: WORLD.playerY - 60, passed: false }];
    run.update(10);
    expect(run.state).toBe('over');
    expect(run.elapsed).toBeLessThan(100.1);
  });

  it('игнорирует некорректное время', () => {
    const run = new RunModel();
    run.start();
    for (const delta of [NaN, Infinity, -1, 0]) run.update(delta);
    expect(run.elapsed).toBe(0);
    expect(run.score).toBe(0);
  });

  it('даёт одинаковый результат при 30 и 120 кадрах в секунду', () => {
    const slow = new RunModel(() => 0);
    const fast = new RunModel(() => 0);
    slow.start(); fast.start();
    slow.switchLane(); fast.switchLane();
    for (let i = 0; i < 60; i++) slow.update(1 / 30);
    advance(fast, 2);
    expect(slow.elapsed).toBeCloseTo(fast.elapsed, 8);
    expect(slow.score).toBe(fast.score);
    expect(slow.obstacles).toEqual(fast.obstacles);
  });

  it('создаёт проходимую трассу при максимальной скорости на разных случайных последовательностях', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const run = new RunModel(seededRandom(seed));
      run.start();
      let lastSpawnTime = -Infinity;
      let lastId = -1;
      let spawnCount = 0;
      for (let frame = 0; frame < 120 * 150; frame++) {
        // Бот реагирует за 0.3 секунды до преграды, без мгновенных телепортаций.
        const incoming = run.obstacles.find(obstacle => !obstacle.passed && obstacle.y <= WORLD.playerY + 36);
        if (incoming && incoming.lane === run.lane && incoming.y > WORLD.playerY - run.speed * 0.3) run.switchLane();
        run.update(1 / 120);
        const spawned = run.obstacles.filter(obstacle => obstacle.id > lastId);
        if (spawned.length) {
          expect(run.elapsed - lastSpawnTime).toBeGreaterThanOrEqual(WORLD.minSpawnGap - 1 / 120);
          expect((WORLD.playerY - WORLD.spawnY) / run.speed).toBeGreaterThan(1.5);
          lastSpawnTime = run.elapsed;
          lastId = Math.max(...spawned.map(item => item.id));
          spawnCount += spawned.length;
        }
        expect(run.state).toBe('running');
        expect(run.speed).toBeLessThanOrEqual(WORLD.maxSpeed);
        expect(run.obstacles.length).toBeLessThanOrEqual(PATTERNS.maxObstacles);
      }
      expect(run.speed).toBe(WORLD.maxSpeed);
      expect(spawnCount).toBeGreaterThan(100);
      expect(run.passed).toBeGreaterThan(100);
    }
  });
});
