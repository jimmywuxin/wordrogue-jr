/**
 * WordRogue-Jr · 主入口
 * 协调各模块:启动菜单 → 选人 → 选关卡 → 游戏 → 总结
 */

import { Storage } from './save/storage.js';
import { initMenuScreen, refreshMenu } from './ui/menu.js';
import { initLevelScreen, refreshLevelScreen, setOnSelectLevelCallback, setOnPlayWrongWordsCallback } from './ui/level.js';
import { initGameScreen, startLevel, startWrongWords } from './ui/game.js';
import { initModals } from './ui/modals.js';
import { initReviewScreen, setOnPlayWrongCallback } from './ui/review.js';
import { unlockAudio, setEnabled as setSfxEnabled } from './audio/sfx.js';

// 等待 DOM 就绪
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 WordRogue-Jr 启动');

  // 加载存档(失败则初始化空存档)
  if (!Storage.load()) {
    Storage.init();
  }

  // 还原音效开关
  const u = Storage.getCurrentUser && Storage.getCurrentUser();
  if (u) {
    const settings = Storage.data.progress[u.id]?.settings;
    if (settings && typeof settings.soundOn === 'boolean') {
      setSfxEnabled(settings.soundOn);
    }
  }

  // 启动各屏幕
  initMenuScreen();
  initLevelScreen();
  initGameScreen();
  initModals();
  initReviewScreen();

  // 关卡屏 → 游戏屏回调
  setOnSelectLevelCallback((levelId) => {
    startLevel(levelId);
  });
  setOnPlayWrongWordsCallback(() => {
    startWrongWords();
  });
  setOnPlayWrongCallback(() => {
    startWrongWords();
  });

  // iOS Safari:首次交互解锁音频
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });

  console.log('✓ 所有屏幕就绪');
});
