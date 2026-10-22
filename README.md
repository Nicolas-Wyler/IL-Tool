# IL Tool

Interference lithography visualizer with linked wave/grating parameters, coherent field views, mask layout, playback, and Save/Load.

[Open IL Tool](https://nicolas-wyler.github.io/IL-Tool/)

Install from Chrome, or use Safari → Share → Add to Home Screen on iPhone. Open once online to cache the app; it then runs offline. On iPhone, Save uses the share sheet or Downloads; Load opens Files.

Run locally: `python3 serve_local.py` → <http://127.0.0.1:8769/>. Saved edits refresh the local app automatically. Pushes to `main` deploy to GitHub Pages.

Shortcuts: Cmd/Ctrl+S saves; Cmd/Ctrl+O loads. Cmd/Ctrl+C/V/X/D copies/pastes/cuts/duplicates checked rows. Available updates appear beside the title.

Check: `for test in tests/*.test.mjs; do node "$test" || exit; done`.
