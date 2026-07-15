// src/catalogue/remote.ts
import type { Env } from "../core/env";
import type { Theme } from "../core/theme";
import type { Fs } from "../platform/fs";
import { parseIndex } from "./index-format";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export const CATALOGUE_URL = "https://bumaruf.github.io/ttm-cli/index.json";

/** How long a cached catalogue is used without revalidating. */
const TTL_MS = 24 * 60 * 60 * 1000;

export interface RemoteResult {
  themes: Theme[];
  // "network"     — downloaded fresh content (HTTP 200)
  // "revalidated" — asked the network, it confirmed our cache is current (304)
  // "cache"       — served the cache without asking the network (fresh TTL, or
  //                 offline fallback)
  // "none"        — no cache and the network was unreachable
  source: "network" | "revalidated" | "cache" | "none";
  warning?: string;
}

interface Meta {
  etag?: string;
  fetchedAt: number;
}

export function cacheDir(env: Env): string {
  const base = env.XDG_CACHE_HOME ?? `${env.HOME ?? ""}/.cache`;
  return `${base}/ttm`;
}

export async function fetchCatalogue(
  fs: Fs,
  fetchFn: Fetch,
  env: Env,
  opts: { force?: boolean; now?: number } = {},
): Promise<RemoteResult> {
  const now = opts.now ?? Date.now();
  const dir = cacheDir(env);
  const indexPath = `${dir}/index.json`;
  const metaPath = `${dir}/meta.json`;

  const cached = await readCache(fs, indexPath, metaPath);

  // Browsing must never wait on the network: a fresh cache short-circuits.
  if (cached && !opts.force && now - cached.meta.fetchedAt < TTL_MS) {
    return { themes: cached.themes, source: "cache" };
  }

  try {
    const headers: Record<string, string> = {};
    if (cached?.meta.etag) headers["If-None-Match"] = cached.meta.etag;

    const response = await fetchFn(CATALOGUE_URL, { headers });

    if (response.status === 304 && cached) {
      await writeMeta(fs, metaPath, { etag: cached.meta.etag, fetchedAt: now });
      return { themes: cached.themes, source: "revalidated" };
    }

    if (!response.ok) {
      return degraded(
        cached,
        `catalogue unavailable (HTTP ${response.status})`,
      );
    }

    const body = await response.text();

    // Validate BEFORE writing: a corrupt index must never poison a good cache.
    const index = parseIndex(body);

    await fs.writeFile(indexPath, body);
    await writeMeta(fs, metaPath, {
      etag: response.headers.get("etag") ?? undefined,
      fetchedAt: now,
    });

    return { themes: index.themes, source: "network" };
  } catch (error) {
    return degraded(
      cached,
      `could not reach the theme catalogue (${(error as Error).message})`,
    );
  }
}

function degraded(
  cached: { themes: Theme[] } | null,
  warning: string,
): RemoteResult {
  if (cached) {
    return { themes: cached.themes, source: "cache", warning };
  }
  return { themes: [], source: "none", warning };
}

async function readCache(
  fs: Fs,
  indexPath: string,
  metaPath: string,
): Promise<{ themes: Theme[]; meta: Meta } | null> {
  if (!(await fs.exists(indexPath))) return null;

  try {
    const themes = parseIndex(await fs.readFile(indexPath)).themes;
    const meta: Meta = (await fs.exists(metaPath))
      ? JSON.parse(await fs.readFile(metaPath))
      : { fetchedAt: 0 };
    return { themes, meta };
  } catch {
    // A corrupt cache is the same as no cache.
    return null;
  }
}

async function writeMeta(fs: Fs, path: string, meta: Meta): Promise<void> {
  await fs.writeFile(path, `${JSON.stringify(meta)}\n`);
}
