// 表ファイル（CSV・TSV・Excel）→ 英語/日本語ペア。AIを使わず端末内だけで処理する

import { parsePairs } from './parse.js';

const JA = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const LATIN = /[A-Za-z]/;
const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

// 見出しの名前から列の役割を当てる
const HEAD = {
  en: /^(en|eng|english|word|words|term|vocab(ulary)?|phrase|expression|英語|英単語|単語|英文|英語表現|表現|フレーズ|見出し語|語句)$/i,
  ja: /^(ja|jp|jpn|japanese|meaning|translation|definition|日本語|和訳|訳|意味|日本語訳|訳語|和文|意味・訳)$/i,
  note: /^(note|notes|memo|example|examples|sentence|comment|remarks?|メモ|例文|備考|補足|用例|コメント|覚え方)$/i,
  skip: /^(no|no\.|#|id|番号|deck|単語帳|カテゴリ|category|tag|tags|タグ|date|日付)$/i,
};
const normHead = (s) => String(s ?? '').replace(/[\s_\-（）()【】\[\]]/g, '').trim();

export const TABLE_ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv,text/tab-separated-values,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export function isTableFile(f) {
  return /\.(csv|tsv|txt|xlsx|xls|xlsm|ods)$/i.test(f.name) || /^text\/(csv|tab-separated-values|plain)$/.test(f.type);
}
const isSpreadsheet = (f) => /\.(xlsx|xls|xlsm|ods)$/i.test(f.name);

// 文字コードを判定して読む（Excelの「CSV」はShift_JIS、「Unicodeテキスト」はUTF-16のことが多い）
function decode(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

// 区切り文字を数えて決める（引用符の中は数えない）
function detectDelimiter(text) {
  const lines = text.split('\n').filter((l) => l.trim()).slice(0, 30);
  let best = null;
  for (const d of ['\t', ',', ';', '|']) {
    const counts = lines.map((l) => {
      let n = 0, q = false;
      for (const c of l) { if (c === '"') q = !q; else if (c === d && !q) n++; }
      return n;
    });
    const hit = counts.filter((n) => n > 0).length;
    if (!hit) continue;
    const score = hit / lines.length;
    if (!best || score > best.score + 0.05) best = { d, score };
  }
  return best && best.score >= 0.5 ? best.d : null;
}

// 引用符・改行入りのセルに対応した区切りテキストの読み取り
function splitRows(text, d) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"' && !cur.trim()) { q = true; cur = ''; }
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  row.push(cur);
  rows.push(row);
  return rows;
}

function tidy(rows) {
  const clean = rows
    .map((r) => r.map((c) => String(c ?? '').replace(/\s+/g, ' ').trim()))
    .filter((r) => r.some(Boolean));
  const width = Math.max(0, ...clean.map((r) => r.length));
  // 全行が空の列は落とす
  const keep = [...Array(width).keys()].filter((i) => clean.some((r) => r[i]));
  return clean.map((r) => keep.map((i) => r[i] || ''));
}

/**
 * テキストを表として読む。表に見えないとき（区切りが無い）は1行ずつの自動判定に回す
 * @returns {{rows?: string[][], pairs?: {en:string, ja:string, note:string}[]}}
 */
export function parseTableText(text) {
  const t = (text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const d = detectDelimiter(t);
  if (!d) return { pairs: parsePairs(t) };
  const rows = tidy(splitRows(t, d));
  if (rows.length && rows[0].length < 2) return { pairs: parsePairs(t) };
  return { rows };
}

let xlsxPromise = null;
async function readSpreadsheet(file) {
  xlsxPromise ??= import(XLSX_URL).catch((e) => {
    xlsxPromise = null;
    throw new Error('Excelを読む部品を読み込めませんでした。通信環境を確認するか、CSVで保存し直してください。', { cause: e });
  });
  const XLSX = await xlsxPromise;
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  // 中身のある最初のシートを使う
  for (const name of wb.SheetNames) {
    const rows = tidy(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' }));
    if (rows.length) return { rows, sheet: name };
  }
  return { rows: [] };
}

export async function readTableFile(file) {
  if (isSpreadsheet(file)) return readSpreadsheet(file);
  return parseTableText(decode(await file.arrayBuffer()));
}

/** 見出し行の有無と、英語・日本語・メモの列を推測する */
export function guessColumns(rows) {
  const width = rows[0]?.length || 0;
  const roleOf = (cell) => {
    const h = normHead(cell);
    return ['en', 'ja', 'note', 'skip'].find((k) => HEAD[k].test(h)) || null;
  };
  const headRoles = (rows[0] || []).map(roleOf);
  const header = headRoles.filter(Boolean).length > 0;
  const body = header ? rows.slice(1) : rows;

  const stat = [...Array(width).keys()].map((i) => {
    const cells = body.map((r) => r[i]).filter(Boolean);
    const n = cells.length || 1;
    return {
      latin: cells.filter((c) => LATIN.test(c) && !JA.test(c)).length / n,
      ja: cells.filter((c) => JA.test(c)).length / n,
      len: cells.reduce((s, c) => s + c.length, 0) / n,
    };
  });

  const pick = (role) => (header ? headRoles.indexOf(role) : -1);
  let en = pick('en');
  let ja = pick('ja');
  let note = pick('note');
  const free = (i) => i !== en && i !== ja && i !== note && !(header && headRoles[i] === 'skip');
  const best = (key, min) => {
    let at = -1;
    stat.forEach((s, i) => { if (free(i) && s[key] >= min && (at < 0 || s[key] > stat[at][key] || (s[key] === stat[at][key] && i < at))) at = i; });
    return at;
  };
  if (en < 0) en = best('latin', 0.3);
  if (ja < 0) ja = best('ja', 0.3);
  // 英語と日本語の両方を決めきれないときは左から2列
  if (en < 0 && ja < 0 && width >= 2) { en = 0; ja = 1; }
  else if (en < 0) en = [...Array(width).keys()].find(free) ?? -1;
  else if (ja < 0) ja = [...Array(width).keys()].find(free) ?? -1;
  return { header, en, ja, note };
}

/** 列の割り当てに従ってペアにする。英語と日本語が逆の行は入れ替える */
export function tableToPairs(rows, { header, en, ja, note }) {
  const body = header ? rows.slice(1) : rows;
  return body
    .map((r) => {
      let e = r[en] || '';
      let j = r[ja] || '';
      if (JA.test(e) && !JA.test(j) && LATIN.test(j)) [e, j] = [j, e];
      return { en: e, ja: j, note: note >= 0 ? r[note] || '' : '' };
    })
    .filter((p) => p.en || p.ja);
}
