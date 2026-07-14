import { expect, test } from "bun:test";
import { contrastRatio, relativeLuminance } from "../src/core/contrast";

test("luminance of black and white are the known extremes", () => {
  expect(relativeLuminance("#000000")).toBeCloseTo(0, 4);
  expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 4);
});

test("black on white is the maximum contrast, 21:1", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
});

test("a color against itself is 1:1", () => {
  expect(contrastRatio("#2e3440", "#2e3440")).toBeCloseTo(1, 4);
});

test("the ratio is symmetric", () => {
  const a = contrastRatio("#2e3440", "#d8dee9");
  const b = contrastRatio("#d8dee9", "#2e3440");
  expect(a).toBeCloseTo(b, 6);
});

// Nord's real fg/bg: a theme people actually use must pass the 4.5 threshold.
test("Nord's foreground on its background clears 4.5:1", () => {
  expect(contrastRatio("#d8dee9", "#2e3440")).toBeGreaterThan(4.5);
});

// The failure this module exists to catch.
test("dark grey on black is unreadable and scores below 3:1", () => {
  expect(contrastRatio("#1a1a1a", "#000000")).toBeLessThan(3);
});

test("an invalid hex throws", () => {
  expect(() => relativeLuminance("nope")).toThrow();
});
