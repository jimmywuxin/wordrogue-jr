/**
 * Game Engine · 顶视角射击核心循环
 *
 * 设计:
 * - 玩家在中央,可 WASD 移动
 * - 鼠标瞄准,提交答案触发"击杀"动画(bullet 从玩家飞向目标怪)
 * - 答对所有怪 = 通关,答错累计扣血
 */

import { Input } from './input.js';
import { Storage } from '../save/storage.js';
import { selectLevelWords, WORDS } from '../data/words.js';
import * as sfx from '../audio/sfx.js';

const CANVAS_W = 960;
const CANVAS_H = 640;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 0.5;
const ENEMY_HP = 1;
const BULLET_DURATION = 16; // 帧数,约 270ms @60fps

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    Input.init(canvas);

    this.player = {
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      size: 24,
      hp: 10,
      maxHp: 10,
      flashTime: 0,
      shakeTime: 0,
    };

    this.bullets = [];      // 击杀子弹(从玩家飞到目标怪)
    this.enemies = [];      // 敌人
    this.particles = [];    // 命中粒子效果
    this.floats = [];       // 飘字 +1 / -1
    this.words = [];        // 当前关卡词库

    this.currentWord = null;     // 当前要拼/选的目标词
    this.aliveEnemies = 0;
    this.killed = 0;
    this.total = 0;
    this.timer = 0;
    this.state = 'playing'; // playing / cleared / failed
    this.levelId = null;
    this.busy = false;           // 击杀动画进行中(锁定答题)
  }

  /** 装载关卡 */
  loadLevel(levelId) {
    this.levelId = levelId;
    const _u = Storage.getCurrentUser();
    this.words = selectLevelWords(levelId, _u ? Storage.getWrongWords(_u.id) : []);
    if (this.words.length === 0) {
      console.error('关卡无词:', levelId);
      return;
    }
    this._setupEnemies();
  }

  /** 错词挑战模式:直接拿用户的错词本 */
  loadWrongWords() {
    this.levelId = 'wrong-words';
    const _u = Storage.getCurrentUser();
    if (!_u) return;
    const wrongList = Storage.getWrongWords(_u.id);
    this.words = WORDS.filter(w => wrongList.includes(w.word));
    if (this.words.length === 0) {
      console.warn('错词本为空,无法进入错词模式');
      return false;
    }
    this._setupEnemies();
    return true;
  }

  _setupEnemies() {
    this.total = this.words.length;
    this.killed = 0;
    this.timer = 0;
    this.state = 'playing';
    this.busy = false;
    this.player.hp = this.player.maxHp;
    this.player.x = CANVAS_W / 2;
    this.player.y = CANVAS_H / 2;

    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.floats = [];

    for (let i = 0; i < this.words.length; i++) {
      const w = this.words[i];
      this.enemies.push(this._spawnEnemy(w, i));
    }
    this.aliveEnemies = this.enemies.length;

    this._selectNextTarget();
  }

  _spawnEnemy(word, idx) {
    // 把怪错落撒在中央矩形区域内(避开玩家出生点),
    // 而不是只 4 个角,词多了能错开分布。
    const margin = 90;
    const innerW = CANVAS_W - margin * 2;
    const innerH = CANVAS_H - margin * 2 - 60; // 留出底部题目条
    // 用 idx + 一点抖动做确定性分布,保证可复现
    const cols = Math.ceil(Math.sqrt(this.words.length || 1));
    const rows = Math.ceil((this.words.length || 1) / cols);
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const cellW = innerW / cols;
    const cellH = innerH / rows;
    const baseX = margin + cellW * (c + 0.5);
    const baseY = margin + 60 + cellH * (r + 0.5); // 60 给顶部条留位置
    const jitter = 14;
    const x = baseX + (Math.random() - 0.5) * jitter;
    const y = baseY + (Math.random() - 0.5) * jitter;

    return {
      word: word.word,
      meaning: word.meaning,
      image: word.image,
      x, y,
      size: 36,
      hp: ENEMY_HP,
      maxHp: ENEMY_HP,
      bornAt: this.timer,
      wobble: Math.random() * Math.PI * 2,
      dying: false,        // 正在被击杀(子弹飞行中)
      dyingT: 0,           // 死亡动画进度
      pulseT: 0,           // 高亮当前目标怪
      isTarget: false,
    };
  }

  /** 选择下一个目标词 */
  _selectNextTarget() {
    const userId = Storage.getCurrentUser()?.id;
    if (!userId) return;

    // 清除旧目标的高亮
    for (const e of this.enemies) e.isTarget = false;

    const wrongWords = Storage.getWrongWords(userId);
    const wrongsInLevel = this.words.filter(w => wrongWords.includes(w.word));
    const aliveWrongs = wrongsInLevel.filter(w =>
      this.enemies.some(e => e.word === w.word && e.hp > 0 && !e.dying)
    );
    const aliveAll = this.enemies
      .filter(e => e.hp > 0 && !e.dying)
      .map(e => this.words.find(w => w.word === e.word))
      .filter(Boolean);

    const candidates = aliveWrongs.length > 0 ? aliveWrongs : aliveAll;
    if (candidates.length === 0) {
      this.currentWord = null;
      return;
    }
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    this.currentWord = next;

    // 高亮对应怪
    const targetEnemy = this.enemies.find(e => e.word === next.word && e.hp > 0);
    if (targetEnemy) {
      targetEnemy.isTarget = true;
      targetEnemy.pulseT = 0;
    }
  }

  /** 处理用户提交的答案 */
  submitAnswer(submittedWord) {
    if (!this.currentWord || this.busy) return;
    const userId = Storage.getCurrentUser()?.id;
    if (!userId) return;

    if (submittedWord === this.currentWord.word) {
      // 答对:找一个活着的怪(优先当前目标怪的同词)
      const enemy = this.enemies.find(
        e => e.word === submittedWord && e.hp > 0 && !e.dying
      );
      if (enemy) {
        enemy.dying = true;
        this.busy = true;
        this.bullets.push({
          x: this.player.x,
          y: this.player.y,
          tx: enemy.x,
          ty: enemy.y,
          text: submittedWord,
          progress: 0,
          life: BULLET_DURATION,
          target: enemy,
          trail: [],
        });
        sfx.sfxShoot();
        // 不在这里记录成绩,等命中再记(防止动画中途用户取消)
      } else {
        // 没找到怪(极端):直接下一题
        this._selectNextTarget();
      }
    } else {
      // 答错
      this.player.hp = Math.max(0, this.player.hp - 1);
      this.player.flashTime = 10;
      this.player.shakeTime = 14;
      this._spawnFloat('✗', this.player.x, this.player.y - 20, '#ff6b6b');
      sfx.sfxWrong();
      if (this.currentWord) {
        Storage.recordWordResult(userId, this.currentWord.word, false);
      }
      // 立即换下一题
      this._selectNextTarget();
    }
  }

  /** 兼容旧调用入口 */
  fireBullet(text) {
    this.submitAnswer(text);
  }

  _spawnParticles(x, y, content, isEmoji = false, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5 - 2,
        life: 36,
        maxLife: 36,
        content,
        isEmoji,
        size: isEmoji ? 20 : 4,
      });
    }
  }

  _spawnFloat(text, x, y, color) {
    this.floats.push({ text, x, y, life: 36, color });
  }

  /** 主循环一步(被外部 requestAnimationFrame 调用) */
  update(dt) {
    this.timer += dt;

    // 玩家移动
    let dx = 0, dy = 0;
    if (Input.isLeft()) dx -= 1;
    if (Input.isRight()) dx += 1;
    if (Input.isUp()) dy -= 1;
    if (Input.isDown()) dy += 1;
    const mag = Math.hypot(dx, dy) || 1;
    this.player.x += (dx / mag) * PLAYER_SPEED * (dt / 16);
    this.player.y += (dy / mag) * PLAYER_SPEED * (dt / 16);
    this.player.x = Math.max(this.player.size, Math.min(CANVAS_W - this.player.size, this.player.x));
    this.player.y = Math.max(this.player.size, Math.min(CANVAS_H - this.player.size, this.player.y));

    if (this.player.flashTime > 0) this.player.flashTime--;
    if (this.player.shakeTime > 0) this.player.shakeTime--;

    // 击杀子弹
    for (const b of this.bullets) {
      b.progress += 1 / b.life;
      // trail
      b.trail.push({ x: b.x, y: b.y, life: 12 });
      b.x = this.player.x + (b.tx - this.player.x) * b.progress;
      b.y = this.player.y + (b.ty - this.player.y) * b.progress;
      b.life--;
      if (b.progress >= 1 && b.target) {
        // 命中
        const e = b.target;
        e.hp = 0;
        e.dyingT = 1;
        this.killed++;
        this._spawnParticles(e.x, e.y, '#ffec27', false, 8);
        this._spawnParticles(e.x, e.y, e.image, true, 4);
        this._spawnFloat('+1', e.x, e.y - 18, '#ffec27');
        sfx.sfxHit();
        Storage.recordWordResult(Storage.getCurrentUser().id, e.word, true);
        b.target = null; // 标记已处理
      }
    }
    // 清理已结束的子弹
    this.bullets = this.bullets.filter(b => {
      // 清理 trail
      b.trail = b.trail.filter(t => { t.life--; return t.life > 0; });
      return b.life > 0;
    });

    // 当所有击杀子弹都走完,推进下一题
    if (this.busy && this.bullets.length === 0) {
      this.busy = false;
      // 检查清关
      this.aliveEnemies = this.enemies.filter(e => e.hp > 0 && !e.dying).length;
      if (this.aliveEnemies === 0 && this.state === 'playing') {
        this.state = 'cleared';
        sfx.sfxWin();
      } else {
        this._selectNextTarget();
      }
    }

    // 敌人慢慢飘向玩家
    for (const e of this.enemies) {
      if (e.hp > 0 && !e.dying) {
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        e.x += Math.cos(angle) * ENEMY_SPEED * (dt / 16);
        e.y += Math.sin(angle) * ENEMY_SPEED * (dt / 16);
        // 不能离玩家太近
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if (d < e.size + this.player.size + 8) {
          e.x -= Math.cos(angle) * 4;
          e.y -= Math.sin(angle) * 4;
        }
      }
      e.wobble += 0.05;
      if (e.isTarget) e.pulseT += 0.08;
    }

    // 粒子
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life--;
      return p.life > 0;
    });

    // 飘字
    this.floats = this.floats.filter(f => {
      f.y -= 0.6;
      f.life--;
      return f.life > 0;
    });

    // 检查敌人碰撞
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.dying) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < e.size / 2 + this.player.size / 2) {
        this.player.hp = Math.max(0, this.player.hp - 1);
        this.player.flashTime = 20;
        this.player.shakeTime = 16;
        this._spawnFloat('✗', this.player.x, this.player.y - 20, '#ff6b6b');
        sfx.sfxHurt();
      }
    }

    // 失败
    if (this.player.hp <= 0 && this.state === 'playing') {
      this.state = 'failed';
      sfx.sfxLose();
    }
  }

  render() {
    const ctx = this.ctx;
    // 清屏
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 屏幕震动
    let sx = 0, sy = 0;
    if (this.player.shakeTime > 0) {
      const amp = Math.min(this.player.shakeTime, 10) * 0.6;
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp;
    }

    ctx.save();
    ctx.translate(sx, sy);

    // 网格地板
    this._drawFloor();

    // 敌人
    for (const e of this.enemies) {
      this._drawEnemy(e);
    }

    // 玩家
    this._drawPlayer();

    // 飘字
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life / 36);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = f.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // 子弹
    for (const b of this.bullets) {
      this._drawBulletTrail(b);
      this._drawBullet(b);
    }

    // 粒子
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      if (p.isEmoji) {
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.content, p.x, p.y);
      } else {
        ctx.fillStyle = p.content;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // HUD(顶部目标条)不参与震动
    this._drawTargetHint();
  }

  _drawFloor() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(86, 108, 134, 0.3)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
  }

  _drawPlayer() {
    const ctx = this.ctx;
    const { x, y, size, flashTime } = this.player;

    // 闪光时变红
    if (flashTime > 0 && flashTime % 4 < 2) {
      ctx.fillStyle = '#ff5555';
    } else {
      ctx.fillStyle = '#41a6f6';
    }
    ctx.fillRect(x - size / 2, y - size / 2, size, size);

    // 边框
    ctx.strokeStyle = '#ffec27';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);

    // 眼睛(看鼠标)
    const aim = Input.mouse;
    const aimAngle = Math.atan2(aim.y - y, aim.x - x);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 4 + Math.cos(aimAngle) * 4, y - 4 + Math.sin(aimAngle) * 4, 3, 3);
    ctx.fillRect(x + 2 + Math.cos(aimAngle) * 4, y - 2 + Math.sin(aimAngle) * 4, 3, 3);

    // 炮口指示(短横线指向鼠标方向)
    ctx.strokeStyle = '#ffec27';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(aimAngle) * 12, y + Math.sin(aimAngle) * 12);
    ctx.lineTo(x + Math.cos(aimAngle) * 22, y + Math.sin(aimAngle) * 22);
    ctx.stroke();
  }

  _drawEnemy(e) {
    const ctx = this.ctx;
    if (e.hp <= 0) {
      // 死亡后短暂闪光,然后淡出
      const fadeT = Math.max(0, e.dyingT);
      ctx.globalAlpha = fadeT * 0.6;
      e.dyingT -= 0.04;
    }
    const wobbleY = Math.sin(e.wobble) * 2;

    // 目标怪的高亮圈
    if (e.isTarget && e.hp > 0 && !e.dying) {
      const pulse = 1 + Math.sin(e.pulseT) * 0.18;
      ctx.strokeStyle = '#ffec27';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y + wobbleY, e.size * 0.7 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = e.hp <= 0 ? Math.max(0, e.dyingT) * 0.6 : 1;
    }

    if (e.dying) {
      // 子弹飞行中:怪淡灰,微微抖动
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = '#888';
    } else {
      ctx.fillStyle = '#b13e53';
    }
    ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2 + wobbleY, e.size, e.size);
    ctx.strokeStyle = '#5d275d';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x - e.size / 2, e.y - e.size / 2 + wobbleY, e.size, e.size);

    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.image, e.x, e.y + wobbleY);

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#ffec27';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.strokeText(e.word, e.x, e.y - e.size / 2 - 10 + wobbleY);
    ctx.fillText(e.word, e.x, e.y - e.size / 2 - 10 + wobbleY);

    ctx.globalAlpha = 1;
  }

  _drawBulletTrail(b) {
    const ctx = this.ctx;
    for (const t of b.trail) {
      ctx.globalAlpha = Math.max(0, t.life / 12) * 0.7;
      ctx.fillStyle = '#ffec27';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  _drawBullet(b) {
    const ctx = this.ctx;
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#ffec27';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.strokeText(b.text, b.x, b.y);
    ctx.fillText(b.text, b.x, b.y);
  }

  _drawTargetHint() {
    if (!this.currentWord || this.state !== 'playing') return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(26, 28, 44, 0.9)';
    ctx.fillRect(0, 0, CANVAS_W, 44);
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#94b0c2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('当前目标', 16, 22);
    ctx.fillStyle = '#ffec27';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(this.currentWord.meaning, 110, 22);
    if (this.currentWord.image) {
      ctx.font = '24px serif';
      ctx.fillText(this.currentWord.image, 230, 22);
    }
    // 进度
    ctx.font = '14px monospace';
    ctx.fillStyle = '#94b0c2';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.killed}/${this.total}`, CANVAS_W - 16, 22);
  }
}