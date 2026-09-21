// テキスト → 英語/日本語ペアのローカル解析（AIを使わない経路）

const JA = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const LATIN = /[A-Za-z]/;
const SEP_TRAIL = /[\s\-–—:：=＝→⇒,、，;；|｜(（「『【]+$/;
const SEP_LEAD = /^[\s\-–—:：=＝→⇒,、，;；|｜)）」』】]+/;
const BULLET = /^\s*(?:[-*•・●○◆◇■□▶▸►✓✔☑]+|\(?\d{1,3}[.)）]|\d{1,3}\s*[:：])\s*/;
const HEADER = /^(?:en|english|word|words|英語|単語|term)\s*[,\t]/i;

function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function stripWrap(s) {
  let out = clean(s).replace(SEP_LEAD, '').replace(SEP_TRAIL, '');
  // 片側だけ残った括弧を整える
  if (/^[（(「『【]/.test(out) && /[）)」』】]$/.test(out)) out = out.slice(1, -1);
  else if (/[）)」』】]$/.test(out) && !/[（(「『【]/.test(out)) out = out.slice(0, -1);
  return clean(out);
}

function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(clean);
}

function orient(a, b, note = '') {
  // 日本語が先に来ている場合は入れ替える
  if (JA.test(a) && !JA.test(b) && LATIN.test(b)) return { en: b, ja: a, note };
  return { en: a, ja: b, note };
}

function parseLine(line) {
  // 1) タブ区切り
  if (line.includes('\t')) {
    const [a, b, ...rest] = line.split('\t').map(clean).filter((x, i) => x || i < 2);
    if (a && b) return orient(a, b, clean(rest.join(' ')));
  }
  // 2) 引用符つきCSV
  if (/^".*"/.test(line) && line.includes(',')) {
    const [a, b, c] = splitCSVLine(line);
    if (a && b) return orient(a, b, c || '');
  }
  const firstJa = line.search(JA);
  const firstLatin = line.search(LATIN);
  // 3) 英語 → 日本語（最初の日本語文字を境目にする）
  if (firstLatin >= 0 && firstJa > firstLatin) {
    const en = stripWrap(line.slice(0, firstJa));
    const ja = stripWrap(line.slice(firstJa));
    if (en && ja) return { en, ja, note: '' };
  }
  // 4) 日本語 → 英語（末尾の英語のかたまりを拾う）
  if (firstJa >= 0 && firstLatin > firstJa) {
    const m = line.match(/^(.*?)[\s\-–—:：=＝→⇒,、，;；|｜(（]+([A-Za-z][A-Za-z0-9 '’\-.,!?/&]*)[)）]?\s*$/);
    if (m && JA.test(m[1])) return { en: stripWrap(m[2]), ja: stripWrap(m[1]), note: '' };
  }
  return null;
}

/**
 * @param {string} text
 * @returns {{en:string, ja:string, note:string}[]}
 */
export function parsePairs(text) {
  const lines = (text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(BULLET, '').trim())
    .filter(Boolean);

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && HEADER.test(line)) continue;

    const pair = parseLine(line);
    if (pair) { out.push(pair); continue; }

    const hasJa = JA.test(line);
    const hasLatin = LATIN.test(line);
    // 5) 英語だけの行 + 次が日本語だけの行 → 2行で1ペア
    if (hasLatin && !hasJa) {
      const next = lines[i + 1];
      if (next && JA.test(next) && !parseLine(next)) {
        out.push({ en: stripWrap(line), ja: stripWrap(next), note: '' });
        i++;
      } else {
        out.push({ en: stripWrap(line), ja: '', note: '' });
      }
    }
    // 日本語だけの孤立行は捨てる（見出し・説明文であることが多い）
  }
  return out.filter((p) => p.en || p.ja);
}
