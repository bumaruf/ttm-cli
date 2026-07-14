// tests/fs.test.ts
import { expect, test } from "bun:test";
import { createMemoryFs } from "../src/fs";

test("reads a seeded file", async () => {
  const fs = createMemoryFs({ "/a/b.txt": "hello" });
  expect(await fs.exists("/a/b.txt")).toBe(true);
  expect(await fs.readFile("/a/b.txt")).toBe("hello");
});

test("missing file does not exist, and reading it throws", async () => {
  const fs = createMemoryFs();
  expect(await fs.exists("/nope")).toBe(false);
  await expect(fs.readFile("/nope")).rejects.toThrow(/\/nope/);
});

test("writes are visible in files()", async () => {
  const fs = createMemoryFs();
  await fs.writeFile("/x.toml", "name = 'T'");
  expect(fs.files()["/x.toml"]).toBe("name = 'T'");
});

test("copyFile duplicates content", async () => {
  const fs = createMemoryFs({ "/a": "one" });
  await fs.copyFile("/a", "/a.bak");
  expect(await fs.readFile("/a.bak")).toBe("one");
});
