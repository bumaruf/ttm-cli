// src/fs.ts
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

export interface Fs {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  /** Filenames directly under `dir` ([] if it does not exist). */
  list(dir: string): Promise<string[]>;
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
  async list(dir) {
    try {
      return await readdir(dir);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return [];
      throw error;
    }
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
    async list(dir) {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      const names = new Set<string>();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        if (rest === "" || rest.includes("/")) continue;
        names.add(rest);
      }
      return [...names];
    },
  };
}
