// tests/iterm2.test.ts
import { expect, test } from "bun:test";
import { createIterm2Backend } from "../src/backends/iterm2";
import type { Theme } from "../src/core/theme";
import { createMemoryFs } from "../src/platform/fs";

const theme: Theme = {
  name: "Nord",
  background: "#000000",
  foreground: "#ffffff",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
};

const ENV = { HOME: "/Users/me" };
const PROFILE =
  "/Users/me/Library/Application Support/iTerm2/DynamicProfiles/ttm.json";

test("detects iTerm2 from TERM_PROGRAM", () => {
  const backend = createIterm2Backend(createMemoryFs(), ENV);
  expect(backend.detect({ TERM_PROGRAM: "iTerm.app" })).toBe(true);
  expect(backend.detect({ TERM_PROGRAM: "Apple_Terminal" })).toBe(false);
  expect(backend.detect({})).toBe(false);
});

test("apply writes a dynamic profile with a stable GUID", async () => {
  const fs = createMemoryFs();
  await createIterm2Backend(fs, ENV).apply(theme);

  const profile = JSON.parse(fs.files()[PROFILE]!);
  expect(profile.Profiles).toHaveLength(1);
  expect(profile.Profiles[0].Guid).toBe("ttm-theme");
  expect(profile.Profiles[0].Name).toBe("ttm — Nord");
});

// iTerm2 wants 0..1 floats per component, not hex.
test("colors are converted to iTerm2's float components", async () => {
  const fs = createMemoryFs();
  await createIterm2Backend(fs, ENV).apply(theme);
  const p = JSON.parse(fs.files()[PROFILE]!).Profiles[0];

  expect(p["Background Color"]).toEqual({
    "Red Component": 0,
    "Green Component": 0,
    "Blue Component": 0,
    "Color Space": "sRGB",
  });
  expect(p["Foreground Color"]["Red Component"]).toBe(1);
  expect(p["Ansi 0 Color"]["Red Component"]).toBeCloseTo(0.506, 2); // 0x81 / 255
});

test("applying again overwrites the same profile, not a second one", async () => {
  const fs = createMemoryFs();
  const backend = createIterm2Backend(fs, ENV);
  await backend.apply(theme);
  await backend.apply({ ...theme, name: "Dracula" });

  expect(Object.keys(fs.files())).toHaveLength(1);
  const profile = JSON.parse(fs.files()[PROFILE]!);
  expect(profile.Profiles[0].Name).toBe("ttm — Dracula");
});

test("current reads the theme name back from the profile", async () => {
  const fs = createMemoryFs();
  const backend = createIterm2Backend(fs, ENV);
  expect(await backend.current()).toBeNull();
  await backend.apply(theme);
  expect(await backend.current()).toBe("Nord");
});
