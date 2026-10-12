// 追加画面の下書き（選んだ写真・読み取り結果）を IndexedDB に退避する。
// スマホでアプリが裏に回って再読み込みされても、写真と読み取り結果が消えないようにするため。
// 保存先はこの端末の中だけで、どこにも送らない。

const DB = 'tangocho-draft';
const STORE = 'draft';
const ID = 'add';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function loadDraft() {
  try {
    const d = await tx('readonly', (s) => s.get(ID));
    if (!d) return null;
    // File は Safari で復元できないことがあるため Blob＋名前で保存し、ここで File に戻す
    const files = (d.files || []).map((f) => new File([f.blob], f.name, { type: f.type }));
    return { ...d, files };
  } catch (e) {
    console.error('下書きの読み込みに失敗しました', e);
    return null;
  }
}

let timer = null;
export function saveDraft(draft) {
  clearTimeout(timer);
  timer = setTimeout(() => writeDraft(draft), 300);
}

async function writeDraft({ deckId, files, review, reviewSource }) {
  try {
    if (!files.length && !review) { await tx('readwrite', (s) => s.delete(ID)); return; }
    const data = {
      deckId,
      review,
      reviewSource,
      files: files.map((f) => ({ blob: f.slice(0, f.size, f.type), name: f.name, type: f.type })),
      savedAt: Date.now(),
    };
    await tx('readwrite', (s) => s.put(data, ID));
  } catch (e) {
    console.error('下書きの保存に失敗しました', e);
  }
}
