#!/usr/bin/env bun
import type { Backend } from "./backends/backend";
import type { Entry } from "./catalogue/merge";
import type { RemoteResult } from "./catalogue/remote";
import type { Theme } from "./core/theme";

export const USAGE = `ttm — pick a terminal theme and see it live

  ttm                 open the picker
  ttm list            list available themes
  ttm current         print the active theme
  ttm apply <name>    apply a theme by name
  ttm update          refresh the community catalogue
  ttm --backend <id>  force a terminal backend
  ttm --help          show this help

backends: gnome, windows-terminal, alacritty, kitty, iterm2`;

/**
 * Dependencies runCli needs beyond the catalogue and the backend, injectable
 * so tests never touch the real disk or network.
 */
export interface CliDeps {
  /** Write the theme to disk. Only called for a theme not already installed. */
  install: (theme: Theme) => Promise<string>;
  /** Force a refetch of the remote catalogue. */
  refresh: () => Promise<RemoteResult>;
}

const installUnavailable: CliDeps["install"] = () => {
  throw new Error("install is not available in this context");
};

const refreshUnavailable: CliDeps["refresh"] = () => {
  throw new Error("refresh is not available in this context");
};

export async function runCli(
  argv: string[],
  backend: Backend,
  entries: Entry[],
  out: (s: string) => void,
  deps: Partial<CliDeps> = {},
): Promise<number> {
  const install = deps.install ?? installUnavailable;
  const refresh = deps.refresh ?? refreshUnavailable;
  const [command, ...rest] = argv;

  switch (command) {
    case "list": {
      let current: string | null = null;
      try {
        current = await backend.current();
      } catch (error) {
        out(
          `warning: could not determine the active theme (${(error as Error).message})`,
        );
      }
      for (const entry of entries) {
        const marker = entry.theme.name === current ? "*" : " ";
        const notInstalled = entry.origin === "remote" ? " ↓" : "";
        out(`${marker} ${entry.theme.name}${notInstalled}`);
      }
      return 0;
    }

    case "current": {
      try {
        const current = await backend.current();
        out(current ?? "(none)");
      } catch (error) {
        out(
          `error: could not determine the active theme (${(error as Error).message})`,
        );
        return 1;
      }
      return 0;
    }

    case "update": {
      const result = await refresh();
      if (result.warning) {
        out(`warning: ${result.warning}`);
      }
      const n = result.themes.length;
      switch (result.source) {
        case "network":
          out(`catalogue updated: ${n} themes`);
          break;
        case "revalidated":
          out(`catalogue already up to date: ${n} themes`);
          break;
        case "cache":
          out(`catalogue (cached): ${n} themes`);
          break;
        case "none":
          out("catalogue unavailable");
          return 1;
      }
      return 0;
    }

    case "apply": {
      const name = rest.join(" ").trim();
      if (name === "") {
        out("usage: ttm apply <name>");
        return 1;
      }
      const entry = entries.find(
        (e) => e.theme.name.toLowerCase() === name.toLowerCase(),
      );
      if (!entry) {
        out(`unknown theme: ${name}`);
        out("");
        out("available:");
        for (const e of entries) out(`  ${e.theme.name}`);
        return 1;
      }
      const theme = entry.theme;

      // Never apply what we failed to store: install before backend.apply.
      if (entry.origin === "remote") {
        try {
          await install(theme);
        } catch (error) {
          out(`error: could not install theme (${(error as Error).message})`);
          return 1;
        }
      }

      try {
        await backend.apply(theme);
      } catch (error) {
        out(`error: could not apply theme (${(error as Error).message})`);
        return 1;
      }
      out(`applied ${theme.name} (new windows will use it)`);
      if (backend.id === "iterm2") {
        out("");
        out("first time only: in iTerm2, open Settings → Profiles and set");
        out(`"ttm — ${theme.name}" as your default profile. After that, ttm`);
        out("updates it in place and you never need to touch this again.");
      }
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

import { dirname, join } from "node:path";
import pkg from "../package.json";
import { createAlacrittyBackend } from "./backends/alacritty";
import { createGnomeBackend, realRun } from "./backends/gnome";
import { createIterm2Backend } from "./backends/iterm2";
import { createKittyBackend } from "./backends/kitty";
import { selectBackend } from "./backends/registry";
import { createWindowsTerminalBackend } from "./backends/windows-terminal";
import { installTheme, loadInstalled } from "./catalogue/install";
import { mergeCatalogue } from "./catalogue/merge";
import { fetchCatalogue } from "./catalogue/remote";
import { loadThemes } from "./core/theme";
import { BUILTIN_THEMES } from "./generated/builtin-themes";
import { realFs } from "./platform/fs";
import {
  maybeScheduleCheck,
  readNotice,
  runCheck,
} from "./platform/update-notifier";
import { runTui } from "./tui/loop";

/** Bun.spawn's the child detached, ignoring stdio, and never throws. */
function spawnDetached(cmd: string[]): void {
  try {
    const child = Bun.spawn(cmd, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    child.unref();
  } catch {
    // Scheduling a background check must never break the actual command.
  }
}

/**
 * Resolve the theme catalogue, in order:
 *   1. TTM_THEMES env var, if set — lets someone test a theme they're writing.
 *   2. A real `themes/` directory next to the source/package (the
 *      `bun run` / `npm install` cases).
 *   3. The catalogue embedded at build time, generated by
 *      scripts/generate-builtin.ts into src/builtin-themes.ts (the
 *      compiled-binary case, where `Bun.main` is a virtual `/$bunfs/...`
 *      path with nothing on disk beside it).
 */
export async function resolveThemes(
  baseDir: string = dirname(Bun.main),
): Promise<Theme[]> {
  const override = process.env.TTM_THEMES;
  if (override) return loadThemes(override);

  const onDisk = join(baseDir, "..", "themes", "core");
  const themes = await loadThemes(onDisk);
  if (themes.length > 0) return themes;

  return BUILTIN_THEMES;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);

  // Hidden subcommand run by the detached background check. Never printed,
  // never advertised in --help, handled before anything else touches a
  // backend or the catalogue.
  if (argv[0] === "__notifier-check") {
    await runCheck(fetch, realFs, process.env, Date.now());
    process.exit(0);
  }

  // `--backend <id>` can appear anywhere; strip it from argv before parsing
  // the rest of the command line.
  let requested: string | undefined;
  const flagIndex = argv.indexOf("--backend");
  if (flagIndex !== -1) {
    requested = argv[flagIndex + 1];
    argv.splice(flagIndex, 2);
    if (!requested) {
      console.error("usage: ttm --backend <id>");
      process.exit(1);
    }
  }

  // `--help` must work everywhere: on a machine with no supported terminal, on
  // a CI runner, in a container. Resolving a backend first would make the help
  // text unreachable exactly for the people who most need to read it.
  if (argv[0] === "--help" || argv[0] === "-h") {
    console.log(USAGE);
    process.exit(0);
  }

  const backends = [
    createGnomeBackend(realRun),
    createWindowsTerminalBackend(realFs, process.env),
    createAlacrittyBackend(realFs, process.env, process.platform),
    createKittyBackend(realFs, realRun, process.env),
    createIterm2Backend(realFs, process.env),
  ];
  const selection = selectBackend(backends, process.env, requested);

  if ("error" in selection) {
    console.error(selection.error);
    process.exit(1);
  }

  const backend = selection.backend;

  const notifierCtx = {
    runningVersion: pkg.version,
    mainPath: Bun.main,
    execPath: process.execPath,
    platform: process.platform,
  };
  let updateNotice: string | null = null;
  if (process.stdout.isTTY) {
    await maybeScheduleCheck(
      realFs,
      process.env,
      spawnDetached,
      notifierCtx,
      Date.now(),
    );
    updateNotice = await readNotice(realFs, process.env, notifierCtx);
  }

  const builtin = await resolveThemes();

  if (builtin.length === 0) {
    console.error(
      "no themes found (checked TTM_THEMES, the on-disk themes/ directory, and the embedded catalogue)",
    );
    process.exit(1);
  }

  // `update` does its own forced refresh, so the startup fetch would be a
  // second, redundant request to the same URL — and it would warm the cache,
  // making update's forced fetch see a fresh cache and report "revalidated"
  // even on a cold start. Skip it: update builds no merged catalogue anyway.
  const wantsRemote = argv[0] !== "update";

  const skipped: RemoteResult = { themes: [], source: "none" };
  const [remote, installed] = await Promise.all([
    wantsRemote ? fetchCatalogue(realFs, fetch, process.env) : skipped,
    loadInstalled(realFs, process.env),
  ]);

  // Printed before entering the TUI: a warning inside the alt-screen would
  // break the drawing, and it's not urgent enough to block startup.
  if (remote.warning) console.error(`warning: ${remote.warning}`);

  const entries = mergeCatalogue({
    builtin,
    installed,
    remote: remote.themes,
  });

  const deps = {
    install: (theme: (typeof builtin)[number]) =>
      installTheme(realFs, process.env, theme),
    refresh: () => fetchCatalogue(realFs, fetch, process.env, { force: true }),
  };

  if (argv.length === 0) {
    const applied = await runTui(entries, backend);
    if (applied) {
      const entry = entries.find((e) => e.theme.name === applied.name);
      if (entry?.origin === "remote") {
        await installTheme(realFs, process.env, applied);
      }
      console.log(`applied ${applied.name}`);
    }
    if (updateNotice) console.error(updateNotice);
    process.exit(0);
  }

  const code = await runCli(
    argv,
    backend,
    entries,
    (s) => console.log(s),
    deps,
  );
  if (updateNotice) console.error(updateNotice);
  process.exit(code);
}
