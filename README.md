# colorspace-stream

Convert pixel data between colour spaces (RGB, XYZ, CIE L\*a\*b\*, HSL)
without ever holding the whole image, video frame, or scan buffer in
memory at once.

## Why

Most colour conversion libraries take a whole image buffer, an array, or
a single pixel and hand back a converted result. That's fine until the
input is a 4K video frame stream, a raw scanner dump, or a file too big
to comfortably fit in a Node process's heap. This library does the same
per-pixel math but exposes it as a `Transform` stream, so you can pipe
a source of arbitrary size through it and only ever hold a handful of
pixels' worth of bytes in memory.

## Install

No package is published yet. For now, drop `src/` into your project or
build it locally with `tsc`. There are no runtime dependencies -
everything is Node's standard library plus plain arithmetic.

## Usage

### Per-pixel math

```ts
import { rgbToLab, rgbToHsl, labToRgb } from 'colorspace-stream';

// channels are normalised to [0, 1], not [0, 255]
const lab = rgbToLab([0.2, 0.5, 0.9]); // -> [L, a, b]
const hsl = rgbToHsl([0.2, 0.5, 0.9]); // -> [h, s, l], also [0, 1]
const backToRgb = labToRgb(lab);
```

### Streaming a large buffer of packed RGB pixels

Say you have a raw file where every pixel is three bytes (R, G, B, no
header, no padding) and you want the equivalent file in Lab space,
also packed as three bytes per pixel:

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { createRgbToLabStream } from 'colorspace-stream';

createReadStream('frame.rgb')
  .pipe(createRgbToLabStream())
  .pipe(createWriteStream('frame.lab'));
```

The stream reads in whatever chunk size the source hands it (64 KB,
1 MB, a single byte, doesn't matter) and only ever buffers the
trailing 0-2 bytes of an incomplete pixel between chunks. A 50 GB
input processes in constant memory.

### Building your own conversion stream

`ColorSpaceTransform` takes a reader (how to decode bytes into
normalised RGB), a writer (how to encode the converted channels back
to bytes), and the conversion function itself:

```ts
import { ColorSpaceTransform, rgb8Reader, hsl8Writer, rgbToHsl } from 'colorspace-stream';

const toHsl = new ColorSpaceTransform(rgb8Reader, hsl8Writer, rgbToHsl);
```

This is exactly how `createRgbToHslStream` is implemented; use it as a
template if you need a codec this library doesn't ship yet (16-bit
channels, an alpha channel, YCbCr, and so on).

## What's here now

- `srgbToLinear` / `linearToSrgb` - gamma correction
- `rgbToXyz` / `xyzToRgb` - linear RGB <-> CIE XYZ (D65)
- `xyzToLab` / `labToXyz`, and the `rgbToLab` / `labToRgb` shortcuts
- `rgbToHsl` / `hslToRgb`
- `ColorSpaceTransform`, a chunk-boundary-safe streaming converter
- `rgb8Reader`, `rgb8Writer`, `lab8Writer`, `hsl8Writer` - 8-bit packed
  codecs for the stream, plus `createRgbToLabStream`,
  `createRgbToHslStream`, `createRgbIdentityStream` convenience
  factories

## Testing

Tests build the library and then run against `dist/` with Node's built-in
test runner - no test framework dependency:

```sh
npm test
```

## License

MIT, see `LICENSE`.
