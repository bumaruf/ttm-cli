import { focused, type State } from "./state";

const DIM = "\x1b[2m";
const REVERSE = "\x1b[7m";
const RESET = "\x1b[0m";

/** Truncate visible text to fit `width` columns, appending an ellipsis when cut. */
function fit(text: string, width: number): string {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  if (width === 1) return "…";
  return `${text.slice(0, width - 1)}…`;
}

/** Wrap already-fitted visible text in an ANSI style; escape codes never count against width. */
function styled(code: string, text: string): string {
  return `${code}${text}${RESET}`;
}

function window(count: number, cursor: number, rows: number): [number, number] {
  if (rows <= 0) return [0, 0];
  if (count <= rows) return [0, count];
  const half = Math.floor(rows / 2);
  const start = Math.min(Math.max(cursor - half, 0), count - rows);
  return [start, start + rows];
}

/**
 * The plain-text body for one row: cursor prefix, name, and — if it fits —
 * the contributor. When width is tight the contributor is dropped first; the
 * name is what matters and is never truncated before it.
 */
function rowBody(
  prefix: string,
  name: string,
  contributor: string | undefined,
  markerWidth: number,
  width: number,
): { text: string; contributor: string | null } {
  const available = Math.max(0, width - markerWidth);

  if (contributor) {
    const withContributor = `${prefix}${name}   ${contributor}`;
    if (withContributor.length < available) {
      return { text: `${prefix}${name}   `, contributor };
    }
  }

  return { text: fit(`${prefix}${name}`, available), contributor: null };
}

export function render(state: State, width: number, height: number): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const lines: string[] = [];

  const HEADER = 2; // title + blank line
  const FOOTER = 3; // blank line + filter + hints
  const rows = Math.max(0, h - HEADER - FOOTER);

  lines.push(fit("  ttm", w));
  lines.push("");

  if (state.visible.length === 0) {
    const message = fit("no themes match", Math.max(0, w - 2));
    lines.push(`  ${styled(DIM, message)}`);
  } else {
    const current = focused(state);
    const [start, end] = window(state.visible.length, state.cursor, rows);
    for (const item of state.visible.slice(start, end)) {
      const isFocused = item === current;
      const prefix = isFocused ? "› " : "  ";
      const marker = item.origin === "remote" ? " ↓" : "";
      const { text, contributor } = rowBody(
        prefix,
        item.theme.name,
        item.theme.contributor,
        marker.length,
        Math.max(0, w - 2),
      );

      const plain = `${text}${contributor ?? ""}${marker}`;
      let visible: string;
      if (isFocused) {
        // Already reversed: no nested dimming, or the contributor's own
        // RESET would end the reverse video early.
        visible = styled(REVERSE, plain);
      } else {
        visible = contributor
          ? `${text}${styled(DIM, contributor)}${marker}`
          : plain;
      }

      lines.push(`  ${visible}`);
    }
  }

  while (lines.length < Math.max(0, h - FOOTER)) lines.push("");

  lines.push("");
  lines.push(fit(`  › ${state.filter}`, w));
  const hint = fit("↑↓ move   ⏎ apply   esc cancel", Math.max(0, w - 2));
  lines.push(`  ${styled(DIM, hint)}`);

  return lines.slice(0, h).join("\n");
}
