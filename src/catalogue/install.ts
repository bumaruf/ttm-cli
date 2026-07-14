// src/catalogue/install.ts
import type { Env } from "../core/env";
import { parseTheme, type Theme } from "../core/theme";
import type { Fs } from "../platform/fs";

export function installedDir(env: Env): string {
  const base = env.XDG_CONFIG_HOME ?? `${env.HOME ?? ""}/.config`;
  return `${base}/ttm/themes`;
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderToml(theme: Theme): string {
  const lines = [`name = ${JSON.stringify(theme.name)}`];

  for (const field of ["author", "contributor", "source", "license"] as const) {
    const value = theme[field];
    if (value) lines.push(`${field} = ${JSON.stringify(value)}`);
  }

  lines.push(`background = "${theme.background}"`);
  lines.push(`foreground = "${theme.foreground}"`);
  lines.push("palette = [");
  for (let i = 0; i < 16; i += 4) {
    const row = theme.palette
      .slice(i, i + 4)
      .map((c) => `"${c}"`)
      .join(", ");
    lines.push(`  ${row},`);
  }
  lines.push("]");

  return `${lines.join("\n")}\n`;
}

/** Writes exactly one file: the theme the user chose. Browsing installs nothing. */
export async function installTheme(
  fs: Fs,
  env: Env,
  theme: Theme,
): Promise<string> {
  const path = `${installedDir(env)}/${slugify(theme.name)}.toml`;
  await fs.writeFile(path, renderToml(theme));
  return path;
}

export async function loadInstalled(fs: Fs, env: Env): Promise<Theme[]> {
  const dir = installedDir(env);
  const files = await fs.list(dir);

  const themes: Theme[] = [];
  for (const file of files.filter((f) => f.endsWith(".toml")).sort()) {
    try {
      themes.push(parseTheme(await fs.readFile(`${dir}/${file}`), file));
    } catch {
      // A theme the user broke by hand should not take the whole tool down.
    }
  }
  return themes;
}
