// ログインとクラウド保存（Supabase）
// 招待制：アカウントは管理者が Supabase の管理画面で作成し、メール＋パスワードでログインする。
// クラウドに置くのは単語帳・学習記録だけ。写真・APIキーは端末の外に出さない。

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import * as S from './store.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const TABLE = 'tangocho_state';
const META_KEY = 'tangocho:sync';

let clientPromise = null;
function client() {
  clientPromise ??= import(SDK_URL)
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tangocho:auth' },
    }))
    .catch((e) => {
      clientPromise = null;
      throw new Error('ログイン機能を読み込めませんでした。通信環境を確認してください。', { cause: e });
    });
  return clientPromise;
}

// ── ログイン ────────────────────────────────────────
export async function currentUser() {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data.session?.user || null;
}

export async function signIn(email, password) {
  const sb = await client();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) throw new Error('メールアドレスかパスワードが違います。');
    throw new Error('ログインできませんでした：' + error.message);
  }
  return data.user;
}

export async function changePassword(password) {
  const sb = await client();
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error('パスワードを変更できませんでした：' + error.message);
}

// ログアウト：未送信の変更を送ってから、この端末の単語データを消す（共用端末に残さないため）
export async function signOut() {
  if (readMeta().dirty) await pushNow();
  const sb = await client();
  await sb.auth.signOut();
  S.clearLocalData();
  writeMeta({});
}

// ── 同期 ────────────────────────────────────────────
function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); } catch { return {}; }
}
function writeMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
}

// 2つのデータを id 単位で足し合わせる（b を優先）。どちらにしかない単語も消さない
export function mergeData(a, b) {
  const union = (x = [], y = []) => {
    const m = new Map(x.map((it) => [it.id, it]));
    y.forEach((it) => m.set(it.id, it));
    return [...m.values()];
  };
  return {
    decks: union(a.decks, b.decks),
    words: union(a.words, b.words),
    stats: { days: { ...(a.stats?.days || {}), ...(b.stats?.days || {}) } },
  };
}

let user = null;
let applying = false;
let timer = null;

async function pull() {
  const sb = await client();
  const { data, error } = await sb.from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function pushNow() {
  clearTimeout(timer);
  const sb = await client();
  const { error } = await sb.from(TABLE).upsert({ user_id: user.id, data: S.getData(), updated_at: new Date().toISOString() });
  if (error) throw error;
  writeMeta({ userId: user.id, dirty: false, syncedAt: Date.now() });
}

function schedulePush() {
  clearTimeout(timer);
  timer = setTimeout(() => pushNow().catch((e) => console.error('クラウド保存に失敗しました（次回再送）', e)), 1500);
}

function apply(data) {
  applying = true;
  try { S.setData(data); } finally { applying = false; }
}

async function reconcile() {
  const meta = readMeta();
  const cloud = await pull();
  const local = S.getData();
  if (!cloud) {
    // 初回：この端末にある単語帳をそのままクラウドへ
    await pushNow();
    return;
  }
  if (meta.userId !== user.id || meta.dirty) {
    // この端末で初めてログイン／未送信の変更あり：両方を残して合わせる
    apply(mergeData(cloud.data, local));
    await pushNow();
  } else {
    apply(cloud.data);
  }
}

// ログイン済みで起動したときに呼ぶ。通信できなくても端末内のデータで動き続ける
export async function startSync(u) {
  user = u;
  S.subscribe(() => {
    if (applying || !user) return;
    writeMeta({ ...readMeta(), userId: user.id, dirty: true });
    schedulePush();
  });
  window.addEventListener('online', () => { if (readMeta().dirty) schedulePush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !user) return;
    if (readMeta().dirty) schedulePush();
    else reconcile().then(() => window.dispatchEvent(new Event('tangocho:synced'))).catch(() => {});
  });
  await reconcile();
}
