# Implementation report — feat/theme-contribution

PR: https://github.com/bumaruf/ttm-cli/pull/11
Branch: `feat/theme-contribution` (pushed, tracking `origin`)

All 8 tasks from `docs/superpowers/plans/2026-07-14-theme-contribution.md`
were executed in order, strict TDD (failing test confirmed, then
implementation, then green, then commit). Final state: `bun test` (115 pass,
0 fail), `bun run lint` (clean), `bun run typecheck` (clean) before every
commit.

---

## Task 1 — metadata fields on `Theme`

- Added `author?`, `contributor?`, `source?`, `license?` to the `Theme`
  interface and to `parseTheme()` in `src/theme.ts`, exactly as specified.
- Test added to `tests/theme.test.ts` (3 new tests): metadata parses when
  present, metadata is optional (existing catalogue unaffected), wrong type
  is rejected naming the field.
- Confirmed failing first:
  ```
  Expected: "@fulano"
  Received: undefined
  ```
- Implemented, then `bun test`, `bun run typecheck` green.
- Ran `bun run generate-builtin`; diff was empty as predicted (no theme file
  had metadata yet).
- Commit: `20b0f28 feat(theme): add optional provenance and credit metadata`

## Task 2 — `src/contrast.ts` (WCAG)

- Added `relativeLuminance()` and `contrastRatio()`, verbatim per plan.
- `tests/contrast.test.ts` (7 tests) written first; confirmed failing
  (`Cannot find module '../src/contrast'`).
- Implemented; all 7 pass. One lint warning appeared
  (`suppressions/unused` on a `biome-ignore` comment — the
  `noNonNullAssertion` rule isn't enabled in this repo's config, so the
  suppression comment had nothing to suppress). Removed the now-unnecessary
  comment rather than keep dead lint-ignore text; this is the only deviation
  from the plan's literal code in this task, and it's cosmetic.
- Commit: `d0d1f3e feat(contrast): add WCAG contrast so unreadable themes can be caught`

## Task 3 — metadata for the 10 existing themes

Added `author = "@bumaruf"`, `contributor = "@bumaruf"`, `source`, and
`license = "MIT"` to all 10 files in `themes/`, right below `name`, using the
exact source URLs listed in the plan. License: I did not have network access
to re-verify each upstream repository's LICENSE file in this sandboxed
environment; all ten of these upstream palettes (Catppuccin, Dracula,
Everforest, Gruvbox, Kanagawa, Nord, One Dark/Atom, Rosé Pine, Solarized,
Tokyo Night) are, to the best of available knowledge, MIT-licensed — this
matches the plan's own suggestion ("a maioria é MIT"). **Flagging for the
maintainer to double check** each license field against the live upstream
repo before merge, since I could not fetch them to confirm.

Ran `bun run generate-builtin` — `src/builtin-themes.ts` now carries the
metadata; `bun test && bun run lint && bun run typecheck` green.

### Contrast check of the 10 existing themes (Step 2 output, verbatim)

```
Catppuccin Mocha     fg/bg 11.34  worst palette 1.80  <-- FAILS
Dracula              fg/bg 13.36  worst palette 1.11  <-- FAILS
Everforest Dark      fg/bg 7.38  worst palette 1.15  <-- FAILS
Gruvbox Dark         fg/bg 10.75  worst palette 1.00  <-- FAILS
Kanagawa             fg/bg 11.26  worst palette 1.22  <-- FAILS
Nord                 fg/bg 9.25  worst palette 1.24  <-- FAILS
One Dark             fg/bg 6.57  worst palette 1.00  <-- FAILS
Rose Pine            fg/bg 13.39  worst palette 1.16  <-- FAILS
Solarized Dark       fg/bg 4.75  worst palette 1.00  <-- FAILS
Tokyo Night          fg/bg 10.59  worst palette 1.05  <-- FAILS
```

**All 10 pass the foreground/background 4.5:1 rule** (lowest is Solarized
Dark at 4.75). **All 10 fail the palette 3:1 rule** — every one has at least
one ANSI color (almost always `color0`, the "black" slot, sometimes also
`color8`/"bright black") that sits very close to the theme's own background,
by design (that's how a terminal black looks natural against a matching
background). Worst offenders: Gruvbox Dark, One Dark, Solarized Dark, Tokyo
Night all bottom out at ~1.00–1.05:1 (i.e. essentially invisible against
their own background).

**I did not adjust any theme's colors.** Per the plan's explicit
instruction, this decision belongs to the maintainer: exempt `color0`/`color8`
from the palette check, lower/relax the palette threshold, or accept that the
core catalogue currently fails its own new gate (which would need to be
special-cased somehow, e.g. grandfather the 10 existing files, or accept they
won't pass `check-themes.ts` if it's ever run against them).

Commit: `413fa17 chore(themes): add provenance and credit to the existing catalogue`

## Task 4 — `scripts/check-themes.ts` (the gate)

- Wrote `tests/check-themes.test.ts` (12 tests) and `scripts/check-themes.ts`
  per the plan.
- Confirmed the test failed first (module not found).
- **Deviation, and why:** the plan's own `PALETTE` test fixture (Nord's real
  ANSI colors, including `color0 = "#3b4252"` and `color8 = "#4c566a"`) hits
  exactly the Task-3 trap inside a *unit test*: those two colors score
  1.24:1 and 1.69:1 against Nord's own background (`#2e3440`), so the
  verbatim "a well-formed new theme passes" and "an update that keeps the
  author passes" tests could never pass under the exact 3:1 rule the plan
  itself mandates — regardless of implementation correctness (verified this
  against the already-tested, already-passing `contrastRatio()` from Task 2).
  I fixed this by editing only the **test fixture** (not the gate's logic or
  its thresholds): replaced indices 0 and 8 in the fixture's `PALETTE` array
  with `"#7b83a8"` (a color that clears 3:1 against the same background),
  and changed the fixture's default `background`/`foreground` from the
  original swapped-light pairing (`#eceff4`/`#2e3440`, which was internally
  inconsistent with a palette built for a dark background) to Nord's actual
  dark pairing (`#2e3440`/`#d8dee9`). This is documented with a code comment
  in the test file. The gate's rules and exact thresholds (4.5 / 3.0) were
  **not** changed — only a synthetic fixture was made internally consistent.
- After the fixture fix, all 12 tests pass unmodified against the plan's
  `checkThemes()` implementation (used verbatim).
- `bun run lint:fix` applied formatting-only changes (multi-line `fail()`
  calls, one-per-line array) — no logic changed.
- Commit: `25f9b15 feat(ci): add the theme gate — structure, provenance, credit and contrast`

## Task 5 — `scripts/render-theme-preview.ts`

- `tests/render-theme-preview.test.ts` (3 tests) written first, confirmed
  failing (module not found), then `renderPreview()`/`renderDiffPreview()`
  implemented verbatim. All 3 pass.
- Manually rendered a real theme's preview (`bun -e ...` per plan Step 5) to
  `/tmp/preview.md` and inspected the HTML structure — sensible: a
  foreground-on-background sample line, a 16-cell swatch table, and the
  metadata line with author/contributor/license/source.
- Commit: `521c5a6 feat(ci): render a visual preview of a theme for the PR comment`

## Task 6 — the gate workflow

- Added `scripts/theme-check-ci.ts` (entrypoint) and
  `.github/workflows/theme-check.yml`, verbatim per plan, using
  `actions/checkout@v7` to match this repo's existing workflows (`ci.yml`
  uses v7, not the plan's v4 — kept consistent with repo convention).
- **Local gate test (Step 3), done for real:** created
  `themes/broken-test.toml` (background `#000000`, foreground `#0a0a0a`,
  16 near-black palette colors), staged it, and ran the entrypoint. First
  attempt with only `git add` (no commit) produced "no theme files changed"
  because `git diff --name-status BASE HEAD` compares commits, not the
  index — so I made a temporary local commit, ran the check against
  `HEAD~1`, confirmed exit code 1 with contrast ratios and field names in
  every error line, then `git reset --soft HEAD~1` and deleted the test
  file, leaving the working tree clean (verified via `git status --porcelain`).
  This was local-only verification, not a real PR to GitHub Actions — no
  network call was made.
- Commit: `d81b51a ci: gate theme PRs on structure, contrast and provenance, with a visual preview`

## Task 7 — `THEME_SPEC.md`

- Wrote `THEME_SPEC.md`: file/slug rule, all fields with types and examples,
  every gate rule with exact numbers, the "variant vs. fix" guidance, a full
  valid Nord example, and the local-testing command.
- Updated `CONTRIBUTING.md` "Adding a theme" section to link to
  `THEME_SPEC.md`, mention the CI gate validates contrast, and note the
  `theme:` PR-title convention (pulled forward from Task 8 for a single
  coherent edit to that file). Also added `theme` to the commit-type list
  in the "Commit and PR titles" section.
- Updated `.github/ISSUE_TEMPLATE/new-theme.yml` to link `THEME_SPEC.md`.
- Commit: `2ba702a docs: add THEME_SPEC.md, the contract a theme PR must satisfy`

## Task 8 — theme commits don't trigger a release

- Added `{ "type": "theme", "section": "Themes", "hidden": true }` to
  `release-please-config.json`'s `changelog-sections` (same treatment as
  `chore`: hidden, no version bump).
- Added `theme` to the `types` list in
  `.github/workflows/pr-title.yml`'s `amannn/action-semantic-pull-request`
  config.
- Documentation of the `theme:` title convention was already added to
  `THEME_SPEC.md` and `CONTRIBUTING.md` in Task 7.
- `bun test`, `bun run lint`, `bun run typecheck` all green.
- Commit: `9a4d843 ci: add a theme commit type that does not trigger a release`

Pushed `feat/theme-contribution` to `origin` and opened
**PR #11: https://github.com/bumaruf/ttm-cli/pull/11**, titled
`feat: accept theme contributions safely`.

---

## Deviations summary

1. **Task 2:** removed one dead `biome-ignore` suppression comment (cosmetic,
   caused a lint warning; no logic change).
2. **Task 4:** fixed the `check-themes.test.ts` fixture (palette colors 0/8
   and the default background/foreground pairing) so it is internally
   contrast-consistent. The gate's implementation and thresholds are
   unchanged from the plan; only the synthetic test data was corrected. This
   was necessary because the plan's literal fixture (Nord's real palette
   against a swapped light-background pairing) could never satisfy the
   plan's own 3:1 rule, for the same underlying reason flagged in Task 3.
3. **Task 6:** used `actions/checkout@v7` (matching this repo's existing
   `ci.yml`) instead of the plan's `@v4`.
4. **Task 3 license fields:** could not access the network to re-verify each
   upstream license in this sandbox; used MIT for all 10 based on prior
   knowledge, consistent with the plan's own guidance. Flagged above for
   maintainer confirmation before merge.

## Concerns for the maintainer

- **All 10 existing themes fail the new palette-contrast gate.** If
  `check-themes.ts` is ever run against the existing catalogue files
  (e.g. if someone edits `themes/nord.toml` and CI treats it as
  "modified"), it will currently report contrast failures on the untouched
  ANSI black slot. The gate as built does not special-case this. A decision
  is needed: exempt indices 0/8, lower the palette threshold, or accept that
  editing an existing file will always additionally require fixing its
  color0/8 (which the maintainer previously said not to silently do).
- **License fields for the 10 themes are asserted from memory, not verified
  live** — worth a quick pass before merge.
