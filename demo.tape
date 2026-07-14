# Record with: bun run build && vhs demo.tape
# (vhs: https://github.com/charmbracelet/vhs — needs ttyd and ffmpeg)
#
# Runs the compiled binary, since `ttm` is not on vhs's PATH.
# The tape ends by applying Nord, which is a no-op if Nord is already the
# default profile — recording this must not silently change your setup.
Output demo.gif
Set FontSize 22
Set Width 1400
Set Height 560
Set Padding 30
Set Shell bash

Hide
Type "PS1='$ '; clear"
Enter
Show

Type "./dist/ttm"
Enter
Sleep 1s
Down
Sleep 900ms
Down
Sleep 900ms
Down
Sleep 900ms
Type "nor"
Sleep 1s
Enter
Sleep 2s
