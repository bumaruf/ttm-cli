// tests/catalogue/remote.test.ts
import { expect, test } from "bun:test";
import { renderIndex } from "../../src/catalogue/index-format";
import { cacheDir, fetchCatalogue } from "../../src/catalogue/remote";
import type { Theme } from "../../src/core/theme";
import { createMemoryFs } from "../../src/platform/fs";

const theme = (name: string): Theme => ({
  name,
  background: "#2e3440",
  foreground: "#d8dee9",
  palette: Array.from({ length: 16 }, () => "#81a1c1"),
});

const ENV = { HOME: "/home/me" };
const DIR = "/home/me/.cache/ttm";
const INDEX = `${DIR}/index.json`;
const META = `${DIR}/meta.json`;

const body = renderIndex([theme("Nord")], "2026-07-14T00:00:00Z");

const ok = (text: string, etag = 'W/"abc"') =>
  new Response(text, { status: 200, headers: { etag } });

const NOW = 1_000_000_000_000;
const HOUR = 3_600_000;

test("cacheDir honours XDG_CACHE_HOME, and falls back to ~/.cache", () => {
  expect(cacheDir({ HOME: "/home/me" })).toBe("/home/me/.cache/ttm");
  expect(cacheDir({ HOME: "/home/me", XDG_CACHE_HOME: "/tmp/c" })).toBe(
    "/tmp/c/ttm",
  );
});

test("with no cache, it fetches and stores the index", async () => {
  const fs = createMemoryFs();
  const result = await fetchCatalogue(fs, async () => ok(body), ENV, {
    now: NOW,
  });

  expect(result.source).toBe("network");
  expect(result.themes.map((t) => t.name)).toEqual(["Nord"]);
  expect(fs.files()[INDEX]).toBe(body);
  expect(JSON.parse(fs.files()[META]!).etag).toBe('W/"abc"');
});

// The whole point: browsing must never wait on the network.
test("a fresh cache is used without touching the network at all", async () => {
  const fs = createMemoryFs({
    [INDEX]: body,
    [META]: JSON.stringify({ etag: 'W/"abc"', fetchedAt: NOW - HOUR }),
  });
  let called = false;
  const result = await fetchCatalogue(
    fs,
    async () => {
      called = true;
      return ok(body);
    },
    ENV,
    { now: NOW },
  );

  expect(called).toBe(false);
  expect(result.source).toBe("cache");
  expect(result.themes).toHaveLength(1);
});

test("a stale cache revalidates, and a 304 keeps it", async () => {
  const fs = createMemoryFs({
    [INDEX]: body,
    [META]: JSON.stringify({ etag: 'W/"abc"', fetchedAt: NOW - 48 * HOUR }),
  });
  let sentEtag: string | undefined;
  const result = await fetchCatalogue(
    fs,
    async (_url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      sentEtag = headers["If-None-Match"];
      return new Response(null, { status: 304 });
    },
    ENV,
    { now: NOW },
  );

  expect(sentEtag).toBe('W/"abc"');
  // A 304 means we DID ask the network and it confirmed the cache — that is
  // "revalidated", distinct from serving the cache without asking.
  expect(result.source).toBe("revalidated");
  expect(result.themes).toHaveLength(1);
});

// Offline is a first-class state, not an error.
test("offline with a cache serves the cache and warns", async () => {
  const fs = createMemoryFs({
    [INDEX]: body,
    [META]: JSON.stringify({ etag: "x", fetchedAt: NOW - 48 * HOUR }),
  });
  const result = await fetchCatalogue(
    fs,
    async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    },
    ENV,
    { now: NOW },
  );

  expect(result.source).toBe("cache");
  expect(result.themes).toHaveLength(1);
  expect(result.warning).toMatch(/offline|could not reach/i);
});

test("offline with no cache returns nothing, and says why", async () => {
  const result = await fetchCatalogue(
    createMemoryFs(),
    async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    },
    ENV,
    { now: NOW },
  );

  expect(result.source).toBe("none");
  expect(result.themes).toEqual([]);
  expect(result.warning).toBeDefined();
});

// A bad index must never poison a good cache.
test("a corrupt response does not overwrite a valid cache", async () => {
  const fs = createMemoryFs({
    [INDEX]: body,
    [META]: JSON.stringify({ etag: "x", fetchedAt: NOW - 48 * HOUR }),
  });
  const result = await fetchCatalogue(fs, async () => ok("garbage"), ENV, {
    now: NOW,
  });

  expect(fs.files()[INDEX]).toBe(body);
  expect(result.source).toBe("cache");
  expect(result.themes).toHaveLength(1);
  expect(result.warning).toBeDefined();
});

test("an HTTP error with no cache is reported, not thrown", async () => {
  const result = await fetchCatalogue(
    createMemoryFs(),
    async () => new Response("nope", { status: 500 }),
    ENV,
    { now: NOW },
  );
  expect(result.source).toBe("none");
  expect(result.warning).toMatch(/500/);
});

test("force ignores a fresh cache", async () => {
  const fs = createMemoryFs({
    [INDEX]: body,
    [META]: JSON.stringify({ etag: "x", fetchedAt: NOW }),
  });
  let called = false;
  const result = await fetchCatalogue(
    fs,
    async () => {
      called = true;
      return ok(body, 'W/"new"');
    },
    ENV,
    { now: NOW, force: true },
  );

  expect(called).toBe(true);
  expect(result.source).toBe("network");
});
