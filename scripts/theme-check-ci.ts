import { $ } from "bun";
import { loadThemes, parseTheme } from "../src/core/theme";
import { checkThemes, slugify, type ThemeFile } from "./check-themes";
import { renderDiffPreview, renderPreview } from "./render-theme-preview";

const base = process.env.BASE_SHA;
const author = process.env.PR_AUTHOR ?? "@unknown";

if (!base) {
  console.error("BASE_SHA is required");
  process.exit(1);
}

// Which theme files changed, and how.
// --no-renames makes git report a move as delete + add instead of `R`. Without
// it, a rename slipped through the gate entirely: git reported `R088`, the loop
// matched neither `A` nor `M`, and the theme was never validated nor previewed
// — so a theme could be moved AND edited in one commit with the gate blind to it.
const raw =
  await $`git diff --name-status --no-renames ${base} HEAD -- themes/`.text();

const changed: ThemeFile[] = [];

for (const line of raw.trim().split("\n").filter(Boolean)) {
  const [status, path] = line.split(/\s+/);
  if (!path?.endsWith(".toml")) continue;

  // A deleted theme has nothing left to validate.
  if (status?.startsWith("D")) continue;

  if (status?.startsWith("A")) {
    changed.push({
      path,
      source: await Bun.file(path).text(),
      status: "added",
    });
  } else if (status?.startsWith("M")) {
    changed.push({
      path,
      source: await Bun.file(path).text(),
      status: "modified",
      previous: await $`git show ${base}:${path}`.text(),
    });
  } else {
    // Any other status is validated as an addition rather than skipped. The
    // gate must never wave a theme through because git described the change in
    // a way we did not anticipate.
    changed.push({
      path,
      source: await Bun.file(path).text(),
      status: "added",
    });
  }
}

if (changed.length === 0) {
  console.log("no theme files changed");
  process.exit(0);
}

// The catalogue as it exists on the base branch — a theme being added must not
// clash with it. Files changed in this PR are excluded so a modified theme does
// not collide with its own previous self. Core and community are unioned: a
// unique name must hold across both directories combined.
const changedPaths = new Set(changed.map((c) => c.path));

async function catalogueOf(dir: "core" | "community") {
  const themes = await loadThemes(`themes/${dir}`);
  return themes.map((theme) => ({
    theme,
    path: pathOf(theme, dir),
  }));
}

function pathOf(theme: { name: string }, dir: "core" | "community"): string {
  // Must use the SAME slugify as the filename rule (check-themes.ts), which
  // strips accents via NFD. The old inline version turned "é" into a hyphen
  // ("Rosé" → "ros-"), so an accented theme's reconstructed path never matched
  // its real file ("rose-..."); the exclusion failed and the theme collided
  // with itself as "already exists". Only accented names hit it.
  return `themes/${dir}/${slugify(theme.name)}.toml`;
}

const catalogue = [
  ...(await catalogueOf("core")),
  ...(await catalogueOf("community")),
]
  .filter((entry) => !changedPaths.has(entry.path))
  .map((entry) => entry.theme);

const result = checkThemes(changed, catalogue, author);

if (!result.ok) {
  console.error("Theme check failed:\n");
  for (const error of result.errors) console.error(`  ${error}`);
  console.error("\nSee THEME_SPEC.md for the rules.");
  process.exit(1);
}

// Passed: build the preview comment.
const sections: string[] = ["## Theme preview", ""];

for (const file of changed) {
  const theme = parseTheme(file.source, file.path);
  if (file.status === "modified" && file.previous) {
    sections.push(
      renderDiffPreview(parseTheme(file.previous, file.path), theme),
    );
  } else {
    sections.push(renderPreview(theme));
  }
}

const markdown = sections.join("\n");
await Bun.write("theme-preview.md", markdown);

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) await Bun.write(summary, markdown);

console.log("theme check passed");
