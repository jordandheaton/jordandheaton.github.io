"""Scrubs the live Universe Scroller under virtual time; captures two scenes.
Serves the repo root with http.server (the scroller loads 1445 frame JPEGs)."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from cdp import Chrome

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(os.environ["TEMP"], "showcase", "scroller")
URL = "http://localhost:8140/Universe%20scroller/index.html"

def ease_io(p): return 2*p*p if p < .5 else -1 + (4 - 2*p) * p

srv = subprocess.Popen([sys.executable, "-m", "http.server", "8140"], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
c = None
try:
    c = Chrome(port=9455, width=1920, height=1080)
    c.metrics(1920, 1080, dsf=1)          # EXACT 16:9 or the engine opens side bars
    c.goto(URL, settle=6.0)
    c.wait_expr("!!window.__uni")
    H = c.eval("document.documentElement.scrollHeight - innerHeight")
    c.vt_pause()
    # Fractions are of total scroll (log-scale across all 27 decades, chromosome
    # -> Milky Way -- see manifest chapters in index.html). The playhead EASES
    # toward the scroll target at 0.22/tick (scroller.js tick()) rather than
    # jumping to it, and starts each scene at rest wherever the previous scene
    # left off (Continent chapter, frame ~507, on the very first scene of the run)
    # -- so the opening frames of "hook" read as grounded Continent aerial
    # (river-delta/coastline terrain, full-bleed, no space visible) regardless of
    # `a` while the playhead catches up, which is what makes the open read as a
    # grounded, recognizable start rather than a hard cut. `a`=0.455 lands the
    # fast-travel target passing through the solar-system flythrough and into
    # the Milky Way chapter (there is no literal cityscape in the baked frames,
    # see task-6-report.md); `b`=0.985 lands deep in the Milky Way chapter, one
    # chapter shy of the terminal full-galaxy frame. Confirmed by reading
    # f00000/f00150/f00299 after capture.
    for name, frames, a, b, ease in (
        ("hook", 300, 0.455, 0.985, ease_io),    # 5s fast continent->solar system->galaxy scrub
    ):
        d = os.path.join(OUT, name)
        os.makedirs(d, exist_ok=True)
        for f in range(frames):
            p = ease(f / (frames - 1))
            c.eval("scrollTo(0, %d)" % int(H * (a + (b - a) * p)))
            c.vt_step()
            c.shot_jpeg(os.path.join(d, "f%05d.jpg" % f), quality=90)
            if f % 60 == 0:
                print(" ", name, f, c.eval("window.__uni && window.__uni.idx"))

    # ---- outro: FULL journey scrub, 0.0 -> 1.0 (Revision 7 / R16) ----------
    # The site opens mid-journey on the leaf BY DESIGN (frameFromScroll/OPEN_
    # FRAME in scroller.js), and "hook" above just left the page scrolled deep
    # into the Milky Way -- so a hard scrollTo(0, 0) moves the TARGET to frame 0
    # instantly, but the eased playhead (0.22/tick, see scroller.js tick())
    # takes real ticks to catch up. Without a settle pause the first captured
    # frames would show the tail end of that glide instead of sitting inside
    # the smallest scene (Chromosome chapter, idx 0) -- exactly the "starts
    # inside the cell" requirement. 50 vt_step ticks is enough for 0.78**n to
    # shrink any starting offset under half a frame (worst case right after
    # "hook": playhead ~1400 units from the new target of 0).
    OUTRO_FRAMES = 720                          # 12s @60fps, gentle ease, full 27-decade sweep
    name = "outro"
    d = os.path.join(OUT, name)
    os.makedirs(d, exist_ok=True)
    c.eval("scrollTo(0, 0)")
    for _ in range(50):
        c.vt_step()
    print(" outro settle idx:", c.eval("window.__uni && window.__uni.idx"))
    for f in range(OUTRO_FRAMES):
        p = ease_io(f / (OUTRO_FRAMES - 1))
        c.eval("scrollTo(0, %d)" % int(H * p))
        c.vt_step()
        c.shot_jpeg(os.path.join(d, "f%05d.jpg" % f), quality=90)
        if f % 60 == 0 or f == OUTRO_FRAMES - 1:
            print(" ", name, f, c.eval("window.__uni && window.__uni.idx"))
    print("frames:", c.eval("JSON.stringify(window.__uni)"))
finally:
    if c:
        c.close()
    srv.terminate()
