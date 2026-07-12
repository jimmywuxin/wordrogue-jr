/**
 * SFX · Web Audio API 合成的短音效
 * 不依赖外部音频文件,直接用 OscillatorNode 合成
 */

let ctx = null;
let masterGain = null;
let enabled = true;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.35;
  masterGain.connect(ctx.destination);
  return ctx;
}

/** 用户首次交互后调用,解锁 iOS Safari 音频限制 */
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
}

export function setEnabled(on) {
  enabled = !!on;
  if (masterGain) {
    masterGain.gain.value = enabled ? 0.35 : 0;
  }
}

export function isEnabled() {
  return enabled;
}

/** 播放一个音调 */
function tone({ freq, dur, type = 'square', vol = 0.4, slideTo = null, delay = 0 }) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  }
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 命中(怪物被射爆) */
export function sfxHit() {
  if (!enabled) return;
  tone({ freq: 600, dur: 0.08, type: 'square', vol: 0.35, slideTo: 200 });
  tone({ freq: 120, dur: 0.18, type: 'triangle', vol: 0.45, delay: 0.04, slideTo: 40 });
}

/** 发射 */
export function sfxShoot() {
  if (!enabled) return;
  tone({ freq: 980, dur: 0.06, type: 'square', vol: 0.18, slideTo: 380 });
}

/** 答错 */
export function sfxWrong() {
  if (!enabled) return;
  tone({ freq: 320, dur: 0.1, type: 'square', vol: 0.3, slideTo: 180 });
  tone({ freq: 240, dur: 0.18, type: 'square', vol: 0.3, delay: 0.1, slideTo: 100 });
}

/** 跳过 */
export function sfxSkip() {
  if (!enabled) return;
  tone({ freq: 220, dur: 0.05, type: 'sine', vol: 0.18, slideTo: 140 });
}

/** 怪物撞玩家 */
export function sfxHurt() {
  if (!enabled) return;
  tone({ freq: 220, dur: 0.12, type: 'square', vol: 0.35, slideTo: 80 });
}

/** 通关 */
export function sfxWin() {
  if (!enabled) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    tone({ freq: f, dur: 0.14, type: 'triangle', vol: 0.4, delay: i * 0.1 });
  });
}

/** 失败 */
export function sfxLose() {
  if (!enabled) return;
  tone({ freq: 392, dur: 0.18, type: 'sawtooth', vol: 0.3, slideTo: 196 });
  tone({ freq: 196, dur: 0.32, type: 'sawtooth', vol: 0.3, slideTo: 98, delay: 0.18 });
}

/** 按钮点击 */
export function sfxClick() {
  if (!enabled) return;
  tone({ freq: 880, dur: 0.03, type: 'square', vol: 0.18 });
}
