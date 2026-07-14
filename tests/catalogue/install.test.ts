// tests/catalogue/install.test.ts
import { expect, test } from "bun:test";
import {
  installedDir,
  installTheme,
  loadInstalled,
} from "../../src/catalogue/install";
import type { Theme } from "../../src/core/theme";
import { createMemoryFs } from "../../src/platform/fs";

const theme: Theme = {
  name: "Zenburn",
  background: "#3f3f3f",
  foreground: "#dcdccc",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
  author: "@fulano",
  contributor: "@fulano",
  source: "https://example.com",
  license: "MIT",
};

const ENV = { HOME: "/home/me" };
const DIR = "/home/me/.config/ttm/themes";

test("installedDir honours XDG_CONFIG_HOME", () => {
  expect(installedDir({ HOME: "/home/me" })).toBe(
    "/home/me/.config/ttm/themes",
  );
  expect(installedDir({ HOME: "/home/me", XDG_CONFIG_HOME: "/x" })).toBe(
    "/x/ttm/themes",
  );
});

test("installing writes exactly one file, named after the slug", async () => {
  const fs = createMemoryFs();
  const path = await installTheme(fs, ENV, theme);

  expect(path).toBe(`${DIR}/zenburn.toml`);
  expect(Object.keys(fs.files())).toHaveLength(1);
});

test("the written file carries the colors and the provenance", async () => {
  const fs = createMemoryFs();
  await installTheme(fs, ENV, theme);
  const source = fs.files()[`${DIR}/zenburn.toml`]!;

  expect(source).toContain('name = "Zenburn"');
  expect(source).toContain('background = "#3f3f3f"');
  expect(source).toContain('author = "@fulano"');
  expect(source).toContain('license = "MIT"');
  expect(source).toContain("#81a1c1");
});

// It must round-trip: what we install has to be loadable by the normal parser.
test("an installed theme is read back identically", async () => {
  const fs = createMemoryFs();
  await installTheme(fs, ENV, theme);
  const [loaded] = await loadInstalled(fs, ENV);
  expect(loaded).toEqual(theme);
});

test("installing twice overwrites, it does not duplicate", async () => {
  const fs = createMemoryFs();
  await installTheme(fs, ENV, theme);
  await installTheme(fs, ENV, { ...theme, background: "#000000" });

  expect(Object.keys(fs.files())).toHaveLength(1);
  const [loaded] = await loadInstalled(fs, ENV);
  expect(loaded!.background).toBe("#000000");
});

test("no installed directory means no installed themes, not an error", async () => {
  expect(await loadInstalled(createMemoryFs(), ENV)).toEqual([]);
});
