import { expect, test } from "bun:test";
import pkg from "../package.json";
import { isNewer } from "../src/core/version";

test("the package version is a parseable x.y.z", () => {
  expect(typeof pkg.version).toBe("string");
  // isNewer returns false for non-x.y.z; a version equal to itself is not newer,
  // but a clearly-lower one must be — proving the string parses as x.y.z.
  expect(isNewer(pkg.version, "0.0.0")).toBe(true);
});
