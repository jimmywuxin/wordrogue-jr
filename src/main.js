/**
 * WordRogue-Jr · 主入口
 * 协调各模块:启动菜单 → 选人 → 选关卡 → 游戏 → 总结
 */

import { Storage } from './save/storage.js';
import { initMenuScreen, refreshMenu } from './ui/menu.js';
import { initLevelScreen, refreshLevelScreen, setOnSelectLevelCallback } from './ui/level.js';
import { initGameScreen, startLevel } from './ui/game.js';
import { initModals } from './ui/modals.js';
import { initReviewScreen } from './ui/review.js';

// 监听菜单中"用户点击某张人物卡"的事件
window.addEventListener('click', (e) => {
  const card = e.target.closest('.user-card');
  if (card && document.getElementById('menu-screen') === e.target.closest('.screen:not(.hidden)')) {
    // 由 menu.js 处理选中后跳转到关卡屏
  }
});

// 等待 DOM 就绪
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 WordRogue-Jr 启动');

  // 加载存档(失败则初始化空存档)
  if (!Storage.load()) {
    Storage.init();
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

  console.log('✓ 所有屏幕就绪');

  // 默认每分钟自动刷新菜单和关卡屏(确保新用户/进度及时反映)
  setInterval(() => {
    // 不强刷,只在用户操作时再刷新
  }, 60000);
});
