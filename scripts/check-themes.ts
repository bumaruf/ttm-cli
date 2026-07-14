import { contrastRatio } from "../src/core/contrast";
import { parseTheme, type Theme } from "../src/core/theme";

const FG_MIN = 4.5; // WCAG AA, normal text

export interface ThemeFile {
  path: string;
  source: string;
  status: "added" | "modified";
  previous?: string;
}

export interface CheckResult {
  ok: boolean;
  errors: string[];
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const HANDLE = /^@[A-Za-z0-9][A-Za-z0-9-]*$/;

export function checkThemes(
  changed: ThemeFile[],
  catalogue: Theme[],
  prAuthor: string,
): CheckResult {
  const errors: string[] = [];
  const fail = (file: string, message: string) =>
    errors.push(`${file}: ${message}`);

  for (const file of changed) {
    const name = file.path.split("/").pop() ?? file.path;

    let theme: Theme;
    try {
      theme = parseTheme(file.source, name);
    } catch (error) {
      errors.push((error as Error).message);
      continue;
    }

    // Filename must be the slug of the theme name.
    const expected = `${slugify(theme.name)}.toml`;
    if (name !== expected) {
      fail(name, `filename must be ${expected} (the slug of "${theme.name}")`);
    }

    // Provenance.
    if (!theme.source) {
      fail(
        name,
        "missing required field: source (URL of the official palette)",
      );
    } else if (!/^https?:\/\//.test(theme.source)) {
      fail(name, `source must be a URL (got "${theme.source}")`);
    }

    if (!theme.license) {
      fail(name, "missing required field: license");
    }

    for (const field of ["author", "contributor"] as const) {
      const handle = theme[field];
      if (!handle) {
        fail(
          name,
          `missing required field: ${field} (a GitHub handle, e.g. @you)`,
        );
      } else if (!HANDLE.test(handle)) {
        fail(
          name,
          `${field} must be a GitHub handle starting with @ (got "${handle}")`,
        );
      }
    }

    // Readability of the text you actually read all day. This is the defect
    // nobody catches by reading hex.
    //
    // Only foreground/background is checked. The palette is deliberately NOT:
    // in a dark theme, color0 ("black") is meant to sit right next to the
    // background, and even real text colors fall below 3:1 in themes millions
    // of people use — Gruvbox's red is 2.69, Solarized's green is 2.79. A rule
    // that rejects Dracula, Nord and Gruvbox is not protecting anyone.
    const fg = contrastRatio(theme.foreground, theme.background);
    if (fg < FG_MIN) {
      fail(
        name,
        `contrast between foreground and background is ${fg.toFixed(2)}:1, below the required ${FG_MIN}:1 — the text would be hard to read`,
      );
    }

    if (file.status === "added") {
      const clash = catalogue.find(
        (t) => t.name.toLowerCase() === theme.name.toLowerCase(),
      );
      if (clash) {
        fail(
          name,
          `a theme named "${theme.name}" already exists. If this is a variant, give it a different name (e.g. "${theme.name} Soft"). If you are fixing the existing one, edit its file instead of adding a new one.`,
        );
      }
    }

    if (file.status === "modified" && file.previous) {
      let before: Theme;
      try {
        before = parseTheme(file.previous, name);
      } catch {
        continue; // The previous version was already broken; not this PR's fault.
      }

      if (before.author && theme.author !== before.author) {
        fail(
          name,
          `author is ${before.author} and cannot be changed. You are credited as contributor (${prAuthor}); the original author keeps authorship.`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
