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
  const keys = parseKeys(chunk);
  return keys.length === 1 ? keys[0]! : null;
}

/**
 * Incrementally parse a raw stdin chunk into zero or more keys.
 *
 * A single stdin chunk can contain multiple keypresses at once — this
 * happens when the user holds down an arrow key (terminal repeat
 * coalescing), pastes text, types fast, or when stdin is piped/non-TTY.
 * The old single-key `parseKey` returned null for any chunk that wasn't
 * exactly one recognized sequence, silently dropping every key in it. This
 * drains the chunk left to right, emitting one Key per recognized
 * sequence and skipping unrecognized bytes so one bad byte never discards
 * the rest of the chunk.
 */
export function parseKeys(chunk: string): Key[] {
  const keys: Key[] = [];
  let i = 0;

  while (i < chunk.length) {
    const c = chunk[i]!;

    if (c === "\x1b") {
      // CSI sequence: ESC [ <letter-or-unknown>
      if (chunk[i + 1] === "[") {
        if (i + 2 >= chunk.length) {
          // Chunk ends mid-escape-sequence (e.g. trailing "\x1b["). We
          // cannot know what the next byte would have been, so treat the
          // dangling prefix as a bare Esc press rather than buffering
          // across chunks or emitting junk chars.
          keys.push({ name: "escape" });
          i = chunk.length;
          continue;
        }
        const final = chunk[i + 2]!;
        if (final === "A") {
          keys.push({ name: "up" });
          i += 3;
          continue;
        }
        if (final === "B") {
          keys.push({ name: "down" });
          i += 3;
          continue;
        }
        // Unknown CSI sequence, e.g. "\x1b[5~". Consume through the final
        // byte (letter or '~') without emitting a key.
        let j = i + 2;
        while (j < chunk.length && !/[A-Za-z~]/.test(chunk[j]!)) j++;
        i = j < chunk.length ? j + 1 : chunk.length;
        continue;
      }
      // Bare ESC not followed by a recognized CSI sequence.
      keys.push({ name: "escape" });
      i += 1;
      continue;
    }

    if (c === "\r" || c === "\n") {
      keys.push({ name: "enter" });
      i += 1;
      continue;
    }

    if (c === "\x03") {
      keys.push({ name: "escape" });
      i += 1;
      continue;
    }

    if (c === "\x7f" || c === "\b") {
      keys.push({ name: "backspace" });
      i += 1;
      continue;
    }

    if (c >= " " && c !== "\x7f") {
      keys.push({ name: "char", value: c });
      i += 1;
      continue;
    }

    // Unrecognized byte: skip it, keep draining the rest of the chunk.
    i += 1;
  }

  return keys;
}

/**
 * The terminal-I/O seam runTui talks through. Production code gets
 * `defaultIo`, which reaches for the real `process.stdin`/`process.stdout`
 * exactly as before this seam existed. Tests inject a fake implementation
 * so runTui's control flow (key handling, draw/teardown sequencing, signal
 * handling) can be exercised without touching a real terminal or process.
 */
export interface TuiIo {
  /** Async-iterable source of raw input chunks (mirrors stdin's chunks). */
  input: AsyncIterable<string | Buffer>;
  /** Buffered write for the draw path. */
  write(s: string): void;
  /** Unbuffered, synchronous write for the teardown path. Must never throw. */
  writeSync(s: string): void;
  setRawMode(on: boolean): void;
  size(): { columns: number; rows: number };
  /** Register a handler for a termination signal; returns an unregister fn. */
  onSignal(signal: "SIGINT" | "SIGTERM", handler: () => void): () => void;
  /** Start consuming input (stdin.resume()/setEncoding() for the real io). */
  start(): void;
  /** Stop consuming input (stdin.pause() for the real io). */
  stop(): void;
}

/**
 * Write teardown bytes synchronously and unbuffered directly to the stdout
 * file descriptor. Unlike process.stdout.write, writeSync blocks until the
 * bytes are on the wire, so they are guaranteed to land before
 * process.exit() can kill the process mid-flush. Must never throw: a closed
 * or broken stdout (EBADF/EPIPE) during teardown must not prevent the rest
 * of teardown (raw mode restore, stdin pause) from running.
 */
function writeTeardownFd1(s: string): void {
  try {
    writeSync(1, s);
  } catch {
    // stdout is gone (EBADF/EPIPE) or otherwise unwritable — teardown must
    // never fail because of it.
  }
}

export const defaultIo: TuiIo = {
  input: process.stdin as unknown as AsyncIterable<string | Buffer>,
  write: (s) => {
    process.stdout.write(s);
  },
  writeSync: writeTeardownFd1,
  setRawMode: (on) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(on);
  },
  size: () => {
    const { columns = 80, rows = 24 } = process.stdout;
    return { columns, rows };
  },
  onSignal: (signal, handler) => {
    process.on(signal, handler);
    return () => process.off(signal, handler);
  },
  start: () => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  },
  stop: () => {
    process.stdin.pause();
  },
};

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

export async function runTui(
  themes: Theme[],
  backend: Backend,
  io: TuiIo = defaultIo,
): Promise<Theme | null> {
  let torn = false;

  const teardown = (reset: boolean) => {
    if (torn) return;
    torn = true;
    io.writeSync(teardownSequence(reset));
    io.setRawMode(false);
    io.stop();
  };

  // If we get killed, the terminal must return to normal — never leave a mess.
  const onSignal = () => {
    teardown(true);
    process.exit(130);
  };
  const offSigint = io.onSignal("SIGINT", onSignal);
  const offSigterm = io.onSignal("SIGTERM", onSignal);

  try {
    io.setRawMode(true);
    io.start();
    io.write(ALT_SCREEN_ON + CURSOR_HIDE);

    let state: State = initialState(themes);
    let painted: Theme | null = null;

    const draw = () => {
      const { columns, rows } = io.size();
      const current = focused(state);
      if (current && current !== painted) {
        io.write(applyTheme(current));
        painted = current;
      }
      io.write(CLEAR + render(state, columns, rows));
    };

    draw();

    for await (const chunk of io.input) {
      const keys = parseKeys(String(chunk));

      // Apply every key from this chunk in order, but stop the moment one
      // of them sets state.exit — a key typed after the exit key must
      // never overtake it.
      for (const key of keys) {
        state = reduce(state, key);
        if (state.exit) break;
      }

      draw();

      if (state.exit) {
        const { apply, resetColors: reset } = state.exit;
        if (apply) await backend.apply(apply);
        teardown(reset);
        return apply;
      }
    }

    teardown(true);
    return null;
  } finally {
    teardown(true);
    offSigint();
    offSigterm();
  }
}
