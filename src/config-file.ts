// src/config-file.ts
import type { Fs } from "./fs";

export interface ImportPlan {
  configPath: string;
  importLine: string;
}

const MARKER = "added by ttm";

export function hasImport(source: string, importLine: string): boolean {
  return source.includes(importLine);
}

/**
 * The ttm owns its own theme file and never rewrites the user's config. The
 * single exception is this: adding one import line, once, with a backup — and
 * only when the user's config already exists. We do not invent config files.
 */
export async function addImport(
  fs: Fs,
  plan: ImportPlan,
): Promise<{ added: boolean; backup?: string }> {
  if (!(await fs.exists(plan.configPath))) {
    throw new Error(
      `config not found: ${plan.configPath} — create it first, then run ttm again`,
    );
  }

  const source = await fs.readFile(plan.configPath);

  if (hasImport(source, plan.importLine)) {
    return { added: false };
  }

  const backup = `${plan.configPath}.ttm-backup`;
  await fs.copyFile(plan.configPath, backup);

  const separator = source.endsWith("\n") ? "" : "\n";
  const appended = `${source}${separator}\n# ${MARKER}\n${plan.importLine}\n`;
  await fs.writeFile(plan.configPath, appended);

  return { added: true, backup };
}
