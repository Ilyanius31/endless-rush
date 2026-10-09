const BEST_KEY = 'neon-rush-switch.best.v1';

export interface ScoreStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readBest(storage: ScoreStorage): number {
  try {
    const value = Number(storage.getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBest(storage: ScoreStorage, score: number): boolean {
  try {
    storage.setItem(BEST_KEY, String(score));
    return true;
  } catch {
    return false;
  }
}

// Доступ к самому localStorage тоже может быть запрещён настройками браузера.
export function browserStorage(): ScoreStorage {
  return {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  };
}
