"""Captures myplanBYU scenes as deterministic 60fps frame sequences + event logs.
Usage: python capture_myplan.py [--scene s1|s2|...|s10|all] [--debug]
`--scene` also accepts a comma-separated list (e.g. `--scene s1,s8`) so a
single scene can be iterated on without re-running the whole session.
Requires the serve.ps1 server (the script starts it if port 8130 is closed).

s4/s9 (course modals), s5/s10 (AI advisor) and s8 (drag) all need a solved
plan already on #board in this Chrome session -- `--scene all` runs s1 first
and is the canonical flow. Running one of them alone (for iteration) needs a
prior `all`/`s1` run's board still on screen from a warm server; from a fresh
page load #board is empty and the course-card selectors will fail their
assert. s6/s7 need a SECOND, freshly-opened wizard (see the `all` block) --
running them alone needs `--scene s1,s6` etc. so the wizard exists at all.

Every scene from s4 onward opens with CLOSE_OVERLAYS_JS: a scene run in
isolation, or reordered, may find the wizard/course-modal/chat-panel left
open (or the chat transcript non-empty) by whatever scene ran before it in
THIS session -- each sensitive scene resets that state itself at frame 0
rather than relying on the scene before it to have cleaned up, so ordering
in the `all` block is a narrative choice, not a correctness dependency."""
import argparse, json, math, os, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from cdp import Chrome

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(os.environ["TEMP"], "showcase", "myplan")
EVENTS_DIR = os.path.join(HERE, "..", "raw", "events")
URL = "http://localhost:8130/index.html"
MAJOR = "Information Systems"

# s4: course card whose modal shows the richest section/seat-count content.
# Discovery (see .superpowers/sdd/task-r2-report.md): every card in the Fall
# 2026 (first, index-0) column shows a "confirmed for Fall 2026" roster,
# because that is the only term BYU has actually posted a class schedule
# for -- later terms fall back to "latest roster" or historical data. Of
# that column's three cards, WRTG 150 (First-year Writing) has by far the
# richest live roster (61 named instructors, "+58 more"), and its scheduled
# term matches Jordan's own description ("Fall 2026 sections") exactly.
S4_COURSE_UID = "WRTG 150"

# s5: REAL question + answer, copied verbatim (no paraphrase) from
# myplanBYU/scraper/eval/transcript_20260727-1025.md, case "credits-acc200"
# (grounding query, Checks: passed). Segmented on the source's own **bold**
# markdown spans so a deterministic mid-answer reveal cut can never split a
# tag in half.
S5_QUESTION = "How many credits is ACC 200 and when is it offered?"
S5_ANSWER_SEGMENTS = [
    (False, "According to the Context, "),
    (True, "ACC 200 (Principles of Accounting) is 3 credits"),
    (False, " and is "),
    (True, "offered all semesters/terms"),
    (False, "."),
]
S5_ANSWER_SOURCES = ["Principles of Accounting", "Introduction to Accounting 2",
                     "Financial Accounting 2", "Principles of Acctg 2"]

# s9: recapture of the s4 pattern, but on ACC 200 -- confirmed live it sits in
# the solved IS plan's Winter 2027 column (Requirement 1.1) with a rich modal
# (named, "confirmed for Winter 2027" instructors; prereqs none; MAP-sheet
# "why it's here"), so no discovery risk like s4's original term-column dance.
S9_COURSE_UID = "ACC 200"

# Second wizard pass (s6/s7): openWizard() with no arg always starts a FRESH
# profile (majorId null, completed []) at wizStep 0 -- confirmed by reading
# app.js -- so reopening #newPlanBtn mid-session can never disturb the
# already-solved plan sitting on #board; we just never click through to
# "Generate plan" a second time, and close the modal by force at the start of
# the next overlay-sensitive scene (CLOSE_OVERLAYS_JS below) instead of
# fighting tryCloseWizard()'s confirm() dialog (which headless Chrome has no
# handler for and would hang on).
#
# "Information Systems (BS)" is the exact program name as DATA.majors and the
# browse-all dropdown render it (confirmed live: `.ss-item b` textContent) --
# distinct from the sibling "... -- Integrated MISM Track" entry.
MAJOR_FULL_NAME = "Information Systems (BS)"
PICK_IS_AND_ADVANCE_JS = (
    "[...document.querySelectorAll('#wsMajor .ss-list .ss-item')]"
    ".find(b=>b.querySelector('b')?.textContent===%s)?.click();"
    "document.querySelector('#wizNext').click();"
) % json.dumps(MAJOR_FULL_NAME)

# s6: a hand-composed transcript snippet in the exact shape scanTranscript()
# (app.js:2084) parses -- an uppercase SUBJECT then whitespace then a 3-digit
# NUMBER (its codeRe), and somewhere later on the same line a decimal
# credit-hours value immediately followed by a grade token (its per-line
# grade regex). Verified live via `App.scanTranscript(text)` (exposed on the
# App module): all three land in "graded" (0 in inProgress/excluded/unknown).
# Courses are real IS-freshman-year classes straight out of DATA.courses --
# WRTG 150, MATH 112, A HTG 100 -- none of them placeholders. (Quirk found
# live and left alone: the grade regex's trailing \b can never actually keep
# a trailing +/- -- "A-"/"B+" parse as grade "A"/"B" -- harmless here, since
# renderScanResult never displays the captured grade string at all, only the
# course id/name.)
S6_TRANSCRIPT_TEXT = (
    "BRIGHAM YOUNG UNIVERSITY - UNOFFICIAL TRANSCRIPT\n"
    "\n"
    "INSTITUTION CREDIT -- FALL SEMESTER 2025\n"
    "SUBJ   CRS    COURSE TITLE                    ATT     EARN   GRADE\n"
    "WRTG   150    Writing and Rhetoric            3.00    3.00     A\n"
    "MATH   112    Calculus 1                      4.00    4.00     A-\n"
    "A HTG  100    American Heritage               3.00    3.00     B+\n"
    "\n"
    "                         TERM TOTALS:        10.00   10.00\n"
)

# s10: REAL Q&A verbatim from myplanBYU/scraper/eval/transcript_20260727-1025.md,
# case "critique" (lines 297-309) -- "Critique my current plan. What's
# unrealistic about the pacing or sequencing?", the exact flavor of question
# the real #chatQuick "Critique my plan" chip sends (chat.js:290-291, data-q
# in index.html:290). Segment text is the real answer's opening sentence,
# verbatim, light tail-truncation at the next sentence boundary (the full
# case runs another ~700 characters of bulleted detail -- "Here's what's
# working:" plus four Strengths bullets -- which streamed at a readable pace
# does not fit an ~400-frame scene alongside open+click+hold; kept to the
# same on-screen scale as s5's proven ~90-char answer; see report for the
# fuller excerpt considered).
S10_ANSWER_SEGMENTS = [
    (False, "Your plan is "),
    (True, "well-structured and realistic"),
    (False, "—the planner has locked in the hard constraints correctly."),
]
S10_ANSWER_SOURCES = ["Information Systems Minor", "Group Dynamics",
                      "Learning Theory", "Directed Readings"]

# Belt-and-suspenders reset used at frame 0 of every scene from s4 onward
# (see module docstring): force-closes any modal/panel a differently-ordered
# or differently-scoped (`--scene s1,sN`) run might have left open, and wipes
# the chat transcript so s5/s10 never open onto a leftover conversation from
# whichever chat scene ran first in this session.
CLOSE_OVERLAYS_JS = (
    "document.querySelector('#wizardModal')?.classList.remove('open');"
    "document.querySelector('#courseModal')?.classList.remove('open');"
    "document.querySelector('#chatPanel')?.classList.remove('open');"
    "document.querySelector('#chatFab')?.classList.remove('hidden');"
    "(() => { const m = document.querySelector('#chatMsgs'); if (m) m.innerHTML = ''; })();"
)

# SAFETY (discovered live while building this scene): index.html sets
# window.MYPLAN_ADVISOR_API to a LIVE public endpoint
# (https://advisor.jordanheaton.com/api), NOT the offline localhost:5000
# default the advisor server itself defaults to -- opening the chat panel
# for real fires a real /health request, and clicking Send for real fires a
# real, billed, quota-metered /ask request against Jordan's production
# advisor. Installed once for the whole session (main(), before any scene
# runs) so no capture can ever reach it, regardless of which --scene is
# selected or where the cursor lands.
FETCH_GUARD_JS = """
    window.__advOrigFetch = window.fetch.bind(window);
    window.fetch = function(url, opts) {
      const u = String(url);
      if (u.includes('advisor.jordanheaton.com') || u.includes('127.0.0.1:5000')) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return window.__advOrigFetch(url, opts);
    };
"""

# Streams S5_ANSWER_SEGMENTS into a bot bubble built from chat.js's own
# markup (chat-msg bot / chat-srcs -- see chat.js addMsg() and the
# successful-reply path), a fixed number of visible characters at a time.
# Segment-aware so a reveal cut lands between segments, never mid-**tag**.
# __SEGMENTS__ / __SOURCES__ are replaced with json.dumps() output below.
ADV_BUBBLE_JS_TMPL = r"""
(() => {
  const msgs = document.querySelector('#chatMsgs');
  const el = document.createElement('div');
  el.className = 'chat-msg bot';
  const span = document.createElement('span');
  el.appendChild(span);
  const srcs = document.createElement('div');
  srcs.className = 'chat-srcs';
  srcs.style.opacity = '0';
  srcs.innerHTML = '<i class="fas fa-book"></i> Grounded in: ' +
    __SOURCES__.join(' · ');
  el.appendChild(srcs);
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  window.__adv = { segments: __SEGMENTS__, el: span, srcs: srcs };
  window.__adv.total = window.__adv.segments.reduce((s, x) => s + x.t.length, 0);
  window.__advReveal = function (n) {
    n = Math.max(0, Math.min(window.__adv.total, n));
    let remaining = n, html = '';
    for (const seg of window.__adv.segments) {
      if (remaining <= 0) break;
      const take = Math.min(seg.t.length, remaining);
      const chunk = esc(seg.t.slice(0, take));
      html += seg.b ? '<b>' + chunk + '</b>' : chunk;
      remaining -= take;
    }
    window.__adv.el.innerHTML = html;
    if (n >= window.__adv.total) window.__adv.srcs.style.opacity = '1';
    document.querySelector('#chatMsgs').scrollTop = document.querySelector('#chatMsgs').scrollHeight;
  };
  window.__advReveal(0);
})()
"""


def ensure_server():
    try:
        urllib.request.urlopen(URL, timeout=2)
        return None
    except Exception:
        p = subprocess.Popen(
            # -ExecutionPolicy Bypass is required on this machine: all policy
            # scopes are Undefined, which Windows PowerShell 5.1 resolves to
            # Restricted (no .ps1 execution at all) -- a bare `-File` launch
            # fails immediately with "running scripts is disabled on this
            # system" and this loop then times out. Bypass only affects this
            # one child process, not the user's shell / any persistent policy.
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
             os.path.join(ROOT, "myplanBYU", ".claude", "serve.ps1")],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(40):
            try:
                urllib.request.urlopen(URL, timeout=2)
                return p
            except Exception:
                time.sleep(0.5)
        raise RuntimeError("serve.ps1 never came up on :8130")


class Scene:
    """Steps virtual time; executes queued actions on their frame; logs events."""
    def __init__(self, c, name, frames):
        self.c, self.name, self.frames = c, name, frames
        self.dir = os.path.join(OUT, name)
        os.makedirs(self.dir, exist_ok=True)
        self.events = []
        self.actions = {}          # frame -> [fn]
        self.pos = (960, 540)

    def at(self, f, fn):
        self.actions.setdefault(f, []).append(fn)

    def hover(self, f, sel):
        def fn():
            r = self.c.rect(sel)
            assert r, f"selector not found: {sel}"
            self.c.mouse("mouseMoved", r["x"], r["y"])
            self.pos = (r["x"], r["y"])
            self.events.append({"f": f, "kind": "hover", "x": r["x"], "y": r["y"], "sel": sel})
        self.at(f, fn)

    def click(self, f, sel):
        def fn():
            r = self.c.rect(sel)
            assert r, f"selector not found: {sel}"
            self.c.click(r["x"], r["y"])
            self.pos = (r["x"], r["y"])
            self.events.append({"f": f, "kind": "click", "x": r["x"], "y": r["y"], "sel": sel})
        self.at(f, fn)

    def type(self, f, sel, text, step=2):
        """Focuses `sel` at frame f, then types `text` one character every
        `step` frames so the search box visibly fills in across the captured
        sequence (a single Input.dispatchKeyEvent burst would land the whole
        string between two frames -- correct per the JSON schema, but reads
        as a paste, not a type). Logs exactly one 'type' event at f, matching
        the schema (Cursor.stateAt only needs one positioned waypoint here)."""
        def focus():
            r = self.c.rect(sel)
            assert r, f"selector not found: {sel}"
            self.c.click(r["x"], r["y"])
            self.pos = (r["x"], r["y"])
            self.events.append({"f": f, "kind": "type", "x": r["x"], "y": r["y"], "text": text})
        self.at(f, focus)
        for i, ch in enumerate(text):
            self.at(f + i * step, (lambda ch=ch: self.c.type_text(ch)))

    def js(self, f, expr):
        self.at(f, lambda: self.c.eval(expr))

    def drag(self, f0, f1, src_sel, dst_js, steps=10):
        """Real HTML5 drag-and-drop via raw CDP mouse events: mousePressed on
        src_sel at f0, `steps` mouseMoved dispatches (button held) interpolated
        across f0..f1, then mouseReleased at f1 on the point dst_js (a JS
        expression evaluating to {x,y}, re-evaluated at every step so it
        tolerates reflow). Confirmed live (see task-r6 report) that Chrome's
        native HTML5 dragstart/dragover/drop DOES fire from a raw CDP mouse
        sequence -- no fallback needed -- PROVIDED one more mouseMoved lands
        (and one virtual-time step elapses) at the exact drop point
        immediately before mouseReleased: omitting that settle step made the
        drop silently no-op in live testing even though every earlier
        mouseMoved was dispatched and the card visibly tracked the cursor.
        Logs a 'click' event at grab (f0) and at drop (f1) -- so the
        compositor draws a press ripple at both ends -- and one 'hover' event
        per intermediate step so the cursor traces the real interpolated
        path, not a compositor-side straight line."""
        def start():
            r = self.c.rect(src_sel)
            assert r, f"selector not found: {src_sel}"
            self._drag_from = (r["x"], r["y"])
            self.c.mouse("mouseMoved", r["x"], r["y"])
            self.c.mouse("mousePressed", r["x"], r["y"], "left", 1)
            self.pos = (r["x"], r["y"])
            self.events.append({"f": f0, "kind": "click", "x": r["x"], "y": r["y"], "sel": src_sel})
        self.at(f0, start)

        span = max(1, f1 - f0)
        n = max(2, steps)
        for i in range(1, n):
            f = f0 + round(span * i / n)
            if f <= f0 or f >= f1:
                continue
            def moved(i=i):
                sx, sy = self._drag_from
                d = self.c.eval(dst_js)
                x = round(sx + (d["x"] - sx) * i / n)
                y = round(sy + (d["y"] - sy) * i / n)
                self.c.mouse("mouseMoved", x, y, "left")
                self.pos = (x, y)
                self.events.append({"f": f, "kind": "hover", "x": x, "y": y})
            self.at(f, moved)

        def release():
            d = self.c.eval(dst_js)
            # Settle at the exact drop point + one virtual-time tick BEFORE
            # releasing -- see docstring; this is not optional polish.
            self.c.mouse("mouseMoved", d["x"], d["y"], "left")
            self.c.vt_step(ms=16)
            self.c.mouse("mouseReleased", d["x"], d["y"], "left", 1)
            self.pos = (d["x"], d["y"])
            self.events.append({"f": f1, "kind": "click", "x": d["x"], "y": d["y"]})
        self.at(f1, release)

    def run(self):
        for f in range(self.frames):
            for fn in self.actions.get(f, []):
                fn()
            self.c.vt_step()
            self.c.shot_jpeg(os.path.join(self.dir, "f%05d.jpg" % f), quality=88)
            if f % 60 == 0:
                print("  %s %d/%d" % (self.name, f, self.frames))
        if self.events:
            os.makedirs(EVENTS_DIR, exist_ok=True)
            with open(os.path.join(EVENTS_DIR, self.name + ".json"), "w") as fh:
                json.dump({"fps": 60, "events": self.events}, fh, indent=1)


def wizard_advance(c, sc, f):
    """Click #wizNext at frame f (same button doubles as Back/Next/Generate
    across the wizard's 3 steps -- step 2's click solves and closes the
    modal). Returns the next slot."""
    sc.click(f, "#wizNext")
    return f + 55


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", default="all")
    ap.add_argument("--debug", action="store_true")
    a = ap.parse_args()
    # Comma-separated lists (e.g. "--scene s1,s8") let a single scene be
    # iterated on without re-running the whole session -- each Chrome launch
    # gets a FRESH temp profile (see tools/cdp.py), so localStorage/plan state
    # never survives across separate invocations; scenes that depend on a
    # solved board (s4/s5/s8/s9/s10) or an open wizard (s6/s7) must be listed
    # together with whatever earlier scene builds that state.
    scenes = set(a.scene.split(","))
    def want(name):
        return name in scenes or "all" in scenes
    server = ensure_server()
    c = None
    try:
        c = Chrome(port=9422, width=1920, height=1080)
        c.metrics(1920, 1080, dsf=2)
        c.goto(URL, settle=4.0)
        c.wait_expr("document.readyState==='complete' && !!document.querySelector('#board')")
        c.vt_pause()
        c.eval(FETCH_GUARD_JS)  # see FETCH_GUARD_JS comment -- installed once, covers every scene

        if want("s1"):
            sc = Scene(c, "s1", 600)
            sc.hover(20, "#newPlanBtn")
            sc.click(55, "#newPlanBtn")
            # Wizard step 0 ("Pick your programs") renders three searchSelect
            # widgets (#wsMajor, #wsMinors, #wsCerts), each its own
            # .ss-input/.ss-list/.ss-item -- #wizBody's generic `input`/`button`
            # would resolve ambiguously (the first plain `button` in the DOM
            # is actually "Browse all", not a program choice), so both
            # selectors below are scoped to #wsMajor specifically. Typing
            # "Information Systems" surfaces "Information Systems (BS)" as
            # the first hit (DATA.majors is name-sorted and "(BS)" sorts
            # before "(BS) -- Integrated MISM Track") -- confirmed live.
            sc.type(100, "#wsMajor .ss-input", MAJOR)
            sc.click(170, "#wsMajor .ss-list .ss-item")
            # Confirmed live: the wizard has exactly 3 steps (0/1/2). #wizNext
            # relabels to "Generate plan" on step 2 and, on that 3rd click,
            # solves synchronously (~60ms) and closes the modal -- so exactly
            # 3 wizard_advance calls are needed here, not 4: a 4th would fire
            # after the modal is already gone, and #wizNext has no rect when
            # hidden, tripping the `assert r`.
            f = 230
            for _ in range(3):
                f = wizard_advance(c, sc, f)
            sc.run()

        if want("s2"):
            c.wait_expr("!!document.querySelector('#board') && document.querySelectorAll('#board *').length > 20")
            sc = Scene(c, "s2", 240)
            sc.js(0, "document.querySelector('#board').scrollIntoView({block:'start'})")
            sc.run()

        if want("s3"):
            sc = Scene(c, "s3", 480)
            # #panelLeft itself doesn't scroll (it's a fixed-height flex
            # column); the overflow-y:auto element inside it is
            # .panel-scroll -- confirmed live (#panelLeft.scrollHeight ==
            # clientHeight always, since #panelLeft never overflows itself).
            sc.js(0, "document.querySelector('#panelLeft .panel-scroll').scrollTop = 0")
            sc.hover(20, "#flagList")
            sc.js(70, "document.querySelector('#flagList').scrollIntoView({behavior:'smooth',block:'center'})")
            sc.js(150, "document.querySelector('#timelineSec').scrollIntoView({behavior:'smooth',block:'start'})")
            sc.hover(200, "#timelineSec details.tl-acc:nth-of-type(1) summary")
            sc.click(230, "#timelineSec details.tl-acc:nth-of-type(1) summary")
            # Confirmed live: opening accordion 1 (15 scholarship items) grows
            # #panelLeft .panel-scroll's scrollHeight from ~1400px to ~3370px,
            # which pushes accordion 2's summary to y~2950 -- off the 1080px
            # viewport entirely. A raw c.click() at a stale/off-screen rect
            # would silently hit nothing (no assert trips, since the element
            # still exists -- it's just not on screen), so the second
            # accordion would never actually open in the captured video.
            # This extra scroll is required, not optional polish.
            sc.js(290, "document.querySelector('#timelineSec details.tl-acc:nth-of-type(2) summary').scrollIntoView({behavior:'smooth',block:'center'})")
            sc.hover(330, "#timelineSec details.tl-acc:nth-of-type(2) summary")
            sc.click(370, "#timelineSec details.tl-acc:nth-of-type(2) summary")
            sc.run()

        # ---------------- SECOND wizard pass: s7 (majors scroll) then s6
        # (transcript import) -- see module docstring + MAJOR_FULL_NAME
        # comment for why reopening the wizard here is safe. Deliberately NOT
        # captured as scene frames (same convention as the initial page load
        # before s1): opening the wizard and revealing the browse-all list is
        # session setup, not a beat either scene's spec asks for.
        if want("s6") or want("s7"):
            c.eval("document.querySelector('#newPlanBtn').click()")
            c.wait_expr("document.querySelector('#wizardModal').classList.contains('open')")
            c.eval("document.querySelector('#wsMajor .ss-browse').click()")
            # 175 majors + college-group headers -- confirmed live, ~190 rows.
            c.wait_expr("document.querySelector('#wsMajor .ss-list').children.length > 50")

            if want("s7"):
                sc = Scene(c, "s7", 300)
                # ONE hover for the cursor anchor (spec: "no clicks needed") --
                # the list container's own rect is stable across the scroll
                # (scrolling its CONTENTS doesn't move the container).
                sc.hover(10, "#wsMajor .ss-list")
                max_scroll = c.eval(
                    "document.querySelector('#wsMajor .ss-list').scrollHeight - "
                    "document.querySelector('#wsMajor .ss-list').clientHeight")
                # Per-frame eased scrollTop (manual, unlike s3's native
                # scrollIntoView smooth-scroll -- the browse-all list is a
                # small fixed-height dropdown with no scrollIntoView target,
                # so the motion has to be driven frame-by-frame here).
                f_start, f_end = 25, 299
                span = f_end - f_start
                for i in range(span + 1):
                    f = f_start + i
                    ease = (1 - math.cos(math.pi * (i / span))) / 2   # smooth ease-in-out
                    target = round(max_scroll * ease)
                    sc.js(f, "document.querySelector('#wsMajor .ss-list').scrollTop = %d" % target)
                sc.run()

            if want("s6"):
                sc = Scene(c, "s6", 360)
                # Frame-0 setup, not a captured beat (same convention as
                # s4/s5's own sc.js(0,...) resets below): pick the major so
                # #wizNext -- which requires wiz.majorId, else it just toasts
                # "Pick a major first." -- can advance to the History step
                # where the transcript importer (#tiText/#tiScan/#tiAdd) lives.
                sc.js(0, PICK_IS_AND_ADVANCE_JS)
                sc.hover(20, "#tiText")
                sc.click(45, "#tiText")
                # JS-set for speed (spec: "the paste itself can be JS-set");
                # the SCAN click below is the real cursor interaction.
                sc.js(50, "document.querySelector('#tiText').value = %s" % json.dumps(S6_TRANSCRIPT_TEXT))
                sc.hover(110, "#tiScan")
                sc.click(140, "#tiScan")          # renderScanResult() populates #tiResult synchronously
                sc.hover(280, "#tiAdd")
                sc.click(300, "#tiAdd")           # toast: "3 courses imported from your transcript."
                sc.run()

        if want("s4"):
            sc = Scene(c, "s4", 300)
            sel = '.card[data-uid="%s"]' % S4_COURSE_UID
            # #board scrolls itself (`.board{overflow:auto}`), independent of
            # the page-level scroll s2 already settled and separate from
            # #panelLeft's own scroller that s3 drives -- force it back to
            # the Fall 2026 (first) column defensively rather than trust
            # whatever s2/s3 left on screen. CLOSE_OVERLAYS_JS closes the
            # second wizard pass's #wizardModal (left open on purpose --
            # see above) plus anything else a differently-scoped run left
            # open (module docstring).
            sc.js(0, CLOSE_OVERLAYS_JS + "document.querySelector('#board').scrollLeft = 0")
            sc.js(2, "document.querySelector('%s').scrollIntoView({block:'center',inline:'center'})" % sel)
            sc.hover(20, sel)
            sc.click(60, sel)
            # .modal-box's pop animation is 180ms (~11 frames); rest the
            # cursor on the sections CTA afterward so the compositor's later
            # punch-zoom (R4) has a natural landing point. Deliberately never
            # clicks #cmSectionsBtn -- that calls loadSections(), a real
            # fetch to the advisor API (see FETCH_GUARD_JS). The button's own
            # label already IS the payoff Jordan described ("See Fall 2026
            # sections · live seat counts") -- fully real data, no click
            # needed, and a click would only surface a fetch-blocked error.
            sc.hover(110, "#cmSectionsBtn")
            sc.run()

        if want("s9"):
            # Recapture of the s4 pattern, but on ACC 200 -- confirmed live it
            # sits in Winter 2027 (Requirement 1.1) with a rich modal (named
            # "confirmed for Winter 2027" instructors, prereqs none, MAP-sheet
            # "why it's here"). CLOSE_OVERLAYS_JS closes s4's leftover
            # WRTG 150 modal (left open on purpose -- see s4 above).
            sc = Scene(c, "s9", 300)
            sel = '.card[data-uid="%s"]' % S9_COURSE_UID
            sc.js(0, CLOSE_OVERLAYS_JS + "document.querySelector('#board').scrollLeft = 0")
            sc.js(2, "document.querySelector('%s').scrollIntoView({block:'center',inline:'center'})" % sel)
            sc.hover(20, sel)
            sc.click(60, sel)
            sc.hover(110, "#cmSectionsBtn")
            sc.run()

        if want("s8"):
            sc = Scene(c, "s8", 480)
            bsel = '.card-bucket[data-uid="BUCKET::univ-core::ge-civilization-1"]'
            ssel = '.card[data-uid="MSB 180"]'
            # MSB 180 (Winter 2027, 1 cr, offered FW) -> Fall 2026's col-body:
            # offered that season, and 16+1=17 credits stays under the
            # 18-credit BYU cap -- confirmed live the move actually applies
            # (not just a toast rejection). Target point is near the bottom of
            # the Fall 2026 column, clear of its existing cards.
            dst_js = ("(() => { const z = document.querySelector('.col-body[data-term=\"0\"]'); "
                      "const r = z.getBoundingClientRect(); "
                      "return {x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height - 15)}; })()")
            sc.js(0, CLOSE_OVERLAYS_JS +
                  "document.querySelector('#board').scrollLeft = 0;"
                  "document.querySelector('#board').scrollIntoView({block:'start'});")
            sc.hover(20, bsel)
            sc.click(50, bsel)      # openBucketPicker() -- expand the requirement bucket
            # The picker (.ctx-menu.bucket-picker) is a floating dropdown with
            # no listener that closes it on an unrelated drag gesture (only a
            # plain document click does, via closeMenus() -- app.js:2506 --
            # and a real HTML5 drag never fires a click event on mouseup) --
            # remove it directly rather than leave it sitting over the board
            # during the drag.
            sc.js(140, "document.querySelector('.ctx-menu.bucket-picker')?.remove()")
            sc.hover(170, ssel)
            sc.drag(200, 290, ssel, dst_js, steps=11)
            sc.hover(345, ssel)     # rest on the card in its new column -- a settle beat
            sc.run()

        if want("s5"):
            sc = Scene(c, "s5", 360)
            # BUG FOUND LIVE (first full run): s4 leaves #courseModal open on
            # purpose (it's the scene's whole point) and never closes it.
            # .modal's backdrop is position:fixed;inset:0;z-index:100 -- ABOVE
            # #chatFab's z-index:90 -- and app.js wires every .modal to close
            # on a direct backdrop click (`e.target === m`, app.js ~2497). A
            # leftover-open courseModal therefore eats the very first click
            # aimed at #chatFab (it lands on the backdrop, not the button):
            # the click just closes the modal, chat.js's real toggle() never
            # runs, #chatPanel never gets .open, and every subsequent
            # #chatInput/#chatSend action resolves a zero rect (hidden
            # ancestor) -- confirmed live via the resulting events log
            # (x:0,y:0 on every post-open action). Close it defensively
            # before anything else in this scene touches the chat UI.
            # CLOSE_OVERLAYS_JS also wipes #chatMsgs -- belt-and-suspenders
            # for a scene reordered ahead of some other chat-touching scene;
            # in the canonical `all` order #chatMsgs is already empty here.
            sc.js(0, CLOSE_OVERLAYS_JS)
            sc.hover(15, "#chatFab")
            sc.click(45, "#chatFab")
            # Opening the panel fires chat.js's one-time checkHealth() probe;
            # with fetch blocked (FETCH_GUARD_JS) it rejects on the next
            # microtask and showOffline() lands within a handful of frames --
            # confirmed live. Two cleanup passes for margin, well before
            # typing starts. "Re-enable the composer": confirmed by reading
            # chat.js that it never actually sets #chatInput.disabled on the
            # offline path (only #chatSend.disabled mid-flight on the ONLINE
            # path) -- this is defensive insurance, not undoing a real
            # disabled state.
            clean = ("document.querySelectorAll('#chatMsgs .chat-msg.err')"
                     ".forEach(el => el.remove());"
                     "document.querySelector('#chatSend').disabled = false;")
            sc.js(75, clean)
            sc.js(105, clean)

            sc.hover(115, "#chatInput")
            type_start = 130
            sc.type(type_start, "#chatInput", S5_QUESTION, step=1)
            # By send time `online` has long since gone false (set within the
            # first ~30 frames above), so send() takes the early-return
            # offline branch: it adds the REAL user bubble via chat.js's own
            # addMsg (authentic markup, for free) and clears the input,
            # WITHOUT any network call -- confirmed live (no 'typing' bubble
            # ever appears on this path once fetch is blocked).
            send_f = type_start + len(S5_QUESTION) + 15
            sc.click(send_f, "#chatSend")

            # Inject the bot bubble skeleton, then stream S5_ANSWER_SEGMENTS
            # into it a few characters at a time -- deterministic reveal
            # machinery for this capture only, not a simulation of chat.js's
            # real (non-streaming) render.
            bubble_f = send_f + 8
            segs_json = json.dumps([{"b": b, "t": t} for b, t in S5_ANSWER_SEGMENTS])
            srcs_json = json.dumps(S5_ANSWER_SOURCES)
            adv_js = ADV_BUBBLE_JS_TMPL.replace("__SEGMENTS__", segs_json).replace("__SOURCES__", srcs_json)
            sc.js(bubble_f, adv_js)

            total_chars = sum(len(t) for _, t in S5_ANSWER_SEGMENTS)
            reveal_start = bubble_f + 8
            step_chars, cadence = 4, 3          # ~4 visible chars every 3 frames
            n_steps = -(-total_chars // step_chars)  # ceil
            for i in range(n_steps + 1):
                f = reveal_start + i * cadence
                n = min(total_chars, i * step_chars)
                sc.js(f, "window.__advReveal(%d)" % n)
            sc.run()

        if want("s10"):
            sc = Scene(c, "s10", 400)
            # Same defensive story as s5 (CLOSE_OVERLAYS_JS docstring): if
            # this is the FIRST chat open of the session (e.g. `--scene
            # s1,s10` in isolation), chat.js's one-time checkHealth() probe
            # still fires here and lands its own showOffline() bubble a
            # handful of frames after open -- the same `clean` cleanup s5
            # uses below strips it before the real chip-sent bubble appears.
            # In the canonical `all` order s5 already tripped `probed` /
            # `offlineShown`, so this is a no-op.
            sc.js(0, CLOSE_OVERLAYS_JS)
            sc.hover(15, "#chatFab")
            sc.click(45, "#chatFab")
            clean = ("document.querySelectorAll('#chatMsgs .chat-msg.err')"
                     ".forEach(el => el.remove());"
                     "document.querySelector('#chatSend').disabled = false;")
            sc.js(70, clean)
            # The REAL quick-action chip (chat.js:289-291): one click fills
            # #chatInput with its data-q text AND sends -- no typing beat.
            # Selector matches on the chip's real data-q prefix (index.html:290);
            # it's the only one of the three quick chips starting "Critique".
            chip_sel = '#chatQuick button[data-q^="Critique"]'
            sc.hover(75, chip_sel)
            send_f = 105
            sc.click(send_f, chip_sel)
            # By send time `online` is already false (see comment above), so
            # send() takes the same early-return offline branch s5 relies on:
            # it adds the REAL user bubble (the chip's actual sent text, via
            # chat.js's own addMsg) with no network call.
            bubble_f = send_f + 8
            segs_json = json.dumps([{"b": b, "t": t} for b, t in S10_ANSWER_SEGMENTS])
            srcs_json = json.dumps(S10_ANSWER_SOURCES)
            adv_js = ADV_BUBBLE_JS_TMPL.replace("__SEGMENTS__", segs_json).replace("__SOURCES__", srcs_json)
            sc.js(bubble_f, adv_js)

            total_chars = sum(len(t) for _, t in S10_ANSWER_SEGMENTS)
            reveal_start = bubble_f + 8
            step_chars, cadence = 4, 3          # same cadence as s5
            n_steps = -(-total_chars // step_chars)  # ceil
            for i in range(n_steps + 1):
                f = reveal_start + i * cadence
                n = min(total_chars, i * step_chars)
                sc.js(f, "window.__advReveal(%d)" % n)
            sc.run()

        if a.debug:
            c.shot(os.path.join(OUT, "debug-final.png"))
    finally:
        if c:
            c.close()
        if server:
            server.terminate()


if __name__ == "__main__":
    main()
