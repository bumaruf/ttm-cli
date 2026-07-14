// src/windows-terminal.ts

import type { Theme } from "../core/theme";
import type { Fs } from "../platform/fs";
import type { Backend, Env } from "./backend";

/** Windows Terminal names the 16 ANSI colors; order matches our palette. */
const ANSI_NAMES = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "purple",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightPurple",
  "brightCyan",
  "brightWhite",
] as const;

function schemeFor(theme: Theme): Record<string, string> {
  const scheme: Record<string, string> = {
    name: theme.name,
    background: theme.background,
    foreground: theme.foreground,
    cursorColor: theme.foreground,
    selectionBackground: theme.foreground,
  };
  ANSI_NAMES.forEach((key, i) => {
    scheme[key] = theme.palette[i] ?? "#000000";
  });
  return scheme;
}

export function createWindowsTerminalBackend(fs: Fs, env: Env): Backend {
  const local = env.LOCALAPPDATA ?? "";

  const candidates = [
    `${local}\\Packages\\Microsoft.WindowsTerminal_8wekyb3d8bbwe\\LocalState\\settings.json`,
    `${local}\\Microsoft\\Windows Terminal\\settings.json`,
  ];

  const fragmentPath = `${local}\\Microsoft\\Windows Terminal\\Fragments\\ttm\\ttm.json`;

  const settingsPath = async (): Promise<string | null> => {
    for (const path of candidates) {
      if (await fs.exists(path)) return path;
    }
    return null;
  };

  return {
    id: "windows-terminal",
    name: "Windows Terminal",

    detect(e) {
      return e.WT_SESSION !== undefined;
    },

    async isInstalled() {
      return (await settingsPath()) !== null;
    },

    async current() {
      const path = await settingsPath();
      if (!path) return null;
      const source = await fs.readFile(path);
      const match = /"colorScheme"\s*:\s*"([^"]*)"/.exec(source);
      return match?.[1] ?? null;
    },

    async apply(theme: Theme) {
      const path = await settingsPath();
      if (!path) {
        throw new Error(
          `Windows Terminal settings.json not found (looked in ${candidates.join(" and ")})`,
        );
      }

      // 1. The scheme goes in a fragment file we own. The user's settings.json
      //    is never rewritten for this.
      await fs.writeFile(
        fragmentPath,
        `${JSON.stringify({ schemes: [schemeFor(theme)] }, null, 2)}\n`,
      );

      // 2. Selecting the scheme needs one key in the user's settings.json.
      //    That file is JSONC — it has their comments. So we edit the text
      //    surgically instead of reserializing, and back it up first.
      const source = await fs.readFile(path);
      await fs.copyFile(path, `${path}.ttm-backup`);

      const key = /"colorScheme"\s*:\s*"[^"]*"/;
      const updated = key.test(source)
        ? source.replace(key, `"colorScheme": "${theme.name}"`)
        : source.replace(
            /("defaults"\s*:\s*\{)/,
            `$1\n      "colorScheme": "${theme.name}",`,
          );

      if (updated === source) {
        throw new Error(
          `could not find "profiles.defaults" in ${path} — refusing to guess where to write colorScheme`,
        );
      }

      await fs.writeFile(path, updated);
    },
  };
}
