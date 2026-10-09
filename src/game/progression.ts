import { SKILL, WORLD } from './config';
import type { SwitchRating } from './events';

export class RunProgression {
  combo = 0;
  charge = 0;
  private remainingTicks = 0;
  private bonusHalfPoints = 0;

  get bonus(): number { return this.bonusHalfPoints / 2; }
  get overdriveRemaining(): number { return this.remainingTicks * WORLD.fixedStep; }
  get overdriveActive(): boolean { return this.remainingTicks > 0; }
  get comboMultiplier(): number {
    for (let i = SKILL.comboTiers.length - 1; i >= 0; i--) {
      if (this.combo >= SKILL.comboTiers[i].combo) return SKILL.comboTiers[i].multiplier;
    }
    return 1;
  }
  get multiplier(): number {
    return Math.min(SKILL.maxMultiplier, this.comboMultiplier * (this.overdriveActive ? SKILL.overdriveMultiplier : 1));
  }

  addScore(base: number): number {
    // Полуочки сохраняются точно и округляются только при показе общего счёта.
    const units = Math.round(base * this.multiplier * 2);
    this.bonusHalfPoints += units;
    return units / 2;
  }

  confirm(rating: SwitchRating): { points: number; multiplier: number; activated: boolean; milestone: boolean } {
    this.combo++;
    const multiplier = this.multiplier;
    const points = this.addScore(SKILL.rewards[rating]);
    let activated = false;
    if (!this.overdriveActive) {
      this.charge = Math.min(SKILL.maxCharge, this.charge + SKILL.charge[rating]);
      if (this.charge === SKILL.maxCharge) {
        this.charge = 0;
        this.remainingTicks = Math.round(SKILL.overdriveDuration / WORLD.fixedStep);
        activated = true;
      }
    }
    return { points, multiplier, activated, milestone: SKILL.comboTiers.some(tier => tier.combo === this.combo && tier.combo > 0) };
  }

  tick(): boolean {
    if (!this.overdriveActive) return false;
    this.remainingTicks--;
    return !this.overdriveActive;
  }

  resetTemporary(): void { this.combo = 0; this.charge = 0; this.remainingTicks = 0; }
  reset(): void { this.resetTemporary(); this.bonusHalfPoints = 0; }
}
