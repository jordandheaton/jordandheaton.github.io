"""Captures myplanBYU scenes as deterministic 60fps frame sequences + event logs.
Usage: python capture_myplan.py [--scene s1|s2|s3|all] [--debug]
Requires the serve.ps1 server (the script starts it if port 8130 is closed)."""
import argparse, json, os, subprocess, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from cdp import Chrome

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(os.environ["TEMP"], "showcase", "myplan")
EVENTS_DIR = os.path.join(HERE, "..", "raw", "events")
URL = "http://localhost:8130/index.html"
MAJOR = "Information Systems"


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
    server = ensure_server()
    c = None
    try:
        c = Chrome(port=9422, width=1920, height=1080)
        c.metrics(1920, 1080, dsf=2)
        c.goto(URL, settle=4.0)
        c.wait_expr("document.readyState==='complete' && !!document.querySelector('#board')")
        c.vt_pause()

        if a.scene in ("s1", "all"):
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

        if a.scene in ("s2", "all"):
            c.wait_expr("!!document.querySelector('#board') && document.querySelectorAll('#board *').length > 20")
            sc = Scene(c, "s2", 240)
            sc.js(0, "document.querySelector('#board').scrollIntoView({block:'start'})")
            sc.run()

        if a.scene in ("s3", "all"):
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

        if a.debug:
            c.shot(os.path.join(OUT, "debug-final.png"))
    finally:
        if c:
            c.close()
        if server:
            server.terminate()


if __name__ == "__main__":
    main()
