// tests/alacritty.test.ts
import { expect, test } from "bun:test";
import { createAlacrittyBackend } from "../src/backends/alacritty";
import type { Theme } from "../src/core/theme";
import { createMemoryFs } from "../src/platform/fs";

const theme: Theme = {
  name: "Nord",
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: [
    "#3b4252",
    "#bf616a",
    "#a3be8c",
    "#ebcb8b",
    "#81a1c1",
    "#b48ead",
    "#88c0d0",
    "#e5e9f0",
    "#4c566a",
    "#bf616a",
    "#a3be8c",
    "#ebcb8b",
    "#81a1c1",
    "#b48ead",
    "#8fbcbb",
    "#eceff4",
  ],
};

const ENV = { HOME: "/home/me" };
const CONFIG = "/home/me/.config/alacritty/alacritty.toml";
const THEME_FILE = "/home/me/.config/alacritty/ttm-theme.toml";

const USER_CONFIG = `# my config
[window]
opacity = 0.95
`;

test("detects Alacritty from the environment", () => {
  const backend = createAlacrittyBackend(createMemoryFs(), ENV, "linux");
  expect(backend.detect({ ALACRITTY_WINDOW_ID: "1" })).toBe(true);
  expect(backend.detect({ TERM_PROGRAM: "alacritty" })).toBe(true);
  expect(backend.detect({})).toBe(false);
});

test("apply writes the theme to ttm-theme.toml, not to the user's config", async () => {
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  await createAlacrittyBackend(fs, ENV, "linux").apply(theme);

  const themeFile = fs.files()[THEME_FILE]!;
  expect(themeFile).toContain("[colors.primary]");
  expect(themeFile).toContain('background = "#2e3440"');
  expect(themeFile).toContain('foreground = "#d8dee9"');
  expect(themeFile).toContain("[colors.normal]");
  expect(themeFile).toContain('black   = "#3b4252"');
  expect(themeFile).toContain("[colors.bright]");
  expect(themeFile).toContain('black   = "#4c566a"');
});

// The invariant: the user's file keeps everything it had.
test("apply preserves the user's config and only adds the import line", async () => {
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  await createAlacrittyBackend(fs, ENV, "linux").apply(theme);

  const after = fs.files()[CONFIG]!;
  expect(after).toContain("# my config");
  expect(after).toContain("opacity = 0.95");
  expect(after).toContain('general.import = ["ttm-theme.toml"]');
  expect(fs.files()[`${CONFIG}.ttm-backup`]).toBe(USER_CONFIG);
});

test("applying twice does not duplicate the import line", async () => {
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  const backend = createAlacrittyBackend(fs, ENV, "linux");
  await backend.apply(theme);
  await backend.apply(theme);

  const after = fs.files()[CONFIG]!;
  const occurrences = after.split("general.import").length - 1;
  expect(occurrences).toBe(1);
});

test("current reads the theme name the ttm wrote", async () => {
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  const backend = createAlacrittyBackend(fs, ENV, "linux");
  expect(await backend.current()).toBeNull();
  await backend.apply(theme);
  expect(await backend.current()).toBe("Nord");
});

test("apply fails loudly when there is no alacritty config", async () => {
  const backend = createAlacrittyBackend(createMemoryFs(), ENV, "linux");
  await expect(backend.apply(theme)).rejects.toThrow(/alacritty\.toml/);
});
