import Phaser from 'phaser';
import { RunModel, WORLD } from './model';

export class RushScene extends Phaser.Scene {
  private road!: Phaser.GameObjects.Graphics;
  private actors!: Phaser.GameObjects.Graphics;
  private ambient = 0;
  private previousState = 'ready';

  constructor(private readonly run: RunModel, private readonly onFrame: () => void) {
    super('rush');
  }

  create(): void {
    this.road = this.add.graphics();
    this.actors = this.add.graphics();
    this.drawRoad(0);
  }

  update(_time: number, delta: number): void {
    this.run.update(delta / 1000);
    if (this.run.state === 'ready') this.ambient += Math.min(delta, 100) / 1000;
    const offset = this.run.state === 'ready' ? this.ambient * 70 : this.run.elapsed * 180;
    this.drawRoad(offset);
    this.drawActors();
    if (this.run.state === 'over' && this.previousState === 'running') {
      this.cameras.main.flash(160, 255, 70, 120);
      this.cameras.main.shake(180, 0.006);
    }
    this.previousState = this.run.state;
    this.onFrame();
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
    g.fillStyle(0xfc45b4, 0.025);
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

    for (const [x, color] of [[48, 0x23e5fa], [372, 0xfa45b8]]) {
      g.lineStyle(10, color, 0.035);
      g.lineBetween(x, 0, x, WORLD.height);
      g.lineStyle(3, color, 0.15);
      g.lineBetween(x, 0, x, WORLD.height);
      g.lineStyle(1, color, 0.65);
      g.lineBetween(x, 0, x, WORLD.height);
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

    const x = this.run.playerX;
    const y = WORLD.playerY;
    const color = this.run.state === 'over' ? 0xff5489 : 0x52f6ff;
    for (let i = 6; i > 0; i--) {
      g.fillStyle(color, (7 - i) * 0.016);
      g.fillRoundedRect(x - 10 + i, y + 16 + i * 11, 20 - i * 2, 24, 4);
    }
    g.fillStyle(color, 0.05);
    g.fillCircle(x, y, 30);
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
