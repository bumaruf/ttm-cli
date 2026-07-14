// tests/catalogue/index-format.test.ts
import { expect, test } from "bun:test";
import { parseIndex, renderIndex } from "../../src/catalogue/index-format";
import type { Theme } from "../../src/core/theme";

const theme = (name: string): Theme => ({
  name,
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
  author: "@fulano",
  contributor: "@fulano",
  source: "https://example.com",
  license: "MIT",
});

test("an index round-trips", () => {
  const themes = [theme("Nord"), theme("Dracula")];
  const parsed = parseIndex(renderIndex(themes, "2026-07-14T00:00:00Z"));
  expect(parsed.version).toBe(1);
  expect(parsed.themes).toEqual(themes);
});

test("the index carries the colors, so no per-theme fetch is ever needed", () => {
  const source = renderIndex([theme("Nord")], "2026-07-14T00:00:00Z");
  expect(source).toContain("#2e3440");
  expect(source).toContain("#81a1c1");
});

test("an unknown version is rejected", () => {
  expect(() => parseIndex('{"version":99,"themes":[]}')).toThrow(/version/i);
});

test("malformed JSON is rejected", () => {
  expect(() => parseIndex("not json")).toThrow();
});

// Defence in depth: a hostile index must not smuggle a broken theme through.
test("a theme with a malformed color is rejected", () => {
  const hostile = JSON.stringify({
    version: 1,
    generatedAt: "2026-07-14T00:00:00Z",
    themes: [{ ...theme("Evil"), background: "#000000;\x07\x1b]0;pwned" }],
  });
  expect(() => parseIndex(hostile)).toThrow();
});

test("a theme with the wrong palette length is rejected", () => {
  const bad = JSON.stringify({
    version: 1,
    generatedAt: "2026-07-14T00:00:00Z",
    themes: [{ ...theme("Short"), palette: ["#000000"] }],
  });
  expect(() => parseIndex(bad)).toThrow(/16/);
});
