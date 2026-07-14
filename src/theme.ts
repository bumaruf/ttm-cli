import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { type Hex, parseColor } from "./color";

export interface Theme {
  name: string;
  background: Hex;
  foreground: Hex;
  palette: Hex[];
  author?: string;
  contributor?: string;
  source?: string;
  license?: string;
}

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

export function parseTheme(source: string, filename: string): Theme {
  let raw: unknown;
  try {
    raw = Bun.TOML.parse(source);
  } catch (error) {
    fail(filename, `invalid TOML (${(error as Error).message})`);
  }

  const data = raw as Record<string, unknown>;

  const name = data.name;
  if (typeof name !== "string" || name.trim() === "") {
    fail(filename, "missing required field: name");
  }

  const color = (field: "background" | "foreground"): Hex => {
    const value = data[field];
    if (typeof value !== "string") {
      fail(filename, `missing required field: ${field}`);
    }
    try {
      return parseColor(value);
    } catch (error) {
      fail(filename, `${field}: ${(error as Error).message}`);
    }
  };

  const background = color("background");
  const foreground = color("foreground");

  const rawPalette = data.palette;
  if (!Array.isArray(rawPalette) || rawPalette.length !== 16) {
    fail(
      filename,
      `palette must have exactly 16 colors (got ${
        Array.isArray(rawPalette) ? rawPalette.length : "none"
      })`,
    );
  }

  // biome-ignore lint/suspicious/useIterableCallbackReturn: fail() returns never, so every path either returns a color or throws.
  const palette = rawPalette.map((entry, index) => {
    if (typeof entry !== "string") {
      fail(filename, `palette[${index}] is not a string`);
    }
    try {
      return parseColor(entry);
    } catch (error) {
      fail(filename, `palette[${index}]: ${(error as Error).message}`);
    }
  });

  const optionalString = (field: string): string | undefined => {
    const value = data[field];
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      fail(filename, `${field} must be a string`);
    }
    return value;
  };

  return {
    name: name.trim(),
    background,
    foreground,
    palette,
    author: optionalString("author"),
    contributor: optionalString("contributor"),
    source: optionalString("source"),
    license: optionalString("license"),
  };
}

export async function loadThemes(dir: string): Promise<Theme[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return [];
    }
    throw new Error(`failed to read themes from ${dir}: ${err.message}`);
  }

  const files = entries.filter((f) => f.endsWith(".toml")).sort();
  const themes: Theme[] = [];
  const seen = new Map<string, string>();

  for (const file of files) {
    const source = await Bun.file(join(dir, file)).text();
    const theme = parseTheme(source, file);
    const key = theme.name.toLowerCase();
    const previous = seen.get(key);
    if (previous) {
      throw new Error(
        `duplicate theme name "${theme.name}" in ${file} and ${previous}`,
      );
    }
    seen.set(key, file);
    themes.push(theme);
  }

  return themes.sort((a, b) => a.name.localeCompare(b.name));
}
