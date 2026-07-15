import { expect, test } from "bun:test";
import { createMemoryFs } from "../../src/platform/fs";
import {
  cacheFile,
  checkCommand,
  detectChannel,
  maybeScheduleCheck,
  readNotice,
  runCheck,
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

// Valid JSON, but `latest` is the wrong shape (a number, or missing). The type
// guard must yield null, not throw — a hand-mangled cache can't crash the CLI.
test("a cache with a non-string latest is silent, not a crash", async () => {
  const numberLatest = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1, latest: 500 }),
  });
  expect(await readNotice(numberLatest, ENV, CTX)).toBeNull();

  const missingLatest = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 1 }),
  });
  expect(await readNotice(missingLatest, ENV, CTX)).toBeNull();
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

const DAY = 24 * 60 * 60 * 1000;

test("runCheck stores the latest version from the registry", async () => {
  const fs = createMemoryFs();
  const fetchFn = async () =>
    new Response(JSON.stringify({ version: "0.6.0" }), { status: 200 });
  await runCheck(fetchFn, fs, ENV, 1000);

  const meta = JSON.parse(fs.files()[CACHE]!);
  expect(meta.latest).toBe("0.6.0");
  expect(meta.checkedAt).toBe(1000);
});

test("runCheck never throws on a network error, and writes nothing", async () => {
  const fs = createMemoryFs();
  const fetchFn = async () => {
    throw new Error("offline");
  };
  await expect(runCheck(fetchFn, fs, ENV, 1000)).resolves.toBeUndefined();
  expect(fs.files()[CACHE]).toBeUndefined();
});

test("runCheck ignores a non-200 response", async () => {
  const fs = createMemoryFs();
  const fetchFn = async () => new Response("nope", { status: 500 });
  await runCheck(fetchFn, fs, ENV, 1000);
  expect(fs.files()[CACHE]).toBeUndefined();
});

// The whole point: browsing must not wait on the network. A fresh cache does
// not spawn anything.
test("maybeScheduleCheck does nothing when the cache is fresh", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 5 * DAY, latest: "0.4.0" }),
  });
  let spawned = false;
  await maybeScheduleCheck(
    fs,
    ENV,
    () => (spawned = true),
    CTX,
    5 * DAY + 1000,
  );
  expect(spawned).toBe(false);
});

test("maybeScheduleCheck spawns the detached check when the cache is stale", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 0, latest: "0.4.0" }),
  });
  let cmd: string[] | null = null;
  await maybeScheduleCheck(fs, ENV, (c) => (cmd = c), CTX, 2 * DAY);
  expect(cmd).not.toBeNull();
  expect(cmd!).toContain("__notifier-check");
});

test("maybeScheduleCheck spawns when there is no cache at all", async () => {
  let spawned = false;
  await maybeScheduleCheck(
    createMemoryFs(),
    ENV,
    () => (spawned = true),
    CTX,
    DAY,
  );
  expect(spawned).toBe(true);
});

test("guards suppress scheduling", async () => {
  let spawned = false;
  await maybeScheduleCheck(
    createMemoryFs(),
    { ...ENV, CI: "true" },
    () => (spawned = true),
    CTX,
    DAY,
  );
  expect(spawned).toBe(false);
});

test("checkCommand reinvokes the binary itself when compiled", () => {
  const cmd = checkCommand({
    ...CTX,
    mainPath: "/$bunfs/root/cli.ts",
    execPath: "/usr/bin/ttm",
  });
  expect(cmd).toEqual(["/usr/bin/ttm", "__notifier-check"]);
});

test("checkCommand reinvokes bun + the script when run from source", () => {
  const cmd = checkCommand({
    ...CTX,
    mainPath: "/pkg/src/cli.ts",
    execPath: "/home/me/.bun/bin/bun",
  });
  expect(cmd).toEqual([
    "/home/me/.bun/bin/bun",
    "/pkg/src/cli.ts",
    "__notifier-check",
  ]);
});

// runCheck must never throw, and never write junk, on any 200 that isn't a
// clean {version: string} — these are the "background check never surfaces an
// error" guarantees, pinned directly on runCheck.
test("runCheck ignores a 200 whose version is not a string", async () => {
  const fs = createMemoryFs();
  const fetchFn = async () =>
    new Response(JSON.stringify({ version: 123 }), { status: 200 });
  await expect(runCheck(fetchFn, fs, ENV, 1000)).resolves.toBeUndefined();
  expect(fs.files()[CACHE]).toBeUndefined();
});

test("runCheck ignores a 200 with a malformed JSON body", async () => {
  const fs = createMemoryFs();
  const fetchFn = async () => new Response("not json", { status: 200 });
  await expect(runCheck(fetchFn, fs, ENV, 1000)).resolves.toBeUndefined();
  expect(fs.files()[CACHE]).toBeUndefined();
});

// TTL boundary: a cache exactly 24h old is NOT fresh (< TTL is false), so it
// schedules a check.
test("maybeScheduleCheck treats an exactly-24h-old cache as stale", async () => {
  const fs = createMemoryFs({
    [CACHE]: JSON.stringify({ checkedAt: 0, latest: "0.4.0" }),
  });
  let spawned = false;
  await maybeScheduleCheck(fs, ENV, () => (spawned = true), CTX, DAY);
  expect(spawned).toBe(true);
});
