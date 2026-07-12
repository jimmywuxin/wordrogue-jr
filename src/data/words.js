/**
 * 词汇数据 · 粤教粤人版 4-6 年级
 *
 * 数据格式:
 * {
 *   id: 'w-001',
 *   word: 'apple',
 *   meaning: '苹果',
 *   grade: 4,                 // 4/5/6
 *   unit: 1,                  // 单元号(1-N)
 *   image: '🍎',              // emoji 占位,后期可换 PNG
 *   phonetic: '/ˈæpl/',      // 可选
 *   example: 'I like apples.', // 可选,游戏内显示用
 * }
 *
 * 本文件数据来自粤教粤人版 4-6 年级 PDF Glossary 自动抽取(240 词 / 17 关)
 */

// 词库主数据来自 ./words-extracted.js(由 docs/extract_words.py 从 PDF 自动抽取)。
// 这里只做 re-export,避免双份数据漂移。
// 如需重新抽取词库:运行 `python3 docs/extract_words.py` 覆盖 words-extracted.js。
import { EXTRACTED_WORDS } from './words-extracted.js';
export const WORDS = EXTRACTED_WORDS;


// 关卡定义:每个关卡对应一组单词 + 模式
export const LEVELS = [
  {
    id: "g4-u1",
    name: "4 \u5e74\u7ea7 \u00b7 Unit 1",
    grade: 4,
    unit: 1,
    mode: "choose",
    wordCount: 10,
    theme: { emoji: "🗓️", label: "星期 · 学科" },
  },
  {
    id: "g4-u4",
    name: "4 \u5e74\u7ea7 \u00b7 Unit 4",
    grade: 4,
    unit: 4,
    mode: "choose",
    wordCount: 10,
    theme: { emoji: "🌅", label: "日常活动" },
  },
  {
    id: "g4-u5",
    name: "4 \u5e74\u7ea7 \u00b7 Unit 5",
    grade: 4,
    unit: 5,
    mode: "choose",
    wordCount: 9,
    theme: { emoji: "👨‍👩‍👧", label: "身体 · 家人" },
  },
  {
    id: "g4-u6",
    name: "4 \u5e74\u7ea7 \u00b7 Unit 6",
    grade: 4,
    unit: 6,
    mode: "choose",
    wordCount: 7,
    theme: { emoji: "🧸", label: "衣物 · 玩具" },
  },
  {
    id: "g4-u8",
    name: "4 \u5e74\u7ea7 \u00b7 Unit 8",
    grade: 4,
    unit: 8,
    mode: "choose",
    wordCount: 6,
    theme: { emoji: "💃", label: "身体 · 动作" },
  },
  {
    id: "g5-u1",
    name: "5 \u5e74\u7ea7 \u00b7 Unit 1",
    grade: 5,
    unit: 1,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "🏖️", label: "节日 · 旅行" },
  },
  {
    id: "g5-u2",
    name: "5 \u5e74\u7ea7 \u00b7 Unit 2",
    grade: 5,
    unit: 2,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "📅", label: "月份 · 爱好" },
  },
  {
    id: "g5-u3",
    name: "5 \u5e74\u7ea7 \u00b7 Unit 3",
    grade: 5,
    unit: 3,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "☁️", label: "天气 · 月份" },
  },
  {
    id: "g5-u4",
    name: "5 \u5e74\u7ea7 \u00b7 Unit 4",
    grade: 5,
    unit: 4,
    mode: "spell",
    wordCount: 7,
    theme: { emoji: "🎒", label: "学校 · 频度" },
  },
  {
    id: "g5-u5",
    name: "5 \u5e74\u7ea7 \u00b7 Unit 5",
    grade: 5,
    unit: 5,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "💰", label: "钱 · 喜欢" },
  },
  {
    id: "g5-u6",
    name: "5 \u5e74\u7ea7 \u00b7 Unit 6",
    grade: 5,
    unit: 6,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "🧹", label: "频率 · 家务" },
  },
  {
    id: "g6-u1",
    name: "6 \u5e74\u7ea7 \u00b7 Unit 1",
    grade: 6,
    unit: 1,
    mode: "spell",
    wordCount: 9,
    theme: { emoji: "🏥", label: "安全 · 健康" },
  },
  {
    id: "g6-u2",
    name: "6 \u5e74\u7ea7 \u00b7 Unit 2",
    grade: 6,
    unit: 2,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "🍽️", label: "数量 · 食物" },
  },
  {
    id: "g6-u3",
    name: "6 \u5e74\u7ea7 \u00b7 Unit 3",
    grade: 6,
    unit: 3,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "🍫", label: "情绪 · 甜食" },
  },
  {
    id: "g6-u4",
    name: "6 \u5e74\u7ea7 \u00b7 Unit 4",
    grade: 6,
    unit: 4,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "🧺", label: "物品 · 形容词" },
  },
  {
    id: "g6-u5",
    name: "6 \u5e74\u7ea7 \u00b7 Unit 5",
    grade: 6,
    unit: 5,
    mode: "spell",
    wordCount: 3,
    theme: { emoji: "👍", label: "评价 · 感受" },
  },
  {
    id: "g6-u6",
    name: "6 \u5e74\u7ea7 \u00b7 Unit 6",
    grade: 6,
    unit: 6,
    mode: "spell",
    wordCount: 10,
    theme: { emoji: "🎒", label: "动作 · 探索" },
  },
];

// 取关卡用的词
export function getWordsForLevel(levelId) {
  const level = LEVELS.find(l => l.id === levelId);
  if (!level) return [];
  return WORDS.filter(w => w.grade === level.grade && w.unit === level.unit);
}

/**
 * 从关卡词库里挑一批词,带优先级:
 *  1. 错词本里属于本关卡的(强制带上,容易遇到)
 *  2. 剩余名额从关卡随机抽
 *  - 上限 = LEVELS.wordCount(默认 10)
 */
export function selectLevelWords(levelId, wrongWords = []) {
  const pool = getWordsForLevel(levelId);
  if (pool.length === 0) return [];
  const cap = Math.max(1, ((LEVELS.find(l => l.id === levelId) || {}).wordCount) || 10);
  if (pool.length <= cap) return pool;

  const wrongSet = new Set(wrongWords);
  const wrongInPool = pool.filter(w => wrongSet.has(w.word));
  const rest = pool.filter(w => !wrongSet.has(w.word));
  rest.sort(() => Math.random() - 0.5);

  const picked = [...wrongInPool];
  for (const w of rest) {
    if (picked.length >= cap) break;
    picked.push(w);
  }
  return picked;
}

// 通用占位词:跨年级抽不到时使用
const FALLBACK_WORDS = [
  { id: 'fb-cat', word: 'cat', meaning: '猫' },
  { id: 'fb-dog', word: 'dog', meaning: '狗' },
  { id: 'fb-sun', word: 'sun', meaning: '太阳' },
  { id: 'fb-book', word: 'book', meaning: '书' },
  { id: 'fb-tree', word: 'tree', meaning: '树' },
  { id: 'fb-water', word: 'water', meaning: '水' },
  { id: 'fb-fish', word: 'fish', meaning: '鱼' },
  { id: 'fb-bird', word: 'bird', meaning: '鸟' },
  { id: 'fb-apple', word: 'apple', meaning: '苹果' },
  { id: 'fb-milk', word: 'milk', meaning: '牛奶' },
  { id: 'fb-rice', word: 'rice', meaning: '米饭' },
  { id: 'fb-ball', word: 'ball', meaning: '球' },
];

/** 选干扰项,优先级:同 unit → 同 grade → 全局 → 通用占位 */
export function getDistractors(target, count = 3) {
  // 已选过的,避免重复
  const taken = new Set([target.word]);
  const picked = [];

  function fillFrom(pool) {
    const candidates = pool
      .filter(w => !taken.has(w.word))
      .sort(() => Math.random() - 0.5);
    for (const c of candidates) {
      if (picked.length >= count) break;
      picked.push(c);
      taken.add(c.word);
    }
  }

  // 1. 同 unit
  fillFrom(WORDS.filter(w => w.unit === target.unit && w.id !== target.id));
  // 2. 同 grade 其他 unit
  if (picked.length < count) {
    fillFrom(WORDS.filter(w => w.grade === target.grade && w.unit !== target.unit));
  }
  // 3. 全局
  if (picked.length < count) {
    fillFrom(WORDS.filter(w => w.grade !== target.grade));
  }
  // 4. 兜底占位
  if (picked.length < count) {
    fillFrom(FALLBACK_WORDS);
  }
  return picked;
}
