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
`perf`, `style`, `theme`. Scope is optional. The description is lowercase and
imperative.

`feat` bumps the minor version, `fix` bumps the patch. Everything else —
including `theme` — is invisible to the changelog and does not trigger a
release. That is the whole release process — you never touch the version
number.

## What a PR should carry

- **A test alongside the change.** Fixing a bug? Add the test that fails without
  your fix. Adding behavior? Cover it.
- **One change.** Nothing unrelated bundled in.
- Green `bun test`, clean `bun run lint` and `bun run typecheck`.

## Adding a theme

The most common contribution, and it needs no code. The full contract —
required fields, the exact contrast thresholds, filenames, credit rules — is
[THEME_SPEC.md](THEME_SPEC.md). Read it before opening the PR; it's short and
a CI gate (`theme-check`) enforces every rule in it, including contrast
(WCAG), so a theme that's unreadable on its own background is rejected
automatically, with the numbers in the error message — not by a reviewer
squinting at hex.

Copy `themes/nord.toml`, change the values, drop it in `themes/`:

```toml
name = "Nord"
author = "@bumaruf"
contributor = "@bumaruf"
source = "https://www.nordtheme.com/docs/colors-and-palettes"
license = "MIT"
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

A theme PR carries no code, so it must not trigger an npm release: use the
`theme:` commit type for its title, e.g. `theme: add Catppuccin Latte` (see
"Commit and PR titles" above, and THEME_SPEC.md).

## Adding a backend

New terminal emulators are supported by implementing the `Backend` interface in
`src/backend.ts`:

```ts
export interface Backend {
  id: string;                        // stable id, used by `--backend`
  name: string;                      // human name, shown to the user
  detect(env: Env): boolean;         // are we running inside this emulator?
  isInstalled(): Promise<boolean>;   // does its config exist on this machine?
  current(): Promise<string | null>;
  apply(theme: Theme): Promise<void>;
}
```

`detect` must only return `true` when it is *certain* — over SSH or inside an
embedded terminal, detection is legitimately ambiguous, and the registry
(`src/registry.ts`) is built to fail loudly with `--backend <id>` as the way
out rather than guess. Never make `detect` more permissive to "fix" an
ambiguous case.

**The non-negotiable rule for any backend that touches a file: it must never
rewrite a user-owned config wholesale.** Config files like `alacritty.toml` or
`kitty.conf` are hand-written, with the user's own comments. A backend owns a
separate file of its own (a `ttm-theme.*` file, a Windows Terminal fragment, an
iTerm2 dynamic profile) and, at most, adds a single import/include line to the
user's config — once, idempotently, with a backup taken first via
`src/config-file.ts`'s `addImport`. If a backend can't find a safe place to
write that one line (or, for Windows Terminal's JSONC `settings.json`, the one
key it needs to change), it must throw a clear error instead of guessing where
to put it. `src/alacritty.ts` is the canonical example of this pattern; also
look at `src/windows-terminal.ts` for the JSONC surgical-edit case, which never
does a JSON.parse/stringify round-trip (that silently deletes comments).

All I/O — commands (`Run`), filesystem (`Fs`), environment (`Env`) — is
injected, so a backend's tests never touch the real system. Use
`createMemoryFs` from `src/fs.ts` for file-based backends.

A new backend should not require changes anywhere else — not to the picker, the
live-preview logic, or the theme format. If you find yourself needing to touch
other files, that's a sign the `Backend` interface itself needs to grow. Raise
that as a discussion before opening the PR.

Note that the backend is the *persistence* layer only. The live preview works by
writing OSC escape sequences to the terminal that's already running, which is
emulator-agnostic — any VTE-like terminal honors it, and inside tmux it is
wrapped in a DCS passthrough sequence so tmux forwards it instead of eating it.

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
| `src/registry.ts` | Picks a backend by detection or `--backend`; never guesses |
| `src/fs.ts` | The `Fs` seam — injectable filesystem for file-based backends |
| `src/config-file.ts` | Safe, idempotent import-line handling with backups |
| `src/gnome.ts` | The only module that knows what dconf is |
| `src/windows-terminal.ts` | Windows Terminal: fragment file + surgical JSONC edit |
| `src/alacritty.ts` | Alacritty: owns `ttm-theme.toml`, adds one import line |
| `src/kitty.ts` | kitty: owns `ttm-theme.conf`, repaints via remote control |
| `src/iterm2.ts` | iTerm2: a dynamic profile, no preferences ever touched |
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
