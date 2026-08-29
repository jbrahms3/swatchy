-- Swatchy API schema.
--
-- Photos live in a Railway Bucket (S3-compatible object storage), not in this
-- database — `posts.photo_key` is just the object key. /posts/:id/photo
-- redirects to a short-lived presigned URL rather than streaming bytes
-- through the API, so photo traffic never touches this service's egress.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- Defaults true so it backfills existing rows as already-onboarded; new
-- signups override it to false explicitly in ensureUser() so only they see
-- the onboarding flow.
alter table users add column if not exists onboarded boolean not null default true;

-- Cached from Clerk so the admin check (see ADMIN_EMAILS in index.js) is a
-- column read rather than a Clerk API call on every request. Nullable: rows
-- created before this column existed get backfilled lazily on first use.
alter table users add column if not exists email text;

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  photo_key text,
  photo_aspect real,
  pick_u real,
  pick_v real,
  swatch_name text not null,
  swatch_hex text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

-- Migrates any table created before the move to bucket storage. No-ops
-- (IF EXISTS / IF NOT EXISTS) once already applied.
alter table posts drop column if exists photo;
alter table posts drop column if exists photo_mime;
alter table posts add column if not exists photo_key text;

create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_author_id_idx on posts (author_id);

create table if not exists likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists saved_swatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  hex text not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_swatches_user_id_idx on saved_swatches (user_id);

-- Weekly challenge palettes, curated by an admin ahead of time.
--
-- A row with a null week_key is queued; the first request in a new ISO week
-- stamps the head of the queue with that week key, which is what makes the
-- swap happen at Monday 00:00 UTC without a scheduler running anywhere.
-- Stamped rows are never reused, so this doubles as the history of what
-- every past week actually asked for.
--
-- When the queue runs dry the generator in index.js fills the week in and
-- the result is written here too (source = 'generated'), so a palette
-- queued mid-week can't yank the colors out from under anyone already
-- shooting against them.
create table if not exists weekly_palettes (
  id uuid primary key default gen_random_uuid(),
  colors jsonb not null,
  week_key text unique,
  source text not null default 'curated',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  went_live_at timestamptz
);

-- Only the queued rows are ever ordered through, so index just those.
create index if not exists weekly_palettes_queue_idx
  on weekly_palettes (created_at, id)
  where week_key is null;

-- The photo each user submits per color. Slots are positional into that
-- week's palette, and target_hex is snapshotted per entry so scores stay
-- meaningful no matter what the palette table says later.
create table if not exists weekly_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_key text not null,
  slot_index int not null,
  target_hex text not null,
  photo_key text not null,
  photo_aspect real,
  pick_u real,
  pick_v real,
  picked_hex text not null,
  diff_r int not null,
  diff_g int not null,
  diff_b int not null,
  score int not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_key, slot_index)
);

create index if not exists weekly_entries_user_week_idx on weekly_entries (user_id, week_key);

-- Marketing waitlist, collected from the public landing page (GET /). Not
-- tied to a `users` row — most signups happen before someone has an account.
create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Artwork someone made using colors from their own collection (saved
-- swatches + colors they've claimed via posts). `colors` is a snapshot of
-- {name, hex} at upload time, not a live reference — a saved swatch getting
-- renamed or removed later shouldn't rewrite what an old artwork says it used.
create table if not exists artworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  photo_key text not null,
  photo_aspect real,
  caption text not null default '',
  colors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists artworks_user_id_idx on artworks (user_id);
create index if not exists artworks_created_at_idx on artworks (created_at desc);

-- "Guess the Color" — a separate, public mini-game on the marketing site
-- (server/guess.html), not part of the app or its accounts. An admin (a
-- shared secret, GUESS_ADMIN_KEY — see index.js) queues {name, hex} rounds
-- ahead of time; the first request on a new UTC day stamps the head of the
-- queue with that day, same promote-on-first-request pattern as
-- weekly_palettes. hex stays hidden until the round's day has passed.
--
-- No login: whoever's playing is identified only by whatever name they
-- type. That's a deliberate trade for keeping this open to anyone visiting
-- the site, not just app users — see color_guess_entries.
create table if not exists color_guess_rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex text not null,
  day_key text unique,
  created_at timestamptz not null default now(),
  went_live_at timestamptz
);

create index if not exists color_guess_rounds_queue_idx
  on color_guess_rounds (created_at, id)
  where day_key is null;

-- One guess per (round, name) — resubmitting under the same name (case-
-- insensitively) replaces the previous guess rather than adding another.
create table if not exists color_guess_entries (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references color_guess_rounds(id) on delete cascade,
  player_name text not null,
  guess_hex text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists color_guess_entries_round_name_idx
  on color_guess_entries (round_id, lower(player_name));
