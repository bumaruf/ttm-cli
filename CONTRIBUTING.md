# Contributing to ttm

## Setup

```bash
bun install
bun test
bun run typecheck
```

`bun test` should be green and `bun run typecheck` clean before you open a PR.

## What a PR should carry

- A test alongside the change. If you fix a bug, add a test that fails without your fix. If you add behavior, add a test that covers it.
- Nothing unrelated bundled in. Keep PRs scoped to one change.

## Adding a theme

Drop a `.toml` file in `themes/` with a `name`, `background`, `foreground`, and a 16-entry `palette` array (ANSI colors 0–15, in order). See `themes/nord.toml` for the format. That's the entire contribution — no code changes are needed for a new theme to show up in the picker. Add a test asserting the file parses and has all required fields if the existing theme-loading tests don't already cover it generically.

## Adding a backend

Terminal emulators other than GNOME Terminal are supported by implementing the `Backend` interface in `src/backend.ts`:

```ts
export interface Backend {
  list(): Promise<string[]>;
  current(): Promise<string | null>;
  apply(theme: Theme): Promise<void>;
}
```

A new backend should not require changes anywhere else — not to the picker, the live-preview logic, or the theme format. If you find yourself needing to touch other files, that's a sign the `Backend` interface itself needs to grow; raise that as a separate discussion before the PR.

## Style

Match the existing code: no runtime dependencies, TypeScript, Bun. Keep changes minimal and readable.
