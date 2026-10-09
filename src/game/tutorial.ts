import { WORLD } from './config';
import type { GameEvent, SwitchRating } from './events';
import { RunModel, type RunState } from './model';
import { timeToDanger } from './timing';

// Учебные остановки меняют только течение времени, а не геометрию перехода.
export class Tutorial {
  active = false;
  step = 0;
  ready = false;
  complete = false;
  private serial = -1;
  private remainder = 0;
  private initialCombo = 0;
  private initialCharge = 0;
  constructor(private readonly run: RunModel) {}

  start(): void { this.active = true; this.step = 0; this.run.start(true); this.prepare(); }
  stop(): void { this.active = false; this.ready = false; this.complete = false; }
  next(): boolean {
    if (!this.complete) return false;
    if (++this.step === 6) { this.stop(); return true; }
    this.prepare();
    return false;
  }
  private prepare(): void {
    this.complete = false;
    this.remainder = 0;
    this.initialCombo = this.run.progression.combo;
    this.ready = this.step === 0;
    this.run.obstacles = [];
    this.run.crystals = [];
    if (this.step > 0) {
      this.run.obstacles.push({ id: this.serial--, lane: this.run.lane, y: 180, passed: false });
      this.run.crystals.push({ id: this.serial--, lane: this.run.lane === 0 ? 1 : 0, y: 180, collected: false });
    }
    if (this.step === 5) this.run.progression.charge = 80;
    this.initialCharge = this.run.progression.charge;
  }
  update(dt: number): void {
    if (!this.active) { this.run.update(dt); return; }
    if (this.run.state !== 'running' || this.complete) return;
    // Деление кадра позволяет остановиться до опасности даже при низкой частоте кадров.
    this.remainder += Math.min(dt, 0.1);
    const steps = Math.floor((this.remainder + 1e-12) / WORLD.fixedStep);
    for (let i = 0; i < steps; i++) {
      const obstacle = this.run.obstacles[0];
      const gate = [0, 0.7, 0.37, 0.25, 0.17, 0.25][this.step];
      if (obstacle && !obstacle.passed && this.run.motion.kind === 'settled' && this.run.lane === obstacle.lane && timeToDanger(obstacle.y, this.run.elapsed) <= gate) {
        this.ready = true;
        this.remainder = 0;
        return;
      }
      this.remainder = Math.max(0, this.remainder - WORLD.fixedStep);
      this.run.update(WORLD.fixedStep);
      if (this.step === 0 && this.run.lane === 1 && this.run.motion.kind === 'settled') this.complete = true;
      if ((this.run.state as RunState) === 'over') {
        // Ошибка в учебном примере не заканчивает обычный забег и не сохраняет счёт.
        this.run.start(true);
        this.prepare();
        return;
      }
      if (obstacle?.passed) {
        if (this.step === 1 || this.run.progression.overdriveActive) this.complete = true;
        else if (!this.run.pendingAttempt && this.run.progression.combo === this.initialCombo) this.prepare();
      }
      if (this.complete) return;
    }
  }
  onEvents(events: readonly GameEvent[]): void {
    if (!this.active || this.step < 2) return;
    const expected: readonly (SwitchRating | null)[] = [null, null, 'GOOD', 'PERFECT', 'ULTRA_PERFECT', 'PERFECT'];
    for (const event of events) {
      if (event.type !== 'perfect-switch') continue;
      if (this.step === 5 ? this.run.progression.overdriveActive : event.rating === expected[this.step]) {
        this.complete = true;
      } else {
        // Повторяем неверное окно, сохраняя исходные условия учебного упражнения.
        this.run.progression.resetTemporary();
        this.run.progression.combo = this.initialCombo;
        this.run.progression.charge = this.initialCharge;
        this.prepare();
      }
    }
  }
}
