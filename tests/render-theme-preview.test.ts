import { expect, test } from "bun:test";
import {
  renderDiffPreview,
  renderPreview,
} from "../scripts/render-theme-preview";
import type { Theme } from "../src/theme";

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

test("every palette color is rendered as a colored cell", () => {
  const md = renderPreview(theme);
  for (const color of theme.palette) {
    expect(md).toContain(`bgcolor="${color}"`);
  }
  expect(md).toContain(`bgcolor="${theme.background}"`);
});

test("a diff preview shows both themes, labelled", () => {
  const after = { ...theme, background: "#1e222a" };
  const md = renderDiffPreview(theme, after);
  expect(md).toMatch(/before/i);
  expect(md).toMatch(/after/i);
  expect(md).toContain('bgcolor="#2e3440"');
  expect(md).toContain('bgcolor="#1e222a"');
});
