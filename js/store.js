// データ層: localStorage への保存・学習記録（ライトナー方式）・統計

const KEY = 'tangocho:v1';
const API_KEY_KEY = 'tangocho:apikey'; // エクスポートに含めないため別キーで保持

export const DECK_COLORS = ['vermilion', 'mustard', 'teal', 'indigo', 'plum', 'moss'];
// box ごとの復習間隔（日）
const INTERVALS = [0, 1, 2, 4, 7, 14];
export const MAX_BOX = INTERVALS.length - 1;
const DAY = 86400000;

const SAMPLE_WORDS = [
  ['streamline', '合理化する、効率化する', 'We need to streamline the approval process.'],
  ['leverage', '活用する', 'leverage our existing data'],
  ['reconcile', '照合する、一致させる', 'reconcile the bank statements'],
  ['accrue', '（利息・費用などが）発生する、計上する', ''],
  ['bottleneck', 'ボトルネック、障害', ''],
  ['tentative', '仮の、暫定的な', 'a tentative schedule'],
  ['follow up', '追って連絡する、フォローする', "I'll follow up with you next week."],
  ['at your earliest convenience', 'ご都合がつき次第', ''],
  ['in the loop', '情報を共有されている状態', 'Please keep me in the loop.'],
  ['ballpark figure', '概算', 'Can you give me a ballpark figure?'],
  ['touch base', '軽く連絡を取り合う', ''],
  ['deliverable', '成果物', ''],
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultState() {
  return {
    version: 1,
    decks: [],
    words: [],
    stats: { days: {} },
    settings: { theme: 'auto', model: 'claude-opus-5', autoSpeak: false, seeded: false },
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    return {
      ...d,
      ...s,
      stats: { ...d.stats, ...(s.stats || {}) },
      settings: { ...d.settings, ...(s.settings || {}) },
    };
  } catch {
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('保存に失敗しました', e);
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function seedIfEmpty() {
  if (state.settings.seeded || state.decks.length) return;
  const deck = createDeck('サンプル：ビジネス英語', 'vermilion');
  addWords(deck.id, SAMPLE_WORDS.map(([en, ja, note]) => ({ en, ja, note })));
  state.settings.seeded = true;
  save();
}

// ── 設定 ────────────────────────────────────────────
export const getSettings = () => state.settings;
export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}
export function getApiKey() {
  try { return localStorage.getItem(API_KEY_KEY) || ''; } catch { return ''; }
}
export function setApiKey(v) {
  try {
    if (v) localStorage.setItem(API_KEY_KEY, v);
    else localStorage.removeItem(API_KEY_KEY);
  } catch {}
}

// ── 単語帳 ──────────────────────────────────────────
export const getDecks = () => state.decks;
export const getDeck = (id) => state.decks.find((d) => d.id === id);

export function createDeck(name, color) {
  const deck = {
    id: uid(),
    name: name.trim() || '新しい単語帳',
    color: color || DECK_COLORS[state.decks.length % DECK_COLORS.length],
    createdAt: Date.now(),
  };
  state.decks.push(deck);
  save();
  return deck;
}

export function updateDeck(id, patch) {
  const d = getDeck(id);
  if (!d) return;
  Object.assign(d, patch);
  save();
}

export function deleteDeck(id) {
  state.decks = state.decks.filter((d) => d.id !== id);
  state.words = state.words.filter((w) => w.deckId !== id);
  save();
}

// ── 単語 ────────────────────────────────────────────
export const getWords = (deckId) => (deckId ? state.words.filter((w) => w.deckId === deckId) : state.words);
export const getWord = (id) => state.words.find((w) => w.id === id);

export function normKey(en) {
  return (en || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function addWords(deckId, items) {
  const now = Date.now();
  const added = [];
  items.forEach((it, i) => {
    const en = (it.en || '').trim();
    const ja = (it.ja || '').trim();
    if (!en && !ja) return;
    const w = {
      id: uid() + i,
      deckId,
      en,
      ja,
      note: (it.note || '').trim(),
      star: false,
      box: 0,
      seen: 0,
      correct: 0,
      wrong: 0,
      lastResult: null,
      last: 0,
      due: 0,
      createdAt: now + i,
    };
    state.words.push(w);
    added.push(w);
  });
  save();
  return added;
}

export function updateWord(id, patch) {
  const w = getWord(id);
  if (!w) return;
  Object.assign(w, patch);
  save();
}

export function deleteWord(id) {
  state.words = state.words.filter((w) => w.id !== id);
  save();
}

export function restoreWord(word) {
  state.words.push(word);
  save();
}

export function resetProgress(deckId) {
  getWords(deckId).forEach((w) => {
    Object.assign(w, { box: 0, seen: 0, correct: 0, wrong: 0, lastResult: null, last: 0, due: 0 });
  });
  save();
}

// ── 学習状態 ────────────────────────────────────────
// new: 未学習 / learning: 学習中 / mastered: 習得
export function statusOf(w) {
  if (!w.seen) return 'new';
  return w.box >= 4 ? 'mastered' : 'learning';
}
export function isWeak(w) {
  return w.seen > 0 && w.box < 4 && (w.lastResult === false || w.wrong >= 2);
}
export function isDue(w, now = Date.now()) {
  return w.seen > 0 && w.due <= now;
}

export function deckSummary(deckId) {
  const words = getWords(deckId);
  const sum = { total: words.length, new: 0, learning: 0, mastered: 0, due: 0, weak: 0, star: 0 };
  const now = Date.now();
  for (const w of words) {
    sum[statusOf(w)]++;
    if (isDue(w, now)) sum.due++;
    if (isWeak(w)) sum.weak++;
    if (w.star) sum.star++;
  }
  return sum;
}

// 回答を記録。戻り値は取り消し用のスナップショット
export function recordAnswer(id, ok) {
  const w = getWord(id);
  if (!w) return null;
  const snapshot = { id, prev: { box: w.box, seen: w.seen, correct: w.correct, wrong: w.wrong, lastResult: w.lastResult, last: w.last, due: w.due } };
  const now = Date.now();
  w.seen++;
  w.last = now;
  w.lastResult = ok;
  if (ok) {
    w.correct++;
    w.box = Math.min(MAX_BOX, Math.max(1, w.box + 1));
  } else {
    w.wrong++;
    w.box = 1;
  }
  w.due = now + INTERVALS[w.box] * DAY;
  const k = todayKey();
  const day = state.stats.days[k] || (state.stats.days[k] = { answered: 0, correct: 0 });
  day.answered++;
  if (ok) day.correct++;
  save();
  return snapshot;
}

export function undoAnswer(snapshot, ok) {
  if (!snapshot) return;
  const w = getWord(snapshot.id);
  if (w) Object.assign(w, snapshot.prev);
  const day = state.stats.days[todayKey()];
  if (day) {
    day.answered = Math.max(0, day.answered - 1);
    if (ok) day.correct = Math.max(0, day.correct - 1);
  }
  save();
}

// ── 統計 ────────────────────────────────────────────
export function getTodayStats() {
  return state.stats.days[todayKey()] || { answered: 0, correct: 0 };
}

export function getStreak() {
  let streak = 0;
  const d = new Date();
  if (!(state.stats.days[todayKey(d)]?.answered > 0)) d.setDate(d.getDate() - 1); // 今日まだでも昨日までの連続は維持
  while (state.stats.days[todayKey(d)]?.answered > 0) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getWeek() {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const k = todayKey(d);
    out.push({ key: k, label: '日月火水木金土'[d.getDay()], answered: state.stats.days[k]?.answered || 0, isToday: i === 6 });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ── バックアップ ────────────────────────────────────
export function exportJSON() {
  return JSON.stringify({ app: 'tangocho', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function exportCSV(deckId) {
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['deck', 'en', 'ja', 'note'].join(',')];
  for (const w of getWords(deckId)) {
    rows.push([esc(getDeck(w.deckId)?.name), esc(w.en), esc(w.ja), esc(w.note)].join(','));
  }
  return '﻿' + rows.join('\r\n');
}

// mode: 'merge'（追加）| 'replace'（置き換え）
export function importJSON(text, mode = 'merge') {
  const data = JSON.parse(text);
  if (!Array.isArray(data.decks) || !Array.isArray(data.words)) throw new Error('Tangocho のバックアップ形式ではありません');
  if (mode === 'replace') {
    const d = defaultState();
    state = { ...d, decks: data.decks, words: data.words, stats: data.stats || d.stats, settings: { ...state.settings, seeded: true } };
  } else {
    const idMap = new Map();
    for (const deck of data.decks) {
      const nd = { ...deck, id: uid() };
      idMap.set(deck.id, nd.id);
      state.decks.push(nd);
    }
    data.words.forEach((w, i) => {
      if (!idMap.has(w.deckId)) return;
      state.words.push({ ...w, id: uid() + i, deckId: idMap.get(w.deckId) });
    });
  }
  save();
  return { decks: data.decks.length, words: data.words.length };
}

export function wipeAll() {
  const settings = { ...state.settings, seeded: true };
  state = { ...defaultState(), settings };
  save();
}
