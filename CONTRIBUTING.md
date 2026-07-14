# Contributing to ttm

## Setup

```bash
bun install     # also installs the git hooks (lefthook)
bun test
bun run lint
bun run typecheck
```

`bun install` installs pre-commit and pre-push hooks. They format your staged
files and run the tests before a push. They're a convenience, not a gate — skip
them with `--no-verify` if you need to. CI is what actually decides.

## Commit and PR titles

This project follows [Conventional Commits](https://www.conventionalcommits.org).
PRs are squash-merged, so **the PR title becomes the commit on `main`** — and
`release-please` reads those commits to decide the next version and write the
changelog. A title outside the convention fails CI.

```
feat: add a --json flag to ttm list
fix(gnome): write theme colors through even when the profile already exists
docs: explain why cancelling leaves no trace
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `build`, `chore`,
`perf`, `style`. Scope is optional. The description is lowercase and imperative.

`feat` bumps the minor version, `fix` bumps the patch. Everything else is
invisible to the changelog. That is the whole release process — you never touch
the version number.

## What a PR should carry

- **A test alongside the change.** Fixing a bug? Add the test that fails without
  your fix. Adding behavior? Cover it.
- **One change.** Nothing unrelated bundled in.
- Green `bun test`, clean `bun run lint` and `bun run typecheck`.

## Adding a theme

The most common contribution, and it needs no code.

Copy `themes/nord.toml`, change the values, drop it in `themes/`:

```toml
name = "Nord"
background = "#2e3440"
foreground = "#d8dee9"
palette = [
  "#3b4252", "#bf616a", "#a3be8c", "#ebcb8b",
  "#81a1c1", "#b48ead", "#88c0d0", "#e5e9f0",
  "#4c566a", "#bf616a", "#a3be8c", "#ebcb8b",
  "#81a1c1", "#b48ead", "#8fbcbb", "#eceff4",
]
```

The `palette` is ANSI colors 0–15, in order. Take the values from the theme's
official palette, not from a screenshot.

Run `bun run build` before you commit: it regenerates `src/builtin-themes.ts`
(the catalogue embedded in the standalone binary). CI fails if that file is
stale, and that is on purpose — a binary shipping a catalogue that differs from
`themes/` would be a silent lie.

## Adding a backend

Terminal emulators other than GNOME Terminal are supported by implementing the
`Backend` interface in `src/backend.ts`:

```ts
export interface Backend {
  list(): Promise<string[]>;
  current(): Promise<string | null>;
  apply(theme: Theme): Promise<void>;
}
```

A new backend should not require changes anywhere else — not to the picker, the
live-preview logic, or the theme format. If you find yourself needing to touch
other files, that's a sign the `Backend` interface itself needs to grow. Raise
that as a discussion before opening the PR.

Note that the backend is the *persistence* layer only. The live preview works by
writing OSC escape sequences to the terminal that's already running, which is
emulator-agnostic — any VTE-like terminal honors it.

## How the code is arranged

Everything that decides behavior is a pure function, and the one module that
touches the terminal is deliberately small. That is what makes this reviewable
by someone who didn't write it.

| File | Responsibility |
|---|---|
| `src/color.ts` | Normalizes colors (dconf mixes `#282a36` and `rgb(27,27,27)`) |
| `src/theme.ts` | Loads and validates `themes/*.toml` |
| `src/osc.ts` | Turns a theme into escape sequences. Pure. |
| `src/state.ts` | Navigation, fuzzy filter, and the exit contract. Pure. |
| `src/render.ts` | The screen, as a string. Pure. |
| `src/backend.ts` | The `Backend` interface — the extension seam |
| `src/gnome.ts` | The only module that knows what dconf is |
| `src/tui.ts` | The only module that does terminal I/O |
| `src/cli.ts` | Subcommands and entry point |

### The one rule that matters

`ttm` mutates the user's real terminal — colors, raw mode, alt-screen. **There
must be no path that leaves it in a state the user didn't choose.** Cancelling
restores the original colors; applying keeps the chosen theme. That decision is
made in `src/state.ts` (as data) and executed in `src/tui.ts` through a single
idempotent teardown that runs from a `finally` and from the signal handlers,
using synchronous writes so a dying process can't truncate the restore sequence.

If you touch `src/tui.ts`, that invariant is what your reviewer will be looking
at first.

## Style

No runtime dependencies — that's a deliberate property of the project, not an
accident. TypeScript, Bun. Biome decides formatting; don't argue with it.
