import { expect, test } from "bun:test";
import { resetColors } from "../src/osc";
import { parseKeys, teardownSequence } from "../src/tui";

const CURSOR_SHOW = "\x1b[?25h";
const ALT_SCREEN_OFF = "\x1b[?1049l";

test("parses arrow keys", () => {
  expect(parseKeys("\x1b[A")).toEqual([{ name: "up" }]);
  expect(parseKeys("\x1b[B")).toEqual([{ name: "down" }]);
});

test("parses enter, escape and backspace", () => {
  expect(parseKeys("\r")).toEqual([{ name: "enter" }]);
  expect(parseKeys("\n")).toEqual([{ name: "enter" }]);
  expect(parseKeys("\x1b")).toEqual([{ name: "escape" }]);
  expect(parseKeys("\x7f")).toEqual([{ name: "backspace" }]);
});

test("ctrl-c is an escape (cancel), never a crash", () => {
  expect(parseKeys("\x03")).toEqual([{ name: "escape" }]);
});

test("parses printable characters", () => {
  expect(parseKeys("n")).toEqual([{ name: "char", value: "n" }]);
  expect(parseKeys(" ")).toEqual([{ name: "char", value: " " }]);
});

test("ignores unknown control sequences", () => {
  expect(parseKeys("\x1b[5~")).toEqual([]);
  expect(parseKeys("\x00")).toEqual([]);
});

test("a coalesced chunk of repeated arrow presses yields all keys in order (the bug case)", () => {
  // Holding an arrow key (or a fast/piped stream) delivers multiple keys in
  // a single stdin chunk. Before the fix, parseKey matched none of this
  // exactly and the loop silently dropped all three keypresses.
  expect(parseKeys("\x1b[B\x1b[B\x1b")).toEqual([
    { name: "down" },
    { name: "down" },
    { name: "escape" },
  ]);
});

test("a chunk of several printable chars yields one char key each, in order", () => {
  expect(parseKeys("abc")).toEqual([
    { name: "char", value: "a" },
    { name: "char", value: "b" },
    { name: "char", value: "c" },
  ]);
});

test("a chunk mixing chars and arrows is parsed key by key", () => {
  expect(parseKeys("a\x1b[Ab\x1b[B")).toEqual([
    { name: "char", value: "a" },
    { name: "up" },
    { name: "char", value: "b" },
    { name: "down" },
  ]);
});

test("an unknown CSI sequence is skipped without eating neighbouring keys", () => {
  expect(parseKeys("a\x1b[5~b")).toEqual([
    { name: "char", value: "a" },
    { name: "char", value: "b" },
  ]);
});

test("a chunk ending in a dangling escape sequence does not crash", () => {
  expect(() => parseKeys("a\x1b[")).not.toThrow();
  expect(parseKeys("a\x1b[")).toEqual([{ name: "char", value: "a" }, { name: "escape" }]);
});

test("teardownSequence resets colors then restores cursor and alt-screen on cancel", () => {
  expect(teardownSequence(true)).toBe(resetColors() + CURSOR_SHOW + ALT_SCREEN_OFF);
});

test("teardownSequence skips color reset on apply, keeping the applied theme", () => {
  expect(teardownSequence(false)).toBe(CURSOR_SHOW + ALT_SCREEN_OFF);
});
