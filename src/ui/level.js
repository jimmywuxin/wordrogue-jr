/**
 * Level Screen · 选关卡
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { LEVELS } from '../data/words.js';

let onSelectLevelCallback = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function initLevelScreen() {
  document.getElementById('btn-back-menu').addEventListener('click', () => {
    showScreen('menu');
  });

  document.getElementById('user-summary').addEventListener('click', () => {
    // 可点开看 user 摘要
  });
}

export function refreshLevelScreen() {
  const user = Storage.getCurrentUser();
  if (!user) return;
  showScreen('level');

  document.getElementById('level-title').textContent = `${user.name}的冒险`;
  const wrongCount = Storage.getWrongWords(user.id).length;
  const completedLevels = Object.values(Storage.data.progress[user.id].levelProgress)
    .filter(p => p.completed).length;
  document.getElementById('user-summary').textContent =
    `已通关 ${completedLevels}/${LEVELS.length} · 错词 ${wrongCount}`;

  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  // 难度过滤:根据用户年级显示
  const userGrade = user.grade;
  const filtered = LEVELS.filter(l => l.grade >= userGrade);

  let lastCompletedIdx = -1;
  for (let i = 0; i < filtered.length; i++) {
    const lv = filtered[i];
    const prog = Storage.getLevelProgress(user.id, lv.id);
    const isCompleted = prog?.completed;
    const isUnlocked = i <= lastCompletedIdx + 1;
    if (isCompleted) lastCompletedIdx = i;

    const card = document.createElement('div');
    card.className = `level-card ${isCompleted ? 'completed' : isUnlocked ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <span class="num">${i + 1}</span>
      <div class="stars">${'★'.repeat(prog?.stars || 0)}${'☆'.repeat(3 - (prog?.stars || 0))}</div>
      <div class="level-name" title="${escapeHtml(lv.name)}">${escapeHtml(lv.name)}</div>
    `;
    if (isUnlocked) {
      card.addEventListener('click', () => selectLevel(lv.id));
    }
    grid.appendChild(card);
  }
}

function selectLevel(levelId) {
  if (onSelectLevelCallback) onSelectLevelCallback(levelId);
}

export function setOnSelectLevelCallback(cb) {
  onSelectLevelCallback = cb;
}
