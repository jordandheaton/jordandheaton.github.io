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
# --scene rev3 is the continuous-session chain (s11-s16) the CURRENT myplanBYU
# composition reads; --scene all is the legacy s1-s10 set (older cuts only)
python showcase-videos/capture/capture_myplan.py --scene rev3
python showcase-videos/capture/capture_tests.py
python showcase-videos/capture/capture_scroller.py
powershell -NoProfile -ExecutionPolicy Bypass -File showcase-videos\capture\explode_clips.ps1

# component selftests (29 checks)
powershell -NoProfile -ExecutionPolicy Bypass -File showcase-videos\render\selftest.ps1

# myplanBYU audio premix: keyboard clicks synced to the URL type-ins, mixed
# under Static Rhythm. The frame lists below match the committed composition;
# if you retime beats 1 or 10, re-derive them (browserbar types linearly over
# p 0.12-0.85 of its track window; outro typewriter over its TA..TB window).
cd showcase-videos/render
python build_myplan_audio.py --music ../music/myplan.mp3 --clicks "24,29,34,40,45,51,56,61,67,72,78,83,88,94,99,105,110,115,121,126,132,137,142" --clicks2 "3262,3266,3269,3273,3276,3280,3283,3286,3290,3293,3297,3300,3304,3307,3311,3314,3318,3321,3325,3328,3331,3335,3338,3342,3345,3349" --fps 60 --out ../music/myplan-mix.wav
cd ../..

# renders (myplanBYU: 56s continuous cut, crf 28 to stay <=10MB; scroller 35s at crf 27)
python showcase-videos/render/render.py ../compose/myplanbyu.html --out ../dist/myplanbyu-showcase.mp4 --crf 28 --music ../music/myplan-mix.wav
python showcase-videos/render/render.py ../compose/scroller.html --out ../dist/universe-scroller-process.mp4 --crf 27 --music ../music/scroller.mp3

# QC gate (strict: requires AAC audio + duration sync in both files)
python showcase-videos/render/qc.py
```

## Gotchas

- After re-capturing myplanBYU, re-inline the event JSONs + test totals into `compose/myplanbyu.html` (PowerShell snippets in the plan's Task 7).
- Scroller uses `--crf 27` to stay ≤10 MB; render times ~20 min each (~45 ms/frame virtual-time stepping).
- `.ps1` files must stay ASCII-only; PowerShell 5.1 reads BOM-less files as ANSI.
- Frame intermediates must never live inside the OneDrive tree — all captured and render frames route to `%TEMP%\showcase`.
- The scroller pipeline's source media (`Universe scroller/draft-test/` clips + anchors, and since Revision 7 `Universe scroller/media/` — the real project clips/anchors used in the generation, stitch, and outro beats) is deliberately gitignored and exists only on this machine — a re-render elsewhere needs those files copied in first.
- Posters need no regeneration after an audio-only re-render — captured frames are deterministic and unaffected by the music mux.
- The music MP3s (`music/*.mp3`) are gitignored — the Pixabay Content License allows use in the videos but not redistributing the raw tracks, so a fresh clone must re-download them from the source URLs in `music/LICENSE.md` before rendering with `--music`.
- After re-capturing myplanBYU, the event re-inline step covers the SIX blocks the current composition uses: s11-s16 (plus TEST_TOTALS).
- Beat 6's seat counts come from the live `/sections` endpoint during capture — numbers will differ between capture runs; that's expected and fine.
