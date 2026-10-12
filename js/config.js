// ログイン（Supabase）の接続先。空のままならログインなしで従来どおり動く。
// anon key は公開前提の鍵（データは行レベルセキュリティで本人以外読めない）。
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const AUTH_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
