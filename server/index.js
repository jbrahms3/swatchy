#!/usr/bin/env node
/**
 * Swatchy API. Everything behind Clerk auth except /health. Photos are
 * stored as bytea in Postgres (see schema.sql for why) and streamed back
 * through /posts/:id/photo rather than embedded in the JSON feed payload.
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');
const { clerkMiddleware, requireAuth, getAuth, clerkClient } = require('@clerk/express');

const app = express();
const port = process.env.PORT || 4000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // photos are pre-downscaled client-side; 8MB is generous headroom
});

app.use(cors());
app.use(express.json());

// Ahead of clerkMiddleware so uptime probes work even if Clerk is misconfigured.
app.get('/health', (req, res) => res.json({ ok: true }));

app.use(clerkMiddleware());

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Ensures a `users` row exists for the authenticated Clerk identity. */
async function ensureUser(clerkId) {
  const existing = await pool.query('select * from users where clerk_id = $1', [clerkId]);
  if (existing.rows[0]) return existing.rows[0];

  const clerkUser = await clerkClient.users.getUser(clerkId);
  const name =
    clerkUser.firstName ||
    clerkUser.username ||
    clerkUser.emailAddresses[0]?.emailAddress?.split('@')[0] ||
    'You';

  const inserted = await pool.query(
    'insert into users (clerk_id, name) values ($1, $2) returning *',
    [clerkId, name]
  );
  return inserted.rows[0];
}

function swatchRow(row) {
  return { id: row.id, name: row.name, hex: row.hex, createdAt: +row.created_at };
}

function postRow(row, viewerId) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    photoUri: row.photo === null ? undefined : `/posts/${row.id}/photo`,
    photoAspect: row.photo_aspect ?? undefined,
    pickPoint: row.pick_u === null ? undefined : { u: row.pick_u, v: row.pick_v },
    swatch: {
      id: row.id, // one swatch per post — the post id doubles as the swatch id here
      name: row.swatch_name,
      hex: row.swatch_hex,
      createdAt: +row.created_at,
    },
    caption: row.caption,
    createdAt: +row.created_at,
    likeCount: Number(row.like_count),
    likedByMe: row.liked_by_me,
    mine: row.author_id === viewerId,
  };
}

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

app.get(
  '/me',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const saved = await pool.query(
      'select id, name, hex, created_at from saved_swatches where user_id = $1 order by created_at desc',
      [user.id]
    );
    res.json({ id: user.id, name: user.name, saved: saved.rows.map(swatchRow) });
  })
);

app.patch(
  '/me',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const name = String(req.body.name ?? '').trim().slice(0, 24) || user.name;
    await pool.query('update users set name = $1 where id = $2', [name, user.id]);
    res.json({ id: user.id, name });
  })
);

app.post(
  '/swatches',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const name = String(req.body.name ?? '').trim().slice(0, 40);
    const hex = String(req.body.hex ?? '').trim();
    if (!name || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      return res.status(400).json({ error: 'name and a valid hex are required' });
    }

    // Re-saving the same color updates it in place instead of duplicating.
    const dupe = await pool.query(
      'select id from saved_swatches where user_id = $1 and hex = $2',
      [user.id, hex]
    );
    if (dupe.rows[0]) {
      await pool.query('delete from saved_swatches where id = $1', [dupe.rows[0].id]);
    }

    const inserted = await pool.query(
      'insert into saved_swatches (user_id, name, hex) values ($1, $2, $3) returning *',
      [user.id, name, hex]
    );
    res.status(201).json(swatchRow(inserted.rows[0]));
  })
);

app.patch(
  '/swatches/:id',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const name = String(req.body.name ?? '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      'update saved_swatches set name = $1 where id = $2 and user_id = $3 returning *',
      [name, req.params.id, user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(swatchRow(result.rows[0]));
  })
);

app.delete(
  '/swatches/:id',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    await pool.query('delete from saved_swatches where id = $1 and user_id = $2', [
      req.params.id,
      user.id,
    ]);
    res.status(204).end();
  })
);

const FEED_QUERY = `
  select
    p.id, p.author_id, u.name as author_name, p.photo, p.photo_aspect,
    p.pick_u, p.pick_v, p.swatch_name, p.swatch_hex, p.caption, p.created_at,
    coalesce(l.like_count, 0) as like_count,
    exists(select 1 from likes where post_id = p.id and user_id = $1) as liked_by_me
  from posts p
  join users u on u.id = p.author_id
  left join (
    select post_id, count(*) as like_count from likes group by post_id
  ) l on l.post_id = p.id
  order by p.created_at desc
  limit 200
`;

app.get(
  '/posts',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const result = await pool.query(FEED_QUERY, [user.id]);
    res.json(result.rows.map((row) => postRow(row, user.id)));
  })
);

app.post(
  '/posts',
  requireAuth(),
  upload.single('photo'),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const swatchName = String(req.body.swatchName ?? '').trim().slice(0, 40);
    const swatchHex = String(req.body.swatchHex ?? '').trim();
    const caption = String(req.body.caption ?? '').trim().slice(0, 140);
    const photoAspect = req.body.photoAspect ? Number(req.body.photoAspect) : null;
    const pickU = req.body.pickU !== undefined ? Number(req.body.pickU) : null;
    const pickV = req.body.pickV !== undefined ? Number(req.body.pickV) : null;

    if (!swatchName || !/^#[0-9A-Fa-f]{6}$/.test(swatchHex)) {
      return res.status(400).json({ error: 'swatchName and a valid swatchHex are required' });
    }

    const inserted = await pool.query(
      `insert into posts
        (author_id, photo, photo_mime, photo_aspect, pick_u, pick_v, swatch_name, swatch_hex, caption)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id, created_at`,
      [
        user.id,
        req.file ? req.file.buffer : null,
        req.file ? req.file.mimetype : null,
        photoAspect,
        pickU,
        pickV,
        swatchName,
        swatchHex,
        caption,
      ]
    );

    res.status(201).json(
      postRow(
        {
          id: inserted.rows[0].id,
          author_id: user.id,
          author_name: user.name,
          photo: req.file ? true : null,
          photo_aspect: photoAspect,
          pick_u: pickU,
          pick_v: pickV,
          swatch_name: swatchName,
          swatch_hex: swatchHex,
          caption,
          created_at: inserted.rows[0].created_at,
          like_count: 0,
          liked_by_me: false,
        },
        user.id
      )
    );
  })
);

app.delete(
  '/posts/:id',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const result = await pool.query(
      'delete from posts where id = $1 and author_id = $2 returning id',
      [req.params.id, user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  })
);

app.get(
  '/posts/:id/photo',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const result = await pool.query('select photo, photo_mime from posts where id = $1', [
      req.params.id,
    ]);
    const row = result.rows[0];
    if (!row || !row.photo) return res.status(404).end();

    res.set('Content-Type', row.photo_mime || 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=31536000, immutable'); // photos never change after posting
    res.send(row.photo);
  })
);

app.post(
  '/posts/:id/like',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    await pool.query(
      'insert into likes (post_id, user_id) values ($1, $2) on conflict do nothing',
      [req.params.id, user.id]
    );
    res.status(204).end();
  })
);

app.delete(
  '/posts/:id/like',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    await pool.query('delete from likes where post_id = $1 and user_id = $2', [
      req.params.id,
      user.id,
    ]);
    res.status(204).end();
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

app.listen(port, () => {
  console.log(`Swatchy API listening on :${port}`);
});
