export type Hex = string;

const HEX6 = /^#[0-9a-f]{6}$/;
const HEX_ANY = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;

export function isHex(value: string): boolean {
  return HEX6.test(value);
}

export function parseColor(raw: string): Hex {
  const value = raw.trim();

  if (HEX_ANY.test(value)) {
    const body = value.slice(1).toLowerCase();
    if (body.length === 3) {
      return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
    }
    return `#${body}`;
  }

  const rgb = RGB.exec(value);
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map((n) => Number(n));
    if (channels.some((n) => n > 255)) {
      throw new Error(`color channel out of range: ${raw}`);
    }
    return `#${channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }

  throw new Error(`unrecognized color: ${raw}`);
}
