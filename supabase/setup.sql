-- Tangocho ログイン機能の初期設定（Supabase の SQL Editor に貼って実行）
-- 1人1行で単語帳データ（JSON）を保存し、本人以外は読み書きできないようにする

create table if not exists public.tangocho_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.tangocho_state enable row level security;

-- 未ログイン（anon）には一切触らせない
revoke all on public.tangocho_state from anon;
grant select, insert, update on public.tangocho_state to authenticated;

drop policy if exists "own row select" on public.tangocho_state;
drop policy if exists "own row insert" on public.tangocho_state;
drop policy if exists "own row update" on public.tangocho_state;

create policy "own row select" on public.tangocho_state
  for select to authenticated using (auth.uid() = user_id);
create policy "own row insert" on public.tangocho_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own row update" on public.tangocho_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
