# Featured Projects: Write-ups + Card Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the landing page's work section into three big featured cards (myplanBYU, Universe Scroller, Process Analysis) that slide in from the right, each carrying a personal write-up that expands into a maximize-window overlay, plus a compact "Other Projects" strip for the remaining four.

**Architecture:** All markup and write-up content lives inline in `index.html`. New CSS appends to `portfolio-3d.css`; the old scatter layout is replaced. New JS lives inside the existing IIFE in `portfolio-3d.js`: a new reveal block (slide-from-right) replaces the rise-up batch, and a self-contained expansion module implements the maximize window. One overlay window element serves all three cards; opening moves the card's hidden write-up node into it, closing moves it back.

**Tech Stack:** Vanilla HTML/CSS/JS. GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.18 (already loaded from CDN — no new dependencies, no build step, no Node on this machine).

**Spec:** `docs/superpowers/specs/2026-08-07-featured-projects-writeups-design.md`

## Global Constraints

- **`id="work-grid"` must survive on the container wrapping both new sections.** `portfolio-3d.js:247` gates the ENTIRE work section (laptop dive included) on `if (workGrid)`. Renaming that id kills the laptop dive.
- **All new JS goes inside the IIFE, BEFORE the hero-video/boot section.** The boot block (search for `if (!video || reduced)`) contains a top-level `return` — code placed after it never runs for reduced-motion visitors. Insert new modules immediately after the work-section block (search anchor: `const pcv` / `contact-particles`).
- **Never reference `bootDone` from the new modules** — it is declared with `let` after that early `return`; in reduced mode the declaration never executes and the reference throws (TDZ). Poll `document.documentElement.classList.contains("booting")` instead.
- **No separate write-up pages.** Content is inline; `Universe scroller/writeup.html` is deleted in Task 6.
- **Voice rules (from spec):** first person, short declaratives, concrete numbers, warm with a dry edge, no résumé-speak. The BYU-adoption conversation is phrased as in-progress only. The write-up describes the local-only test site but must not link `myplanBYU/tests/`.
- **Copy is verbatim from this plan.** The write-ups, blurbs, stat chips, and learned chips below were approved via the spec — do not paraphrase them while implementing. (Jordan reviews rendered output at Task 7 and may then request edits.)
- **Reduced motion:** every animation added here needs an instant path (`reduced` flag or `document.hidden`).
- **Cache-busting:** `index.html` pins `portfolio-3d.css?v=69` and `portfolio-3d.js?v=73`. Task 7 bumps both (v=70 / v=74) — deploys serve stale assets otherwise.
- **Commit per task, directly on `main`** (repo convention). Do NOT `git add -A` — the repo has unrelated uncommitted work (myplanBYU js, scroller files, mobile-preview.html). Stage only the files each task names.
- **Verification runs against the `portfolio` preview config** (python http.server, port 8126). The in-app browser tab is `document.hidden`, which freezes rAF (GSAP/Lenis/ScrollTrigger). Click-driven checks work because the expansion has an instant path when `document.hidden`; scroll-driven animation cannot be observed there — verify DOM state instead, and leave scroll *feel* to Jordan's review in Task 7.

## File Map

| File | Responsibility in this plan |
|---|---|
| `index.html` | New work-section markup: FEATURED trio (with inline write-ups), OTHER PROJECTS strip, maximize-window overlay skeleton |
| `portfolio-3d.css` | Replace `.work-grid` scatter layout; add featured/mini card styles, stat/learned chips, overlay window styles, mobile + reduced-motion |
| `portfolio-3d.js` | Replace rise-up reveal with slide-from-right; add expansion module (open/close/focus/scroll-lock/deep-links) |
| `Universe scroller/index.html` | Retarget "how it works" link to `../index.html#universe` |
| `Universe scroller/writeup.html` | Deleted (content superseded by the myplan-voice rewrite inline) |

---

### Task 1: Featured trio markup + write-ups (index.html) + core CSS

**Files:**
- Modify: `index.html` (the `#work-grid` block, currently lines ~221–335)
- Modify: `portfolio-3d.css` (replace `.work-grid` block at ~477–497; append new styles after the `.theme-*` block ~598+)

**Interfaces:**
- Produces (later tasks rely on these exact names): `#featured-grid`, `article.wcard.wcard-featured` with `id="card-myplan" | "card-universe" | "card-process"`, `data-slug="myplan|universe|process"`, `data-path`, `data-href`; inside each card: `button.w-max`, `button.wcard-read`, `div.wexp-content[hidden]` containing `.wx-media`, `.wx-learned`, and `.wx-sec` sections.
- Consumes: existing `.wcard` base styles, `.theme-*` variables, `#work-grid` JS gate.

- [ ] **Step 1: Fact-check the two numbers that appear in copy**

Run (myplan preview must be running — `preview_start` name `myplan` — else skip to the README source):

```
javascript_tool on http://localhost:8130 : DATA.majors.length
```

Expected: `175` (matches `myplanBYU/tests/README.md`: "all 175 majors"). If the live value differs, use the live value in the stat chip below.

Confirm frame count:

```bash
grep -o '"frameCount": *[0-9]*' "Universe scroller/frames/manifest.json"
```

Expected: `"frameCount": 1445`.

- [ ] **Step 2: Replace the seven-card grid with the FEATURED section**

In `index.html`, replace everything from `<div class="work-grid" id="work-grid">` through its closing `</div><!-- /work-grid -->` with the markup below. (The four non-featured cards return in Task 2 — after this step the page intentionally shows only three cards.)

```html
        <div class="work-grid" id="work-grid">

          <span class="work-label mono">FEATURED</span>
          <div id="featured-grid">

            <!-- ============ 01 · myplanBYU ============ -->
            <article class="wcard wcard-featured theme-myplan" id="card-myplan" data-slug="myplan"
                     data-path="~/projects/myplan-byu.app" data-href="https://myplan.jordanheaton.com/">
              <i class="wcard-bg fas fa-map-location-dot" aria-hidden="true"></i>
              <span class="wcard-bar">
                <span class="wpath mono">~/projects/myplan-byu.app</span>
                <span class="wcard-index mono">01/07</span>
                <span class="wwin"><b class="w-min" aria-hidden="true"></b><button class="w-max" type="button" aria-label="Read the myplanBYU story"></button><b class="w-close" aria-hidden="true"></b></span>
              </span>
              <div class="wcard-body">
                <span class="wcard-kind mono"><i class="wstat" aria-hidden="true"></i>WEB APP — RUNNING</span>
                <h3>myplanBYU — Degree Optimizer</h3>
                <p class="wcard-blurb">Students miss scholarships and study abroads they never knew existed. I built the tool I wish I'd had: type your major, get a real semester-by-semester plan — and see everything that fits it. Classmates text me for the link now.</p>
                <ul class="wcard-stats mono" aria-label="Quick stats">
                  <li>175 majors</li><li>live catalog</li><li>real users</li>
                </ul>
                <span class="wcard-learned mono"><b>learned:</b> optimization algorithms · rag ai · api design · ai evals (benchmark + human)</span>
              </div>
              <div class="wcard-foot">
                <a class="wcard-cta mono" href="https://myplan.jordanheaton.com/" target="_blank" rel="noopener">&gt; open_project<span class="wcur" aria-hidden="true"></span></a>
                <button class="wcard-read mono" type="button">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  read_the_story
                </button>
              </div>
              <div class="wexp-content" hidden>
                <div class="wx-media" aria-hidden="true"></div>
                <div class="wx-learned mono" aria-label="Learned and worked with">
                  <span>optimization algorithms</span><span>rag ai</span><span>api design</span><span>ai evals — benchmark + human</span><span>scrapers + data pipelines with quality gates</span><span>data modeling (7,000+ courses)</span><span>prompt-injection testing</span><span>serverless / edge deployment</span><span>cost engineering</span>
                </div>
                <section class="wx-sec">
                  <h4 class="wx-step mono">01 · The problem I actually had</h4>
                  <p>Planning my own path through BYU was painful — MAP sheets, prerequisite chains, GE boxes, all of it spread across PDFs and tabs that don't talk to each other. But that wasn't the thing that bothered me most. The thing that bothered me was how much students miss because nobody tells them it exists. Scholarships with three applicants. Study abroads that fit their major perfectly. Clubs, research grants, test-out exams. You can't ask about something you don't know exists — and by the time you find out, it's often too late to matter.</p>
                  <p>So this is the tool I wish someone had handed me as a freshman: one that answers the questions you didn't know to ask.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">02 · What it is</h4>
                  <p>Type in your major — or two majors and a minor, if you're feeling ambitious — and it builds a semester-by-semester plan that respects every prerequisite, every season a course is actually offered, and BYU's own credit rules. Import your transcript and it picks up where you are, not where a template thinks you should be. Then the part I care about most: it looks at the plan you actually have and surfaces what fits it — scholarships, study abroads, clubs, even who's teaching each course next semester.</p>
                  <p>There's an AI advisor built in, grounded in the same data, for the questions a form can't anticipate.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">03 · What got hard</h4>
                  <p>Almost everything, eventually. BYU's official MAP sheets and its course catalog disagree with each other more than you'd hope, so the solver had to learn a rule I never found written down anywhere: the sheet advisors actually hand out wins, and the conflict becomes a warning instead of a silent re-shuffle. The data refreshes itself weekly through a scraper pipeline that rejects its own bad output before it can deploy. And the advisor had to stay free for students, which meant building quotas and budget caps before building anything clever.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">04 · Real people</h4>
                  <p>Classmates text me asking for the link. That still feels strange to say. There's a feedback form inside the app, and real students keep finding real problems — a GE that should double-count, a course the plan dropped — and those reports have turned into same-week fixes more times than I can count. Somewhere along the way this stopped being a project and started being a product with users I don't want to let down.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">05 · What it taught me</h4>
                  <p>How to build a RAG AI system end to end — scraping, embeddings, retrieval, and the prompt that ties it together. How to design a small API with quotas and budget caps so a free tool stays free. How to schedule under real constraints, which is optimization with feelings. And how to test an AI: benchmark datasets catch the mechanical failures, but I ended up building a little testing website just to read the answers myself — because "is this good advice" is not a thing a regex knows.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">06 · Where it's going</h4>
                  <p>I'm talking with people at BYU about whether the university could adopt it — or at least its ideas. Whatever happens there, it keeps getting better every week, because the feedback keeps coming.</p>
                </section>
              </div>
            </article>

            <!-- ============ 02 · Universe Scroller ============ -->
            <article class="wcard wcard-featured theme-universe" id="card-universe" data-slug="universe"
                     data-path="~/projects/universe-scroller.app" data-href="Universe%20scroller/index.html">
              <i class="wcard-bg fas fa-leaf" aria-hidden="true"></i>
              <span class="wcard-bar">
                <span class="wpath mono">~/projects/universe-scroller.app</span>
                <span class="wcard-index mono">02/07</span>
                <span class="wwin"><b class="w-min" aria-hidden="true"></b><button class="w-max" type="button" aria-label="Read the Universe Scroller story"></button><b class="w-close" aria-hidden="true"></b></span>
              </span>
              <div class="wcard-body">
                <span class="wcard-kind mono"><i class="wstat" aria-hidden="true"></i>SCROLL EXPERIENCE — RUNNING</span>
                <h3>Universe Scroller</h3>
                <p class="wcard-blurb">I've been building 3D worlds since a Blender tutorial at age ten. This one runs from a chromosome to the Milky Way — 27 orders of magnitude of AI footage I directed, scrubbed frame-by-frame to your scroll.</p>
                <ul class="wcard-stats mono" aria-label="Quick stats">
                  <li>27 orders of magnitude</li><li>1,445 frames</li><li>ai-directed footage</li>
                </ul>
                <span class="wcard-learned mono"><b>learned:</b> video-gen ai · canvas performance · memory budgets</span>
              </div>
              <div class="wcard-foot">
                <a class="wcard-cta mono" href="Universe%20scroller/index.html" target="_blank" rel="noopener">&gt; open_project<span class="wcur" aria-hidden="true"></span></a>
                <button class="wcard-read mono" type="button">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  read_the_story
                </button>
              </div>
              <div class="wexp-content" hidden>
                <div class="wx-media" aria-hidden="true"></div>
                <div class="wx-learned mono" aria-label="Learned and worked with">
                  <span>video-gen ai</span><span>canvas performance</span><span>memory budgets</span><span>media pipelines</span><span>offline precomputation</span><span>headless-browser automation</span><span>responsive media design</span>
                </div>
                <section class="wx-sec">
                  <h4 class="wx-step mono">01 · The Blender kid</h4>
                  <p>When I was ten I found a Blender tutorial, and that was more or less that. I've been making 3D things ever since — it's the hobby that never wore off. What I always actually wanted was to build worlds, and this is the closest I've gotten: a single continuous shot from a chromosome inside a leaf cell out to the Milky Way. Twenty-seven orders of magnitude, and you're holding the camera.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">02 · What it is</h4>
                  <p>A powers-of-ten journey driven entirely by scroll. It opens on a leaf at human scale — something you recognize — and travels both directions: scroll down and you're inside the cell; scroll up and the forest becomes a coastline becomes a planet. A readout in the corner tracks the scale, from micrometers to light-years. Stopping halfway to stare is a legitimate use of it.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">03 · I directed the footage — AI rendered it</h4>
                  <p>The zoom clips are AI-generated video, and I'm saying that plainly because directing them was the artistic education. I decided what each scale should look like, where each cut lands, how a canopy should give way to coastline — then color-matched and stitched the clips into one continuous journey, 1,445 frames long. Video models are a strange film crew: unlimited budget, no memory. You learn fast that the skill is knowing what to ask for and what to throw away.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">04 · The engineering no AI did</h4>
                  <p>Those 1,445 frames would decode to about five gigabytes of bitmap — phones give up long before that. So only a sliding window of roughly 135 frames exists in memory at once, weighted toward the direction you're traveling. Scroll maps to orders of magnitude rather than to frames, so an inch of scroll always means the same amount of zoom whether you're crossing a forest or the solar system. And the ambient starfield knows where the planets are — brightness masks baked ahead of time, 72 bytes per frame — so a star fades out before it would ever sit on top of the Sun.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">05 · The test that lied</h4>
                  <p>My first automated check reported eleven green passes on a page that had rendered zero frames. The render loop was frozen; the test's success condition could be satisfied by a dead page. That lesson was worth the whole project: a check a stopped system can pass isn't a check. The journey is now verified in real headless Chrome, chapter by chapter, from one micrometer to 105,631 light-years.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">06 · The rest</h4>
                  <p>No framework, no build step, no libraries. Plain JavaScript, one canvas, and a lot of deleting.</p>
                </section>
              </div>
            </article>

            <!-- ============ 03 · Process Improvement ============ -->
            <article class="wcard wcard-featured theme-process" id="card-process" data-slug="process"
                     data-path="~/projects/process-analysis.doc" data-href="Process%20Analysis%20Project/index.html">
              <i class="wcard-bg fas fa-chart-line" aria-hidden="true"></i>
              <span class="wcard-bar">
                <span class="wpath mono">~/projects/process-analysis.doc</span>
                <span class="wcard-index mono">03/07</span>
                <span class="wwin"><b class="w-min" aria-hidden="true"></b><button class="w-max" type="button" aria-label="Read the process improvement story"></button><b class="w-close" aria-hidden="true"></b></span>
              </span>
              <div class="wcard-body">
                <span class="wcard-kind mono"><i class="wstat" aria-hidden="true"></i>CASE STUDY — RUNNING</span>
                <h3>Process Improvement Analysis</h3>
                <p class="wcard-blurb">My mornings broke when I moved to London, so I fixed them like a process, not a willpower problem. Five timed trials later: 33% faster, and every improved morning beat every baseline one.</p>
                <ul class="wcard-stats mono" aria-label="Quick stats">
                  <li>33% faster</li><li>5/5 trials</li><li>no overlap</li>
                </ul>
                <span class="wcard-learned mono"><b>learned:</b> process mapping · trial design · variance</span>
              </div>
              <div class="wcard-foot">
                <a class="wcard-cta mono" href="Process%20Analysis%20Project/index.html" target="_blank" rel="noopener">&gt; open_project<span class="wcur" aria-hidden="true"></span></a>
                <button class="wcard-read mono" type="button">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  read_the_story
                </button>
              </div>
              <div class="wexp-content" hidden>
                <div class="wx-media" aria-hidden="true"></div>
                <div class="wx-learned mono" aria-label="Learned and worked with">
                  <span>process mapping</span><span>trial design</span><span>variance</span><span>data storytelling</span>
                </div>
                <section class="wx-sec">
                  <h4 class="wx-step mono">01 · The problem</h4>
                  <p>I moved to London for a study abroad, and my mornings fell apart. New flat, new routine, no rhythm — I was leaving later than I meant to every day, and never by the same amount. I could have tried to have more willpower. Instead I treated it like a process problem, because that's what it was.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">02 · Baseline first</h4>
                  <p>For a week I just measured. Wake up, shower, shave, dress, breakfast, teeth, out the door — timed every day, changing nothing. The baseline came out at 43.6 minutes on average, with a 13-minute spread between the best morning and the worst. That spread was the real finding: the routine wasn't just slow, it was unpredictable.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">03 · Two boring changes</h4>
                  <p>The redesign is deliberately unimpressive. A 10-minute shower timer and a 5-minute shave timer cap the bathroom at fifteen minutes. Clothes get laid out the night before; breakfast becomes grab-and-go. That's it — the decisions moved to the evening, when there's time to make them, and vanished from the morning, when there isn't.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">04 · The result</h4>
                  <p>Five trials of each. The improved mornings averaged 29.4 minutes — 33% faster — and the spread collapsed from 13 minutes to 4. Every single improved trial beat every single baseline trial; the two sets don't overlap at all. The routine didn't just get faster. It got predictable, which is the property I actually wanted. The chart on the project page is hand-built SVG, and the range bands are drawn in on purpose — the no-overlap <em>is</em> the argument.</p>
                </section>
                <section class="wx-sec">
                  <h4 class="wx-step mono">05 · Why it's on this page</h4>
                  <p>Because it's the same muscle as the big projects, pointed at the smallest system I own: map the process, change one thing at a time, measure honestly, and let variance — not vibes — tell you whether it worked.</p>
                </section>
              </div>
            </article>

          </div><!-- /featured-grid -->

        </div><!-- /work-grid -->
```

- [ ] **Step 3: Replace the `.work-grid` scatter CSS**

In `portfolio-3d.css`, replace the block from `.work-grid {` (~line 477) through the last scatter rule `.work-grid .wcard:nth-child(7) { ... }` (~line 497) with:

```css
.work-grid {
  position: relative; z-index: 2;
  margin-top: -100vh;              /* overlap the sticky backdrop */
  padding: 118vh 0 34vh;           /* top: title types/holds before the cards arrive · bottom: exit beat before contact */
  max-width: min(1560px, 92vw);
  margin-left: auto; margin-right: auto;
}
.work-label {
  display: block;
  color: #5a6884; font-size: 0.68rem; letter-spacing: 0.34em;
  margin: 0 0 22px 4px;
}
#featured-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: clamp(16px, 1.6vw, 28px);
  align-items: stretch;
}
```

- [ ] **Step 4: Append featured-card styles**

Append to `portfolio-3d.css`, after the `.theme-*` block (search for `.theme-universe`), a clearly-marked section:

```css
/* ===================== FEATURED CARDS (2026-08 rework) ===================== */
.wcard-featured { width: auto; min-height: min(560px, 64vh); }
.wcard-featured h3 { font-size: clamp(1.45rem, 1.9vw, 2.1rem); }
.wcard-featured .wcard-body { padding: 26px 30px 8px; }
.wcard-featured p.wcard-blurb { font-size: 0.94rem; max-width: none; }

.wcard-stats { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 0 0 14px; }
.wcard-stats li {
  border: 1px solid rgba(120, 150, 220, 0.22); border-radius: 999px;
  padding: 4px 11px; font-size: 0.62rem; letter-spacing: 0.08em; color: #8fa2c4;
}
.wcard-learned { display: block; color: #5a6884; font-size: 0.66rem; letter-spacing: 0.08em; line-height: 1.8; }
.wcard-learned b { color: var(--theme, #4d8cff); font-weight: 600; }

/* footer: launch link + read-the-story button side by side */
.wcard-foot { display: flex; align-items: stretch; margin-top: 22px; border-top: 1px solid rgba(120, 150, 220, 0.12); position: relative; z-index: 1; }
.wcard-foot .wcard-cta { flex: 1; margin: 0; border-top: 0; }
.wcard-read {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 0 20px; background: none; border: 0;
  border-left: 1px solid rgba(120, 150, 220, 0.12);
  color: #8fa2c4; font-size: 0.66rem; letter-spacing: 0.12em;
  cursor: pointer; transition: color 0.2s, background 0.2s;
}
.wcard-read svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; }
.wcard-read:hover { color: #eaf2ff; background: rgba(120, 150, 220, 0.06); }
.wwin button { appearance: none; background: none; border: 0; padding: 0; cursor: pointer; font: inherit; }
.wwin button.w-max { width: 28px; height: 20px; border-radius: 4px; display: grid; place-items: center; color: #5a6685; transition: background 0.2s, color 0.2s; }
.wwin button.w-max::before { content: "\25A1"; font-size: 0.6rem; line-height: 1; }
.wcard:hover .wwin button.w-max { color: #9aa6c2; }
.wwin button.w-max:hover { background: rgba(255,255,255,0.09); color: #eaf2ff; }

/* hidden write-up payload (adopted by the maximize window in Task 4/5) */
.wexp-content[hidden] { display: none; }
```

Then update the two responsive blocks that style the old layout (search `@media` around lines ~757 and ~821): replace `.work-grid { padding: 150vh 5vw 120vh; gap: ... }` with `.work-grid { padding: 120vh 4vw 30vh; }` + `#featured-grid { grid-template-columns: 1fr; gap: 26px; }`, and replace `.wcard { width: min(440px, 84vw); min-height: 420px; }` with `.wcard-featured { min-height: 0; }` (delete the old `.work-grid { padding: 135vh ... gap ... }` / `.wcard { width: 100%; ... }` lines in the smaller breakpoint the same way — the featured grid is single-column there already).

- [ ] **Step 5: Verify rendering**

Start `preview_start` name `portfolio`, navigate to `http://localhost:8126/`, then:

```
javascript_tool: JSON.stringify({
  featured: document.querySelectorAll('#featured-grid .wcard-featured').length,
  writeups: document.querySelectorAll('.wexp-content').length,
  hiddenAll: [...document.querySelectorAll('.wexp-content')].every(n => n.hidden),
  readBtns: document.querySelectorAll('.wcard-read').length,
  gridGate: !!document.getElementById('work-grid')
})
```

Expected: `{"featured":3,"writeups":3,"hiddenAll":true,"readBtns":3,"gridGate":true}`. Take a screenshot after scrolling the desk into view via `javascript_tool: window.scrollTo(0, document.getElementById('work-desk').offsetTop + innerHeight)` — three cards abreast (they may sit at opacity 0 if the old batch reveal ran; `document.querySelectorAll('#work-grid .wcard')` still matching is fine at this stage). Check `read_console_messages` for errors — expect none.

- [ ] **Step 6: Commit**

```bash
git add index.html portfolio-3d.css
git commit -m "Featured trio: three big cards with inline personal write-ups"
```

---

### Task 2: Other-projects strip

**Files:**
- Modify: `index.html` (inside `#work-grid`, after `</div><!-- /featured-grid -->`)
- Modify: `portfolio-3d.css` (append to the featured section added in Task 1)

**Interfaces:**
- Produces: `#other-grid`, `a.wcard.wcard-mini` (4 of them, indexes 04/07–07/07).
- Consumes: `.wcard` base styles, `.work-label` from Task 1.

- [ ] **Step 1: Add the markup**

Insert after `</div><!-- /featured-grid -->`, before `</div><!-- /work-grid -->`:

```html
          <span class="work-label mono work-label-other">OTHER PROJECTS</span>
          <div id="other-grid">

            <a class="wcard wcard-mini theme-liquid" href="Liquid%20Simulator/liquid-simulator.html" target="_blank" rel="noopener">
              <i class="wcard-bg fas fa-droplet" aria-hidden="true"></i>
              <span class="wcard-bar">
                <span class="wpath mono">~/projects/liquid-sim.exe</span>
                <span class="wcard-index mono">04/07</span>
              </span>
              <div class="wcard-body">
                <span class="wcard-kind mono"><i class="wstat" aria-hidden="true"></i>SIMULATION</span>
                <h3>Liquid Simulator</h3>
                <p>Real-time interactive liquid &amp; particle physics on canvas, with live controls.</p>
                <span class="wcard-tags mono">[canvas] [physics] [javascript]</span>
              </div>
              <span class="wcard-cta mono">&gt; open_project<span class="wcur" aria-hidden="true"></span></span>
            </a>

            <a class="wcard wcard-mini theme-resume" href="IS%20201%20Web%20Project/index.html" target="_blank" rel="noopener">
              <i class="wcard-bg fas fa-file-lines" aria-hidden="true"></i>
              <span class="wcard-bar">
                <span class="wpath mono">~/projects/interactive-resume.html</span>
                <span class="wcard-index mono">05/07</span>
              </span>
              <div class="wcard-body">
                <span class="wcard-kind mono"><i class="wstat" aria-hidden="true"></i>WEBSITE</span>
                <h3>Interactive Résumé</h3>
                <p>A responsive personal résumé site built from scratch — sticky nav, clean sections.</p>
                <span class="wcard-tags mono">[html] [css] [responsive]</span>
              </div>
              <span class="wcard-cta mono">&gt; open_project<span class="wcur" aria-hidden="true"></span></span>
            </a>

            <a class="wcard wcard-mini theme-game" href="IS%20201%20Web%20Project/game.html" target="_blank" rel="noopener">
              <i class="wcard-bg fas fa-gamepad" aria-hidden="true"></i>
              <span class="wcard-bar">
                <span class="wpath mono">~/projects/target-chaser.exe</span>
                <span class="wcard-index mono">06/07</span>
              </span>
              <div class="wcard-body">
                <span class="wcard-kind mono"><i class="wstat" aria-hidden="true"></i>GAME</span>
                <h3>BYU Target Chaser</h3>
                <p>A fast little browser arcade game — combos, power-ups, lives, local high score.</p>
                <span class="wcard-tags mono">[javascript] [game]</span>
              </div>
              <span class="wcard-cta mono">&gt; open_project<span class="wcur" aria-hidden="true"></span></span>
            </a>

            <a class="wcard wcard-mini theme-ballroom" href="IS%20201%20Web%20Project/about.html" target="_blank" rel="noopener">
              <i class="wcard-bg fas fa-music" aria-hidden="true"></i>
              <span class="wcard-bar">
                <span class="wpath mono">~/projects/art-of-ballroom.mov</span>
                <span class="wcard-index mono">07/07</span>
              </span>
              <div class="wcard-body">
                <span class="wcard-kind mono"><i class="wstat" aria-hidden="true"></i>FEATURE</span>
                <h3>The Art of Ballroom</h3>
                <p>A cinematic scroll experience on competitive ballroom — and a featured performance.</p>
                <span class="wcard-tags mono">[3d-scroll] [passion-project]</span>
              </div>
              <span class="wcard-cta mono">&gt; open_project<span class="wcur" aria-hidden="true"></span></span>
            </a>

          </div><!-- /other-grid -->
```

- [ ] **Step 2: Add the CSS**

Append to the featured section in `portfolio-3d.css`:

```css
/* ---- other projects: compact strip ---- */
.work-label-other { margin-top: 72px; }
#other-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(14px, 1.2vw, 22px); }
.wcard-mini { width: auto; min-height: 0; }
.wcard-mini .wcard-bar { padding: 9px 14px; }
.wcard-mini .wcard-body { padding: 18px 20px 4px; }
.wcard-mini h3 { font-size: 1.12rem; margin-bottom: 8px; }
.wcard-mini p { font-size: 0.8rem; margin-bottom: 12px; max-width: none; }
.wcard-mini .wcard-tags { font-size: 0.6rem; }
.wcard-mini .wcard-cta { margin-top: 12px; padding: 10px 20px 12px; font-size: 0.64rem; }
.wcard-mini .wcard-bg { font-size: 6.5rem; right: -14px; bottom: -22px; }
.wcard-mini:hover { transform: translateY(-6px); }

@media (max-width: 1100px) { #other-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px)  { #other-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Verify**

Reload the preview. Expected via `javascript_tool`: `document.querySelectorAll('#other-grid .wcard-mini').length` → `4`; all four `href`s resolve (fetch each `a.wcard-mini` href with `fetch(href, {method:'HEAD'})` → status 200). Screenshot the strip. Console clean.

- [ ] **Step 4: Commit**

```bash
git add index.html portfolio-3d.css
git commit -m "Other-projects strip: the four non-featured cards, compact"
```

---

### Task 3: Slide-in-from-right reveal

**Files:**
- Modify: `portfolio-3d.js` (the reveal block at ~579–588: `gsap.set("#work-grid .wcard", { opacity: 0, y: 80 }); ScrollTrigger.batch(...)`)

**Interfaces:**
- Consumes: `#featured-grid .wcard`, `#other-grid .wcard` (Tasks 1–2), `reduced` flag.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Replace the rise-up batch**

Replace the whole `if (!reduced) { gsap.set("#work-grid .wcard", ...) ... }` block with:

```js
    // featured trio slides in FROM THE RIGHT, staggered; the other-projects
    // strip keeps a quiet rise. clearProps afterwards so the CSS hover-lift
    // keeps working.
    if (!reduced) {
      gsap.set("#featured-grid .wcard", { opacity: 0, x: 120 });
      ScrollTrigger.batch("#featured-grid .wcard", {
        start: "top 85%",
        onEnter: (els) => gsap.to(els, {
          opacity: 1, x: 0, duration: 0.9, ease: "power3.out",
          stagger: 0.15, overwrite: true, clearProps: "transform,opacity",
        }),
        once: true,
      });
      gsap.set("#other-grid .wcard", { opacity: 0, y: 40 });
      ScrollTrigger.batch("#other-grid .wcard", {
        start: "top 92%",
        onEnter: (els) => gsap.to(els, {
          opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
          stagger: 0.08, overwrite: true, clearProps: "transform,opacity",
        }),
        once: true,
      });
    }
```

- [ ] **Step 2: Verify initial state + no stuck-hidden cards**

Reload preview. In the hidden tab GSAP won't animate, so check the *setup* is correct: `javascript_tool: getComputedStyle(document.querySelector('#featured-grid .wcard')).opacity` → `"0"` (set applied) and `document.body.classList.contains('reduced')` → `false`. Then emulate reduced motion (`resize_window` with `colorScheme` unchanged won't do it — instead evaluate: matchMedia support check is enough) — minimum bar: confirm the reveal code path is guarded by `reduced` by reading the source (`Grep pattern "featured-grid .wcard" portfolio-3d.js` → 2 matches inside `if (!reduced)`). Scroll-feel verification lands on Jordan in Task 7.

- [ ] **Step 3: Commit**

```bash
git add portfolio-3d.js
git commit -m "Reveal: featured cards slide in from the right, others rise quietly"
```

---

### Task 4: Maximize-window overlay — markup + CSS

**Files:**
- Modify: `index.html` (insert before `</main>`)
- Modify: `portfolio-3d.css` (append)

**Interfaces:**
- Produces: `#wmax` (`role="dialog"`), `#wmax-path`, `#wmax-close`, `#wmax-body` (`data-lenis-prevent`), `#wmax-open`, `#wmax-backdrop`; class `html.wmax-open` for scroll lock; `.wmax.show` / `.wmax-backdrop.show` visible states.
- Consumes: `.wcard-bar`/`.wwin` chrome styles; `.wx-*` content styles (added here).

- [ ] **Step 1: Add the overlay skeleton**

Insert into `index.html` immediately before `</main>`:

```html
    <!-- Maximize window: one overlay serves all three featured cards. Opening a
         story MOVES that card's .wexp-content node in here; closing moves it back. -->
    <div class="wmax-backdrop" id="wmax-backdrop" hidden></div>
    <section class="wmax" id="wmax" role="dialog" aria-modal="true" aria-label="Project story" hidden>
      <header class="wcard-bar wmax-bar">
        <span class="wpath mono" id="wmax-path"></span>
        <span class="wwin"><b class="w-min" aria-hidden="true"></b><b class="w-max" aria-hidden="true"></b><button class="w-close" id="wmax-close" type="button" aria-label="Close story"></button></span>
      </header>
      <div class="wmax-scroll" id="wmax-body" data-lenis-prevent></div>
      <footer class="wmax-foot">
        <a class="wmax-live mono" id="wmax-open" href="#" target="_blank" rel="noopener">&gt; open_live_project<span class="wcur" aria-hidden="true"></span></a>
      </footer>
    </section>
```

- [ ] **Step 2: Add the CSS**

Append to `portfolio-3d.css`:

```css
/* ===================== MAXIMIZE WINDOW (story overlay) ===================== */
.wmax-backdrop {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(3, 5, 10, 0.72);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  opacity: 0; transition: opacity 0.3s;
}
.wmax-backdrop.show { opacity: 1; }
.wmax-backdrop[hidden] { display: none; }

.wmax {
  position: fixed; inset: 0; margin: auto; z-index: 61;  /* inset+margin centers WITHOUT transform, so GSAP owns transform for the FLIP */
  width: min(940px, 94vw); height: min(86vh, 900px);
  display: flex; flex-direction: column;
  border: 1px solid rgba(120, 150, 220, 0.28); border-radius: 12px;
  background: linear-gradient(180deg, rgba(18, 23, 36, 0.985), rgba(11, 15, 24, 0.985));
  box-shadow: 0 60px 140px rgba(0, 0, 0, 0.7), 0 0 60px -12px var(--theme, #4d8cff);
  opacity: 0; transition: opacity 0.25s;
}
.wmax.show { opacity: 1; }
.wmax[hidden] { display: none; }
.wmax-bar { border-radius: 12px 12px 0 0; }
.wwin button.w-close { width: 28px; height: 20px; border-radius: 4px; display: grid; place-items: center; color: #5a6685; transition: background 0.2s, color 0.2s; }
.wwin button.w-close::before { content: "\2715"; font-size: 0.72rem; line-height: 1; }
.wwin button.w-close:hover { background: #e23b4e; color: #fff; }

.wmax-scroll { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 6px 42px 30px; }
.wmax-foot { border-top: 1px solid rgba(120, 150, 220, 0.12); }
.wmax-live { display: block; padding: 14px 42px 16px; color: var(--theme, #4d8cff); font-size: 0.72rem; letter-spacing: 0.14em; transition: background 0.25s, letter-spacing 0.25s; }
.wmax-live:hover { background: rgba(120, 150, 220, 0.06); letter-spacing: 0.2em; }

/* write-up typography inside the window */
.wx-media { display: none; }  /* reserved for the showcase video (later phase) */
.wx-learned { display: flex; flex-wrap: wrap; gap: 8px; margin: 26px 0 6px; }
.wx-learned span {
  border: 1px solid rgba(120, 150, 220, 0.22); border-radius: 999px;
  padding: 5px 12px; font-size: 0.64rem; letter-spacing: 0.08em; color: #8fa2c4;
}
.wx-sec { margin-top: 28px; }
.wx-step { display: block; color: var(--theme, #4d8cff); font-size: 0.66rem; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 10px; opacity: 0.85; }
.wx-sec p { color: #a8b8d8; font-size: 0.97rem; line-height: 1.75; max-width: 66ch; margin-bottom: 12px; }
.wx-sec p:last-child { margin-bottom: 0; }
.wx-sec em { color: #dbe6fa; font-style: normal; font-weight: 600; }

/* scroll lock while the window is open */
html.wmax-open, html.wmax-open body { overflow: hidden; }

/* the grid card whose story is open hides so the window reads as it, maximized */
.wcard-featured.is-open { visibility: hidden; }

/* full-screen sheet on phones */
@media (max-width: 720px) {
  .wmax { width: 100vw; height: 100dvh; border-radius: 0; }
  .wmax-bar { border-radius: 0; }
  .wmax-scroll { padding: 4px 22px 24px; }
  .wmax-live { padding: 13px 22px 15px; }
}
```

- [ ] **Step 3: Verify (static)**

Reload preview. `javascript_tool`: `({w: !!document.getElementById('wmax'), b: !!document.getElementById('wmax-backdrop'), hidden: document.getElementById('wmax').hidden, closeBtn: !!document.getElementById('wmax-close')})` → all true / `hidden:true`. Nothing visible on screen (both `[hidden]`). Console clean.

- [ ] **Step 4: Commit**

```bash
git add index.html portfolio-3d.css
git commit -m "Maximize window: overlay chrome + write-up typography (dormant)"
```

---

### Task 5: Expansion JS — open, close, focus, scroll lock

**Files:**
- Modify: `portfolio-3d.js` — insert a new module INSIDE the IIFE, immediately after the work-section block and BEFORE the contact-particles code (search anchor: `contact-particles`; the module must sit before the hero/boot section's early `return`).

**Interfaces:**
- Consumes: `#wmax` etc. (Task 4), `.wcard-featured` cards with `data-slug`/`data-path`/`data-href` and `.wexp-content` (Task 1), `lenis`, `reduced`, `gsap`.
- Produces: `openStory(cardEl)`, `closeStory()`, and `WMAX_SLUGS` (used by Task 6's deep links) — all module-scoped `function` declarations inside the IIFE so Task 6 (same scope, later lines) can call them.

- [ ] **Step 1: Add the module**

```js
  /* ---------------- featured story: maximize-window expansion ----------------
     One overlay serves all three cards. Opening MOVES the card's .wexp-content
     node into #wmax-body (no cloning, no fetching); closing moves it back.
     Instant path when reduced-motion OR document.hidden — a frozen rAF loop
     must never leave the window half-open. */
  const wmax = document.getElementById("wmax");
  const wmaxBody = document.getElementById("wmax-body");
  const wmaxBackdrop = document.getElementById("wmax-backdrop");
  const WMAX_SLUGS = { myplan: "card-myplan", universe: "card-universe", process: "card-process" };
  let wmaxCard = null;      // card whose story is open
  let wmaxLastFocus = null;

  function wmaxInstant() { return reduced || document.hidden; }

  function openStory(card) {
    if (!wmax || !card || wmaxCard) return;
    const content = card.querySelector(".wexp-content");
    if (!content) return;
    wmaxCard = card;
    wmaxLastFocus = document.activeElement;

    wmaxBody.appendChild(content);
    content.hidden = false;
    document.getElementById("wmax-path").textContent = card.dataset.path || "";
    document.getElementById("wmax-open").setAttribute("href", card.dataset.href || "#");
    wmax.style.setProperty("--theme", getComputedStyle(card).getPropertyValue("--theme").trim());

    wmaxBackdrop.hidden = false;
    wmax.hidden = false;
    document.documentElement.classList.add("wmax-open");
    lenis.stop();
    if (card.dataset.slug) history.replaceState(null, "", "#" + card.dataset.slug);

    const from = card.getBoundingClientRect();      // measure BEFORE hiding the card
    card.classList.add("is-open");
    wmaxBackdrop.classList.add("show");
    wmax.classList.add("show");
    wmaxBody.scrollTop = 0;

    if (wmaxInstant()) { wmaxFocusIn(); return; }
    const to = wmax.getBoundingClientRect();
    gsap.fromTo(wmax,
      { x: from.left - to.left, y: from.top - to.top,
        scaleX: from.width / to.width, scaleY: from.height / to.height,
        transformOrigin: "top left" },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.45, ease: "power3.inOut",
        onComplete: () => { gsap.set(wmax, { clearProps: "transform" }); wmaxFocusIn(); } });
  }

  function closeStory() {
    if (!wmaxCard) return;
    const card = wmaxCard;
    wmaxCard = null;
    const finish = () => {
      wmax.classList.remove("show");
      wmaxBackdrop.classList.remove("show");
      wmax.hidden = true;
      wmaxBackdrop.hidden = true;
      const content = wmaxBody.querySelector(".wexp-content");
      if (content) { content.hidden = true; card.appendChild(content); }
      card.classList.remove("is-open");
      document.documentElement.classList.remove("wmax-open");
      lenis.start();
      history.replaceState(null, "", location.pathname + location.search);
      if (wmaxLastFocus && wmaxLastFocus.focus) wmaxLastFocus.focus();
    };
    if (wmaxInstant()) { finish(); return; }
    const to = card.getBoundingClientRect();
    const from = wmax.getBoundingClientRect();
    // card scrolled far off screen → just fade instead of flying across the page
    if (to.bottom < -40 || to.top > innerHeight + 40) {
      gsap.to(wmax, { opacity: 0, duration: 0.2, onComplete: () => { gsap.set(wmax, { clearProps: "opacity" }); finish(); } });
      return;
    }
    gsap.to(wmax, {
      x: to.left - from.left, y: to.top - from.top,
      scaleX: to.width / from.width, scaleY: to.height / from.height,
      transformOrigin: "top left", duration: 0.4, ease: "power3.inOut",
      onComplete: () => { gsap.set(wmax, { clearProps: "transform" }); finish(); },
    });
  }

  function wmaxFocusIn() {
    const btn = document.getElementById("wmax-close");
    if (btn) btn.focus();
  }

  if (wmax) {
    document.querySelectorAll(".wcard-featured").forEach((card) => {
      card.querySelectorAll(".w-max, .wcard-read").forEach((btn) => {
        btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openStory(card); });
      });
    });
    wmaxBackdrop.addEventListener("click", closeStory);
    document.getElementById("wmax-close").addEventListener("click", closeStory);
    document.addEventListener("keydown", (e) => {
      if (!wmaxCard) return;
      if (e.key === "Escape") { closeStory(); return; }
      if (e.key === "Tab") {
        // keep focus inside the dialog
        const focusables = wmax.querySelectorAll("button, a[href]");
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
```

- [ ] **Step 2: Verify the full round-trip in the preview**

The preview tab is `document.hidden`, so `wmaxInstant()` is true and everything applies synchronously — which is exactly what makes this testable here:

```
javascript_tool: document.querySelector('#card-myplan .wcard-read').click();
  JSON.stringify({ open: !document.getElementById('wmax').hidden,
    hash: location.hash,
    content: document.getElementById('wmax-body').querySelectorAll('.wx-sec').length,
    locked: document.documentElement.classList.contains('wmax-open'),
    path: document.getElementById('wmax-path').textContent,
    live: document.getElementById('wmax-open').getAttribute('href') })
```

Expected: `open:true`, `hash:"#myplan"`, `content:6`, `locked:true`, `path:"~/projects/myplan-byu.app"`, `live:"https://myplan.jordanheaton.com/"`. Screenshot (write-up visible in the window). Then:

```
javascript_tool: document.getElementById('wmax-close').click();
  JSON.stringify({ closed: document.getElementById('wmax').hidden,
    hash: location.hash,
    returned: !!document.querySelector('#card-myplan .wexp-content'),
    unlocked: !document.documentElement.classList.contains('wmax-open') })
```

Expected: `closed:true`, `hash:""`, `returned:true`, `unlocked:true`. Repeat open via the `.w-max` dot on `#card-universe` (expect 6 sections) and `#card-process` (expect 5 sections). Esc check: open one, `javascript_tool: document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))` → closed. Double-click guard: `.wcard-read` clicked twice rapidly → still exactly one `.wexp-content` inside `#wmax-body`, card's own copy back after one close.

- [ ] **Step 3: Commit**

```bash
git add portfolio-3d.js
git commit -m "Story expansion: cards maximize into the overlay window"
```

---

### Task 6: Deep links, scroller retarget, delete writeup.html

**Files:**
- Modify: `portfolio-3d.js` (extend the Task 5 module, directly below it)
- Modify: `Universe scroller/index.html` (the `howto` link)
- Delete: `Universe scroller/writeup.html`

**Interfaces:**
- Consumes: `openStory`, `WMAX_SLUGS`, `lenis` (same IIFE scope).

- [ ] **Step 1: Hash auto-open after boot**

Add directly below the Task 5 module (still before the contact-particles block):

```js
  // Deep links: #myplan / #universe / #process open the story directly.
  // Wait out the boot overlay (class-based — never touch bootDone: it is
  // declared AFTER the boot block's early return and would throw in
  // reduced-motion mode), then land on the desk and open the window.
  (function wmaxDeepLink() {
    const slug = location.hash.replace("#", "");
    const cardId = WMAX_SLUGS[slug];
    if (!cardId) return;
    const tryOpen = () => {
      if (document.documentElement.classList.contains("booting")) { setTimeout(tryOpen, 150); return; }
      const card = document.getElementById(cardId);
      if (!card) return;
      const desk = document.getElementById("work-desk");
      if (desk) {
        const y = desk.getBoundingClientRect().top + window.scrollY + window.innerHeight * 0.06;
        lenis.scrollTo(y, { immediate: true });
        window.scrollTo(0, y); // belt and braces: lenis may be frozen in a hidden tab
      }
      openStory(card);
    };
    tryOpen();
  })();
```

- [ ] **Step 2: Retarget the scroller's "how it works" link**

In `Universe scroller/index.html`, change:

```html
    <a class="howto" href="writeup.html">how it works</a>
```

to:

```html
    <a class="howto" href="../index.html#universe">how it works</a>
```

- [ ] **Step 3: Delete the standalone write-up**

```bash
git rm "Universe scroller/writeup.html"
```

- [ ] **Step 4: Verify**

Navigate the preview to `http://localhost:8126/#universe` (fresh load). Expected after boot settles (hidden tab: boot falls back fast because `reduced` is false but video won't play — the 8s failsafe caps the wait): `javascript_tool: JSON.stringify({open: !document.getElementById('wmax').hidden, path: document.getElementById('wmax-path').textContent})` → `open:true`, `path:"~/projects/universe-scroller.app"`. Screenshot. Then `http://localhost:8126/#process` → process story opens. `http://localhost:8126/#about` → nothing opens, no console errors. Confirm no dangling references:

```bash
grep -rn "writeup.html" "Universe scroller" index.html
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add portfolio-3d.js "Universe scroller/index.html"
git commit -m "Deep links open stories; scroller how-it-works points at the card; standalone writeup retired"
```

---

### Task 7: Verification sweep, cache-bust, Jordan review

**Files:**
- Modify: `index.html` (asset version params only)

- [ ] **Step 1: Full matrix in the preview**

Desktop 1280×800 (`resize_window` preset desktop): three featured cards fully on screen together in the desk section (screenshot); other strip renders 4-across; every card link HEAD-checks 200 (myplan URL is external — plain GET ok); open/close round-trip on all three stories; Esc + backdrop close; laptop-dive canvas still present (`!!document.getElementById('work-canvas')`) and desk ghost title intact; console clean throughout. Mobile 375×812 (`resize_window` preset mobile, reload): featured cards stacked; story opens as full-screen sheet (screenshot); close works. Reduced motion: `javascript_tool` can't flip the media query — instead verify every animation call site is guarded: `grep -n "reduced" portfolio-3d.js` must show guards in the reveal block and `wmaxInstant()` in the expansion module.

- [ ] **Step 2: Regression pass on the untouched sections**

Hero boots and fades, about gallery scrolls, contact renders — screenshot top and bottom of page. `read_console_messages` → no errors.

- [ ] **Step 3: Bump asset versions**

In `index.html`: `portfolio-3d.css?v=69` → `?v=70` and `portfolio-3d.js?v=73` → `?v=74`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Featured rework: cache-bust css/js for deploy"
```

- [ ] **Step 5: Jordan's review gate (do not skip)**

Tell Jordan the rework is live locally and ask him to: read all three write-ups in their expanded windows (voice check — the copy is his story told back to him), feel the slide-in on a real visible tab (the preview tab can't show scroll animation), and click through on mobile width. Collect edits; apply verbatim requests directly; re-verify Task 5 Step 2's round-trip after any content edit (the section counts in its assertions change if sections are added/removed).

---

## Amendment — 2026-08-07 live review (Tasks 8–10)

Jordan reviewed the built state after Task 5 and requested three changes (see the spec's Amendments section). Tasks 8–10 below implement them. Execution order: Task 8 → 9 → 10 → 6 → 7. Task 2's strip markup is intentionally restructured by Task 10 (its cards and CSS survive inside the new pane). Task 7 additionally verifies the amendment behaviors and gives mobile a dedicated pass.

### Task 8: Bracket-style skill row on cards

**Files:**
- Modify: `index.html` (3 featured cards: replace each `span.wcard-learned` line; add a label line inside each `.wx-learned`)
- Modify: `portfolio-3d.css` (remove `.wcard-learned` rules; add `.wx-learned-label`)

**Interfaces:** consumes existing `.wcard-tags` styling; `.wx-learned` keeps its class and position.

- [ ] **Step 1:** In each featured card, replace the `<span class="wcard-learned mono">…</span>` line with a bracket-tags line:
  - myplan: `<span class="wcard-tags mono">[optimization algorithms] [rag ai] [api design] [ai evals]</span>`
  - universe: `<span class="wcard-tags mono">[video-gen ai] [canvas performance] [memory budgets]</span>`
  - process: `<span class="wcard-tags mono">[process mapping] [trial design] [variance]</span>`
- [ ] **Step 2:** In each card's `.wexp-content`, insert immediately before the `<div class="wx-learned …">` line: `<span class="wx-learned-label mono">learned &amp; worked with</span>`
- [ ] **Step 3:** In `portfolio-3d.css`, delete the two `.wcard-learned` rules (`.wcard-learned { … }` and `.wcard-learned b { … }`) and append after the `.wx-learned span` rule:

```css
.wx-learned-label { display: block; margin-top: 26px; color: var(--theme, #4d8cff); font-size: 0.62rem; letter-spacing: 0.26em; text-transform: uppercase; opacity: 0.8; }
.wx-learned { margin-top: 10px; }
```

- [ ] **Step 4:** Verify: `document.querySelectorAll('.wcard-learned').length` → 0; `document.querySelectorAll('#featured-grid .wcard-tags').length` → 3; `document.querySelectorAll('.wx-learned-label').length` → 3; open the myplan story → label renders above the chips. Console clean.
- [ ] **Step 5:** Commit: `git add index.html portfolio-3d.css && git commit -m "Cards: skills as bracket tags; the labeled learned grid lives in the story"`

### Task 9: Auto slide-in when the desk appears

**Files:**
- Modify: `portfolio-3d.css` (`.work-grid` padding)
- Modify: `portfolio-3d.js` (replace the featured `ScrollTrigger.batch` with a desk-appear trigger)

- [ ] **Step 1:** In `portfolio-3d.css`, change `.work-grid` padding from `118vh 0 34vh` to `16vh 0 30vh` (the trio now sits on the first desk screen, over the ghost title).
- [ ] **Step 2:** In `portfolio-3d.js`, replace the featured half of the reveal block (the `gsap.set("#featured-grid .wcard", …)` + its `ScrollTrigger.batch(…)`) with:

```js
    // the trio slides in from the right BY ITSELF as soon as the desk locks —
    // no extra scrolling required. A beat of delay lets the title start typing
    // first so the entrance reads title → cards.
    if (!reduced) {
      gsap.set("#featured-grid .wcard", { opacity: 0, x: 120 });
      ScrollTrigger.create({
        trigger: "#work-desk",
        start: "top 55%",
        once: true,
        onEnter: () => gsap.to("#featured-grid .wcard", {
          opacity: 1, x: 0, duration: 0.85, ease: "power3.out",
          stagger: 0.18, delay: 0.35, overwrite: true, clearProps: "transform,opacity",
        }),
      });
    }
```

Keep the `#other-grid` batch for now — Task 10 removes it when the pane takes over. Note the featured and other reveals end up as two separate `if (!reduced)` blocks; that is fine.

- [ ] **Step 3:** Verify: initial `gsap.set` state (`getComputedStyle(...).opacity === "0"`); `grep -n "work-desk" portfolio-3d.js` shows the new trigger; scroll-feel lands on Jordan in Task 7. Console clean.
- [ ] **Step 4:** Commit: `git add portfolio-3d.css portfolio-3d.js && git commit -m "Featured trio slides in on its own when the desk appears"`

### Task 10: Right-edge arrow + swipe pane for other projects

**Files:**
- Modify: `index.html` (restructure inside `#work-grid`)
- Modify: `portfolio-3d.css`
- Modify: `portfolio-3d.js` (pane toggle; drop the `#other-grid` scroll batch)

**Interfaces:** produces `#work-panes`, `#pane-featured`, `#pane-others`, `#pane-next`, `#pane-back`; class `.is-active` marks the visible pane. Deep links and `openStory` are unaffected (cards keep their ids).

- [ ] **Step 1:** Restructure `index.html` inside `#work-grid` to:

```html
        <div class="work-grid" id="work-grid">
          <div class="work-panes" id="work-panes">

            <div class="work-pane is-active" id="pane-featured">
              <span class="work-label mono">FEATURED</span>
              <div id="featured-grid">
                <!-- the three existing article.wcard-featured cards, unchanged -->
              </div>
            </div>

            <div class="work-pane" id="pane-others" aria-hidden="true">
              <span class="work-label mono">OTHER PROJECTS</span>
              <div id="other-grid">
                <!-- the four existing a.wcard-mini cards, unchanged -->
              </div>
            </div>

          </div><!-- /work-panes -->

          <button class="pane-arrow arrow-next" id="pane-next" type="button" aria-label="See other projects">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
            <span class="mono">other<br>projects</span>
          </button>
          <button class="pane-arrow arrow-back" id="pane-back" type="button" aria-label="Back to featured projects" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
            <span class="mono">featured</span>
          </button>
        </div><!-- /work-grid -->
```

Move (do not rewrite) the existing featured cards and mini cards into their panes. Delete the old standalone `work-label` lines. `id="work-grid"` stays on the wrapper.

- [ ] **Step 2:** CSS — replace the `.work-label-other` rule and add the pane/arrow system (append to the featured section):

```css
/* ---- panes: featured <-> others swipe ---- */
.work-panes { position: relative; display: grid; overflow: hidden; }
.work-pane {
  grid-area: 1 / 1; min-width: 0;
  transform: translateX(0); opacity: 1;
  transition: transform 0.55s cubic-bezier(.6,.05,.25,1), opacity 0.4s, visibility 0s 0s;
}
.work-pane:not(.is-active) { pointer-events: none; visibility: hidden; opacity: 0; transition: transform 0.55s cubic-bezier(.6,.05,.25,1), opacity 0.4s, visibility 0s 0.55s; }
#pane-featured:not(.is-active) { transform: translateX(-8%); }
#pane-others:not(.is-active) { transform: translateX(8%); }

.pane-arrow {
  position: absolute; top: 50%; right: -14px; transform: translateY(-50%);
  z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 18px 10px; background: none; border: 0; cursor: pointer;
  color: #8fa2c4; font-size: 0.6rem; letter-spacing: 0.22em; line-height: 1.5;
  transition: color 0.25s, transform 0.25s;
}
.pane-arrow svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pane-arrow::before {
  content: ""; position: absolute; inset: -12px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(120,150,220,0.22), transparent 72%);
  opacity: 0; transition: opacity 0.3s; z-index: -1;
}
.pane-arrow:hover { color: #eaf2ff; transform: translateY(-50%) translateX(3px); }
.pane-arrow:hover::before { opacity: 1; }
.arrow-back { right: auto; left: -14px; }
.arrow-back:hover { transform: translateY(-50%) translateX(-3px); }
.pane-arrow[hidden] { display: none; }
```

Also delete the now-dead `.work-label-other { margin-top: 72px; }` rule and, in the two `@media` blocks, any `#other-grid` column overrides stay as-is (they still apply inside the pane).

- [ ] **Step 3:** JS — in `portfolio-3d.js`: delete the `#other-grid` `gsap.set` + `ScrollTrigger.batch` block (the pane swipe replaces it), and add after the expansion module:

```js
  /* ---------------- work panes: featured <-> other projects ---------------- */
  const paneFeat = document.getElementById("pane-featured");
  const paneOthers = document.getElementById("pane-others");
  const paneNext = document.getElementById("pane-next");
  const paneBack = document.getElementById("pane-back");
  if (paneFeat && paneOthers && paneNext && paneBack) {
    function showPane(others) {
      paneFeat.classList.toggle("is-active", !others);
      paneOthers.classList.toggle("is-active", others);
      paneFeat.setAttribute("aria-hidden", others ? "true" : "false");
      paneOthers.setAttribute("aria-hidden", others ? "false" : "true");
      paneNext.hidden = others;
      paneBack.hidden = !others;
      (others ? paneBack : paneNext).focus();
    }
    paneNext.addEventListener("click", () => showPane(true));
    paneBack.addEventListener("click", () => showPane(false));
  }
```

- [ ] **Step 4:** Verify in the preview: initial state (featured active, next arrow visible, back hidden); `document.getElementById('pane-next').click()` → others pane `.is-active`, aria-hidden flipped, back arrow visible, 4 mini cards present and clickable; `pane-back.click()` → featured returns; story expansion still opens from featured pane; console clean.
- [ ] **Step 5:** Commit: `git add index.html portfolio-3d.css portfolio-3d.js && git commit -m "Other projects live behind a right-edge arrow — the work area swipes between panes"`

### Task 7 (amended scope)

Task 7's matrix additionally covers: auto slide-in setup state, pane swipe round-trip, arrow hover glow (screenshot), story expansion from both panes' context, and a dedicated mobile pass at 375×812 — panes swipe correctly, arrows are reachable and not overlapping cards (shrink/offset via a `@media (max-width: 720px)` tweak if needed: `.pane-arrow { right: -6px; padding: 12px 6px; }` / `.arrow-back { left: -6px; }`), story sheet still full-screen, and the trio's auto slide-in fires at phone width.

## Amendment round 2 — 2026-08-07 (Tasks 11–15)

Jordan's feedback after using the built version (see spec Amendments round 2). Execution order: 11 → 12 → 13 → 14 → 15.

### Task 11: Desk pacing + edge entrance + bigger cards

**Files:** Modify `portfolio-3d.css`, `portfolio-3d.js`.

- [ ] **Step 1 (CSS):** In `.work-grid` (base rule): change padding to `padding: 96vh 0 30vh;` with comment `/* top: a beat of desk — title + particles — before the cards' zone · bottom: exit beat */`. (Execution note: the amendment originally said 52vh, which put the trigger BEFORE desk lock — cards animated during the dive tail. 96vh keeps the grid below the fold at lock.) Change `max-width: min(1560px, 92vw)` to `max-width: min(1680px, 93vw)`. In the 900px media block set `.work-grid { padding: 70vh 4vw 26vh; }`. Change `.wcard-featured` min-height to `min(600px, 68vh)`. In `.work-panes` DELETE `overflow: hidden;` (comment: `/* no overflow clip here: entering cards fly in from beyond the viewport edge; .work-desk clips at the viewport instead */`) and add `z-index: 2;`. Add directly above the `.work-backdrop` rule: `.work-desk { overflow-x: clip; }  /* clip at the viewport edge: entering cards fly in from past it, and the parked pane's 8% offset must not widen the page. clip (not hidden) so the sticky backdrop keeps sticking */` — body's overflow-x:hidden does NOT contain the pane transforms (measured; scrollX genuinely moved), and `clip` avoids both the scrollbar and the sticky-breaking behavior of `hidden`.
- [ ] **Step 2 (JS):** Replace the featured reveal block (currently `gsap.set` + named `featIn`/`featST` with `trigger: "#work-desk", start: "top top"` + progress catch-up) with:

```js
    // the trio flies in from BEYOND the right edge of the screen once you've
    // scrolled a beat into the desk — the dark desktop (title + particles)
    // gets a moment to exist before the windows arrive.
    if (!reduced) {
      const featIn = () => gsap.to("#featured-grid .wcard", {
        opacity: 1, x: 0, duration: 1.0, ease: "power3.out",
        stagger: 0.18, overwrite: true, clearProps: "transform,opacity",
      });
      gsap.set("#featured-grid .wcard", { opacity: 0, x: () => window.innerWidth });
      const featST = ScrollTrigger.create({
        trigger: "#featured-grid",
        start: "top 80%",
        once: true,
        onEnter: featIn,
      });
      // refresh-mid-page: scroll restoration can land past the trigger before it
      // exists — a crossing that already happened never fires onEnter.
      if (featST.progress > 0) { featST.kill(); featIn(); }
    }
```

- [ ] **Step 3 (verify):** preview reload (cache-bust v71 css / v74 js): at desk lock cards NOT visible (`getComputedStyle(...).opacity === "0"` while `#featured-grid` is below 82%); pre-reveal `gsap.getProperty(document.querySelector('#featured-grid .wcard'), "x")` ≥ `innerWidth`; after scrolling the grid into 82% + manual ticks, all three settle opacity 1; `document.documentElement.scrollWidth === document.documentElement.clientWidth` (no horizontal overflow) both before and during entrance; pane swipe round-trip still clean without the overflow clip; console clean.
- [ ] **Step 4:** Commit `portfolio-3d.css portfolio-3d.js`: "Desk gets its beat back; cards fly in from past the screen edge, larger"

### Task 12: Arrow clearance + sunset edge gradient

**Files:** Modify `portfolio-3d.css`, `portfolio-3d.js`.

- [ ] **Step 1 (CSS):** In `.pane-arrow` change `right: -14px;` to `right: calc(50% - 50vw + 8px);` (containing block is the centered `.work-grid`, so this anchors to the viewport edge). In `.arrow-back` change `left: -14px` to `left: calc(50% - 50vw + 8px);`. (The 720px mobile block's `right/left: -6px` overrides stay — they come later in the file.) Then add after the `.pane-arrow[hidden]` rule:

```css
/* sunset band: light rising from the screen edge that says "there's more over
   here" — sits under the cards (panes z2, arrows z3), flips sides with the pane */
#work-grid::before {
  content: ""; position: absolute; top: 0; bottom: 0; z-index: 1;
  right: calc(50% - 50vw); width: 24vw;
  background: linear-gradient(270deg, rgba(77, 163, 255, 0.16), rgba(77, 163, 255, 0.05) 45%, transparent);
  opacity: 0.65; transition: opacity 0.35s; pointer-events: none;
}
#work-grid.others-active::before {
  right: auto; left: calc(50% - 50vw);
  background: linear-gradient(90deg, rgba(77, 163, 255, 0.16), rgba(77, 163, 255, 0.05) 45%, transparent);
}
#work-grid:has(.pane-arrow:hover)::before { opacity: 1; }
```

(`::before` not `::after` — `::after` on `#work-grid` would paint above the panes regardless of z-index tricks in some stacking orders; `::before` + explicit z-indexes is deterministic: band 1, panes 2, arrows 3.)
- [ ] **Step 2 (JS):** In `showPane`, after the two `classList.toggle` lines add: `document.getElementById("work-grid").classList.toggle("others-active", others);`
- [ ] **Step 3 (verify):** arrow rect fully right of the Process card rect (`arrow.left >= processCard.right`); band pseudo present (`getComputedStyle(workGrid,'::before').width` ≈ 24vw) on the right; after `pane-next.click()` the band flips left (`::before` left offset 0-ish, right auto); hover intensify via `:has` (`opacity` 0.65 → 1 when hovering the arrow); band never intercepts clicks; console clean.
- [ ] **Step 4:** Commit: "Arrow owns the screen edge; a sunset band hints at the other pane"

### Task 13: Click model — title links, card expands

**Files:** Modify `index.html`, `portfolio-3d.css`, `portfolio-3d.js`.

- [ ] **Step 1 (HTML):** Wrap each featured card's `<h3>` text in a link (3 cards, hrefs = the card's `data-href` values):
  - myplan: `<h3><a class="wcard-title-link" href="https://myplan.jordanheaton.com/" target="_blank" rel="noopener">myplanBYU — Degree Optimizer</a></h3>`
  - universe: `<h3><a class="wcard-title-link" href="Universe%20scroller/index.html" target="_blank" rel="noopener">Universe Scroller</a></h3>`
  - process: `<h3><a class="wcard-title-link" href="Process%20Analysis%20Project/index.html" target="_blank" rel="noopener">Process Improvement Analysis</a></h3>`
- [ ] **Step 2 (CSS):** Append near the featured-card styles:

```css
.wcard-featured { cursor: pointer; }  /* the whole card opens the story; links inside keep their own jobs */
.wcard-title-link { color: inherit; transition: color 0.2s; }
.wcard-title-link:hover { color: var(--theme, #4d8cff); text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 2px; }
```

- [ ] **Step 3 (JS):** In the expansion module's wiring loop (`document.querySelectorAll(".wcard-featured").forEach((card) => { ... })`), add inside the loop:

```js
      // click anywhere on the card = open the story; real links (title, CTA)
      // and the explicit buttons keep their own behavior.
      card.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        openStory(card);
      });
```

- [ ] **Step 4 (verify):** clicking card padding/blurb/stats opens the story; clicking the title does NOT open the story (and its href is the live project); `> open_project` still a link; read button + max dot still open; after Task 14 lands, the title link inside the open window still points at the live project; console clean.
- [ ] **Step 5:** Commit: "Titles link to the live projects; the rest of the card opens the story"

### Task 14: Presentation continuity in the expansion

**Files:** Modify `portfolio-3d.js`, `portfolio-3d.css`.

- [ ] **Step 1 (JS, openStory):** After `const content = card.querySelector(".wexp-content"); if (!content) return;` add `const body = card.querySelector(".wcard-body");`. Replace the single move (`wmaxBody.appendChild(content); content.hidden = false;`) with:

```js
    if (body) wmaxBody.appendChild(body);   // the card's presentation rides along —
    wmaxBody.appendChild(content);          // the window IS the card, expanded
    content.hidden = false;
```

- [ ] **Step 2 (JS, closeStory `finish`):** Replace the content-return block (`const content = wmaxBody.querySelector(".wexp-content"); if (content) { content.hidden = true; card.appendChild(content); }`) with:

```js
      const body = wmaxBody.querySelector(".wcard-body");
      if (body) card.insertBefore(body, card.querySelector(".wcard-foot"));
      const content = wmaxBody.querySelector(".wexp-content");
      if (content) { content.hidden = true; card.appendChild(content); }
```

- [ ] **Step 3 (CSS):** Append to the maximize-window section:

```css
/* the card's presentation block, as it appears inside the opened window */
#wmax-body .wcard-body { padding: 28px 0 0; }
#wmax-body .wcard-body h3 { font-size: clamp(2rem, 3.4vw, 2.8rem); }
#wmax-body .wcard-blurb { max-width: 62ch; }
```

- [ ] **Step 4 (verify):** open myplan: `#wmax-body` children in order = `.wcard-body`, `.wexp-content`; window shows kind → title(link) → blurb → stat chips → bracket tags → learned label/grid → six write-up sections; close: card intact (`#card-myplan .wcard-body` back between bar and foot, h3 link present, stats/tags in place); repeat round-trip twice on the same card (idempotent); all three cards; deep link `#universe` shows the same continuity; console clean.
- [ ] **Step 5:** Commit: "Opening a story keeps the card's face — the window is the card, expanded"

### Task 15: Round-2 verification + cache-bust + gate

As Task 7's matrix, plus: desk beat (cards absent at lock, present after the grid's zone enters), edge entrance, arrow clearance + band behavior both panes, click model, continuity round-trips, no horizontal overflow anywhere, full mobile pass (pill, edge entrance, sheet, band width on small screens — clamp or hide the band under 720px if it crowds: `@media (max-width: 720px) { #work-grid::before { width: 30vw; opacity: 0.5; } }` is pre-authorized if needed). Bump `?v=71 → ?v=72` and `?v=74 → ?v=75`. Jordan reviews on a visible tab.

## Self-review notes (already applied)

- **Spec coverage:** featured trio + blurbs + stat chips + learned rows (T1), other strip + numbering (T2), slide-from-right + reduced-motion (T3), maximize window + media slot + learned grid + chrome (T4), open/close/Esc/backdrop/focus/scroll-lock/hash/one-at-a-time (T5), deep links + scroller retarget + writeup.html deletion (T6), verification matrix + cache-bust + Jordan gate (T7). Videos/Higgsfield: out of scope per spec.
- **The `#work-grid` gate and the boot early-`return`** are the two landmines; both are Global Constraints and repeated at their point of impact.
- **Type consistency:** `openStory(cardEl)` / `closeStory()` / `WMAX_SLUGS` defined in T5, consumed in T6 within the same IIFE scope. Card ids `card-myplan|card-universe|card-process` consistent across T1/T5/T6. Section counts used in assertions: myplan 6, universe 6, process 5 — match the markup in T1.
