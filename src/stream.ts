import { Transform, TransformCallback, TransformOptions } from 'node:stream';
import { Triple } from './conversions';

/**
 * Reads a fixed number of bytes per pixel from a buffer at a given offset
 * and produces normalised channel values (typically in [0, 1]).
 */
export interface PixelReader {
  bytesPerPixel: number;
  read(buf: Buffer, offset: number): Triple;
}

/**
 * Writes normalised channel values back out as a fixed number of bytes.
 */
export interface PixelWriter {
  bytesPerPixel: number;
  write(values: Triple, out: Buffer, offset: number): void;
}

function clampByte(v: number): number {
  const rounded = Math.round(v);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}

export const rgb8Reader: PixelReader = {
  bytesPerPixel: 3,
  read(buf, offset) {
    return [buf[offset]! / 255, buf[offset + 1]! / 255, buf[offset + 2]! / 255];
  },
};

export const rgb8Writer: PixelWriter = {
  bytesPerPixel: 3,
  write([r, g, b], out, offset) {
    out[offset] = clampByte(r * 255);
    out[offset + 1] = clampByte(g * 255);
    out[offset + 2] = clampByte(b * 255);
  },
};

// Lab has no natural 8-bit range, so L is scaled from [0, 100] and a/b are
// shifted from roughly [-128, 127] into [0, 255]. Round-tripping through
// this codec loses precision; use the plain Lab functions directly if you
// need full fidelity and can afford floats in memory.
export const lab8Writer: PixelWriter = {
  bytesPerPixel: 3,
  write([l, a, b], out, offset) {
    out[offset] = clampByte((l / 100) * 255);
    out[offset + 1] = clampByte(a + 128);
    out[offset + 2] = clampByte(b + 128);
  },
};

export const hsl8Writer: PixelWriter = {
  bytesPerPixel: 3,
  write([h, s, l], out, offset) {
    out[offset] = clampByte(h * 255);
    out[offset + 1] = clampByte(s * 255);
    out[offset + 2] = clampByte(l * 255);
  },
};

/**
 * A Transform stream that converts packed pixel data from one colour space
 * to another, one pixel at a time.
 *
 * Chunk boundaries from the source (a file, a socket, a decoder) almost
 * never line up with pixel boundaries. This holds back the trailing
 * incomplete pixel from each chunk and prepends it to the next one, so at
 * most (bytesPerPixel - 1) bytes are ever held outside of the chunk
 * currently being processed. The whole input is never buffered in memory,
 * no matter how large the source is.
 */
export class ColorSpaceTransform extends Transform {
  private leftover: Buffer = Buffer.alloc(0);

  constructor(
    private readonly reader: PixelReader,
    private readonly writer: PixelWriter,
    private readonly convert: (rgb: Triple) => Triple,
    options?: TransformOptions,
  ) {
    super(options);
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    const data = this.leftover.length > 0 ? Buffer.concat([this.leftover, chunk]) : chunk;
    const pixelBytes = this.reader.bytesPerPixel;
    const wholePixels = Math.floor(data.length / pixelBytes);
    const usableBytes = wholePixels * pixelBytes;

    const out = Buffer.alloc(wholePixels * this.writer.bytesPerPixel);
    for (let i = 0; i < wholePixels; i++) {
      const inOffset = i * pixelBytes;
      const outOffset = i * this.writer.bytesPerPixel;
      const values = this.convert(this.reader.read(data, inOffset));
      this.writer.write(values, out, outOffset);
    }

    this.leftover = data.subarray(usableBytes);
    callback(null, out);
  }

  override _flush(callback: TransformCallback): void {
    if (this.leftover.length > 0) {
      callback(
        new Error(
          `input ended with ${this.leftover.length} trailing byte(s), which is not enough to ` +
            `form a full pixel (${this.reader.bytesPerPixel} bytes each)`,
        ),
      );
      return;
    }
    callback();
  }
}
