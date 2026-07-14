import type { Env } from "../core/env";
import type { Theme } from "../core/theme";

/** Runs a command and returns its stdout. Throws on a non-zero exit. */
export type Run = (cmd: string[]) => Promise<string>;

/**
 * A terminal emulator's persistence layer — the project's extension seam.
 *
 * The live preview is NOT here: it works by writing OSC escape sequences to
 * whatever terminal is already running, which every modern emulator honors. A
 * backend only answers where the chosen colors get stored.
 */
export interface Backend {
  /** Stable id, used by `--backend`. */
  id: string;
  /** Human name, shown to the user. */
  name: string;
  /** Is the terminal we are running inside this emulator? */
  detect(env: Env): boolean;
  /** Does this emulator's configuration exist on this machine? */
  isInstalled(): Promise<boolean>;
  current(): Promise<string | null>;
  apply(theme: Theme): Promise<void>;
}

export type { Env };
