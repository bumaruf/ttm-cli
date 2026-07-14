import { expect, test } from "bun:test";
import { renderBuiltinModule } from "../scripts/generate-builtin";
import { parseTheme, type Theme } from "../src/core/theme";

const theme = (name: string): Theme => ({
  name,
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
});

test("marks the file as generated so nobody edits it by hand", () => {
  const source = renderBuiltinModule([theme("Nord")]);
  expect(source).toContain("GENERATED FILE");
  expect(source).toContain("scripts/generate-builtin.ts");
});

test("exports a typed BUILTIN_THEMES array", () => {
  const source = renderBuiltinModule([theme("Nord")]);
  // The generated file lives in src/generated/, so it reaches core as ../core.
  expect(source).toContain('import type { Theme } from "../core/theme"');
  expect(source).toContain("export const BUILTIN_THEMES: Theme[] =");
});

test("embeds every theme, with its colors intact", () => {
  const source = renderBuiltinModule([theme("Nord"), theme("Dracula")]);
  expect(source).toContain('"name": "Nord"');
  expect(source).toContain('"name": "Dracula"');
  expect(source).toContain('"background": "#2e3440"');
  expect(source).toContain('"#81a1c1"');
});

/** Pull the embedded array back out of the generated source. */
function embedded(source: string): Theme[] {
  const marker = "export const BUILTIN_THEMES: Theme[] = ";
  const start = source.indexOf(marker) + marker.length;
  return JSON.parse(source.slice(start, source.lastIndexOf("]") + 1));
}

// If the embedded and on-disk catalogues drift, the binary lies about its themes.
test("the embedded themes round-trip back to the same objects", () => {
  const themes = [theme("Nord"), theme("Dracula")];
  expect(embedded(renderBuiltinModule(themes))).toEqual(themes);
});

test("a real theme file survives parse -> render -> parse unchanged", async () => {
  const toml = await Bun.file("themes/core/nord.toml").text();
  const parsed = parseTheme(toml, "nord.toml");

  expect(embedded(renderBuiltinModule([parsed]))[0]).toEqual(parsed);
});
