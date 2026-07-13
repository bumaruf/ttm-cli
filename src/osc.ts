import type { Theme } from "./theme";

const BEL = "\x07";
const OSC = "\x1b]";

export function applyTheme(theme: Theme): string {
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
