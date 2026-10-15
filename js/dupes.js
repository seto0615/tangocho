// 重複チェック：単語帳全体から「同じ単語」「似ている単語」のグループを見つける（端末内で処理）

// 比較用に英語を揃える：大文字小文字・記号・冠詞・to不定詞・「〜」「sth」などの穴埋め記号を無視する
export function canon(en) {
  return String(en || '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[〜~]\s*(ing|doing)\b|\bdoing\b/g, ' ')
    .replace(/[〜~…]|\.\.\.|\b(sth|sb|someone|something|one's|oneself)\b/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(to|a|an|the) (?=\S)/, '');
}

// 複数形・三単現・過去形・進行形をざっくり原形に寄せる（語ごと）
function stemWord(w) {
  if (w.length <= 3) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/ied$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2);
  if (/[^s']s$/.test(w)) return w.slice(0, -1);
  if (/ing$/.test(w) && w.length > 4) return w.slice(0, -3).replace(/(.)\1$/, '$1');
  if (/ed$/.test(w) && w.length > 4) return w.slice(0, -2).replace(/(.)\1$/, '$1');
  return w;
}
// decide / decided / deciding を揃えるため、4文字以上の語末の e も落とす
const stem = (c) => c.split(' ').map(stemWord).map((w) => (w.length >= 4 ? w.replace(/e$/, '') : w)).join(' ');

// 1文字違い（置換・挿入・削除）か
function oneEdit(a, b) {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else { i++; j++; }
  }
  return diff + (la - i) + (lb - j) <= 1;
}

// 日本語訳を「、」「;」「/」などで分けて比べる
export function splitMeanings(ja) {
  return String(ja || '')
    .split(/[、,，;；/／・\n]|\s{2,}/)
    .map((s) => s.replace(/[（(][^）)]*[）)]/g, '').trim())
    .filter(Boolean);
}
// 訳が重なるか（同じ訳がある・片方がもう片方を含む・頭の2文字が同じ「決める／決めた」）
function closeMeaning(a, b) {
  const x = splitMeanings(a.ja), y = splitMeanings(b.ja);
  return x.some((m) => y.some((n) => m === n || (Math.min(m.length, n.length) >= 2 && (m.includes(n) || n.includes(m) || m.slice(0, 2) === n.slice(0, 2)))));
}
const noMeaning = (w) => !splitMeanings(w.ja).length;

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * @param {object[]} words
 * @returns {{id:string, kind:'same'|'similar', reason:string, words:object[]}[]}
 */
export function findDuplicates(words) {
  const list = words.filter((w) => canon(w.en));
  const ok = new Set();
  list.forEach((w) => (w.notDup || []).forEach((o) => ok.add(pairKey(w.id, o))));

  const parent = new Map(list.map((w) => [w.id, w.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const reasons = new Map(); // ペアごとの理由
  const link = (a, b, kind, reason) => {
    if (ok.has(pairKey(a.id, b.id))) return;
    parent.set(find(a.id), find(b.id));
    reasons.set(pairKey(a.id, b.id), { kind, reason });
  };

  // 1) 揃えた表記が同じ → 同じ単語
  const byCanon = new Map();
  for (const w of list) {
    const k = canon(w.en);
    if (!byCanon.has(k)) byCanon.set(k, []);
    byCanon.get(k).push(w);
  }
  for (const group of byCanon.values()) {
    for (let i = 1; i < group.length; i++) {
      const a = group[0], b = group[i];
      const reason = a.en.trim() === b.en.trim() ? '同じつづり' : '大文字・記号・冠詞などの違い';
      link(a, b, 'same', reason);
    }
  }

  // 2) 活用形・複数形が同じ原形 → 似ている
  const reps = [...byCanon.entries()].map(([k, g]) => ({ k, w: g[0], s: stem(k) }));
  const byStem = new Map();
  for (const r of reps) {
    if (!byStem.has(r.s)) byStem.set(r.s, []);
    byStem.get(r.s).push(r);
  }
  for (const group of byStem.values()) {
    // news / new のような別の単語を拾わないよう、訳が近いもの（訳が空なら判断できないので候補に出す）に限る
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i].w, b = group[j].w;
        if (closeMeaning(a, b) || noMeaning(a) || noMeaning(b)) link(a, b, 'similar', '複数形・活用形の違い');
      }
    }
  }

  // 3) つづりが1文字違い（5文字以上）→ 打ち間違い・英米つづりの可能性。訳が1つでも重なるものに限る
  const long = reps.filter((r) => r.k.length >= 5).sort((a, b) => a.k.length - b.k.length);
  for (let i = 0; i < long.length; i++) {
    for (let j = i + 1; j < long.length && long[j].k.length - long[i].k.length <= 1; j++) {
      const a = long[i], b = long[j];
      if (find(a.w.id) === find(b.w.id)) continue;
      if (oneEdit(a.k, b.k) && closeMeaning(a.w, b.w)) link(a.w, b.w, 'similar', 'つづりが1文字違い');
    }
  }

  // グループにまとめる
  const groups = new Map();
  for (const w of list) {
    const r = find(w.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(w);
  }
  const out = [];
  for (const ws of groups.values()) {
    if (ws.length < 2) continue;
    // 確実に同じものだけのグループかどうか
    const kinds = new Set(), why = new Set();
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        const r = reasons.get(pairKey(ws[i].id, ws[j].id));
        if (r) { kinds.add(r.kind); why.add(r.reason); }
      }
    }
    const kind = kinds.has('similar') ? 'similar' : 'same';
    ws.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    out.push({ id: ws.map((w) => w.id).sort().join('+'), kind, reason: [...why].join('・'), words: ws });
  }
  return out.sort((a, b) => (a.kind === b.kind ? canon(a.words[0].en).localeCompare(canon(b.words[0].en)) : a.kind === 'same' ? -1 : 1));
}

// まとめるときに残す1語のおすすめ：学習が進んでいる → 古い順
export function pickKeeper(words) {
  return [...words].sort((a, b) => (b.seen || 0) - (a.seen || 0) || (a.createdAt || 0) - (b.createdAt || 0))[0];
}

// 訳・メモを重ならないように足し合わせる
export function mergedFields(keeper, others) {
  const ja = [];
  for (const w of [keeper, ...others]) for (const m of splitMeanings(w.ja)) if (!ja.includes(m)) ja.push(m);
  const notes = [];
  for (const w of [keeper, ...others]) { const n = (w.note || '').trim(); if (n && !notes.includes(n)) notes.push(n); }
  return { ja: ja.join('、') || keeper.ja, note: notes.join(' / ') };
}
