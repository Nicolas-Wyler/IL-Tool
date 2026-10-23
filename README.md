# IL Tool

Interference lithography visualizer with linked wave/grating parameters, coherent field views, mask layout, playback, and project export/import.

[Open IL Tool](https://nicolas-wyler.github.io/IL-Tool/)

Install from Chrome, or use Safari → Share → Add to Home Screen on iPhone. Open once online to cache the app; it then runs offline. Load opens an exported ZIP and restores the project inside; standalone project files also work. Export downloads a named ZIP with the project, vector mask, four PNG views, raw CSV matrices, and coordinates.

Run locally: `python3 serve_local.py` → <http://127.0.0.1:8769/>. Saved edits refresh the local app automatically. Pushes to `main` deploy to GitHub Pages.

Shortcuts: Cmd/Ctrl+S exports; Cmd/Ctrl+O loads. Cmd/Ctrl+C/V/X/D copies/pastes/cuts/duplicates selected rows. Available updates appear beside the title.

Check: `for test in tests/*.test.mjs; do node "$test" || exit; done`.

## Installing alongside other GitHub Pages apps

This app has a unique, stable manifest ID (`/IL-Tool/`) so Chrome can install it separately from other apps on `nicolas-wyler.github.io`. If an older installation opens the wrong app, open this project’s hosted URL and install it again after the update. Keep existing browser data and export important projects before removing any old shortcut; do not clear site storage, which is shared by apps on this origin.
