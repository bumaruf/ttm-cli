# Security Policy

## Reporting a vulnerability

Report privately through
[GitHub Security Advisories](https://github.com/bumaruf/ttm-cli/security/advisories/new).
Please don't open a public issue for a vulnerability.

You can expect an initial response within a week.

## What counts as a vulnerability here

`ttm` has no network surface and no runtime dependencies, but it does two things
that deserve scrutiny:

- **It writes escape sequences to your terminal.** Terminal escape sequences are
  a real injection vector — a crafted string reaching the terminal unescaped can
  do more than change colors. `src/osc.ts` validates every color before emitting
  it, precisely so a malformed or hostile theme file cannot break out of the
  sequence it belongs to. A way around that validation is a vulnerability.

- **It writes to dconf**, changing GNOME Terminal profiles. Values are quoted as
  GVariant literals in `src/gnome.ts`. A theme name or color that escapes that
  quoting and injects into the command is a vulnerability.

If you find a theme file — or any input — that reaches either of those without
being validated, please report it.

## Supported versions

The latest released version. This is a small project with one maintainer; fixes
go into a new release rather than being backported.
