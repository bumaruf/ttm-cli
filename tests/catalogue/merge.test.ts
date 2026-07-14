// tests/catalogue/merge.test.ts
import { expect, test } from "bun:test";
import { mergeCatalogue } from "../../src/catalogue/merge";
import type { Theme } from "../../src/core/theme";

const theme = (name: string, bg = "#000000"): Theme => ({
  name,
  background: bg,
  foreground: "#ffffff",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
});

test("merges the three sources, sorted by name", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord")],
    installed: [],
    remote: [theme("Dracula"), theme("Zenburn")],
  });
  expect(entries.map((e) => e.theme.name)).toEqual([
    "Dracula",
    "Nord",
    "Zenburn",
  ]);
});

test("origin marks what is not on the machine yet", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord")],
    installed: [theme("Mine")],
    remote: [theme("Zenburn")],
  });
  const origin = (name: string) =>
    entries.find((e) => e.theme.name === name)?.origin;

  expect(origin("Nord")).toBe("builtin");
  expect(origin("Mine")).toBe("installed");
  expect(origin("Zenburn")).toBe("remote");
});

// An installed theme is the one you chose. It wins.
test("installed beats builtin beats remote", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord", "#111111")],
    installed: [theme("Nord", "#222222")],
    remote: [theme("Nord", "#333333")],
  });

  expect(entries).toHaveLength(1);
  expect(entries[0]!.theme.background).toBe("#222222");
  expect(entries[0]!.origin).toBe("installed");
});

test("builtin beats remote when nothing is installed", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord", "#111111")],
    installed: [],
    remote: [theme("Nord", "#333333")],
  });
  expect(entries[0]!.theme.background).toBe("#111111");
  expect(entries[0]!.origin).toBe("builtin");
});

test("names collide case-insensitively", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord")],
    installed: [],
    remote: [theme("NORD")],
  });
  expect(entries).toHaveLength(1);
});

test("an empty remote is fine — the tool works offline", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord")],
    installed: [],
    remote: [],
  });
  expect(entries).toHaveLength(1);
  expect(entries[0]!.origin).toBe("builtin");
});
