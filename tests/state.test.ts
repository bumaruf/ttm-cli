import { expect, test } from "bun:test";
import { focused, initialState, type Key, matches, reduce } from "../src/state";
import type { Theme } from "../src/theme";

const theme = (name: string): Theme => ({
  name,
  background: "#000000",
  foreground: "#ffffff",
  palette: Array.from({ length: 16 }, () => "#000000"),
});

const THEMES = [theme("Dracula"), theme("Gruvbox"), theme("Nord")];
const char = (value: string): Key => ({ name: "char", value });
const key = (name: "up" | "down" | "enter" | "escape" | "backspace"): Key => ({
  name,
});

const feed = (keys: Key[]) => keys.reduce(reduce, initialState(THEMES));

test("starts on the first theme with no filter", () => {
  const s = initialState(THEMES);
  expect(s.cursor).toBe(0);
  expect(s.filter).toBe("");
  expect(s.visible).toHaveLength(3);
  expect(focused(s)?.name).toBe("Dracula");
  expect(s.exit).toBeNull();
});

test("down and up move the cursor", () => {
  expect(focused(feed([key("down")]))?.name).toBe("Gruvbox");
  expect(focused(feed([key("down"), key("down"), key("up")]))?.name).toBe(
    "Gruvbox",
  );
});

test("cursor wraps at both edges", () => {
  expect(focused(feed([key("up")]))?.name).toBe("Nord");
  expect(focused(feed([key("down"), key("down"), key("down")]))?.name).toBe(
    "Dracula",
  );
});

test("typing filters the list", () => {
  const s = feed([char("n"), char("o"), char("r")]);
  expect(s.filter).toBe("nor");
  expect(s.visible.map((t) => t.name)).toEqual(["Nord"]);
  expect(focused(s)?.name).toBe("Nord");
});

test("filter is fuzzy and case-insensitive", () => {
  expect(matches("grvb", "Gruvbox")).toBe(true);
  expect(matches("GRU", "Gruvbox")).toBe(true);
  expect(matches("xob", "Gruvbox")).toBe(false);
  expect(matches("", "Gruvbox")).toBe(true);
});

test("a filter that shrinks the list resets the cursor into range", () => {
  const s = feed([key("down"), key("down"), char("d"), char("r")]);
  expect(s.visible.map((t) => t.name)).toEqual(["Dracula"]);
  expect(s.cursor).toBe(0);
  expect(focused(s)?.name).toBe("Dracula");
});

test("a filter with no match yields an empty list and no focus", () => {
  const s = feed([char("z"), char("z")]);
  expect(s.visible).toEqual([]);
  expect(focused(s)).toBeNull();
});

test("backspace restores the list and keeps the cursor valid", () => {
  const s = feed([char("z"), key("backspace")]);
  expect(s.filter).toBe("");
  expect(s.visible).toHaveLength(3);
  expect(focused(s)?.name).toBe("Dracula");
});

test("backspace on an empty filter is a no-op", () => {
  const s = feed([key("backspace")]);
  expect(s.filter).toBe("");
  expect(s.exit).toBeNull();
});

test("enter on an empty list does nothing", () => {
  const s = feed([char("z"), key("enter")]);
  expect(s.exit).toBeNull();
});

// The two most important tests in the project:

test("escape exits WITHOUT applying and RESETS the colors", () => {
  const s = feed([key("down"), key("escape")]);
  expect(s.exit).toEqual({ apply: null, resetColors: true });
});

test("enter exits applying the focused theme and does NOT reset the colors", () => {
  const s = feed([key("down"), key("enter")]);
  expect(s.exit?.resetColors).toBe(false);
  expect(s.exit?.apply?.name).toBe("Gruvbox");
});

test("reduce is a no-op once exiting", () => {
  const exited = feed([key("escape")]);
  expect(reduce(exited, key("down"))).toBe(exited);
});

test("an empty catalogue does not crash", () => {
  const s = initialState([]);
  expect(focused(s)).toBeNull();
  expect(reduce(s, key("down")).cursor).toBe(0);
  expect(reduce(s, key("enter")).exit).toBeNull();
});
