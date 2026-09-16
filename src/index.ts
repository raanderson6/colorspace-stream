import { TransformOptions } from 'node:stream';
import {
  cmykToRgb,
  hslToRgb,
  labToRgb,
  Quad,
  rgbToCmyk,
  rgbToHsl,
  rgbToLab,
  rgbToYCbCr,
  Triple,
  withAlpha,
  yCbCrToRgb,
} from './conversions';
import {
  cmyk8Reader,
  cmyk8Writer,
  ColorSpaceTransform,
  hsl8Reader,
  hsl8Writer,
  hsla8Writer,
  lab8Reader,
  lab8Writer,
  lab32Writer,
  rgb8Reader,
  rgb8Writer,
  rgb16Reader,
  rgb16Writer,
  rgb32Reader,
  rgb32Writer,
  rgba8Reader,
  rgba8Writer,
  ycbcr8Reader,
  ycbcr8Writer,
} from './stream';

export * from './conversions';
export * from './stream';

/** Packed 8-bit RGB in, packed 8-bit Lab out (see lab8Writer for the scaling used). */
export function createRgbToLabStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb8Reader, lab8Writer, rgbToLab, options);
}

/** Packed 8-bit RGB in, packed 8-bit HSL out. */
export function createRgbToHslStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb8Reader, hsl8Writer, rgbToHsl, options);
}

/** Packed 8-bit HSL in, packed 8-bit RGB out. */
export function createHslToRgbStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(hsl8Reader, rgb8Writer, hslToRgb, options);
}

/** Packed 8-bit Lab in (see lab8Writer for the scaling used), packed 8-bit RGB out. */
export function createLabToRgbStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(lab8Reader, rgb8Writer, labToRgb, options);
}

/** Passes RGB through unchanged; mainly useful for testing the chunking logic itself. */
export function createRgbIdentityStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb8Reader, rgb8Writer, (rgb) => rgb, options);
}

/** Packed 8-bit RGB in, packed 8-bit YCbCr out (BT.601, full range). */
export function createRgbToYCbCrStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb8Reader, ycbcr8Writer, rgbToYCbCr, options);
}

/** Packed 8-bit YCbCr in (BT.601, full range), packed 8-bit RGB out. */
export function createYCbCrToRgbStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(ycbcr8Reader, rgb8Writer, yCbCrToRgb, options);
}

/** Packed 16-bit-per-channel RGB in, packed 8-bit Lab out. */
export function createRgb16ToLabStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb16Reader, lab8Writer, rgbToLab, options);
}

/** Packed 16-bit-per-channel RGB in and out, mainly useful for testing the chunking logic itself. */
export function createRgb16IdentityStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb16Reader, rgb16Writer, (rgb) => rgb, options);
}

/** Packed float32-per-channel RGB in, full-precision float32 Lab out - no quantisation either side. */
export function createRgb32ToLabStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb32Reader, lab32Writer, rgbToLab, options);
}

/** Packed float32-per-channel RGB in and out, mainly useful for testing the chunking logic itself. */
export function createRgb32IdentityStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb32Reader, rgb32Writer, (rgb) => rgb, options);
}

/** Packed 8-bit RGB in, packed 8-bit CMYK out (4 bytes per pixel). */
export function createRgbToCmykStream(options?: TransformOptions): ColorSpaceTransform<Triple, Quad> {
  return new ColorSpaceTransform(rgb8Reader, cmyk8Writer, rgbToCmyk, options);
}

/** Packed 8-bit CMYK in (4 bytes per pixel), packed 8-bit RGB out. */
export function createCmykToRgbStream(options?: TransformOptions): ColorSpaceTransform<Quad, Triple> {
  return new ColorSpaceTransform(cmyk8Reader, rgb8Writer, cmykToRgb, options);
}

/** Packed 8-bit RGBA in and out (4 bytes per pixel), alpha passed through unchanged. */
export function createRgbaIdentityStream(options?: TransformOptions): ColorSpaceTransform<Quad, Quad> {
  return new ColorSpaceTransform(rgba8Reader, rgba8Writer, (rgba) => rgba, options);
}

/** Packed 8-bit RGBA in, packed 8-bit HSL+alpha out - alpha passes through unchanged. */
export function createRgbaToHslaStream(options?: TransformOptions): ColorSpaceTransform<Quad, Quad> {
  return new ColorSpaceTransform(rgba8Reader, hsla8Writer, withAlpha(rgbToHsl), options);
}
