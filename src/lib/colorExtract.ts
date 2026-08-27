/**
 * Picks the most prominent colors out of a photo, for auto-tagging artwork
 * uploads. Two passes over the decoded pixels:
 *
 *  1. Bucket every pixel into a coarse RGB grid and tally each bucket's
 *     pixel count — cheap, and frequency is exactly "how much of the photo
 *     is this color".
 *  2. Walk buckets by count, richest first, keeping one candidate only if
 *     it's perceptually distinct (CIE94) from every color already kept —
 *     otherwise a smooth gradient (sky, skin, a shadow falling across one
 *     surface) fills the result with near-duplicates of its dominant hue
 *     instead of surfacing what else is in the photo.
 */

import { deltaE94, rgbToLab, suggestName, type RGB } from './color';
import type { Bitmap } from './png';

export const MAX_EXTRACTED_COLORS = 25;

// 256 / 32 = 8 buckets per channel, 512 buckets total — coarse enough that
// near-identical pixels (JPEG noise, anti-aliasing) land in the same
// bucket, fine enough that distinct colors don't get mashed together.
const BUCKET_STEP = 32;

// Below this share of the photo's pixels, a bucket reads as noise (a few
// stray pixels along an edge) rather than a color actually present in the
// artwork — skip it even if there's room left for more colors.
const MIN_PIXEL_SHARE = 0.002;

// How far apart two colors need to be (CIE94, roughly "3" is a just-
// noticeable difference to the eye) before both count as distinct results
// rather than the same color picked twice.
const MIN_DISTINCT_DELTA_E = 9;

// Extraction only needs enough pixels to get frequency statistics right,
// not point-sample precision — a small decode keeps this fast on-device.
const EXTRACT_MAX_EDGE = 200;

export type ExtractedColor = { name: string; hex: string };

function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

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
 * The photo's most prominent colors, most-to-least prominent, up to
 * `maxColors`. Named the same way any other color in the app is (nearest
 * CSS keyword) so an auto-tagged artwork reads no differently from one
 * tagged by hand.
 */
export function extractProminentColors(bitmap: Bitmap, maxColors = MAX_EXTRACTED_COLORS): ExtractedColor[] {
  const ranked = bucketByFrequency(bitmap);
  const totalPixels = ranked.reduce((sum, b) => sum + b.count, 0);
  if (totalPixels === 0) return [];

  const kept: RGB[] = [];
  const keptLab: ReturnType<typeof rgbToLab>[] = [];

  for (const { color, count } of ranked) {
    if (kept.length >= maxColors) break;
    if (count / totalPixels < MIN_PIXEL_SHARE) break; // ranked descending, so nothing after this clears it either

    const lab = rgbToLab(color);
    if (keptLab.some((other) => deltaE94(lab, other) < MIN_DISTINCT_DELTA_E)) continue;

    kept.push(color);
    keptLab.push(lab);
  }

  return kept.map((color) => ({ name: suggestName(color), hex: toHex(color) }));
}

/** Loads a photo and extracts its most prominent colors in one step. */
export async function extractProminentColorsFromUri(
  uri: string,
  srcWidth?: number,
  srcHeight?: number,
  maxColors = MAX_EXTRACTED_COLORS
): Promise<ExtractedColor[]> {
  // Local import: keeps this module (and its Lab-distance math) usable from
  // a plain unit test without dragging in expo-image-manipulator.
  const { loadBitmap } = await import('./sampler');
  const bitmap = await loadBitmap(uri, srcWidth, srcHeight, EXTRACT_MAX_EDGE);
  return extractProminentColors(bitmap, maxColors);
}
