/**
 * Game Engine · 顶视角背单词 Roguelike 核心循环
 *
 * 设计参考 vocab-roguelike，适配小学生:
 * - 保留"看图选词/拼词"答题核心(适合小学生)
 * - 外围引入 roguelike 元素: 主题房间推进 / 多种怪物 / 连击 / 道具宝箱 / 奖励卡
 * - 视觉增强: 主题地图 + 障碍物 + 准星 + 粒子 + 飘字 + 屏幕震动
 */

import { Input } from './input.js';
import { Storage } from '../save/storage.js';
import { selectLevelWords, WORDS } from '../data/words.js';
import * as sfx from '../audio/sfx.js';

const CANVAS_W = 960;
const CANVAS_H = 640;

// === 主题系统(8 个主题,按房间循环) ===
const THEMES = [
  { name: '晨光教室', floor: '#2d4a3e', floor2: '#26403a', wall: '#1a2e26', accent: '#7ec850', decor: '🌱', decorColor: '#5a9e3a' },
  { name: '课间操场', floor: '#3a4a5e', floor2: '#34455a', wall: '#243140', accent: '#5fb8e8', decor: '🌿', decorColor: '#3a7a5a' },
  { name: '图书馆',   floor: '#4a3e5e', floor2: '#42365a', wall: '#2e2440', accent: '#b88ae8', decor: '📚', decorColor: '#7a5aae' },
  { name: '科学实验室', floor: '#1e4a5e', floor2: '#1a4258', wall: '#102e3a', accent: '#4ad8c8', decor: '🔬', decorColor: '#2a8e8a' },
  { name: '美术工坊', floor: '#5e4a2e', floor2: '#564228', wall: '#3a2e1a', accent: '#e8b84a', decor: '🎨', decorColor: '#ae8232' },
  { name: '音乐厅',   floor: '#4a2e3e', floor2: '#42283a', wall: '#2e1a26', accent: '#e85a8a', decor: '🎵', decorColor: '#ae3a6a' },
  { name: '天文台',   floor: '#1a2a4a', floor2: '#162640', wall: '#0e1628', accent: '#8ab8e8', decor: '⭐', decorColor: '#e8c84a' },
  { name: '植物园',   floor: '#2e4a3a', floor2: '#284234', wall: '#1a2e22', accent: '#8ae85a', decor: '🌸', decorColor: '#5aae3a' },
];

const PLAYER_SPEED = 3.2;
const ENEMY_BASE_SPEED = 0.45;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    Input.init(canvas);

    this.player = this._newPlayer();
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.floats = [];
    this.obstacles = [];
    this.drops = [];        // 道具掉落
    this.chest = null;      // 当前房间宝箱(最多1个)

    this.words = [];
    this.remainingWords = [];  // 未出场的词(用于后续房间)
    this.currentWord = null;

    this.room = 0;
    this.maxRooms = 3;
    this.killed = 0;
    this.total = 0;
    this.timer = 0;
    this.state = 'playing';
    this.levelId = null;
    this.busy = false;

    // 连击
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;

    // 道具状态
    this.powerups = { shield: 0, speed: 0, ink: 0 };

    // 奖励卡
    this.pendingRewards = null;

    // 视觉
    this.shakeTime = 0;
    this.flashTime = 0;
    this.flashColor = '#ff0000';
    this.roomClearTimer = 0;

    this.theme = THEMES[0];
  }

  _newPlayer() {
    return {
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      size: 26,
      hp: 10,
      maxHp: 10,
      speed: PLAYER_SPEED,
      defense: 0,
      flashTime: 0,
      shakeTime: 0,
      invulnerable: 0,
      facing: 0,            // 0=下 1=左 2=右 3=上
      walkAnim: 0,
      aimAngle: 0,
    };
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
    this._initLevel();
  }

  /** 错词挑战模式 */
  loadWrongWords() {
    this.levelId = 'wrong-words';
    const _u = Storage.getCurrentUser();
    if (!_u) return;
    const wrongList = Storage.getWrongWords(_u.id);
    this.words = WORDS.filter(w => wrongList.includes(w.word));
    if (this.words.length === 0) {
      console.warn('错词本为空');
      return false;
    }
    this._initLevel();
    return true;
  }

  _initLevel() {
    this.total = this.words.length;
    this.killed = 0;
    this.timer = 0;
    this.state = 'playing';
    this.busy = false;
    this.combo = 0;
    this.maxCombo = 0;
    this.player = this._newPlayer();
    this.bullets = [];
    this.particles = [];
    this.floats = [];
    this.drops = [];

    // 房间数: 每 3-4 个词一个房间
    this.maxRooms = Math.max(2, Math.min(5, Math.ceil(this.words.length / 4)));
    this.room = 0;
    this.remainingWords = [...this.words];

    this._startRoom();
  }

  _startRoom() {
    this.room++;
    this.theme = THEMES[(this.room - 1) % THEMES.length];
    this.bullets = [];
    this.particles = [];
    this.drops = [];
    this.chest = null;
    this.state = 'playing';
    this.busy = false;
    this.roomClearTimer = 0;

    // 玩家回到中下方
    this.player.x = CANVAS_W / 2;
    this.player.y = CANVAS_H / 2 + 120;
    this.player.invulnerable = 30;

    // 生成障碍物
    this._generateObstacles();

    // 本房间怪物: 从剩余词里取 3-4 个
    const roomSize = Math.min(
      this.remainingWords.length,
      this.room === this.maxRooms ? this.remainingWords.length : Math.min(4, 3 + Math.floor(this.room / 3))
    );
    const roomWords = this.remainingWords.splice(0, roomSize);

    this.enemies = [];
    for (let i = 0; i < roomWords.length; i++) {
      this.enemies.push(this._spawnEnemy(roomWords[i], i, roomWords.length));
    }

    // 52% 概率放宝箱(非最后一间)
    if (this.room < this.maxRooms && Math.random() < 0.52) {
      this._spawnChest();
    }

    this._selectNextTarget();

    this._spawnFloat(`第 ${this.room} 间房 · ${this.theme.name}`, CANVAS_W / 2, 80, this.theme.accent, 90);
  }

  _generateObstacles() {
    this.obstacles = [];
    const count = 3 + Math.min(4, Math.floor(this.room / 2));
    let attempts = 0;
    while (this.obstacles.length < count && attempts < 60) {
      attempts++;
      const w = 50 + Math.random() * 60;
      const h = 50 + Math.random() * 60;
      const x = 80 + Math.random() * (CANVAS_W - 160 - w);
      const y = 80 + Math.random() * (CANVAS_H - 200 - h);
      // 避开玩家出生区
      const px = CANVAS_W / 2, py = CANVAS_H / 2 + 120;
      if (Math.hypot(x + w / 2 - px, y + h / 2 - py) < 130) continue;
      // 避开重叠
      let ok = true;
      for (const o of this.obstacles) {
        if (x < o.x + o.w + 20 && x + w > o.x - 20 && y < o.y + o.h + 20 && y + h > o.y - 20) {
          ok = false; break;
        }
      }
      if (ok) this.obstacles.push({ x, y, w, h });
    }
  }

  _spawnChest() {
    let attempts = 0;
    while (attempts < 40) {
      attempts++;
      const x = 100 + Math.random() * (CANVAS_W - 200);
      const y = 100 + Math.random() * (CANVAS_H - 220);
      if (this._hitsObstacle(x, y, 30)) continue;
      if (Math.hypot(x - this.player.x, y - this.player.y) < 120) continue;
      this.chest = { x, y, opened: false, wobble: 0 };
      return;
    }
  }

  _spawnEnemy(word, idx, total) {
    const margin = 100;
    const innerW = CANVAS_W - margin * 2;
    const innerH = CANVAS_H - margin * 2 - 80;
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const cellW = innerW / cols;
    const cellH = innerH / rows;
    const baseX = margin + cellW * (c + 0.5);
    const baseY = margin + 60 + cellH * (r + 0.5);

    // 怪物种类: 随房间推进变丰富
    let kind = 'wanderer';
    const roll = Math.random();
    if (this.room >= 3 && roll < 0.18) kind = 'shield';
    else if (this.room >= 2 && roll < 0.40) kind = 'dasher';
    else if (this.room >= 2 && roll < 0.65) kind = 'chaser';

    const hp = kind === 'shield' ? 2 : 1;

    return {
      word: word.word,
      meaning: word.meaning,
      image: word.image,
      x: baseX, y: baseY,
      size: 40,
      hp, maxHp: hp,
      kind,
      shieldUp: kind === 'shield',
      wobble: Math.random() * Math.PI * 2,
      dying: false,
      dyingT: 0,
      pulseT: 0,
      isTarget: false,
      rageTimer: 0,
      dashTimer: kind === 'dasher' ? 1.5 + Math.random() : 0,
      dashing: false,
      vx: 0, vy: 0,
      bornAt: this.timer,
    };
  }

  /** 选择下一个目标词(优先错词) */
  _selectNextTarget() {
    const userId = Storage.getCurrentUser()?.id;
    if (!userId) return;

    for (const e of this.enemies) e.isTarget = false;

    const wrongWords = Storage.getWrongWords(userId);
    const alive = this.enemies.filter(e => e.hp > 0 && !e.dying);
    if (alive.length === 0) {
      this.currentWord = null;
      return;
    }

    const aliveWrongs = alive.filter(e => wrongWords.includes(e.word));
    const pool = aliveWrongs.length > 0 ? aliveWrongs : alive;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    this.currentWord = {
      word: pick.word, meaning: pick.meaning, image: pick.image,
    };
    pick.isTarget = true;
    pick.pulseT = 0;
  }

  /** 处理用户提交的答案 */
  submitAnswer(submittedWord) {
    if (!this.currentWord || this.busy) return;
    if (this.state !== 'playing') return;
    const userId = Storage.getCurrentUser()?.id;
    if (!userId) return;

    if (submittedWord.toLowerCase() === this.currentWord.word.toLowerCase()) {
      const enemy = this.enemies.find(
        e => e.word.toLowerCase() === submittedWord.toLowerCase() && e.hp > 0 && !e.dying
      );
      if (enemy) {
        this.busy = true;
        // 发射子弹
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.bullets.push({
          x: this.player.x, y: this.player.y,
          vx: (dx / dist) * 14, vy: (dy / dist) * 14,
          text: submittedWord,
          life: 90,
          target: enemy,
          hit: false,
          trail: [],
        });
        sfx.sfxShoot();
        this.player.aimAngle = Math.atan2(dy, dx);
      } else {
        this._selectNextTarget();
      }
    } else {
      // 答错
      this._playerHurt(1);
      this._spawnFloat('✗', this.player.x, this.player.y - 24, '#ff6b6b');
      sfx.sfxWrong();
      this.combo = 0;
      if (this.currentWord) {
        Storage.recordWordResult(userId, this.currentWord.word, false);
      }
      this._selectNextTarget();
    }
  }

  fireBullet(text) { this.submitAnswer(text); }

  _playerHurt(dmg) {
    if (this.player.invulnerable > 0) return;
    let actual = dmg;
    if (this.powerups.shield > 0) actual = Math.ceil(actual * 0.4);
    actual = Math.max(1, actual - Math.floor(this.player.defense * actual));
    this.player.hp = Math.max(0, this.player.hp - actual);
    this.player.flashTime = 16;
    this.player.shakeTime = 14;
    this.player.invulnerable = 40;
    this.shakeTime = 12;
    this.flashTime = 8;
    this.flashColor = '#ff0000';
    this._spawnFloat(`-${actual}`, this.player.x, this.player.y - 20, '#ff6b6b');
    sfx.sfxHurt();
  }

  _spawnParticles(x, y, color, count = 10, speed = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 30 + Math.random() * 20,
        maxLife: 40,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  _spawnEmojiBurst(x, y, emoji, count = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * 4 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 1,
        life: 40,
        maxLife: 40,
        emoji,
        size: 16,
      });
    }
  }

  _spawnFloat(text, x, y, color, life = 50) {
    this.floats.push({ text, x, y, life, maxLife: life, color });
  }

  _hitsObstacle(x, y, r = 12) {
    for (const o of this.obstacles) {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      if (Math.hypot(x - cx, y - cy) < r) return true;
    }
    return false;
  }

  /** 主循环 */
  update(dt) {
    this.timer += dt;
    const step = dt / 16; // 归一化到 60fps 步长

    if (this.player.flashTime > 0) this.player.flashTime -= step;
    if (this.player.shakeTime > 0) this.player.shakeTime -= step;
    if (this.player.invulnerable > 0) this.player.invulnerable -= step;
    if (this.shakeTime > 0) this.shakeTime -= step;
    if (this.flashTime > 0) this.flashTime -= step;
    if (this.comboTimer > 0) {
      this.comboTimer -= step;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    // 道具计时
    if (this.powerups.shield > 0) this.powerups.shield -= step;
    if (this.powerups.speed > 0) this.powerups.speed -= step;
    if (this.powerups.ink > 0) this.powerups.ink -= step;

    if (this.state === 'playing') {
      this._updatePlaying(step);
    } else if (this.state === 'roomClear') {
      this.roomClearTimer -= step;
      // 道具飘动等仍然更新
      this._updateParticles(step);
      if (this.roomClearTimer <= 0) {
        this._advanceRoom();
      }
    } else if (this.state === 'rewardChoice') {
      this._updateParticles(step);
    } else if (this.state === 'cleared' || this.state === 'failed') {
      this._updateParticles(step);
    }
  }

  _updatePlaying(step) {
    // 玩家移动
    let dx = 0, dy = 0;
    if (Input.isLeft()) dx -= 1;
    if (Input.isRight()) dx += 1;
    if (Input.isUp()) dy -= 1;
    if (Input.isDown()) dy += 1;
    const mag = Math.hypot(dx, dy) || 1;
    const spd = this.player.speed * (this.powerups.speed > 0 ? 1.4 : 1);
    const nx = this.player.x + (dx / mag) * spd * step;
    const ny = this.player.y + (dy / mag) * spd * step;

    // 分轴碰撞(障碍物)
    if (!this._hitsObstacle(nx, this.player.y, this.player.size / 2)) this.player.x = nx;
    if (!this._hitsObstacle(this.player.x, ny, this.player.size / 2)) this.player.y = ny;

    this.player.x = Math.max(this.player.size, Math.min(CANVAS_W - this.player.size, this.player.x));
    this.player.y = Math.max(this.player.size + 50, Math.min(CANVAS_H - this.player.size, this.player.y));

    if (dx !== 0 || dy !== 0) {
      this.player.walkAnim += 0.2 * step;
      if (Math.abs(dx) > Math.abs(dy)) this.player.facing = dx > 0 ? 2 : 1;
      else this.player.facing = dy > 0 ? 0 : 3;
    }

    // 瞄准
    const aim = Input.mouse;
    this.player.aimAngle = Math.atan2(aim.y - this.player.y, aim.x - this.player.x);

    // 子弹
    for (const b of this.bullets) {
      b.trail.push({ x: b.x, y: b.y, life: 14 });
      b.trail = b.trail.filter(t => { t.life -= step; return t.life > 0; });
      b.x += b.vx * step;
      b.y += b.vy * step;
      b.life -= step;
      if (b.target && !b.hit) {
        const d = Math.hypot(b.x - b.target.x, b.y - b.target.y);
        if (d < b.target.size / 2 + 8 || b.life <= 0) {
          this._hitEnemy(b.target, b);
          b.hit = true;
        }
      }
    }
    this.bullets = this.bullets.filter(b => b.life > 0 && !b.hit);

    // busy 解锁
    if (this.busy && this.bullets.length === 0) {
      this.busy = false;
      const alive = this.enemies.filter(e => e.hp > 0 && !e.dying).length;
      if (alive === 0) {
        this._onRoomCleared();
      } else {
        this._selectNextTarget();
      }
    }

    // 怪物 AI
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        e.dyingT -= 0.05 * step;
        continue;
      }
      if (e.dying) continue;
      e.wobble += 0.05 * step;
      if (e.isTarget) e.pulseT += 0.1 * step;

      const toPlayerX = this.player.x - e.x;
      const toPlayerY = this.player.y - e.y;
      const distP = Math.hypot(toPlayerX, toPlayerY) || 1;
      const anger = e.rageTimer > 0 ? 1.7 : 1;
      let mvx = 0, mvy = 0;

      if (e.kind === 'wanderer') {
        e.vx = Math.cos(e.wobble * 0.5) * 0.5;
        e.vy = Math.sin(e.wobble * 0.5) * 0.5;
        if (distP < 200) { mvx = toPlayerX / distP * 0.3; mvy = toPlayerY / distP * 0.3; }
        mvx = e.vx + mvx; mvy = e.vy + mvy;
      } else if (e.kind === 'chaser') {
        mvx = toPlayerX / distP; mvy = toPlayerY / distP;
      } else if (e.kind === 'dasher') {
        e.dashTimer -= step / 60;
        if (e.dashing) {
          // 冲刺中(已设 vx/vy)
          if (e.dashTimer <= 0) { e.dashing = false; e.dashTimer = 2.2; }
        } else {
          mvx = toPlayerX / distP * 0.4; mvy = toPlayerY / distP * 0.4;
          if (e.dashTimer <= 0) {
            e.dashing = true;
            e.dashTimer = 0.5;
            e.vx = toPlayerX / distP * 4.5;
            e.vy = toPlayerY / distP * 4.5;
          }
        }
        if (e.dashing) { mvx = e.vx; mvy = e.vy; }
      } else if (e.kind === 'shield') {
        e.vx = Math.cos(e.wobble * 0.3) * 0.4;
        e.vy = Math.sin(e.wobble * 0.3) * 0.4;
        if (distP < 180) { mvx = toPlayerX / distP * 0.25; mvy = toPlayerY / distP * 0.25; }
        mvx = e.vx + mvx; mvy = e.vy + mvy;
      }

      if (e.rageTimer > 0) e.rageTimer -= step / 60;

      const spd = ENEMY_BASE_SPEED * anger * (1 + (this.room - 1) * 0.08);
      let nex = e.x + mvx * spd * step;
      let ney = e.y + mvy * spd * step;
      if (!this._hitsObstacle(nex, e.y, e.size / 2)) e.x = nex;
      if (!this._hitsObstacle(e.x, ney, e.size / 2)) e.y = ney;
      e.x = Math.max(e.size, Math.min(CANVAS_W - e.size, e.x));
      e.y = Math.max(e.size + 50, Math.min(CANVAS_H - e.size, e.y));

      // 与玩家碰撞
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < e.size / 2 + this.player.size / 2 - 4) {
        this._playerHurt(1);
        // 击退怪物
        const kx = (e.x - this.player.x) / d, ky = (e.y - this.player.y) / d;
        e.x += kx * 10; e.y += ky * 10;
      }
    }

    // 道具拾取
    for (const d of this.drops) {
      d.wobble += 0.1 * step;
      d.life -= step;
      const dist = Math.hypot(d.x - this.player.x, d.y - this.player.y);
      if (dist < this.player.size + 12) {
        this._pickupDrop(d);
        d.collected = true;
      }
    }
    this.drops = this.drops.filter(d => !d.collected && d.life > 0);

    // 清理完全淡出的死亡怪物
    this.enemies = this.enemies.filter(e => !(e.hp <= 0 && e.dyingT <= 0));

    // 宝箱拾取(非 busy 时才能开,避免与子弹飞行冲突)
    if (this.chest && !this.chest.opened && !this.busy) {
      this.chest.wobble += 0.05 * step;
      const dist = Math.hypot(this.chest.x - this.player.x, this.chest.y - this.player.y);
      if (dist < this.player.size + 20) {
        this._openChest();
      }
    }

    this._updateParticles(step);

    // 失败
    if (this.player.hp <= 0) {
      this.state = 'failed';
      sfx.sfxLose();
    }
  }

  _updateParticles(step) {
    for (const p of this.particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 0.15 * step;
      p.life -= step;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const f of this.floats) {
      f.y -= 0.6 * step;
      f.life -= step;
    }
    this.floats = this.floats.filter(f => f.life > 0);
  }

  _hitEnemy(enemy, bullet) {
    const userId = Storage.getCurrentUser().id;
    // 护盾怪: 第一次破盾
    if (enemy.shieldUp) {
      enemy.shieldUp = false;
      enemy.rageTimer = 0.6;
      this._spawnParticles(enemy.x, enemy.y, this.theme.accent, 12, 4);
      this._spawnFloat('破盾!', enemy.x, enemy.y - 24, this.theme.accent);
      sfx.sfxHit();
      Storage.recordWordResult(userId, enemy.word, true);
      this.killed++; // 破盾算击杀(护盾怪答一次破盾+击杀简化为一次)
      enemy.hp = 0;
      enemy.dying = true;
      enemy.dyingT = 1;
    } else {
      enemy.hp = 0;
      enemy.dying = true;
      enemy.dyingT = 1;
      this.killed++;
      // 连击
      this.combo++;
      this.comboTimer = 180;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const comboBonus = this.combo >= 3 ? 1 : 0;
      if (comboBonus) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      }

      this._spawnParticles(enemy.x, enemy.y, '#ffec27', 14, 5);
      this._spawnParticles(enemy.x, enemy.y, this.theme.accent, 8, 4);
      this._spawnEmojiBurst(enemy.x, enemy.y, enemy.image, 3);
      const floatText = this.combo >= 3 ? `+1 连击 x${this.combo}` : '+1';
      this._spawnFloat(floatText, enemy.x, enemy.y - 20, this.combo >= 3 ? '#98f5b4' : '#ffec27');
      sfx.sfxHit();
      Storage.recordWordResult(userId, enemy.word, true);

      // 掉落道具(16% 概率)
      if (Math.random() < 0.16 && this.room < this.maxRooms) {
        this._spawnDrop(enemy.x, enemy.y);
      }
    }
  }

  _spawnDrop(x, y) {
    const kinds = ['heart', 'shield', 'speed'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    this.drops.push({ kind, x, y, life: 600, wobble: 0 });
  }

  _pickupDrop(d) {
    if (d.kind === 'heart') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 3);
      this._spawnFloat('+3 ❤', d.x, d.y - 16, '#ff6b9d');
    } else if (d.kind === 'shield') {
      this.powerups.shield = 360;
      this._spawnFloat('护盾!', d.x, d.y - 16, '#7cd5ff');
    } else if (d.kind === 'speed') {
      this.powerups.speed = 360;
      this._spawnFloat('加速!', d.x, d.y - 16, '#98f5b4');
    }
    sfx.sfxClick();
    this._spawnParticles(d.x, d.y, '#ffec27', 8, 3);
  }

  _openChest() {
    this.chest.opened = true;
    this._spawnParticles(this.chest.x, this.chest.y, '#ffec27', 20, 6);
    this._spawnFloat('宝箱!', this.chest.x, this.chest.y - 20, '#ffec27');
    sfx.sfxWin();
    // 宝箱 = 奖励卡三选一
    this._prepareRewards();
  }

  _prepareRewards() {
    const rewards = [
      { type: 'hp', label: '❤️ 生命强化', desc: '最大生命 +3', icon: '❤️' },
      { type: 'speed', label: '👟 疾步', desc: '永久移速 +15%', icon: '👟' },
      { type: 'defense', label: '🛡️ 韧性', desc: '减伤 +15%', icon: '🛡️' },
    ];
    // 随机选 3 个(这里就 3 个,全给)
    this.pendingRewards = rewards;
    this.state = 'rewardChoice';
  }

  /** 外部调用: 选择奖励卡 */
  chooseReward(index) {
    if (!this.pendingRewards || this.state !== 'rewardChoice') return;
    const r = this.pendingRewards[index];
    if (r.type === 'hp') {
      this.player.maxHp += 3;
      this.player.hp += 3;
    } else if (r.type === 'speed') {
      this.player.speed *= 1.15;
    } else if (r.type === 'defense') {
      this.player.defense = Math.min(0.5, this.player.defense + 0.15);
    }
    this._spawnFloat(`${r.label}!`, this.player.x, this.player.y - 30, '#ffec27', 70);
    this.pendingRewards = null;
    this.state = 'playing';
    this.chest = null;
  }

  _onRoomCleared() {
    this.state = 'roomClear';
    this.roomClearTimer = 90;
    sfx.sfxWin();
    this._spawnFloat(`第 ${this.room} 间房清空!`, CANVAS_W / 2, CANVAS_H / 2 - 40, '#98f5b4', 80);
    // 小回血
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
  }

  _advanceRoom() {
    if (this.room >= this.maxRooms) {
      // 通关
      this.state = 'cleared';
      sfx.sfxWin();
    } else {
      this._startRoom();
    }
  }

  // ============ 渲染 ============
  render() {
    const ctx = this.ctx;
    const t = this.theme;

    // 屏幕震动
    let sx = 0, sy = 0;
    if (this.shakeTime > 0) {
      const amp = Math.min(this.shakeTime, 10) * 0.8;
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp;
    }

    ctx.save();
    ctx.translate(sx, sy);

    // 地板
    this._drawFloor();

    // 障碍物
    for (const o of this.obstacles) this._drawObstacle(o);

    // 宝箱
    if (this.chest && !this.chest.opened) this._drawChest();

    // 道具
    for (const d of this.drops) this._drawDrop(d);

    // 敌人
    for (const e of this.enemies) this._drawEnemy(e);

    // 玩家
    this._drawPlayer();

    // 子弹
    for (const b of this.bullets) { this._drawBulletTrail(b); this._drawBullet(b); }

    // 粒子
    for (const p of this.particles) this._drawParticle(p);

    // 飘字
    for (const f of this.floats) this._drawFloat(f);

    ctx.restore();

    // 准星(不参与震动)
    if (this.state === 'playing') this._drawCrosshair();

    // 闪光
    if (this.flashTime > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = Math.min(0.3, this.flashTime / 30);
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }

    // HUD
    this._drawHUD();
  }

  _drawFloor() {
    const ctx = this.ctx;
    const t = this.theme;
    ctx.fillStyle = t.floor;
    ctx.fillRect(0, 50, CANVAS_W, CANVAS_H - 50);

    // 棋盘格纹理
    const tile = 48;
    for (let y = 50; y < CANVAS_H; y += tile) {
      for (let x = 0; x < CANVAS_W; x += tile) {
        if (((x / tile) + (y / tile)) % 2 < 1) {
          ctx.fillStyle = t.floor2;
          ctx.fillRect(x, y, tile, tile);
        }
      }
    }
    // 顶部墙带
    ctx.fillStyle = t.wall;
    ctx.fillRect(0, 0, CANVAS_W, 50);
    ctx.fillStyle = t.accent;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 48, CANVAS_W, 2);
    ctx.globalAlpha = 1;
  }

  _drawObstacle(o) {
    const ctx = this.ctx;
    const t = this.theme;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(o.x + 3, o.y + 3, o.w, o.h);
    // 主体
    ctx.fillStyle = t.wall;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    // 高光边
    ctx.strokeStyle = t.accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    ctx.globalAlpha = 1;
    // 装饰符号
    ctx.font = `${Math.min(o.w, o.h) * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.6;
    ctx.fillText(t.decor, o.x + o.w / 2, o.y + o.h / 2);
    ctx.globalAlpha = 1;
  }

  _drawChest() {
    const ctx = this.ctx;
    const c = this.chest;
    const bob = Math.sin(c.wobble) * 3;
    // 光环
    ctx.globalAlpha = 0.3 + Math.sin(c.wobble * 2) * 0.15;
    ctx.fillStyle = '#ffec27';
    ctx.beginPath();
    ctx.arc(c.x, c.y + bob, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 箱体
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(c.x - 18, c.y - 12 + bob, 36, 26);
    ctx.fillStyle = '#a0682f';
    ctx.fillRect(c.x - 18, c.y - 12 + bob, 36, 8);
    ctx.fillStyle = '#ffec27';
    ctx.fillRect(c.x - 3, c.y - 4 + bob, 6, 8);
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - 18, c.y - 12 + bob, 36, 26);
  }

  _drawDrop(d) {
    const ctx = this.ctx;
    const bob = Math.sin(d.wobble) * 4;
    const flash = d.life < 120 && Math.floor(d.life / 8) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.4;

    const info = {
      heart: { emoji: '❤️', color: '#ff6b9d' },
      shield: { emoji: '🛡️', color: '#7cd5ff' },
      speed: { emoji: '👟', color: '#98f5b4' },
    }[d.kind];

    // 光环
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y + bob, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = flash ? 0.4 : 1;

    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.emoji, d.x, d.y + bob);
    ctx.globalAlpha = 1;
  }

  _drawPlayer() {
    const ctx = this.ctx;
    const { x, y, size, flashTime, invulnerable, facing, walkAnim, aimAngle } = this.player;

    // 无敌闪烁
    if (invulnerable > 0 && Math.floor(invulnerable / 4) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + size / 2, size / 2, size / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 护盾光环
    if (this.powerups.shield > 0) {
      ctx.strokeStyle = '#7cd5ff';
      ctx.globalAlpha = 0.6 + Math.sin(this.timer * 0.01) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, size / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = invulnerable > 0 && Math.floor(invulnerable / 4) % 2 === 0 ? 0.5 : 1;
    }

    // 身体(圆形 + 行走摆动)
    const bob = Math.sin(walkAnim) * 2;
    const bodyColor = flashTime > 0 && flashTime % 4 < 2 ? '#ff5555' : '#41a6f6';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(x, y + bob, size / 2, 0, Math.PI * 2);
    ctx.fill();
    // 边框
    ctx.strokeStyle = '#ffec27';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 朝向眼睛
    const eyeOff = 5;
    const ex = Math.cos(aimAngle) * 5;
    const ey = Math.sin(aimAngle) * 5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 5 + ex, y - 2 + ey + bob, 3, 0, Math.PI * 2);
    ctx.arc(x + 5 + ex, y - 2 + ey + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1c2c';
    ctx.beginPath();
    ctx.arc(x - 5 + ex * 1.5, y - 2 + ey * 1.5 + bob, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 5 + ex * 1.5, y - 2 + ey * 1.5 + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 武器(指向鼠标)
    const gx = x + Math.cos(aimAngle) * (size / 2 + 4);
    const gy = y + Math.sin(aimAngle) * (size / 2 + 4) + bob;
    const gx2 = x + Math.cos(aimAngle) * (size / 2 + 18);
    const gy2 = y + Math.sin(aimAngle) * (size / 2 + 18) + bob;
    ctx.strokeStyle = '#566c86';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx2, gy2);
    ctx.stroke();
    ctx.strokeStyle = '#94b0c2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx2, gy2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  _drawEnemy(e) {
    const ctx = this.ctx;
    if (e.hp <= 0) {
      const fade = Math.max(0, e.dyingT);
      ctx.globalAlpha = fade * 0.6;
    }

    const wob = Math.sin(e.wobble) * 3;

    // 目标高亮圈
    if (e.isTarget && e.hp > 0 && !e.dying) {
      const pulse = 1 + Math.sin(e.pulseT) * 0.2;
      ctx.strokeStyle = '#ffec27';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(e.x, e.y + wob, e.size * 0.7 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = e.hp <= 0 ? Math.max(0, e.dyingT) * 0.6 : 1;
    }

    // 阴影
    if (e.hp > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + e.size / 2, e.size / 2, e.size / 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 按种类配色
    const colors = {
      wanderer: { body: '#b13e53', edge: '#5d275d' },
      chaser: { body: '#ef7d57', edge: '#8a3a1a' },
      dasher: { body: '#a7f070', edge: '#3a6a1a' },
      shield: { body: '#7c3aed', edge: '#3a1a6a' },
    };
    const col = colors[e.kind] || colors.wanderer;
    const bodyColor = e.dying ? '#666' : (e.rageTimer > 0 ? '#ff4444' : col.body);

    // 主体(圆角矩形)
    const r = 8;
    ctx.fillStyle = bodyColor;
    this._roundRect(e.x - e.size / 2, e.y - e.size / 2 + wob, e.size, e.size, r);
    ctx.fill();
    ctx.strokeStyle = col.edge;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 护盾
    if (e.shieldUp) {
      ctx.strokeStyle = '#7cd5ff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7 + Math.sin(e.wobble * 2) * 0.2;
      ctx.beginPath();
      ctx.arc(e.x, e.y + wob, e.size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = e.hp <= 0 ? Math.max(0, e.dyingT) * 0.6 : 1;
    }

    // emoji
    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.image, e.x, e.y + wob);

    // 英文单词
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#ffec27';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(e.word, e.x, e.y - e.size / 2 - 10 + wob);
    ctx.fillText(e.word, e.x, e.y - e.size / 2 - 10 + wob);

    // 血条(多血怪)
    if (e.maxHp > 1 && e.hp > 0) {
      const bw = e.size;
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x - bw / 2, e.y + e.size / 2 + 4 + wob, bw, 4);
      ctx.fillStyle = '#38b764';
      ctx.fillRect(e.x - bw / 2, e.y + e.size / 2 + 4 + wob, bw * (e.hp / e.maxHp), 4);
    }

    ctx.globalAlpha = 1;
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _drawBulletTrail(b) {
    const ctx = this.ctx;
    for (const t of b.trail) {
      ctx.globalAlpha = Math.max(0, t.life / 14) * 0.6;
      ctx.fillStyle = '#ffec27';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawBullet(b) {
    const ctx = this.ctx;
    // 光晕
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffec27';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 文字
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(b.text, b.x, b.y);
    ctx.fillText(b.text, b.x, b.y);
  }

  _drawParticle(p) {
    const ctx = this.ctx;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    if (p.emoji) {
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawFloat(f) {
    const ctx = this.ctx;
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  _drawCrosshair() {
    const ctx = this.ctx;
    const m = Input.mouse;
    ctx.strokeStyle = '#ffec27';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.x - 16, m.y); ctx.lineTo(m.x - 6, m.y);
    ctx.moveTo(m.x + 6, m.y); ctx.lineTo(m.x + 16, m.y);
    ctx.moveTo(m.x, m.y - 16); ctx.lineTo(m.x, m.y - 6);
    ctx.moveTo(m.x, m.y + 6); ctx.lineTo(m.x, m.y + 16);
    ctx.stroke();
    ctx.fillStyle = '#ffec27';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawHUD() {
    const ctx = this.ctx;
    // 顶部目标条
    if (this.currentWord && this.state === 'playing') {
      ctx.fillStyle = 'rgba(26, 28, 44, 0.92)';
      ctx.fillRect(0, 0, CANVAS_W, 50);
      ctx.strokeStyle = this.theme.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 50); ctx.lineTo(CANVAS_W, 50);
      ctx.stroke();

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#94b0c2';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎯 目标', 16, 25);

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#ffec27';
      ctx.fillText(this.currentWord.meaning, 90, 25);
      if (this.currentWord.image) {
        ctx.font = '26px serif';
        ctx.fillText(this.currentWord.image, 260, 25);
      }

      // 房间进度
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = this.theme.accent;
      ctx.textAlign = 'right';
      ctx.fillText(`${this.theme.name} · 房间 ${this.room}/${this.maxRooms}`, CANVAS_W - 16, 16);
      ctx.fillStyle = '#94b0c2';
      ctx.fillText(`击杀 ${this.killed}/${this.total}`, CANVAS_W - 16, 36);
    }

    // 连击
    if (this.combo >= 2) {
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = this.combo >= 5 ? '#ff6b6b' : '#98f5b4';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(`连击 x${this.combo}`, CANVAS_W / 2, 75);
      ctx.fillText(`连击 x${this.combo}`, CANVAS_W / 2, 75);
    }
  }
}
