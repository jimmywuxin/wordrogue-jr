/**
 * Review Screen · 错词复习
 */

import { Storage } from '../save/storage.js';
import { showScreen } from './screen.js';
import { WORDS } from '../data/words.js';
import * as sfx from '../audio/sfx.js';

let onPlayWrongCallback = null;

export function initReviewScreen() {
  const btnBack = document.getElementById('btn-back-levels-2');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      sfx.sfxClick();
      showScreen('level');
    });
  }
  const btnPlay = document.getElementById('btn-play-wrong');
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      sfx.sfxClick();
      if (onPlayWrongCallback) onPlayWrongCallback();
    });
  }
}

export function setOnPlayWrongCallback(cb) {
  onPlayWrongCallback = cb;
}

export function showReview() {
  const user = Storage.getCurrentUser();
  if (!user) return;

  showScreen('review');
  const wrongWords = Storage.getWrongWords(user.id);
  document.getElementById('review-count').textContent = `共 ${wrongWords.length} 个`;

  const playBtn = document.getElementById('btn-play-wrong');
  if (playBtn) {
    playBtn.style.display = wrongWords.length > 0 ? '' : 'none';
  }

  const list = document.getElementById('review-list');
  if (wrongWords.length === 0) {
    list.innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;">没有错词了!继续保持 💪</p>';
    return;
  }

  // 按 grade / unit 分组
  const groups = {};
  for (const w of wrongWords) {
    const word = WORDS.find(x => x.word === w);
    if (!word) continue;
    const k = `${word.grade} 年级 · Unit ${word.unit}`;
    (groups[k] = groups[k] || []).push(word);
  }

  list.innerHTML = '';
  for (const [k, words] of Object.entries(groups)) {
    const h = document.createElement('div');
    h.className = 'grade-header';
    h.textContent = k;
    list.appendChild(h);
    for (const word of words) {
      const stats = Storage.getWordStats(user.id, word.word);
      const item = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML = `
        <div style="font-size:36px;">${word.image}</div>
        <div class="word">${escapeHtml(word.word)}</div>
        <div class="meaning">${escapeHtml(word.meaning)}</div>
        <div class="muted" style="font-size:11px;margin-top:4px;">
          错 ${stats?.wrong || 0} 次 · 对 ${stats?.correct || 0} 次
        </div>
      `;
      list.appendChild(item);
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
