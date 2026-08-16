/**
 * Color math + naming. Pure TS, no native deps.
 */

export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function rgbToHex({ r, g, b }: RGB): string {
  const hex = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l: Math.round(l * 100) };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: RGB): number {
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white text, whichever is more readable on `bg`. */
export function readableOn(bg: RGB): string {
  return luminance(bg) > 0.42 ? '#111111' : '#FFFFFF';
}

/* ------------------------------------------------------------------ *
 * CIE Lab, for perceptual nearest-name matching
 * ------------------------------------------------------------------ */

type Lab = { L: number; a: number; b: number };

export function rgbToLab({ r, g, b }: RGB): Lab {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);

  // sRGB -> XYZ (D65), then normalized to the D65 white point.
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE94 color difference (graphic-arts weights). Lower is closer. */
function deltaE94(p: Lab, q: Lab): number {
  const dL = p.L - q.L;
  const c1 = Math.hypot(p.a, p.b);
  const c2 = Math.hypot(q.a, q.b);
  const dC = c1 - c2;
  const da = p.a - q.a;
  const db = p.b - q.b;
  const dH2 = Math.max(0, da * da + db * db - dC * dC);

  const sC = 1 + 0.045 * c1;
  const sH = 1 + 0.015 * c1;
  return Math.sqrt(dL * dL + (dC / sC) ** 2 + dH2 / (sH * sH));
}

/* ------------------------------------------------------------------ *
 * Name suggestion
 * ------------------------------------------------------------------ */

// The CSS extended color keywords, minus exact duplicates (aqua/cyan,
// fuchsia/magenta, and the -grey spellings). Recognizable enough to make a
// good default that the user can overwrite.
const PALETTE_SRC =
  'Alice Blue:f0f8ff|Antique White:faebd7|Aqua:00ffff|Aquamarine:7fffd4|Azure:f0ffff|' +
  'Beige:f5f5dc|Bisque:ffe4c4|Black:000000|Blanched Almond:ffebcd|Blue:0000ff|' +
  'Blue Violet:8a2be2|Brown:a52a2a|Burlywood:deb887|Cadet Blue:5f9ea0|Chartreuse:7fff00|' +
  'Chocolate:d2691e|Coral:ff7f50|Cornflower Blue:6495ed|Cornsilk:fff8dc|Crimson:dc143c|' +
  'Dark Blue:00008b|Dark Cyan:008b8b|Dark Goldenrod:b8860b|Dark Gray:a9a9a9|' +
  'Dark Green:006400|Dark Khaki:bdb76b|Dark Magenta:8b008b|Dark Olive Green:556b2f|' +
  'Dark Orange:ff8c00|Dark Orchid:9932cc|Dark Red:8b0000|Dark Salmon:e9967a|' +
  'Dark Sea Green:8fbc8f|Dark Slate Blue:483d8b|Dark Slate Gray:2f4f4f|Dark Turquoise:00ced1|' +
  'Dark Violet:9400d3|Deep Pink:ff1493|Deep Sky Blue:00bfff|Dim Gray:696969|' +
  'Dodger Blue:1e90ff|Firebrick:b22222|Floral White:fffaf0|Forest Green:228b22|' +
  'Fuchsia:ff00ff|Gainsboro:dcdcdc|Ghost White:f8f8ff|Gold:ffd700|Goldenrod:daa520|' +
  'Gray:808080|Green:008000|Green Yellow:adff2f|Honeydew:f0fff0|Hot Pink:ff69b4|' +
  'Indian Red:cd5c5c|Indigo:4b0082|Ivory:fffff0|Khaki:f0e68c|Lavender:e6e6fa|' +
  'Lavender Blush:fff0f5|Lawn Green:7cfc00|Lemon Chiffon:fffacd|Light Blue:add8e6|' +
  'Light Coral:f08080|Light Cyan:e0ffff|Light Goldenrod:fafad2|Light Gray:d3d3d3|' +
  'Light Green:90ee90|Light Pink:ffb6c1|Light Salmon:ffa07a|Light Sea Green:20b2aa|' +
  'Light Sky Blue:87cefa|Light Slate Gray:778899|Light Steel Blue:b0c4de|Light Yellow:ffffe0|' +
  'Lime:00ff00|Lime Green:32cd32|Linen:faf0e6|Maroon:800000|Medium Aquamarine:66cdaa|' +
  'Medium Blue:0000cd|Medium Orchid:ba55d3|Medium Purple:9370db|Medium Sea Green:3cb371|' +
  'Medium Slate Blue:7b68ee|Medium Spring Green:00fa9a|Medium Turquoise:48d1cc|' +
  'Medium Violet Red:c71585|Midnight Blue:191970|Mint Cream:f5fffa|Misty Rose:ffe4e1|' +
  'Moccasin:ffe4b5|Navajo White:ffdead|Navy:000080|Old Lace:fdf5e6|Olive:808000|' +
  'Olive Drab:6b8e23|Orange:ffa500|Orange Red:ff4500|Orchid:da70d6|Pale Goldenrod:eee8aa|' +
  'Pale Green:98fb98|Pale Turquoise:afeeee|Pale Violet Red:db7093|Papaya Whip:ffefd5|' +
  'Peach Puff:ffdab9|Peru:cd853f|Pink:ffc0cb|Plum:dda0dd|Powder Blue:b0e0e6|' +
  'Purple:800080|Rebecca Purple:663399|Red:ff0000|Rosy Brown:bc8f8f|Royal Blue:4169e1|' +
  'Saddle Brown:8b4513|Salmon:fa8072|Sandy Brown:f4a460|Sea Green:2e8b57|Seashell:fff5ee|' +
  'Sienna:a0522d|Silver:c0c0c0|Sky Blue:87ceeb|Slate Blue:6a5acd|Slate Gray:708090|' +
  'Snow:fffafa|Spring Green:00ff7f|Steel Blue:4682b4|Tan:d2b48c|Teal:008080|' +
  'Thistle:d8bfd8|Tomato:ff6347|Turquoise:40e0d0|Violet:ee82ee|Wheat:f5deb3|' +
  'White:ffffff|White Smoke:f5f5f5|Yellow:ffff00|Yellow Green:9acd32';

const PALETTE = PALETTE_SRC.split('|').map((entry) => {
  const [name, hex] = entry.split(':');
  return { name, lab: rgbToLab(hexToRgb(hex)) };
});

/** Nearest recognizable color name — used as the editable default. */
export function suggestName(rgb: RGB): string {
  const lab = rgbToLab(rgb);
  let best = PALETTE[0];
  let bestDist = Infinity;
  for (const candidate of PALETTE) {
    const dist = deltaE94(lab, candidate.lab);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best.name;
}

/** Short human descriptor, e.g. "Vivid · Warm". Shown under the hex. */
export function describe(rgb: RGB): string {
  const { h, s, l } = rgbToHsl(rgb);

  let chroma: string;
  if (s < 8) chroma = 'Neutral';
  else if (s < 30) chroma = 'Muted';
  else if (s < 65) chroma = 'Soft';
  else chroma = 'Vivid';

  let value: string;
  if (l < 15) value = 'Near-black';
  else if (l < 35) value = 'Deep';
  else if (l < 65) value = 'Mid';
  else if (l < 88) value = 'Light';
  else value = 'Near-white';

  if (s < 8) return `${chroma} · ${value}`;
  const temp = h < 90 || h >= 300 ? 'Warm' : h < 150 ? 'Fresh' : 'Cool';
  return `${chroma} · ${value} · ${temp}`;
}
