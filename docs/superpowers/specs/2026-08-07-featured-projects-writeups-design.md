# Featured projects: write-ups + card rework — design

**Date:** 2026-08-07
**Status:** Approved by Jordan (expansion mechanism, write-up outlines, writeup.html deletion all confirmed)
**Scope:** Landing-page work section only. Hero, about, contact, laptop dive, and the dark-desk backdrop are untouched.

## Goal

Split the seven project cards into **three featured projects with personal write-ups** and a compact **other-projects** section. Featured cards get bigger, all three sit on screen at once, and they slide in from the right. Each featured card carries a short write-up in Jordan's voice, and expands — via a page icon or its window "maximize" dot — into a large centered window holding the full write-up. No standalone write-up pages.

**Deferred to a later phase:** autoplay showcase videos in the expanded window (Higgsfield credits parked for this; the expanded window reserves a media slot at its top so video drops in without rework).

## Decisions made with Jordan

- Featured trio: **myplanBYU** (biggest), **Universe Scroller**, **Process Improvement Analysis**. Process was confirmed over Liquid Simulator / Art of Ballroom because the portfolio targets business analysis / finance / product — two builds plus one measured case study.
- Write-ups live **on the cards**: a 2–3 sentence blurb visible on the card, full story revealed by expanding the card. Explicitly **no separate HTML page per project**.
- Voice: **more personal, less technical** than the drafted `Universe scroller/writeup.html`. Lead with why and what happened with real people; engineering appears as highlights, not the headline.
- Expansion: **maximize-window overlay** (approved over grow-in-place). Card animates from its grid spot into a large centered terminal window over the dimmed desk; write-up scrolls inside; close dot / Esc / backdrop click collapses it back. Full-screen sheet on phones.
- `Universe scroller/writeup.html` (uncommitted draft): its story gets rewritten into the card at the new voice, then the **file is deleted**. The scroller's "how it works" topbar link retargets to `../index.html#universe`, which auto-opens the expanded card.
- Session order: **write-ups first, then layout.**

## Raw material from Jordan (verbatim anchors for voice)

- myplanBYU spark: planning was painful, "but also the bigger thing was that I had this problem of people not knowing things. Study abroads, clubs, scholarships, whatever. I wanted to help students answer questions they didn't know to ask. That's the thing I wish I had."
- myplanBYU users: "Classmates use it — I got a few texts from people saying they use it and asking for the link," feedback keeps evolving the product, and "I'm in the process of seeing if I can get BYU to buy or implement its ideas." (Write-up must phrase the BYU conversation as in-progress — no claims of adoption.)
- Universe Scroller footage: **AI-generated clips Jordan directed**, assembled into one continuous journey. The write-up is honest about this; the engineering (memory budget, scroll mapping, star masking) is the human work.
- Universe Scroller hook: the Blender kid — the age-ten Blender tutorial from the About section, the itch to build worlds.

## The write-ups

### Voice definition

First person, short declaratives, concrete numbers, warm with a dry edge. Contractions fine. No résumé-speak ("leveraged", "spearheaded"), no feature lists disguised as prose. Calibrated against the About section and the Process page ("The routine didn't just get faster, it got predictable").

Common structure: **why → what it is → what got hard (highlights only) → what happened with real people → where it's going.**

### myplanBYU (~650 words — the longest)

1. **The problem I actually had.** Planning my own path through MAP sheets and prereq chains was painful — but the bigger problem was invisible. Students miss study abroads, scholarships, clubs, because nobody tells you what to ask. Thesis line: *I wanted to help students answer questions they didn't know to ask. That's the tool I wish I had.*
2. **What it is.** Type your major (or two, plus minors); get a prerequisite-valid, semester-by-semester plan built from live catalog data. Import your transcript. Compare what-ifs. And the point: it surfaces the scholarships and study abroads that fit the plan you actually have.
3. **What got hard** (kept brief). Teaching it BYU's real rules — the official MAP sheet outranks the catalog when they disagree. A scraper that refreshes the data weekly without me touching it. An AI advisor that had to stay free, so it runs on a quota. (Verify current numbers at draft time: ~161 MAP majors solvable, advisor quota, course counts — check `myplanBYU/js/data.js` and the live site rather than trusting this spec.)
4. **Real people.** Classmates text me asking for the link. The feedback form keeps changing the product — real students found real bugs, and the git log shows them fixed the same week. This is the part that made it feel less like a project and more like a product.
5. **Where it's going.** I'm now seeing whether BYU wants to adopt its ideas. In-progress phrasing only.

### Universe Scroller (~550 words)

1. **The Blender kid.** Age ten, one Blender tutorial, and a permanent itch to build worlds. This one spans 27 orders of magnitude — chromosome to Milky Way.
2. **What it is.** A powers-of-ten journey you drive. It opens on a leaf at human scale and travels both ways: down into the cell, out to the galaxy. Scroll is the camera.
3. **Honest about the footage.** I directed AI-generated zoom clips and stitched them into one continuous shot. Then the part no AI did: 1,445 frames that would decode to ~5 GB, kept inside a phone's memory budget with a sliding window (~135 frames live at once); scroll mapped to orders of magnitude, not frames, so an inch of scroll always means the same zoom; stars that know where the planets are (precomputed masks, not pixel reads).
4. **The test that lied** (short beat). A verification harness once reported eleven green checks against a page that had rendered zero frames — the render loop was frozen and the test couldn't tell. Lesson: a passing check that a stopped system can also pass proves nothing. Real headless-Chrome verification now drives the whole span.
5. **Close.** No framework, no build step, a lot of deleting.

### Process Improvement Analysis (~450 words)

1. **Context.** Moved for a London study abroad; the old morning routine stopped working in the new place. Treated it like a process problem, not a willpower problem.
2. **The redesign.** One baseline week, then two deliberately boring changes: timers in the bathroom (10-minute shower, 5-minute shave — capped at 15), and decisions moved to the night before (clothes laid out, grab-and-go breakfast).
3. **The result.** Five trials each. 43.6 → 29.4 minutes average, 33% faster — but the better story is the spread: 13 minutes down to 4. Every improved trial beat every baseline trial; the two sets don't overlap. *The routine didn't just get faster, it got predictable.*
4. **Why it's here.** Same muscle as the bigger projects — measure, change one thing, measure again — pointed at the smallest system I own.

### Card blurbs (visible, collapsed state)

2–3 sentences each, same voice, replacing the current spec-sheet descriptions. Direction (final wording at draft time):

- **myplanBYU:** "Students miss scholarships and study abroads because they didn't know to ask. I built the tool I wish I'd had: type your major, get a real semester-by-semester plan — and see everything that fits it."
- **Universe Scroller:** "I've wanted to build worlds since a Blender tutorial at age ten. This one goes from a chromosome to the Milky Way — 27 orders of magnitude, scrubbed to your scroll."
- **Process Improvement:** "My mornings broke when I moved to London, so I fixed them the way you'd fix a factory line. Five trials later the routine wasn't just faster — it was predictable."

Each card also gets a row of three stat chips (mono, small):

- myplanBYU: `161 majors · live catalog · real users` (verify count at draft time)
- Universe Scroller: `27 orders of magnitude · 1,445 frames · AI-directed footage`
- Process: `33% faster · 5/5 trials · no overlap`

## Layout

### Featured section

- Label `FEATURED` (mono, small) above the trio; the `SELECTED WORK` ghost backdrop and particles stay.
- Desktop (≥ ~1100px): three cards in one row, sized so all three are fully on screen at once — roughly 30vw each, taller than current cards. Tablet/mobile: stacked full-width.
- Card anatomy (top to bottom): window bar (path, index, min/max/close dots — max and the page icon both expand, close is decorative in collapsed state), kind line, title, blurb, stat chips, tags, footer row with `> open_project` (opens the live project, as today) and a page-icon button `read the story` (expands the card).
- Entry animation: cards slide in **from the right** (x offset ~120px + fade), staggered ~0.15s, when the desk section enters view. Replaces the current rise-up `ScrollTrigger.batch`. Runs once. `prefers-reduced-motion`: no offset, instant reveal.
- Numbering keeps the inventory joke: featured are `01/07`–`03/07`.

### Other projects section

- Label `OTHER PROJECTS` below the featured trio.
- Liquid Simulator, Interactive Résumé, BYU Target Chaser, The Art of Ballroom as compact terminal-window cards (`04/07`–`07/07`) — same aesthetic, smaller (roughly half the visual weight, denser grid, likely 4-across on desktop / 2-across tablet / stacked mobile). Simple fade-in reveal. Links and targets unchanged. Not expandable.

## Expansion mechanism (approved: maximize-window)

- Trigger: page-icon button or the maximize dot. Both are real `<button>`s (keyboard-accessible); the card's outer link still opens the live project, so the expand triggers must `preventDefault`/stop propagation cleanly. Note: the current card is one big `<a>` — the markup needs restructuring so buttons are not nested inside the anchor (invalid HTML). Likely: card becomes a `<article>` with an explicit title/CTA link inside it rather than a wrapping anchor.
- Animation: the card's rect animates to a large centered window (~min(920px, 92vw) wide, ~85vh tall; full-screen sheet under ~720px). Implementation may use GSAP Flip via CDN or manual rect interpolation — implementer's choice. Backdrop dims the desk. Reduced motion: instant swap.
- The expanded window: same terminal chrome (path bar, dots — close is now real), a **reserved media slot** at the top (a structural container that stays collapsed/invisible this phase — no empty box is rendered; the autoplay video lands there later), then the full write-up scrolling inside. A persistent `open the live project →` button.
- Close: close dot, Esc, backdrop click. Body scroll locks while open; focus moves into the window (`role="dialog"`, `aria-modal="true"`) and returns to the trigger on close.
- Write-up HTML lives **inline in `index.html`** inside each card (hidden until expanded). No fetches; works from `file://`.
- Deep links: `#myplan`, `#universe`, `#process` auto-open the corresponding write-up after the boot overlay finishes (scrolls the desk into view, then opens). Opening sets the hash via `history.replaceState`; closing clears it the same way — no history entries, back button uninvolved.
- Only one window open at a time; rapid double-clicks must not double-open.

## File changes

| File | Change |
|---|---|
| `index.html` | Work grid → featured trio + other-projects markup; inline write-up content; blurbs + stat chips |
| `portfolio-3d.css` | Featured card sizing/layout, other-projects grid, expanded-window + backdrop styles, mobile + reduced-motion |
| `portfolio-3d.js` | Slide-in-from-right reveal (replaces rise-up batch), expansion open/close/focus/hash logic |
| `Universe scroller/index.html` | "how it works" topbar link → `../index.html#universe` |
| `Universe scroller/writeup.html` | **Deleted** after its story is folded into the card |

No new runtime dependencies (GSAP already loaded; Flip plugin from the same CDN is permitted if used).

## Testing / verification

- The in-app browser pane runs tabs hidden, which throttles rAF — scroll-driven reveals (ScrollTrigger) may not animate there. Verify the **expansion** (click-driven) via DOM assertions and screenshots in the pane; verify the **slide-in** by forcing scroll position and checking element state, or fall back to the headless-Chrome CDP approach used for the scroller.
- Checks: three featured cards fully visible together at 1280×800; slide-in fires once; expand/collapse round-trip from both triggers; Esc + backdrop close; focus restore; body scroll lock; deep links `#myplan` / `#universe` / `#process` open the right window after boot; scroller's "how it works" lands on the auto-opened universe card; other-projects links unchanged; mobile sheet at 375×812; reduced-motion path; no regression to the laptop dive or desk typing effect.
- Fact-check every number in the write-ups against the current code/site before shipping (major count, frame count, quota) — the spec's numbers are from memory and may drift.

## Out of scope

- Autoplay showcase videos + Higgsfield generation (next phase; media slot reserved).
- Any change to hero, about, skills band, contact, boot, laptop dive, desk backdrop.
- myplanBYU app itself, Process page itself, scroller engine (beyond the one link).
