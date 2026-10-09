import { describe, expect, it } from 'vitest';
import { RunModel, WORLD } from '../src/game/model';
import { seededRandom } from '../src/game/random';
import { chooseReachableLane, findSafeRoute, travelTime } from '../src/game/reachability';
import { sweptOrbCollision } from '../src/game/geometry';

describe('достижимость трассы', () => {
  it('отклоняет одновременное перекрытие обеих полос', () => {
    expect(findSafeRoute([{ lane: 0, y: 300 }, { lane: 1, y: 300 }], 60, 0)).toBeNull();
  });

  it('отклоняет слишком плотную смену препятствий, даже когда в каждом ряду открыта полоса', () => {
    expect(findSafeRoute([{ lane: 0, y: 300 }, { lane: 1, y: 225 }], 60, 0)).toBeNull();
    expect(findSafeRoute([{ lane: 0, y: 300 }, { lane: 1, y: 60 }], 60, 0)).not.toBeNull();
  });

  it('учитывает исходную полосу и отсутствие времени на первый переход', () => {
    expect(findSafeRoute([{ lane: 0, y: WORLD.playerY - 32 }], 0, 0)).toBeNull();
    expect(findSafeRoute([{ lane: 0, y: WORLD.playerY - 32 }], 0, 1)).not.toBeNull();
  });

  it('проверяет другую полосу или откладывает ряд, если обе не подходят', () => {
    expect(chooseReachableLane([{ lane: 0, y: WORLD.spawnY }], 0, 1)).toBe(0);
    expect(chooseReachableLane([{ lane: 0, y: WORLD.spawnY }, { lane: 1, y: WORLD.spawnY }], 0, 0)).toBeNull();
  });

  it('учитывает ускорение до ограничения скорости', () => {
    const time = travelTime(500, 0);
    expect(WORLD.initialSpeed * time + WORLD.acceleration * time ** 2 / 2).toBeCloseTo(500, 6);
    expect(travelTime(880, 100)).toBe(2);
  });

  it('воспроизводит маршрут из проверки достижимости с настоящими столкновениями', () => {
    const run = new RunModel(() => 0.5);
    run.start();
    run.elapsed = 90;
    run.obstacles = [0, 1, 0, 1].map((lane, index) => ({ id: index - 100, lane: lane as 0 | 1, y: WORLD.spawnY - index * WORLD.maxSpeed, passed: false }));
    const route = findSafeRoute(run.obstacles, run.elapsed, 0);
    expect(route).not.toBeNull();
    let action = 0;
    // Преграды, добавленные во время симуляции, удаляем: проверяется заданный маршрут.
    for (let frame = 0; frame < 120 * 5; frame++) {
      const time = frame * WORLD.fixedStep;
      if (route!.switches[action] && time >= route!.switches[action].time) {
        if (run.lane !== route!.switches[action].lane) run.switchLane();
        action++;
      }
      run.update(WORLD.fixedStep);
      run.obstacles = run.obstacles.filter(obstacle => obstacle.id < 0);
      if (run.state !== 'running') throw new Error(`Route collision at ${time}`);
    }
    expect(run.passed).toBe(4);
    expect(action).toBe(route!.switches.length);
  });

  it('симулирует 1 000 генерируемых последовательностей на четырёх уровнях сложности', () => {
    let generated = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const run = new RunModel(seededRandom(seed));
      run.start();
      run.elapsed = [0, 15, 45, 90][seed % 4];
      let lastId = -1;
      for (let frame = 0; frame < 120 * 12; frame++) {
        const obstacle = run.obstacles.find(item => !item.passed && item.y < WORLD.playerY + WORLD.playerRadius + WORLD.obstacleHeight / 2);
        if (obstacle && obstacle.lane === run.lane && obstacle.y > WORLD.playerY - run.speed * 0.3) run.switchLane();
        run.update(WORLD.fixedStep);
        if (run.state !== 'running') throw new Error(`Unfair sequence: seed=${seed}, frame=${frame}`);
        const added = run.obstacles.find(item => item.id > lastId);
        if (added) {
          if (!findSafeRoute(run.obstacles, run.elapsed)) throw new Error(`No reachable route: seed=${seed}`);
          lastId = added.id;
          generated++;
        }
      }
      if (run.passed < 6) throw new Error(`Insufficient obstacles: seed=${seed}`);
    }
    expect(generated).toBeGreaterThan(8000);
  }, 30_000);
});

describe('геометрия сферы', () => {
  it('проверяет движение между кадрами без пролёта через препятствие', () => {
    expect(sweptOrbCollision(128, 128, 128, 580, 660)).toBe(true);
    expect(sweptOrbCollision(292, 292, 128, 580, 660)).toBe(false);
  });

  it('учитывает круглую форму на углах, а не весь прямоугольник свечения', () => {
    expect(sweptOrbCollision(128 + 54 + 12, 128 + 54 + 12, 128, WORLD.playerY - 15 - 12, WORLD.playerY - 15 - 12)).toBe(false);
    expect(sweptOrbCollision(128 + 54 + 10, 128 + 54 + 10, 128, WORLD.playerY - 15 - 10, WORLD.playerY - 15 - 10)).toBe(true);
  });
});
