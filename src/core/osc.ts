import { isHex } from "./color";
import type { Env } from "./env";
import type { Theme } from "./theme";

const BEL = "\x07";
const OSC = "\x1b]";

/**
 * tmux intercepts OSC sequences instead of forwarding them to the real
 * terminal, so the live preview does nothing inside it. DCS passthrough
 * (ESC P tmux; ... ESC \) forwards them, but every ESC of the payload must
 * be doubled or tmux consumes it.
 */
export function wrapForMultiplexer(sequences: string, env: Env): string {
  if (!env.TMUX) return sequences;
  const escaped = sequences.replaceAll("\x1b", "\x1b\x1b");
  return `\x1bPtmux;${escaped}\x1b\\`;
}

export function applyTheme(theme: Theme, env: Env = process.env): string {
  // Validate palette length
  if (theme.palette.length !== 16) {
    throw new Error(
      `Theme "${theme.name}": palette must have exactly 16 entries (got ${theme.palette.length})`,
    );
  }

  // Validate background color
  if (!isHex(theme.background)) {
    throw new Error(
      `Theme "${theme.name}": background color must be lowercase #rrggbb format (got ${theme.background})`,
    );
  }

  // Validate foreground color
  if (!isHex(theme.foreground)) {
    throw new Error(
      `Theme "${theme.name}": foreground color must be lowercase #rrggbb format (got ${theme.foreground})`,
    );
  }

  // Validate each palette entry
  for (let i = 0; i < theme.palette.length; i++) {
    const color = theme.palette[i];
    if (color === undefined || !isHex(color)) {
      throw new Error(
        `Theme "${theme.name}": palette[${i}] must be lowercase #rrggbb format (got ${color})`,
      );
    }
  }

  const palette = theme.palette
    .map((color, index) => `${OSC}4;${index};${color}${BEL}`)
    .join("");
  const sequences =
    palette +
    `${OSC}10;${theme.foreground}${BEL}` +
    `${OSC}11;${theme.background}${BEL}`;
  return wrapForMultiplexer(sequences, env);
}

export function resetColors(env: Env = process.env): string {
  return wrapForMultiplexer(
    `${OSC}104${BEL}${OSC}110${BEL}${OSC}111${BEL}`,
    env,
  );
}
