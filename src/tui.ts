import { writeSync } from "node:fs";
import type { Backend } from "./backend";
import { applyTheme, resetColors } from "./osc";
import { render } from "./render";
import { focused, initialState, reduce, type Key, type State } from "./state";
import type { Theme } from "./theme";

const ALT_SCREEN_ON = "\x1b[?1049h";
const ALT_SCREEN_OFF = "\x1b[?1049l";
const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";
const CLEAR = "\x1b[2J\x1b[H";

export function parseKey(chunk: string): Key | null {
  if (chunk === "\x1b[A") return { name: "up" };
  if (chunk === "\x1b[B") return { name: "down" };
  if (chunk === "\r" || chunk === "\n") return { name: "enter" };
  if (chunk === "\x1b" || chunk === "\x03") return { name: "escape" };
  if (chunk === "\x7f" || chunk === "\b") return { name: "backspace" };
  if (chunk.length === 1 && chunk >= " " && chunk !== "\x7f") {
    return { name: "char", value: chunk };
  }
  return null;
}

const write = (s: string) => process.stdout.write(s);

/**
 * Compose the exact bytes teardown must emit, in order.
 * Pure and side-effect free so it can be unit-tested without touching a
 * real terminal. `resetColors` mirrors the `reset` flag passed to teardown:
 * true on cancel (restore original colors), false on apply (keep the
 * applied theme's colors).
 */
export function teardownSequence(resetColorsFlag: boolean): string {
  return (resetColorsFlag ? resetColors() : "") + CURSOR_SHOW + ALT_SCREEN_OFF;
}

/**
 * Write teardown bytes synchronously and unbuffered directly to the stdout
 * file descriptor. Unlike process.stdout.write, writeSync blocks until the
 * bytes are on the wire, so they are guaranteed to land before
 * process.exit() can kill the process mid-flush. Must never throw: a closed
 * or broken stdout (EBADF/EPIPE) during teardown must not prevent the rest
 * of teardown (raw mode restore, stdin pause) from running.
 */
function writeTeardown(s: string): void {
  try {
    writeSync(1, s);
  } catch {
    // stdout is gone (EBADF/EPIPE) or otherwise unwritable — teardown must
    // never fail because of it.
  }
}

export async function runTui(
  themes: Theme[],
  backend: Backend,
): Promise<Theme | null> {
  let torn = false;

  const teardown = (reset: boolean) => {
    if (torn) return;
    torn = true;
    writeTeardown(teardownSequence(reset));
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
  };

  // If we get killed, the terminal must return to normal — never leave a mess.
  const onSignal = () => {
    teardown(true);
    process.exit(130);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    write(ALT_SCREEN_ON + CURSOR_HIDE);

    let state: State = initialState(themes);
    let painted: Theme | null = null;

    const draw = () => {
      const { columns = 80, rows = 24 } = process.stdout;
      const current = focused(state);
      if (current && current !== painted) {
        write(applyTheme(current));
        painted = current;
      }
      write(CLEAR + render(state, columns, rows));
    };

    draw();

    for await (const chunk of process.stdin) {
      const key = parseKey(String(chunk));
      if (!key) continue;

      state = reduce(state, key);

      if (state.exit) {
        const { apply, resetColors: reset } = state.exit;
        if (apply) await backend.apply(apply);
        teardown(reset);
        return apply;
      }

      draw();
    }

    teardown(true);
    return null;
  } finally {
    teardown(true);
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}
