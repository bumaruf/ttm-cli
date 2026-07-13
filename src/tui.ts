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

export async function runTui(
  themes: Theme[],
  backend: Backend,
): Promise<Theme | null> {
  let torn = false;

  const teardown = (reset: boolean) => {
    if (torn) return;
    torn = true;
    if (reset) write(resetColors());
    write(CURSOR_SHOW + ALT_SCREEN_OFF);
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
