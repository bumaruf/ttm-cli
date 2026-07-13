#!/usr/bin/env bash
# Packages the already-compiled binary (dist/ttm) into a .deb.
#
# The compiled binary is self-contained: `bun run build` embeds the theme
# catalogue into it (see scripts/generate-builtin.ts), so the package only
# needs to install the executable to /usr/bin. No /usr/share/ttm/themes
# directory is installed — nothing reads from it, so shipping it would be
# dead weight. Users who want to override the built-in themes can still
# point TTM_THEMES at a directory of their own .toml files.
#
# Usage: packaging/deb/build.sh <version>
set -euo pipefail

version="${1:?usage: build.sh <version>}"
root="$(mktemp -d)"

install -Dm755 dist/ttm "$root/usr/bin/ttm"

mkdir -p "$root/DEBIAN"
cat > "$root/DEBIAN/control" <<EOF
Package: ttm
Version: $version
Section: utils
Priority: optional
Architecture: amd64
Depends: dconf-cli, libglib2.0-bin
Maintainer: Otávio Bumaruf <otaviobumaruf@gmail.com>
Description: Pick a terminal theme and see it live in your own window
 A TUI for choosing GNOME Terminal color themes, repainting the current
 window live as you browse. Uses dconf and gsettings to read and write
 GNOME Terminal profiles.
EOF

dpkg-deb --build --root-owner-group "$root" "ttm_${version}_amd64.deb"
echo "built ttm_${version}_amd64.deb"
