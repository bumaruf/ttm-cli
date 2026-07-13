import type { Backend } from "./backend";
import type { Theme } from "./theme";

const USAGE = `ttm — pick a terminal theme and see it live

  ttm                 open the picker
  ttm list            list available themes
  ttm current         print the active theme
  ttm apply <name>    apply a theme by name
  ttm --help          show this help`;

export async function runCli(
  argv: string[],
  backend: Backend,
  themes: Theme[],
  out: (s: string) => void,
): Promise<number> {
  const [command, ...rest] = argv;

  switch (command) {
    case "list": {
      const current = await backend.current();
      for (const theme of themes) {
        out(theme.name === current ? `* ${theme.name}` : `  ${theme.name}`);
      }
      return 0;
    }

    case "current": {
      const current = await backend.current();
      out(current ?? "(none)");
      return 0;
    }

    case "apply": {
      const name = rest.join(" ").trim();
      if (name === "") {
        out("usage: ttm apply <name>");
        return 1;
      }
      const theme = themes.find(
        (t) => t.name.toLowerCase() === name.toLowerCase(),
      );
      if (!theme) {
        out(`unknown theme: ${name}`);
        out("");
        out("available:");
        for (const t of themes) out(`  ${t.name}`);
        return 1;
      }
      await backend.apply(theme);
      out(`applied ${theme.name} (new windows will use it)`);
      return 0;
    }

    case "--help":
    case "-h":
      out(USAGE);
      return 0;

    default:
      out(`unknown command: ${command}`);
      out("");
      out(USAGE);
      return 1;
  }
}

import { createGnomeBackend, realRun } from "./gnome";
import { loadThemes } from "./theme";
import { runTui } from "./tui";
import { dirname, join } from "node:path";

/** Onde estão os temas: ao lado do binário/fonte. */
function themesDir(): string {
  return join(dirname(Bun.main), "..", "themes");
}

if (import.meta.main) {
  const backend = createGnomeBackend(realRun);
  const themes = await loadThemes(themesDir());

  if (themes.length === 0) {
    console.error(`no themes found in ${themesDir()}`);
    process.exit(1);
  }

  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    const applied = await runTui(themes, backend);
    if (applied) console.log(`applied ${applied.name}`);
    process.exit(0);
  }

  const code = await runCli(argv, backend, themes, (s) => console.log(s));
  process.exit(code);
}
