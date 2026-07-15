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
