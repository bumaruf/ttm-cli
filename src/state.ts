import type { Theme } from "./theme";

export type Key =
  | { name: "up" | "down" | "enter" | "escape" | "backspace" }
  | { name: "char"; value: string };

export interface Exit {
  apply: Theme | null;
  resetColors: boolean;
}

export interface State {
  themes: Theme[];
  filter: string;
  visible: Theme[];
  cursor: number;
  exit: Exit | null;
}

export function matches(query: string, name: string): boolean {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  let i = 0;
  for (const ch of n) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return i === q.length;
}

function filtered(themes: Theme[], filter: string): Theme[] {
  return themes.filter((t) => matches(filter, t.name));
}

export function initialState(themes: Theme[]): State {
  return { themes, filter: "", visible: [...themes], cursor: 0, exit: null };
}

export function focused(state: State): Theme | null {
  return state.visible[state.cursor] ?? null;
}

export function reduce(state: State, key: Key): State {
  if (state.exit) return state;

  switch (key.name) {
    case "escape":
      return { ...state, exit: { apply: null, resetColors: true } };

    case "enter": {
      const theme = focused(state);
      if (!theme) return state;
      return { ...state, exit: { apply: theme, resetColors: false } };
    }

    case "up":
    case "down": {
      const count = state.visible.length;
      if (count === 0) return { ...state, cursor: 0 };
      const step = key.name === "down" ? 1 : -1;
      const cursor = (state.cursor + step + count) % count;
      return { ...state, cursor };
    }

    case "backspace": {
      if (state.filter === "") return state;
      const filter = state.filter.slice(0, -1);
      return {
        ...state,
        filter,
        visible: filtered(state.themes, filter),
        cursor: 0,
      };
    }

    case "char": {
      const filter = state.filter + key.value;
      return {
        ...state,
        filter,
        visible: filtered(state.themes, filter),
        cursor: 0,
      };
    }
  }
}
