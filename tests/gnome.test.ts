// tests/gnome.test.ts
import { expect, test } from "bun:test";
import { createGnomeBackend } from "../src/gnome";
import type { Theme } from "../src/theme";

const theme: Theme = {
  name: "Nord",
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
};

const UUID_A = "c0100de0-0000-4000-8000-000000000001";
const UUID_B = "b1dcc9dd-5262-4d8d-a863-c897e6d979b9";

/** run fake: devolve saída canned por comando e grava tudo que foi chamado. */
function fakeRun(responses: Record<string, string>) {
  const calls: string[][] = [];
  const run = async (cmd: string[]): Promise<string> => {
    calls.push(cmd);
    const key = cmd.join(" ");
    for (const [pattern, output] of Object.entries(responses)) {
      if (key.startsWith(pattern)) return output;
    }
    return "";
  };
  return { run, calls };
}

const LIST = {
  "gsettings get org.gnome.Terminal.ProfilesList list": `['${UUID_A}', '${UUID_B}']\n`,
  "gsettings get org.gnome.Terminal.ProfilesList default": `'${UUID_A}'\n`,
  [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_A}/visible-name`]:
    "'Nord'\n",
  [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_B}/visible-name`]:
    "\n",
};

test("detects GNOME Terminal from the environment", () => {
  const { run } = fakeRun(LIST);
  const backend = createGnomeBackend(run);
  expect(backend.detect({ GNOME_TERMINAL_SCREEN: "/org/x" })).toBe(true);
  expect(backend.detect({ GNOME_TERMINAL_SERVICE: ":1.2" })).toBe(true);
  expect(backend.detect({ WT_SESSION: "abc" })).toBe(false);
  expect(backend.detect({})).toBe(false);
});

test("isInstalled is true when gsettings succeeds", async () => {
  const { run } = fakeRun(LIST);
  expect(await createGnomeBackend(run).isInstalled()).toBe(true);
});

test("isInstalled is false when gsettings fails", async () => {
  const backend = createGnomeBackend(async () => {
    throw new Error("gsettings: not found");
  });
  expect(await backend.isInstalled()).toBe(false);
});

test("current returns the default profile name", async () => {
  const { run } = fakeRun(LIST);
  expect(await createGnomeBackend(run).current()).toBe("Nord");
});

test("current names an unnamed profile", async () => {
  const { run } = fakeRun({
    ...LIST,
    "gsettings get org.gnome.Terminal.ProfilesList default": `'${UUID_B}'\n`,
  });
  expect(await createGnomeBackend(run).current()).toBe("(original profile)");
});

test("current handles names with spaces and accents", async () => {
  const { run } = fakeRun({
    ...LIST,
    [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_A}/visible-name`]:
      "'Solarized Café'\n",
  });
  expect(await createGnomeBackend(run).current()).toBe("Solarized Café");
});

test("apply on an existing profile overwrites its colors, does not re-append it, and repoints default", async () => {
  const { run, calls } = fakeRun(LIST);
  await createGnomeBackend(run).apply(theme);

  const writes = calls.filter((c) => c[0] === "dconf" && c[1] === "write");
  const written = (suffix: string) =>
    writes.find((c) => c[2]?.endsWith(suffix))?.[3];

  // Write-through: the pre-existing "Nord" profile's colors must be
  // overwritten with the theme's values, not skipped.
  expect(written("/visible-name")).toBe("'Nord'");
  expect(written("/background-color")).toBe("'#2e3440'");
  expect(written("/foreground-color")).toBe("'#d8dee9'");
  expect(written("/use-theme-colors")).toBe("false");
  expect(written("/palette")).toContain("'#81a1c1'");

  // It already exists in ProfilesList, so it must not be re-appended.
  const setList = calls.find(
    (c) => c[0] === "gsettings" && c[1] === "set" && c[3] === "list",
  );
  expect(setList).toBeUndefined();

  const setDefault = calls.find(
    (c) => c[0] === "gsettings" && c[1] === "set" && c[3] === "default",
  );
  expect(setDefault?.[4]).toBe(`'${UUID_A}'`);
});

test("apply on a missing profile creates it, writes the colors, and adds it to the list", async () => {
  const { run, calls } = fakeRun({
    ...LIST,
    [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_A}/visible-name`]:
      "'Other'\n",
  });
  await createGnomeBackend(run).apply(theme);

  const writes = calls.filter((c) => c[0] === "dconf" && c[1] === "write");
  const written = (suffix: string) =>
    writes.find((c) => c[2]?.endsWith(suffix))?.[3];

  expect(written("/visible-name")).toBe("'Nord'");
  expect(written("/background-color")).toBe("'#2e3440'");
  expect(written("/foreground-color")).toBe("'#d8dee9'");
  expect(written("/use-theme-colors")).toBe("false");
  expect(written("/palette")).toContain("'#81a1c1'");

  const setListCalls = calls.filter(
    (c) => c[0] === "gsettings" && c[1] === "set" && c[3] === "list",
  );
  expect(setListCalls.length).toBe(1);
  const setList = setListCalls[0];
  expect(setList?.[4]).toContain(UUID_A);
  expect(setList?.[4]).toContain(UUID_B);
});

test("a failing command becomes an exception, not a silent success", async () => {
  const run = async () => {
    throw new Error("dconf: permission denied");
  };
  await expect(createGnomeBackend(run).current()).rejects.toThrow(
    /permission denied/,
  );
});

test("current unescapes a GVariant-quoted apostrophe in the name", async () => {
  const { run } = fakeRun({
    ...LIST,
    [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_A}/visible-name`]:
      "'O\\'Brien'\n",
  });
  expect(await createGnomeBackend(run).current()).toBe("O'Brien");
});

test("apply on a theme named with an apostrophe writes a correctly escaped GVariant literal", async () => {
  const apostropheTheme: Theme = { ...theme, name: "O'Brien" };
  const { run, calls } = fakeRun({
    ...LIST,
    [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_A}/visible-name`]:
      "'Other'\n",
  });
  await createGnomeBackend(run).apply(apostropheTheme);

  const writes = calls.filter((c) => c[0] === "dconf" && c[1] === "write");
  const visibleName = writes.find((c) => c[2]?.endsWith("/visible-name"))?.[3];
  expect(visibleName).toBe("'O\\'Brien'");
});

test("a name containing a backslash round-trips through quote/unquote", async () => {
  const backslashTheme: Theme = { ...theme, name: "back\\slash" };
  const { run, calls } = fakeRun({
    ...LIST,
    [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_A}/visible-name`]:
      "'Other'\n",
  });
  await createGnomeBackend(run).apply(backslashTheme);

  const writes = calls.filter((c) => c[0] === "dconf" && c[1] === "write");
  const visibleName = writes.find((c) => c[2]?.endsWith("/visible-name"))?.[3];
  expect(visibleName).toBe("'back\\\\slash'");

  // Round-trip: reading that same escaped literal back should unescape correctly.
  const { run: readRun } = fakeRun({
    ...LIST,
    "gsettings get org.gnome.Terminal.ProfilesList default": `'${UUID_A}'\n`,
    [`dconf read /org/gnome/terminal/legacy/profiles:/:${UUID_A}/visible-name`]: `${visibleName}\n`,
  });
  expect(await createGnomeBackend(readRun).current()).toBe("back\\slash");
});
