import { expect, test } from "bun:test";
import { isHex, parseColor } from "../src/core/color";

test("parses lowercase hex", () => {
  expect(parseColor("#282a36")).toBe("#282a36");
});

test("normalizes uppercase hex to lowercase", () => {
  expect(parseColor("#282A36")).toBe("#282a36");
});

test("expands 3-digit hex", () => {
  expect(parseColor("#abc")).toBe("#aabbcc");
});

test("parses rgb() form used by the original GNOME profile", () => {
  expect(parseColor("rgb(27,27,27)")).toBe("#1b1b1b");
  expect(parseColor("rgb(255, 206, 81)")).toBe("#ffce51");
});

test("rejects garbage", () => {
  expect(() => parseColor("blue")).toThrow();
  expect(() => parseColor("#12345")).toThrow();
  expect(() => parseColor("rgb(300,0,0)")).toThrow();
});

test("isHex only accepts normalized 6-digit hex", () => {
  expect(isHex("#282a36")).toBe(true);
  expect(isHex("#282A36")).toBe(false);
  expect(isHex("rgb(0,0,0)")).toBe(false);
});
