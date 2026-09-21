// AI OCR: Claude API（公式SDK）で画像・PDF・テキストから英語/日本語ペアを抽出する
// APIキーは利用者の端末（localStorage）にのみ保存し、ブラウザから直接 Anthropic に送る。

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.127.0/+esm';
const MAX_EDGE = 1568; // 画像の長辺上限（これ以上は精度が変わらず転送量だけ増える）
const IMAGES_PER_REQUEST = 8;

export const MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', hint: '高精度（おすすめ）' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', hint: 'バランス' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: '高速・低コスト' },
];

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          en: { type: 'string', description: '英語の単語・熟語・例文' },
          ja: { type: 'string', description: '対応する日本語訳' },
          note: { type: 'string', description: '覚えたい語句と意味、品詞・例文・出典などの補足。なければ空文字' },
          generated: { type: 'boolean', description: '日本語訳が素材に無く、補った場合は true' },
        },
        required: ['en', 'ja', 'note', 'generated'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const SYSTEM = `あなたは英語学習者の単語帳づくりを手伝うOCRアシスタントです。
渡された素材（スクリーンショット・写真・PDF・テキスト）から、英語の単語・熟語・例文と、その日本語訳のペアを漏れなく抜き出します。

よくある素材は次の2種類です。
A) 映画・ドラマ・動画の学習アプリの画面。英語字幕と日本語字幕が上下に並んで表示されている。
B) 単語リスト・ノート・教材・チャットなど。英語と訳が表や箇条書き、あるいはばらばらの位置に書かれている。

抽出のルール:
- 英語と日本語訳は、位置関係（上下・左右の近さ）・番号・矢印・色・意味から正しい相手を判断して対応づけます。
- A の場合は、英語字幕1文と日本語字幕1文を1ペアにします。字幕が複数行に折り返されていたら1文につなげます。前の字幕からの続きを示す文頭・文末の「...」「…」「-」は取り除きます。
- 作品名・再生時間・シークバー・再生ボタン・「字幕」「AI」などのラベル・メニュー・時刻・電池表示・広告といった、学習内容でない画面上の文字は en / ja に入れません。
- en は素材の表記どおりに。文は大文字・句読点を保ち、単語や熟語は小文字のままにします。行頭の番号・記号・チェックボックスは除きます。
- ja は素材に書かれている訳をそのまま使います（字幕の意訳もそのまま）。訳が見当たらない英語には、学習者向けの簡潔で自然な訳を補い、generated を true にします。
- note の書き方:
  - en が文（字幕・会話・例文）のときは、その文の中で覚える価値が最も高い語句を1つ選び、「語句：意味」の形で短く書きます（例:「standing invitation：いつでも歓迎という招待」）。画面に作品名が見えていれば、末尾に「／作品名」を添えます。
  - en が単語・熟語のときは、素材にある品詞・発音・例文・言い換えを短くまとめます。なければ空文字にします。
- 同じ英語が重複して出てくる場合は1件にまとめます。
- 学習対象が何も見つからなければ items を空配列にします。`;

let sdkPromise = null;
async function loadSDK() {
  sdkPromise ??= import(SDK_URL).catch((e) => {
    sdkPromise = null;
    throw new AIError('AIライブラリを読み込めませんでした。通信環境を確認してください。', e);
  });
  const mod = await sdkPromise;
  return mod.default || mod.Anthropic;
}

export class AIError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AIError';
    this.cause = cause;
  }
}

function toUserError(Anthropic, e) {
  if (e instanceof AIError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AIError('APIキーが正しくありません。設定画面で確認してください。', e);
  if (e instanceof Anthropic.PermissionDeniedError) return new AIError('このAPIキーでは選択中のモデルを利用できません。設定でモデルを変更してください。', e);
  if (e instanceof Anthropic.NotFoundError) return new AIError('選択中のモデルが見つかりません。設定でモデルを変更してください。', e);
  if (e instanceof Anthropic.RateLimitError) return new AIError('利用が集中しています。少し待ってからもう一度お試しください。', e);
  if (e instanceof Anthropic.BadRequestError) {
    const msg = String(e.message || '');
    if (/credit|billing/i.test(msg)) return new AIError('APIのクレジット残高が不足しています。Anthropic Console で確認してください。', e);
    return new AIError('リクエストが受け付けられませんでした：' + msg, e);
  }
  if (e instanceof Anthropic.APIConnectionError) return new AIError('AIに接続できませんでした。通信環境を確認してください。', e);
  if (e instanceof Anthropic.APIError) return new AIError(`AI側でエラーが発生しました（${e.status ?? '不明'}）。時間をおいてお試しください。`, e);
  return new AIError('読み取りに失敗しました：' + (e?.message || e), e);
}

// ── ファイル → API入力ブロック ─────────────────────
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function imageToBlock(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new AIError(`「${file.name}」を画像として開けませんでした。`));
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] } };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pdfToBlock(file) {
  const dataUrl = await readAsDataURL(file);
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dataUrl.split(',')[1] } };
}

export const isPDF = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
export const isImage = (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(f.name);

// ── 抽出本体 ───────────────────────────────────────
async function extractOnce(Anthropic, client, model, blocks, instruction, onProgress) {
  const output_config = { format: { type: 'json_schema', schema: SCHEMA } };
  if (!model.startsWith('claude-haiku')) output_config.effort = 'medium';

  const stream = client.messages.stream({
    model,
    max_tokens: 32000,
    system: SYSTEM,
    messages: [{ role: 'user', content: [...blocks, { type: 'text', text: instruction }] }],
    output_config,
  });
  let seen = 0;
  stream.on('text', (_delta, snapshot) => {
    const n = (snapshot.match(/"en"\s*:/g) || []).length;
    if (n !== seen) { seen = n; onProgress?.(n); }
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') throw new AIError('AIがこの素材の読み取りを辞退しました。別の素材でお試しください。');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (message.stop_reason === 'max_tokens') throw new AIError('量が多すぎて途中で切れました。素材を分けて読み取ってください。', e);
    throw new AIError('AIの応答を解釈できませんでした。もう一度お試しください。', e);
  }
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * @param {{apiKey:string, model:string, files?:File[], text?:string, onProgress?:(info:{step:number,total:number,found:number})=>void}} opts
 * @returns {Promise<{en:string, ja:string, note:string, generated:boolean}[]>}
 */
export async function extractPairs({ apiKey, model, files = [], text = '', onProgress }) {
  if (!apiKey) throw new AIError('APIキーが未設定です。設定画面で登録してください。');
  const Anthropic = await loadSDK();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

  // 画像は数枚ずつ、PDFは1件ずつ、テキストは1回で処理する
  const jobs = [];
  const images = files.filter(isImage);
  for (let i = 0; i < images.length; i += IMAGES_PER_REQUEST) jobs.push({ kind: 'images', files: images.slice(i, i + IMAGES_PER_REQUEST) });
  for (const f of files.filter(isPDF)) jobs.push({ kind: 'pdf', files: [f] });
  if (text.trim()) jobs.push({ kind: 'text', text });
  if (!jobs.length) throw new AIError('読み取る素材がありません。');

  const all = [];
  try {
    for (let j = 0; j < jobs.length; j++) {
      const job = jobs[j];
      const base = all.length;
      const progress = (found) => onProgress?.({ step: j + 1, total: jobs.length, found: base + found });
      progress(0);
      let blocks = [];
      let instruction;
      if (job.kind === 'images') {
        blocks = await Promise.all(job.files.map(imageToBlock));
        instruction = `この${job.files.length}枚の画像から、英語と日本語訳のペアをすべて抜き出してください。`;
      } else if (job.kind === 'pdf') {
        blocks = [await pdfToBlock(job.files[0])];
        instruction = 'このPDFから、英語と日本語訳のペアをすべて抜き出してください。';
      } else {
        instruction = `次のテキストから、英語と日本語訳のペアをすべて抜き出してください。\n\n<material>\n${job.text}\n</material>`;
      }
      const items = await extractOnce(Anthropic, client, model, blocks, instruction, progress);
      all.push(...items);
    }
  } catch (e) {
    throw toUserError(Anthropic, e);
  }

  // 重複をまとめる
  const seen = new Set();
  return all
    .map((it) => ({ en: (it.en || '').trim(), ja: (it.ja || '').trim(), note: (it.note || '').trim(), generated: !!it.generated }))
    .filter((it) => {
      if (!it.en) return false;
      const k = it.en.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// 設定画面の「接続テスト」用
export async function testConnection({ apiKey, model }) {
  if (!apiKey) throw new AIError('APIキーを入力してください。');
  const Anthropic = await loadSDK();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    const info = await client.models.retrieve(model);
    return info.display_name || model;
  } catch (e) {
    throw toUserError(Anthropic, e);
  }
}
