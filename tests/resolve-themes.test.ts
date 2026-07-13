import { expect, test, afterEach } from "bun:test";
import { resolveThemes } from "../src/cli";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PALETTE = Array.from({ length: 16 }, (_, i) =>
  `#${i.toString(16).repeat(6)}`,
).map((c) => c.slice(0, 7));

function themeToml(name: string): string {
  return [
    `name = "${name}"`,
    `background = "#000000"`,
    `foreground = "#ffffff"`,
    `palette = [${PALETTE.map((c) => `"${c}"`).join(",")}]`,
  ].join("\n");
}

const originalEnv = process.env.TTM_THEMES;
afterEach(() => {
  if (originalEnv === undefined) delete process.env.TTM_THEMES;
  else process.env.TTM_THEMES = originalEnv;
});

test("TTM_THEMES override wins even when an on-disk themes/ dir exists", async () => {
  const base = await mkdtemp(join(tmpdir(), "ttm-base-"));
  await mkdir(join(base, "themes"), { recursive: true });
  await writeFile(join(base, "themes", "ondisk.toml"), themeToml("OnDisk"));

  const override = await mkdtemp(join(tmpdir(), "ttm-override-"));
  await writeFile(join(override, "override.toml"), themeToml("Override"));

  process.env.TTM_THEMES = override;
  const themes = await resolveThemes(join(base, "bin"));
  expect(themes.map((t) => t.name)).toEqual(["Override"]);
});

test("falls back to the on-disk themes/ directory next to baseDir when no override is set", async () => {
  delete process.env.TTM_THEMES;
  const base = await mkdtemp(join(tmpdir(), "ttm-base-"));
  await mkdir(join(base, "themes"), { recursive: true });
  await writeFile(join(base, "themes", "ondisk.toml"), themeToml("OnDisk"));

  const themes = await resolveThemes(join(base, "bin"));
  expect(themes.map((t) => t.name)).toEqual(["OnDisk"]);
});

test("falls back to the embedded catalogue when no override and no on-disk directory exist", async () => {
  delete process.env.TTM_THEMES;
  const empty = await mkdtemp(join(tmpdir(), "ttm-empty-"));

  const themes = await resolveThemes(join(empty, "bin"));
  expect(themes.length).toBeGreaterThan(0);
  expect(themes.map((t) => t.name)).toContain("Dracula");
});
