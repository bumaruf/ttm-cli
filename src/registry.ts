// src/registry.ts
import type { Backend, Env } from "./backend";

export function selectBackend(
  backends: Backend[],
  env: Env,
  requestedId?: string,
): { backend: Backend } | { error: string } {
  const ids = backends.map((b) => b.id).join(", ");

  if (requestedId) {
    const backend = backends.find((b) => b.id === requestedId);
    if (!backend) {
      return { error: `unknown backend: ${requestedId}\n\navailable: ${ids}` };
    }
    return { backend };
  }

  const detected = backends.filter((b) => b.detect(env));

  const [only] = detected;
  if (detected.length === 1 && only) {
    return { backend: only };
  }

  if (detected.length === 0) {
    return {
      error:
        "could not tell which terminal you are running in.\n\n" +
        `pick one explicitly: ttm --backend <${ids}>`,
    };
  }

  const names = detected.map((b) => b.id).join(", ");
  return {
    error:
      `more than one terminal matched (${names}).\n\n` +
      `pick one explicitly: ttm --backend <${ids}>`,
  };
}
