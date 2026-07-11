/**
 * Modals · 弹窗逻辑
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { refreshMenu } from './menu.js';
import { refreshLevelScreen } from './level.js';

export function initModals() {
  // 新建用户
  document.getElementById('btn-cancel-user').addEventListener('click', () => {
    document.getElementById('modal-new-user').classList.add('hidden');
  });

  document.getElementById('btn-confirm-user').addEventListener('click', () => {
    const name = document.getElementById('new-name').value.trim();
    const grade = document.getElementById('new-grade').value;
    if (!name) {
      alert('请输入名字');
      return;
    }
    if (name.length > 8) {
      alert('名字太长了(最多 8 个字)');
      return;
    }
    const user = Storage.createUser(name, grade);
    document.getElementById('modal-new-user').classList.add('hidden');
    refreshMenu();
    // 自动选这个新用户
    Storage.setCurrentUser(user.id);
    refreshLevelScreen();
  });

  // 总结弹窗
  document.getElementById('btn-retry').addEventListener('click', () => {
    document.getElementById('modal-result').classList.add('hidden');
    // 由 game.js 监听自定义事件触发重启
    window.dispatchEvent(new CustomEvent('retry-level'));
  });

  document.getElementById('btn-next-level').addEventListener('click', () => {
    document.getElementById('modal-result').classList.add('hidden');
    window.dispatchEvent(new CustomEvent('next-level'));
  });

  document.getElementById('btn-back-levels').addEventListener('click', () => {
    document.getElementById('modal-result').classList.add('hidden');
    showScreen('level');
  });
}

/** 显示总结弹窗 */
export function showResult(title, statsHtml, canNext) {
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-stats').innerHTML = statsHtml;
  document.getElementById('btn-next-level').style.display = canNext ? '' : 'none';
  document.getElementById('modal-result').classList.remove('hidden');
}
