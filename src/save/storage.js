/**
 * Storage · localStorage 存档管理
 *
 * 存档结构:
 * wordrogue-jr/
 *   users: [{id, name, grade, avatar, createdAt, lastPlayedAt}]
 *   progress: {
 *     [userId]: {
 *       wordStats: {[word]: {correct, wrong, lastSeen}},
 *       wrongWords: [word, ...],  // 错词队列
 *       levelProgress: {[levelId]: {bestScore, stars, completed}},
 *       settings: {soundOn, ...}
 *     }
 *   }
 *   currentUserId: string
 */

const STORAGE_KEY = 'wordrogue-jr-v1';

export const Storage = {
  data: null,

  /** 加载存档(成功返回 true) */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      this.data = JSON.parse(raw);
      return true;
    } catch (e) {
      console.warn('存档损坏,重新初始化', e);
      return false;
    }
  },

  /** 初始化空存档 */
  init() {
    this.data = {
      users: [],
      progress: {},
      currentUserId: null,
    };
    this.save();
  },

  /** 持久化 */
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  },

  // === 用户 ===

  listUsers() {
    return this.data.users;
  },

  getUser(userId) {
    return this.data.users.find(u => u.id === userId);
  },

  createUser(name, grade) {
    const user = {
      id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      grade: Number(grade),
      avatar: this._pickAvatar(),
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
    };
    this.data.users.push(user);
    this.data.progress[user.id] = {
      wordStats: {},
      wrongWords: [],
      levelProgress: {},
      settings: { soundOn: true },
    };
    this.save();
    return user;
  },

  deleteUser(userId) {
    this.data.users = this.data.users.filter(u => u.id !== userId);
    delete this.data.progress[userId];
    if (this.data.currentUserId === userId) {
      this.data.currentUserId = null;
    }
    this.save();
  },

  setCurrentUser(userId) {
    this.data.currentUserId = userId;
    this.save();
  },

  getCurrentUser() {
    return this.getUser(this.data.currentUserId);
  },

  getCurrentProgress() {
    return this.data.progress[this.data.currentUserId];
  },

  // === 关卡进度 ===

  setLevelProgress(userId, levelId, result) {
    const p = this.data.progress[userId];
    if (!p) return;
    const current = p.levelProgress[levelId] || { bestScore: 0, stars: 0, completed: false };
    current.bestScore = Math.max(current.bestScore, result.score);
    current.stars = Math.max(current.stars, result.stars);
    if (result.completed) current.completed = true;
    p.levelProgress[levelId] = current;
    this.save();
  },

  getLevelProgress(userId, levelId) {
    return this.data.progress[userId]?.levelProgress[levelId] || null;
  },

  // === 错词本 ===

  recordWordResult(userId, word, isCorrect) {
    const p = this.data.progress[userId];
    if (!p) return;
    if (!p.wordStats[word]) {
      p.wordStats[word] = { correct: 0, wrong: 0, lastSeen: 0 };
    }
    p.wordStats[word].lastSeen = Date.now();
    if (isCorrect) {
      p.wordStats[word].correct++;
      // 答对一次,从错词队列移除
      p.wrongWords = p.wrongWords.filter(w => w !== word);
    } else {
      p.wordStats[word].wrong++;
      // 答错,加入错词队列(去重)
      if (!p.wrongWords.includes(word)) {
        p.wrongWords.push(word);
      }
    }
    this.save();
  },

  getWrongWords(userId) {
    return this.data.progress[userId]?.wrongWords || [];
  },

  getWordStats(userId, word) {
    return this.data.progress[userId]?.wordStats[word] || null;
  },

  // === 导出 / 导入(给家长备份) ===

  exportToJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importFromJSON(json) {
    try {
      const data = JSON.parse(json);
      this.data = data;
      this.save();
      return true;
    } catch (e) {
      console.error('导入失败', e);
      return false;
    }
  },

  // === 辅助 ===

  _pickAvatar() {
    const avatars = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐯', '🦁', '🐸', '🐵', '🦄', '🐧'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  },
};
