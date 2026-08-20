import { TransformOptions } from 'node:stream';
import { rgbToHsl, rgbToLab } from './conversions';
import {
  ColorSpaceTransform,
  hsl8Writer,
  lab8Writer,
  rgb8Reader,
  rgb8Writer,
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
