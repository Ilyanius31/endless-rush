import { describe, expect, it } from 'vitest';
import { SKILL, WORLD } from '../src/game/config';
import { RunModel } from '../src/game/model';
import { RunProgression } from '../src/game/progression';
import { evaluateSwitch, rateTiming, timeToDanger } from '../src/game/timing';
import { seededRandom } from '../src/game/random';
import { createPattern } from '../src/game/patterns';
import { findRouteFromPosition, findSafeRoute } from '../src/game/reachability';
import { Tutorial } from '../src/game/tutorial';
import type { SwitchRating } from '../src/game/events';

function advance(run: RunModel, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / WORLD.fixedStep); i++) run.update(WORLD.fixedStep);
}
function fixture(seconds = 0.25): RunModel {
  const run = new RunModel(() => 0, false);
  run.start();
  run.elapsed = 90;
  run.obstacles = [{ id: 7, lane: 0, y: WORLD.playerY - 31 - WORLD.maxSpeed * (seconds + WORLD.fixedStep), passed: false }];
  return run;
}

describe('подтверждённый Perfect Switch', () => {
  it.each<[number, SwitchRating | null]>([
    [0.1399, null], [0.14, 'ULTRA_PERFECT'], [0.1999, 'ULTRA_PERFECT'],
    [0.20, 'PERFECT'], [0.2999, 'PERFECT'], [0.30, 'GOOD'], [0.45, 'GOOD'], [0.4501, null],
  ])('граница окна %s → %s', (seconds, expected) => expect(rateTiming(seconds)).toBe(expected));

  it.each<[number, SwitchRating]>([[0.37, 'GOOD'], [0.25, 'PERFECT'], [0.17, 'ULTRA_PERFECT']])('подтверждает %s только после прохода', (seconds, rating) => {
    const run = fixture(seconds);
    expect(timeToDanger(run.obstacles[0].y, run.elapsed)).toBeCloseTo(seconds);
    run.switchLane();
    expect(run.pendingAttempt?.rating).toBe(rating);
    expect(run.progression.bonus).toBe(0);
    advance(run, 0.125);
    expect(run.motion.kind).toBe('settled');
    expect(run.progression.combo).toBe(0);
    advance(run, 0.7);
    expect(run.state).toBe('running');
    expect(run.progression.combo).toBe(1);
    expect(run.progression.bonus).toBe(SKILL.rewards[rating] + WORLD.passBonus);
    expect(run.drainEvents().filter(event => event.type === 'perfect-switch')).toHaveLength(1);
    advance(run, 1);
    expect(run.drainEvents().filter(event => event.type === 'perfect-switch')).toHaveLength(0);
  });

  it('учитывает ускорение и границу геометрии вместо центра', () => {
    const run = fixture();
    const y = run.obstacles[0].y;
    expect(timeToDanger(y, 0)).toBeGreaterThan(timeToDanger(y, 90));
    expect(timeToDanger(y, 90)).toBeLessThan((WORLD.playerY - y) / WORLD.maxSpeed);
    expect(timeToDanger(WORLD.playerY, 0)).toBe(0);
  });

  it('отвергает другую полосу, позднее действие, пустую трассу и опасный переход', () => {
    const run = fixture();
    expect(evaluateSwitch([], 0, 90)).toBeNull();
    expect(evaluateSwitch(run.obstacles, 1, 90)).toBeNull();
    run.obstacles.push({ id: 8, lane: 1, y: WORLD.playerY - 10, passed: false });
    expect(evaluateSwitch(run.obstacles, 0, 90)).toBeNull();
    run.switchLane(); advance(run, 0.15);
    expect(run.state).toBe('over');
    expect(run.progression.combo).toBe(0);
    const late = fixture(0.05);
    late.switchLane();
    expect(late.pendingAttempt).toBeNull();
    late.obstacles[0].y = WORLD.playerY + 40;
    expect(evaluateSwitch(late.obstacles, 0, 90)).toBeNull();
  });

  it('отменённая попытка и спам не дают повторной награды', () => {
    const run = fixture();
    run.switchLane();
    for (let i = 0; i < 100; i++) run.switchLane();
    expect(run.pendingAttempt?.obstacleId).toBe(7);
    advance(run, 0.125);
    run.switchLane();
    expect(run.pendingAttempt).toBeNull();
    expect(run.obstacles[0].timingClaimed).toBe(true);
    expect(evaluateSwitch(run.obstacles, 0, run.elapsed)).toBeNull();
    advance(run, 1);
    expect(run.progression.combo).toBe(0);
    expect(run.drainEvents().filter(event => event.type === 'perfect-switch')).toHaveLength(0);
  });

  it('смерть, меню и рестарт очищают неподтверждённые попытки', () => {
    for (const action of ['death', 'menu', 'restart']) {
      const run = fixture(); run.switchLane();
      if (action === 'death') { run.obstacles.push({ id: 9, lane: 1, y: WORLD.playerY - 30, passed: false }); advance(run, 0.125); }
      else if (action === 'menu') run.menu();
      else run.start();
      expect(run.pendingAttempt).toBeNull();
      expect(run.progression.combo).toBe(0);
      expect(run.drainEvents().some(event => event.type === 'perfect-switch')).toBe(false);
    }
  });
});

describe('комбо, счёт, Overdrive и кристаллы', () => {
  it('проходит все уровни комбо и не пересчитывает прошлые очки', () => {
    const progress = new RunProgression();
    let total = 0;
    for (let combo = 1; combo <= 12; combo++) {
      const previous = progress.bonus;
      const reward = progress.confirm('GOOD');
      const tier = combo < 3 ? 1 : combo < 6 ? 1.5 : combo < 10 ? 2 : 3;
      expect(progress.comboMultiplier).toBe(tier);
      expect(reward.milestone).toBe([3, 6, 10].includes(combo));
      expect(reward.multiplier).toBe(tier * (combo > 10 ? 2 : 1));
      total += reward.points;
      expect(progress.bonus).toBe(previous + reward.points);
    }
    expect(progress.bonus).toBe(total);
    expect(progress.multiplier).toBe(SKILL.maxMultiplier);
    progress.resetTemporary();
    expect(progress.bonus).toBe(total);
    expect(progress.combo).toBe(0);
    progress.reset(); expect(progress.bonus).toBe(0);
  });

  it('начисляет половины очков точно, дистанция не умножается', () => {
    const run = new RunModel(() => 0, false); run.start();
    run.progression.combo = 3;
    run.progression.addScore(25);
    expect(run.progression.bonus).toBe(37.5);
    advance(run, 0.5);
    expect(run.score).toBe(Math.floor(run.distance / WORLD.distancePerPoint + 37.5));
  });

  it('активирует заряд, игнорирует его во время Overdrive, истекает за 720 шагов', () => {
    const p = new RunProgression();
    p.confirm('GOOD'); p.confirm('PERFECT'); p.confirm('ULTRA_PERFECT');
    expect(p.charge).toBe(60);
    p.confirm('PERFECT');
    expect(p.confirm('PERFECT').activated).toBe(true);
    expect(p.overdriveRemaining).toBe(6);
    p.confirm('ULTRA_PERFECT'); expect(p.charge).toBe(0);
    for (let i = 0; i < 719; i++) expect(p.tick()).toBe(false);
    expect(p.tick()).toBe(true);
    expect(p.overdriveActive).toBe(false);
    expect(p.tick()).toBe(false);
  });

  it('пауза замораживает Overdrive; смерть и рестарт сбрасывают временное состояние', () => {
    const run = new RunModel(() => 0, false); run.start();
    run.progression.charge = 80; run.progression.confirm('PERFECT');
    advance(run, 1); expect(run.progression.overdriveRemaining).toBe(5);
    run.pause(); advance(run, 10); expect(run.progression.overdriveRemaining).toBe(5);
    run.resume(); advance(run, 5);
    expect(run.drainEvents().filter(event => event.type === 'overdrive-end')).toHaveLength(1);
    run.progression.charge = 80; run.progression.confirm('PERFECT');
    run.obstacles = [{ id: 1, lane: 0, y: WORLD.playerY, passed: false }];
    advance(run, 0.02);
    expect(run.progression.overdriveActive).toBe(false);
    expect(run.progression.combo).toBe(0);
    run.start(); expect(run.progression.bonus).toBe(0); expect(run.progression.charge).toBe(0);
  });

  it('свободный проход не обрывает комбо; кристалл даёт очки один раз', () => {
    const run = new RunModel(() => 0, false); run.start(); run.progression.combo = 3;
    run.crystals = [{ id: 1, lane: 0, y: WORLD.playerY - 20, collected: false }];
    run.obstacles = [{ id: 2, lane: 1, y: WORLD.playerY, passed: false }];
    advance(run, 0.5);
    expect(run.collected).toBe(1);
    expect(run.progression.combo).toBe(3);
    expect(run.progression.bonus).toBe((SKILL.crystalScore + WORLD.passBonus) * 1.5);
    expect(run.drainEvents().filter(event => event.type === 'crystal')).toHaveLength(1);
    advance(run, 1); expect(run.collected).toBe(1);
  });
});

describe('семейства препятствий и обучение', () => {
  it('проверяет каждое семейство и стыки повторных ритмов на всех скоростях', () => {
    for (const elapsed of [0, 15, 45, 90]) for (const kind of ['standard', 'alternating', 'rhythm'] as const) {
      const first = createPattern(kind, elapsed, 0, seededRandom(17));
      const next = createPattern('rhythm', elapsed, 1, seededRandom(7));
      const barriers = [...first.rows, ...next.rows.map(row => ({ ...row, y: row.y - first.span - WORLD.maxSpeed * first.recovery }))];
      expect(findSafeRoute(barriers, elapsed, 0)).not.toBeNull();
      expect(findSafeRoute(barriers, elapsed, 1)).not.toBeNull();
      expect(createPattern(kind, elapsed, 0, seededRandom(17))).toEqual(first);
    }
  });

  it('проверяет реальную позицию посреди перехода', () => {
    expect(findRouteFromPosition([{ lane: 1, y: WORLD.playerY }], 90, 220, 1)).toBeNull();
    expect(findRouteFromPosition([{ lane: 1, y: -40 }], 90, 220, 1)).not.toBeNull();
    expect(findRouteFromPosition([{ lane: 0, y: WORLD.playerY }], 90, WORLD.lanes[0], 0)).toBeNull();
  });

  it('Overdrive не меняет препятствия, движение и столкновения', () => {
    const normal = new RunModel(seededRandom(22)); const charged = new RunModel(seededRandom(22));
    normal.start(); charged.start(); charged.progression.charge = 80; charged.progression.confirm('PERFECT');
    for (let i = 0; i < 240; i++) { normal.update(WORLD.fixedStep); charged.update(WORLD.fixedStep); }
    expect(normal.obstacles).toEqual(charged.obstacles);
    expect(normal.crystals).toEqual(charged.crystals);
    expect(normal.playerX).toBe(charged.playerX);
    expect(normal.speed).toBe(charged.speed);
  });

  it('обучение проходит настоящие награды, кристаллы и Overdrive без смерти', () => {
    const run = new RunModel(); const tutorial = new Tutorial(run); tutorial.start();
    for (let step = 0; step < 6; step++) {
      for (let frame = 0; frame < 600 && !tutorial.complete; frame++) {
        if (tutorial.ready && run.motion.kind === 'settled' && (step === 0 ? run.lane === 0 : run.lane === run.obstacles[0]?.lane)) run.switchLane();
        tutorial.update(WORLD.fixedStep);
        tutorial.onEvents(run.drainEvents());
        expect(run.state).toBe('running');
      }
      expect(tutorial.complete).toBe(true);
      if (step === 5) expect(run.progression.overdriveActive).toBe(true);
      tutorial.next();
    }
    expect(tutorial.active).toBe(false);
    expect(run.practice).toBe(true);
    expect(run.progression.combo).toBe(4);
    expect(run.collected).toBe(5);
    run.start(); expect(run.practice).toBe(false); expect(run.score).toBe(0);
  });
});

it('откладывает появление, не меняя уже существующие препятствия', () => {
  const run = new RunModel(seededRandom(23)); run.start(); run.elapsed = 90;
  run.obstacles = [{ id: -1, lane: 0, y: 550, passed: false }];
  run.update(WORLD.fixedStep);
  expect(run.state).toBe('running');
  expect(run.patternCount).toBe(0);
  expect(run.obstacles).toHaveLength(1);
  expect(run.obstacles[0]).toEqual({ id: -1, lane: 0, y: 550 + WORLD.maxSpeed * WORLD.fixedStep, passed: false });
  run.switchLane(); advance(run, 1);
  expect(run.state).toBe('running');
  expect(run.patternCount).toBeGreaterThan(0);
});

it('ранние касания не блокируют обучение', () => {
  const run = new RunModel(); const tutorial = new Tutorial(run); tutorial.start();
  tutorial.step = 2; tutorial.complete = true; tutorial.next();
  run.switchLane();
  for (let i = 0; i < 600; i++) { tutorial.update(WORLD.fixedStep); tutorial.onEvents(run.drainEvents()); }
  expect(tutorial.complete).toBe(false);
  expect(tutorial.ready).toBe(true);
  run.switchLane();
  for (let i = 0; i < 100; i++) { tutorial.update(WORLD.fixedStep); tutorial.onEvents(run.drainEvents()); }
  expect(tutorial.complete).toBe(true);
  expect(run.state).toBe('running');
});

it('последний урок не завершается без настоящей активации Overdrive', () => {
  const run = new RunModel(); const tutorial = new Tutorial(run); tutorial.start();
  tutorial.step = 4; tutorial.complete = true; tutorial.next();
  for (let i = 0; i < 300 && timeToDanger(run.obstacles[0].y, run.elapsed) > 0.37; i++) tutorial.update(WORLD.fixedStep);
  run.switchLane();
  for (let i = 0; i < 100; i++) { tutorial.update(WORLD.fixedStep); tutorial.onEvents(run.drainEvents()); }
  expect(tutorial.complete).toBe(false);
  expect(run.progression.overdriveActive).toBe(false);
  expect(run.progression.charge).toBe(80);
});
