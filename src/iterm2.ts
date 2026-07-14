// src/iterm2.ts
import type { Backend, Env } from "./backend";
import type { Fs } from "./fs";
import type { Theme } from "./theme";

const GUID = "ttm-theme";

interface ItermColor {
  "Red Component": number;
  "Green Component": number;
  "Blue Component": number;
  "Color Space": "sRGB";
}

/** iTerm2 wants 0..1 floats per component, not hex. */
function toItermColor(hex: string): ItermColor {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    "Red Component": ((value >> 16) & 0xff) / 255,
    "Green Component": ((value >> 8) & 0xff) / 255,
    "Blue Component": (value & 0xff) / 255,
    "Color Space": "sRGB",
  };
}

export function createIterm2Backend(fs: Fs, env: Env): Backend {
  const dir = `${env.HOME ?? ""}/Library/Application Support/iTerm2/DynamicProfiles`;
  const profilePath = `${dir}/ttm.json`;

  return {
    id: "iterm2",
    name: "iTerm2",

    detect(e) {
      return e.TERM_PROGRAM === "iTerm.app";
    },

    async isInstalled() {
      return fs.exists(`${env.HOME ?? ""}/Library/Application Support/iTerm2`);
    },

    async current() {
      if (!(await fs.exists(profilePath))) return null;
      const profile = JSON.parse(await fs.readFile(profilePath));
      const name: string | undefined = profile?.Profiles?.[0]?.Name;
      return name?.replace(/^ttm — /, "") ?? null;
    },

    async apply(theme: Theme) {
      const profile: Record<string, unknown> = {
        Name: `ttm — ${theme.name}`,
        Guid: GUID,
        "Background Color": toItermColor(theme.background),
        "Foreground Color": toItermColor(theme.foreground),
        "Cursor Color": toItermColor(theme.foreground),
      };

      theme.palette.forEach((color, i) => {
        profile[`Ansi ${i} Color`] = toItermColor(color);
      });

      // A Dynamic Profile is a file iTerm2 reads and merges on its own. We
      // never touch the user's preferences.
      await fs.writeFile(
        profilePath,
        `${JSON.stringify({ Profiles: [profile] }, null, 2)}\n`,
      );
    },
  };
}
