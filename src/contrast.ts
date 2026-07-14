import { type Hex, isHex } from "./color";

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: Hex): number {
  if (!isHex(hex)) {
    throw new Error(`not a normalized #rrggbb color: ${hex}`);
  }

  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ].map((c) => {
    const normalized = c / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: Hex, b: Hex): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
