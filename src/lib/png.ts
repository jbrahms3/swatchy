/**
 * Minimal PNG decoder -> RGBA8.
 *
 * We only ever feed this PNGs produced by expo-image-manipulator, so the input
 * is non-interlaced 8-bit or 16-bit. Palette / grayscale paths are handled
 * anyway because encoders are free to pick them for simple images. (iOS in
 * particular tends to emit 16-bit-per-channel PNGs for photos — its PNG
 * writer defaults to that depth for the wide-gamut capture pipeline — so
 * 16-bit isn't an edge case here, it's the common case on that platform.)
 */

import { inflate } from 'pako';

export type Bitmap = { width: number; height: number; data: Uint8Array };

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Undo the per-scanline filter PNG applies before compression. */
function unfilter(raw: Uint8Array, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = y * stride;
    const prev = line - stride;

    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos + x];
      // a = left, b = up, c = up-left
      const a = x >= bpp ? out[line + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= bpp && y > 0 ? out[prev + x - bpp] : 0;

      let value: number;
      switch (filter) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`Unsupported PNG filter ${filter}`);
      }
      out[line + x] = value & 0xff;
    }
    pos += stride;
  }
  return out;
}

export function decodePng(bytes: Uint8Array): Bitmap {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('Not a PNG');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;

  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette: Uint8Array | null = null;
  let alphaTable: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type =
      String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const body = offset + 8;

    if (type === 'IHDR') {
      width = view.getUint32(body);
      height = view.getUint32(body + 4);
      depth = bytes[body + 8];
      colorType = bytes[body + 9];
      if (bytes[body + 12] !== 0) throw new Error('Interlaced PNG is not supported');
      if (depth !== 8 && depth !== 16) throw new Error(`Unsupported PNG bit depth ${depth}`);
    } else if (type === 'PLTE') {
      palette = bytes.subarray(body, body + length);
    } else if (type === 'tRNS') {
      alphaTable = bytes.subarray(body, body + length);
    } else if (type === 'IDAT') {
      idat.push(bytes.subarray(body, body + length));
    } else if (type === 'IEND') {
      break;
    }

    offset = body + length + 4; // + CRC
  }

  if (!width || !height) throw new Error('PNG missing IHDR');

  // pako wants one contiguous buffer.
  let total = 0;
  for (const chunk of idat) total += chunk.length;
  const compressed = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of idat) {
    compressed.set(chunk, cursor);
    cursor += chunk.length;
  }

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType as 0 | 2 | 3 | 4 | 6];
  if (!channels) throw new Error(`Unsupported PNG color type ${colorType}`);

  // Indexed color is always 8-bit per the PNG spec (16-bit indices aren't a
  // thing), so this only ever kicks in for the true grayscale/color types.
  const bytesPerSample = depth === 16 ? 2 : 1;
  const bpp = channels * bytesPerSample;

  const raw = inflate(compressed);
  const pixels = unfilter(raw, width, height, bpp);

  // For 16-bit samples we keep only the high byte (big-endian, so it's the
  // first of the pair) — plenty of precision for picking a color off a photo.
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const src = i * bpp;
    const dst = i * 4;

    switch (colorType) {
      case 0: // grayscale
        rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = pixels[src];
        rgba[dst + 3] = 255;
        break;
      case 2: // truecolor
        rgba[dst] = pixels[src];
        rgba[dst + 1] = pixels[src + bytesPerSample];
        rgba[dst + 2] = pixels[src + bytesPerSample * 2];
        rgba[dst + 3] = 255;
        break;
      case 3: {
        // indexed
        const idx = pixels[src];
        if (!palette) throw new Error('Indexed PNG missing PLTE');
        rgba[dst] = palette[idx * 3];
        rgba[dst + 1] = palette[idx * 3 + 1];
        rgba[dst + 2] = palette[idx * 3 + 2];
        rgba[dst + 3] = alphaTable && idx < alphaTable.length ? alphaTable[idx] : 255;
        break;
      }
      case 4: // grayscale + alpha
        rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = pixels[src];
        rgba[dst + 3] = pixels[src + bytesPerSample];
        break;
      default: // 6 — truecolor + alpha
        rgba[dst] = pixels[src];
        rgba[dst + 1] = pixels[src + bytesPerSample];
        rgba[dst + 2] = pixels[src + bytesPerSample * 2];
        rgba[dst + 3] = pixels[src + bytesPerSample * 3];
    }
  }

  return { width, height, data: rgba };
}
