# Showcase Videos — Design

**Date:** 2026-08-08
**Status:** Approved (brainstorm complete)

## Purpose

Two short recruiter-facing showcase videos for the featured portfolio projects,
distributed on two surfaces: embedded in each project's portfolio story card,
and posted natively to LinkedIn. Muted-autoplay is the primary viewing mode on
both surfaces, so the videos narrate themselves with kinetic text overlays —
no voiceover.

## Deliverables

| File | Content | Length |
|------|---------|--------|
| `showcase-videos/dist/myplanbyu-showcase.mp4` | Optimizer, insights panel, weekly scraper, test harness | ~30–40s |
| `showcase-videos/dist/universe-scroller-process.mp4` | Image → AI video → stitch → scroll-scrub process story | ~30–40s |

**Specs (both):** 1920×1080 (16:9), 60fps, H.264 + AAC, target ≤10 MB each.
Text overlays legible at ~400px feed width. Music: CC0/royalty-free — Claude
shortlists 2–3 tracks during implementation, Jordan picks; the license note is
stored next to the track in `showcase-videos/music/`.

Also delivered: portfolio embed wiring (below) and a two-line suggested
LinkedIn caption per video. LinkedIn posting itself stays manual.

## Production architecture ("the video factory")

Everything is code-built and re-renderable — no screen recording sessions, no
video editor. New top-level folder:

```
showcase-videos/
  capture/    scripts that drive the real apps headlessly and save raw clips
  compose/    one HTML motion-graphics timeline page per video
  render/     frame-step capture + ffmpeg encode scripts
  dist/       final MP4s (committed; referenced by index.html)
  music/      chosen track + its license note (committed)
  raw/        captured source clips (gitignored)
```

Bulk frame intermediates (capture frames and render frames, thousands of
files) never touch this tree — they go to a local temp directory outside
OneDrive. `raw/` holds only the assembled capture clips.

**Capture** (raw material, all deterministic):
- **myplanBYU UI beats** — headless Chrome via CDP against the existing local
  server (`myplanBYU/.claude/serve.ps1` / `launch.json`): scripted wizard run
  (pick major/minor → solve), semester board fill, insights panel scroll
  (warnings → recommendations → opportunities incl. study abroad and
  scholarships). The driver script emits an **interaction event log** (move /
  click / type, with timestamps and coordinates) alongside the frames; the
  compositor replays that log as a visible on-screen cursor, so the pointer
  and the UI reaction always agree.
- **Test harness beat** — drive `myplanBYU/tests/index.html` headlessly,
  capture the invariants cascading green.
- **Scraper beat** — a styled HTML terminal-replay component fed real lines
  from `myplanBYU/scraper/run.log` and the health report. Authentic output,
  crisp type, no live scrape on camera.
- **Scroller beats** — existing artifacts in `Universe scroller/draft-test/`
  (anchor stills, generated Higgsfield clips, stitched cuts) plus a scripted
  scrub of the live scroller captured with the established headless-Chrome CDP
  harness. No Higgsfield UI footage (approved decision).

**Compose:** each video is an HTML timeline page in the portfolio's design
language — `<video>`/`<img>`/frame-sequence layers plus text animations,
advanced frame-by-frame on a virtual clock (the same technique the Scroller
itself uses). No wall-clock playback during capture, so every frame is
pixel-deterministic.

**Render:** stepped frames → ffmpeg → H.264 MP4, then AAC music mux. Working
frames are written to a local non-synced temp directory (never inside the
OneDrive tree) to avoid sync churn; only final MP4s land in the repo.
`showcase-videos/raw/` and all intermediate frames are gitignored.

## Style references & interaction feel

Three reference videos (local files in `C:\Users\jorda\Downloads\`, commercial
templates — reference only, never committed):

- *SaaS Demo Video Example for Fintech Companies — Zelios* — the primary
  model for the myplanBYU video: real product UI presented in a softly-lit
  3D-tilted screen frame with glow, an **animated cursor that visibly moves,
  hovers, and clicks** while the UI responds, form fields that type
  themselves with a caret, punch-in zooms on key moments, and a big rounded
  payoff badge (their "Payment approved" moment).
- *Portfolio Website Showcase Video — Indra Ibrahim* — full-page screens
  gliding through frame, bold typewriter title cards, URL intro card.
- *Website Design Showcase Promo Video — Indra Ibrahim* — dark variant:
  device mockups fanned in 3D space, large display-type section titles.

**Cursor requirement (myplanBYU):** the app beats must read as a person
driving the product — cursor easing along curved, human-feeling paths with
slight acceleration/overshoot, press animation + subtle ripple on click, and
visible typing in the wizard. Cursor artwork in the style of the Zelios
pointer/hand. Music and kinetic text overlays continue over these beats
exactly as designed; the cursor replaces none of the text narration.

## Beat sheets

### myplanBYU (~35s)

| Time | Beat | On screen | Overlay copy (draft) |
|------|------|-----------|----------------------|
| 0–4s | Hook | Board materializing | "170+ majors. Every prereq. One optimized plan." |
| 4–12s | Optimizer | **Cursor-driven:** wizard clicks + typed input → solve → semester board fills, flags resolve; payoff pill on solve | Constraint solver: prereqs, cohort blocks, credit caps |
| 12–19s | Insights panel | **Cursor-driven:** scroll + hover through warnings → recommendations → opportunities, punch-in zooms | Study abroad, scholarships, clubs — surfaced per plan |
| 19–26s | Weekly scraper | Terminal montage: 12 sources, health report, quarantine gate | "A broken scrape can't reach the live site" |
| 26–31s | Test harness | Browser invariants cascading green | In-browser test harness — zero dependencies |
| 31–35s | Outro | Logo/URL | `jordanheaton.com/myplanBYU` + tagline |

### Universe Scroller process (~35s)

| Time | Beat | On screen | Overlay copy (draft) |
|------|------|-----------|----------------------|
| 0–4s | Hook | Finished scroller scrubbing fast, city → space | "One continuous zoom. 1,445 frames." |
| 4–11s | Anchors | City / earth / moon stills line up | "Direct a still image at each scale" |
| 11–19s | Generation | Real Higgsfield clips bridge each anchor pair, seams highlighted | "AI video bridges each pair" |
| 19–28s | Stitch & scrub | Stitched cut explodes into the frame grid; scroll position drives playback | "Color-match, stitch, precompute — scroll drives the film" |
| 28–35s | Outro | Live site scrubbed by real scroll | `jordanheaton.com` → Universe Scroller |

Overlay copy above is draft; final wording is tuned during implementation to
match the portfolio's writing voice (personal, plain-spoken).

## Portfolio integration

Each project's story card in `index.html` gets a `<video>` block:
`muted playsinline`, poster frame, lazy-loaded, autoplays when the story
opens, pauses when it closes, click toggles sound. Same asset serves LinkedIn
unchanged.

## Verification

- Two consecutive renders of the same timeline produce identical frame counts
  and visually identical spot-check frames (determinism check).
- Duration within 30–40s; file size ≤10 MB; H.264 + AAC (LinkedIn-compatible).
- Text legibility reviewed via zoomed screenshots at ~400px width.
- Embedded playback verified with the hidden-pane verification recipe
  (manual tick + screenshot), since the browser pane throttles rAF.

## Revision 1 — ad-style myplanBYU cut (2026-08-09, Jordan's review)

Jordan approved the first cuts and requested a myplanBYU redesign; the
Scroller video is unchanged apart from its music. Direction: **Apple-ad
energy** — pop-ins instead of drifts, faster text, hard cuts, zoom-ins onto
real UI, two new feature beats, and a movie-credits skills ending. New
references (local, never committed): *Website Design Presentation Video —
Indra Ibrahim* (site slams in at an angle, circle/shape wipes between
sections, callout labels pointing at UI details, stat chips) plus the
existing Zelios demo.

Music (picked by Jordan from the shortlist): myplanBYU → "Static Rhythm (The
Tech House)" by 9JackJack8; Scroller → "Ambient Space Cinematic Music"
(build-up scenes). Pixabay Content License; files + license note in
`showcase-videos/music/`.

### Revised myplanBYU beat sheet (still 2100 frames / 35s @60fps — dense)

| Frames | Beat | On screen |
|--------|------|-----------|
| 0–150 | Hook slam | Title pops word-by-word FAST; site frame POPS in (outBack scale, ~10 frames), settles to resting tilt |
| 150–450 | Optimizer speedrun | s1 excerpt at ~2× (seq srcFps trick), zoom-callout on the completed-coursework wizard step: "import your classes"; solve → board slams full + payoff pill |
| 450–690 | Insights punch-zoom | Camera punches INTO the panel region while accordions open; caption pops: warnings, scholarships, study abroad — matched to this plan |
| 690–930 | Course modal (NEW) | Cursor clicks a course card → `#courseModal` pops → zoom onto the "Fall 2026 sections · live seat counts" region (new capture s4) |
| 930–1170 | AI advisor (NEW) | Chat opens, question types fast, a REAL answer from the saved eval transcripts streams into the real chat UI (new capture s5); callout: grounded AI advisor |
| 1170–1440 | Scraper gate | Terminal replay, faster type-on; rejection gate line |
| 1440–1650 | Tests | Report wipe + 26/26 counter, faster |
| 1650–1950 | Skills credits | Movie-credits roll: ~8 real skills pop one after another (constraint modeling & heuristic search · vanilla JS zero deps · 12-source data pipeline + health gates · LLM grounding + injection evals · in-browser test harness · headless-Chrome automation · …) |
| 1950–2100 | Outro pop | URL + tagline slam in |

Motion language: outBack pop-ins (8–12 frames), accent-color circle wipes
between beats, callout labels (line + chip pointing at the UI element),
hard cuts on beat boundaries. Cursor still visibly drives all app beats.

New captures: **s4** course-modal scene, **s5** advisor scene (transcript
replayed into the live chat DOM — deterministic, authentic content from
`myplanBYU/scraper/eval/transcript_*.md`). Existing s1/s2/s3 frames are
reused; speed changes happen in the compositor via seq srcFps.

## Out of scope

- Voiceover (a VO pass can be layered later without redesign)
- Higgsfield UI capture or re-recording
- Vertical/square crop variants
- Automated LinkedIn posting

## Risks / notes

- OneDrive sync churn on thousands of frame files → all intermediates go to a
  local temp dir outside the synced tree.
- Repo growth: two ~10 MB MP4s is in line with existing precedent
  (`assets-3d/hero-walk-4k.mp4`).
- Headless captures show no OS cursor — the compositor's replayed cursor (see
  Style references) is therefore the single source of pointer truth. It must
  stay frame-synced with the captured UI reactions; the shared event log
  guarantees this by construction.
