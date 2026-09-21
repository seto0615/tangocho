import * as S from './store.js';
import { parsePairs } from './parse.js';
import { extractPairs, testConnection, MODELS, isImage, isPDF } from './ai.js';

const APP_VERSION = '1.0.0';
const $app = document.getElementById('app');
const $tabbar = document.getElementById('tabbar');
const $sheetRoot = document.getElementById('sheet-root');
const $toastRoot = document.getElementById('toast-root');

// ── 小道具 ──────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cards: '<rect x="4" y="8" width="12.5" height="12" rx="2"/><path d="M8 8V5.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-2"/>',
  settings: '<path d="M4 7h9M18.5 7H20M4 17h1.5M11 17h9"/><circle cx="15.7" cy="7" r="2.3"/><circle cx="8.3" cy="17" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.6-4.6"/>',
  star: '<path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.6L12 17l-5.1 2.6 1-5.6-4.1-4 5.7-.8z"/>',
  speaker: '<path d="M5 10v4h3l4 3.5v-11L8 10z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>',
  back: '<path d="m14.5 5-7 7 7 7"/>',
  next: '<path d="m9.5 5 7 7-7 7"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/>',
  sparkle: '<path d="M11 4.5 12.8 9.7 18 11.5l-5.2 1.8L11 18.5l-1.8-5.2L4 11.5l5.2-1.8z"/><path d="M18.5 3.5v3M17 5h3"/>',
  pencil: '<path d="m5 19 1-4L16.5 4.5l3 3L9 18z"/><path d="m14.5 6.5 3 3"/>',
  text: '<path d="M5 6.5h14M5 12h14M5 17.5h9"/>',
  shuffle: '<path d="M4 7h3c2.2 0 3.3 1 4.3 2.5l1.4 2c1 1.5 2.1 2.5 4.3 2.5h3"/><path d="M4 17h3c1.3 0 2.2-.4 3-1.1M20 7h-3c-1.3 0-2.2.4-3 1.1"/><path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  undo: '<path d="M8 8h7a4.5 4.5 0 0 1 0 9H9"/><path d="M11 5 8 8l3 3"/>',
  flame: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-2 1-3.5 2-4.5.2 1.5 1 2.5 2 3 0-3.5 0-6.5 2-9.5z"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  sheet: '<rect x="3.5" y="7.5" width="17" height="9" rx="1.5" fill="currentColor" fill-opacity=".25"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  key: '<circle cx="8" cy="15" r="3.5"/><path d="m10.5 12.5 8-8M15 8l2.5 2.5M17.5 5.5 19.5 7.5"/>',
  flip: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

function toast(message, { action, onAction, duration = 3200 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  $toastRoot.append(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  if (action) $('button', el).addEventListener('click', () => { onAction?.(); close(); });
  setTimeout(close, duration);
}

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.95;
    const voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-US' && /Samantha|Google US|Ava|Allison/i.test(v.name)) || speechSynthesis.getVoices().find((v) => v.lang?.startsWith('en'));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } catch {}
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function applyTheme() {
  const t = S.getSettings().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ── ボトムシート ────────────────────────────────────
let sheetOnClose = null;
function openSheet(html, { onMount, onClose } = {}) {
  closeSheet(true);
  sheetOnClose = onClose || null;
  $sheetRoot.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => $sheetRoot.classList.add('show'));
  onMount?.($('.sheet', $sheetRoot));
}
function closeSheet(immediate = false) {
  if (!$sheetRoot.firstChild) return;
  const done = () => { $sheetRoot.innerHTML = ''; document.body.classList.remove('sheet-open'); };
  $sheetRoot.classList.remove('show');
  const cb = sheetOnClose;
  sheetOnClose = null;
  if (immediate) done(); else setTimeout(done, 240);
  cb?.();
}

function confirmSheet({ title, body, confirmLabel, danger = false, onConfirm }) {
  openSheet(`
    <h2 class="sheet-title">${esc(title)}</h2>
    <p class="sheet-body">${esc(body)}</p>
    <div class="sheet-actions">
      <button type="button" class="btn ghost" data-action="close-sheet">やめる</button>
      <button type="button" class="btn ${danger ? 'danger' : 'primary'}" id="confirm-ok">${esc(confirmLabel)}</button>
    </div>`, {
    onMount: (el) => $('#confirm-ok', el).addEventListener('click', () => { closeSheet(); onConfirm(); }),
  });
}

// ── ルーター ────────────────────────────────────────
let session = null;
function parseRoute() {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const seg = path.split('/').filter(Boolean);
  return { name: seg[0] || 'home', id: seg[1] || null, query: new URLSearchParams(qs || '') };
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function render() {
  const r = parseRoute();
  closeSheet(true);
  const inSession = r.name === 'session' && session;
  document.body.classList.toggle('in-session', !!inSession);
  if (r.name === 'session' && !session) return go('#/study');

  switch (r.name) {
    case 'deck': viewDeck(r.id); break;
    case 'add': viewAdd(r.id, r.query.get('tab')); break;
    case 'study': viewStudy(r.id); break;
    case 'session': viewSession(); break;
    case 'settings': viewSettings(); break;
    default: viewHome();
  }
  renderTabbar(r.name);
  if (r.name !== 'session') window.scrollTo(0, 0);
}

function renderTabbar(active) {
  const tabs = [
    ['home', '#/', 'home', '単語帳'],
    ['add', '#/add', 'plus', '追加'],
    ['study', '#/study', 'cards', 'テスト'],
    ['settings', '#/settings', 'settings', '設定'],
  ];
  const current = active === 'deck' ? 'home' : active;
  $tabbar.innerHTML = tabs.map(([key, href, ic, label]) => `
    <a href="${href}" class="tab ${current === key ? 'active' : ''}" ${current === key ? 'aria-current="page"' : ''}>
      ${icon(ic)}<span>${label}</span>
    </a>`).join('');
}

// ── 共通パーツ ──────────────────────────────────────
function progressBar(sum) {
  const t = Math.max(1, sum.total);
  return `<div class="meter" role="img" aria-label="習得 ${sum.mastered}、学習中 ${sum.learning}、未学習 ${sum.new}">
    <i class="m-mastered" style="width:${(sum.mastered / t) * 100}%"></i><i class="m-learning" style="width:${(sum.learning / t) * 100}%"></i>
  </div>`;
}

function pageHead({ title, back, right = '', sub = '' }) {
  return `<header class="page-head">
    ${back ? `<a class="icon-btn" href="${back}" aria-label="戻る">${icon('back')}</a>` : ''}
    <div class="page-head-text"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    ${right}
  </header>`;
}

// ── ホーム ──────────────────────────────────────────
function viewHome() {
  const decks = S.getDecks();
  const today = S.getTodayStats();
  const streak = S.getStreak();
  const week = S.getWeek();
  const peak = Math.max(10, ...week.map((d) => d.answered));
  const all = S.deckSummary(null);
  const d = new Date();
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`;

  $app.innerHTML = `
    <header class="hero">
      <div class="brand">
        <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="12" width="26" height="20" rx="4" fill="var(--card)" stroke="currentColor" stroke-width="2.2"/><circle cx="15.5" cy="18.5" r="2.2" fill="var(--paper)" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 18.5C10 16 6 11 9.5 7.5c3.5-3.5 8 1 6 11z" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/></svg>
        <span>Tangocho</span>
      </div>
      <p class="hero-date">${dateLabel}</p>
    </header>

    <section class="today card-plain">
      <div class="today-stats">
        <div class="stat"><span class="stat-num">${streak}</span><span class="stat-label">${icon('flame')}連続日数</span></div>
        <div class="stat"><span class="stat-num">${today.answered}</span><span class="stat-label">今日の回答</span></div>
        <div class="stat"><span class="stat-num">${all.total ? Math.round((all.mastered / all.total) * 100) : 0}<small>%</small></span><span class="stat-label">習得率</span></div>
      </div>
      <div class="week" aria-label="直近7日間の回答数">
        ${week.map((w) => `<div class="week-day ${w.isToday ? 'today-col' : ''}"><div class="week-bar"><i style="height:${Math.max(w.answered ? 12 : 4, (w.answered / peak) * 100)}%" class="${w.answered ? 'on' : ''}"></i></div><span>${w.label}</span></div>`).join('')}
      </div>
      ${all.due > 0 ? `<button type="button" class="btn primary block" data-action="quick-review">${icon('clock')}今日の復習 ${all.due}語をはじめる</button>` : ''}
    </section>

    <section class="section">
      <div class="section-head">
        <h2>単語帳</h2>
        <button type="button" class="btn small ghost" data-action="new-deck">${icon('plus')}新しく作る</button>
      </div>
      ${decks.length ? `<ul class="deck-grid">${decks.map(deckCard).join('')}</ul>` : `
        <div class="empty">
          <p class="empty-title">まだ単語帳がありません</p>
          <p>スクリーンショットをAIで読み取るか、手入力で最初の単語帳をつくりましょう。</p>
          <a class="btn primary" href="#/add">${icon('plus')}単語を追加する</a>
        </div>`}
    </section>`;
}

function deckCard(deck, i) {
  const sum = S.deckSummary(deck.id);
  return `<li style="--i:${i}">
    <a class="deck c-${esc(deck.color)}" href="#/deck/${deck.id}">
      <span class="deck-ring" aria-hidden="true"></span>
      <span class="deck-name">${esc(deck.name)}</span>
      <span class="deck-count"><b>${sum.total}</b>語${sum.due ? `<em>復習 ${sum.due}</em>` : ''}</span>
      ${progressBar(sum)}
    </a>
  </li>`;
}

function newDeckSheet(onCreated) {
  openSheet(`
    <h2 class="sheet-title">新しい単語帳</h2>
    <form id="deck-form" class="form">
      <label class="field"><span>名前</span><input name="name" type="text" placeholder="例：TOEIC 頻出 / 海外ドラマのフレーズ" maxlength="40" required autocomplete="off"></label>
      <div class="field"><span>色</span>
        <div class="swatches">${S.DECK_COLORS.map((c, i) => `<label class="swatch c-${c}"><input type="radio" name="color" value="${c}" ${i === S.getDecks().length % S.DECK_COLORS.length ? 'checked' : ''}><i></i></label>`).join('')}</div>
      </div>
      <div class="sheet-actions"><button type="button" class="btn ghost" data-action="close-sheet">やめる</button><button class="btn primary">つくる</button></div>
    </form>`, {
    onMount: (el) => {
      const form = $('#deck-form', el);
      setTimeout(() => form.name.focus(), 260);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const deck = S.createDeck(form.name.value, form.color.value);
        closeSheet();
        onCreated ? onCreated(deck) : go(`#/deck/${deck.id}`);
      });
    },
  });
}

// ── 単語帳の中身 ────────────────────────────────────
const SORTS = { created: '新しい順', abc: 'ABC順', weak: '苦手順' };
const deckUI = { id: null, query: '', filter: 'all', sort: 'created', redSheet: false };

function filteredWords(deckId) {
  let words = S.getWords(deckId);
  const q = deckUI.query.trim().toLowerCase();
  if (q) words = words.filter((w) => w.en.toLowerCase().includes(q) || w.ja.toLowerCase().includes(q) || w.note.toLowerCase().includes(q));
  const f = deckUI.filter;
  if (f === 'star') words = words.filter((w) => w.star);
  else if (f === 'weak') words = words.filter(S.isWeak);
  else if (f !== 'all') words = words.filter((w) => S.statusOf(w) === f);
  if (deckUI.sort === 'abc') words = [...words].sort((a, b) => a.en.localeCompare(b.en, 'en', { sensitivity: 'base' }));
  else if (deckUI.sort === 'weak') words = [...words].sort((a, b) => (b.wrong - b.correct) - (a.wrong - a.correct));
  else words = [...words].sort((a, b) => b.createdAt - a.createdAt);
  return words;
}

function wordRow(w) {
  const st = S.statusOf(w);
  return `<li class="word" data-id="${w.id}">
    <button type="button" class="word-main" data-action="word-tap">
      <span class="word-en">${esc(w.en) || '<i class="muted">（英語なし）</i>'}</span>
      <span class="word-ja">${w.ja ? `<span class="ja-text">${esc(w.ja)}</span>` : '<i class="muted">訳が未入力です</i>'}</span>
      ${w.note ? `<span class="word-note">${esc(w.note)}</span>` : ''}
    </button>
    <div class="word-side">
      <span class="status-dot s-${st}" title="${{ new: '未学習', learning: '学習中', mastered: '習得' }[st]}"></span>
      <button type="button" class="icon-btn small" data-action="speak" aria-label="発音を聞く">${icon('speaker')}</button>
      <button type="button" class="icon-btn small star ${w.star ? 'on' : ''}" data-action="toggle-star" aria-label="スター" aria-pressed="${w.star}">${icon('star')}</button>
    </div>
  </li>`;
}

function renderWordList(deckId) {
  const list = $('#word-list');
  if (!list) return;
  const words = filteredWords(deckId);
  list.classList.toggle('red-sheet', deckUI.redSheet);
  list.innerHTML = words.length ? words.map(wordRow).join('') : `<li class="empty small"><p>${deckUI.query || deckUI.filter !== 'all' ? '条件に合う単語がありません。' : 'まだ単語がありません。'}</p></li>`;
  const c = $('#list-count');
  if (c) c.textContent = `${words.length}語`;
}

function viewDeck(id) {
  const deck = S.getDeck(id);
  if (!deck) return go('#/');
  if (deckUI.id !== id) Object.assign(deckUI, { id, query: '', filter: 'all', redSheet: false });
  const sum = S.deckSummary(id);
  const chips = [['all', 'すべて', sum.total], ['star', '★', sum.star], ['weak', '苦手', sum.weak], ['new', '未学習', sum.new], ['learning', '学習中', sum.learning], ['mastered', '習得', sum.mastered]];

  $app.innerHTML = `
    ${pageHead({ title: deck.name, back: '#/', right: `<button type="button" class="icon-btn" data-action="deck-menu" aria-label="メニュー">${icon('more')}</button>` })}
    <section class="deck-summary c-${esc(deck.color)}">
      <div class="deck-summary-nums">
        <div><b>${sum.total}</b><span>語</span></div>
        <div><b>${sum.total ? Math.round((sum.mastered / sum.total) * 100) : 0}<small>%</small></b><span>習得</span></div>
        <div><b>${sum.due}</b><span>復習期限</span></div>
      </div>
      ${progressBar(sum)}
      <div class="legend"><span><i class="s-mastered"></i>習得 ${sum.mastered}</span><span><i class="s-learning"></i>学習中 ${sum.learning}</span><span><i class="s-new"></i>未学習 ${sum.new}</span></div>
      <div class="cta-row">
        <a class="btn primary" href="#/study/${id}">${icon('cards')}テストする</a>
        <a class="btn" href="#/add/${id}">${icon('plus')}単語を追加</a>
      </div>
    </section>

    <section class="section">
      <div class="search">${icon('search')}<input id="word-search" type="search" placeholder="英語・日本語で検索" value="${esc(deckUI.query)}" autocomplete="off" enterkeyhint="search"></div>
      <div class="chips" role="tablist">
        ${chips.map(([k, label, n]) => `<button type="button" class="chip ${deckUI.filter === k ? 'on' : ''}" data-action="set-filter" data-filter="${k}">${label}<small>${n}</small></button>`).join('')}
      </div>
      <div class="list-tools">
        <span id="list-count" class="muted"></span>
        <div class="list-tools-right">
          <button type="button" class="toggle-pill ${deckUI.redSheet ? 'on' : ''}" data-action="toggle-redsheet" aria-pressed="${deckUI.redSheet}">${icon('sheet')}赤シート</button>
          <button type="button" class="toggle-pill" data-action="cycle-sort" aria-label="並び順を切り替える">${icon('shuffle')}<span id="sort-label">${SORTS[deckUI.sort]}</span></button>
        </div>
      </div>
      <ul id="word-list" class="word-list"></ul>
    </section>`;
  renderWordList(id);

  $('#word-search').addEventListener('input', (e) => { deckUI.query = e.target.value; renderWordList(id); });
}

function editWordSheet(wordId) {
  const w = S.getWord(wordId);
  if (!w) return;
  const decks = S.getDecks();
  const next = w.seen ? (w.due <= Date.now() ? '復習期限です' : `次の復習：${Math.ceil((w.due - Date.now()) / 86400000)}日後`) : 'まだテストしていません';
  openSheet(`
    <h2 class="sheet-title">単語を編集</h2>
    <form id="word-form" class="form">
      <label class="field"><span>英語</span><input name="en" type="text" value="${esc(w.en)}" autocomplete="off" autocapitalize="off" spellcheck="false" lang="en"></label>
      <label class="field"><span>日本語</span><input name="ja" type="text" value="${esc(w.ja)}" autocomplete="off" lang="ja"></label>
      <label class="field"><span>メモ・例文</span><textarea name="note" rows="2">${esc(w.note)}</textarea></label>
      ${decks.length > 1 ? `<label class="field"><span>単語帳</span><select name="deckId">${decks.map((d) => `<option value="${d.id}" ${d.id === w.deckId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>` : ''}
      <p class="muted small-text">正解 ${w.correct}回・不正解 ${w.wrong}回　${next}</p>
      <div class="sheet-actions">
        <button type="button" class="btn ghost danger-text" id="word-delete">${icon('trash')}削除</button>
        <button class="btn primary">保存</button>
      </div>
    </form>`, {
    onMount: (el) => {
      const form = $('#word-form', el);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        S.updateWord(wordId, { en: form.en.value.trim(), ja: form.ja.value.trim(), note: form.note.value.trim(), deckId: form.deckId?.value || w.deckId });
        closeSheet();
        render();
      });
      $('#word-delete', el).addEventListener('click', () => {
        const copy = { ...w };
        S.deleteWord(wordId);
        closeSheet();
        render();
        toast('削除しました', { action: '元に戻す', onAction: () => { S.restoreWord(copy); render(); } });
      });
    },
  });
}

function deckMenuSheet(deckId) {
  const deck = S.getDeck(deckId);
  openSheet(`
    <h2 class="sheet-title">${esc(deck.name)}</h2>
    <form id="rename-form" class="form">
      <label class="field"><span>名前</span><input name="name" type="text" value="${esc(deck.name)}" maxlength="40" required></label>
      <div class="field"><span>色</span><div class="swatches">${S.DECK_COLORS.map((c) => `<label class="swatch c-${c}"><input type="radio" name="color" value="${c}" ${c === deck.color ? 'checked' : ''}><i></i></label>`).join('')}</div></div>
      <button class="btn primary block">保存</button>
    </form>
    <div class="menu-list">
      <button type="button" data-menu="csv">${icon('download')}CSVで書き出す</button>
      <button type="button" data-menu="reset">${icon('undo')}学習記録をリセット</button>
      <button type="button" data-menu="delete" class="danger-text">${icon('trash')}この単語帳を削除</button>
    </div>`, {
    onMount: (el) => {
      const form = $('#rename-form', el);
      form.addEventListener('submit', (e) => { e.preventDefault(); S.updateDeck(deckId, { name: form.name.value.trim() || deck.name, color: form.color.value }); closeSheet(); render(); });
      el.addEventListener('click', (e) => {
        const m = e.target.closest('[data-menu]')?.dataset.menu;
        if (m === 'csv') { download(`${deck.name}.csv`, S.exportCSV(deckId), 'text/csv;charset=utf-8'); closeSheet(); }
        if (m === 'reset') confirmSheet({ title: '学習記録をリセット', body: 'この単語帳の正解・不正解の記録を消して、すべて「未学習」に戻します。単語は消えません。', confirmLabel: 'リセットする', danger: true, onConfirm: () => { S.resetProgress(deckId); render(); toast('学習記録をリセットしました'); } });
        if (m === 'delete') confirmSheet({ title: '単語帳を削除', body: `「${deck.name}」と中の単語 ${S.getWords(deckId).length}語をすべて削除します。元に戻せません。`, confirmLabel: '削除する', danger: true, onConfirm: () => { S.deleteDeck(deckId); go('#/'); toast('単語帳を削除しました'); } });
      });
    },
  });
}

// ── 追加（AI読み取り／手入力／テキスト）─────────────
const addUI = { deckId: null, tab: 'ai', files: [], text: '', review: null, busy: false, progress: null, recent: [] };

function ensureAddDeck(preferred) {
  const decks = S.getDecks();
  if (preferred && S.getDeck(preferred)) addUI.deckId = preferred;
  if (!addUI.deckId || !S.getDeck(addUI.deckId)) addUI.deckId = decks[decks.length - 1]?.id || null;
}

function viewAdd(deckId, tab) {
  ensureAddDeck(deckId);
  if (tab && ['ai', 'manual', 'text'].includes(tab)) addUI.tab = tab;
  const decks = S.getDecks();
  const tabs = [['ai', 'sparkle', 'AI読み取り'], ['manual', 'pencil', '手入力'], ['text', 'text', 'テキスト']];

  $app.innerHTML = `
    ${pageHead({ title: '単語を追加', back: deckId ? `#/deck/${deckId}` : null })}
    <section class="add-target">
      <label class="field inline"><span>追加先</span>
        <select id="add-deck">
          ${decks.map((d) => `<option value="${d.id}" ${d.id === addUI.deckId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
          <option value="__new">＋ 新しい単語帳をつくる</option>
        </select>
      </label>
    </section>
    <div class="segmented" role="tablist">
      ${tabs.map(([k, ic, label]) => `<button type="button" role="tab" aria-selected="${addUI.tab === k}" class="${addUI.tab === k ? 'on' : ''}" data-action="add-tab" data-tab="${k}">${icon(ic)}${label}</button>`).join('')}
    </div>
    <div id="add-body"></div>`;

  $('#add-deck').addEventListener('change', (e) => {
    if (e.target.value === '__new') newDeckSheet((deck) => { addUI.deckId = deck.id; render(); });
    else addUI.deckId = e.target.value;
    if (addUI.review) renderAddBody();
  });
  if (!decks.length) {
    $('#add-deck').innerHTML = '<option value="__new">＋ 新しい単語帳をつくる</option>';
  }
  renderAddBody();
}

function renderAddBody() {
  const body = $('#add-body');
  if (!body) return;
  if (addUI.review) return renderReview(body);
  if (addUI.tab === 'ai') renderAddAI(body);
  else if (addUI.tab === 'manual') renderAddManual(body);
  else renderAddText(body);
}

async function requireDeck() {
  if (addUI.deckId && S.getDeck(addUI.deckId)) return true;
  return new Promise((resolve) => newDeckSheet((deck) => { addUI.deckId = deck.id; render(); resolve(true); }));
}

// AI読み取り
const thumbURLs = new WeakMap();
function thumbURL(file) {
  if (!thumbURLs.has(file)) thumbURLs.set(file, URL.createObjectURL(file));
  return thumbURLs.get(file);
}

function renderAddAI(body) {
  const hasKey = !!S.getApiKey();
  const files = addUI.files;
  body.innerHTML = `
    ${hasKey ? '' : `<div class="notice">${icon('key')}<div><b>はじめにAPIキーの登録が必要です</b><p>AI読み取りは Claude API を使います。キーはこの端末の中だけに保存されます。</p><a class="btn small primary" href="#/settings">設定を開く</a></div></div>`}
    <label class="dropzone ${addUI.busy ? 'busy' : ''}" id="dropzone">
      <input id="file-input" type="file" accept="image/*,application/pdf" multiple hidden ${addUI.busy ? 'disabled' : ''}>
      <span class="dropzone-icon">${icon('image')}</span>
      <b>スクリーンショット・写真を選ぶ</b>
      <small>複数枚まとめてOK。字幕つき動画の画面、単語リスト、ノートの写真、PDFなど。英語と訳をAIが見つけて対応づけます。</small>
    </label>
    ${files.length ? `<ul class="thumbs ${addUI.busy ? 'scanning' : ''}">${files.map((f, i) => `
      <li>${isPDF(f) ? `<div class="thumb-pdf">PDF<small>${esc(f.name)}</small></div>` : `<img src="${thumbURL(f)}" alt="${esc(f.name)}">`}
        ${addUI.busy ? '' : `<button type="button" class="thumb-x" data-action="remove-file" data-index="${i}" aria-label="取り除く">${icon('x')}</button>`}
      </li>`).join('')}</ul>` : ''}
    ${addUI.busy ? `<div class="scan-status"><span class="spinner"></span><span id="scan-text">${esc(scanText())}</span></div>` : `
      <button type="button" class="btn primary block big" data-action="run-ocr" ${files.length && hasKey ? '' : 'disabled'}>${icon('sparkle')}AIで読み取る${files.length ? `（${files.length}件）` : ''}</button>`}
    <p class="hint">デスクトップでは、画像をこの画面にドラッグするか、コピーした画像を貼り付けても追加できます。</p>`;

  const input = $('#file-input', body);
  input.addEventListener('change', () => { addFiles([...input.files]); input.value = ''; });
  const dz = $('#dropzone', body);
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); addFiles([...e.dataTransfer.files]); });
}

function scanText() {
  const p = addUI.progress;
  if (!p) return '画像を準備しています…';
  const step = p.total > 1 ? `（${p.step}/${p.total}）` : '';
  return p.found ? `読み取り中${step}… ${p.found}語を検出` : `AIが画像を読んでいます${step}…`;
}

function addFiles(list) {
  const ok = list.filter((f) => isImage(f) || isPDF(f));
  if (ok.length < list.length) toast('画像とPDF以外のファイルは読み取れません');
  if (!ok.length) return;
  addUI.files.push(...ok);
  if (addUI.tab !== 'ai') addUI.tab = 'ai';
  if (parseRoute().name === 'add') render(); else go('#/add');
}

async function runAI({ files = [], text = '' }) {
  if (addUI.busy) return;
  if (!S.getApiKey()) { toast('設定画面でAPIキーを登録してください'); return; }
  await requireDeck();
  addUI.busy = true;
  addUI.progress = null;
  renderAddBody();
  try {
    const items = await extractPairs({
      apiKey: S.getApiKey(),
      model: S.getSettings().model,
      files,
      text,
      onProgress: (p) => { addUI.progress = p; const el = $('#scan-text'); if (el) el.textContent = scanText(); },
    });
    addUI.busy = false;
    if (!items.length) { toast('英語と日本語のペアが見つかりませんでした'); renderAddBody(); return; }
    startReview(items, 'ai');
  } catch (e) {
    console.error(e);
    addUI.busy = false;
    renderAddBody();
    toast(e.message || '読み取りに失敗しました', { duration: 6000 });
  }
}

// 手入力
function renderAddManual(body) {
  body.innerHTML = `
    <form id="manual-form" class="form card-plain">
      <label class="field"><span>英語</span><input name="en" type="text" placeholder="例：take it for granted" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="en" enterkeyhint="next"></label>
      <label class="field"><span>日本語</span><input name="ja" type="text" placeholder="例：当然のことと思う" autocomplete="off" lang="ja" enterkeyhint="done"></label>
      <label class="field"><span>メモ・例文<small>（任意）</small></span><input name="note" type="text" placeholder="例文や覚え方など" autocomplete="off"></label>
      <button class="btn primary block big">${icon('plus')}追加して次へ</button>
    </form>
    ${addUI.recent.length ? `<div class="section-head"><h2>いま追加した単語</h2><span class="muted">${addUI.recent.length}語</span></div>
      <ul class="word-list compact">${addUI.recent.map((id) => S.getWord(id)).filter(Boolean).map((w) => `
        <li class="word" data-id="${w.id}"><div class="word-main static"><span class="word-en">${esc(w.en)}</span><span class="word-ja"><span class="ja-text">${esc(w.ja)}</span></span></div>
        <div class="word-side"><button type="button" class="icon-btn small" data-action="remove-recent" aria-label="取り消す">${icon('x')}</button></div></li>`).join('')}</ul>` : ''}`;

  const form = $('#manual-form', body);
  form.en.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); form.ja.focus(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const en = form.en.value.trim();
    const ja = form.ja.value.trim();
    if (!en || !ja) { toast('英語と日本語の両方を入力してください'); (en ? form.ja : form.en).focus(); return; }
    await requireDeck();
    const dup = S.getWords(addUI.deckId).some((w) => S.normKey(w.en) === S.normKey(en));
    const [w] = S.addWords(addUI.deckId, [{ en, ja, note: form.note.value }]);
    addUI.recent.unshift(w.id);
    renderAddManual($('#add-body'));
    $('#manual-form [name=en]')?.focus();
    toast(dup ? `追加しました（「${en}」は登録済みでした）` : '追加しました');
  });
}

// テキスト貼り付け・ファイル
function renderAddText(body) {
  const hasKey = !!S.getApiKey();
  body.innerHTML = `
    <div class="form card-plain">
      <label class="field"><span>テキストを貼り付け</span>
        <textarea id="bulk-text" rows="9" placeholder="1行に1語ずつ。区切りは自動で判定します。&#10;&#10;apple りんご&#10;take off - 離陸する&#10;reluctant, 気が進まない&#10;&#10;英語と訳が別の行でもOK">${esc(addUI.text)}</textarea>
      </label>
      <label class="btn small ghost file-btn">${icon('upload')}ファイルから読み込む（.txt / .csv / .tsv）<input id="text-file" type="file" accept=".txt,.csv,.tsv,.md,text/plain,text/csv,text/tab-separated-values" hidden></label>
      ${addUI.busy ? `<div class="scan-status"><span class="spinner"></span><span id="scan-text">AIが整理しています…</span></div>` : `
      <div class="cta-row">
        <button type="button" class="btn primary" data-action="parse-text">自動で分ける</button>
        <button type="button" class="btn" data-action="ai-text" ${hasKey ? '' : 'disabled'}>${icon('sparkle')}AIで整理する</button>
      </div>`}
      <p class="hint">「自動で分ける」は端末内で処理します。メモ書きや文章に埋もれた単語は「AIで整理する」が得意です${hasKey ? '' : '（APIキーの登録が必要）'}。</p>
    </div>`;
  $('#bulk-text', body).addEventListener('input', (e) => { addUI.text = e.target.value; });
  $('#text-file', body).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    addUI.text = (addUI.text ? addUI.text.trimEnd() + '\n' : '') + text.replace(/^﻿/, '');
    renderAddText(body);
    toast(`「${file.name}」を読み込みました`);
  });
}

// 確認画面
function startReview(items, source) {
  const existing = new Set(S.getWords(addUI.deckId).map((w) => S.normKey(w.en)));
  addUI.review = items.map((it) => {
    const dup = existing.has(S.normKey(it.en));
    return { en: it.en, ja: it.ja, note: it.note || '', generated: !!it.generated, dup, checked: !dup && !!it.en };
  });
  addUI.reviewSource = source;
  renderAddBody();
  window.scrollTo(0, 0);
}

function renderReview(body) {
  const rows = addUI.review;
  const n = rows.filter((r) => r.checked).length;
  body.innerHTML = `
    <div class="review-head">
      <div><h2>読み取り結果の確認</h2><p class="muted">${rows.length}件を検出。内容はその場で直せます。</p></div>
      <button type="button" class="btn small ghost" data-action="review-toggle-all">${n === rows.length ? 'すべて外す' : 'すべて選ぶ'}</button>
    </div>
    <ul class="review-list">
      ${rows.map((r, i) => `<li class="review-row ${r.checked ? '' : 'off'}" data-index="${i}">
        <label class="check"><input type="checkbox" data-review="checked" ${r.checked ? 'checked' : ''} aria-label="追加する"><i>${icon('check')}</i></label>
        <div class="review-fields">
          <input type="text" data-review="en" value="${esc(r.en)}" placeholder="英語" lang="en" autocapitalize="off" spellcheck="false" aria-label="英語">
          <input type="text" data-review="ja" value="${esc(r.ja)}" placeholder="日本語" lang="ja" aria-label="日本語">
          <input type="text" class="note" data-review="note" value="${esc(r.note)}" placeholder="メモ（任意）" aria-label="メモ">
          <div class="tags">${r.dup ? '<span class="tag warn">登録済み</span>' : ''}${r.generated ? '<span class="tag ai">AI訳</span>' : ''}${!r.ja ? '<span class="tag warn">訳なし</span>' : ''}</div>
        </div>
      </li>`).join('')}
    </ul>
    <div class="sticky-cta">
      <button type="button" class="btn ghost" data-action="review-cancel">やり直す</button>
      <button type="button" class="btn primary grow" data-action="review-commit" id="review-commit" ${n ? '' : 'disabled'}>${n}語を単語帳に追加</button>
    </div>`;

  body.addEventListener('input', onReviewInput);
  body.addEventListener('change', onReviewInput);
}

function onReviewInput(e) {
  const key = e.target.dataset?.review;
  if (!key || !addUI.review) return;
  const li = e.target.closest('.review-row');
  const row = addUI.review[+li.dataset.index];
  if (key === 'checked') { row.checked = e.target.checked; li.classList.toggle('off', !row.checked); }
  else row[key] = e.target.value;
  const n = addUI.review.filter((r) => r.checked).length;
  const btn = $('#review-commit');
  if (btn) { btn.textContent = `${n}語を単語帳に追加`; btn.disabled = !n; }
}

// ── テスト設定 ──────────────────────────────────────
const studyCfg = Object.assign({ deckId: 'all', mode: 'flash', dir: 'en-ja', scope: 'all', count: 20, shuffle: true }, S.getSettings().study || {});

function studyPool(cfg = studyCfg) {
  let words = (cfg.deckId === 'all' ? S.getWords() : S.getWords(cfg.deckId)).filter((w) => w.en && w.ja);
  if (cfg.scope === 'due') words = words.filter((w) => S.isDue(w));
  else if (cfg.scope === 'weak') words = words.filter(S.isWeak);
  else if (cfg.scope === 'star') words = words.filter((w) => w.star);
  else if (cfg.scope === 'unmastered') words = words.filter((w) => S.statusOf(w) !== 'mastered');
  return words;
}

function viewStudy(deckId) {
  if (deckId && S.getDeck(deckId)) studyCfg.deckId = deckId;
  if (studyCfg.deckId !== 'all' && !S.getDeck(studyCfg.deckId)) studyCfg.deckId = 'all';
  const decks = S.getDecks();
  const c = studyCfg;
  const base = { ...c };
  const count = (scope) => studyPool({ ...base, scope }).length;
  const pool = studyPool();
  const n = c.count === 'all' ? pool.length : Math.min(c.count, pool.length);
  const modes = [
    ['flash', 'flip', 'フラッシュカード', 'めくって、スワイプで仕分け'],
    ['quiz', 'check', '4択クイズ', '選ぶだけ。すきま時間に'],
    ['type', 'pencil', '入力テスト', 'スペルまでしっかり定着'],
  ];
  const seg = (key, opts) => `<div class="segmented wrap">${opts.map(([v, label, extra]) => `<button type="button" class="${String(c[key]) === String(v) ? 'on' : ''}" data-action="cfg" data-key="${key}" data-value="${v}">${label}${extra !== undefined ? `<small>${extra}</small>` : ''}</button>`).join('')}</div>`;

  $app.innerHTML = `
    ${pageHead({ title: 'テスト', sub: 'シャッフルして出題。結果は復習タイミングに反映されます。' })}
    <section class="section">
      <h2 class="label">単語帳</h2>
      <div class="chips scroll">
        <button type="button" class="chip ${c.deckId === 'all' ? 'on' : ''}" data-action="cfg" data-key="deckId" data-value="all">すべて</button>
        ${decks.map((d) => `<button type="button" class="chip c-${esc(d.color)} ${c.deckId === d.id ? 'on' : ''}" data-action="cfg" data-key="deckId" data-value="${d.id}"><i class="chip-dot"></i>${esc(d.name)}</button>`).join('')}
      </div>
    </section>
    <section class="section">
      <h2 class="label">出題形式</h2>
      <div class="mode-grid">
        ${modes.map(([k, ic, title, desc]) => `<button type="button" class="mode ${c.mode === k ? 'on' : ''}" data-action="cfg" data-key="mode" data-value="${k}"><span class="mode-icon">${icon(ic)}</span><b>${title}</b><small>${desc}</small></button>`).join('')}
      </div>
    </section>
    <section class="section">
      <h2 class="label">出題の向き</h2>
      ${seg('dir', [['en-ja', '英語 → 日本語'], ['ja-en', '日本語 → 英語'], ['mix', 'ミックス']])}
    </section>
    <section class="section">
      <h2 class="label">範囲</h2>
      ${seg('scope', [['all', 'すべて', count('all')], ['due', '復習期限', count('due')], ['weak', '苦手', count('weak')], ['star', '★', count('star')], ['unmastered', '未習得', count('unmastered')]])}
    </section>
    <section class="section">
      <h2 class="label">出題数</h2>
      ${seg('count', [[10, '10'], [20, '20'], [30, '30'], ['all', 'すべて']])}
      <label class="switch-row"><span>${icon('shuffle')}シャッフルする</span><input type="checkbox" id="cfg-shuffle" ${c.shuffle ? 'checked' : ''}><i class="switch"></i></label>
    </section>
    <div class="sticky-cta">
      <button type="button" class="btn primary grow big" data-action="start-session" ${n ? '' : 'disabled'}>${n ? `${n}語でスタート` : '出題できる単語がありません'}</button>
    </div>`;
  $('#cfg-shuffle').addEventListener('change', (e) => { c.shuffle = e.target.checked; S.setSetting('study', { ...c }); });
}

// ── テスト実行 ──────────────────────────────────────
function startSession(words, cfg, title) {
  let queue = cfg.shuffle ? shuffle(words) : [...words];
  if (cfg.count !== 'all') queue = queue.slice(0, cfg.count);
  if (!queue.length) { toast('出題できる単語がありません'); return; }
  session = {
    cfg: { ...cfg },
    title,
    ids: queue.map((w) => w.id),
    dirs: queue.map(() => (cfg.dir === 'mix' ? (Math.random() < 0.5 ? 'en-ja' : 'ja-en') : cfg.dir)),
    idx: 0,
    results: [],
    startedAt: Date.now(),
    phase: 'ask', // ask | feedback | done
    options: null,
    flipped: false,
  };
  go('#/session');
}

const currentWord = () => S.getWord(session.ids[session.idx]);
const sideText = (w, dir, side) => ((dir === 'en-ja') === (side === 'q') ? w.en : w.ja);
const sideLang = (dir, side) => ((dir === 'en-ja') === (side === 'q') ? 'en' : 'ja');

function sessionTop() {
  const total = session.ids.length;
  return `<header class="session-top">
    <button type="button" class="icon-btn" data-action="quit-session" aria-label="テストを終了">${icon('x')}</button>
    <div class="session-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${session.idx}"><i style="width:${(session.idx / total) * 100}%"></i></div>
    <span class="session-count">${Math.min(session.idx + 1, total)}<small>/${total}</small></span>
  </header>`;
}

function viewSession() {
  if (session.phase === 'done') return viewResults();
  // 途中で削除された単語は飛ばす
  while (session.idx < session.ids.length && !currentWord()) session.idx++;
  if (session.idx >= session.ids.length) { session.phase = 'done'; return viewResults(); }
  if (session.cfg.mode === 'flash') viewFlash();
  else if (session.cfg.mode === 'quiz') viewQuiz();
  else viewType();
}

function answer(ok) {
  const w = currentWord();
  const snap = S.recordAnswer(w.id, ok);
  session.results.push({ id: w.id, ok, snap });
}

function nextCard() {
  session.idx++;
  session.phase = session.idx >= session.ids.length ? 'done' : 'ask';
  session.options = null;
  session.flipped = false;
  if (session.phase === 'done') session.endedAt = Date.now();
  viewSession();
}

// フラッシュカード
function viewFlash() {
  const w = currentWord();
  const dir = session.dirs[session.idx];
  const qLang = sideLang(dir, 'q');
  const aLang = sideLang(dir, 'a');
  $app.innerHTML = `
    ${sessionTop()}
    <div class="flash-stage">
      <div class="flash" id="flash" tabindex="0" role="button" aria-label="カードを裏返す">
        <div class="flash-inner ${session.flipped ? 'flipped' : ''}">
          <div class="flash-face front">
            <span class="hole"></span>
            <span class="face-label">${qLang === 'en' ? 'English' : '日本語'}</span>
            <p class="face-text ${qLang}" lang="${qLang}">${esc(sideText(w, dir, 'q'))}</p>
            <span class="face-hint">${icon('flip')}タップで裏返す</span>
          </div>
          <div class="flash-face back">
            <span class="hole"></span>
            <span class="face-label">${aLang === 'en' ? 'English' : '日本語'}</span>
            <p class="face-text ${aLang}" lang="${aLang}">${esc(sideText(w, dir, 'a'))}</p>
            ${w.note ? `<p class="face-note">${esc(w.note)}</p>` : ''}
          </div>
        </div>
        <span class="lean-badge left">まだ</span><span class="lean-badge right">覚えた</span>
      </div>
    </div>
    <div class="flash-tools">
      <button type="button" class="icon-btn" data-action="flash-undo" aria-label="ひとつ戻る" ${session.results.length ? '' : 'disabled'}>${icon('undo')}</button>
      <button type="button" class="icon-btn" data-action="speak-current" aria-label="発音を聞く">${icon('speaker')}</button>
      <button type="button" class="icon-btn star ${w.star ? 'on' : ''}" data-action="star-current" aria-label="スター">${icon('star')}</button>
    </div>
    <div class="flash-actions">
      <button type="button" class="btn big ng" data-action="flash-ng">${icon('x')}まだ</button>
      <button type="button" class="btn big ok" data-action="flash-ok">${icon('check')}覚えた</button>
    </div>
    <p class="hint center">← まだ　｜　スワイプでも仕分けできます　｜　覚えた →</p>`;
  bindFlash($('#flash'));
  if (S.getSettings().autoSpeak && qLang === 'en') speak(w.en);
}

function flipCard() {
  session.flipped = !session.flipped;
  $('.flash-inner')?.classList.toggle('flipped', session.flipped);
  const w = currentWord();
  if (session.flipped && S.getSettings().autoSpeak && sideLang(session.dirs[session.idx], 'a') === 'en') speak(w.en);
}

function flashAnswer(ok) {
  const el = $('#flash');
  if (!el || el.dataset.leaving) return;
  el.dataset.leaving = '1';
  el.classList.add(ok ? 'fly-right' : 'fly-left');
  answer(ok);
  setTimeout(nextCard, 230);
}

function bindFlash(el) {
  let sx = 0, sy = 0, dx = 0, active = false, moved = false;
  el.addEventListener('pointerdown', (e) => {
    if (el.dataset.leaving) return;
    active = true; moved = false; dx = 0; sx = e.clientX; sy = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - sx;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true;
    if (!moved) return;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
    el.dataset.lean = dx > 50 ? 'right' : dx < -50 ? 'left' : '';
  });
  const end = () => {
    if (!active) return;
    active = false;
    el.classList.remove('dragging');
    if (!moved) { flipCard(); return; }
    if (Math.abs(dx) > 96) { el.style.transform = ''; flashAnswer(dx > 0); return; }
    el.style.transform = '';
    el.dataset.lean = '';
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { active = false; el.classList.remove('dragging'); el.style.transform = ''; el.dataset.lean = ''; });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); flipCard(); } });
}

// 4択クイズ
function buildOptions(word, dir) {
  const field = dir === 'en-ja' ? 'ja' : 'en';
  const correct = word[field];
  const seen = new Set([correct]);
  const picks = [];
  const take = (list) => {
    for (const w of shuffle(list)) {
      if (picks.length >= 3) break;
      if (!w[field] || seen.has(w[field])) continue;
      seen.add(w[field]);
      picks.push(w[field]);
    }
  };
  take(S.getWords(word.deckId).filter((w) => w.id !== word.id));
  if (picks.length < 3) take(S.getWords().filter((w) => w.deckId !== word.deckId));
  return shuffle([correct, ...picks]);
}

function viewQuiz() {
  const w = currentWord();
  const dir = session.dirs[session.idx];
  const qLang = sideLang(dir, 'q');
  const aLang = sideLang(dir, 'a');
  session.options ??= buildOptions(w, dir);
  const correct = sideText(w, dir, 'a');
  const fb = session.phase === 'feedback';
  $app.innerHTML = `
    ${sessionTop()}
    <div class="prompt-card">
      <span class="hole"></span>
      <span class="face-label">${qLang === 'en' ? 'English' : '日本語'}</span>
      <p class="face-text ${qLang}" lang="${qLang}">${esc(sideText(w, dir, 'q'))}</p>
      ${qLang === 'en' ? `<button type="button" class="icon-btn small corner" data-action="speak-current" aria-label="発音を聞く">${icon('speaker')}</button>` : ''}
    </div>
    <ul class="options ${fb ? 'locked' : ''}">
      ${session.options.map((o, i) => {
        const cls = fb ? (o === correct ? 'correct' : o === session.picked ? 'wrong' : 'dim') : '';
        return `<li><button type="button" class="option ${cls} ${aLang}" lang="${aLang}" data-action="pick" data-index="${i}" ${fb ? 'disabled' : ''}><span class="opt-key">${i + 1}</span><span>${esc(o)}</span></button></li>`;
      }).join('')}
    </ul>
    ${fb ? `<div class="feedback ${session.lastOk ? 'ok' : 'ng'}">
      <p><b>${session.lastOk ? '正解！' : '不正解'}</b>${w.note ? `<span>${esc(w.note)}</span>` : ''}</p>
      <button type="button" class="btn primary" data-action="next-card">次へ${icon('next')}</button>
    </div>` : `<button type="button" class="btn ghost block" data-action="pick" data-index="-1">わからない</button>`}`;
  if (!fb && S.getSettings().autoSpeak && qLang === 'en') speak(w.en);
}

function pickOption(index) {
  if (session.phase !== 'ask') return;
  const w = currentWord();
  const correct = sideText(w, session.dirs[session.idx], 'a');
  session.picked = index >= 0 ? session.options[index] : null;
  session.lastOk = session.picked === correct;
  answer(session.lastOk);
  session.phase = 'feedback';
  viewQuiz();
  if (session.lastOk) {
    const at = session.idx;
    setTimeout(() => { if (session && session.idx === at && session.phase === 'feedback') nextCard(); }, 850);
  }
}

// 入力テスト
const kanaToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
function normAnswer(s, lang) {
  let t = (s || '').normalize('NFKC').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '');
  if (lang === 'en') return t.replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return kanaToHira(t).replace(/[\s〜~…・。.!?「」『』]/g, '');
}
function isCorrectTyped(input, target, lang) {
  const a = normAnswer(input, lang);
  if (!a) return false;
  const alts = [target, ...target.normalize('NFKC').split(/[、,;\/]|または|もしくは/)];
  return alts.some((t) => normAnswer(t, lang) === a);
}

function viewType() {
  const w = currentWord();
  const dir = session.dirs[session.idx];
  const qLang = sideLang(dir, 'q');
  const aLang = sideLang(dir, 'a');
  const fb = session.phase === 'feedback';
  $app.innerHTML = `
    ${sessionTop()}
    <div class="prompt-card">
      <span class="hole"></span>
      <span class="face-label">${qLang === 'en' ? 'English' : '日本語'}</span>
      <p class="face-text ${qLang}" lang="${qLang}">${esc(sideText(w, dir, 'q'))}</p>
      ${qLang === 'en' ? `<button type="button" class="icon-btn small corner" data-action="speak-current" aria-label="発音を聞く">${icon('speaker')}</button>` : ''}
    </div>
    <form id="type-form" class="type-form">
      <input id="type-input" type="text" lang="${aLang}" placeholder="${aLang === 'en' ? '英語で入力' : '日本語で入力'}" value="${esc(session.typed || '')}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" class="${fb ? (session.lastOk ? 'ok' : 'ng') : ''}">
      ${fb ? `<div class="feedback ${session.lastOk ? 'ok' : 'ng'}">
          <p><b>${session.lastOk ? '正解！' : '正しくは'}</b><span class="answer ${aLang}" lang="${aLang}">${esc(sideText(w, dir, 'a'))}</span>${w.note ? `<span>${esc(w.note)}</span>` : ''}</p>
          <div class="cta-row">
            ${session.lastOk ? '' : '<button type="button" class="btn ghost" data-action="override-ok">正解にする</button>'}
            <button class="btn primary grow">次へ${icon('next')}</button>
          </div>
        </div>` : `<div class="cta-row">
          <button type="button" class="btn ghost" data-action="type-giveup">わからない</button>
          <button class="btn primary grow">答える</button>
        </div>`}
    </form>`;
  const form = $('#type-form');
  const input = $('#type-input');
  // 結果表示中もフォーカスを保ち、スマホのキーボードが開閉してちらつくのを防ぐ
  input.focus({ preventScroll: true });
  if (fb) input.addEventListener('beforeinput', (e) => e.preventDefault());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (session.phase === 'feedback') { session.typed = ''; return nextCard(); }
    if (!input.value.trim()) { input.focus(); return; }
    submitTyped(input.value);
  });
  if (!fb && S.getSettings().autoSpeak && qLang === 'en') speak(w.en);
}

function submitTyped(value) {
  const w = currentWord();
  const dir = session.dirs[session.idx];
  session.typed = value;
  session.lastOk = value ? isCorrectTyped(value, sideText(w, dir, 'a'), sideLang(dir, 'a')) : false;
  answer(session.lastOk);
  session.phase = 'feedback';
  viewType();
}

// 結果
function viewResults() {
  const total = session.results.length;
  const ok = session.results.filter((r) => r.ok).length;
  const pct = total ? Math.round((ok / total) * 100) : 0;
  const secs = Math.round(((session.endedAt || Date.now()) - session.startedAt) / 1000);
  const time = secs >= 60 ? `${Math.floor(secs / 60)}分${secs % 60}秒` : `${secs}秒`;
  const missed = session.results.filter((r) => !r.ok).map((r) => S.getWord(r.id)).filter(Boolean);
  const msg = pct === 100 ? 'パーフェクト！' : pct >= 80 ? 'いい調子です' : pct >= 50 ? 'あと一歩' : '繰り返しが近道です';
  const C = 2 * Math.PI * 52;
  $app.innerHTML = `
    <header class="session-top"><button type="button" class="icon-btn" data-action="end-session" aria-label="閉じる">${icon('x')}</button><span class="session-title">${esc(session.title)}</span><span></span></header>
    <section class="results">
      <div class="ring">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="--to:${C * (1 - pct / 100)}"/></svg>
        <div class="ring-text"><b>${pct}<small>%</small></b><span>${ok} / ${total} 正解</span></div>
      </div>
      <h1>${msg}</h1>
      <p class="muted">${icon('clock')}${time}　${icon('flame')}連続 ${S.getStreak()}日</p>
    </section>
    ${missed.length ? `<section class="section"><div class="section-head"><h2>間違えた単語</h2><span class="muted">${missed.length}語</span></div>
      <ul class="word-list compact">${missed.map((w) => `<li class="word" data-id="${w.id}"><div class="word-main static"><span class="word-en">${esc(w.en)}</span><span class="word-ja"><span class="ja-text">${esc(w.ja)}</span></span></div>
        <div class="word-side"><button type="button" class="icon-btn small" data-action="speak" aria-label="発音を聞く">${icon('speaker')}</button><button type="button" class="icon-btn small star ${w.star ? 'on' : ''}" data-action="toggle-star" aria-label="スター">${icon('star')}</button></div></li>`).join('')}</ul></section>` : ''}
    <div class="sticky-cta column">
      ${missed.length ? `<button type="button" class="btn primary block big" data-action="retry-missed">${icon('undo')}間違えた ${missed.length}語をもう一度</button>` : ''}
      <div class="cta-row"><button type="button" class="btn grow" data-action="retry-all">${icon('shuffle')}もう一度</button><button type="button" class="btn ghost grow" data-action="end-session">終了</button></div>
    </div>`;
  if (pct === 100 && total >= 3) confetti();
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['var(--c-vermilion)', 'var(--c-mustard)', 'var(--c-teal)', 'var(--c-indigo)', 'var(--marker)'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.5}s;animation-duration:${1.6 + Math.random() * 1.2}s;transform:rotate(${Math.random() * 360}deg)`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3400);
}

// ── 設定 ────────────────────────────────────────────
function viewSettings() {
  const s = S.getSettings();
  const key = S.getApiKey();
  const total = S.getWords().length;
  $app.innerHTML = `
    ${pageHead({ title: '設定' })}
    <section class="section">
      <h2 class="label">AI読み取り（AI OCR）</h2>
      <div class="card-plain form">
        <label class="field"><span>Claude APIキー</span>
          <div class="input-row"><input id="api-key" type="password" value="${esc(key)}" placeholder="sk-ant-..." autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="btn small ghost" data-action="toggle-key">表示</button></div>
        </label>
        <label class="field"><span>モデル</span>
          <select id="model">${MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${m.label} — ${m.hint}</option>`).join('')}</select>
        </label>
        <div class="cta-row"><button type="button" class="btn primary" data-action="save-key">保存</button><button type="button" class="btn" data-action="test-key">接続テスト</button></div>
        <p class="hint">キーはこの端末のブラウザ内にだけ保存され、読み取り時に Anthropic へ直接送られます（バックアップにも含まれません）。取得は <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console</a> から。利用量に応じてAPI料金がかかるため、Console 側で月額上限を設定しておくと安心です。</p>
      </div>
    </section>
    <section class="section">
      <h2 class="label">表示と学習</h2>
      <div class="card-plain">
        <div class="field"><span>テーマ</span>
          <div class="segmented">${[['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']].map(([v, l]) => `<button type="button" class="${s.theme === v ? 'on' : ''}" data-action="set-theme" data-value="${v}">${l}</button>`).join('')}</div>
        </div>
        <label class="switch-row"><span>${icon('speaker')}テスト中に英語を自動で読み上げる</span><input type="checkbox" id="auto-speak" ${s.autoSpeak ? 'checked' : ''}><i class="switch"></i></label>
      </div>
    </section>
    <section class="section">
      <h2 class="label">データ（${S.getDecks().length}冊・${total}語）</h2>
      <div class="card-plain">
        <div class="menu-list flat">
          <button type="button" data-action="export-json">${icon('download')}バックアップを書き出す（JSON）</button>
          <button type="button" data-action="export-csv">${icon('download')}全単語をCSVで書き出す</button>
          <label class="menu-file">${icon('upload')}バックアップから読み込む<input id="import-json" type="file" accept=".json,application/json" hidden></label>
          <button type="button" data-action="wipe" class="danger-text">${icon('trash')}すべてのデータを削除</button>
        </div>
        <p class="hint">単語帳はこの端末のブラウザに保存されます。機種変更や別の端末で使うときは、バックアップを書き出して読み込んでください。</p>
      </div>
    </section>
    <section class="section">
      <h2 class="label">ホーム画面に追加</h2>
      <div class="card-plain"><p class="hint no-margin">iPhone は Safari の共有ボタン →「ホーム画面に追加」、Android は Chrome のメニュー →「アプリをインストール」で、アプリのように全画面で使えます。オフラインでも単語帳とテストは動きます。</p></div>
    </section>
    <p class="version">Tangocho v${APP_VERSION}</p>`;

  $('#model').addEventListener('change', (e) => S.setSetting('model', e.target.value));
  $('#auto-speak').addEventListener('change', (e) => S.setSetting('autoSpeak', e.target.checked));
  $('#import-json').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    openSheet(`
      <h2 class="sheet-title">バックアップの読み込み</h2>
      <p class="sheet-body">「${esc(file.name)}」をどう読み込みますか？</p>
      <div class="menu-list"><button type="button" data-mode="merge">${icon('plus')}いまのデータに追加する</button><button type="button" data-mode="replace" class="danger-text">${icon('undo')}いまのデータを置き換える</button></div>`, {
      onMount: (el) => el.addEventListener('click', (ev) => {
        const mode = ev.target.closest('[data-mode]')?.dataset.mode;
        if (!mode) return;
        try {
          const r = S.importJSON(text, mode);
          closeSheet(); render();
          toast(`${r.decks}冊・${r.words}語を読み込みました`);
        } catch (err) { closeSheet(); toast(err.message || '読み込めませんでした'); }
      }),
    });
  });
}

// ── クリックの振り分け ──────────────────────────────
const actions = {
  'close-sheet': () => closeSheet(),
  'new-deck': () => newDeckSheet(),
  'quick-review': () => {
    const words = S.getWords().filter((w) => w.en && w.ja && S.isDue(w));
    startSession(words, { ...studyCfg, deckId: 'all', scope: 'due', count: 30, shuffle: true }, '今日の復習');
  },
  'deck-menu': () => deckMenuSheet(parseRoute().id),
  'set-filter': (el) => { deckUI.filter = el.dataset.filter; $$('.chip[data-filter]').forEach((c) => c.classList.toggle('on', c === el)); renderWordList(deckUI.id); },
  'toggle-redsheet': (el) => { deckUI.redSheet = !deckUI.redSheet; el.classList.toggle('on', deckUI.redSheet); el.setAttribute('aria-pressed', deckUI.redSheet); renderWordList(deckUI.id); if (deckUI.redSheet) toast('日本語を隠しました。タップでその行だけ確認できます'); },
  'cycle-sort': () => { const keys = Object.keys(SORTS); deckUI.sort = keys[(keys.indexOf(deckUI.sort) + 1) % keys.length]; $('#sort-label').textContent = SORTS[deckUI.sort]; renderWordList(deckUI.id); },
  'word-tap': (el) => {
    const li = el.closest('.word');
    if (deckUI.redSheet && parseRoute().name === 'deck') li.classList.toggle('revealed');
    else editWordSheet(li.dataset.id);
  },
  speak: (el) => speak(S.getWord(el.closest('.word').dataset.id)?.en),
  'toggle-star': (el) => {
    const w = S.getWord(el.closest('.word').dataset.id);
    if (!w) return;
    S.updateWord(w.id, { star: !w.star });
    el.classList.toggle('on', w.star);
    el.setAttribute('aria-pressed', w.star);
  },
  'add-tab': (el) => { addUI.tab = el.dataset.tab; addUI.review = null; render(); },
  'remove-file': (el) => { addUI.files.splice(+el.dataset.index, 1); renderAddBody(); },
  'run-ocr': () => runAI({ files: addUI.files }),
  'parse-text': async () => {
    const pairs = parsePairs(addUI.text);
    if (!pairs.length) { toast('英語と日本語のペアが見つかりませんでした'); return; }
    await requireDeck();
    startReview(pairs, 'text');
  },
  'ai-text': () => { if (!addUI.text.trim()) { toast('テキストを入力してください'); return; } runAI({ text: addUI.text }); },
  'remove-recent': (el) => { const id = el.closest('.word').dataset.id; S.deleteWord(id); addUI.recent = addUI.recent.filter((x) => x !== id); renderAddBody(); },
  'review-toggle-all': () => { const allOn = addUI.review.every((r) => r.checked); addUI.review.forEach((r) => { r.checked = !allOn; }); renderAddBody(); },
  'review-cancel': () => { addUI.review = null; renderAddBody(); },
  'review-commit': async () => {
    await requireDeck();
    const rows = addUI.review.filter((r) => r.checked && (r.en.trim() || r.ja.trim()));
    const added = S.addWords(addUI.deckId, rows);
    const deckId = addUI.deckId;
    if (addUI.reviewSource === 'ai' && !addUI.text.trim()) addUI.files = [];
    if (addUI.reviewSource !== 'ai' || addUI.text.trim()) addUI.text = '';
    addUI.review = null;
    go(`#/deck/${deckId}`);
    toast(`${added.length}語を追加しました`);
  },
  cfg: (el) => {
    const { key, value } = el.dataset;
    studyCfg[key] = key === 'count' && value !== 'all' ? +value : value;
    S.setSetting('study', { ...studyCfg });
    const y = window.scrollY;
    viewStudy();
    window.scrollTo(0, y);
  },
  'start-session': () => {
    const deck = studyCfg.deckId === 'all' ? null : S.getDeck(studyCfg.deckId);
    startSession(studyPool(), studyCfg, deck ? deck.name : 'すべての単語帳');
  },
  'quit-session': () => {
    if (!session.results.length) { session = null; return go('#/study'); }
    confirmSheet({ title: 'テストを終了しますか？', body: 'ここまでの回答は記録されています。', confirmLabel: '結果を見る', onConfirm: () => { session.phase = 'done'; session.endedAt = Date.now(); viewSession(); } });
  },
  'end-session': () => { const id = session?.cfg.deckId; session = null; go(id && id !== 'all' ? `#/deck/${id}` : '#/'); },
  'retry-missed': () => {
    const words = session.results.filter((r) => !r.ok).map((r) => S.getWord(r.id)).filter(Boolean);
    startSession(words, { ...session.cfg, count: 'all' }, session.title);
  },
  'retry-all': () => {
    const words = session.ids.map((id) => S.getWord(id)).filter(Boolean);
    startSession(words, { ...session.cfg, count: 'all' }, session.title);
  },
  'flash-ok': () => flashAnswer(true),
  'flash-ng': () => flashAnswer(false),
  'flash-undo': () => {
    const last = session.results.pop();
    if (!last) return;
    S.undoAnswer(last.snap, last.ok);
    session.idx = Math.max(0, session.idx - 1);
    session.flipped = false;
    viewSession();
  },
  'speak-current': () => speak(currentWord()?.en),
  'star-current': (el) => { const w = currentWord(); S.updateWord(w.id, { star: !w.star }); el.classList.toggle('on', w.star); },
  pick: (el) => pickOption(+el.dataset.index),
  'next-card': () => nextCard(),
  'type-giveup': () => submitTyped(''),
  'override-ok': () => {
    const last = session.results.pop();
    if (last) S.undoAnswer(last.snap, last.ok);
    session.lastOk = true;
    answer(true);
    session.typed = '';
    nextCard();
  },
  'toggle-key': (el) => { const i = $('#api-key'); i.type = i.type === 'password' ? 'text' : 'password'; el.textContent = i.type === 'password' ? '表示' : '隠す'; },
  'save-key': () => { S.setApiKey($('#api-key').value.trim()); toast($('#api-key').value.trim() ? 'APIキーを保存しました' : 'APIキーを削除しました'); },
  'test-key': async (el) => {
    const apiKey = $('#api-key').value.trim();
    el.disabled = true;
    el.textContent = '確認中…';
    try {
      const name = await testConnection({ apiKey, model: S.getSettings().model });
      S.setApiKey(apiKey);
      toast(`接続できました（${name}）。キーを保存しました`);
    } catch (e) {
      toast(e.message, { duration: 6000 });
    } finally {
      el.disabled = false;
      el.textContent = '接続テスト';
    }
  },
  'set-theme': (el) => { S.setSetting('theme', el.dataset.value); applyTheme(); viewSettings(); },
  'export-json': () => download(`tangocho-backup-${S.todayKey()}.json`, S.exportJSON(), 'application/json'),
  'export-csv': () => download(`tangocho-${S.todayKey()}.csv`, S.exportCSV(null), 'text/csv;charset=utf-8'),
  wipe: () => confirmSheet({ title: 'すべてのデータを削除', body: '単語帳・単語・学習記録をすべて削除します。元に戻せません。先にバックアップの書き出しをおすすめします。', confirmLabel: 'すべて削除する', danger: true, onConfirm: () => { S.wipeAll(); render(); toast('すべてのデータを削除しました'); } }),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});

// キーボード操作（テスト中）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSheet(); return; }
  if (!session || parseRoute().name !== 'session' || session.phase === 'done' || $sheetRoot.firstChild) return;
  if (e.target.matches('input, textarea, select')) return;
  const mode = session.cfg.mode;
  if (mode === 'flash') {
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
    else if (e.key === 'ArrowRight') flashAnswer(true);
    else if (e.key === 'ArrowLeft') flashAnswer(false);
  } else if (mode === 'quiz') {
    if (session.phase === 'ask' && /^[1-4]$/.test(e.key) && +e.key <= session.options.length) pickOption(+e.key - 1);
    else if (session.phase === 'feedback' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextCard(); }
  }
});

// 画像の貼り付け（デスクトップ）
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])].filter(isImage);
  if (!files.length || parseRoute().name !== 'add' || addUI.busy) return;
  e.preventDefault();
  addFiles(files);
});

// ── 起動 ────────────────────────────────────────────
S.seedIfEmpty();
applyTheme();
window.addEventListener('hashchange', render);
render();
navigator.storage?.persist?.().catch(() => {});
if ('speechSynthesis' in window) speechSynthesis.getVoices();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
