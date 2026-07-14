// tests/windows-terminal.test.ts
import { expect, test } from "bun:test";
import { createMemoryFs } from "../src/fs";
import type { Theme } from "../src/theme";
import { createWindowsTerminalBackend } from "../src/windows-terminal";

const theme: Theme = {
  name: "Nord",
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
};

const ENV = { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" };
const SETTINGS =
  "C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows Terminal\\settings.json";
const FRAGMENT =
  "C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows Terminal\\Fragments\\ttm\\ttm.json";

// A user's real settings.json: it HAS comments. Destroying them is data loss.
const USER_SETTINGS = `{
  // my terminal settings, do not lose this comment
  "profiles": {
    "defaults": {
      "colorScheme": "Campbell",
      "font": { "face": "Cascadia Code" }
    }
  }
}`;

test("detects Windows Terminal from WT_SESSION", () => {
  const backend = createWindowsTerminalBackend(createMemoryFs(), ENV);
  expect(backend.detect({ WT_SESSION: "abc" })).toBe(true);
  expect(backend.detect({})).toBe(false);
});

test("isInstalled is false when there is no settings.json", async () => {
  const backend = createWindowsTerminalBackend(createMemoryFs(), ENV);
  expect(await backend.isInstalled()).toBe(false);
});

test("current reads colorScheme from the user's settings", async () => {
  const fs = createMemoryFs({ [SETTINGS]: USER_SETTINGS });
  const backend = createWindowsTerminalBackend(fs, ENV);
  expect(await backend.current()).toBe("Campbell");
});

test("apply writes the scheme to a fragment file the ttm owns", async () => {
  const fs = createMemoryFs({ [SETTINGS]: USER_SETTINGS });
  await createWindowsTerminalBackend(fs, ENV).apply(theme);

  const fragment = JSON.parse(fs.files()[FRAGMENT]!);
  expect(fragment.schemes[0].name).toBe("Nord");
  expect(fragment.schemes[0].background).toBe("#2e3440");
  expect(fragment.schemes[0].foreground).toBe("#d8dee9");
  expect(fragment.schemes[0].black).toBe("#81a1c1");
});

// THE test for this backend: the user's comments and formatting survive.
test("apply preserves the user's comments and formatting in settings.json", async () => {
  const fs = createMemoryFs({ [SETTINGS]: USER_SETTINGS });
  await createWindowsTerminalBackend(fs, ENV).apply(theme);

  const after = fs.files()[SETTINGS]!;
  expect(after).toContain("// my terminal settings, do not lose this comment");
  expect(after).toContain('"face": "Cascadia Code"');
  expect(after).toContain('"colorScheme": "Nord"');
  expect(after).not.toContain('"colorScheme": "Campbell"');
});

test("apply backs the settings file up before touching it", async () => {
  const fs = createMemoryFs({ [SETTINGS]: USER_SETTINGS });
  await createWindowsTerminalBackend(fs, ENV).apply(theme);

  const backup = Object.keys(fs.files()).find((f) => f.includes(".ttm-backup"));
  expect(backup).toBeDefined();
  expect(fs.files()[backup!]).toBe(USER_SETTINGS);
});

test("apply inserts colorScheme when defaults has none", async () => {
  const noScheme = `{
  "profiles": {
    "defaults": {
      "font": { "face": "Cascadia Code" }
    }
  }
}`;
  const fs = createMemoryFs({ [SETTINGS]: noScheme });
  await createWindowsTerminalBackend(fs, ENV).apply(theme);
  expect(fs.files()[SETTINGS]).toContain('"colorScheme": "Nord"');
  expect(fs.files()[SETTINGS]).toContain('"face": "Cascadia Code"');
});

test("apply fails loudly when settings.json is missing", async () => {
  const backend = createWindowsTerminalBackend(createMemoryFs(), ENV);
  await expect(backend.apply(theme)).rejects.toThrow(/settings\.json/);
});
