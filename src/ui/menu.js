/**
 * Menu Screen · 主菜单(选人)
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { refreshLevelScreen } from './level.js';

let onSelectCallback = null;

export function initMenuScreen() {
  const list = document.getElementById('user-list');
  const btnNew = document.getElementById('btn-new-user');

  btnNew.addEventListener('click', () => {
    document.getElementById('modal-new-user').classList.remove('hidden');
    document.getElementById('new-name').value = '';
    document.getElementById('new-grade').value = '4';
    setTimeout(() => document.getElementById('new-name').focus(), 100);
  });

  renderUsers();

  // 默认显示菜单
  showScreen('menu');
}

function renderUsers() {
  const list = document.getElementById('user-list');
  const users = Storage.listUsers();

  if (users.length === 0) {
    list.innerHTML = '<p class="muted" style="grid-column: 1/-1; text-align:center;">还没有角色,点击下面"新建角色"开始</p>';
    return;
  }

  list.innerHTML = '';
  for (const user of users) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
      <div class="avatar">${user.avatar}</div>
      <div class="name">${escapeHtml(user.name)}</div>
      <div class="grade-info">${gradeLabel(user.grade)}</div>
    `;
    card.addEventListener('click', () => selectUser(user.id));
    list.appendChild(card);
  }
}

function selectUser(userId) {
  Storage.setCurrentUser(userId);
  showScreen('level');
  refreshLevelScreen();
  if (onSelectCallback) onSelectCallback(userId);
}

export function refreshMenu() {
  renderUsers();
}

function gradeLabel(g) {
  return { 4: '四年级', 5: '五年级', 6: '六年级' }[g] || '?';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
