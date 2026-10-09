import { EFFECTS, SKILL } from './game/config';
import type { RunModel } from './game/model';
import type { GameEvent } from './game/events';
import type { Tutorial } from './game/tutorial';

type Language = 'ru' | 'en';

const copy = {
  ru: {
    arcade: 'АРКАДА НА РЕАКЦИЮ', best: 'РЕКОРД', score: 'СЧЁТ',
    tagline: 'Две полосы. Одно касание.', description: 'Лови ритм. Меняй полосу.\nУскользай от препятствий.',
    play: 'НАЧАТЬ ЗАБЕГ', tutorial: 'Коснись трассы, чтобы сменить полосу',
    keyboard: 'Пробел / ← → — смена полосы · P — пауза',
    pause: 'Пауза', paused: 'ПЕРЕДОХНИ', pausedDescription: 'Трасса подождёт. Продолжим?',
    resume: 'ПРОДОЛЖИТЬ', menu: 'В МЕНЮ', over: 'ЗАБЕГ ЗАВЕРШЁН',
    again: 'ЕЩЁ РАЗ', newBest: 'НОВЫЙ РЕКОРД', result: 'ТВОЙ СЧЁТ',
    speed: 'СКОРОСТЬ', hint: 'КАСАНИЕ = СМЕНА ПОЛОСЫ',
    local: 'Рекорд хранится на этом устройстве', unavailable: 'Рекорд доступен только до закрытия страницы',
    prototype: 'ПРОТОТИП / ЭТАП 02', sound: 'Звук',
    soundOn: 'ЗВУК: ВКЛ', soundOff: 'ЗВУК: ВЫКЛ', effectsOn: 'ЭФФЕКТЫ: ВСЕ', effectsOff: 'ЭФФЕКТЫ: МИНИМУМ',
    learn: 'ОБУЧЕНИЕ', skip: 'ПРОПУСТИТЬ', next: 'ДАЛЬШЕ', finish: 'В БОЙ', combo: 'КОМБО',
    training: 'ТРЕНИРОВКА · РЕКОРД НЕ СОХРАНЯЕТСЯ', tapNow: 'СЕЙЧАС! КОСНИСЬ ТРАССЫ', success: 'ОТЛИЧНО! МОЖНО ДАЛЬШЕ',
    lesson0: 'Коснись трассы — шар перейдёт на другую полосу.',
    lesson1: 'Уйди от розовой преграды. Ромб — кристалл, он даёт очки.',
    lesson2: 'GOOD: дождись подсказки и смени полосу близко к преграде.',
    lesson3: 'PERFECT: ещё ближе! Бонус придёт после безопасного прохода.',
    lesson4: 'ULTRA PERFECT: точное касание. Третий бонус повышает множитель.',
    lesson5: 'Заполни заряд точным касанием. Overdrive удвоит бонусы на 6 секунд.',
    rhythm: 'РИТМ · ЧЕРЕДУЙ ПОЛОСЫ', alternating: 'СЕРИЯ · СЛЕДИ ЗА ПОЛОСАМИ', collected: 'КРИСТАЛЛ',
    overdriveEnd: 'OVERDRIVE ЗАВЕРШЁН',

    loaded: 'Игра готова. Нажми «Начать забег».',
  },
  en: {
    arcade: 'REACTION ARCADE', best: 'BEST', score: 'SCORE',
    tagline: 'Two lanes. One touch.', description: 'Find your rhythm. Switch lanes.\nDodge the obstacles.',
    play: 'START RUN', tutorial: 'Tap the track to switch lanes',
    keyboard: 'Space / ← → — switch lanes · P — pause',
    pause: 'Pause', paused: 'TAKE A BREATHER', pausedDescription: 'The track can wait. Ready to continue?',
    resume: 'RESUME', menu: 'MAIN MENU', over: 'RUN COMPLETE',
    again: 'TRY AGAIN', newBest: 'NEW BEST', result: 'YOUR SCORE',
    speed: 'SPEED', hint: 'TAP TO SWITCH LANES',
    local: 'Best score is saved on this device', unavailable: 'Best score is kept until this page is closed',
    prototype: 'PROTOTYPE / MILESTONE 02', sound: 'Sound',
    soundOn: 'SOUND: ON', soundOff: 'SOUND: OFF', effectsOn: 'EFFECTS: FULL', effectsOff: 'EFFECTS: REDUCED',
    learn: 'TUTORIAL', skip: 'SKIP', next: 'NEXT', finish: 'LET’S PLAY', combo: 'COMBO',
    training: 'PRACTICE · BEST SCORE NOT SAVED', tapNow: 'NOW! TAP THE TRACK', success: 'WELL DONE! CONTINUE',
    lesson0: 'Tap the track to move the orb to the other lane.',
    lesson1: 'Dodge the pink block. The diamond is a crystal: collect it for points.',
    lesson2: 'GOOD: wait for the cue, then switch near the obstacle.',
    lesson3: 'PERFECT: even closer! The bonus arrives after a safe pass.',
    lesson4: 'ULTRA PERFECT: precise timing. The third bonus raises your multiplier.',
    lesson5: 'Finish charging with a precise switch. Overdrive doubles bonuses for 6 seconds.',
    rhythm: 'RHYTHM · ALTERNATE LANES', alternating: 'SEQUENCE · WATCH THE LANES', collected: 'CRYSTAL',
    overdriveEnd: 'OVERDRIVE COMPLETE',

    loaded: 'Game ready. Press Start Run.',
  },
} as const;

type CopyKey = keyof typeof copy.ru;

export interface UIActions {
  start: () => void;
  pause: () => void;
  resume: () => void;
  menu: () => void;
  learn: () => void;
  next: () => void;
  sound: () => void;
  effects: () => void;
}

export function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing UI element: ${selector}`);
  return node;
}

export class GameUI {
  language: Language = 'ru';
  private storageAvailable = true;
  private isNewBest = false;
  private soundEnabled = true;
  private reduced = false;
  private feedbackLife = 0;
  private patternLife = 0;
  private skillSnapshot = '';
  private tutorialSnapshot = '';

  constructor(actions: UIActions) {
    element('#app').innerHTML = `
      <main class="shell">
        <header class="desktop-heading"><span>NEON RUSH <b>↯</b></span><span data-copy="prototype"></span></header>
        <section id="stage" class="stage" data-state="ready" aria-label="NEON RUSH: SWITCH">
          <div id="canvas-host" aria-hidden="true"></div>
          <div class="hud" hidden>
            <div class="hud-score"><span data-copy="score"></span><strong id="score">00000</strong></div>
            <div class="hud-best"><span data-copy="best"></span><strong id="hud-best">0</strong></div>
            <button id="pause" class="icon-button" type="button" data-label="pause">Ⅱ</button>
          </div>
          <div id="skills" class="skills" hidden>
            <div><span data-copy="combo"></span> <strong id="combo">0</strong><b id="multiplier">×1</b></div>
            <div class="overdrive-row"><span>OVERDRIVE</span><strong id="charge-text">0%</strong></div>
            <progress id="charge" max="100" value="0" aria-label="Overdrive"></progress>
          </div>
          <div id="pattern-warning" class="pattern-warning" hidden></div>
          <div id="feedback" class="feedback" role="status" hidden></div>
          <div id="lesson" class="lesson" hidden>
            <small data-copy="training"></small><p id="lesson-text"></p><strong id="lesson-cue"></strong>
            <div><button id="lesson-next" type="button" class="secondary-button" data-copy="next" hidden></button>
            <button id="lesson-skip" type="button" class="secondary-button" data-copy="skip"></button></div>
          </div>
          <div id="menu" class="menu overlay">
            <div class="menu-top"><span class="edition">02 <i></i> <span data-copy="arcade"></span></span><button id="language" class="language-button" type="button" aria-label="Switch to English">EN</button></div>
            <div class="brand"><span class="brand-kicker">PERFECT SWITCH / OVERDRIVE</span><h1>NEON<br><span>RUSH</span></h1><div class="switch-label"><i></i> S W I T C H <i></i></div></div>
            <p class="tagline" data-copy="tagline"></p>
            <p class="description" data-copy="description"></p>

            <div class="best-card"><span data-copy="best"></span><strong id="menu-best">0</strong><span class="best-star" aria-hidden="true">✦</span></div>
            <button id="start" class="primary-button" type="button"><span data-copy="play"></span><span aria-hidden="true">↗</span></button>
            <button id="learn" class="secondary-button" type="button" data-copy="learn"></button><p class="tutorial"><span class="tap-icon" aria-hidden="true">◎</span><span data-copy="tutorial"></span></p>
            <p class="keyboard" data-copy="keyboard"></p>
            <div class="settings"><button type="button" data-setting="sound"></button><button type="button" data-setting="effects"></button></div>
          </div>
          <div id="dialog" class="dialog overlay" hidden>
            <div class="dialog-card">
              <div class="dialog-symbol" aria-hidden="true">↯</div>
              <p id="new-best" class="new-best" data-copy="newBest" hidden></p>
              <h2 id="dialog-title"></h2>
              <p id="pause-description" class="description" data-copy="pausedDescription"></p>
              <div id="result" class="result" hidden><span data-copy="result"></span><strong id="final-score">0</strong><p><span data-copy="best"></span> <b id="result-best">0</b></p></div>
              <button id="dialog-primary" class="primary-button" type="button"></button>
              <button id="menu-button" class="secondary-button" type="button" data-copy="menu"></button>
              <div class="settings"><button type="button" data-setting="sound"></button><button type="button" data-setting="effects"></button></div><p id="storage-note" class="storage-note"></p>
            </div>
          </div>
          <div id="run-footer" class="run-footer" hidden><span data-copy="hint"></span><span><span data-copy="speed"></span> <b id="speed">1.0×</b></span></div>
        </section>
        <footer class="desktop-footer"><span>01 / SWITCH</span><span>STAY SHARP. KEEP MOVING.</span><span>NEON RUSH © 2026</span></footer>
        <p id="status" class="sr-only" role="status" aria-live="polite"></p>
      </main>`;

    element('#start').addEventListener('click', actions.start);
    element('#pause').addEventListener('click', actions.pause);
    element('#menu-button').addEventListener('click', actions.menu);
    element('#dialog-primary').addEventListener('click', () => {
      if (element('#stage').dataset.state === 'paused') actions.resume();
      else actions.start();
    });
    element('#language').addEventListener('click', () => {
      this.language = this.language === 'ru' ? 'en' : 'ru';
      this.translate();
    });
    element('#learn').addEventListener('click', actions.learn);
    element('#lesson-skip').addEventListener('click', actions.start);
    element('#lesson-next').addEventListener('click', actions.next);
    document.querySelectorAll('[data-setting="sound"]').forEach(node => node.addEventListener('click', actions.sound));
    document.querySelectorAll('[data-setting="effects"]').forEach(node => node.addEventListener('click', actions.effects));
    this.translate();
    element('#status').textContent = this.text('loaded');
  }

  text(key: CopyKey): string {
    return copy[this.language][key];
  }

  update(score: number, best: number, speed: number): void {
    element('#score').textContent = String(score).padStart(5, '0');
    for (const selector of ['#hud-best', '#menu-best', '#result-best']) element(selector).textContent = String(best);
    element('#speed').textContent = `${(speed / 230).toFixed(1)}×`;
  }

  show(state: string, score = 0, newBest = false, storageAvailable = true): void {
    element('#stage').dataset.state = state;
    element('#menu').hidden = state !== 'ready';
    element('.hud').hidden = state === 'ready';
    element('#skills').hidden = state === 'ready';
    if (state !== 'running') { element('#lesson').hidden = true; element('#feedback').hidden = true; element('#pattern-warning').hidden = true; }
    element('#run-footer').hidden = state !== 'running';
    element('#dialog').hidden = state !== 'paused' && state !== 'over';
    element('#result').hidden = state !== 'over';
    element('#pause-description').hidden = state !== 'paused';
    element('#new-best').hidden = state !== 'over' || !newBest;
    element('#final-score').textContent = String(score);
    this.storageAvailable = storageAvailable;
    this.isNewBest = newBest;
    this.updateDialog();
    if (state === 'paused' || state === 'over') {
      element('#dialog-primary').focus({ preventScroll: true });
      element('#status').textContent = state === 'over' ? `${this.text('over')}. ${this.text('score')}: ${score}.` : this.text('pause');
    } else if (state === 'ready') element('#start').focus({ preventScroll: true });
    else if (state === 'running') {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      element('#status').textContent = '';
    }
  }

  settings(sound: boolean, reduced: boolean): void {
    this.soundEnabled = sound;
    this.reduced = reduced;
    element('#stage').dataset.reduced = String(reduced);
    for (const node of document.querySelectorAll<HTMLElement>('[data-setting]')) {
      const enabled = node.dataset.setting === 'sound' ? sound : !reduced;
      node.textContent = this.text(node.dataset.setting === 'sound' ? (sound ? 'soundOn' : 'soundOff') : (reduced ? 'effectsOff' : 'effectsOn'));
      node.setAttribute('aria-pressed', String(enabled));
    }
  }

  skills(run: RunModel, tutorial: Tutorial, events: readonly GameEvent[], dt: number): void {
    const progress = run.progression;
    const seconds = progress.overdriveRemaining.toFixed(1);
    const snapshot = `${progress.combo}/${progress.multiplier}/${progress.charge}/${seconds}`;
    if (snapshot !== this.skillSnapshot) {
      this.skillSnapshot = snapshot;
      element('#combo').textContent = String(progress.combo);
      element('#multiplier').textContent = `×${progress.multiplier}`;
      element('#charge-text').textContent = progress.overdriveActive ? `${seconds}s` : `${progress.charge}%`;
      element<HTMLProgressElement>('#charge').value = progress.overdriveActive ? progress.overdriveRemaining / SKILL.overdriveDuration * SKILL.maxCharge : progress.charge;
      element('#skills').dataset.overdrive = String(progress.overdriveActive);
    }
    element('#stage').dataset.lane = String(run.lane);
    element('#stage').dataset.practice = String(tutorial.active);
    element('#stage').dataset.collected = String(run.collected);
    element('#lesson').hidden = !tutorial.active || run.state !== 'running';
    const lessonKey = `${tutorial.step}/${tutorial.ready}/${tutorial.complete}`;
    if (tutorial.active && lessonKey !== this.tutorialSnapshot) {
      this.tutorialSnapshot = lessonKey;
      element('#lesson-text').textContent = `${tutorial.step + 1}/6 · ${this.text(`lesson${tutorial.step}` as CopyKey)}`;
      element('#lesson-cue').textContent = tutorial.complete ? this.text('success') : tutorial.ready ? this.text('tapNow') : '';
      element('#lesson-next').hidden = !tutorial.complete;
      element('#lesson-next').textContent = this.text(tutorial.step === 5 ? 'finish' : 'next');
    }
    element('#lesson').dataset.step = String(tutorial.step);
    element('#lesson').dataset.ready = String(tutorial.ready);
    element('#lesson').dataset.complete = String(tutorial.complete);
    if (run.state === 'running') { this.feedbackLife -= dt; this.patternLife -= dt; }
    for (const event of events) {
      if (event.type === 'perfect-switch') {
        element('#feedback').textContent = `${event.rating.replace('_', ' ')} +${event.points}`;
        element('#feedback').dataset.rating = event.rating;
        this.feedbackLife = EFFECTS.feedbackDuration;
      } else if (event.type === 'overdrive-start' || event.type === 'overdrive-end') {
        element('#pattern-warning').textContent = event.type === 'overdrive-start' ? 'OVERDRIVE' : this.text('overdriveEnd');
        this.patternLife = 1.5;
      } else if (event.type === 'pattern' && event.kind !== 'standard') {
        element('#pattern-warning').textContent = this.text(event.kind);
        this.patternLife = 1.6;
      } else if (event.type === 'combo') {
        element('#skills').classList.remove('milestone');
        if (!this.reduced) element('#skills').animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 400 });
      } else if (event.type === 'crystal' && this.feedbackLife <= 0) {
        element('#feedback').textContent = `${this.text('collected')} +${event.points}`;
        element('#feedback').dataset.rating = 'GOOD';
        this.feedbackLife = 0.7;
      }
    }
    element('#feedback').hidden = this.feedbackLife <= 0 || run.state !== 'running';
    element('#pattern-warning').hidden = this.patternLife <= 0 || run.state !== 'running';
  }

  resetFeedback(): void {
    this.feedbackLife = 0; this.patternLife = 0; this.tutorialSnapshot = '';
  }

  private translate(): void {
    document.documentElement.lang = this.language;
    document.querySelectorAll<HTMLElement>('[data-copy]').forEach(node => {
      node.textContent = this.text(node.dataset.copy as CopyKey);
    });
    document.querySelectorAll<HTMLElement>('[data-label]').forEach(node => {
      node.setAttribute('aria-label', this.text(node.dataset.label as CopyKey));
    });
    element('#language').textContent = this.language === 'ru' ? 'EN' : 'RU';
    element('#language').setAttribute('aria-label', this.language === 'ru' ? 'Switch to English' : 'Переключить на русский');
    this.settings(this.soundEnabled, this.reduced);
    this.tutorialSnapshot = '';
    this.updateDialog();
  }

  private updateDialog(): void {
    const paused = element('#stage').dataset.state === 'paused';
    element('#dialog-title').textContent = this.text(paused ? 'paused' : 'over');
    element('#dialog-primary').textContent = this.text(paused ? 'resume' : 'again');
    element('#storage-note').textContent = this.text(this.storageAvailable ? 'local' : 'unavailable');
    element('#new-best').hidden = element('#stage').dataset.state !== 'over' || !this.isNewBest;
  }
}
