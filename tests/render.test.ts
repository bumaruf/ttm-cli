import { expect, test } from "bun:test";
import type { Entry } from "../src/catalogue/merge";
import { mergeCatalogue } from "../src/catalogue/merge";
import type { Theme } from "../src/core/theme";
import { render } from "../src/tui/render";
import { initialState, reduce, type State } from "../src/tui/state";

const theme = (name: string): Theme => ({
  name,
  background: "#000000",
  foreground: "#ffffff",
  palette: Array.from({ length: 16 }, () => "#000000"),
});

// Plain wrapping, preserving insertion order — these tests are about
// scrolling/truncation, not about the merge's alphabetical sort.
const builtinEntries = (names: string[]): Entry[] =>
  names.map((n) => ({ theme: theme(n), origin: "builtin" }));

const strip = (s: string) => s.replaceAll(/\x1b\[[0-9;]*m/g, "");
const many = (n: number) =>
  builtinEntries(Array.from({ length: n }, (_, i) => `Theme${i}`));

test("renders every theme, marking the focused one", () => {
  const out = strip(
    render(initialState(builtinEntries(["Dracula", "Nord"])), 40, 12),
  );
  expect(out).toContain("Dracula");
  expect(out).toContain("Nord");
  expect(out).toContain("› Dracula");
});

test("shows the filter and the hint line", () => {
  const s = reduce(initialState(builtinEntries(["Nord"])), {
    name: "char",
    value: "n",
  });
  const out = strip(render(s, 40, 12));
  expect(out).toContain("n");
  expect(out).toContain("apply");
  expect(out).toContain("cancel");
});

test("empty result shows a message instead of an empty void", () => {
  const s = reduce(initialState(builtinEntries(["Nord"])), {
    name: "char",
    value: "z",
  });
  expect(strip(render(s, 40, 12))).toContain("no themes match");
});

test("scrolls to keep the cursor visible in a short window", () => {
  let s: State = initialState(many(30));
  for (let i = 0; i < 25; i++) s = reduce(s, { name: "down" });
  const out = strip(render(s, 40, 10));
  expect(out).toContain("› Theme25");
  expect(out).not.toContain("Theme0\n");
});

test("truncates names wider than the window", () => {
  const out = strip(
    render(initialState(builtinEntries(["A".repeat(80)])), 24, 10),
  );
  expect(out).toContain("…");
  for (const line of out.split("\n")) {
    expect(line.length).toBeLessThanOrEqual(24);
  }
});

test("a tiny window produces no garbage and no overflow", () => {
  const out = render(initialState(many(30)), 20, 6);
  const lines = strip(out).split("\n");
  expect(lines.length).toBeLessThanOrEqual(6);
  for (const line of lines) expect(line.length).toBeLessThanOrEqual(20);
});

test("an empty catalogue renders without crashing", () => {
  expect(() => render(initialState([]), 40, 12)).not.toThrow();
});

test("a remote theme is marked as not installed", () => {
  const entries = mergeCatalogue({
    builtin: [theme("Nord")],
    installed: [],
    remote: [theme("Zenburn")],
  });
  const out = strip(render(initialState(entries), 60, 12));
  expect(out).toContain("Zenburn");
  expect(out).toMatch(/Zenburn.*↓/);
  expect(out).not.toMatch(/Nord.*↓/);
});

test("the contributor is shown, dimmed, when there is one", () => {
  const entries = mergeCatalogue({
    builtin: [{ ...theme("Nord"), contributor: "@beltrano" }],
    installed: [],
    remote: [],
  });
  expect(strip(render(initialState(entries), 60, 12))).toContain("@beltrano");
});

test("a narrow window drops the contributor before it truncates the name", () => {
  const entries = mergeCatalogue({
    builtin: [{ ...theme("Nord"), contributor: "@beltrano" }],
    installed: [],
    remote: [],
  });
  const out = strip(render(initialState(entries), 20, 12));
  expect(out).toContain("Nord");
  expect(out).not.toContain("@beltrano");
});
