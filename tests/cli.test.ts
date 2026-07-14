import { expect, test } from "bun:test";
import type { Backend } from "../src/backend";
import { runCli } from "../src/cli";
import type { Theme } from "../src/theme";

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
