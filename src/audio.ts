import type { GameEvent } from './game/events';

type Cue = 'switch' | 'crystal' | 'GOOD' | 'PERFECT' | 'ULTRA_PERFECT' | 'overdrive-start' | 'overdrive-end' | 'collision' | 'ui';
const tones: Record<Cue, readonly number[]> = {
  switch: [420, 620], crystal: [1100, 1600], GOOD: [520, 780], PERFECT: [660, 990, 1320],
  ULTRA_PERFECT: [880, 1320, 1760], 'overdrive-start': [330, 660, 990, 1320],
  'overdrive-end': [880, 440, 220], collision: [140, 65], ui: [600],
};

export class ProceduralAudio {
  enabled = true;
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private muted = false;
  private voices = new Set<OscillatorNode>();

  // Вызывается только обработчиками пользовательского ввода.
  unlock(): void {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (!this.master) {
        this.master = this.context.createGain();
        this.master.gain.value = 0.09;
        this.master.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
    } catch { /* Блокировка аудио не препятствует игре. */ }
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopVoices();
  }
  toggle(): void {
    this.enabled = !this.enabled;
    if (this.enabled) this.unlock();
    else this.stopVoices();
  }
  private stopVoices(): void {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
  play(cue: Cue): void {
    const context = this.context;
    if (!this.enabled || this.muted || !context || !this.master || context.state !== 'running') return;
    const notes = tones[cue];
    const duration = cue === 'collision' ? 0.16 : 0.085;
    for (let i = 0; i < notes.length; i++) {
      // Общая громкость ограничена шестью тихими голосами.
      if (this.voices.size >= 6) {
        const oldest = this.voices.values().next().value;
        if (oldest) { oldest.stop(); this.voices.delete(oldest); }
      }
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = context.currentTime + i * 0.045;
      oscillator.type = cue === 'collision' ? 'triangle' : 'sine';
      oscillator.frequency.value = notes[i];
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.3, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    }
  }
  handle(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'perfect-switch') this.play(event.rating);
      else if (event.type !== 'combo' && event.type !== 'pattern') this.play(event.type);
    }
  }
}
