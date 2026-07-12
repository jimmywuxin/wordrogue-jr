/**
 * Modals · 弹窗逻辑(新建用户 / 总结 / 设置 / 确认)
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { refreshMenu } from './menu.js';
import { refreshLevelScreen } from './level.js';
import * as sfx from '../audio/sfx.js';

let onConfirmOk = null;

export function initModals() {
  // 新建用户
  document.getElementById('btn-cancel-user').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-new-user').classList.add('hidden');
  });

  document.getElementById('btn-confirm-user').addEventListener('click', () => {
    sfx.sfxClick();
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
    Storage.setCurrentUser(user.id);
    refreshLevelScreen();
  });

  // 总结弹窗
  document.getElementById('btn-retry').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-result').classList.add('hidden');
    window.dispatchEvent(new CustomEvent('retry-level'));
  });

  document.getElementById('btn-next-level').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-result').classList.add('hidden');
    window.dispatchEvent(new CustomEvent('next-level'));
  });

  document.getElementById('btn-back-levels').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-result').classList.add('hidden');
    showScreen('level');
  });

  // 设置入口(关卡屏 header)
  document.getElementById('btn-open-settings').addEventListener('click', () => {
    sfx.sfxClick();
    openSettings();
  });

  document.getElementById('btn-close-settings').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-settings').classList.add('hidden');
  });

  // 音效开关
  document.getElementById('setting-sound').addEventListener('change', (e) => {
    const on = e.target.checked;
    sfx.setEnabled(on);
    const u = Storage.getCurrentUser();
    if (u) Storage.setSetting(u.id, 'soundOn', on);
  });

  // 导出
  document.getElementById('btn-export').addEventListener('click', () => {
    sfx.sfxClick();
    const u = Storage.getCurrentUser();
    if (!u) return;
    Storage.exportAsDownload(u.name);
  });

  // 导入
  document.getElementById('btn-import').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await Storage.importFromFile(file);
      askConfirm(
        '导入成功',
        '已导入备份。要立即跳到主菜单加载新数据吗?',
        () => {
          location.reload();
        }
      );
    } catch (err) {
      alert('导入失败:文件格式不对\n' + err.message);
    }
    e.target.value = '';
  });

  // 重置进度
  document.getElementById('btn-reset-progress').addEventListener('click', () => {
    sfx.sfxClick();
    const u = Storage.getCurrentUser();
    if (!u) return;
    askConfirm(
      '重置进度',
      `确定要清空「${u.name}」的所有关卡进度、错词本、单词统计吗?\n角色本身会保留。`,
      () => {
        Storage.resetUserProgress(u.id);
        document.getElementById('modal-settings').classList.add('hidden');
        refreshLevelScreen();
      }
    );
  });

  // 删除角色
  document.getElementById('btn-delete-user').addEventListener('click', () => {
    sfx.sfxClick();
    const u = Storage.getCurrentUser();
    if (!u) return;
    askConfirm(
      '删除角色',
      `确定要永久删除「${u.name}」吗?\n所有进度、错词本都会丢失,无法恢复。`,
      () => {
        Storage.deleteUser(u.id);
        document.getElementById('modal-settings').classList.add('hidden');
        document.getElementById('modal-confirm').classList.add('hidden');
        showScreen('menu');
        refreshMenu();
      }
    );
  });

  // 通用确认弹窗
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-confirm').classList.add('hidden');
    onConfirmOk = null;
  });
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    sfx.sfxClick();
    document.getElementById('modal-confirm').classList.add('hidden');
    if (onConfirmOk) onConfirmOk();
    onConfirmOk = null;
  });
}

/** 显示总结弹窗 */
export function showResult(title, statsHtml, canNext) {
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-stats').innerHTML = statsHtml;
  document.getElementById('btn-next-level').style.display = canNext ? '' : 'none';
  document.getElementById('modal-result').classList.remove('hidden');
}

/** 打开设置模态,填好当前用户信息 */
function openSettings() {
  const u = Storage.getCurrentUser();
  if (!u) return;
  document.getElementById('settings-avatar').textContent = u.avatar || '👤';
  document.getElementById('settings-name').textContent = u.name;
  document.getElementById('setting-sound').checked = sfx.isEnabled();
  document.getElementById('modal-settings').classList.remove('hidden');
}

/** 通用确认弹窗 */
function askConfirm(title, body, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  onConfirmOk = onOk;
  document.getElementById('modal-confirm').classList.remove('hidden');
}
