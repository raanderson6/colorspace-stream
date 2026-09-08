'use strict';

// Compares two ways of running an RGB -> Lab conversion over the same
// packed pixel data: converting a single buffer held fully in memory
// (the way most colour libraries work) versus piping it through
// createRgbToLabStream() in fixed-size chunks. Run with `npm run bench`.
//
// The source buffer here is generated in memory for convenience, so both
// modes start from the same resident bytes - in a real "50 GB file on
// disk" scenario the streaming side would never hold the source in memory
// at all, so the gap this script shows is the conservative case.
//
// Usage: node bench/stream-vs-buffer.js [pixelCount] [chunkSizeBytes]

const { pipeline } = require('node:stream/promises');
const { Readable, Writable } = require('node:stream');
const { rgb8Reader, lab8Writer, rgbToLab, createRgbToLabStream } = require('../dist/index.js');

const PIXEL_COUNT = Number(process.argv[2]) || 5_000_000; // ~15 MB of packed RGB
const CHUNK_SIZE = Number(process.argv[3]) || 64 * 1024; // typical fs.createReadStream default

function buildSource(pixelCount) {
  const buf = Buffer.alloc(pixelCount * rgb8Reader.bytesPerPixel);
  // Deterministic but non-uniform bytes, so the conversion math sees a
  // real spread of values instead of racing through all-zero input.
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (i * 2654435761) % 256;
  }
  return buf;
}

function formatMs(ns) {
  return (Number(ns) / 1e6).toFixed(1);
}

function formatMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// Converts the whole packed RGB buffer in one pass: read it fully,
// allocate a same-sized output buffer, convert pixel by pixel. This is
// what you'd write without ColorSpaceTransform.
function convertWholeBuffer(source) {
  const pixelBytes = rgb8Reader.bytesPerPixel;
  const pixelCount = source.length / pixelBytes;
  const out = Buffer.alloc(pixelCount * lab8Writer.bytesPerPixel);
  for (let i = 0; i < pixelCount; i++) {
    const inOffset = i * pixelBytes;
    const outOffset = i * lab8Writer.bytesPerPixel;
    const lab = rgbToLab(rgb8Reader.read(source, inOffset));
    lab8Writer.write(lab, out, outOffset);
  }
  return out;
}

async function convertStreaming(source, chunkSize) {
  let offset = 0;
  const reader = new Readable({
    read() {
      if (offset >= source.length) {
        this.push(null);
        return;
      }
      const end = Math.min(offset + chunkSize, source.length);
      this.push(source.subarray(offset, end));
      offset = end;
    },
  });

  let bytesOut = 0;
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      bytesOut += chunk.length; // count only - never retain a chunk once seen
      callback();
    },
  });

  await pipeline(reader, createRgbToLabStream(), sink);
  return bytesOut;
}

async function main() {
  const source = buildSource(PIXEL_COUNT);
  console.log(
    `${PIXEL_COUNT.toLocaleString()} pixels, ${formatMb(source.length)} MB packed RGB in, ` +
      `chunk size ${formatMb(CHUNK_SIZE)} MB\n`,
  );

  if (global.gc) global.gc();
  const bufferMemBefore = process.memoryUsage().rss;
  const bufferStart = process.hrtime.bigint();
  const wholeOut = convertWholeBuffer(source);
  const bufferElapsed = process.hrtime.bigint() - bufferStart;
  const bufferMemAfter = process.memoryUsage().rss;

  console.log('whole-buffer conversion');
  console.log(`  time:                   ${formatMs(bufferElapsed)} ms`);
  console.log(
    `  input+output resident:  ${formatMb(source.length + wholeOut.length)} MB (both buffers held at once)`,
  );
  console.log(`  rss delta:              ${formatMb(bufferMemAfter - bufferMemBefore)} MB (approximate, GC-dependent)\n`);

  let peakRss = 0;
  const sampler = setInterval(() => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }, 10);

  if (global.gc) global.gc();
  const streamMemBefore = process.memoryUsage().rss;
  const streamStart = process.hrtime.bigint();
  const bytesOut = await convertStreaming(source, CHUNK_SIZE);
  const streamElapsed = process.hrtime.bigint() - streamStart;
  clearInterval(sampler);

  console.log('streaming conversion');
  console.log(`  time:                   ${formatMs(streamElapsed)} ms`);
  console.log(`  bytes out:              ${formatMb(bytesOut)} MB`);
  console.log(
    `  peak rss above baseline: ${formatMb(Math.max(0, peakRss - streamMemBefore))} MB ` +
      `(sampled every 10ms; the transform never holds more than one chunk plus a few leftover bytes)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
