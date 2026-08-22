'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRgbIdentityStream, createRgbToHslStream } = require('../dist/index.js');

// Collects everything the stream emits and resolves once it ends, or
// rejects if the stream errors - lets each test drive a stream with an
// arbitrary chunking pattern and inspect the whole result at once.
function feed(stream, chunks) {
  return new Promise((resolve, reject) => {
    const out = [];
    stream.on('data', (chunk) => out.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(out)));
    for (const chunk of chunks) {
      stream.write(chunk);
    }
    stream.end();
  });
}

function splitEvery(buf, size) {
  const chunks = [];
  for (let i = 0; i < buf.length; i += size) {
    chunks.push(buf.subarray(i, Math.min(i + size, buf.length)));
  }
  return chunks;
}

const FOUR_PIXELS = Buffer.from([10, 20, 30, 200, 100, 50, 0, 0, 0, 255, 255, 255]);

test('identity stream output does not depend on chunk boundaries', async () => {
  for (let size = 1; size <= FOUR_PIXELS.length; size++) {
    const out = await feed(createRgbIdentityStream(), splitEvery(FOUR_PIXELS, size));
    assert.deepEqual(out, FOUR_PIXELS, `chunk size ${size}`);
  }
});

test('converting stream output does not depend on chunk boundaries', async () => {
  const pixels = Buffer.from([
    10, 20, 30, 200, 100, 50, 0, 0, 0, 255, 255, 255, 128, 64, 32,
  ]);
  const whole = await feed(createRgbToHslStream(), [pixels]);
  for (let size = 1; size < pixels.length; size++) {
    const chunked = await feed(createRgbToHslStream(), splitEvery(pixels, size));
    assert.deepEqual(chunked, whole, `chunk size ${size}`);
  }
});

test('a chunk split in the middle of a single pixel still decodes correctly', async () => {
  // One pixel, split after its first byte - the smallest possible
  // straddling case for a 3-byte-per-pixel codec.
  const out = await feed(createRgbIdentityStream(), [Buffer.from([1]), Buffer.from([2, 3])]);
  assert.deepEqual(out, Buffer.from([1, 2, 3]));
});

test('empty input produces empty output with no error', async () => {
  const out = await feed(createRgbIdentityStream(), [Buffer.alloc(0)]);
  assert.equal(out.length, 0);
});

test('a trailing partial pixel raises a flush error instead of being dropped', async () => {
  const truncated = Buffer.from([1, 2, 3, 4, 5]); // 5 bytes: one full pixel plus 2 stray bytes
  await assert.rejects(
    feed(createRgbIdentityStream(), [truncated]),
    /trailing 2 byte/,
  );
});
