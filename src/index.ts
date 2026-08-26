import { TransformOptions } from 'node:stream';
import { rgbToHsl, rgbToLab, rgbToYCbCr } from './conversions';
import {
  ColorSpaceTransform,
  hsl8Writer,
  lab8Writer,
  lab32Writer,
  rgb8Reader,
  rgb8Writer,
  rgb16Reader,
  rgb16Writer,
  rgb32Reader,
  rgb32Writer,
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

/** Passes RGB through unchanged; mainly useful for testing the chunking logic itself. */
export function createRgbIdentityStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb8Reader, rgb8Writer, (rgb) => rgb, options);
}

/** Packed 8-bit RGB in, packed 8-bit YCbCr out (BT.601, full range). */
export function createRgbToYCbCrStream(options?: TransformOptions): ColorSpaceTransform {
  return new ColorSpaceTransform(rgb8Reader, ycbcr8Writer, rgbToYCbCr, options);
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
