import type { Theme } from "../src/theme";

// GitHub strips `bgcolor` and `style` from comment HTML, so colored table cells
// render blank. What it DOES render is a color swatch beside a hex code written
// in backticks — natively, in issues, PRs and discussions. That is the only way
// to show real color in a PR comment without depending on an image host.

const ANSI = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
] as const;

/** The 16 ANSI colors as a table, normal above bright. */
function palette(theme: Theme): string {
  const row = (offset: number) =>
    `| ${ANSI.map((_, i) => `\`${theme.palette[offset + i]}\``).join(" | ")} |`;

  return [
    `| ${ANSI.join(" | ")} |`,
    `|${" --- |".repeat(8)}`,
    row(0),
    row(8),
  ].join("\n");
}

function base(theme: Theme): string {
  return [
    `background \`${theme.background}\` · foreground \`${theme.foreground}\``,
    "",
    palette(theme),
  ].join("\n");
}

function provenance(theme: Theme): string {
  return [
    `**author** ${theme.author ?? "—"} · **contributor** ${theme.contributor ?? "—"} · **license** ${theme.license ?? "—"}`,
    `**source** ${theme.source ?? "—"}`,
  ].join("\n");
}

export function renderPreview(theme: Theme): string {
  return [`### ${theme.name}`, "", base(theme), "", provenance(theme), ""].join(
    "\n",
  );
}

export function renderDiffPreview(before: Theme, after: Theme): string {
  const changed: string[] = [];

  if (before.background !== after.background) {
    changed.push(
      `- background \`${before.background}\` → \`${after.background}\``,
    );
  }
  if (before.foreground !== after.foreground) {
    changed.push(
      `- foreground \`${before.foreground}\` → \`${after.foreground}\``,
    );
  }
  before.palette.forEach((color, i) => {
    const now = after.palette[i];
    if (now !== color) {
      changed.push(`- palette[${i}] \`${color}\` → \`${now}\``);
    }
  });

  return [
    `### ${after.name} — changed`,
    "",
    changed.length > 0
      ? ["**Colors that changed**", "", ...changed].join("\n")
      : "_No color changed — metadata only._",
    "",
    "**After**",
    "",
    base(after),
    "",
    provenance(after),
    "",
  ].join("\n");
}
