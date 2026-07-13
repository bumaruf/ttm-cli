// src/backend.ts
import type { Theme } from "./theme";

export type Run = (cmd: string[]) => Promise<string>;

export interface Backend {
  list(): Promise<string[]>;
  current(): Promise<string | null>;
  apply(theme: Theme): Promise<void>;
}
