# Theme spec

This is the contract a theme pull request must satisfy. It is enforced by an
automated gate (`.github/workflows/theme-check.yml`, driven by
`scripts/check-themes.ts`), not by a reviewer reading hex codes. If your PR
passes locally against the rules below, it will pass in CI.

## The file

One theme, one file: `themes/community/<slug>.toml`, where `<slug>` is the
theme name, lowercased, with accents removed, and anything that isn't
`[a-z0-9]` collapsed to a single hyphen (leading/trailing hyphens trimmed).

Examples: `"Kanagawa Dragon"` → `kanagawa-dragon.toml`. `"Rosé Pine"` →
`rose-pine.toml`.

`themes/core/` is the small set embedded in the binary, curated by the
maintainer and closed to PRs — it is what has to work with no network at all,
on first use. Everything a contributor adds goes to `themes/community/`
instead: once merged, CI republishes the catalogue index and the theme is
immediately browsable and installable through `ttm update`, with no `ttm`
release needed. A name must be unique across `core/` and `community/`
combined.

## The fields

All required:

| Field         | Type                    | Example                                    |
| ------------- | ----------------------- | ------------------------------------------- |
| `name`        | string                  | `"Nord"`                                     |
| `author`      | `@handle`               | `"@bumaruf"`                                 |
| `contributor` | `@handle`               | `"@bumaruf"`                                 |
| `source`      | URL                     | `"https://www.nordtheme.com"`                |
| `license`     | string                  | `"MIT"`                                      |
| `background`  | `#rrggbb`               | `"#2e3440"`                                  |
| `foreground`  | `#rrggbb`               | `"#d8dee9"`                                  |
| `palette`     | exactly 16 `#rrggbb`    | see below                                    |

`source` must point at the theme's own upstream repository or spec — not a
screenshot, not a blog post quoting it. `license` is the license of that
upstream palette.

`palette` holds ANSI colors 0–15, in this exact order: black, red, green,
yellow, blue, magenta, cyan, white, then the eight "bright" variants in the
same order (bright black, bright red, …, bright white).

## The gate's rules, exactly

- **Contrast (WCAG).** `foreground` × `background` ≥ **4.5:1**. This is the check
  a human reading hex values cannot do reliably — a theme whose text is hard to
  read on its own background is rejected, with the computed ratio in the error
  message.

  The **palette is deliberately not** contrast-checked. In a dark theme, `color0`
  ("black") is meant to sit right next to the background, and even genuine text
  colors fall below 3:1 in themes millions of people use — Gruvbox's red scores
  2.69, Solarized's green 2.79. A rule that rejects Gruvbox, Nord and Dracula is
  not protecting anyone.
- **Structure.** The file must parse (see `src/theme.ts`): `name`, valid
  `background`/`foreground`, and a `palette` of exactly 16 colors.
- **Provenance.** `source` must be an `https://` or `http://` URL. `license`
  must be present. `author` and `contributor` must each be a handle starting
  with `@`.
- **Unique name.** No two themes in the catalogue may share a name
  (case-insensitive).
- **Filename = slug of the name.** `themes/nord-light.toml` must contain
  `name = "Nord Light"`, not something else.
- **Credit is immutable.** `author` is set once, by whoever adds the theme,
  and cannot be changed by a later PR. If you are updating someone else's
  theme file, you become (or stay) `contributor`; `author` stays as it was.

## If your theme already exists

- **It's a variant** (e.g. a lighter cousin of an existing theme): give it a
  different name and a new file. Do not overwrite the original.
- **You're fixing it** (wrong hex, dead source link, etc.): edit the existing
  file instead of adding a new one. You'll be recorded as `contributor`;
  `author` does not change.

## A complete, valid example

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

## Test it before you open the PR

```bash
TTM_THEMES=./themes bun run src/cli.ts   # see your theme in the picker, live
```

## PR title

A theme contribution does not ship code, so it must not trigger an npm
release. Use the `theme:` commit type:

```
theme: add Catppuccin Latte
```

(See `CONTRIBUTING.md` for the full Conventional Commits convention this
repository follows.)
