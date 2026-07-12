/**
 * Menu Screen · 主菜单(选人)
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { refreshLevelScreen } from './level.js';
import * as sfx from '../audio/sfx.js';

let longPressTimer = null;

export function initMenuScreen() {
  const list = document.getElementById('user-list');
  const btnNew = document.getElementById('btn-new-user');

  btnNew.addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-new-user').classList.remove('hidden');
    document.getElementById('new-name').value = '';
    document.getElementById('new-grade').value = '4';
    setTimeout(() => document.getElementById('new-name').focus(), 100);
  });

  renderUsers();
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
    const wrap = document.createElement('div');
    wrap.className = 'user-card-wrap';

    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
      <div class="avatar">${user.avatar}</div>
      <div class="name">${escapeHtml(user.name)}</div>
      <div class="grade-info">${gradeLabel(user.grade)}</div>
      <button class="delete-x" data-uid="${user.id}" title="删除">×</button>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-x')) return;
      sfx.sfxClick();
      selectUser(user.id);
    });

    // 长按显示删除(iPad/触屏友好)
    const startPress = () => {
      longPressTimer = setTimeout(() => {
        wrap.classList.add('long-press');
      }, 500);
    };
    const cancelPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    card.addEventListener('touchstart', startPress, { passive: true });
    card.addEventListener('touchend', cancelPress);
    card.addEventListener('touchmove', cancelPress);
    card.addEventListener('mousedown', startPress);
    card.addEventListener('mouseleave', cancelPress);
    card.addEventListener('mouseup', cancelPress);

    wrap.appendChild(card);
    list.appendChild(wrap);
  }

  // 委托删除按钮点击
  list.querySelectorAll('.delete-x').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sfx.sfxClick();
      const uid = btn.dataset.uid;
      const u = Storage.getUser(uid);
      if (!u) return;
      const ok = window.confirm(`确定要永久删除「${u.name}」吗?\n所有进度都会丢失。`);
      if (ok) {
        Storage.deleteUser(uid);
        renderUsers();
      }
    });
  });

  // 点击其它地方清除长按状态
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-card-wrap')) {
      document.querySelectorAll('.user-card-wrap.long-press').forEach(w => w.classList.remove('long-press'));
    }
  }, { once: false });
}

function selectUser(userId) {
  Storage.setCurrentUser(userId);
  showScreen('level');
  refreshLevelScreen();
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
