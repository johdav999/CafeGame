# Browser sound activation

The pinned engine adapter creates an AudioContext and immediately suspends it,
including when called from activate(). On the tested Windows Chromium host, a
resume immediately following that initial suspension remains pending. The game
then has loaded sound assets but never starts its voices.

`tools/stage-audio.cmake` applies a narrow compatibility fix while staging the
engine adapter: activate() requests context creation without that initial
suspension. Other creation paths still start suspended. Normal shift pause and
visibility suspension remain unchanged. The engine source and revision are not
modified. Staging fails explicitly if the expected engine code changes.

The presentation resumes audio synchronously on click or keydown. A visible
Enable sound button appears while blocked, muted, or at zero effects volume.
Menu > Sound & accessibility includes Test sound. Testing unmutes effects and
restores their default level if zero; it does not change a nonzero chosen volume.

`tools/audio-output-smoke.cjs` exercises first-gesture activation and the output
graph. A running context whose clock remains at zero indicates an unavailable
test audio device; it does not establish speaker playback.
