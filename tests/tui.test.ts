import { expect, test } from "bun:test";
import type { Backend } from "../src/backend";
import { applyTheme, resetColors } from "../src/osc";
import type { Theme } from "../src/theme";
import { parseKeys, runTui, type TuiIo, teardownSequence } from "../src/tui";

const CURSOR_SHOW = "\x1b[?25h";
const ALT_SCREEN_OFF = "\x1b[?1049l";

test("parses arrow keys", () => {
  expect(parseKeys("\x1b[A")).toEqual([{ name: "up" }]);
  expect(parseKeys("\x1b[B")).toEqual([{ name: "down" }]);
});

test("parses enter, escape and backspace", () => {
  expect(parseKeys("\r")).toEqual([{ name: "enter" }]);
  expect(parseKeys("\n")).toEqual([{ name: "enter" }]);
  expect(parseKeys("\x1b")).toEqual([{ name: "escape" }]);
  expect(parseKeys("\x7f")).toEqual([{ name: "backspace" }]);
});

test("ctrl-c is an escape (cancel), never a crash", () => {
  expect(parseKeys("\x03")).toEqual([{ name: "escape" }]);
});

test("parses printable characters", () => {
  expect(parseKeys("n")).toEqual([{ name: "char", value: "n" }]);
  expect(parseKeys(" ")).toEqual([{ name: "char", value: " " }]);
});

test("ignores unknown control sequences", () => {
  expect(parseKeys("\x1b[5~")).toEqual([]);
  expect(parseKeys("\x00")).toEqual([]);
});

test("a coalesced chunk of repeated arrow presses yields all keys in order (the bug case)", () => {
  // Holding an arrow key (or a fast/piped stream) delivers multiple keys in
  // a single stdin chunk. Before the fix, parseKey matched none of this
  // exactly and the loop silently dropped all three keypresses.
  expect(parseKeys("\x1b[B\x1b[B\x1b")).toEqual([
    { name: "down" },
    { name: "down" },
    { name: "escape" },
  ]);
});

test("a chunk of several printable chars yields one char key each, in order", () => {
  expect(parseKeys("abc")).toEqual([
    { name: "char", value: "a" },
    { name: "char", value: "b" },
    { name: "char", value: "c" },
  ]);
});

test("a chunk mixing chars and arrows is parsed key by key", () => {
  expect(parseKeys("a\x1b[Ab\x1b[B")).toEqual([
    { name: "char", value: "a" },
    { name: "up" },
    { name: "char", value: "b" },
    { name: "down" },
  ]);
});

test("an unknown CSI sequence is skipped without eating neighbouring keys", () => {
  expect(parseKeys("a\x1b[5~b")).toEqual([
    { name: "char", value: "a" },
    { name: "char", value: "b" },
  ]);
});

test("a chunk ending in a dangling escape sequence does not crash", () => {
  expect(() => parseKeys("a\x1b[")).not.toThrow();
  expect(parseKeys("a\x1b[")).toEqual([
    { name: "char", value: "a" },
    { name: "escape" },
  ]);
});

test("teardownSequence resets colors then restores cursor and alt-screen on cancel", () => {
  expect(teardownSequence(true)).toBe(
    resetColors() + CURSOR_SHOW + ALT_SCREEN_OFF,
  );
});

test("teardownSequence skips color reset on apply, keeping the applied theme", () => {
  expect(teardownSequence(false)).toBe(CURSOR_SHOW + ALT_SCREEN_OFF);
});

// --- runTui, driven through the injectable TuiIo seam -----------------
//
// These tests never touch process.stdin/stdout or send real signals; a
// fake TuiIo stands in for the terminal so runTui's control flow (key
// handling, draw/teardown sequencing, error propagation) can be verified
// with real byte/state assertions.

const THEMES: Theme[] = [
  {
    name: "Nord",
    background: "#2e3440",
    foreground: "#d8dee9",
    palette: Array.from({ length: 16 }, () => "#81a1c1"),
  },
  {
    name: "Solarized",
    background: "#002b36",
    foreground: "#839496",
    palette: Array.from({ length: 16 }, () => "#268bd2"),
  },
];

const RESET_SEQUENCE = teardownSequence(true);
const KEEP_SEQUENCE = teardownSequence(false);

function fakeBackend(applyImpl?: (t: Theme) => Promise<void>): Backend & {
  applyCalls: Theme[];
} {
  const applyCalls: Theme[] = [];
  return {
    applyCalls,
    id: "fake",
    name: "Fake",
    detect: () => true,
    async isInstalled() {
      return true;
    },
    async current() {
      return null;
    },
    async apply(theme: Theme) {
      applyCalls.push(theme);
      if (applyImpl) await applyImpl(theme);
    },
  };
}

/**
 * A fake TuiIo that never touches a real terminal or process. `chunks` is
 * fed to the "input" async iterable one at a time; when exhausted the
 * iterable ends, simulating stdin EOF.
 */
function fakeIo(
  chunks: string[],
  overrides?: { onSignal?: TuiIo["onSignal"] },
) {
  const written: string[] = [];
  const syncWritten: string[] = [];
  const rawModeCalls: boolean[] = [];

  async function* gen() {
    for (const c of chunks) yield c;
  }

  const io: TuiIo = {
    input: gen(),
    write: (s) => written.push(s),
    writeSync: (s) => syncWritten.push(s),
    setRawMode: (on) => rawModeCalls.push(on),
    size: () => ({ columns: 80, rows: 24 }),
    onSignal: overrides?.onSignal ?? (() => () => {}),
    start: () => {},
    stop: () => {},
  };

  return { io, written, syncWritten, rawModeCalls };
}

test("Esc cancels: emits the reset sequence, turns raw mode off, resolves null, never applies", async () => {
  const { io, syncWritten, rawModeCalls } = fakeIo(["\x1b"]);
  const backend = fakeBackend();

  const result = await runTui(THEMES, backend, io);

  expect(result).toBeNull();
  expect(backend.applyCalls).toEqual([]);
  expect(rawModeCalls.at(-1)).toBe(false);

  const emitted = syncWritten.join("");
  expect(emitted.endsWith(RESET_SEQUENCE)).toBe(true);
});

test("Enter applies: calls backend.apply with the focused theme, no reset sequence emitted, raw mode off", async () => {
  const { io, syncWritten, rawModeCalls } = fakeIo(["\r"]);
  const backend = fakeBackend();

  const result = await runTui(THEMES, backend, io);

  expect(result).toEqual(THEMES[0]!);
  expect(backend.applyCalls).toEqual([THEMES[0]!]);
  expect(rawModeCalls.at(-1)).toBe(false);

  const emitted = syncWritten.join("");
  expect(emitted).not.toContain("\x1b]104");
  expect(emitted).toBe(KEEP_SEQUENCE);
});

test("navigating down repaints: emits the OSC sequence for the newly focused theme", async () => {
  const { io, written } = fakeIo(["\x1b[B", "\x1b"]);
  const backend = fakeBackend();

  await runTui(THEMES, backend, io);

  const emitted = written.join("");
  expect(emitted).toContain(applyTheme(THEMES[1]!));
});

test("teardown is idempotent: the reset sequence is emitted exactly once even though teardown runs twice (loop return + finally)", async () => {
  const { io, syncWritten } = fakeIo(["\x1b"]);
  const backend = fakeBackend();

  await runTui(THEMES, backend, io);

  expect(syncWritten.length).toBe(1);
});

test("backend.apply throwing still restores the terminal and the error propagates", async () => {
  const { io, syncWritten, rawModeCalls } = fakeIo(["\r"]);
  const backend = fakeBackend(async () => {
    throw new Error("dconf: boom");
  });

  await expect(runTui(THEMES, backend, io)).rejects.toThrow("dconf: boom");

  expect(rawModeCalls.at(-1)).toBe(false);
  expect(syncWritten.length).toBe(1);
  expect(syncWritten[0]).toBe(RESET_SEQUENCE);
});

test("stdin EOF with no Esc/Enter still tears down and restores the terminal", async () => {
  const { io, syncWritten, rawModeCalls } = fakeIo([]);
  const backend = fakeBackend();

  const result = await runTui(THEMES, backend, io);

  expect(result).toBeNull();
  expect(backend.applyCalls).toEqual([]);
  expect(rawModeCalls.at(-1)).toBe(false);
  expect(syncWritten.length).toBe(1);
  expect(syncWritten[0]).toBe(RESET_SEQUENCE);
});
