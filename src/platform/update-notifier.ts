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
  if (!(await fs.exists(path))) return null;

  let latest: string;
  try {
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
