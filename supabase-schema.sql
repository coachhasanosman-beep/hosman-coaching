-- ============================================================
-- HOSMAN COACHING — SUPABASE SCHEMA
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ────────────────────────────────────────────────
-- Extends Supabase auth.users with role and display info
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('coach', 'client')),
  full_name    text not null,
  email        text not null,
  avatar_url   text,
  created_at   timestamptz default now()
);

-- ── PACKAGES (session bundles) ───────────────────────────────
create table packages (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references profiles(id) on delete cascade,
  sessions_total  int not null,
  sessions_used   int not null default 0,
  price_paid      numeric(10,2),
  stripe_payment_intent text,
  purchased_at    timestamptz default now(),
  expires_at      timestamptz
);

-- ── PROGRAMMES ──────────────────────────────────────────────
create table programmes (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references profiles(id) on delete cascade,
  title        text not null default 'Block 1',
  week_start   date,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── PROGRAMME SESSIONS (tabs: Session A, B, C…) ─────────────
create table programme_sessions (
  id             uuid primary key default uuid_generate_v4(),
  programme_id   uuid not null references programmes(id) on delete cascade,
  name           text not null default 'Session A',
  position       int not null default 0
);

-- ── EXERCISES ───────────────────────────────────────────────
create table exercises (
  id                   uuid primary key default uuid_generate_v4(),
  programme_session_id uuid not null references programme_sessions(id) on delete cascade,
  position             int not null default 0,
  name                 text not null default '',
  sets_reps            text default '',
  notes                text default '',
  -- Week loads stored as JSON array of 6 strings
  week_loads           jsonb default '["","","","","",""]'
);

-- ── SCHEDULED SESSIONS ──────────────────────────────────────
create table scheduled_sessions (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references profiles(id) on delete cascade,
  title        text not null,
  location     text,
  starts_at    timestamptz not null,
  duration_min int default 60,
  type         text not null check (type in ('coached','solo')) default 'coached',
  status       text not null check (status in ('scheduled','completed','cancelled')) default 'scheduled',
  notes        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz default now()
);

-- ── METRICS ─────────────────────────────────────────────────
create table metrics (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references profiles(id) on delete cascade,
  recorded_at  timestamptz not null default now(),
  weight_kg    numeric(5,2),
  smm_kg       numeric(5,2),
  body_fat_pct numeric(4,2),
  entered_by   uuid references profiles(id)
);

-- ── NOTIFICATION PREFERENCES ────────────────────────────────
create table notification_prefs (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid not null references profiles(id) on delete cascade unique,
  session_reminder  boolean default true,
  low_sessions      boolean default true,
  push_subscription jsonb
);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

alter table profiles             enable row level security;
alter table packages             enable row level security;
alter table programmes           enable row level security;
alter table programme_sessions   enable row level security;
alter table exercises            enable row level security;
alter table scheduled_sessions   enable row level security;
alter table metrics              enable row level security;
alter table notification_prefs   enable row level security;

-- Helper: is the current user a coach?
create or replace function is_coach()
returns boolean language sql security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'coach')
$$;

-- Helper: does the current user own this client_id or is a coach?
create or replace function owns_or_coach(target_client_id uuid)
returns boolean language sql security definer as $$
  select auth.uid() = target_client_id or is_coach()
$$;

-- PROFILES
create policy "Users read own profile or coach reads all"
  on profiles for select using (id = auth.uid() or is_coach());
create policy "Users update own profile"
  on profiles for update using (id = auth.uid());
create policy "Coach insert profiles"
  on profiles for insert with check (is_coach() or id = auth.uid());

-- PACKAGES
create policy "Client reads own packages; coach reads all"
  on packages for select using (owns_or_coach(client_id));
create policy "Coach manages packages"
  on packages for all using (is_coach());
create policy "Client inserts own package (purchase)"
  on packages for insert with check (client_id = auth.uid());

-- PROGRAMMES
create policy "Client reads own programmes; coach reads all"
  on programmes for select using (owns_or_coach(client_id));
create policy "Coach or client can upsert programmes"
  on programmes for all using (owns_or_coach(client_id));

-- PROGRAMME SESSIONS
create policy "Programme session access via programme"
  on programme_sessions for all using (
    exists (select 1 from programmes p where p.id = programme_id and owns_or_coach(p.client_id))
  );

-- EXERCISES
create policy "Exercise access via programme session"
  on exercises for all using (
    exists (
      select 1 from programme_sessions ps
      join programmes p on p.id = ps.programme_id
      where ps.id = programme_session_id and owns_or_coach(p.client_id)
    )
  );

-- SCHEDULED SESSIONS
create policy "Client reads own sessions; coach reads all"
  on scheduled_sessions for select using (owns_or_coach(client_id));
create policy "Coach manages all sessions"
  on scheduled_sessions for all using (is_coach());
create policy "Client inserts own solo sessions"
  on scheduled_sessions for insert with check (client_id = auth.uid() and type = 'solo');
create policy "Client updates own solo sessions"
  on scheduled_sessions for update using (client_id = auth.uid() and type = 'solo');

-- METRICS
create policy "Client reads own metrics; coach reads all"
  on metrics for select using (owns_or_coach(client_id));
create policy "Coach or client inserts metrics"
  on metrics for insert with check (owns_or_coach(client_id));

-- NOTIFICATION PREFS
create policy "Client manages own prefs"
  on notification_prefs for all using (client_id = auth.uid() or is_coach());

-- ════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Auto-create profile on signup (for self-signup clients)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ════════════════════════════════════════════════════════════
-- SEED: Create coach account
-- After running this schema, go to Supabase Auth > Users >
-- Invite user with YOUR email, then run:
--
--   update profiles set role = 'coach' where email = 'YOUR_EMAIL';
--
-- ════════════════════════════════════════════════════════════
