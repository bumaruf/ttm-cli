// src/catalogue/index-format.ts
import { parseColor } from "../core/color";
import type { Theme } from "../core/theme";

export interface CatalogueIndex {
  version: 1;
  generatedAt: string;
  themes: Theme[];
}

export function renderIndex(themes: Theme[], generatedAt: string): string {
  const index: CatalogueIndex = { version: 1, generatedAt, themes };
  return `${JSON.stringify(index, null, 2)}\n`;
}

/**
 * Parse and VALIDATE an index. The bytes come from the network, so every theme
 * is re-validated here: a corrupt or hostile index must not be able to put a
 * malformed color anywhere near a terminal.
 */
export function parseIndex(source: string): CatalogueIndex {
  const raw = JSON.parse(source) as Record<string, unknown>;

  if (raw.version !== 1) {
    throw new Error(
      `unsupported catalogue version: ${raw.version} (this ttm understands version 1)`,
    );
  }

  if (!Array.isArray(raw.themes)) {
    throw new Error("catalogue is missing a themes array");
  }

  const themes = raw.themes.map((entry, i) => validateTheme(entry, i));

  return {
    version: 1,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    themes,
  };
}

function validateTheme(entry: unknown, index: number): Theme {
  const where = `catalogue theme[${index}]`;
  const t = entry as Record<string, unknown>;

  const str = (field: string): string => {
    const value = t[field];
    if (typeof value !== "string" || value === "") {
      throw new Error(`${where}: missing or invalid ${field}`);
    }
    return value;
  };

  const color = (field: string): string => {
    try {
      return parseColor(str(field));
    } catch (error) {
      throw new Error(`${where}: ${field}: ${(error as Error).message}`);
    }
  };

  if (!Array.isArray(t.palette) || t.palette.length !== 16) {
    throw new Error(
      `${where}: palette must have exactly 16 colors (got ${
        Array.isArray(t.palette) ? t.palette.length : "none"
      })`,
    );
  }

  const palette = t.palette.map((entry, i) => {
    if (typeof entry !== "string") {
      throw new Error(`${where}: palette[${i}] is not a string`);
    }
    try {
      return parseColor(entry);
    } catch (error) {
      throw new Error(`${where}: palette[${i}]: ${(error as Error).message}`);
    }
  });

  const optional = (field: string): string | undefined => {
    const value = t[field];
    return typeof value === "string" ? value : undefined;
  };

  return {
    name: str("name"),
    background: color("background"),
    foreground: color("foreground"),
    palette,
    author: optional("author"),
    contributor: optional("contributor"),
    source: optional("source"),
    license: optional("license"),
  };
}
