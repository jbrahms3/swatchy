/**
 * Auto-tags an artwork upload with the colors from the community's existing
 * palette — everything anyone has ever saved or claimed — that actually show
 * up in the photo. Two passes over the decoded pixels:
 *
 *  1. Bucket every pixel into a coarse RGB grid and tally each bucket's
 *     pixel count — cheap, and frequency is exactly "how much of the photo
 *     is this color".
 *  2. Walk buckets by count, richest first, and for each one large enough to
 *     be a real area (not noise) find its nearest catalog color. Within a
 *     perceptual tolerance (CIE94), that counts as a match — outside it,
 *     the bucket isn't tagged as anything, on purpose: only colors that
 *     already exist in the catalog ever get applied, nothing invented from
 *     the photo itself.
 */

import { deltaE94, hexToRgb, rgbToLab, type RGB } from './color';
import type { Bitmap } from './png';

export const MAX_EXTRACTED_COLORS = 25;

// 256 / 32 = 8 buckets per channel, 512 buckets total — coarse enough that
// near-identical pixels (JPEG noise, anti-aliasing) land in the same
// bucket, fine enough that distinct colors don't get mashed together.
const BUCKET_STEP = 32;

// Below this share of the photo's pixels, a bucket reads as noise (a few
// stray pixels along an edge) rather than a color actually present in the
// artwork — skip it even if there's room left for more matches.
const MIN_PIXEL_SHARE = 0.002;

// How close (CIE94) a photo bucket has to land to a catalog color before
// it counts as that color actually appearing in the artwork. Set tight on
// purpose — a synthetic test against a painting-like photo (broad,
// continuously blended color fields, no exact catalog matches) found 14
// tagged 4 of 6 unrelated catalog colors just because some blended pixel
// region happened to land within that tolerance of them. At 5, only a
// color genuinely close to a catalog entry counts, at the cost of some
// real matches being missed when a photo's lighting pushes a color
// further than this from whatever hex was originally saved or claimed.
const MATCH_DELTA_E = 5;

// Extraction only needs enough pixels to get frequency statistics right,
// not point-sample precision — a small decode keeps this fast on-device.
const EXTRACT_MAX_EDGE = 200;

export type ExtractedColor = { name: string; hex: string };

/** Buckets every opaque pixel in `bitmap` and returns each bucket's average color, richest first. */
function bucketByFrequency(bitmap: Bitmap): { color: RGB; count: number }[] {
  const { width, height, data } = bitmap;
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();

  for (let i = 0, n = width * height; i < n; i++) {
    const o = i * 4;
    if (data[o + 3] < 16) continue; // skip transparent pixels — not part of the artwork

    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const key =
      Math.floor(r / BUCKET_STEP) * 1024 + Math.floor(g / BUCKET_STEP) * 32 + Math.floor(b / BUCKET_STEP);

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      color: { r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count },
      count: bucket.count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Which of `catalog`'s colors actually appear in `bitmap`, most-prominent
 * match first, up to `maxColors`. A match is tagged with the catalog's own
 * name and hex — not the photo's raw sampled pixel — so the result is
 * always one of the colors that was actually passed in.
 */
export function matchCatalogColors(
  bitmap: Bitmap,
  catalog: ExtractedColor[],
  maxColors = MAX_EXTRACTED_COLORS
): ExtractedColor[] {
  if (catalog.length === 0) return [];

  const ranked = bucketByFrequency(bitmap);
  const totalPixels = ranked.reduce((sum, b) => sum + b.count, 0);
  if (totalPixels === 0) return [];

  const catalogLab = catalog.map((entry) => ({ entry, lab: rgbToLab(hexToRgb(entry.hex)) }));
  const matchedHex = new Set<string>();
  const matches: ExtractedColor[] = [];

  for (const { color, count } of ranked) {
    if (matches.length >= maxColors) break;
    if (count / totalPixels < MIN_PIXEL_SHARE) break; // ranked descending, so nothing after this clears it either

    const lab = rgbToLab(color);
    let best: ExtractedColor | null = null;
    let bestDelta = Infinity;
    for (const candidate of catalogLab) {
      const delta = deltaE94(lab, candidate.lab);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate.entry;
      }
    }

    if (best && bestDelta < MATCH_DELTA_E && !matchedHex.has(best.hex.toUpperCase())) {
      matchedHex.add(best.hex.toUpperCase());
      matches.push(best);
    }
  }

  return matches;
}

/** Loads a photo and matches it against the catalog in one step. */
export async function matchCatalogColorsFromUri(
  uri: string,
  catalog: ExtractedColor[],
  srcWidth?: number,
  srcHeight?: number,
  maxColors = MAX_EXTRACTED_COLORS
): Promise<ExtractedColor[]> {
  // Local import: keeps this module (and its Lab-distance math) usable from
  // a plain unit test without dragging in expo-image-manipulator.
  const { loadBitmap } = await import('./sampler');
  const bitmap = await loadBitmap(uri, srcWidth, srcHeight, EXTRACT_MAX_EDGE);
  return matchCatalogColors(bitmap, catalog, maxColors);
}
