# Bento Portfolio Redesign — Implementation Blueprint

**For:** the implementing session (Opus). This plan was authored after reviewing the current site and Jordan's reference images/notes. Follow it as the source of truth; where it says "your call," use taste consistent with the design language below.

---

## 1. Goal

Rebuild the portfolio **hub page only** (`Portfolio/index.html` + `portfolio.css` + `portfolio.js`) as a single-viewport **bento grid**: dark, techy, clean, purple-forward with warm accent glows. Think "PromptPal bento" (reference image 1) — glassy rounded tiles on a near-black canvas, a circular profile photo at the center with glowing circuit nodes/traces radiating outward and *engulfing* the photo, and 3D keycaps drifting down the background that occasionally cut in front of the tiles.

The subpages (Scholarship Matcher, Liquid Simulator, IS 201 pages, Process Analysis) are **not** touched.

## 2. Hard constraints (do not violate)

1. **No text changes.** Every user-visible string comes verbatim from the current `index.html` (inventory in §6). Do not write new bio copy, new taglines, or new stat claims. Do not invent credentials (Jordan is *working toward* Marriott, not in it; no skill claims beyond the existing skills list).
2. **Exclude myplanBYU** from the visible page for now (no card, no link). Keep its files untouched on disk; leave an HTML comment where its card would go so it's easy to re-add.
3. **Keep the typewriter** — "I'm a `___`" with the same six roles and the same type/delete rhythm (current `portfolio.js:38-67`).
4. **Vanilla HTML/CSS/JS, no build step.** This deploys as a static folder (GitHub Pages, `.nojekyll` present). No frameworks, no bundler, no npm.
5. **Same three files.** Rewrite `index.html`, `portfolio.css`, `portfolio.js` in place. The folder is a git repo — commit the old version first (`git add -A && git commit`) so nothing is lost; don't create `.bak` files.
6. **Respect `prefers-reduced-motion`**: freeze keycap fall, node pulses, and typewriter (show full first role) when set.
7. Paths contain spaces (OneDrive + folder names) — keep the existing URL-encoded href style (`BYU%20Scholarship%20Matcher/...`).

## 3. Design language

Replace the current navy/teal palette with a violet/indigo system matching the reference boards. Define everything as tokens at the top of `portfolio.css`:

```css
:root {
  --bg: #08070f;            /* near-black with violet cast */
  --bg-2: #0d0b1a;
  --tile: rgba(22, 19, 40, 0.55);       /* glass tile fill */
  --tile-solid: #141126;
  --tile-hi: rgba(139, 108, 255, 0.08); /* hover wash */
  --border: rgba(148, 128, 255, 0.14);
  --border-strong: rgba(148, 128, 255, 0.45);
  --text: #eceaf6;
  --muted: #9a94b8;
  --accent: #8b6cff;        /* primary purple */
  --accent-2: #b79bff;      /* light purple */
  --warm: #ff9d5c;          /* keycap / node ember-orange glow */
  --grad: linear-gradient(135deg, #8b6cff 0%, #c084fc 55%, #ff9d5c 130%);
}
```

- **Typography:** keep Space Grotesk (display) + Inter (body), already loaded. Name headline is the biggest element on the page.
- **Tile anatomy:** `border-radius: 22px`, 1px `--border`, subtle inner top-edge highlight (`inset 0 1px 0 rgba(255,255,255,.04)`), `backdrop-filter: blur(14px)`, generous padding (≈24–28px). On hover: border brightens, faint radial glow follows the cursor (port the existing `--mx/--my` glow from `portfolio.js:30-36`), tile lifts ~2px. Keep it restrained — clean beats busy.
- **The whole grid sits inside one dark rounded "tray"** with ~14px gap between tiles, like the reference — page background visible around it.
- Font Awesome 6.4 is already linked; keep using it for icons.

## 4. Grid blueprint

Desktop (≥1100px): CSS Grid, 4 columns via `grid-template-areas`. Target ~100vh but let it scroll if it must — don't crush content.

```
┌────────────┬───────────────────────────┬────────────┐
│ INTRO      │ HERO  (name + typewriter, │ STAT-GPA   │
│ (kicker,   │  photo orb docked at the  ├────────────┤
│  lead)     │  tile's bottom edge)      │ STATS      │
├────────────┤─────────────┬─────────────┤ (badges)   │
│ ABOUT      │ PROJECTS    │ EXPLORE     ├────────────┤
│ (bio, ex-  │ (expanding  │ (command-   │ CONTACT    │
│  pandable) │  gallery)   │  palette    ├────────────┤
├────────────┤             │  links)     │ RÉSUMÉ     │
│ SKILLS     │             │             │            │
└────────────┴─────────────┴─────────────┴────────────┘
```

- **The photo orb is the centerpiece.** A circular photo (~180px, `DSC00294_2.jpg` — it's the 500KB optimized one; do NOT ship the 23MB `DSC00294.jpg`) sits at the seam between HERO and the PROJECTS/EXPLORE row, overlapping both (negative margin / absolute positioning, `z-index` above tiles). Around it, an SVG layer draws **circuit traces**: lines elbowing out from the orb's ring into the neighboring tiles, ending in small glowing node dots (mix of `--accent` and `--warm`), exactly like reference 1. Animate a slow pulse traveling along 2–3 traces (SVG `stroke-dashoffset` loop). The orb ring itself: 2px gradient ring + soft outer glow.
- Tablet (700–1100px): 2 columns; HERO full-width on top, orb centered on its bottom edge. Mobile (<700px): single column, orb between HERO and PROJECTS; keycap background density halved.
- A slim top bar (not the current fixed nav): "JH Jordan Heaton" brand left, socials right. The old in-page nav links die — the bento *is* the page.

## 5. Tile-by-tile spec

### HERO (center, large)
- Kicker line with the ping dot: "Brigham Young University · Provo, UT".
- `Hi, I'm Jordan Heaton.` — name in `--grad` gradient text.
- `I'm a <span class="rot">` typewriter (same roles/timing).
- Photo orb docked at bottom edge (see §4).

### INTRO (top-left)
- The `lead` paragraph ("I'm a curious business student…") and the `mission` paragraph. If both make the tile heavy, show lead + tuck mission behind a subtle "mission" toggle within the tile — text itself unchanged.

### STAT-GPA (top-right) — the "25M created prompts" moment
- Huge gradient `3.98`, label `Cumulative GPA`, with the bracket/caret ornaments like the reference.

### STATS (right, small)
- The other three stats as compact rows or mini-chips: `National / Vice-Champion, Ballroom`, `EN / ES / Fluent in Spanish`, `Europe / Business Study Abroad`.

### ABOUT (left, mid) — expandable
- Header "A little about me" (+ eyebrow "About"). Shows paragraph 1 of the bio; a "read more" affordance expands the tile in place (grid row auto-grows, smooth `grid-template-rows`/height transition) to reveal paragraphs 2–3. All three paragraphs verbatim, `<strong>` tags preserved.

### SKILLS (left, bottom)
- The 9 existing skill chips (minus nothing, plus nothing), small pill style. If space is tight, this can merge into ABOUT's expanded state — your call.

### PROJECTS (center-left, tall) — the expanding gallery ⭐
The signature interaction.

**Collapsed:** icon (`fa-diagram-project` or similar), title "Projects & experiments", the section blurb ("A mix of things I've built…"), and a row of 6 mini project icons hinting at the contents. A `+`/expand affordance. Entire tile is a button (`aria-expanded`).

**Expanded:** the tile grows to cover the full grid tray (position it `absolute`/`fixed` within the tray with a FLIP-style scale/position transition from its collapsed rect — animate `transform`, not layout). Inside:
- Header + close `×` (Esc also closes; focus is trapped while open; focus returns to the tile on close).
- A **horizontal slider gallery** of the 6 project cards (all current cards except myplanBYU): AI Scholarship Matcher, Liquid Simulator, Interactive Résumé, BYU Target Chaser, Process Improvement Analysis, The Art of Ballroom. Use CSS scroll-snap (`scroll-snap-type: x mandatory`) + prev/next arrow buttons; center card full-opacity, neighbors slightly dimmed/scaled (the "Save your files" carousel feel).
- Each card: **background image** with a dark gradient scrim, then kind-tag, title, description, tech tags — all verbatim from §6. Card click opens the project (same hrefs, `target="_blank"`).
- **Card background images:** generate real screenshots. Start each project page with the preview server (there are `serve.ps1`/launch configs in the repo, or serve the Portfolio root statically), `preview_screenshot` each of the 6 targets, save as JPEG ~800px wide into a new `Portfolio/assets/thumbs/` folder. For the two document-ish pages a partial-page screenshot is fine. If a screenshot fails, fall back to a per-project CSS gradient + oversized icon — but try screenshots first; they make the gallery.

### EXPLORE (center-right) — command-palette links tile ⭐
Styled like the Hypercal keyboard-shortcuts reference: a faux command-palette list with a keycap on the right of each row, and **the shortcuts actually work**.

Rows (grouped under a small `ACTIONS`-style label):
| Row | Action | Key |
|---|---|---|
| Open résumé (PDF) | `Resume/Jordan_Heaton_Resume.pdf`, new tab | `R` |
| Email me | `mailto:jordandheaton@gmail.com` | `E` |
| LinkedIn | existing LinkedIn URL, new tab | `L` |
| Open projects | expands the PROJECTS tile | `P` |
| About me | expands the ABOUT tile | `A` |

- Global `keydown` listener; **ignore** events when a modifier is held or `event.target` is an input/textarea/contenteditable. On press, briefly flash the matching row (`:active` style) then perform the action.
- Keycap chips: small rounded squares, 1px border, faint bottom shadow so they read as physical keys.
- A caption under the list, reference-style, e.g. reuse no new copy — a simple `Keyboard shortcuts` label is fine (UI label, not content copy).

### CONTACT (right, mid)
- "Let's build something." headline + the contact paragraph, email + LinkedIn buttons, and the plain-text email link — all current strings.

### RÉSUMÉ (right, bottom)
- "Résumé" with two pill buttons: `Download PDF` (existing PDF href) — style like the glowing "Generate" button in reference 1. (Only the PDF exists publicly; don't link the .docx.)

### FOOTER
- Slim line under the tray: `© <year> Jordan Heaton · Built from scratch with HTML, CSS & JavaScript` (keep the JS year fill).

## 6. Content inventory (verbatim sources in current `index.html`)

Everything you need is in the pre-redesign `index.html` (committed before you start): kicker (line 35), h1 (36), roles (portfolio.js 39–46), lead (38–41), mission (42–46), work section blurb (64–66), six project cards **excluding myplanBYU** (70–76, 86–124), about paragraphs (137–157), four stats (158–163), nine skills (170–180), contact block (185–195), footer (199). Socials: LinkedIn `https://linkedin.com/in/jordan-heaton-589a36405`, `mailto:jordandheaton@gmail.com`, `Resume/Jordan_Heaton_Resume.pdf`.

## 7. Falling keycaps background

Replaces the constellation canvas. Two layers sandwiching the bento tray:

- `#keys-back` canvas: `z-index` below the tray. ~10–14 keycaps on desktop.
- `#keys-front` canvas: `z-index` **above** the tray, `pointer-events: none`, only 2–3 keys at a time, slightly larger/sharper — this is the "cuts into the foreground" effect from the reference. Keep them subtle (≈0.5–0.7 opacity) so they never fight legibility; make sure they're drawn behind nothing interactive visually confusing (they're non-interactive by construction).
- **Keycap rendering:** draw in 2D canvas as rounded-rect "caps" with a lighter top face, 1px border, purple rim-light on one edge and a faint warm glow on another, each with a random slight rotation and a glyph (mix of: `⌘`, `⇧`, `K`, `J`, `H`, `↵`, `esc`, `tab`). Pseudo-3D via a darker offset "side" rect under the cap. No images needed.
- **Motion:** slow fall (15–40s per screen traversal) with gentle rotation drift and slight horizontal sway; respawn above the viewport with randomized params. Front-layer keys fall marginally faster (parallax). Cap `devicePixelRatio` at 2, pause the rAF loop when `document.hidden`, and render one static scatter under reduced-motion.

## 8. Implementation order

Work in the `Portfolio/` root (this is the deployable folder).

1. `git add -A && git commit` the current state.
2. **Screenshots first** (§5 PROJECTS) → `assets/thumbs/`. Static-serve the Portfolio root for this.
3. Static structure: new `index.html` with full bento markup + all verbatim content; new `portfolio.css` tokens, tray, grid areas, tile anatomy, responsive breakpoints.
4. Photo orb + SVG circuit traces/nodes.
5. `portfolio.js` rewrite: typewriter (port as-is), tile cursor-glow (port), year fill (port), keycap canvases, PROJECTS expand/collapse + gallery, ABOUT expand, command-palette shortcuts.
6. Polish pass: hover states, focus-visible rings on every interactive element, tab order, `aria-expanded`/`role=dialog` on the expanded projects view, Lighthouse-style sanity check.
7. **Verify with preview tools** (don't ask the user to check): snapshot for structure, click the PROJECTS tile and screenshot expanded gallery, test `R`/`P`/Esc keys, `preview_resize` mobile + reduced expectations, console clean. Screenshot proof at desktop and mobile.
8. Commit. (Push only if asked.)

## 9. Definition of done

- [ ] Bento grid matches §4 at desktop/tablet/mobile; page is clean, purple/dark, glassy.
- [ ] Photo orb centered with animated circuit nodes engulfing it.
- [ ] PROJECTS tile expands via smooth FLIP into a scroll-snap gallery of 6 image-backed cards; Esc/× closes; focus managed.
- [ ] EXPLORE tile looks like a command palette and keys R/E/L/P/A genuinely work (and never fire while typing/with modifiers).
- [ ] Keycaps fall on both background and foreground layers; reduced-motion shows a static page.
- [ ] Typewriter unchanged in content and feel.
- [ ] Zero text drift from the inventory in §6; myplanBYU absent but files intact (HTML comment placeholder present).
- [ ] No console errors; no asset > ~600KB shipped on the hub page.
