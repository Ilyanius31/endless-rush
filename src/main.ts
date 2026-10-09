import Phaser from 'phaser';
import { RunModel, WORLD } from './game/model';
import { RushScene } from './game/scene';
import { browserStorage, readBest, saveBest } from './game/storage';
import { GameUI, element } from './ui';
import './style.css';

const run = new RunModel();
const storage = browserStorage();
let best = readBest(storage);
let displayedState = run.state;
let storageAvailable = true;
let lastDisplayedScore = -1;

function start(): void {
  run.start();
  displayedState = run.state;
  ui.show(run.state);
}

function pause(): void {
  run.pause();
  syncUI();
}

function resume(): void {
  run.resume();
  syncUI();
}

function menu(): void {
  run.state = 'ready';
  syncUI();
}

const ui = new GameUI({ start, pause, resume, menu });
ui.update(0, best, run.speed);

function syncUI(): void {
  if (displayedState !== run.state) {
    displayedState = run.state;
    const newBest = run.state === 'over' && run.score > best;
    if (newBest) {
      best = run.score;
      storageAvailable = saveBest(storage, best);
    }
    ui.show(run.state, run.score, newBest, storageAvailable);
    ui.update(run.score, best, run.speed);
  }
  if (run.score !== lastDisplayedScore) {
    lastDisplayedScore = run.score;
    ui.update(run.score, best, run.speed);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'canvas-host',
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: '#080c19',
  antialias: true,
  banner: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new RushScene(run, syncUI),
  fps: { target: 60, limit: 60 },
  input: { keyboard: false, mouse: false, touch: false },
});

element('#stage').addEventListener('pointerdown', event => {
  if (event.target instanceof Element && event.target.closest('button, .overlay')) return;
  if (!event.isPrimary || event.button !== 0) return;
  run.switchLane();
});

document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  // Кнопки сохраняют стандартную активацию через Enter и пробел.
  if (['Space', 'Enter'].includes(event.code) && event.target instanceof Element && event.target.closest('button')) return;
  if (['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
    if (run.state === 'running') run.switchLane();
    else if (event.code === 'Space' && (run.state === 'ready' || run.state === 'over')) start();
  } else if (event.code === 'Enter' && (run.state === 'ready' || run.state === 'over')) {
    event.preventDefault();
    start();
  } else if (['KeyP', 'Escape'].includes(event.code)) {
    event.preventDefault();
    if (run.state === 'running') pause();
    else if (run.state === 'paused') resume();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);
