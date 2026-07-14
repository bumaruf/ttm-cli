import type { Theme } from "../src/theme";

/** A row of 16 colored cells. GitHub renders bgcolor in PR comments. */
function swatches(theme: Theme): string {
  const cells = theme.palette
    .map((color) => `<td bgcolor="${color}" width="28" height="28"></td>`)
    .join("");
  return `<table><tr>${cells}</tr></table>`;
}

/** Foreground on background, so an unreadable pair is visibly unreadable. */
function sample(theme: Theme): string {
  return (
    `<table><tr><td bgcolor="${theme.background}" width="420">` +
    `<code style="color:${theme.foreground}">` +
    `$ ttm apply ${theme.name}` +
    `</code></td></tr></table>`
  );
}

export function renderPreview(theme: Theme): string {
  return [
    `### ${theme.name}`,
    "",
    sample(theme),
    swatches(theme),
    "",
    `**author** ${theme.author ?? "—"} · **contributor** ${theme.contributor ?? "—"} · **license** ${theme.license ?? "—"}`,
    `**source** ${theme.source ?? "—"}`,
    "",
  ].join("\n");
}

export function renderDiffPreview(before: Theme, after: Theme): string {
  return [
    `### ${after.name} — changed`,
    "",
    "**Before**",
    sample(before),
    swatches(before),
    "",
    "**After**",
    sample(after),
    swatches(after),
    "",
    `**contributor** ${after.contributor ?? "—"}`,
    "",
  ].join("\n");
}
