import Phaser from 'phaser';
import { RunModel, WORLD } from './game/model';
import { RushScene } from './game/scene';
import { browserStorage, readBest, saveBest } from './game/storage';
import { GameUI, element } from './ui';
import { ProceduralAudio } from './audio';
import { Tutorial } from './game/tutorial';
import type { GameEvent } from './game/events';
import './style.css';

const run = new RunModel();
const storage = browserStorage();
const audio = new ProceduralAudio();
const tutorial = new Tutorial(run);
let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let best = readBest(storage);
let displayedState = run.state;
let storageAvailable = true;
let lastDisplayedScore = -1;

function start(): void {
  tutorial.stop();
  audio.unlock();
  audio.setMuted(false);
  audio.play('ui');
  run.start();
  ui.resetFeedback();
  displayedState = run.state;
  ui.show(run.state);
}

function pause(): void {
  run.pause();
  audio.setMuted(true);
  syncUI();
}

function resume(): void {
  audio.unlock();
  audio.setMuted(false);
  run.resume();
  syncUI();
}

function menu(): void {
  tutorial.stop();
  run.menu();
  audio.setMuted(true);
  ui.resetFeedback();
  syncUI();
}

const ui = new GameUI({
  start, pause, resume, menu,
  learn: () => {
    audio.unlock(); audio.setMuted(false); audio.play('ui');
    tutorial.start(); ui.resetFeedback(); displayedState = 'ready'; syncUI();
  },
  next: () => { audio.unlock(); audio.play('ui'); if (tutorial.next()) start(); },
  sound: () => { audio.toggle(); ui.settings(audio.enabled, reduced); },
  effects: () => { reduced = !reduced; ui.settings(audio.enabled, reduced); },
});
ui.settings(audio.enabled, reduced);
ui.update(0, best, run.speed);

function syncUI(): void {
  if (displayedState !== run.state) {
    displayedState = run.state;
    const newBest = run.state === 'over' && !run.practice && run.score > best;
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
  // Звуком управляет ProceduralAudio; Phaser не создаёт второй контекст.
  audio: { noAudio: true },
  banner: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new RushScene(run, (dt): readonly GameEvent[] => {
    tutorial.update(dt);
    const events = run.drainEvents();
    tutorial.onEvents(events);
    audio.handle(events);
    syncUI();
    ui.skills(run, tutorial, events, dt);
    return events;
  }, () => reduced),
  fps: { target: 60, limit: 60 },
  input: { keyboard: false, mouse: false, touch: false },
});

function switchLane(): void {
  if (tutorial.active && tutorial.complete) return;
  audio.unlock();
  run.switchLane();
}

element('#stage').addEventListener('pointerdown', event => {
  if (event.target instanceof Element && event.target.closest('button, .overlay')) return;
  if (!event.isPrimary || event.button !== 0) return;
  switchLane();
});

document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  // Кнопки сохраняют стандартную активацию через Enter и пробел.
  if (['Space', 'Enter'].includes(event.code) && event.target instanceof Element && event.target.closest('button')) return;
  if (['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
    if (run.state === 'running') switchLane();
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
