# showcase-videos

Code-built recruiter showcase videos where every frame is a pure function of frame index. The three-stage pipeline—capture (headless Chrome), compose (frame-addressed HTML timelines), and render (stepped frames → MP4)—produces deterministic, re-renderable 60fps videos from live app interactions. Spec at `docs/superpowers/specs/2026-08-08-showcase-videos-design.md`; plan at `docs/superpowers/plans/2026-08-08-showcase-videos.md`.

## Layout

- `tools/` — stdlib CDP harness (`cdp.py`) for headless Chrome control with virtual-time frame stepping
- `capture/` — scene drivers (`capture_myplan.py`, `capture_tests.py`, `capture_scroller.py`) that emit headless frame sequences + interaction event logs
- `compose/` — frame-addressed HTML timelines (`myplanbyu.html`, `scroller.html`) with cursor, text FX, terminal components; every frame rendered on demand via `window.__seek(f)`
- `render/` — harness that steps compositor pages frame-by-frame, screenshots each frame, and ffmpeg encodes to MP4; includes QC validator
- `dist/` — final MP4s, poster frames, LinkedIn captions
- `music/` — chosen track + license (selected during implementation)
- `raw/` — gitignored; holds captured source clips

## Full re-render from scratch

Run these commands in order. Captured frames land in `%TEMP%\showcase`, never in the repo.

```
# captures (frames land in %TEMP%\showcase, never in the repo)
python showcase-videos/capture/capture_myplan.py --scene all
python showcase-videos/capture/capture_tests.py
python showcase-videos/capture/capture_scroller.py
powershell -NoProfile -ExecutionPolicy Bypass -File showcase-videos\capture\explode_clips.ps1

# component selftests (23 checks)
powershell -NoProfile -ExecutionPolicy Bypass -File showcase-videos\render\selftest.ps1

# renders (music muxed in; tracks must exist locally — see gotcha below)
python showcase-videos/render/render.py ../compose/myplanbyu.html --out ../dist/myplanbyu-showcase.mp4 --music ../music/myplan.mp3
python showcase-videos/render/render.py ../compose/scroller.html --out ../dist/universe-scroller-process.mp4 --crf 27 --music ../music/scroller.mp3

# QC gate (strict: requires AAC audio + duration sync in both files)
python showcase-videos/render/qc.py
```

## Gotchas

- After re-capturing myplanBYU, re-inline the event JSONs + test totals into `compose/myplanbyu.html` (PowerShell snippets in the plan's Task 7).
- Scroller uses `--crf 27` to stay ≤10 MB; render times ~20 min each (~45 ms/frame virtual-time stepping).
- `.ps1` files must stay ASCII-only; PowerShell 5.1 reads BOM-less files as ANSI.
- Frame intermediates must never live inside the OneDrive tree — all captured and render frames route to `%TEMP%\showcase`.
- The scroller pipeline's source media (`Universe scroller/draft-test/` clips + anchors) is deliberately gitignored and exists only on this machine — a re-render elsewhere needs those files copied in first.
- Posters need no regeneration after an audio-only re-render — captured frames are deterministic and unaffected by the music mux.
- The music MP3s (`music/*.mp3`) are gitignored — the Pixabay Content License allows use in the videos but not redistributing the raw tracks, so a fresh clone must re-download them from the source URLs in `music/LICENSE.md` before rendering with `--music`.
- After re-capturing myplanBYU, the event re-inline step covers s1/s3/s4/s5 (all four EVENTS blocks in `compose/myplanbyu.html`), not just the original two.
