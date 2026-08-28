#!/usr/bin/env node
/**
 * Swatchy API. Everything behind Clerk auth except /health. Photos live in a
 * Railway Bucket (S3-compatible) — the DB only holds the object key, and
 * /posts/:id/photo redirects to a short-lived presigned URL rather than
 * streaming bytes through this service.
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('node:crypto');
const path = require('node:path');
const { Pool } = require('pg');
const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const port = process.env.PORT || 4000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
const S3_BUCKET = process.env.S3_BUCKET;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // photos are pre-downscaled client-side; 8MB is generous headroom
});

app.use(cors());
app.use(express.json());

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Ahead of clerkMiddleware so uptime probes work even if Clerk is misconfigured.
app.get('/health', (req, res) => res.json({ ok: true }));

// The public marketing page — same origin as /waitlist below, so its form
// posts there directly with no CORS dance. Also ahead of clerkMiddleware:
// nothing here needs a session.
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));

app.post(
  '/waitlist',
  asyncRoute(async (req, res) => {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    await pool.query(
      'insert into waitlist_signups (email) values ($1) on conflict (email) do nothing',
      [email]
    );
    res.status(201).json({ ok: true });
  })
);

app.use(clerkMiddleware());

/**
 * Route guard for every authenticated endpoint. Deliberately not
 * @clerk/express's own requireAuth(): with no signInUrl configured (this is
 * an API, not a page), its default for an unauthenticated request is a 302
 * to "/" — which serves landing.html. A client that follows redirects (the
 * default) then hands its JSON parser an HTML page and gets a useless
 * "Unexpected character: <" instead of a clean auth error. This does the
 * same check via getAuth() but always answers in JSON.
 */
function requireAuth() {
  return (req, res, next) => {
    if (!getAuth(req)?.userId) return res.status(401).json({ error: 'unauthenticated' });
    next();
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** The Clerk identity's primary email, lowercased. */
function primaryEmail(clerkUser) {
  const addresses = clerkUser.emailAddresses ?? [];
  const primary =
    addresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ?? addresses[0];
  return primary?.emailAddress?.trim().toLowerCase() ?? null;
}

/** Ensures a `users` row exists for the authenticated Clerk identity. */
async function ensureUser(clerkId) {
  const existing = await pool.query('select * from users where clerk_id = $1', [clerkId]);
  if (existing.rows[0]) return existing.rows[0];

  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email = primaryEmail(clerkUser);
  const name = clerkUser.firstName || clerkUser.username || email?.split('@')[0] || 'You';

  // Two concurrent first-ever requests for the same brand-new user (e.g.
  // /me and /posts firing in parallel from the client's initial load) can
  // both miss the SELECT above and race to insert the same clerk_id.
  // ON CONFLICT DO UPDATE (a harmless no-op) instead of DO NOTHING means
  // RETURNING still hands back a row to the loser too, instead of erroring.
  const inserted = await pool.query(
    `insert into users (clerk_id, name, email, onboarded)
     values ($1, $2, $3, false)
     on conflict (clerk_id) do update set clerk_id = excluded.clerk_id
     returning *`,
    [clerkId, name, email]
  );
  return inserted.rows[0];
}

/* ------------------------------------------------------------------ *
 * Admin
 *
 * One short allowlist of emails, not a role column — there is exactly one
 * curator today. Set ADMIN_EMAILS (comma-separated) to change who that is
 * without a deploy.
 * ------------------------------------------------------------------ */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'aidan.somsen@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/**
 * Users created before the email column existed have a null there, so fill
 * it in from Clerk the first time we need it and keep the copy.
 */
async function emailFor(user) {
  if (user.email) return user.email;

  const email = primaryEmail(await clerkClient.users.getUser(user.clerk_id));
  if (email) await pool.query('update users set email = $1 where id = $2', [email, user.id]);
  return email;
}

async function isAdmin(user) {
  const email = await emailFor(user);
  return !!email && ADMIN_EMAILS.includes(email);
}

/** Route guard for the curator-only endpoints. Chain it after requireAuth(). */
const requireAdmin = () =>
  asyncRoute(async (req, res, next) => {
    const user = await ensureUser(getAuth(req).userId);
    if (!(await isAdmin(user))) return res.status(403).json({ error: 'not allowed' });
    req.appUser = user;
    next();
  });

/** Default for swatchRow()/postRow() callers that don't need real counts (e.g. a row just created). */
const EMPTY_COUNTS = new Map();

/**
 * How many artworks (across all users — this is a shared stat, same spirit
 * as the feed) tag each hex, keyed by uppercased hex. One query, reused
 * across whatever's being decorated in a given request rather than a
 * per-swatch round trip.
 */
async function artworkCountsByHex() {
  const result = await pool.query(`
    select hex, count(*)::int as count
    from (
      select a.id, upper(elem->>'hex') as hex
      from artworks a, jsonb_array_elements(a.colors) as elem
      group by a.id, upper(elem->>'hex')
    ) distinct_per_artwork
    group by hex
  `);
  return new Map(result.rows.map((r) => [r.hex, r.count]));
}

function swatchRow(row, counts = EMPTY_COUNTS) {
  return {
    id: row.id,
    name: row.name,
    hex: row.hex,
    createdAt: +row.created_at,
    artworkCount: counts.get(row.hex.toUpperCase()) ?? 0,
  };
}

function postRow(row, viewerId, counts = EMPTY_COUNTS) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    photoUri: row.photo_key ? `/posts/${row.id}/photo` : undefined,
    photoAspect: row.photo_aspect ?? undefined,
    pickPoint: row.pick_u === null ? undefined : { u: row.pick_u, v: row.pick_v },
    swatch: {
      id: row.id, // one swatch per post — the post id doubles as the swatch id here
      name: row.swatch_name,
      hex: row.swatch_hex,
      createdAt: +row.created_at,
      artworkCount: counts.get(row.swatch_hex.toUpperCase()) ?? 0,
    },
    caption: row.caption,
    createdAt: +row.created_at,
    likeCount: Number(row.like_count),
    likedByMe: row.liked_by_me,
    mine: row.author_id === viewerId,
  };
}

/* ------------------------------------------------------------------ *
 * Weekly challenge — one palette per ISO week, the same for everyone.
 *
 * Palettes are curated: an admin queues them by hex ahead of time (see the
 * /weekly/queue routes) and paletteForWeek() promotes the head of the queue
 * the first time a new week is asked for. The generator below is the
 * fallback for weeks that arrive with an empty queue.
 * ------------------------------------------------------------------ */

const WEEKLY_PALETTE_SIZE = 5;

/** ISO week key, e.g. "2026-W34" — stable Monday through Sunday. */
function weekKeyFor(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday pins the ISO year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function hashSeed(str) {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic PRNG — same seed always produces the same stream (mulberry32). */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to255 = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`.toUpperCase();
}

/**
 * Hue offsets, in degrees from the week's base hue. Picking every hue at
 * random makes five unrelated colors that clash; walking a harmony keeps
 * them in one family, while the gaps stay wide enough that each is still
 * its own thing to go and find. One entry per WEEKLY_PALETTE_SIZE slot.
 */
const HUE_HARMONIES = [
  [0, 34, 68, 102, 136], // analogous — a single gentle sweep
  [0, 30, 60, 170, 205], // analogous, plus a soft complementary accent
  [0, 34, 118, 152, 240], // triadic, loosened up
  [0, 40, 80, 200, 240], // split complementary
  [0, 30, 62, 150, 195], // a family, then two off the far side
];

/**
 * Perceived lightness moves a lot with hue: the same HSL lightness reads
 * near-white in yellow but still plainly colored in blue. Trim it back
 * around yellow and lift it around blue so the five swatches feel like
 * one set rather than a bright one next to a dull one.
 */
function pastelLightnessTrim(h) {
  return 4 * Math.cos(((h - 240) * Math.PI) / 180);
}

// How far apart two targets have to be, in the |dR|+|dG|+|dB| the scoring
// uses, before they count as separate things to go and find. Pastels sit
// in a narrow band, so slots left to chance can land close enough that one
// photo would answer both; each slot tries a few shades and takes the
// first that clears this, or the furthest away it managed.
const MIN_SLOT_SEPARATION = 80;
const SHADE_ATTEMPTS = 16;

/** This week's palette — same for everyone, changes only when the week does. */
function weeklyPalette(weekKey) {
  const rand = mulberry32(hashSeed(weekKey));
  const harmony = HUE_HARMONIES[Math.floor(rand() * HUE_HARMONIES.length)];
  const baseHue = rand() * 360;
  const direction = rand() < 0.5 ? -1 : 1; // run the harmony either way round the wheel

  const chosen = [];
  for (const offset of harmony.slice(0, WEEKLY_PALETTE_SIZE)) {
    let best = null;
    let bestGap = -1;

    for (let attempt = 0; attempt < SHADE_ATTEMPTS; attempt++) {
      const jitter = rand() * 10 - 5; // keeps repeat harmonies from looking identical
      const h = (((baseHue + direction * offset + jitter) % 360) + 360) % 360;
      const s = 30 + rand() * 18; // 30-48%: tinted, never poster-bright
      const l = 64 + rand() * 22 + pastelLightnessTrim(h); // pastel, but still clearly a color
      const hex = hslToHex(h, s, l);

      const gap = chosen.length === 0 ? Infinity : Math.min(...chosen.map((c) => hexDistance(c, hex)));
      if (gap > bestGap) {
        bestGap = gap;
        best = hex;
      }
      if (bestGap >= MIN_SLOT_SEPARATION) break;
    }

    chosen.push(best);
  }
  return chosen;
}

function hexToRgbTriple(hex) {
  const int = parseInt(hex.replace('#', ''), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** How far apart two colors are, in the same units a submission is scored in. */
function hexDistance(a, b) {
  const [ar, ag, ab] = hexToRgbTriple(a);
  const [br, bg, bb] = hexToRgbTriple(b);
  return Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
}

/** "#a1b2c3", "a1b2c3" and "#abc" all normalize to "#A1B2C3". Null if it isn't one. */
function normalizeHex(input) {
  const raw = String(input ?? '').trim().replace(/^#/, '');
  if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return null;
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  return `#${full.toUpperCase()}`;
}

/**
 * The palette in play for a given week, promoting the queue if this is the
 * first request since the week rolled over.
 *
 * Every path writes the week's colors down before returning them, so the
 * palette is fixed the moment the week is first looked at — queueing a
 * palette on Wednesday can't swap out the colors people are already
 * shooting against.
 */
async function paletteForWeek(weekKey) {
  const live = await pool.query('select colors from weekly_palettes where week_key = $1', [weekKey]);
  if (live.rows[0]) return live.rows[0].colors;

  // Two requests can arrive at once on the first hit of a new week. Both
  // statements below are single statements that lose gracefully: week_key
  // is unique, so the loser falls through to re-reading the winner's row.
  try {
    const claimed = await pool.query(
      `update weekly_palettes
          set week_key = $1, went_live_at = now()
        where id = (
                select id from weekly_palettes
                 where week_key is null
                 order by created_at, id
                 limit 1
                 for update skip locked
              )
      returning colors`,
      [weekKey]
    );
    if (claimed.rows[0]) return claimed.rows[0].colors;

    // Nothing queued — generate one and keep it, so the week is pinned.
    const generated = await pool.query(
      `insert into weekly_palettes (colors, week_key, source, went_live_at)
       values ($1, $2, 'generated', now())
       on conflict (week_key) do nothing
       returning colors`,
      [JSON.stringify(weeklyPalette(weekKey)), weekKey]
    );
    if (generated.rows[0]) return generated.rows[0].colors;
  } catch (err) {
    if (err.code !== '23505') throw err; // anything but a week_key collision is a real failure
  }

  const raced = await pool.query('select colors from weekly_palettes where week_key = $1', [weekKey]);
  return raced.rows[0]?.colors ?? weeklyPalette(weekKey);
}

function queuedPaletteRow(row) {
  return {
    id: row.id,
    colors: row.colors,
    source: row.source,
    weekKey: row.week_key,
    createdAt: +row.created_at,
  };
}

function weeklyEntryRow(row) {
  return {
    id: row.id,
    slot: row.slot_index,
    targetHex: row.target_hex,
    photoUri: `/weekly-photo/${row.id}`,
    photoAspect: row.photo_aspect ?? undefined,
    pickPoint: row.pick_u === null ? undefined : { u: row.pick_u, v: row.pick_v },
    pickedHex: row.picked_hex,
    diffR: row.diff_r,
    diffG: row.diff_g,
    diffB: row.diff_b,
    score: row.score,
    createdAt: +row.created_at,
  };
}

function artworkRow(row) {
  return {
    id: row.id,
    // Only present on the cross-user by-color listing — the owner's own
    // /artworks doesn't join users, since every row there is already theirs.
    authorName: row.author_name ?? undefined,
    photoUri: `/artworks/${row.id}/photo`,
    photoAspect: row.photo_aspect ?? undefined,
    caption: row.caption,
    colors: row.colors,
    createdAt: +row.created_at,
  };
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

app.get(
  '/me',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const [saved, admin, counts] = await Promise.all([
      pool.query(
        'select id, name, hex, created_at from saved_swatches where user_id = $1 order by created_at desc',
        [user.id]
      ),
      isAdmin(user),
      artworkCountsByHex(),
    ]);
    res.json({
      id: user.id,
      name: user.name,
      onboarded: user.onboarded,
      isAdmin: admin,
      saved: saved.rows.map((row) => swatchRow(row, counts)),
    });
  })
);

app.patch(
  '/me',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const name = String(req.body.name ?? '').trim().slice(0, 24) || user.name;
    const onboarded = req.body.onboarded === undefined ? user.onboarded : !!req.body.onboarded;
    await pool.query('update users set name = $1, onboarded = $2 where id = $3', [
      name,
      onboarded,
      user.id,
    ]);
    res.json({ id: user.id, name, onboarded });
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
    p.id, p.author_id, u.name as author_name, p.photo_key, p.photo_aspect,
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
    const [result, counts] = await Promise.all([pool.query(FEED_QUERY, [user.id]), artworkCountsByHex()]);
    res.json(result.rows.map((row) => postRow(row, user.id, counts)));
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

    const id = crypto.randomUUID();
    let photoKey = null;

    if (req.file) {
      const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
      photoKey = `photos/${id}.${ext}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: photoKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );
    }

    const inserted = await pool.query(
      `insert into posts
        (id, author_id, photo_key, photo_aspect, pick_u, pick_v, swatch_name, swatch_hex, caption)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning id, created_at`,
      [id, user.id, photoKey, photoAspect, pickU, pickV, swatchName, swatchHex, caption]
    );

    res.status(201).json(
      postRow(
        {
          id: inserted.rows[0].id,
          author_id: user.id,
          author_name: user.name,
          photo_key: photoKey,
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
      'delete from posts where id = $1 and author_id = $2 returning photo_key',
      [req.params.id, user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'not found' });

    const photoKey = result.rows[0].photo_key;
    if (photoKey) {
      // Best effort — an orphaned bucket object isn't worth failing the delete over.
      s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: photoKey })).catch((err) =>
        console.error('[posts] Failed to delete photo from bucket', photoKey, err)
      );
    }
    res.status(204).end();
  })
);

// Deliberately not behind requireAuth(): image tags can't easily attach an
// Authorization header, and post ids are unguessable UUIDs only ever handed
// out via the (auth-gated) feed — same privacy bar as an unlisted link.
const PHOTO_URL_TTL_SECONDS = 6 * 60 * 60; // 6h — long enough to cut repeat hits, short enough to rotate

app.get(
  '/posts/:id/photo',
  asyncRoute(async (req, res) => {
    const result = await pool.query('select photo_key from posts where id = $1', [req.params.id]);
    const photoKey = result.rows[0]?.photo_key;
    if (!photoKey) return res.status(404).end();

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: photoKey }),
      { expiresIn: PHOTO_URL_TTL_SECONDS }
    );
    // Cache the redirect itself so repeat loads skip this server entirely
    // until the presigned URL is due to expire.
    res.set('Cache-Control', `public, max-age=${PHOTO_URL_TTL_SECONDS}`);
    res.redirect(302, url);
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

app.get(
  '/weekly',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const weekKey = weekKeyFor(new Date());
    const palette = await paletteForWeek(weekKey);

    const result = await pool.query(
      'select * from weekly_entries where user_id = $1 and week_key = $2',
      [user.id, weekKey]
    );

    res.json({
      weekKey,
      palette: palette.map((hex, slot) => ({ slot, hex })),
      entries: result.rows.map(weeklyEntryRow),
    });
  })
);

// Preview only — this is the generator that fills a week in when nothing is
// queued, run against a fresh random seed so the curator can look at what it
// produces (and start a palette from it). Doesn't touch weekly_palettes or
// weekly_entries, and has no bearing on the live challenge.
app.get(
  '/weekly/preview',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const seed = crypto.randomUUID();
    const palette = weeklyPalette(seed);
    res.json({ seed, palette: palette.map((hex, slot) => ({ slot, hex })) });
  })
);

/* ------------------------------------------------------------------ *
 * Weekly palette queue (curator only)
 *
 * Registered ahead of POST /weekly/:slot so "queue" isn't read as a slot
 * number.
 * ------------------------------------------------------------------ */

const MAX_PALETTE_COLORS = 24;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

app.get(
  '/weekly/queue',
  requireAuth(),
  requireAdmin(),
  asyncRoute(async (req, res) => {
    const weekKey = weekKeyFor(new Date());

    // Promotes the queue if the week just rolled over, so what's shown as
    // live here is the same thing /weekly is handing out. Has to run before
    // the reads below, which is why it isn't in the Promise.all.
    const liveColors = await paletteForWeek(weekKey);
    const [live, queued] = await Promise.all([
      pool.query('select source from weekly_palettes where week_key = $1', [weekKey]),
      pool.query('select * from weekly_palettes where week_key is null order by created_at, id'),
    ]);

    const now = Date.now();
    res.json({
      current: {
        weekKey,
        colors: liveColors,
        source: live.rows[0]?.source ?? 'generated',
      },
      // Each queued palette goes live on a successive Monday, in order.
      queued: queued.rows.map((row, i) => ({
        ...queuedPaletteRow(row),
        goesLiveWeekKey: weekKeyFor(new Date(now + (i + 1) * WEEK_MS)),
      })),
    });
  })
);

app.post(
  '/weekly/queue',
  requireAuth(),
  requireAdmin(),
  asyncRoute(async (req, res) => {
    const input = Array.isArray(req.body.colors) ? req.body.colors : null;
    if (!input || input.length === 0) {
      return res.status(400).json({ error: 'at least one color is required' });
    }
    if (input.length > MAX_PALETTE_COLORS) {
      return res.status(400).json({ error: `at most ${MAX_PALETTE_COLORS} colors per palette` });
    }

    const colors = input.map(normalizeHex);
    const badIndex = colors.indexOf(null);
    if (badIndex !== -1) {
      return res.status(400).json({ error: `"${input[badIndex]}" isn't a hex color` });
    }

    const inserted = await pool.query(
      `insert into weekly_palettes (colors, source, created_by)
       values ($1, 'curated', $2)
       returning *`,
      [JSON.stringify(colors), req.appUser.id]
    );
    res.status(201).json(queuedPaletteRow(inserted.rows[0]));
  })
);

app.delete(
  '/weekly/queue/:id',
  requireAuth(),
  requireAdmin(),
  asyncRoute(async (req, res) => {
    // `week_key is null` keeps this to palettes that haven't run yet — a
    // past or current week is history, not a queue entry.
    const result = await pool.query(
      'delete from weekly_palettes where id = $1 and week_key is null returning id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'not a queued palette' });
    res.status(204).end();
  })
);

app.post(
  '/weekly/:slot',
  requireAuth(),
  upload.single('photo'),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const slot = Number(req.params.slot);
    const weekKey = weekKeyFor(new Date());
    const palette = await paletteForWeek(weekKey);

    if (!Number.isInteger(slot) || slot < 0 || slot >= palette.length) {
      return res.status(400).json({ error: 'invalid slot' });
    }
    const pickedHex = String(req.body.pickedHex ?? '').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(pickedHex)) {
      return res.status(400).json({ error: 'a valid pickedHex is required' });
    }
    if (!req.file) return res.status(400).json({ error: 'a photo is required' });

    const photoAspect = req.body.photoAspect ? Number(req.body.photoAspect) : null;
    const pickU = req.body.pickU !== undefined ? Number(req.body.pickU) : null;
    const pickV = req.body.pickV !== undefined ? Number(req.body.pickV) : null;

    // Scored server-side against the target this route itself computes —
    // never trust a client-supplied target hex.
    const targetHex = palette[slot];
    const [tr, tg, tb] = hexToRgbTriple(targetHex);
    const [pr, pg, pb] = hexToRgbTriple(pickedHex);
    const diffR = Math.abs(tr - pr);
    const diffG = Math.abs(tg - pg);
    const diffB = Math.abs(tb - pb);
    const score = diffR + diffG + diffB;

    // Resubmitting a slot replaces the previous attempt in place.
    const existing = await pool.query(
      'select id, photo_key from weekly_entries where user_id = $1 and week_key = $2 and slot_index = $3',
      [user.id, weekKey, slot]
    );

    const id = existing.rows[0]?.id ?? crypto.randomUUID();
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const photoKey = `weekly/${weekKey}/${user.id}/${slot}-${id}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: photoKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const upserted = await pool.query(
      `insert into weekly_entries
        (id, user_id, week_key, slot_index, target_hex, photo_key, photo_aspect, pick_u, pick_v,
         picked_hex, diff_r, diff_g, diff_b, score)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (user_id, week_key, slot_index)
       do update set
         target_hex = excluded.target_hex, photo_key = excluded.photo_key,
         photo_aspect = excluded.photo_aspect, pick_u = excluded.pick_u, pick_v = excluded.pick_v,
         picked_hex = excluded.picked_hex, diff_r = excluded.diff_r, diff_g = excluded.diff_g,
         diff_b = excluded.diff_b, score = excluded.score, created_at = now()
       returning *`,
      [id, user.id, weekKey, slot, targetHex, photoKey, photoAspect, pickU, pickV, pickedHex, diffR, diffG, diffB, score]
    );

    const oldPhotoKey = existing.rows[0]?.photo_key;
    if (oldPhotoKey && oldPhotoKey !== photoKey) {
      // Best effort — an orphaned bucket object isn't worth failing the submit over.
      s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldPhotoKey })).catch((err) =>
        console.error('[weekly] Failed to delete replaced photo from bucket', oldPhotoKey, err)
      );
    }

    res.status(201).json(weeklyEntryRow(upserted.rows[0]));
  })
);

// Same unauthenticated-but-unguessable-id pattern as /posts/:id/photo.
app.get(
  '/weekly-photo/:id',
  asyncRoute(async (req, res) => {
    const result = await pool.query('select photo_key from weekly_entries where id = $1', [
      req.params.id,
    ]);
    const photoKey = result.rows[0]?.photo_key;
    if (!photoKey) return res.status(404).end();

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: photoKey }),
      { expiresIn: PHOTO_URL_TTL_SECONDS }
    );
    res.set('Cache-Control', `public, max-age=${PHOTO_URL_TTL_SECONDS}`);
    res.redirect(302, url);
  })
);

// Every color anyone has actually added to the app — saved to their
// collection, or claimed and posted — deduped by hex. Backs client-side
// artwork auto-tagging (src/lib/colorExtract.ts matches a photo against
// this list rather than inventing colors from the photo itself), so it
// deliberately excludes artworks.colors: those are already the *result*
// of that matching, not something a person typed in or claimed themselves.
app.get(
  '/colors/catalog',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const result = await pool.query(`
      select distinct on (upper(hex)) upper(hex) as hex, name
        from (
          select hex, name, created_at from saved_swatches
          union all
          select swatch_hex as hex, swatch_name as name, created_at from posts
        ) claimed
       order by upper(hex), created_at desc
       limit 3000
    `);
    res.json(result.rows);
  })
);

// Mirrors MAX_EXTRACTED_COLORS in src/lib/colorExtract.ts — the client
// auto-tags a photo with colors from the catalog above, up to this many.
const MAX_ARTWORK_COLORS = 25;

app.get(
  '/artworks',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const result = await pool.query(
      'select * from artworks where user_id = $1 order by created_at desc',
      [user.id]
    );
    res.json(result.rows.map(artworkRow));
  })
);

// Backs the "tagged N times" stat on a color: everyone's artworks that
// tagged this exact hex, newest first — same privacy bar as the home feed
// (any signed-in user, not just the artwork's owner), since the aggregate
// count is already shown to every viewer of that color.
app.get(
  '/artworks/by-color/:hex',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const hex = normalizeHex(req.params.hex);
    if (!hex) return res.status(400).json({ error: 'not a valid hex color' });

    const result = await pool.query(
      `select a.*, u.name as author_name
         from artworks a
         join users u on u.id = a.user_id
        where exists (
                select 1 from jsonb_array_elements(a.colors) elem
                 where upper(elem->>'hex') = $1
              )
        order by a.created_at desc
        limit 200`,
      [hex] // stored colors keep the '#', e.g. "#AABBCC" — matches artworkCountsByHex()'s keys
    );
    res.json(result.rows.map(artworkRow));
  })
);

app.post(
  '/artworks',
  requireAuth(),
  upload.single('photo'),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const caption = String(req.body.caption ?? '').trim().slice(0, 140);
    const photoAspect = req.body.photoAspect ? Number(req.body.photoAspect) : null;

    if (!req.file) return res.status(400).json({ error: 'a photo is required' });

    let colors;
    try {
      colors = JSON.parse(req.body.colors ?? '[]');
    } catch {
      return res.status(400).json({ error: 'colors must be JSON' });
    }
    if (!Array.isArray(colors) || colors.length === 0) {
      return res.status(400).json({ error: 'at least one tagged color is required' });
    }
    if (colors.length > MAX_ARTWORK_COLORS) {
      return res.status(400).json({ error: `at most ${MAX_ARTWORK_COLORS} colors per artwork` });
    }
    colors = colors.map((c) => ({
      name: String(c?.name ?? '').trim().slice(0, 40),
      hex: String(c?.hex ?? '').trim().toUpperCase(),
    }));
    if (colors.some((c) => !c.name || !/^#[0-9A-Fa-f]{6}$/.test(c.hex))) {
      return res.status(400).json({ error: 'each color needs a name and a valid hex' });
    }

    const id = crypto.randomUUID();
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const photoKey = `artworks/${id}.${ext}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: photoKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const inserted = await pool.query(
      `insert into artworks (id, user_id, photo_key, photo_aspect, caption, colors)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [id, user.id, photoKey, photoAspect, caption, JSON.stringify(colors)]
    );

    res.status(201).json(artworkRow(inserted.rows[0]));
  })
);

app.delete(
  '/artworks/:id',
  requireAuth(),
  asyncRoute(async (req, res) => {
    const user = await ensureUser(getAuth(req).userId);
    const result = await pool.query(
      'delete from artworks where id = $1 and user_id = $2 returning photo_key',
      [req.params.id, user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'not found' });

    const photoKey = result.rows[0].photo_key;
    s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: photoKey })).catch((err) =>
      console.error('[artworks] Failed to delete photo from bucket', photoKey, err)
    );
    res.status(204).end();
  })
);

// Same unauthenticated-but-unguessable-id pattern as /posts/:id/photo.
app.get(
  '/artworks/:id/photo',
  asyncRoute(async (req, res) => {
    const result = await pool.query('select photo_key from artworks where id = $1', [
      req.params.id,
    ]);
    const photoKey = result.rows[0]?.photo_key;
    if (!photoKey) return res.status(404).end();

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: photoKey }),
      { expiresIn: PHOTO_URL_TTL_SECONDS }
    );
    res.set('Cache-Control', `public, max-age=${PHOTO_URL_TTL_SECONDS}`);
    res.redirect(302, url);
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
