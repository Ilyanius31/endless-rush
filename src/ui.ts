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
    prototype: 'ПРОТОТИП / ЭТАП 01', sound: 'Без звука · Полная концентрация',
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
    prototype: 'PROTOTYPE / MILESTONE 01', sound: 'No sound · Full focus',
    loaded: 'Game ready. Press Start Run.',
  },
} as const;

type CopyKey = keyof typeof copy.ru;

export interface UIActions {
  start: () => void;
  pause: () => void;
  resume: () => void;
  menu: () => void;
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
          <div id="menu" class="menu overlay">
            <div class="menu-top"><span class="edition">01 <i></i> <span data-copy="arcade"></span></span><button id="language" class="language-button" type="button" aria-label="Switch to English">EN</button></div>
            <div class="brand"><span class="brand-kicker">WELCOME TO THE FAST LANE</span><h1>NEON<br><span>RUSH</span></h1><div class="switch-label"><i></i> S W I T C H <i></i></div></div>
            <p class="tagline" data-copy="tagline"></p>
            <p class="description" data-copy="description"></p>
            <div class="lane-illustration" aria-hidden="true"><span class="mini-block"></span><span class="mini-runner">●</span><span class="mini-switch">⇄</span></div>
            <div class="best-card"><span data-copy="best"></span><strong id="menu-best">0</strong><span class="best-star" aria-hidden="true">✦</span></div>
            <button id="start" class="primary-button" type="button"><span data-copy="play"></span><span aria-hidden="true">↗</span></button>
            <p class="tutorial"><span class="tap-icon" aria-hidden="true">◎</span><span data-copy="tutorial"></span></p>
            <p class="keyboard" data-copy="keyboard"></p>
            <div class="menu-footer"><span data-copy="sound"></span><span class="online-dot" aria-hidden="true"></span></div>
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
              <p id="storage-note" class="storage-note"></p>
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
