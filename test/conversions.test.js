'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  srgbToLinear,
  linearToSrgb,
  rgbToXyz,
  xyzToRgb,
  rgbToLab,
  labToRgb,
  rgbToHsl,
  hslToRgb,
  rgbToYCbCr,
  yCbCrToRgb,
} = require('../dist/index.js');

function assertTripleClose(actual, expected, epsilon, message) {
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(actual[i] - expected[i]) < epsilon,
      `${message}: channel ${i} expected ~${expected[i]}, got ${actual[i]}`,
    );
  }
}

// Covers black, white, the three primaries, and a couple of arbitrary
// in-gamut colours so round-trip tests exercise more than one code path
// (e.g. the achromatic branch of rgbToHsl only fires for grays).
const SAMPLE_COLORS = [
  [0, 0, 0],
  [1, 1, 1],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [0.2, 0.5, 0.9],
  [0.73, 0.11, 0.44],
];

test('srgbToLinear/linearToSrgb round trip', () => {
  for (const color of SAMPLE_COLORS) {
    const roundTripped = linearToSrgb(srgbToLinear(color));
    assertTripleClose(roundTripped, color, 1e-9, `srgb round trip for ${color}`);
  }
});

test('rgbToXyz/xyzToRgb round trip', () => {
  // The forward and inverse matrices are independently-published constants
  // rounded to 7 significant figures, not exact algebraic inverses, so the
  // round trip carries a small but real error.
  for (const color of SAMPLE_COLORS) {
    const roundTripped = xyzToRgb(rgbToXyz(color));
    assertTripleClose(roundTripped, color, 1e-4, `xyz round trip for ${color}`);
  }
});

test('rgbToLab/labToRgb round trip', () => {
  for (const color of SAMPLE_COLORS) {
    const roundTripped = labToRgb(rgbToLab(color));
    assertTripleClose(roundTripped, color, 1e-4, `lab round trip for ${color}`);
  }
});

test('rgbToHsl/hslToRgb round trip, including the achromatic branch', () => {
  for (const color of SAMPLE_COLORS) {
    const roundTripped = hslToRgb(rgbToHsl(color));
    assertTripleClose(roundTripped, color, 1e-9, `hsl round trip for ${color}`);
  }
});

test('rgbToHsl matches known values for pure red', () => {
  const [h, s, l] = rgbToHsl([1, 0, 0]);
  assert.ok(Math.abs(h - 0) < 1e-9);
  assert.ok(Math.abs(s - 1) < 1e-9);
  assert.ok(Math.abs(l - 0.5) < 1e-9);
});

test('rgbToHsl matches known values for mid gray', () => {
  const [h, s, l] = rgbToHsl([0.5, 0.5, 0.5]);
  assert.equal(h, 0);
  assert.equal(s, 0);
  assert.ok(Math.abs(l - 0.5) < 1e-9);
});

test('rgbToYCbCr/yCbCrToRgb round trip', () => {
  // The matrix used here is constructed as its own algebraic inverse, unlike
  // the published RGB/XYZ constants above, so the round trip should be tight.
  for (const color of SAMPLE_COLORS) {
    const roundTripped = yCbCrToRgb(rgbToYCbCr(color));
    assertTripleClose(roundTripped, color, 1e-9, `ycbcr round trip for ${color}`);
  }
});

test('rgbToYCbCr matches known values for white and black', () => {
  // Neutral colours carry no chroma, so Cb and Cr sit exactly at the 0.5
  // midpoint regardless of luma.
  const white = rgbToYCbCr([1, 1, 1]);
  assertTripleClose(white, [1, 0.5, 0.5], 1e-9, 'ycbcr for white');

  const black = rgbToYCbCr([0, 0, 0]);
  assertTripleClose(black, [0, 0.5, 0.5], 1e-9, 'ycbcr for black');
});
