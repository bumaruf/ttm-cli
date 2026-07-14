// src/catalogue/merge.ts
import type { Theme } from "../core/theme";

export type Origin = "builtin" | "installed" | "remote";

export interface Entry {
  theme: Theme;
  origin: Origin;
}

/**
 * installed > builtin > remote.
 *
 * A theme you installed is the one you chose. A builtin is already on your
 * machine. A remote one is not yours yet — and that is what the TUI marks.
 */
export function mergeCatalogue(sources: {
  builtin: Theme[];
  installed: Theme[];
  remote: Theme[];
}): Entry[] {
  const byName = new Map<string, Entry>();

  const add = (themes: Theme[], origin: Origin) => {
    for (const theme of themes) {
      const key = theme.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, { theme, origin });
    }
  };

  add(sources.installed, "installed");
  add(sources.builtin, "builtin");
  add(sources.remote, "remote");

  return [...byName.values()].sort((a, b) =>
    a.theme.name.localeCompare(b.theme.name),
  );
}
