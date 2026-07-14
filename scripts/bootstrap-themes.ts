// scripts/bootstrap-themes.ts
// Uso: bun run scripts/bootstrap-themes.ts
// Lê os perfis do GNOME Terminal e escreve themes/<slug>.toml para cada um.
import { mkdir } from "node:fs/promises";
import { parseList, realRun, unquote } from "../src/backends/gnome";
import { parseColor } from "../src/core/color";

const BASE = "/org/gnome/terminal/legacy/profiles:";

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const read = async (uuid: string, key: string): Promise<string> =>
  (await realRun(["dconf", "read", `${BASE}/:${uuid}/${key}`])).trim();

const uuids = parseList(
  await realRun([
    "gsettings",
    "get",
    "org.gnome.Terminal.ProfilesList",
    "list",
  ]),
).filter(Boolean);

await mkdir("themes", { recursive: true });

for (const uuid of uuids) {
  const name = unquote(await read(uuid, "visible-name"));
  const bgRaw = await read(uuid, "background-color");
  const fgRaw = await read(uuid, "foreground-color");
  const paletteRaw = await read(uuid, "palette");

  if (!name || !bgRaw || !fgRaw || !paletteRaw) {
    console.log(
      `skipping ${uuid} (${name || "unnamed"}): incomplete color set`,
    );
    continue;
  }

  const palette = parseList(paletteRaw).map((entry) => parseColor(entry));

  if (palette.length !== 16) {
    console.log(`skipping ${name}: palette has ${palette.length} colors`);
    continue;
  }

  const body = [
    `name = ${JSON.stringify(name)}`,
    `background = "${parseColor(unquote(bgRaw))}"`,
    `foreground = "${parseColor(unquote(fgRaw))}"`,
    "palette = [",
    ...[0, 4, 8, 12].map(
      (i) =>
        "  " +
        palette
          .slice(i, i + 4)
          .map((c) => `"${c}"`)
          .join(", ") +
        ",",
    ),
    "]",
    "",
  ].join("\n");

  const file = `themes/${slug(name)}.toml`;
  await Bun.write(file, body);
  console.log(`wrote ${file}`);
}
