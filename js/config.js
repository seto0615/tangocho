// ログイン（Supabase）の接続先。空のままならログインなしで従来どおり動く。
// anon key は公開前提の鍵（データは行レベルセキュリティで本人以外読めない）。
export const SUPABASE_URL = 'https://izxuyjqfkckuizqysrxb.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6eHV5anFma2NrdWl6cXlzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3ODg1MTIsImV4cCI6MjEwNzM2NDUxMn0.EAu2jTJdNxSX0s0rU8hI2SJSgVZ_caWwM2KkRaMNPxE';

export const AUTH_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
