// tests/kitty.test.ts
import { expect, test } from "bun:test";
import { createKittyBackend } from "../src/backends/kitty";
import type { Theme } from "../src/core/theme";
import { createMemoryFs } from "../src/platform/fs";

const theme: Theme = {
  name: "Nord",
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: Array.from({ length: 16 }, (_, i) =>
    `#00000${i.toString(16)}`.slice(0, 7),
  ),
};

const ENV = { HOME: "/home/me" };
const CONFIG = "/home/me/.config/kitty/kitty.conf";
const THEME_FILE = "/home/me/.config/kitty/ttm-theme.conf";

const USER_CONFIG = `# my kitty config
font_size 13
`;

const noopRun = async () => "";

test("detects kitty from the environment", () => {
  const backend = createKittyBackend(createMemoryFs(), noopRun, ENV);
  expect(backend.detect({ KITTY_WINDOW_ID: "1" })).toBe(true);
  expect(backend.detect({ TERM: "xterm-kitty" })).toBe(true);
  expect(backend.detect({})).toBe(false);
});

test("apply writes ttm-theme.conf and adds the include line", async () => {
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  await createKittyBackend(fs, noopRun, ENV).apply(theme);

  const themeFile = fs.files()[THEME_FILE]!;
  expect(themeFile).toContain("background #2e3440");
  expect(themeFile).toContain("foreground #d8dee9");
  expect(themeFile).toContain("color0 ");
  expect(themeFile).toContain("color15 ");

  const after = fs.files()[CONFIG]!;
  expect(after).toContain("font_size 13");
  expect(after).toContain("include ttm-theme.conf");
});

test("apply asks kitty to repaint the open windows", async () => {
  const calls: string[][] = [];
  const run = async (cmd: string[]) => {
    calls.push(cmd);
    return "";
  };
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  await createKittyBackend(fs, run, ENV).apply(theme);

  const setColors = calls.find((c) => c.includes("set-colors"));
  expect(setColors).toBeDefined();
  expect(setColors).toContain("--all");
});

// Remote control is often off. That must not fail the apply: the config was
// written, and new windows will pick it up.
test("a failing kitty remote-control call does not fail the apply", async () => {
  const run = async () => {
    throw new Error("kitty: remote control is disabled");
  };
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  await expect(
    createKittyBackend(fs, run, ENV).apply(theme),
  ).resolves.toBeUndefined();
  expect(fs.files()[THEME_FILE]).toBeDefined();
});

test("apply fails loudly when there is no kitty config", async () => {
  const backend = createKittyBackend(createMemoryFs(), noopRun, ENV);
  await expect(backend.apply(theme)).rejects.toThrow(/kitty\.conf/);
});
