import { expect, test } from "bun:test";
import {
  detectChannel,
  updateCommand,
} from "../../src/platform/update-notifier";

test("a real .ts main means an npm/bun install", () => {
  expect(
    detectChannel(
      "/home/me/.bun/install/global/node_modules/@bumaruf/ttm-cli/src/cli.ts",
      "/home/me/.bun/bin/bun",
      "linux",
    ),
  ).toBe("npm");
});

test("a compiled binary under /usr/bin on linux is the deb", () => {
  expect(detectChannel("/$bunfs/root/cli.ts", "/usr/bin/ttm", "linux")).toBe(
    "deb",
  );
});

test("a compiled binary elsewhere is a downloaded release binary", () => {
  expect(
    detectChannel("/$bunfs/root/cli.ts", "/home/me/.local/bin/ttm", "linux"),
  ).toBe("binary");
  expect(detectChannel("/$bunfs/root/cli.ts", "/opt/ttm", "darwin")).toBe(
    "binary",
  );
});

test("each channel yields its own update command", () => {
  expect(updateCommand("npm")).toContain("npm i -g @bumaruf/ttm-cli");
  expect(updateCommand("deb")).toContain("apt");
  expect(updateCommand("binary")).toContain("releases/latest");
});
