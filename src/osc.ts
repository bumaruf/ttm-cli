import type { Theme } from "./theme";
import { isHex } from "./color";

const BEL = "\x07";
const OSC = "\x1b]";

export function applyTheme(theme: Theme): string {
  // Validate palette length
  if (theme.palette.length !== 16) {
    throw new Error(
      `Theme "${theme.name}": palette must have exactly 16 entries (got ${theme.palette.length})`
    );
  }

  // Validate background color
  if (!isHex(theme.background)) {
    throw new Error(
      `Theme "${theme.name}": background color must be lowercase #rrggbb format (got ${theme.background})`
    );
  }

  // Validate foreground color
  if (!isHex(theme.foreground)) {
    throw new Error(
      `Theme "${theme.name}": foreground color must be lowercase #rrggbb format (got ${theme.foreground})`
    );
  }

  // Validate each palette entry
  for (let i = 0; i < theme.palette.length; i++) {
    const color = theme.palette[i];
    if (color === undefined || !isHex(color)) {
      throw new Error(
        `Theme "${theme.name}": palette[${i}] must be lowercase #rrggbb format (got ${color})`
      );
    }
  }

  const palette = theme.palette
    .map((color, index) => `${OSC}4;${index};${color}${BEL}`)
    .join("");
  return (
    palette +
    `${OSC}10;${theme.foreground}${BEL}` +
    `${OSC}11;${theme.background}${BEL}`
  );
}

export function resetColors(): string {
  return `${OSC}104${BEL}${OSC}110${BEL}${OSC}111${BEL}`;
}
