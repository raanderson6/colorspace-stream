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

function clampUint16(v: number): number {
  const rounded = Math.round(v);
  return rounded < 0 ? 0 : rounded > 65535 ? 65535 : rounded;
}

// Big-endian 16-bit-per-channel RGB, the layout used by 16-bit PNG and TIFF
// samples. Six bytes per pixel instead of rgb8's three, so the streaming
// transform's leftover buffer can hold up to 5 straddling bytes here.
export const rgb16Reader: PixelReader = {
  bytesPerPixel: 6,
  read(buf, offset) {
    return [
      buf.readUInt16BE(offset) / 65535,
      buf.readUInt16BE(offset + 2) / 65535,
      buf.readUInt16BE(offset + 4) / 65535,
    ];
  },
};

export const rgb16Writer: PixelWriter = {
  bytesPerPixel: 6,
  write([r, g, b], out, offset) {
    out.writeUInt16BE(clampUint16(r * 65535), offset);
    out.writeUInt16BE(clampUint16(g * 65535), offset + 2);
    out.writeUInt16BE(clampUint16(b * 65535), offset + 4);
  },
};

// Lab has no natural 8-bit range, so L is scaled from [0, 100] and a/b are
// shifted from roughly [-128, 127] into [0, 255]. Round-tripping through
// this codec loses precision; use lab32Writer, or the plain Lab functions
// directly, if you need full fidelity.
export const lab8Writer: PixelWriter = {
  bytesPerPixel: 3,
  write([l, a, b], out, offset) {
    out[offset] = clampByte((l / 100) * 255);
    out[offset + 1] = clampByte(a + 128);
    out[offset + 2] = clampByte(b + 128);
  },
};

// Big-endian IEEE 754 float32 per channel, unscaled. Twelve bytes per
// pixel, so the streaming transform's leftover buffer can hold up to 11
// straddling bytes here. Unlike the fixed-width integer codecs above,
// values aren't clamped on write - floats don't wrap or corrupt neighbouring
// channels the way an out-of-range byte would, so out-of-gamut or HDR data
// round-trips as-is.
export const rgb32Reader: PixelReader = {
  bytesPerPixel: 12,
  read(buf, offset) {
    return [buf.readFloatBE(offset), buf.readFloatBE(offset + 4), buf.readFloatBE(offset + 8)];
  },
};

export const rgb32Writer: PixelWriter = {
  bytesPerPixel: 12,
  write([r, g, b], out, offset) {
    out.writeFloatBE(r, offset);
    out.writeFloatBE(g, offset + 4);
    out.writeFloatBE(b, offset + 8);
  },
};

// Full-precision Lab, no byte-range scaling - pairs with rgb32Reader for a
// lossless RGB -> Lab stream, unlike lab8Writer.
export const lab32Writer: PixelWriter = {
  bytesPerPixel: 12,
  write([l, a, b], out, offset) {
    out.writeFloatBE(l, offset);
    out.writeFloatBE(a, offset + 4);
    out.writeFloatBE(b, offset + 8);
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

export const ycbcr8Writer: PixelWriter = {
  bytesPerPixel: 3,
  write([y, cb, cr], out, offset) {
    out[offset] = clampByte(y * 255);
    out[offset + 1] = clampByte(cb * 255);
    out[offset + 2] = clampByte(cr * 255);
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
