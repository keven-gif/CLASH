-- ═══════════════════════════════════════════════════════════════════════
-- CLASH Multiplayer Database Schema
-- Run this in your Supabase SQL Editor (SQL → New query → Run)
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─── Profiles ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  rank integer default 0,
  wins integer default 0,
  losses integer default 0,
  main_character text,
  created_at timestamptz default now()
);

-- ─── Match History ───────────────────────────────────────────────────
create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  player1_id uuid references public.profiles(id),
  player2_id uuid references public.profiles(id),
  winner_id uuid references public.profiles(id),
  stage text not null,
  duration_seconds integer,
  player1_damage integer default 0,
  player2_damage integer default 0,
  player1_character text,
  player2_character text,
  created_at timestamptz default now()
);

-- ─── Matchmaking Queue ───────────────────────────────────────────────
create table if not exists public.match_queue (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.profiles(id) unique not null,
  username text not null,
  rank integer default 0,
  status text default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  matched_with uuid references public.profiles(id),
  webrtc_offer text,
  webrtc_answer text,
  created_at timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_queue enable row level security;

-- Profiles: read all, update own only
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Matches: read all, insert by participants only
create policy "Matches are viewable by everyone"
  on public.matches for select using (true);
create policy "Players can insert match results"
  on public.matches for insert with check (
    auth.uid() = player1_id or auth.uid() = player2_id
  );

-- Match Queue: manage own entry, view waiting entries
create policy "Users can manage own queue entry"
  on public.match_queue for all using (auth.uid() = player_id);
create policy "Queue waiting entries are viewable"
  on public.match_queue for select using (status = 'waiting');

-- ─── Enable Realtime ─────────────────────────────────────────────────
alter publication supabase_realtime add table public.match_queue;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.matches;

-- ─── Auto-Create Profile on Signup ───────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, rank, wins, losses)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1),
      'fighter_' || substr(new.id::text, 1, 6)
    ),
    0, 0, 0
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Leaderboard View ────────────────────────────────────────────────
create or replace view public.leaderboard as
select
  id,
  username,
  rank,
  wins,
  losses,
  case when wins + losses > 0
    then round((wins::numeric / (wins + losses)) * 100, 1)
    else 0
  end as win_rate,
  main_character,
  created_at
from public.profiles
order by rank desc, wins desc;

-- ─── RPC: Increment Wins ─────────────────────────────────────────────
create or replace function public.increment_wins(user_id uuid)
returns void as $$
begin
  update public.profiles
  set wins = wins + 1,
      rank = rank + 10
  where id = user_id;
end;
$$ language plpgsql security definer;

-- ─── RPC: Increment Losses ───────────────────────────────────────────
create or replace function public.increment_losses(user_id uuid)
returns void as $$
begin
  update public.profiles
  set losses = losses + 1,
      rank = greatest(0, rank - 5)
  where id = user_id;
end;
$$ language plpgsql security definer;

commit;

-- ═══════════════════════════════════════════════════════════════════════
-- After running this:
-- 1. Go to Supabase Dashboard → Authentication → Settings
-- 2. Enable "Email" provider (or "Anonymous" for quick testing)
-- 3. Copy your Project URL and Anon Key to src/supabase/client.ts
-- ═══════════════════════════════════════════════════════════════════════
