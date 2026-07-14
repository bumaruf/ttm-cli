<!--
The PR title must follow Conventional Commits — it becomes the commit on main
and feeds the changelog. e.g. "fix: restore the cursor when apply fails"
-->

## What this changes

<!-- One or two sentences. Why, not just what. -->

## How you know it works

<!--
Not "tests pass" — what did you actually observe? If it touches the TUI, say
what you saw in a real terminal window.
-->

---

- [ ] A test covers this change (a failing-first test, if it's a bug fix)
- [ ] `bun test` is green
- [ ] `bun run lint` and `bun run typecheck` are clean
- [ ] The PR is one change — nothing unrelated bundled in

<!--
Adding a theme? None of the above needs code: a .toml in themes/ is the whole
PR. Just confirm you took the colors from the theme's official palette.
-->
