import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProceduralAudio } from '../src/audio';

function audioFixture() {
  const oscillators: { stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }[] = [];
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const context = {
    currentTime: 0, state: 'running', destination: {}, resume: vi.fn().mockResolvedValue(undefined),
    createGain: () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
    createOscillator: () => {
      const oscillator = { frequency: parameter(), type: 'sine', start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null };
      oscillators.push(oscillator); return oscillator;
    },
  };
  const constructor = vi.fn(function () { return context; });
  vi.stubGlobal('AudioContext', constructor);
  return { context, constructor, oscillators };
}

afterEach(() => vi.unstubAllGlobals());
describe('процедурное аудио', () => {
  it('не создаёт контекст до ввода и повторно использует единственный контекст', () => {
    const mock = audioFixture(); const audio = new ProceduralAudio();
    audio.play('switch'); expect(mock.constructor).not.toHaveBeenCalled();
    audio.unlock(); audio.unlock(); audio.play('switch');
    expect(mock.constructor).toHaveBeenCalledTimes(1);
    expect(mock.oscillators).toHaveLength(2);
  });
  it('отключение звука, пауза и блокировка браузера запрещают новые голоса', () => {
    const mock = audioFixture(); const audio = new ProceduralAudio(); audio.unlock();
    audio.play('PERFECT');
    audio.setMuted(true);
    expect(mock.oscillators.every(oscillator => oscillator.stop.mock.calls.length === 2)).toBe(true);
    audio.play('switch'); expect(mock.oscillators).toHaveLength(3);
    audio.setMuted(false); audio.toggle(); audio.play('crystal'); expect(mock.oscillators).toHaveLength(3);
    audio.toggle(); mock.context.state = 'suspended'; audio.play('switch'); expect(mock.oscillators).toHaveLength(3);
  });
  it('ограничивает полифонию шестью голосами и переживает отказ AudioContext', () => {
    const mock = audioFixture(); const audio = new ProceduralAudio(); audio.unlock();
    for (let i = 0; i < 10; i++) audio.play('ULTRA_PERFECT');
    expect(mock.oscillators.filter(oscillator => oscillator.stop.mock.calls.length === 1)).toHaveLength(6);
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('Blocked'); } });
    const blocked = new ProceduralAudio();
    expect(() => { blocked.unlock(); blocked.play('ui'); }).not.toThrow();
  });
});
