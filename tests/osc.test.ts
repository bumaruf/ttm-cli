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

test("applyTheme throws if palette has fewer than 16 entries", () => {
  const shortPalette: Theme = {
    ...theme,
    palette: theme.palette.slice(0, 15),
  };
  expect(() => applyTheme(shortPalette)).toThrow(
    /palette must have exactly 16 entries/
  );
});

test("applyTheme throws if palette has more than 16 entries", () => {
  const longPalette: Theme = {
    ...theme,
    palette: [...theme.palette, "#000000"],
  };
  expect(() => applyTheme(longPalette)).toThrow(
    /palette must have exactly 16 entries/
  );
});

test("applyTheme throws on injected OSC escape in palette color", () => {
  const injected: Theme = {
    ...theme,
    palette: [
      ...theme.palette.slice(0, 5),
      "#000000;\x07\x1b]0;pwned",
      ...theme.palette.slice(6),
    ],
  };
  expect(() => applyTheme(injected)).toThrow(
    /palette\[5\] must be lowercase #rrggbb format/
  );
});

test("applyTheme throws on injected OSC escape in foreground color", () => {
  const injected: Theme = {
    ...theme,
    foreground: "#ffffff;\x07\x1b]0;pwned",
  };
  expect(() => applyTheme(injected)).toThrow(
    /foreground color must be lowercase #rrggbb format/
  );
});

test("applyTheme throws on injected OSC escape in background color", () => {
  const injected: Theme = {
    ...theme,
    background: "#000000;\x07\x1b]0;pwned",
  };
  expect(() => applyTheme(injected)).toThrow(
    /background color must be lowercase #rrggbb format/
  );
});

test("applyTheme throws on uppercase hex (not normalized)", () => {
  const uppercase: Theme = {
    ...theme,
    palette: [
      ...theme.palette.slice(0, 3),
      "#AABBCC",
      ...theme.palette.slice(4),
    ],
  };
  expect(() => applyTheme(uppercase)).toThrow(
    /palette\[3\] must be lowercase #rrggbb format/
  );
});

test("valid theme still works after validation", () => {
  const out = applyTheme(theme);
  expect(out).toContain("\x1b]4;0;#000000\x07");
  expect(out).toContain("\x1b]4;15;#0000ff\x07");
  expect(out).toContain("\x1b]10;#ffffff\x07");
  expect(out).toContain("\x1b]11;#000000\x07");
  expect(out.match(/\x1b\]4;/g)).toHaveLength(16);
});
