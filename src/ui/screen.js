/**
 * Screen Switcher · 屏幕切换
 */

const SCREENS = ['menu', 'level', 'game', 'review'];

export function showScreen(name) {
  for (const id of SCREENS) {
    const el = document.getElementById(`${id}-screen`);
    if (el) {
      el.classList.toggle('hidden', id !== name);
    }
  }
  // 子模态框全部隐藏
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}
