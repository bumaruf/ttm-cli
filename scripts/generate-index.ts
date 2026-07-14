// scripts/generate-index.ts
// Builds the public catalogue (core + community) that the TUI fetches.
// Run in CI on every push to main; the output is published to GitHub Pages.
import { renderIndex } from "../src/catalogue/index-format";
import { loadThemes } from "../src/core/theme";

const generatedAt = process.env.GENERATED_AT ?? new Date().toISOString();

const themes = [
  ...(await loadThemes("themes/core")),
  ...(await loadThemes("themes/community")),
].sort((a, b) => a.name.localeCompare(b.name));

if (themes.length === 0) {
  throw new Error("no themes found — refusing to publish an empty catalogue");
}

await Bun.write("public/index.json", renderIndex(themes, generatedAt));
console.log(`wrote ${themes.length} themes to public/index.json`);
