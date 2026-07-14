// tests/config-file.test.ts
import { expect, test } from "bun:test";
import { addImport, hasImport } from "../src/config-file";
import { createMemoryFs } from "../src/fs";

const CONFIG = "/home/me/.config/alacritty/alacritty.toml";
const LINE = 'general.import = ["ttm-theme.toml"]';

const USER_CONFIG = `# my alacritty config
[window]
opacity = 0.95
`;

test("hasImport finds the line", () => {
  expect(hasImport(`${USER_CONFIG}\n${LINE}\n`, LINE)).toBe(true);
  expect(hasImport(USER_CONFIG, LINE)).toBe(false);
});

test("addImport appends the line, marked, and keeps everything else", async () => {
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  const result = await addImport(fs, { configPath: CONFIG, importLine: LINE });

  expect(result.added).toBe(true);
  const after = fs.files()[CONFIG]!;
  expect(after).toContain("# my alacritty config");
  expect(after).toContain("opacity = 0.95");
  expect(after).toContain(LINE);
  expect(after).toContain("added by ttm");
});

test("addImport backs the config up before touching it", async () => {
  const fs = createMemoryFs({ [CONFIG]: USER_CONFIG });
  const result = await addImport(fs, { configPath: CONFIG, importLine: LINE });
  expect(result.backup).toBeDefined();
  expect(fs.files()[result.backup!]).toBe(USER_CONFIG);
});

// Idempotence: running ttm twice must not append the line twice.
test("addImport is a no-op when the line is already there", async () => {
  const already = `${USER_CONFIG}\n${LINE}\n`;
  const fs = createMemoryFs({ [CONFIG]: already });
  const result = await addImport(fs, { configPath: CONFIG, importLine: LINE });

  expect(result.added).toBe(false);
  expect(result.backup).toBeUndefined();
  expect(fs.files()[CONFIG]).toBe(already);
  expect(Object.keys(fs.files())).toHaveLength(1); // no backup created
});

test("addImport refuses to invent a config that does not exist", async () => {
  const fs = createMemoryFs();
  await expect(
    addImport(fs, { configPath: CONFIG, importLine: LINE }),
  ).rejects.toThrow(/alacritty\.toml/);
});
