import Phaser from 'phaser';
import { RunModel, WORLD } from './model';
import { EFFECTS } from './config';
import type { GameEvent } from './events';

export class RushScene extends Phaser.Scene {
  private road!: Phaser.GameObjects.Graphics;
  private actors!: Phaser.GameObjects.Graphics;
  private ambient = 0;
  private intensity = 0;
  private switchPulse = 0;
  private effects!: Phaser.GameObjects.Graphics;
  private particles = Array.from({ length: EFFECTS.maxParticles }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, color: 0 }));
  private particleCursor = 0;
  private previousElapsed = 0;

  constructor(private readonly run: RunModel, private readonly onFrame: (dt: number) => readonly GameEvent[], private readonly reduced: () => boolean) {
    super('rush');
  }

  create(): void {
    this.road = this.add.graphics();
    this.actors = this.add.graphics();
    this.effects = this.add.graphics();
    this.drawRoad(0);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const events = this.onFrame(dt);
    const reduced = this.reduced();
    if (this.run.elapsed < this.previousElapsed) {
      for (const particle of this.particles) particle.life = 0;
      this.intensity = 0; this.switchPulse = 0;
    }
    this.previousElapsed = this.run.elapsed;
    for (const event of events) {
      if (event.type === 'switch') this.switchPulse = 0.18;
      if (event.type === 'perfect-switch') this.burst(this.run.playerX, WORLD.playerY, event.rating === 'GOOD' ? 0x52f6ff : event.rating === 'PERFECT' ? 0xff80df : 0xffe394, event.rating === 'ULTRA_PERFECT' ? 24 : 12);
      if (event.type === 'crystal') this.burst(event.x, event.y, 0xffe394, 8);
      if (event.type === 'combo') this.burst(this.run.playerX, WORLD.playerY, 0xffffff, 12);
      if (event.type === 'overdrive-start') this.burst(this.run.playerX, WORLD.playerY, 0xff80df, 28);
      if (event.type === 'collision') {
        this.burst(this.run.playerX, WORLD.playerY, 0xff5489, 28);
        if (!reduced) this.cameras.main.shake(150, EFFECTS.shakeIntensity);
      }
    }
    if (this.run.state !== 'paused') {
      const target = this.run.progression.overdriveActive && !reduced ? 1 : 0;
      this.intensity += (target - this.intensity) * Math.min(1, dt * EFFECTS.blendSpeed);
      this.switchPulse = Math.max(0, this.switchPulse - dt);
    }
    if (this.run.state === 'ready') this.ambient += dt;
    const offset = this.run.state === 'ready' ? this.ambient * 70 : this.run.elapsed * 180;
    this.drawRoad(offset);
    this.drawActors();
    this.effects.clear();
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      if (this.run.state === 'ready' || reduced) { particle.life = 0; continue; }
      if (this.run.state !== 'paused') { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; }
      this.effects.fillStyle(particle.color, Math.max(0, particle.life / EFFECTS.particleLife));
      this.effects.fillCircle(particle.x, particle.y, 2.5);
    }
  }

  private burst(x: number, y: number, color: number, count: number): void {
    if (this.reduced()) return;
    count = Math.min(this.particles.length, Math.round(count * EFFECTS.particleScale));
    for (let i = 0; i < count; i++) {
      const particle = this.particles[this.particleCursor++ % this.particles.length];
      const angle = i / count * Math.PI * 2;
      particle.x = x; particle.y = y; particle.color = color; particle.life = EFFECTS.particleLife;
      particle.vx = Math.cos(angle) * (80 + i % 3 * 35);
      particle.vy = Math.sin(angle) * (80 + i % 3 * 35);
    }
  }

  private drawRoad(offset: number): void {
    const g = this.road;
    g.clear();
    g.fillStyle(0x080c19, 1);
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    g.fillStyle(0x10192d, 0.7);
    g.fillRect(48, 0, 324, WORLD.height);
    g.fillStyle(0x23e5fa, 0.02);
    g.fillRect(48, 0, 160, WORLD.height);
    g.fillStyle(0xfc45b4, 0.025 + this.intensity * 0.07);
    g.fillRect(212, 0, 160, WORLD.height);

    for (let y = offset % 80 - 80; y < WORLD.height; y += 80) {
      g.lineStyle(1, 0x38517d, 0.16);
      g.lineBetween(48, y, 372, y);
      g.fillStyle(0x778bae, 0.25);
      g.fillRect(209, y, 2, 30);
      g.fillStyle(0x27e6fc, 0.35);
      g.fillRect(39, y, 3, 14);
      g.fillStyle(0xff55b8, 0.35);
      g.fillRect(378, y, 3, 14);
    }

    for (const [x, color] of [[48, this.intensity > 0.4 ? 0xff80df : 0x23e5fa], [372, this.intensity > 0.4 ? 0xffe394 : 0xfa45b8]]) {
      g.lineStyle(10, color, 0.035);
      g.lineBetween(x, 0, x, WORLD.height);
      g.lineStyle(3, color, 0.15);
      g.lineBetween(x, 0, x, WORLD.height);
      g.lineStyle(1, color, 0.65);
      g.lineBetween(x, 0, x, WORLD.height);
    }

    if (this.intensity > 0.01) {
      g.lineStyle(2, 0xff80df, this.intensity * 0.25);
      for (let i = 0; i < 10; i++) {
        const x = 60 + (i * 79) % 300;
        const y = (offset * 3 + i * 113) % WORLD.height;
        g.lineBetween(x, y, x, y + 35 + this.intensity * 30);
      }
    }
    for (let i = 0; i < 22; i++) {
      const x = (i * 137 + 17) % WORLD.width;
      const y = (i * 83 + offset * 0.3) % WORLD.height;
      if (x > 50 && x < 370) continue;
      g.fillStyle(i % 2 ? 0x23e5fa : 0xfa45b8, 0.4);
      g.fillRect(x, y, 2, 2);
    }
  }

  private drawActors(): void {
    const g = this.actors;
    g.clear();
    if (this.run.state === 'ready') return;

    for (const obstacle of this.run.obstacles) {
      if (obstacle.y < -40 || obstacle.y > WORLD.height + 40) continue;
      const x = WORLD.lanes[obstacle.lane];
      g.fillStyle(0xff477f, 0.08);
      g.fillRoundedRect(x - 62, obstacle.y - 23, 124, 46, 10);
      g.fillStyle(0x341b35, 1);
      g.fillRoundedRect(x - 54, obstacle.y - 15, 108, 30, 5);
      g.lineStyle(2, 0xff5489, 1);
      g.strokeRoundedRect(x - 54, obstacle.y - 15, 108, 30, 5);
      g.lineStyle(2, 0xff5489, 0.65);
      for (let i = -32; i <= 32; i += 16) g.lineBetween(x + i - 4, obstacle.y + 6, x + i + 4, obstacle.y - 6);
    }

    for (const crystal of this.run.crystals) {
      if (crystal.y < -20 || crystal.y > WORLD.height + 20) continue;
      const cx = WORLD.lanes[crystal.lane];
      const cy = crystal.y;
      g.fillStyle(0xffe394, 0.08);
      g.fillCircle(cx, cy, 20);
      g.fillStyle(0xffe394, 0.95);
      g.fillTriangle(cx, cy - 11, cx - 8, cy, cx + 8, cy);
      g.fillStyle(0xffffff, 0.85);
      g.fillTriangle(cx, cy + 11, cx - 8, cy, cx + 8, cy);
    }
    const x = this.run.playerX;
    const y = WORLD.playerY;
    const color = this.run.state === 'over' ? 0xff5489 : this.intensity > 0.4 ? 0xff80df : 0x52f6ff;
    const pulse = this.reduced() ? 0 : Math.sin(this.run.elapsed * 4) * 2 + this.switchPulse * 24;
    for (let i = this.reduced() ? 3 : 6 + Math.round(this.intensity * 4); i > 0; i--) {
      g.fillStyle(color, (11 - i) * 0.018);
      g.fillRoundedRect(x - 10 + i, y + 16 + i * 11 + (this.reduced() ? 0 : this.run.elapsed * 45 % 11), Math.max(2, 20 - i * 2), 24, 4);
    }
    g.fillStyle(color, 0.05);
    g.fillCircle(x, y, 30 + pulse + this.intensity * 6);
    g.fillStyle(color, 0.1);
    g.fillCircle(x, y, 23);
    g.fillStyle(0x123441, 1);
    g.fillCircle(x, y, WORLD.playerRadius);
    g.lineStyle(2, color, 1);
    g.strokeCircle(x, y, WORLD.playerRadius);
    g.fillStyle(color, 0.8);
    g.fillCircle(x, y, 9);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x - 3, y - 4, 3);
  }
}
