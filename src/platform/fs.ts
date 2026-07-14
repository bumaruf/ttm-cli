// src/fs.ts
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface Fs {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
}

export const realFs: Fs = {
  async exists(path) {
    return Bun.file(path).exists();
  },
  async readFile(path) {
    return readFile(path, "utf8");
  },
  async writeFile(path, contents) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
  },
  async mkdirp(path) {
    await mkdir(path, { recursive: true });
  },
  async copyFile(from, to) {
    await copyFile(from, to);
  },
};

export function createMemoryFs(
  seed: Record<string, string> = {},
): Fs & { files(): Record<string, string> } {
  const files: Record<string, string> = { ...seed };

  return {
    files: () => ({ ...files }),
    async exists(path) {
      return path in files;
    },
    async readFile(path) {
      const contents = files[path];
      if (contents === undefined) {
        throw new Error(`ENOENT: no such file: ${path}`);
      }
      return contents;
    },
    async writeFile(path, contents) {
      files[path] = contents;
    },
    async mkdirp() {},
    async copyFile(from, to) {
      const contents = files[from];
      if (contents === undefined) {
        throw new Error(`ENOENT: no such file: ${from}`);
      }
      files[to] = contents;
    },
  };
}
