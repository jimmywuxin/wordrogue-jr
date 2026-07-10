/**
 * Input · 输入处理(键盘 + 鼠标)
 */

export const Input = {
  keys: {},
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false },
  /** 上次按键(用于一次性触发) */
  pressed: {},

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      // 防止方向键滚动页面
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', () => this.mouse.down = true);
    canvas.addEventListener('mouseup', () => this.mouse.down = false);
    canvas.addEventListener('mouseleave', () => this.mouse.down = false);

    // 触屏(iPad)支持
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (t.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (t.clientY - rect.top) * (canvas.height / rect.height);
    }, { passive: false });
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (t.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (t.clientY - rect.top) * (canvas.height / rect.height);
      this.mouse.down = true;
    });
    canvas.addEventListener('touchend', () => this.mouse.down = false);
  },

  /** 是否按住方向 */
  isLeft() { return this.keys['KeyA'] || this.keys['ArrowLeft']; },
  isRight() { return this.keys['KeyD'] || this.keys['ArrowRight']; },
  isUp() { return this.keys['KeyW'] || this.keys['ArrowUp']; },
  isDown() { return this.keys['KeyS'] || this.keys['ArrowDown']; },

  /** 是否点了一次鼠标 / 触屏 */
  consumeClick() {
    if (this.mouse.down) {
      this.mouse.down = false;
      return true;
    }
    return false;
  },

  /** 单次按键(按下到松开算一次) */
  consumePress(code) {
    if (this.pressed[code]) {
      this.pressed[code] = false;
      return true;
    }
    return false;
  },

  /** 清空 pressed */
  clearPressed() {
    this.pressed = {};
  },
};
