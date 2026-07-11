/**
 * Game Screen · 协调游戏引擎 + UI
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { LEVELS, getWordsForLevel, getDistractors } from '../data/words.js';
import { Game } from '../engine/game.js';
import { showResult } from './modals.js';
import { refreshLevelScreen } from './level.js';

let game = null;
let rafId = null;
let currentLevel = null;
let lastTick = 0;
let phase = 'choose'; // 当前题目模式: choose / spell

export function initGameScreen() {
  const canvas = document.getElementById('game-canvas');
  game = new Game(canvas);

  document.getElementById('btn-pause').addEventListener('click', () => {
    pauseGame();
  });

  document.getElementById('btn-resume').addEventListener('click', () => {
    resumeGame();
  });

  document.getElementById('btn-pause-retry').addEventListener('click', () => {
    document.getElementById('modal-pause').classList.add('hidden');
    startLevel(currentLevel.id);
  });

  document.getElementById('btn-pause-back').addEventListener('click', () => {
    quitToLevels();
  });

  // 选词点击
  document.getElementById('quiz-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.quiz-option');
    if (!btn) return;
    const word = btn.dataset.word;
    game.fireBullet(word);
    showNextQuestion();
  });

  // 拼词回车 + 按钮
  const spellInput = document.getElementById('spell-input');
  const submitBtn = document.getElementById('btn-spell-submit');

  function submitSpell() {
    const value = spellInput.value.trim().toLowerCase();
    if (!value || !game.currentWord) return;
    game.fireBullet(value);
    spellInput.value = '';
    showNextQuestion();
  }

  submitBtn.addEventListener('click', submitSpell);
  spellInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitSpell();
  });

  document.getElementById('btn-spell-skip').addEventListener('click', () => {
    if (game.currentWord) {
      Storage.recordWordResult(Storage.getCurrentUser().id, game.currentWord.word, false);
      game._selectNextTarget();
      showNextQuestion();
    }
  });

  // 监听 retry / next 事件
  window.addEventListener('retry-level', () => startLevel(currentLevel.id));
  window.addEventListener('next-level', () => {
    if (!currentLevel) return;
    const nextIdx = LEVELS.findIndex(l => l.id === currentLevel.id) + 1;
    if (nextIdx < LEVELS.length) {
      // 必须从当前位置开始,但要检查上一关是否已通关(简化:总是允许 next)
      const next = LEVELS[nextIdx];
      startLevel(next.id);
      currentLevel = next;
    } else {
      showScreen('level');
    }
  });
}

/** 从关卡屏点进游戏时调用 */
export function startLevel(levelId) {
  currentLevel = LEVELS.find(l => l.id === levelId);
  if (!currentLevel) return;

  showScreen('game');
  game.loadLevel(levelId);

  // 重置 HUD
  document.getElementById('hud-hp').textContent = game.player.hp;
  document.getElementById('hud-progress').textContent = `0/${game.total}`;
  document.getElementById('hud-mode').textContent =
    currentLevel.mode === 'spell' ? '拼词模式' : '看图选词';

  phase = currentLevel.mode;
  showNextQuestion();

  // 启动主循环
  lastTick = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  const loop = (now) => {
    const dt = Math.min(40, now - lastTick); // 限速
    lastTick = now;
    game.update(dt);
    game.render();
    updateHUD();

    if (game.state === 'cleared' || game.state === 'failed') {
      finishLevel();
      return;
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

/** 渲染当前题目面板 */
function showNextQuestion() {
  if (!game || !game.currentWord) return;
  const w = game.currentWord;

  if (phase === 'choose') {
    document.getElementById('quiz-panel').classList.remove('hidden');
    document.getElementById('spell-panel').classList.add('hidden');

    document.getElementById('quiz-image').textContent = w.image;

    // 干扰项 + 正确答案,洗牌
    const distractors = getDistractors(w, 3);
    const opts = [...distractors, w].sort(() => Math.random() - 0.5);
    const optionsEl = document.getElementById('quiz-options');
    optionsEl.innerHTML = '';
    for (const o of opts) {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.dataset.word = o.word;
      btn.innerHTML = `${o.word}<br><span class="muted" style="font-size:12px;">${o.meaning}</span>`;
      optionsEl.appendChild(btn);
    }
  } else {
    document.getElementById('quiz-panel').classList.add('hidden');
    document.getElementById('spell-panel').classList.remove('hidden');

    document.getElementById('spell-image').textContent = w.image;
    document.getElementById('spell-meaning').textContent = `中文: ${w.meaning}`;
    document.getElementById('spell-input').value = '';
    setTimeout(() => document.getElementById('spell-input').focus(), 50);
  }
}

function updateHUD() {
  if (!game) return;
  document.getElementById('hud-hp').textContent = game.player.hp;
  document.getElementById('hud-progress').textContent = `${game.killed}/${game.total}`;
}

function finishLevel() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const userId = Storage.getCurrentUser().id;
  const isCleared = game.state === 'cleared';
  const accuracy = Math.round((game.killed / game.total) * 100);

  // 简单星数规则
  let stars = 0;
  if (isCleared) stars = 1;
  if (isCleared && game.player.hp >= game.player.maxHp * 0.7) stars = 2;
  if (isCleared && game.player.hp === game.player.maxHp && accuracy === 100) stars = 3;

  // 记录关卡进度
  Storage.setLevelProgress(userId, currentLevel.id, {
    score: accuracy,
    stars,
    completed: isCleared,
  });

  const title = isCleared ? '🎉 关卡完成!' : '💔 失败';
  const stats = `
    <div style="text-align:center;margin:20px 0;">
      <div style="font-size:32px;color:#ffec27;">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <div style="margin-top:12px;">
        <div>剩余血量: ${game.player.hp}/${game.player.maxHp}</div>
        <div>命中率: ${accuracy}%</div>
        <div>错词入账: ${Storage.getWrongWords(userId).length} 个</div>
      </div>
    </div>
  `;

  // 找下一关是否存在
  const nextIdx = LEVELS.findIndex(l => l.id === currentLevel.id) + 1;
  const canNext = nextIdx < LEVELS.length;
  showResult(title, stats, canNext);

  refreshLevelScreen();
}

/** 监听菜单选人后的进入下一级 */
/** 暂停:停主循环 + 显示暂停模态 */
export function pauseGame() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.getElementById('modal-pause').classList.remove('hidden');
}

/** 恢复:隐藏模态,重启主循环 */
export function resumeGame() {
  document.getElementById('modal-pause').classList.add('hidden');
  lastTick = performance.now();
  const loop = (now) => {
    const dt = Math.min(40, now - lastTick);
    lastTick = now;
    game.update(dt);
    game.render();
    updateHUD();
    if (game.state === 'cleared' || game.state === 'failed') {
      finishLevel();
      return;
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
  // 拼词面板:恢复焦点
  setTimeout(() => {
    const el = document.getElementById('spell-input');
    if (el && !document.getElementById('spell-panel').classList.contains('hidden')) {
      el.focus();
    }
  }, 50);
}

/** 直接退出到关卡屏 */
function quitToLevels() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.getElementById('modal-pause').classList.add('hidden');
  showScreen('level');
  refreshLevelScreen();
}
