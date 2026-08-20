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
