import type { Env } from "../core/env";
import { isNewer } from "../core/version";
import type { Fs } from "./fs";

export const NOTICE_PACKAGE = "@bumaruf/ttm-cli";

export type Channel = "npm" | "deb" | "binary";

/**
 * How was this ttm installed? The compiled binary has a virtual `$bunfs` main;
 * a real .ts main means it's being run by Bun (npm/bun install). A compiled
 * binary under /usr/bin on linux is the .deb; anywhere else, a release download.
 */
export function detectChannel(
  mainPath: string,
  execPath: string,
  platform: NodeJS.Platform,
): Channel {
  const compiled = mainPath.includes("$bunfs");
  if (!compiled) return "npm";
  if (platform === "linux" && execPath.startsWith("/usr/bin/")) return "deb";
  return "binary";
}

export function updateCommand(channel: Channel): string {
  switch (channel) {
    case "npm":
      return `npm i -g ${NOTICE_PACKAGE}`;
    case "deb":
      return "sudo apt update && sudo apt upgrade ttm";
    case "binary":
      return "download the latest from github.com/bumaruf/ttm-cli/releases/latest";
  }
}

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function cacheDir(env: Env): string {
  const base = env.XDG_CACHE_HOME ?? `${env.HOME ?? ""}/.cache`;
  return `${base}/ttm`;
}

export function cacheFile(env: Env): string {
  return `${cacheDir(env)}/update.json`;
}

function suppressed(env: Env): boolean {
  return Boolean(env.TTM_NO_UPDATE_CHECK) || Boolean(env.CI);
}

export interface NoticeContext {
  runningVersion: string;
  mainPath: string;
  execPath: string;
  platform: NodeJS.Platform;
}

export async function readNotice(
  fs: Fs,
  env: Env,
  ctx: NoticeContext,
): Promise<string | null> {
  if (suppressed(env)) return null;

  const path = cacheFile(env);
  let latest: string;
  try {
    if (!(await fs.exists(path))) return null;
    latest = JSON.parse(await fs.readFile(path)).latest;
  } catch {
    return null;
  }

  if (typeof latest !== "string" || !isNewer(latest, ctx.runningVersion)) {
    return null;
  }

  const channel = detectChannel(ctx.mainPath, ctx.execPath, ctx.platform);
  return `${DIM}update available: ${ctx.runningVersion} → ${latest} · run ${updateCommand(channel)}${RESET}`;
}

export type Fetch = (url: string) => Promise<Response>;
export type Spawn = (cmd: string[]) => void;

export const REGISTRY_URL =
  "https://registry.npmjs.org/@bumaruf/ttm-cli/latest";

const TTL_MS = 24 * 60 * 60 * 1000;

/** The command a detached child runs to refresh the cache. */
export function checkCommand(ctx: NoticeContext): string[] {
  const compiled = ctx.mainPath.includes("$bunfs");
  return compiled
    ? [ctx.execPath, "__notifier-check"]
    : [ctx.execPath, ctx.mainPath, "__notifier-check"];
}

/** Runs in the detached child. Fetches the registry, writes the cache. Silent. */
export async function runCheck(
  fetchFn: Fetch,
  fs: Fs,
  env: Env,
  now: number,
): Promise<void> {
  try {
    const response = await fetchFn(REGISTRY_URL);
    if (!response.ok) return;
    const body = (await response.json()) as { version: unknown };
    const latest = body.version;
    if (typeof latest !== "string") return;
    await fs.writeFile(
      cacheFile(env),
      `${JSON.stringify({ checkedAt: now, latest })}\n`,
    );
  } catch {
    // Silent by design: a background check must never surface an error.
  }
}

async function cacheAgeOk(fs: Fs, env: Env, now: number): Promise<boolean> {
  const path = cacheFile(env);
  try {
    if (!(await fs.exists(path))) return false;
    const checkedAt = JSON.parse(await fs.readFile(path)).checkedAt;
    return typeof checkedAt === "number" && now - checkedAt < TTL_MS;
  } catch {
    return false;
  }
}

/** Spawns the detached check if the cache is missing or older than the TTL. */
export async function maybeScheduleCheck(
  fs: Fs,
  env: Env,
  spawn: Spawn,
  ctx: NoticeContext,
  now: number,
): Promise<void> {
  if (suppressed(env)) return;
  if (await cacheAgeOk(fs, env, now)) return;
  spawn(checkCommand(ctx));
}
