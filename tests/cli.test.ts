import { expect, test } from "bun:test";
import type { Backend } from "../src/backends/backend";
import { runCli } from "../src/cli";
import type { Theme } from "../src/core/theme";

const theme = (name: string): Theme => ({
  name,
  background: "#000000",
  foreground: "#ffffff",
  palette: Array.from({ length: 16 }, () => "#000000"),
});

const THEMES = [theme("Dracula"), theme("Nord")];

function fakeBackend() {
  const applied: string[] = [];
  const backend: Backend = {
    id: "fake",
    name: "Fake",
    detect: () => true,
    isInstalled: async () => true,
    current: async () => "Nord",
    apply: async (t) => {
      applied.push(t.name);
    },
  };
  return { backend, applied };
}

/** A backend that explodes if touched — proves --help never reaches one. */
function failingBackend(): Backend {
  return {
    id: "explodes",
    name: "Explodes",
    detect: () => false,
    isInstalled: async () => false,
    current: async () => {
      throw new Error("--help must not resolve a backend");
    },
    apply: async () => {
      throw new Error("--help must not resolve a backend");
    },
  };
}

function capture() {
  const lines: string[] = [];
  return { out: (s: string) => lines.push(s), text: () => lines.join("\n") };
}

test("list prints every theme and marks the current one", async () => {
  const { backend } = fakeBackend();
  const { out, text } = capture();
  expect(await runCli(["list"], backend, THEMES, out)).toBe(0);
  expect(text()).toContain("Dracula");
  expect(text()).toContain("* Nord");
});

test("current prints the active theme", async () => {
  const { backend } = fakeBackend();
  const { out, text } = capture();
  expect(await runCli(["current"], backend, THEMES, out)).toBe(0);
  expect(text().trim()).toBe("Nord");
});

test("apply applies the named theme, case-insensitively", async () => {
  const { backend, applied } = fakeBackend();
  const { out } = capture();
  expect(await runCli(["apply", "dracula"], backend, THEMES, out)).toBe(0);
  expect(applied).toEqual(["Dracula"]);
});

test("apply with an unknown theme exits non-zero with a useful message", async () => {
  const { backend, applied } = fakeBackend();
  const { out, text } = capture();
  expect(await runCli(["apply", "solarized"], backend, THEMES, out)).toBe(1);
  expect(applied).toEqual([]);
  expect(text()).toContain("solarized");
  expect(text()).toContain("Dracula");
});

test("apply with no argument exits non-zero", async () => {
  const { backend } = fakeBackend();
  const { out } = capture();
  expect(await runCli(["apply"], backend, THEMES, out)).toBe(1);
});

test("help exits zero and shows the commands", async () => {
  const { backend } = fakeBackend();
  const { out, text } = capture();
  expect(await runCli(["--help"], backend, THEMES, out)).toBe(0);
  expect(text()).toContain("ttm apply");
});

test("an unknown command exits non-zero", async () => {
  const { backend } = fakeBackend();
  const { out } = capture();
  expect(await runCli(["frobnicate"], backend, THEMES, out)).toBe(1);
});

// `ttm --help` must work with no backend resolved at all. A machine with no
// supported terminal — a CI runner, a container, an ambiguous environment —
// is exactly where someone needs to read the help text, and where backend
// detection fails. Requiring a backend first made `--help` unreachable there.
test("--help does not need a backend and lists them", async () => {
  const { out, text } = capture();
  const code = await runCli(["--help"], failingBackend(), THEMES, out);
  expect(code).toBe(0);
  expect(text()).toContain("ttm apply");
  expect(text()).toContain("gnome");
  expect(text()).toContain("windows-terminal");
});
