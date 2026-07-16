# Universe Scroller — Design Spec

**Date:** 2026-07-16
**Status:** Approved design, pipeline feasibility proven (see `draft-test/`)
**Location:** `Portfolio/Universe scroller/` — standalone page linked from the portfolio hub

## Overview

A "Powers of Ten"-style scroll experience: the page opens on a single leaf on a tree, and scrolling moves the camera through a continuous cinematic zoom — inward toward the leaf's cells and atoms, or outward toward the whole Earth and eventually the observable universe. All motion happens around one fixed center point (the leaf), in the documentary style of the 1977 Eames film. Scroll position drives playback of a pre-generated AI video journey rendered as a canvas frame sequence.

## Goals

- One seamless, continuous zoom (no visible cuts or morph tricks) across ~24 orders of magnitude.
- Bidirectional: page loads at leaf scale (scroll midpoint); scrolling down zooms out to the universe, scrolling up zooms in to the subatomic.
- Scientific HUD overlay showing live scale (e.g. `10⁻⁹ m — DNA double helix`).
- Ships as a portfolio piece on jordandheaton.github.io, linked from the hub.

## Non-goals

- No real-time 3D/WebGL scene — playback is pre-rendered frames.
- No audio, no narration.
- No mobile-first optimization in phase 1 (desktop experience first; mobile gets the same windowed-loading treatment as the homepage laptop sequence later).

## Content: scale stops

Each adjacent pair of stops is exactly one transition clip, and each jump is **~1 order of magnitude** — the proven limit before the video model starts morph-cheating.

**Zoom-out chain part 1 (leaf → Earth), phase 1 — 9 stops, 8 clips:**
1. Single leaf close-up on a branch (~10 cm) — the page's center anchor
2. Branch with foliage (~1 m)
3. Whole tree (~10 m)
4. Tree in its clearing from above (~100 m)
5. Neighborhood / surrounding landscape (~1 km)
6. Whole town aerial (~5 km) ✅ *style proven in draft-test*
7. Coastal region (~30 km) ✅
8. Orbital view, curvature visible (~300 km) ✅
9. Full Earth (~40,000 km) ✅

**Zoom-out chain part 2 (Earth → universe), phase 2:**
1. Earth–Moon system ✅ *(test 1)*
2. Inner solar system (~10⁸ km)
3. Outer solar system / Kuiper belt
4. Oort cloud / light-year scale
5. Nearest stars
6. Local stellar neighborhood
7. Milky Way
8. Local Group
9. Cosmic web / observable universe

**Zoom-in chain (into the leaf → quark), phase 3:**
1. Leaf surface veins (~1 cm)
2. Leaf microstructure / stomata (~1 mm)
3. Leaf cell layer (~100 µm)
4. Single plant cell interior (~10 µm)
5. Chloroplast / nucleus (~1 µm)
6. DNA coils (~100 nm)
7. DNA double helix (~1-10 nm)
8. Atom / electron cloud (~0.1 nm)
9. Nucleus (~10⁻¹⁴ m)
10. Proton / quarks (~10⁻¹⁵ m)

Exact stop list may be tuned during production; the one-order-per-clip rule is the invariant, not the specific stops.

## Production pipeline (proven 2026-07-16)

1. **Anchor ladder (stills):** generate each scale stop with `nano_banana_pro` (2 cr/image) using the *previous stop's image as an `image` reference* and a "zoom out from this exact view by 10×" prompt. This makes views genuinely nest — the previous view is recognizably at the center of the next. Occasionally the model ignores the zoom and returns near-identical framing; retry with more forceful scale language ("complete sphere floating in vast black space, black space fills most of the frame"). Budget ~10-20% retry waste.
2. **Transition clips:** `seedance_2_0` family with **both `start_image` and `end_image` pinned to adjacent anchors**. Adjacent clips share an anchor, so seams are guaranteed by construction. **Draft-first workflow:** every clip is generated at 480p mini (5 cr per 5 s) and approved for motion before the final render at **1080p std (45 cr per 5 s)** — a bad generation costs 5 cr to retry, not 45. Decline the "Earth zoom out" preset recommendation via `declined_preset_id` (it takes only one input image).
3. **Frame extraction:** ffmpeg extracts each clip to JPEG frames (same recipe as the homepage laptop sequence). A 0.25 s crossfade at each seam (or blend of the shared-anchor frames) hides residual texture noise — seam frames are structurally identical, differing only in fine cloud/grain detail.
4. **Approval gates:** anchors are reviewed before any clips are generated (cheap to iterate); each clip's frame montage is checked for mid-clip morphing before the next is produced.

## Playback architecture

- `<canvas>` scrub of the concatenated frame sequence — **not** `<video>` (hard ~15 ms seek floor per frame, proven on the homepage laptop intro).
- **Windowed decoding is mandatory:** at ~24 chapters × ~120 frames, all-resident decoding would be several GB. Keep only the current chapter ± 1 neighbor decoded as `ImageBitmap`s; `.close()` bitmaps outside the window (the homepage v36 pattern). Encoded `<img>` payloads may stay cached.
- Frames stored per-chapter: `frames/<chapter>/frame-%03d.jpg`, with a manifest JSON (chapter order, frame counts, scale labels, exponent ranges).
- Scroll mapping: native scroll + lerp-eased playhead (proven in the demo — no dependencies needed; GSAP/Lenis optional later if inertia feel demands it). Scroll position → global frame index. The leaf anchor sits at the scroll midpoint once phase 3 lands; until then the page is a one-way zoom-out starting at the leaf. Scroll down walks the zoom-out chain, scroll up reverses.

## HUD & UX

- Corner overlay: current scale as a power of ten plus a label (`10⁻⁹ m — DNA double helix`), interpolated logarithmically within each chapter, label switching at chapter boundaries.
- Minimal intro hint ("scroll to travel"), fades on first scroll.
- Reduced-motion: `prefers-reduced-motion` gets a static chapter-stepper (anchor stills with labels) instead of the scrub.

## Page & portfolio integration

- Standalone page: own `index.html` + CSS/JS inside `Universe scroller/`, no build step (matches the rest of the repo).
- Linked from the hub's SELECTED WORK grid like other projects.
- Heavy source media (mp4 masters, draft-test) stays gitignored; only extracted frames actually used by the page are committed/deployed, mirroring the `assets-3d` rules.

## Build phasing

- **Phase 0 (done):** feasibility drafts — `draft-test/stitched-town-to-planet.mp4` + scrub demo at `demo/`.
- **Phase 1:** leaf → full Earth (9 anchors, 8 clips at 1080p) as a complete deployable experience: anchor ladder, draft+final clips, windowed playback engine, HUD. Budget ~425 cr of ~595 available (renews ~Aug 11).
- **Phase 2:** Earth → observable universe on the same engine (after credit renewal).
- **Phase 3:** zoom-in chain (into the leaf → quark); page becomes bidirectional from the leaf midpoint. Needs its own 2-clip feasibility draft first (organic/microscopic imagery unproven).

## Verification

- Per-clip: frame montage inspected for morph artifacts; seam SSIM/side-by-side against the shared anchor.
- Per-phase: full scroll-through in the browser — zero console errors, memory bounded (windowed bitmaps only), HUD tracks scroll, seams invisible at scrub speed, both scroll directions.
- Deploy check: same as other portfolio pages (worktree-free commit+push, cache-busted asset URLs).

## Risks

- **Model drift on anchors:** image-to-image occasionally ignores zoom instructions → retry cost, mitigated by approval gate before clip generation.
- **Organic zoom-in imagery (phase 3) unproven:** leaf→cell→DNA transitions may morph differently than geographic zooms; run a 2-clip draft test before committing to the chain.
- **Credit budget:** full journey at final quality may exceed current balance; drafts-first workflow keeps spend reversible, and 720p is acceptable (frames are downscaled for playback anyway).
