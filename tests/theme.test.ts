import { expect, test } from "bun:test";
import { parseTheme, loadThemes } from "../src/theme";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PALETTE = Array.from({ length: 16 }, (_, i) =>
  `#${i.toString(16).repeat(6)}`,
).map((c) => c.slice(0, 7));

function toml(overrides: Record<string, string> = {}): string {
  const body: Record<string, string> = {
    name: '"Nord"',
    background: '"#2e3440"',
    foreground: '"#d8dee9"',
    palette: `[${PALETTE.map((c) => `"${c}"`).join(",")}]`,
    ...overrides,
  };
  return Object.entries(body)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
}

test("parses a valid theme", () => {
  const theme = parseTheme(toml(), "nord.toml");
  expect(theme.name).toBe("Nord");
  expect(theme.background).toBe("#2e3440");
  expect(theme.foreground).toBe("#d8dee9");
  expect(theme.palette).toHaveLength(16);
});

test("normalizes rgb() and uppercase colors", () => {
  const theme = parseTheme(
    toml({ background: '"rgb(27,27,27)"', foreground: '"#D8DEE9"' }),
    "x.toml",
  );
  expect(theme.background).toBe("#1b1b1b");
  expect(theme.foreground).toBe("#d8dee9");
});

test("rejects a palette that is not exactly 16 colors", () => {
  const short = `[${PALETTE.slice(0, 15).map((c) => `"${c}"`).join(",")}]`;
  expect(() => parseTheme(toml({ palette: short }), "short.toml")).toThrow(
    /short\.toml.*16/,
  );
});

test("rejects a missing background", () => {
  expect(() => parseTheme(toml({ background: "" }), "nobg.toml")).toThrow(
    /nobg\.toml.*background/,
  );
});

test("rejects a malformed color", () => {
  expect(() => parseTheme(toml({ foreground: '"blue"' }), "bad.toml")).toThrow(
    /bad\.toml/,
  );
});

test("rejects a missing name", () => {
  expect(() => parseTheme(toml({ name: "" }), "noname.toml")).toThrow(
    /noname\.toml.*name/,
  );
});

test("empty directory yields no themes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ttm-"));
  expect(await loadThemes(dir)).toEqual([]);
});

test("missing directory yields no themes", async () => {
  expect(await loadThemes("/nonexistent/ttm")).toEqual([]);
});

test("duplicate theme names are rejected", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ttm-"));
  await writeFile(join(dir, "a.toml"), toml());
  await writeFile(join(dir, "b.toml"), toml());
  await expect(loadThemes(dir)).rejects.toThrow(/duplicate/);
});
