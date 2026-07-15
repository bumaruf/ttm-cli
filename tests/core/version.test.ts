import { expect, test } from "bun:test";
import { isNewer } from "../../src/core/version";

test("a higher version is newer", () => {
  expect(isNewer("0.5.0", "0.4.0")).toBe(true);
  expect(isNewer("1.0.0", "0.9.9")).toBe(true);
  expect(isNewer("0.4.1", "0.4.0")).toBe(true);
});

test("equal or lower is not newer", () => {
  expect(isNewer("0.4.0", "0.4.0")).toBe(false);
  expect(isNewer("0.3.0", "0.4.0")).toBe(false);
  expect(isNewer("0.4.0", "0.4.1")).toBe(false);
});

test("a prerelease is older than the final of the same number", () => {
  expect(isNewer("0.5.0-rc.1", "0.5.0")).toBe(false);
  // ...and the final is newer than a running prerelease of the same number
  expect(isNewer("0.5.0", "0.5.0-rc.1")).toBe(true);
});

test("garbage never reports an update", () => {
  expect(isNewer("nonsense", "0.4.0")).toBe(false);
  expect(isNewer("0.5.0", "")).toBe(false);
  expect(isNewer("", "")).toBe(false);
  expect(isNewer("1.2", "1.1.9")).toBe(false); // not x.y.z
});

test("malformed segments never report an update", () => {
  expect(isNewer("1..3", "1.0.2")).toBe(false); // empty segment
  expect(isNewer("1.2.-3", "1.1.9")).toBe(false); // negative sign in segment
  expect(isNewer("1. 2.3", "1.1.9")).toBe(false); // embedded whitespace
  expect(isNewer("01.2.3", "1.1.9")).toBe(false); // leading zero
  expect(isNewer("v1.2.3", "1.1.9")).toBe(false); // non-digit prefix
  expect(isNewer("1.2.3.4", "1.1.9")).toBe(false); // too many segments
});
