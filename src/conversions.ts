// Pure per-pixel colour math. Every function takes and returns a plain
// [number, number, number] tuple so callers can compose them without
// allocating intermediate objects - matters when this runs once per pixel
// over a multi-gigabyte stream.

export type Triple = [number, number, number];

// D65 reference white, matches the sRGB working space used below.
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** sRGB channels in [0, 1] to linear-light RGB in [0, 1]. */
export function srgbToLinear([r, g, b]: Triple): Triple {
  return [srgbChannelToLinear(r), srgbChannelToLinear(g), srgbChannelToLinear(b)];
}

/** Linear-light RGB in [0, 1] to sRGB channels in [0, 1]. */
export function linearToSrgb([r, g, b]: Triple): Triple {
  return [linearChannelToSrgb(r), linearChannelToSrgb(g), linearChannelToSrgb(b)];
}

/** Linear RGB (D65) to CIE XYZ, both in roughly [0, 1]. */
export function rgbToXyz([r, g, b]: Triple): Triple {
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

/** CIE XYZ to linear RGB (D65), both in roughly [0, 1]. */
export function xyzToRgb([x, y, z]: Triple): Triple {
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

const DELTA = 6 / 29;

function xyzForwardF(t: number): number {
  return t > DELTA ** 3 ? Math.cbrt(t) : t / (3 * DELTA ** 2) + 4 / 29;
}

function xyzInverseF(t: number): number {
  return t > DELTA ? t ** 3 : 3 * DELTA ** 2 * (t - 4 / 29);
}

/** CIE XYZ to CIE L*a*b* (L in [0, 100], a/b roughly in [-128, 127]). */
export function xyzToLab([x, y, z]: Triple): Triple {
  const fx = xyzForwardF(x / XN);
  const fy = xyzForwardF(y / YN);
  const fz = xyzForwardF(z / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE L*a*b* back to CIE XYZ. */
export function labToXyz([l, a, b]: Triple): Triple {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  return [XN * xyzInverseF(fx), YN * xyzInverseF(fy), ZN * xyzInverseF(fz)];
}

/** sRGB channels in [0, 1] straight to CIE L*a*b*. */
export function rgbToLab(rgb: Triple): Triple {
  return xyzToLab(rgbToXyz(srgbToLinear(rgb)));
}

/** CIE L*a*b* straight to sRGB channels in [0, 1]. */
export function labToRgb(lab: Triple): Triple {
  return linearToSrgb(xyzToRgb(labToXyz(lab)));
}

/** sRGB channels in [0, 1] to HSL, all three channels in [0, 1]. */
export function rgbToHsl([r, g, b]: Triple): Triple {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l];
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }

  return [h / 6, s, l];
}

function hueToChannel(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

/** HSL (all channels in [0, 1]) back to sRGB channels in [0, 1]. */
export function hslToRgb([h, s, l]: Triple): Triple {
  if (s === 0) {
    return [l, l, l];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [hueToChannel(p, q, h + 1 / 3), hueToChannel(p, q, h), hueToChannel(p, q, h - 1 / 3)];
}

// ITU-R BT.601, full range (the JPEG/JFIF convention, not the studio-swing
// broadcast one). Cb/Cr are shifted by +0.5 so all three channels land in
// [0, 1] like the rest of this library instead of the conventional [-0.5, 0.5].

/** sRGB channels in [0, 1] to YCbCr (BT.601, full range), all three channels in [0, 1]. */
export function rgbToYCbCr([r, g, b]: Triple): Triple {
  return [
    0.299 * r + 0.587 * g + 0.114 * b,
    -0.168736 * r - 0.331264 * g + 0.5 * b + 0.5,
    0.5 * r - 0.418688 * g - 0.081312 * b + 0.5,
  ];
}

/** YCbCr (BT.601, full range, all channels in [0, 1]) back to sRGB channels in [0, 1]. */
export function yCbCrToRgb([y, cb, cr]: Triple): Triple {
  const u = cb - 0.5;
  const v = cr - 0.5;
  return [y + 1.402 * v, y - 0.344136 * u - 0.714136 * v, y + 1.772 * u];
}
