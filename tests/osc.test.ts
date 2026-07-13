import { expect, test } from "bun:test";
import { applyTheme, resetColors } from "../src/osc";
import type { Theme } from "../src/theme";

const theme: Theme = {
  name: "T",
  background: "#000000",
  foreground: "#ffffff",
  palette: Array.from({ length: 16 }, (_, i) => `#0000${i.toString(16)}${i.toString(16)}`),
};

test("emits one OSC 4 per palette color, then fg and bg", () => {
  const out = applyTheme(theme);
  expect(out).toContain("\x1b]4;0;#000000\x07");
  expect(out).toContain("\x1b]4;15;#0000ff\x07");
  expect(out).toContain("\x1b]10;#ffffff\x07");
  expect(out).toContain("\x1b]11;#000000\x07");
  expect(out.match(/\x1b\]4;/g)).toHaveLength(16);
});

test("apply ends with fg and bg so the repaint settles last", () => {
  const out = applyTheme(theme);
  expect(out.endsWith("\x1b]10;#ffffff\x07\x1b]11;#000000\x07")).toBe(true);
});

test("reset restores palette, fg and bg", () => {
  expect(resetColors()).toBe("\x1b]104\x07\x1b]110\x07\x1b]111\x07");
});

test("apply emits nothing but OSC sequences", () => {
  const out = applyTheme(theme);
  const stripped = out.replaceAll(/\x1b\][0-9;#a-f]*\x07/g, "");
  expect(stripped).toBe("");
});
