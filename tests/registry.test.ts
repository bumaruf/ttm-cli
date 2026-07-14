// tests/registry.test.ts
import { expect, test } from "bun:test";
import type { Backend, Env } from "../src/backend";
import { selectBackend } from "../src/registry";

const stub = (id: string, detectVar: string): Backend => ({
  id,
  name: id.toUpperCase(),
  detect: (env: Env) => env[detectVar] !== undefined,
  isInstalled: async () => true,
  current: async () => null,
  apply: async () => {},
});

const gnome = stub("gnome", "GNOME_TERMINAL_SCREEN");
const wt = stub("windows-terminal", "WT_SESSION");
const ALL = [gnome, wt];

test("picks the one backend that detects itself", () => {
  const result = selectBackend(ALL, { WT_SESSION: "abc" });
  expect("backend" in result && result.backend.id).toBe("windows-terminal");
});

test("an explicit --backend wins over detection", () => {
  const result = selectBackend(ALL, { WT_SESSION: "abc" }, "gnome");
  expect("backend" in result && result.backend.id).toBe("gnome");
});

test("an unknown --backend is an error that lists the valid ids", () => {
  const result = selectBackend(ALL, {}, "nonsense");
  expect("error" in result).toBe(true);
  if ("error" in result) {
    expect(result.error).toContain("nonsense");
    expect(result.error).toContain("gnome");
    expect(result.error).toContain("windows-terminal");
  }
});

// Estes dois são o ponto do módulo: a ferramenta não adivinha.
test("detecting nothing is an error, not a guess", () => {
  const result = selectBackend(ALL, {});
  expect("error" in result).toBe(true);
  if ("error" in result) expect(result.error).toContain("--backend");
});

test("detecting more than one is an error, not a coin flip", () => {
  const result = selectBackend(ALL, {
    WT_SESSION: "abc",
    GNOME_TERMINAL_SCREEN: "/org/...",
  });
  expect("error" in result).toBe(true);
  if ("error" in result) {
    expect(result.error).toContain("gnome");
    expect(result.error).toContain("windows-terminal");
  }
});
