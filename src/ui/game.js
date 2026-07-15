/**
 * Game Screen · 协调游戏引擎 + UI
 *
 * 适配 roguelike 引擎: 房间推进 / 奖励卡三选一 / 道具栏 HUD / 连击
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { LEVELS, getDistractors } from '../data/words.js';
import { Game } from '../engine/game.js';
import { Input } from '../engine/input.js';
import { showResult } from './modals.js';
import { refreshLevelScreen } from './level.js';
import * as sfx from '../audio/sfx.js';

let game = null;
let rafId = null;
let currentLevel = null;
let lastTick = 0;
let phase = 'choose'; // choose / spell
let sessionMissed = [];
let wasBusy = false;
let prevState = null;

/** 按比例缩放 canvas 到 canvas-wrap 可用空间, 保持 3:2 不变形 */
function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  const canvas = document.getElementById('game-canvas');
  if (!wrap || !canvas) return;
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  if (wrapW === 0 || wrapH === 0) return;
  const ratio = 960 / 640; // 3:2
  let w = wrapW, h = wrapW / ratio;
  if (h > wrapH) { h = wrapH; w = wrapH * ratio; }
  canvas.style.width = Math.floor(w) + 'px';
  canvas.style.height = Math.floor(h) + 'px';
}

export function initGameScreen() {
  const canvas = document.getElementById('game-canvas');
  game = new Game(canvas);

  window.addEventListener('resize', resizeCanvas);

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
    const value = spellInput.value.trim();
    if (!value || !game.currentWord) return;
    submitAnswerUI(value);
    spellInput.value = '';
  }

  submitBtn.addEventListener('click', () => {
    sfx.sfxClick();
    submitSpell();
  });
  spellInput.addEventListener('keydown', (e) => {
    // 方向键: 手动驱动角色移动, 阻止光标在输入框内移动
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
      if (!Input.keys[e.code]) Input.pressed[e.code] = true;
      Input.keys[e.code] = true;
    }
    // 阻止冒泡到 window, 彻底避免 input.js(任何版本)拦截字母/空格
    e.stopPropagation();
    if (e.key === 'Enter') {
      submitSpell();
    }
  });

  document.getElementById('btn-spell-skip').addEventListener('click', () => {
    sfx.sfxSkip();
    if (game.currentWord) {
      sessionMissed.push(game.currentWord);
      Storage.recordWordResult(Storage.getCurrentUser().id, game.currentWord.word, false);
      game.combo = 0;
      game._selectNextTarget();
      showNextQuestion();
    }
  });

  // 奖励卡点击
  document.getElementById('reward-cards').addEventListener('click', (e) => {
    const card = e.target.closest('.reward-card');
    if (!card) return;
    const idx = parseInt(card.dataset.idx, 10);
    sfx.sfxClick();
    game.chooseReward(idx);
    document.getElementById('modal-reward').classList.add('hidden');
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
  const targetWord = game.currentWord?.word;
  const targetMeaning = game.currentWord?.meaning;
  const targetImage = game.currentWord?.image;
  game.submitAnswer(word);
  if (word !== targetWord && targetWord) {
    sessionMissed.push({
      word: targetWord,
      meaning: targetMeaning,
      image: targetImage,
    });
  }
  if (game.busy) {
    lockQuizUI();
  } else {
    showNextQuestion();
  }
}

function lockQuizUI() {
  Input.typing = false;
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
  Input.typing = (phase === 'spell');
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
    mode: 'spell',
    wordCount: 0,
    theme: { emoji: '🎯', label: '错词挑战' },
    isWrongWords: true,
  };
  _doStart();
}

function _doStart() {
  showScreen('game');
  requestAnimationFrame(resizeCanvas);
  if (currentLevel.isWrongWords) {
    const ok = game.loadWrongWords();
    if (!ok) {
      showScreen('level');
      refreshLevelScreen();
      return;
    }
  } else {
    game.loadLevel(currentLevel.id);
  }
  sessionMissed = [];
  prevState = null;

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
    handleStateChange();

    if (!game.busy && game.state === 'playing') {
      unlockQuizUI();
      if (wasBusy) {
        wasBusy = false;
        showNextQuestion();
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

/** 检测引擎状态变化,驱动 UI */
function handleStateChange() {
  if (game.state === prevState) return;
  const entered = game.state;

  if (entered === 'rewardChoice') {
    showRewardModal();
  } else if (entered === 'roomClear') {
    // 房间清空过渡:隐藏答题面板
    document.getElementById('quiz-panel').classList.add('hidden');
    document.getElementById('spell-panel').classList.add('hidden');
    requestAnimationFrame(resizeCanvas);
  } else if (entered === 'playing' && prevState === 'rewardChoice') {
    // 奖励选完回到战斗
    showNextQuestion();
  } else if (entered === 'playing' && prevState === 'roomClear') {
    // 新房间开始
    showNextQuestion();
  }

  prevState = entered;
}

function showRewardModal() {
  const rewards = game.pendingRewards;
  if (!rewards) return;
  const container = document.getElementById('reward-cards');
  container.innerHTML = '';
  for (let i = 0; i < rewards.length; i++) {
    const r = rewards[i];
    const card = document.createElement('div');
    card.className = 'reward-card';
    card.dataset.idx = i;
    card.innerHTML = `
      <div class="reward-icon">${r.icon}</div>
      <div class="reward-label">${r.label}</div>
      <div class="reward-desc">${r.desc}</div>
      <div class="reward-key">按 ${i + 1}</div>
    `;
    container.appendChild(card);
  }
  document.getElementById('modal-reward').classList.remove('hidden');
}

/** 渲染当前题目面板 */
function showNextQuestion() {
  if (!game || !game.currentWord) return;
  if (game.state !== 'playing') return;
  const w = game.currentWord;

  if (phase === 'choose') {
    Input.typing = false;
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
    Input.typing = true;
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
  requestAnimationFrame(resizeCanvas);
}

function updateHUD() {
  if (!game) return;
  document.getElementById('hud-hp').textContent = game.player.hp;
  document.getElementById('hud-progress').textContent = `${game.killed}/${game.total}`;

  // 道具栏
  const pw = game.powerups;
  const pwEl = document.getElementById('hud-powerups');
  if (pwEl) {
    let html = '';
    if (pw.shield > 0) html += `<span class="pw-badge pw-shield">🛡️ ${Math.ceil(pw.shield / 60)}s</span>`;
    if (pw.speed > 0) html += `<span class="pw-badge pw-speed">👟 ${Math.ceil(pw.speed / 60)}s</span>`;
    if (game.combo >= 2) html += `<span class="pw-badge pw-combo">🔥 x${game.combo}</span>`;
    pwEl.innerHTML = html;
  }
}

function finishLevel() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  // 隐藏答题面板
  Input.typing = false;
  document.getElementById('quiz-panel').classList.add('hidden');
  document.getElementById('spell-panel').classList.add('hidden');

  const userId = Storage.getCurrentUser().id;
  const isCleared = game.state === 'cleared';
  const accuracy = game.total > 0 ? Math.round((game.killed / game.total) * 100) : 0;

  // 星数
  let stars = 0;
  if (isCleared) stars = 1;
  if (isCleared && game.player.hp >= game.player.maxHp * 0.7) stars = 2;
  if (isCleared && game.player.hp >= game.player.maxHp * 0.9 && accuracy >= 90) stars = 3;

  // 失败时,剩余怪记入漏词
  if (!isCleared) {
    for (const e of game.enemies) {
      if (e.hp > 0 && !e.dying) {
        sessionMissed.push({ word: e.word, meaning: e.meaning, image: e.image });
      }
    }
    // 剩余未出场房间词也记入
    for (const w of game.remainingWords) {
      sessionMissed.push({ word: w.word, meaning: w.meaning, image: w.image });
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
      <div class="stat-cell">🔥 最高连击</div><div class="stat-val">x${game.maxCombo}</div>
      <div class="stat-cell">🏠 通关房间</div><div class="stat-val">${isCleared ? game.maxRooms : game.room - 1}/${game.maxRooms}</div>
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
  Input.typing = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.getElementById('modal-pause').classList.remove('hidden');
}

/** 恢复 */
export function resumeGame() {
  document.getElementById('modal-pause').classList.add('hidden');
  requestAnimationFrame(resizeCanvas);
  lastTick = performance.now();
  const loop = (now) => {
    const dt = Math.min(40, now - lastTick);
    lastTick = now;
    game.update(dt);
    game.render();
    updateHUD();
    handleStateChange();

    if (!game.busy && game.state === 'playing') {
      unlockQuizUI();
      if (wasBusy) {
        wasBusy = false;
        showNextQuestion();
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
  Input.typing = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.getElementById('modal-pause').classList.add('hidden');
  showScreen('level');
  refreshLevelScreen();
}
