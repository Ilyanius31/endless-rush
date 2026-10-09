import { describe, expect, it, vi } from 'vitest';
import { readBest, saveBest } from '../src/game/storage';

describe('рекорд', () => {
  it('читает сохранённое значение и записывает новый рекорд', () => {
    const storage = { getItem: vi.fn(() => '1420'), setItem: vi.fn() };
    expect(readBest(storage)).toBe(1420);
    expect(saveBest(storage, 2020)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('neon-rush-switch.best.v1', '2020');
  });

  it('восстанавливается при отсутствующем или повреждённом значении', () => {
    for (const value of [null, '', 'NaN', 'Infinity', '-5', '1.5', 'oops', '9007199254740992']) {
      expect(readBest({ getItem: () => value, setItem: () => {} })).toBe(0);
    }
  });

  it('продолжает работу, если хранилище недоступно', () => {
    const storage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    expect(readBest(storage)).toBe(0);
    expect(saveBest(storage, 250)).toBe(false);
  });
});
