import { expect, test } from "bun:test";
import { resetColors } from "../src/osc";
import { parseKey, teardownSequence } from "../src/tui";

const CURSOR_SHOW = "\x1b[?25h";
const ALT_SCREEN_OFF = "\x1b[?1049l";

test("parses arrow keys", () => {
  expect(parseKey("\x1b[A")).toEqual({ name: "up" });
  expect(parseKey("\x1b[B")).toEqual({ name: "down" });
});

test("parses enter, escape and backspace", () => {
  expect(parseKey("\r")).toEqual({ name: "enter" });
  expect(parseKey("\n")).toEqual({ name: "enter" });
  expect(parseKey("\x1b")).toEqual({ name: "escape" });
  expect(parseKey("\x7f")).toEqual({ name: "backspace" });
});

test("ctrl-c is an escape (cancel), never a crash", () => {
  expect(parseKey("\x03")).toEqual({ name: "escape" });
});

test("parses printable characters", () => {
  expect(parseKey("n")).toEqual({ name: "char", value: "n" });
  expect(parseKey(" ")).toEqual({ name: "char", value: " " });
});

test("ignores unknown control sequences", () => {
  expect(parseKey("\x1b[5~")).toBeNull();
  expect(parseKey("\x00")).toBeNull();
});

test("teardownSequence resets colors then restores cursor and alt-screen on cancel", () => {
  expect(teardownSequence(true)).toBe(resetColors() + CURSOR_SHOW + ALT_SCREEN_OFF);
});

test("teardownSequence skips color reset on apply, keeping the applied theme", () => {
  expect(teardownSequence(false)).toBe(CURSOR_SHOW + ALT_SCREEN_OFF);
});
