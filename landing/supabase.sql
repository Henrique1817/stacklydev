-- Execute no SQL Editor do seu projeto Supabase
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  os text check (os in ('windows', 'macos', 'unknown')) default 'unknown',
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Permite inserção anônima caso use NEXT_PUBLIC_SUPABASE_ANON_KEY no backend
create policy "Permitir cadastro na waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

