/**
 * Game Engine · 顶视角射击核心循环
 *
 * 设计:
 * - 玩家在中央,可 WASD 移动
 * - 鼠标瞄准,左键发射词块(对应英文单词)
 * - 怪物身上显示英文单词,玩家必须发射**对应正确词块**才能伤害它
 * - 拼错 / 打错目标:怪不掉血,但发射者不被惩罚(为了儿童友好)
 * - 答对所有怪 = 通关
 */

import { Input } from './input.js';
import { Storage } from '../save/storage.js';
import { getWordsForLevel, getDistractors } from '../data/words.js';

const CANVAS_W = 960;
const CANVAS_H = 640;
const PLAYER_SPEED = 3;
const BULLET_SPEED = 6;
const ENEMY_SPEED = 0.6;
const ENEMY_HP = 1;

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
    };

    this.bullets = [];      // 我方词块
    this.enemies = [];      // 敌人
    this.particles = [];    // 命中粒子效果
    this.words = [];        // 当前关卡词库

    this.currentWord = null;     // 当前要拼/选的目标词
    this.aliveEnemies = 0;
    this.killed = 0;
    this.total = 0;
    this.timer = 0;
    this.state = 'playing'; // playing / cleared / failed
    this.levelId = null;
  }

  /** 装载关卡 */
  loadLevel(levelId) {
    this.levelId = levelId;
    this.words = getWordsForLevel(levelId);
    if (this.words.length === 0) {
      console.error('关卡无词:', levelId);
      return;
    }
    this.total = this.words.length;
    this.killed = 0;
    this.timer = 0;
    this.state = 'playing';
    this.player.hp = this.player.maxHp;
    this.player.x = CANVAS_W / 2;
    this.player.y = CANVAS_H / 2;

    // 给每个词生成一个怪物
    this.enemies = [];
    this.bullets = [];
    this.particles = [];

    for (let i = 0; i < this.words.length; i++) {
      const w = this.words[i];
      this.enemies.push(this._spawnEnemy(w, i));
    }
    this.aliveEnemies = this.enemies.length;

    // 给玩家一个目标词(可以是错题本优先)
    this._selectNextTarget();
  }

  _spawnEnemy(word, idx) {
    const margin = 80;
    // 4 个角随机
    const corners = [
      [margin, margin],
      [CANVAS_W - margin, margin],
      [margin, CANVAS_H - margin],
      [CANVAS_W - margin, CANVAS_H - margin],
    ];
    const [x, y] = corners[idx % 4];
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
    };
  }

  /** 选择下一个目标词(智能:优先错词本里的) */
  _selectNextTarget() {
    const userId = Storage.getCurrentUser()?.id;
    if (!userId) return;

    const wrongWords = Storage.getWrongWords(userId);
    // 在关卡词里找错词本里的
    const wrongsInLevel = this.words.filter(w => wrongWords.includes(w.word));
    // 拼词/选词,优先选错词本的
    const candidates = wrongsInLevel.length > 0 ? wrongsInLevel : this.words;
    const next = candidates[Math.floor(Math.random() * candidates.length)];

    this.currentWord = next;
  }

  /** 拼词/选词答案核对 */
  submitAnswer(submittedWord, isCorrectMode) {
    if (!this.currentWord) return;

    if (submittedWord === this.currentWord.word) {
      // 答对了:找场上对应怪物,扣血 + 加粒子
      const enemy = this.enemies.find(e => e.word === submittedWord && e.hp > 0);
      if (enemy) {
        enemy.hp = 0;
        this.killed++;
        this._spawnParticles(enemy.x, enemy.y, '#ffec27');
        this._spawnParticles(enemy.x, enemy.y, this.currentWord.image, true);
        // 记录单词成绩
        Storage.recordWordResult(Storage.getCurrentUser().id, this.currentWord.word, true);
      }
    } else {
      // 答错:扣自己血,记录错词
      this.player.hp = Math.max(0, this.player.hp - 1);
      this.player.flashTime = 12;
      if (this.currentWord) {
        Storage.recordWordResult(Storage.getCurrentUser().id, this.currentWord.word, false);
      }
    }

    // 选下一个目标
    this._selectNextTarget();

    // 是否全部清光?
    this.aliveEnemies = this.enemies.filter(e => e.hp > 0).length;
    if (this.aliveEnemies === 0 && this.state === 'playing') {
      this.state = 'cleared';
    }
  }

  /** 玩家发射词块(mouse click 走的是"提交答案"路径,不用 bullet) */
  fireBullet(text) {
    // 直接调用 submit 逻辑
    this.submitAnswer(text);
  }

  /** 假装的子弹动画:在玩家处发射到目标怪物点 */
  _animateBullet(toX, toY, text) {
    this.bullets.push({
      x: this.player.x,
      y: this.player.y,
      tx: toX,
      ty: toY,
      text,
      progress: 0,
      life: 30,
    });
  }

  _spawnParticles(x, y, content, isEmoji = false) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        life: 30,
        content,
        isEmoji,
        size: isEmoji ? 18 : 4,
      });
    }
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

    // 子弹
    this.bullets = this.bullets.filter(b => {
      b.progress += 0.08;
      b.x = this.player.x + (b.tx - this.player.x) * b.progress;
      b.y = this.player.y + (b.ty - this.player.y) * b.progress;
      b.life--;
      return b.life > 0 && b.progress < 1;
    });

    // 敌人慢慢飘向玩家(微)
    for (const e of this.enemies) {
      if (e.hp > 0) {
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        e.x += Math.cos(angle) * ENEMY_SPEED * (dt / 16);
        e.y += Math.sin(angle) * ENEMY_SPEED * (dt / 16);
        e.wobble += 0.05;
      }
    }

    // 粒子
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      return p.life > 0;
    });

    // 检查敌人碰撞:没血不算
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < e.size / 2 + this.player.size / 2) {
        // 被怪碰到扣 1 血(教学提示:打它消除)
        this.player.hp = Math.max(0, this.player.hp - 1);
        this.player.flashTime = 20;
      }
    }

    // 失败
    if (this.player.hp <= 0 && this.state === 'playing') {
      this.state = 'failed';
    }
  }

  render() {
    const ctx = this.ctx;
    // 清屏
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 网格地板
    this._drawFloor();

    // 敌人
    for (const e of this.enemies) {
      this._drawEnemy(e);
    }

    // 玩家
    this._drawPlayer();

    // 子弹
    for (const b of this.bullets) {
      this._drawBullet(b);
    }

    // 粒子
    for (const p of this.particles) {
      const alpha = p.life / 30;
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

    // 当前目标词提示
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

    // 眼睛
    const aim = Input.mouse;
    const aimAngle = Math.atan2(aim.y - y, aim.x - x);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 4 + Math.cos(aimAngle) * 4, y - 4 + Math.sin(aimAngle) * 4, 3, 3);
    ctx.fillRect(x + 2 + Math.cos(aimAngle) * 4, y - 2 + Math.sin(aimAngle) * 4, 3, 3);
  }

  _drawEnemy(e) {
    const ctx = this.ctx;
    if (e.hp <= 0) {
      // 死亡的怪:淡淡显示
      ctx.globalAlpha = 0.3;
    }
    const wobbleY = Math.sin(e.wobble) * 2;

    // 怪身体(像素方块)
    ctx.fillStyle = '#b13e53';
    ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2 + wobbleY, e.size, e.size);
    ctx.strokeStyle = '#5d275d';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x - e.size / 2, e.y - e.size / 2 + wobbleY, e.size, e.size);

    // 怪表情(emoji)
    ctx.font = '20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.image, e.x, e.y + wobbleY);

    // 怪身上的英文单词(就是答案)
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#ffec27';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    const text = e.word;
    ctx.strokeText(text, e.x, e.y - e.size / 2 - 10 + wobbleY);
    ctx.fillText(text, e.x, e.y - e.size / 2 - 10 + wobbleY);

    ctx.globalAlpha = 1;
  }

  _drawBullet(b) {
    const ctx = this.ctx;
    ctx.font = '16px serif';
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
    // 屏幕顶部条
    ctx.fillStyle = 'rgba(26, 28, 44, 0.85)';
    ctx.fillRect(0, 0, CANVAS_W, 36);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#94b0c2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('当前目标:', 16, 18);
    ctx.fillStyle = '#ffec27';
    ctx.fillText(this.currentWord.meaning, 110, 18);
    if (this.currentWord.image) {
      ctx.font = '22px serif';
      ctx.fillText(this.currentWord.image, 220, 18);
    }
  }
}
