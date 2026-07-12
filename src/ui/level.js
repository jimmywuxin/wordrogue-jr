/**
 * Level Screen · 选关卡
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { LEVELS } from '../data/words.js';
import * as sfx from '../audio/sfx.js';

let onSelectLevelCallback = null;
let onPlayWrongWordsCallback = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function initLevelScreen() {
  document.getElementById('btn-back-menu').addEventListener('click', () => {
    sfx.sfxClick();
    showScreen('menu');
  });

  const reviewBtn = document.getElementById('btn-open-review');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      sfx.sfxClick();
      import('./review.js').then(m => m.showReview());
    });
  }
}

export function refreshLevelScreen() {
  const user = Storage.getCurrentUser();
  if (!user) return;
  showScreen('level');

  document.getElementById('level-title').textContent = user.name + '的冒险';
  const wrongCount = Storage.getWrongWords(user.id).length;
  const completedLevels = Object.values(Storage.data.progress[user.id].levelProgress)
    .filter(p => p.completed).length;
  document.getElementById('user-summary').textContent =
    '已通关 ' + completedLevels + '/' + LEVELS.length + ' · 错词 ' + wrongCount;

  const reviewBtn = document.getElementById('btn-open-review');
  if (reviewBtn) {
    reviewBtn.style.display = wrongCount > 0 ? '' : 'none';
    reviewBtn.textContent = '📝 错词复习 (' + wrongCount + ')';
  }

  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  const userGrade = user.grade;
  const filtered = LEVELS.filter(l => l.grade >= userGrade);

  // === 顶部:错词挑战卡 ===
  if (wrongCount > 0) {
    const wc = document.createElement('div');
    wc.className = 'level-card wrong-mode';
    wc.innerHTML =
      '<div class="card-top">'
      + '<span class="theme-emoji">🎯</span>'
      + '<span class="mode-badge" style="background:#ffec27;color:#1a1c2c;border-color:#ffec27;">挑战</span>'
      + '</div>'
      + '<span class="num">!</span>'
      + '<div class="level-name">错词挑战 · 共 ' + wrongCount + ' 个</div>'
      + '<div class="muted" style="font-size:11px;margin-top:4px;">通关即可全部清除 ✓</div>';
    wc.addEventListener('click', () => {
      sfx.sfxClick();
      if (onPlayWrongWordsCallback) onPlayWrongWordsCallback();
    });
    grid.appendChild(wc);
  }

  // === 关卡卡 ===
  let lastCompletedIdx = -1;
  for (let i = 0; i < filtered.length; i++) {
    const prog = Storage.getLevelProgress(user.id, filtered[i].id);
    if (prog && prog.completed) lastCompletedIdx = i;
  }
  const grace = 2;

  const groups = {};
  for (const lv of filtered) {
    (groups[lv.grade] = groups[lv.grade] || []).push(lv);
  }
  const gradeBadge = { 4: '🎈', 5: '🎯', 6: '🚀' };
  const modeLabel = { choose: '看图', spell: '拼词' };

  let flatIndex = 0;
  for (const grade of Object.keys(groups).map(Number).sort((a, b) => a - b)) {
    const header = document.createElement('div');
    header.className = 'grade-header';
    header.innerHTML = '<span class="grade-badge">' + (gradeBadge[grade] || '📘') + '</span> ' + grade + ' 年级';
    grid.appendChild(header);

    for (const lv of groups[grade]) {
      const prog = Storage.getLevelProgress(user.id, lv.id);
      const isCompleted = prog && prog.completed;
      const isUnlocked = flatIndex <= Math.max(lastCompletedIdx + 1, grace);
      const theme = lv.theme || { emoji: '📘', label: lv.name };

      const card = document.createElement('div');
      card.className = 'level-card ' + (isCompleted ? 'completed' : isUnlocked ? 'unlocked' : 'locked');
      const stars = prog ? prog.stars : 0;
      card.innerHTML = '<div class="card-top">'
        + '<span class="theme-emoji">' + escapeHtml(theme.emoji) + '</span>'
        + '<span class="mode-badge mode-' + lv.mode + '">' + (modeLabel[lv.mode] || lv.mode) + '</span>'
        + '</div>'
        + '<span class="num">' + (flatIndex + 1) + '</span>'
        + '<div class="stars">' + '★'.repeat(stars) + '☆'.repeat(3 - stars) + '</div>'
        + '<div class="level-name" title="' + escapeHtml(theme.label) + '">' + escapeHtml(theme.label) + '</div>';
      if (isUnlocked) {
        card.addEventListener('click', () => {
          sfx.sfxClick();
          selectLevel(lv.id);
        });
      }
      grid.appendChild(card);
      flatIndex++;
    }
  }
}

function selectLevel(levelId) {
  if (onSelectLevelCallback) onSelectLevelCallback(levelId);
}

export function setOnSelectLevelCallback(cb) {
  onSelectLevelCallback = cb;
}

export function setOnPlayWrongWordsCallback(cb) {
  onPlayWrongWordsCallback = cb;
}
