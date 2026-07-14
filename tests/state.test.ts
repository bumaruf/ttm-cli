import { expect, test } from "bun:test";
import { mergeCatalogue } from "../src/catalogue/merge";
import type { Theme } from "../src/core/theme";
import {
  focused,
  initialState,
  type Key,
  matches,
  reduce,
} from "../src/tui/state";

const theme = (name: string): Theme => ({
  name,
  background: "#000000",
  foreground: "#ffffff",
  palette: Array.from({ length: 16 }, () => "#000000"),
});

const ENTRIES = mergeCatalogue({
  builtin: [theme("Dracula"), theme("Gruvbox"), theme("Nord")],
  installed: [],
  remote: [],
});

const char = (value: string): Key => ({ name: "char", value });
const key = (name: "up" | "down" | "enter" | "escape" | "backspace"): Key => ({
  name,
});

const feed = (keys: Key[]) => keys.reduce(reduce, initialState(ENTRIES));

test("starts on the first theme with no filter", () => {
  const s = initialState(ENTRIES);
  expect(s.cursor).toBe(0);
  expect(s.filter).toBe("");
  expect(s.visible).toHaveLength(3);
  expect(focused(s)?.theme.name).toBe("Dracula");
  expect(s.exit).toBeNull();
});

test("down and up move the cursor", () => {
  expect(focused(feed([key("down")]))?.theme.name).toBe("Gruvbox");
  expect(focused(feed([key("down"), key("down"), key("up")]))?.theme.name).toBe(
    "Gruvbox",
  );
});

test("cursor wraps at both edges", () => {
  expect(focused(feed([key("up")]))?.theme.name).toBe("Nord");
  expect(
    focused(feed([key("down"), key("down"), key("down")]))?.theme.name,
  ).toBe("Dracula");
});

test("typing filters the list", () => {
  const s = feed([char("n"), char("o"), char("r")]);
  expect(s.filter).toBe("nor");
  expect(s.visible.map((e) => e.theme.name)).toEqual(["Nord"]);
  expect(focused(s)?.theme.name).toBe("Nord");
});

test("filter is fuzzy and case-insensitive", () => {
  expect(matches("grvb", "Gruvbox")).toBe(true);
  expect(matches("GRU", "Gruvbox")).toBe(true);
  expect(matches("xob", "Gruvbox")).toBe(false);
  expect(matches("", "Gruvbox")).toBe(true);
});

test("a filter that shrinks the list resets the cursor into range", () => {
  const s = feed([key("down"), key("down"), char("d"), char("r")]);
  expect(s.visible.map((e) => e.theme.name)).toEqual(["Dracula"]);
  expect(s.cursor).toBe(0);
  expect(focused(s)?.theme.name).toBe("Dracula");
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
  expect(focused(s)?.theme.name).toBe("Dracula");
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

// Catalogue-aware behavior: entries carry origin, and applying a remote
// theme still exits with a Theme, not an Entry.

test("focused returns the entry, so the TUI knows the origin", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord")],
    installed: [],
    remote: [theme("Zenburn")],
  });
  const s = initialState(entries);
  const current = focused(s);
  expect(current?.origin).toBe(
    current?.theme.name === "Nord" ? "builtin" : "remote",
  );
});

test("enter on a remote theme still exits applying that theme", () => {
  const entries = mergeCatalogue({
    builtin: [],
    installed: [],
    remote: [theme("Zenburn")],
  });
  const s = reduce(initialState(entries), { name: "enter" });
  expect(s.exit?.apply?.name).toBe("Zenburn");
  expect(s.exit?.resetColors).toBe(false);
});

test("the filter searches installed and remote alike", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord")],
    installed: [],
    remote: [theme("Nordic Light")],
  });
  let s = initialState(entries);
  for (const ch of "nordic") s = reduce(s, { name: "char", value: ch });
  expect(s.visible.map((e) => e.theme.name)).toEqual(["Nordic Light"]);
});
