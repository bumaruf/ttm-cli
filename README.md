<h1 align="center">ttm</h1>

<p align="center">
  <b>t</b>erminal <b>t</b>heme <b>m</b>anager
</p>

<p align="center">
  <i>Pick a terminal theme by seeing it, not by reading its name.</i>
</p>

<!-- Tags -->

<p align="center">
  <a href="https://github.com/bumaruf/ttm-cli/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/bumaruf/ttm-cli/actions/workflows/ci.yml/badge.svg">
  </a>
  <a href="https://www.npmjs.com/package/@bumaruf/ttm-cli">
    <img alt="npm" src="https://img.shields.io/npm/v/@bumaruf/ttm-cli?label=npm&color=ffffff&labelColor=000000">
  </a>
  <img alt="License" src="https://img.shields.io/static/v1?label=license&message=MIT&color=ffffff&labelColor=000000">
</p>

<!-- Banner -->

<p align="center">
  <img alt="ttm" src="demo.gif" width="100%">
</p>

<!--
Re-record with: bun run build && vhs demo.tape
The GIF goes through ttyd, which ignores OSC 11, so the background doesn't
change on screen. In a real GNOME Terminal the whole window repaints.
-->

## 💻 Project

`ttm` — short for **terminal theme manager** — is a TUI for picking a GNOME Terminal color theme, built on one idea: **the window running it is the preview.**

As you move through the list, `ttm` repaints the terminal you're sitting in — live — with the real colors of the highlighted theme. Nothing is written to disk while you browse. Press `Esc` and the window snaps back to exactly how it looked before, as if nothing happened. Press `Enter` and the theme is applied for real, with the window already showing it — no reopening anything.

Choosing a color scheme is a visual task. A list of names is the worst possible way to do it.

## 🚀 How to run

```bash
# npm (requires Bun)
npm i -g @bumaruf/ttm-cli

# prebuilt binary — self-contained, no runtime needed
curl -fsSL https://github.com/bumaruf/ttm-cli/releases/latest/download/ttm-linux-x64 -o ttm
chmod +x ttm
sudo mv ttm /usr/local/bin/ttm

# Debian/Ubuntu
sudo dpkg -i ttm_<version>_amd64.deb
```

The command is `ttm` however you install it. Run it with no arguments to open the picker:

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move through the list, repainting the window live |
| type | Filter the list (fuzzy, case-insensitive) |
| `Backspace` | Delete a character from the filter |
| `Enter` | Apply the highlighted theme and exit |
| `Esc` / `Ctrl-C` | Cancel, restore the original colors, and exit |

Subcommands, for scripting or checking state without the picker:

```
ttm                 open the picker
ttm list            list available themes
ttm current         print the active theme
ttm apply <name>    apply a theme by name
ttm --help          show this help
```

## ⚙️ Configuration

A theme is a single TOML file in `themes/`. Drop one in and it shows up in the picker — no code changes needed. Here's `themes/nord.toml` in full, as a template:

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

`palette` is the 16-color ANSI palette (colors 0–15, in order). `background` and `foreground` are the default pane colors.

Point `TTM_THEMES` at a directory to use your own catalogue instead of the built-in one.

## 🖌 How it works

While the picker is open, moving the selection sends **OSC 4** escape sequences to set the 16 palette colors and **OSC 10/11** to set the foreground and background — straight to the terminal you're running `ttm` in. That's the whole trick: the preview isn't a rendering of the theme, it's the actual terminal repainting itself. Nothing touches disk. Cancel, and `ttm` sends the original colors back — flip through ten themes and leave no trace.

Press `Enter` and `ttm` writes the theme into GNOME Terminal's dconf settings and makes it the default profile — while deliberately *not* resetting the window's colors. The window is already showing what you picked, so the change appears to take effect instantly, everywhere, without reopening a single terminal.

### Compatibility

GNOME Terminal today (VTE-based terminals that honor dconf profiles and OSC 4/10/11). Another emulator means implementing the `Backend` interface in [`src/backend.ts`](src/backend.ts):

```ts
export interface Backend {
  list(): Promise<string[]>;
  current(): Promise<string | null>;
  apply(theme: Theme): Promise<void>;
}
```

Nothing else in the codebase needs to change — the picker, the live preview, and the theme format are all backend-agnostic.

## 🔥 Contribute

**Adding a theme needs no code at all**: copy `themes/nord.toml`, change the colors, open a PR. That's the whole contribution.

```bash
bun install     # also installs the git hooks
bun test
bun run lint
bun run typecheck
bun run build
```

`ttm` has zero runtime dependencies. TypeScript, run and built with [Bun](https://bun.sh), compiled to a standalone binary via `bun build --compile`.

Everything that decides behavior is a pure function, and the single module that touches the terminal is kept small on purpose — so a change can be reviewed by someone who didn't write it. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

This project is under an MIT license. See [LICENSE](LICENSE) for more details.

---

<!-- Footer -->
Developed by [Otávio Bumaruf](https://github.com/bumaruf).
