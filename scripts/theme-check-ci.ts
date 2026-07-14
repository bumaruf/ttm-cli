import { $ } from "bun";
import { loadThemes, parseTheme } from "../src/core/theme";
import { checkThemes, type ThemeFile } from "./check-themes";
import { renderDiffPreview, renderPreview } from "./render-theme-preview";

const base = process.env.BASE_SHA;
const author = process.env.PR_AUTHOR ?? "@unknown";

if (!base) {
  console.error("BASE_SHA is required");
  process.exit(1);
}

// Which theme files changed, and how.
const raw = await $`git diff --name-status ${base} HEAD -- themes/`.text();

const changed: ThemeFile[] = [];

for (const line of raw.trim().split("\n").filter(Boolean)) {
  const [status, path] = line.split(/\s+/);
  if (!path?.endsWith(".toml")) continue;

  if (status === "A") {
    changed.push({
      path,
      source: await Bun.file(path).text(),
      status: "added",
    });
  } else if (status === "M") {
    changed.push({
      path,
      source: await Bun.file(path).text(),
      status: "modified",
      previous: await $`git show ${base}:${path}`.text(),
    });
  }
}

if (changed.length === 0) {
  console.log("no theme files changed");
  process.exit(0);
}

// The catalogue as it exists on the base branch — a theme being added must not
// clash with it. Files changed in this PR are excluded so a modified theme does
// not collide with its own previous self.
const changedPaths = new Set(changed.map((c) => c.path));
const catalogue = (await loadThemes("themes")).filter((theme) => {
  const file = `themes/${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.toml`;
  return !changedPaths.has(file);
});

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
