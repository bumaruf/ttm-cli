import { expect, test } from "bun:test";
import { checkThemes, slugify, type ThemeFile } from "../scripts/check-themes";
import type { Theme } from "../src/core/theme";

const PALETTE = [
  "#3b4252",
  "#bf616a",
  "#a3be8c",
  "#ebcb8b",
  "#81a1c1",
  "#b48ead",
  "#88c0d0",
  "#e5e9f0",
  "#4c566a",
  "#bf616a",
  "#a3be8c",
  "#ebcb8b",
  "#81a1c1",
  "#b48ead",
  "#8fbcbb",
  "#eceff4",
];

function toml(over: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    name: '"Nord Light"',
    author: '"@fulano"',
    contributor: '"@fulano"',
    source: '"https://www.nordtheme.com"',
    license: '"MIT"',
    background: '"#2e3440"',
    foreground: '"#d8dee9"',
    palette: `[${PALETTE.map((c) => `"${c}"`).join(",")}]`,
    ...over,
  };
  return Object.entries(fields)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
}

const added = (over = {}, path = "themes/nord-light.toml"): ThemeFile => ({
  path,
  source: toml(over),
  status: "added",
});

const existing: Theme = {
  name: "Nord",
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: PALETTE,
  author: "@fulano",
};

test("slugify turns a name into the expected filename", () => {
  expect(slugify("Kanagawa Dragon")).toBe("kanagawa-dragon");
  expect(slugify("Rosé Pine")).toBe("rose-pine");
  expect(slugify("Solarized Dark")).toBe("solarized-dark");
});

test("a well-formed new theme passes", () => {
  const result = checkThemes([added()], [existing], "@fulano");
  expect(result.errors).toEqual([]);
  expect(result.ok).toBe(true);
});

test("a duplicate name is rejected, and the message teaches what to do", () => {
  const dup = added({ name: '"Nord"' }, "themes/nord.toml");
  const result = checkThemes([dup], [existing], "@beltrano");
  expect(result.ok).toBe(false);
  expect(result.errors.join("\n")).toMatch(/already exists/i);
  expect(result.errors.join("\n")).toMatch(/variant|different name/i);
});

test("a filename that is not the slug of the name is rejected", () => {
  const wrong = added({}, "themes/nordlight.toml");
  const result = checkThemes([wrong], [existing], "@fulano");
  expect(result.errors.join("\n")).toMatch(/nord-light\.toml/);
});

test("a missing source is rejected, naming the field", () => {
  const result = checkThemes([added({ source: "" })], [existing], "@fulano");
  expect(result.errors.join("\n")).toMatch(/source/);
});

test("a source that is not a URL is rejected", () => {
  const result = checkThemes(
    [added({ source: '"I saw it in a screenshot"' })],
    [existing],
    "@fulano",
  );
  expect(result.errors.join("\n")).toMatch(/source.*url/i);
});

test("a missing license is rejected", () => {
  const result = checkThemes([added({ license: "" })], [existing], "@fulano");
  expect(result.errors.join("\n")).toMatch(/license/);
});

test("a handle without @ is rejected", () => {
  const result = checkThemes(
    [added({ author: '"fulano"' })],
    [existing],
    "@fulano",
  );
  expect(result.errors.join("\n")).toMatch(/author.*@/);
});

// The check that only a machine catches.
test("an unreadable theme is rejected, with the ratio in the message", () => {
  const unreadable = added({
    background: '"#000000"',
    foreground: '"#0a0a0a"',
  });
  const result = checkThemes([unreadable], [existing], "@fulano");
  expect(result.ok).toBe(false);
  expect(result.errors.join("\n")).toMatch(/contrast/i);
  expect(result.errors.join("\n")).toMatch(/4\.5/);
});

// Credit protection.
test("an update may not change the author", () => {
  const update: ThemeFile = {
    path: "themes/nord.toml",
    status: "modified",
    previous: toml({ name: '"Nord"', author: '"@fulano"' }),
    source: toml({ name: '"Nord"', author: '"@beltrano"' }),
  };
  const result = checkThemes([update], [existing], "@beltrano");
  expect(result.ok).toBe(false);
  expect(result.errors.join("\n")).toMatch(/author/);
});

test("an update that keeps the author passes", () => {
  const update: ThemeFile = {
    path: "themes/nord.toml",
    status: "modified",
    previous: toml({ name: '"Nord"', author: '"@fulano"' }),
    source: toml({
      name: '"Nord"',
      author: '"@fulano"',
      contributor: '"@beltrano"',
    }),
  };
  const result = checkThemes([update], [existing], "@beltrano");
  expect(result.errors).toEqual([]);
});

// A renamed theme used to slip the gate completely: git reports `R088`, the CI
// script matched neither "A" nor "M", and the file was never validated nor
// previewed — so a theme could be moved AND edited in one commit with nobody
// looking. The script now passes --no-renames (git then says A + D), and any
// unrecognized status is treated as an addition rather than skipped.
test("a renamed theme is validated as an addition, not skipped", () => {
  const renamed: ThemeFile = {
    path: "themes/core/nord-renamed.toml",
    source: toml({ name: '"Nord Renamed"', foreground: '"#3a3f4b"' }),
    status: "added", // what the CI script now produces for a rename
  };
  const result = checkThemes([renamed], [existing], "@beltrano");

  expect(result.ok).toBe(false);
  expect(result.errors.join("\n")).toMatch(/contrast/i);
});
