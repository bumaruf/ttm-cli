import { expect, test } from "bun:test";
import {
  renderDiffPreview,
  renderPreview,
} from "../scripts/render-theme-preview";
import type { Theme } from "../src/core/theme";

const theme: Theme = {
  name: "Nord",
  author: "@fulano",
  contributor: "@fulano",
  source: "https://www.nordtheme.com",
  license: "MIT",
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: Array.from({ length: 16 }, (_, i) =>
    `#${i.toString(16).repeat(6)}`.slice(0, 7),
  ),
};

test("the preview names the theme and its provenance", () => {
  const md = renderPreview(theme);
  expect(md).toContain("Nord");
  expect(md).toContain("@fulano");
  expect(md).toContain("https://www.nordtheme.com");
  expect(md).toContain("MIT");
});

// GitHub strips bgcolor/style from comment HTML, so colored cells render blank.
// A hex in backticks is what it actually renders a swatch for.
test("every color is a hex in backticks, which is what GitHub renders", () => {
  const md = renderPreview(theme);
  for (const color of theme.palette) {
    expect(md).toContain(`\`${color}\``);
  }
  expect(md).toContain(`\`${theme.background}\``);
  expect(md).toContain(`\`${theme.foreground}\``);
  expect(md).not.toContain("bgcolor");
});

test("the palette is laid out normal above bright", () => {
  const md = renderPreview(theme);
  expect(md).toContain("| black | red | green |");
});

test("a diff names exactly which colors changed, and how", () => {
  const after = { ...theme, background: "#1e222a" };
  const md = renderDiffPreview(theme, after);
  expect(md).toContain("`#2e3440` → `#1e222a`");
  expect(md).toContain("background");
});

test("a changed palette entry is called out by index", () => {
  const palette = [...theme.palette];
  palette[3] = "#ff0000";
  const md = renderDiffPreview(theme, { ...theme, palette });
  expect(md).toContain("palette[3]");
  expect(md).toContain("`#ff0000`");
});

// A metadata-only PR must not print two identical palettes and call it a diff.
test("a metadata-only change says so instead of showing a fake diff", () => {
  const md = renderDiffPreview(theme, { ...theme, contributor: "@beltrano" });
  expect(md).toMatch(/no color changed/i);
});
