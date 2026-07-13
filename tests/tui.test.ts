import { expect, test } from "bun:test";
import { parseKey } from "../src/tui";

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
