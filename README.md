# IL Tool

Interference lithography visualizer with linked wave/grating parameters, coherent field views, mask layout, playback, and project export/import.

[Open IL Tool](https://nicolas-wyler.github.io/IL-Tool/)

Install from Chrome, or use Safari → Share → Add to Home Screen on iPhone. Open once online to cache the app; it then runs offline. Load opens an exported ZIP and restores the project inside; standalone project files also work. Export downloads a named ZIP with the project, vector mask, four PNG views, raw CSV matrices, and coordinates.

Run locally: `python3 serve_local.py` → <http://127.0.0.1:8769/>. Saved edits refresh the local app automatically. Pushes to `main` deploy to GitHub Pages.

Shortcuts: Cmd/Ctrl+S exports; Cmd/Ctrl+O loads. Cmd/Ctrl+C/V/X/D copies/pastes/cuts/duplicates selected rows. Available updates appear beside the title.

Check: `for test in tests/*.test.mjs; do node "$test" || exit; done`.
