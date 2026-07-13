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

/** `['a', 'b']` -> ['a', 'b'] ; `'a'` -> 'a' */
function unquote(value: string): string {
  return value.trim().replace(/^'|'$/g, "");
}

function parseList(value: string): string[] {
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

      if (!uuid) {
        uuid = crypto.randomUUID();
        const key = (k: string) => `${BASE}/:${uuid}/${k}`;
        const palette = `[${theme.palette.map((c) => `'${c}'`).join(", ")}]`;

        await run(["dconf", "write", key("visible-name"), `'${theme.name}'`]);
        await run(["dconf", "write", key("background-color"), `'${theme.background}'`]);
        await run(["dconf", "write", key("foreground-color"), `'${theme.foreground}'`]);
        await run(["dconf", "write", key("palette"), palette]);
        await run(["dconf", "write", key("use-theme-colors"), "false"]);

        const all = [...(await uuids()), uuid];
        const encoded = `[${all.map((u) => `'${u}'`).join(", ")}]`;
        await run(["gsettings", "set", SCHEMA, "list", encoded]);
      }

      await run(["gsettings", "set", SCHEMA, "default", `'${uuid}'`]);
    },
  };
}
