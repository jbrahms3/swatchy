/**
 * Turns a photo into a pixel buffer we can read synchronously, so dragging a
 * finger across the image updates the swatch with no async round-trip.
 *
 * The photo is downscaled once (long edge -> MAX_EDGE) and re-encoded as PNG so
 * the decode is lossless; JPEG would smear the very pixels we're sampling.
 */

// Deliberately the older function-based API rather than the newer
// manipulate()/Context/ImageRef one: it's a single native call with no
// SharedObject/JSI ref chaining, and has years more production mileage.
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';

import type { RGB } from './color';
import { decodePng, type Bitmap } from './png';

const MAX_EDGE = 700;

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_ALPHABET.length; i++) B64_LOOKUP[B64_ALPHABET.charCodeAt(i)] = i;

function base64ToBytes(base64: string): Uint8Array {
  // Only whitespace is safe to strip here — '=' padding must stay so the
  // length stays a multiple of 4, which the byte-count formula below relies on.
  // ('=' chars still decode harmlessly: they fall outside the alphabet, so
  // B64_LOOKUP maps them to 0, and the padding-adjusted length below discards
  // the resulting phantom byte(s).)
  const clean = base64.replace(/[\r\n\s]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((clean.length / 4) * 3 - padding);

  let out = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)];
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const d = B64_LOOKUP[clean.charCodeAt(i + 3)];

    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    if (out < bytes.length) bytes[out++] = (chunk >> 16) & 0xff;
    if (out < bytes.length) bytes[out++] = (chunk >> 8) & 0xff;
    if (out < bytes.length) bytes[out++] = chunk & 0xff;
  }
  return bytes;
}

export type Sampler = {
  /** Aspect ratio (w / h) of the photo — drives the on-screen layout. */
  aspect: number;
  /**
   * Sample at normalized coordinates. Averages a small neighborhood so a single
   * noisy sensor pixel doesn't decide the color.
   */
  sampleAt(u: number, v: number): RGB;
};

function makeSampler(bitmap: Bitmap): Sampler {
  const { width, height, data } = bitmap;

  return {
    aspect: width / height,
    sampleAt(u, v) {
      const cx = Math.round(u * (width - 1));
      const cy = Math.round(v * (height - 1));

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let dy = -1; dy <= 1; dy++) {
        const y = cy + dy;
        if (y < 0 || y >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          if (x < 0 || x >= width) continue;
          const i = (y * width + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }

      return { r: r / count, g: g / count, b: b / count };
    },
  };
}

/**
 * Downscales (long edge -> `maxEdge`) and decodes a photo to raw pixels.
 * `srcWidth`/`srcHeight` come from the image picker. When they're unknown we
 * just constrain the width and let the aspect fall out of the decode.
 */
export async function loadBitmap(
  uri: string,
  srcWidth?: number,
  srcHeight?: number,
  maxEdge = MAX_EDGE
): Promise<Bitmap> {
  const actions: Action[] = [];

  if (srcWidth && srcHeight) {
    const longEdge = Math.max(srcWidth, srcHeight);
    if (longEdge > maxEdge) {
      const scale = maxEdge / longEdge;
      actions.push({
        resize: {
          width: Math.round(srcWidth * scale),
          height: Math.round(srcHeight * scale),
        },
      });
    }
  } else {
    actions.push({ resize: { width: maxEdge } });
  }

  const result = await manipulateAsync(uri, actions, { format: SaveFormat.PNG, base64: true });

  if (!result.base64) throw new Error('Image encoding returned no data');

  return decodePng(base64ToBytes(result.base64));
}

export async function loadSampler(
  uri: string,
  srcWidth?: number,
  srcHeight?: number
): Promise<Sampler> {
  return makeSampler(await loadBitmap(uri, srcWidth, srcHeight));
}
