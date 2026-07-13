// src/gnome.ts
import type { Backend, Run } from "./backend";
import type { Theme } from "./theme";

const SCHEMA = "org.gnome.Terminal.ProfilesList";
const BASE = "/org/gnome/terminal/legacy/profiles:";
export const UNNAMED = "(original profile)";

export const realRun: Run = async (cmd) => {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${cmd.join(" ")} failed (${code}): ${stderr.trim()}`);
  }
  return stdout;
};

/** Wrap a string as a GVariant literal, backslash-escaping `\` and `'`. */
export function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Reverse of `quote`: strip surrounding quotes and unescape `\\` and `\'`. */
export function unquote(value: string): string {
  const trimmed = value.trim().replace(/^'|'$/g, "");
  return trimmed.replace(/\\(\\|')/g, "$1");
}

export function parseList(value: string): string[] {
  const inner = value.trim().replace(/^\[|\]$/g, "");
  if (inner.trim() === "") return [];
  return inner.split(",").map((entry) => unquote(entry));
}

export function createGnomeBackend(run: Run): Backend {
  const uuids = async (): Promise<string[]> =>
    parseList(await run(["gsettings", "get", SCHEMA, "list"]));

  const nameOf = async (uuid: string): Promise<string> => {
    const raw = await run(["dconf", "read", `${BASE}/:${uuid}/visible-name`]);
    const name = unquote(raw);
    return name === "" ? UNNAMED : name;
  };

  const uuidFor = async (name: string): Promise<string | null> => {
    for (const uuid of await uuids()) {
      if ((await nameOf(uuid)).toLowerCase() === name.toLowerCase()) return uuid;
    }
    return null;
  };

  return {
    async list() {
      const result: string[] = [];
      for (const uuid of await uuids()) result.push(await nameOf(uuid));
      return result;
    },

    async current() {
      const uuid = unquote(await run(["gsettings", "get", SCHEMA, "default"]));
      if (uuid === "") return null;
      return nameOf(uuid);
    },

    async apply(theme: Theme) {
      let uuid = await uuidFor(theme.name);
      const isNew = !uuid;
      if (!uuid) uuid = crypto.randomUUID();

      // Write-through always: whether the profile already existed or was
      // just created, the resolved uuid must end up holding the theme's
      // colors. Otherwise re-applying a theme onto a pre-existing
      // same-named profile (e.g. the user's own "Nord" profile, or after
      // editing themes/nord.toml) would silently keep the old colors.
      const key = (k: string) => `${BASE}/:${uuid}/${k}`;
      const palette = `[${theme.palette.map((c) => quote(c)).join(", ")}]`;

      await run(["dconf", "write", key("visible-name"), quote(theme.name)]);
      await run(["dconf", "write", key("background-color"), quote(theme.background)]);
      await run(["dconf", "write", key("foreground-color"), quote(theme.foreground)]);
      await run(["dconf", "write", key("palette"), palette]);
      await run(["dconf", "write", key("use-theme-colors"), "false"]);

      if (isNew) {
        const all = [...(await uuids()), uuid];
        const encoded = `[${all.map((u) => quote(u)).join(", ")}]`;
        await run(["gsettings", "set", SCHEMA, "list", encoded]);
      }

      await run(["gsettings", "set", SCHEMA, "default", quote(uuid)]);
    },
  };
}
