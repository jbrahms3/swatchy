-- Swatchy API schema.
--
-- Photos are stored as bytea directly in Postgres rather than in separate
-- object storage. That's a deliberate tradeoff for this app's scale: photos
-- are already downscaled to a ~700px long edge before upload (same copy used
-- for color sampling on-device), so rows stay small (tens to low hundreds of
-- KB). Moving to S3/R2 later is a clean, isolated change if the app outgrows
-- this — nothing else in the schema depends on where the bytes live.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  photo bytea,
  photo_mime text,
  photo_aspect real,
  pick_u real,
  pick_v real,
  swatch_name text not null,
  swatch_hex text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

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
