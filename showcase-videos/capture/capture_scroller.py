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
        ("outro", 270, 0.40, 0.56, lambda p: p), # 4.5s slow drift
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
    print("frames:", c.eval("JSON.stringify(window.__uni)"))
finally:
    if c:
        c.close()
    srv.terminate()
