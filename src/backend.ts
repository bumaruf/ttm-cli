// src/backend.ts
import type { Theme } from "./theme";

export type Run = (cmd: string[]) => Promise<string>;
export type Env = Record<string, string | undefined>;

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
