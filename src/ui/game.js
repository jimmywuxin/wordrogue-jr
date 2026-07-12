/**
 * Game Screen · 协调游戏引擎 + UI
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { LEVELS, getDistractors } from '../data/words.js';
import { Game } from '../engine/game.js';
import { showResult } from './modals.js';
import { refreshLevelScreen } from './level.js';
import * as sfx from '../audio/sfx.js';

let game = null;
let rafId = null;
let currentLevel = null;
let lastTick = 0;
let phase = 'choose'; // choose / spell
let sessionMissed = [];  // 本关漏词清单(用于结果页)
let wasBusy = false;

export function initGameScreen() {
  const canvas = document.getElementById('game-canvas');
  game = new Game(canvas);

  document.getElementById('btn-pause').addEventListener('click', () => {
    sfx.sfxClick();
    pauseGame();
  });

  document.getElementById('btn-resume').addEventListener('click', () => {
    sfx.sfxClick();
    resumeGame();
  });

  document.getElementById('btn-pause-retry').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-pause').classList.add('hidden');
    startLevel(currentLevel.id);
  });

  document.getElementById('btn-pause-back').addEventListener('click', () => {
    sfx.sfxClick();
    quitToLevels();
  });

  // 选词点击
  document.getElementById('quiz-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.quiz-option');
    if (!btn || btn.disabled) return;
    const word = btn.dataset.word;
    submitAnswerUI(word);
  });

  // 拼词回车 + 按钮
  const spellInput = document.getElementById('spell-input');
  const submitBtn = document.getElementById('btn-spell-submit');

  function submitSpell() {
    const value = spellInput.value.trim().toLowerCase();
    if (!value || !game.currentWord) return;
    submitAnswerUI(value);
    spellInput.value = '';
  }

  submitBtn.addEventListener('click', () => {
    sfx.sfxClick();
    submitSpell();
  });
  spellInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitSpell();
    }
  });

  document.getElementById('btn-spell-skip').addEventListener('click', () => {
    sfx.sfxSkip();
    if (game.currentWord) {
      // 跳过 = 不知道,记错词 + 入本关漏词
      sessionMissed.push(game.currentWord);
      Storage.recordWordResult(Storage.getCurrentUser().id, game.currentWord.word, false);
      game._selectNextTarget();
      showNextQuestion();
    }
  });

  // 监听 retry / next 事件
  window.addEventListener('retry-level', () => {
    sfx.sfxClick();
    startLevel(currentLevel.id);
  });
  window.addEventListener('next-level', () => {
    sfx.sfxClick();
    if (!currentLevel) return;
    const nextIdx = LEVELS.findIndex(l => l.id === currentLevel.id) + 1;
    if (nextIdx < LEVELS.length) {
      const next = LEVELS[nextIdx];
      startLevel(next.id);
      currentLevel = next;
    } else {
      showScreen('level');
    }
  });
}

/** UI 层包装:在 engine 之外加 busy 锁、漏词追踪、按钮禁用 */
function submitAnswerUI(word) {
  if (game.busy || game.state !== 'playing') return;
  // 答前快照当前目标,若答错就把它记入 sessionMissed
  const targetWord = game.currentWord?.word;
  const targetMeaning = game.currentWord?.meaning;
  const targetImage = game.currentWord?.image;
  game.submitAnswer(word);
  if (word !== targetWord && targetWord) {
    // 答错
    sessionMissed.push({
      word: targetWord,
      meaning: targetMeaning,
      image: targetImage,
    });
  }
  if (game.busy) {
    // 答对:等击杀动画结束再切下一题
    lockQuizUI();
  } else {
    // 答错:engine 已立即换下一题,刷新 UI
    showNextQuestion();
  }
}

function lockQuizUI() {
  document.querySelectorAll('.quiz-option').forEach(b => {
    b.disabled = true;
    b.style.opacity = '0.5';
  });
  document.getElementById('spell-input').disabled = true;
  document.getElementById('btn-spell-submit').disabled = true;
}

function unlockQuizUI() {
  document.querySelectorAll('.quiz-option').forEach(b => {
    b.disabled = false;
    b.style.opacity = '';
  });
  document.getElementById('spell-input').disabled = false;
  document.getElementById('btn-spell-submit').disabled = false;
}

/** 从关卡屏点进游戏时调用 */
export function startLevel(levelId) {
  currentLevel = LEVELS.find(l => l.id === levelId);
  if (!currentLevel) return;
  _doStart();
}

/** 错词挑战模式 */
export function startWrongWords() {
  currentLevel = {
    id: 'wrong-words',
    name: '错词挑战',
    mode: 'spell',  // 拼词模式更有挑战性
    wordCount: 0,
    theme: { emoji: '🎯', label: '错词挑战' },
    isWrongWords: true,
  };
  _doStart();
}

function _doStart() {
  showScreen('game');
  if (currentLevel.isWrongWords) {
    const ok = game.loadWrongWords();
    if (!ok) {
      // 错词本被玩空
      showScreen('level');
      refreshLevelScreen();
      return;
    }
  } else {
    game.loadLevel(currentLevel.id);
  }
  sessionMissed = [];

  document.getElementById('hud-hp').textContent = game.player.hp;
  document.getElementById('hud-progress').textContent = `0/${game.total}`;
  document.getElementById('hud-mode').textContent =
    currentLevel.mode === 'spell' ? '拼词模式' : '看图选词';

  phase = currentLevel.mode;
  showNextQuestion();

  lastTick = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  const loop = (now) => {
    const dt = Math.min(40, now - lastTick);
    lastTick = now;
    game.update(dt);
    game.render();
    updateHUD();

    if (!game.busy) {
      unlockQuizUI();
      if (wasBusy) {
        wasBusy = false;
        // 击杀动画结束,刷新题目
        if (game.state === 'playing') showNextQuestion();
      }
    } else {
      wasBusy = true;
    }

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
    setTimeout(() => {
      const el = document.getElementById('spell-input');
      if (el && !document.getElementById('spell-panel').classList.contains('hidden')) {
        el.focus();
      }
    }, 50);
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

  // 星数:通关 +1,半血以上 +2,满血 100%命中 +3
  let stars = 0;
  if (isCleared) stars = 1;
  if (isCleared && game.player.hp >= game.player.maxHp * 0.7) stars = 2;
  if (isCleared && game.player.hp === game.player.maxHp && accuracy === 100) stars = 3;

  // 失败时,把场上还没被打的怪都记入漏词
  if (!isCleared) {
    for (const e of game.enemies) {
      if (e.hp > 0 && !e.dying) {
        sessionMissed.push({
          word: e.word, meaning: e.meaning, image: e.image,
        });
      }
    }
  }

  Storage.setLevelProgress(userId, currentLevel.id, {
    score: accuracy,
    stars,
    completed: isCleared,
  });

  let title;
  if (currentLevel.isWrongWords) {
    title = isCleared ? '🎉 错词全部清光!' : '💔 还剩些词';
  } else {
    title = isCleared ? '🎉 关卡完成!' : '💔 失败';
  }
  const stats = renderStats(stars, accuracy, isCleared);

  const nextIdx = LEVELS.findIndex(l => l.id === currentLevel.id) + 1;
  const canNext = nextIdx < LEVELS.length;
  showResult(title, stats, canNext);

  refreshLevelScreen();
}

function renderStats(stars, accuracy, isCleared) {
  const wrongTotal = Storage.getWrongWords(Storage.getCurrentUser().id).length;
  // 去重展示漏词
  const seen = new Set();
  const missed = sessionMissed.filter(w => {
    if (seen.has(w.word)) return false;
    seen.add(w.word);
    return true;
  });

  let html = `
    <div style="text-align:center;margin:12px 0 8px;">
      <div style="font-size:36px;color:#ffec27;letter-spacing:2px;">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div class="stat-cell">❤️ 剩余血量</div><div class="stat-val">${game.player.hp}/${game.player.maxHp}</div>
      <div class="stat-cell">🎯 命中率</div><div class="stat-val">${accuracy}%</div>
      <div class="stat-cell">📚 错词本</div><div class="stat-val">${wrongTotal} 个</div>
      <div class="stat-cell">📝 本关漏词</div><div class="stat-val">${missed.length} 个</div>
    </div>
  `;

  if (missed.length > 0) {
    html += `<div style="margin-top:8px;"><div class="muted" style="margin-bottom:6px;">本关没掌握的词:</div>`;
    html += `<div class="missed-words">`;
    for (const w of missed.slice(0, 12)) {
      html += `<div class="missed-chip"><span style="font-size:18px;">${w.image}</span><span>${escapeHtml(w.word)}</span><span class="muted" style="font-size:11px;">${escapeHtml(w.meaning)}</span></div>`;
    }
    if (missed.length > 12) {
      html += `<div class="muted" style="padding:8px;">+${missed.length - 12} 更多…</div>`;
    }
    html += `</div></div>`;
  } else if (isCleared) {
    html += `<div style="text-align:center;color:#38b764;font-size:18px;margin-top:8px;">全对通关!🎊</div>`;
  }

  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** 暂停 */
export function pauseGame() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.getElementById('modal-pause').classList.remove('hidden');
}

/** 恢复 */
export function resumeGame() {
  document.getElementById('modal-pause').classList.add('hidden');
  lastTick = performance.now();
  const loop = (now) => {
    const dt = Math.min(40, now - lastTick);
    lastTick = now;
    game.update(dt);
    game.render();
    updateHUD();
    if (!game.busy) {
      unlockQuizUI();
      if (wasBusy) {
        wasBusy = false;
        // 击杀动画结束,刷新题目
        if (game.state === 'playing') showNextQuestion();
      }
    } else {
      wasBusy = true;
    }
    if (game.state === 'cleared' || game.state === 'failed') {
      finishLevel();
      return;
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
  setTimeout(() => {
    const el = document.getElementById('spell-input');
    if (el && !document.getElementById('spell-panel').classList.contains('hidden')) {
      el.focus();
    }
  }, 50);
}

function quitToLevels() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.getElementById('modal-pause').classList.add('hidden');
  showScreen('level');
  refreshLevelScreen();
}
