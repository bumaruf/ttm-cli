import { expect, test } from "bun:test";
import { renderBuiltinModule } from "../scripts/generate-builtin";
import { parseTheme, type Theme } from "../src/theme";

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
  expect(source).toContain('import type { Theme } from "./theme"');
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

// The whole point of the generated module: what it embeds must be exactly what
// the on-disk catalogue holds. If these drift, the compiled binary ships a
// catalogue that differs from themes/ and nobody notices.
test("the embedded themes round-trip back to the same objects", () => {
  const themes = [theme("Nord"), theme("Dracula")];
  expect(embedded(renderBuiltinModule(themes))).toEqual(themes);
});

test("a real theme file survives parse -> render -> parse unchanged", async () => {
  const toml = await Bun.file("themes/nord.toml").text();
  const parsed = parseTheme(toml, "nord.toml");

  expect(embedded(renderBuiltinModule([parsed]))[0]).toEqual(parsed);
});
