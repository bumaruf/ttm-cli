import { expect, test } from "bun:test";
import { createMemoryFs } from "../../src/platform/fs";
import {
  cacheFile,
  detectChannel,
  readNotice,
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

const ENV = { HOME: "/home/me" };
const CACHE = "/home/me/.cache/ttm/update.json";
const CTX = {
  runningVersion: "0.4.0",
  mainPath: "/pkg/src/cli.ts", // npm channel
  execPath: "/home/me/.bun/bin/bun",
  platform: "linux" as NodeJS.Platform,
};

test("no cache means no notice", async () => {
  expect(await readNotice(createMemoryFs(), ENV, CTX)).toBeNull();
});

test("a newer latest yields a notice with the arrow and the command", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1, latest: "0.5.0" }),
  });
  const notice = await readNotice(fs, ENV, CTX);
  expect(notice).toContain("0.4.0");
  expect(notice).toContain("0.5.0");
  expect(notice).toContain("npm i -g @bumaruf/ttm-cli");
});

test("latest not newer than running yields no notice", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1, latest: "0.4.0" }),
  });
  expect(await readNotice(fs, ENV, CTX)).toBeNull();
});

// After the user updates, the notice disappears immediately — it compares
// against the RUNNING version, not the one that did the check.
test("once running >= cached latest, the stale notice is gone", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1, latest: "0.5.0" }),
  });
  const updated = { ...CTX, runningVersion: "0.5.0" };
  expect(await readNotice(fs, ENV, updated)).toBeNull();
});

test("a corrupt cache is silent", async () => {
  const fs = createMemoryFs({ [CACHE]: "not json" });
  expect(await readNotice(fs, ENV, CTX)).toBeNull();
});

test("the deb channel shows the apt command", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1, latest: "0.5.0" }),
  });
  const deb = {
    ...CTX,
    mainPath: "/$bunfs/root/cli.ts",
    execPath: "/usr/bin/ttm",
  };
  expect(await readNotice(fs, ENV, deb)).toContain("apt");
});

// Guards suppress everything.
test("TTM_NO_UPDATE_CHECK suppresses the notice", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1, latest: "0.5.0" }),
  });
  expect(
    await readNotice(fs, { ...ENV, TTM_NO_UPDATE_CHECK: "1" }, CTX),
  ).toBeNull();
});

test("CI suppresses the notice", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1, latest: "0.5.0" }),
  });
  expect(await readNotice(fs, { ...ENV, CI: "true" }, CTX)).toBeNull();
});

test("cacheFile honours XDG_CACHE_HOME", () => {
  expect(cacheFile({ HOME: "/home/me" })).toBe(
    "/home/me/.cache/ttm/update.json",
  );
  expect(cacheFile({ HOME: "/home/me", XDG_CACHE_HOME: "/x" })).toBe(
    "/x/ttm/update.json",
  );
});
