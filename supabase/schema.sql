-- Run this in your Supabase project's SQL editor (Dashboard → SQL Editor → New query)
-- Creates the single key/value table the workshop uses for cross-device sync,
-- enables row-level security with public read/write (anonymous workshop), and
-- registers the table for realtime change events.

create table if not exists public.acc_storage (
  room        text not null,
  key         text not null,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  primary key (room, key)
);

alter table public.acc_storage enable row level security;

-- Public access policies. The workshop is intentionally anonymous and
-- short-lived; if you need to lock a room down, add a secret column and a
-- policy that checks it.
drop policy if exists "acc anon read"   on public.acc_storage;
drop policy if exists "acc anon insert" on public.acc_storage;
drop policy if exists "acc anon update" on public.acc_storage;
drop policy if exists "acc anon delete" on public.acc_storage;

create policy "acc anon read"   on public.acc_storage for select using (true);
create policy "acc anon insert" on public.acc_storage for insert with check (true);
create policy "acc anon update" on public.acc_storage for update using (true) with check (true);
create policy "acc anon delete" on public.acc_storage for delete using (true);

-- Realtime publication so the client receives change events.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'acc_storage'
  ) then
    execute 'alter publication supabase_realtime add table public.acc_storage';
  end if;
end $$;

-- Helper: wipe every key in a given room (use before a workshop dry run).
-- Run as: select public.acc_clear_room('default');
create or replace function public.acc_clear_room(p_room text)
returns void
language sql
security definer
as $$
  delete from public.acc_storage where room = p_room;
$$;
