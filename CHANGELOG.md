# Changelog

Notable changes to this project, in the order they landed. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions
follow semver once something is actually published.

## [Unreleased]

Everything below has landed on `main` but nothing has been published to npm
yet, so it's all still under 0.1.0.

### Added

- Core per-pixel colour math: `srgbToLinear`/`linearToSrgb`, `rgbToXyz`/`xyzToRgb`,
  `xyzToLab`/`labToXyz` (plus the `rgbToLab`/`labToRgb` shortcuts), `rgbToHsl`/`hslToRgb`,
  `rgbToYCbCr`/`yCbCrToRgb` (BT.601, full range), and `rgbToCmyk`/`cmykToRgb`.
- `ColorSpaceTransform`, a chunk-boundary-safe `Transform` stream that converts
  packed pixel buffers one pixel at a time, holding back at most
  `bytesPerPixel - 1` trailing bytes between chunks instead of buffering the
  whole input.
- 8-bit packed codecs (`rgb8Reader`/`rgb8Writer`, `lab8Writer`, `hsl8Writer`,
  `ycbcr8Writer`, `cmyk8Reader`/`cmyk8Writer`) and the matching stream
  factories (`createRgbToLabStream`, `createRgbToHslStream`,
  `createRgbToYCbCrStream`, `createRgbToCmykStream`, `createCmykToRgbStream`,
  `createRgbIdentityStream`).
- Generalized `PixelReader`/`PixelWriter`/`ColorSpaceTransform` from a fixed
  3-channel `Triple` to an arbitrary `Channels` bound, so CMYK's 4-channel
  codec didn't need a parallel set of types.
- 16-bit-per-channel big-endian RGB codec (`rgb16Reader`/`rgb16Writer`) and
  32-bit float big-endian codecs (`rgb32Reader`/`rgb32Writer`, `lab32Writer`)
  for lossless round trips, plus their stream factories.
- Alpha support: `withAlpha` lifts a `Triple -> Triple` conversion into an
  alpha-preserving `Quad -> Quad` one; `withAlphaReader`/`withAlphaWriter` do
  the same for an 8-bit codec's reader/writer pair. `rgba8Reader`/
  `rgba8Writer` and `hsla8Writer` are built from these, along with
  `createRgbaIdentityStream` and `createRgbaToHslaStream`.
- `bench/stream-vs-buffer.js`, comparing the streaming converter against a
  whole-buffer pass for elapsed time and peak memory.
- npm publish metadata in `package.json` (`files`, `repository`, `bugs`,
  `homepage`, `keywords`, `engines`).
- Reverse-direction 8-bit codecs (`lab8Reader`, `hsl8Reader`, `ycbcr8Reader`)
  and their stream factories (`createLabToRgbStream`, `createHslToRgbStream`,
  `createYCbCrToRgbStream`), so Lab, HSL, and YCbCr can be streamed back to
  RGB the same way CMYK already could.
