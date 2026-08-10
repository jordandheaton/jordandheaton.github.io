# Showcase Videos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce two ~35s recruiter-facing showcase MP4s (myplanBYU cursor-driven demo, Universe Scroller process montage), fully code-built and re-renderable, plus portfolio embeds.

**Architecture:** A three-stage pipeline in `showcase-videos/`: (1) **capture** — a stdlib-only Python CDP harness drives headless Chrome with virtual-time frame stepping to produce deterministic 60fps frame sequences of the real apps, emitting an interaction event log; (2) **compose** — each video is an HTML page (engine.js timeline + cursor/text/terminal layers) that renders any frame on demand via `window.__seek(f)`; (3) **render** — the harness steps the compositor page frame-by-frame, screenshots each, and ffmpeg encodes + muxes music.

**Tech Stack:** Python 3.12 (stdlib only — this machine has **no Node, no Playwright**), Chrome headless (`C:\Program Files\Google\Chrome\Application\chrome.exe`), ffmpeg 8.1.2 (on PATH), PowerShell 5.1, vanilla JS/HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-08-08-showcase-videos-design.md` (read it first).

## Global Constraints

- Output: 1920×1080, 60fps, H.264 yuv420p + AAC, 30–40s, **≤10 MB per file**, `-movflags +faststart`.
- **No Node / no npm / no pip installs.** Python stdlib + ffmpeg + Chrome only.
- Bulk frames go to `$env:TEMP\showcase\...` — **never** inside the OneDrive tree. Only scripts, compose pages, `dist/`, and `music/` are committed; `showcase-videos/raw/` is gitignored.
- Palette (from `portfolio-3d.css` `:root`): bg `#05070f`, bg-2 `#070b18`, ink `#eaf2ff`, accent `#4da3ff`, accent-2 `#43e7d0`. Reference style: Zelios SaaS demo (tilted glowing screen frame, visible cursor, payoff pill).
- `.ps1` files must be **ASCII-only** (PowerShell 5.1 reads BOM-less files as ANSI; an em dash becomes a parse error — see `myplanBYU/tests/headless.ps1` header).
- `file://` URLs must percent-encode spaces (`OneDrive - Brigham...` → `%20`).
- Viewport pinning: always `Emulation.setDeviceMetricsOverride` (the harness `metrics()`), never `--window-size` (headless lands a few px off; the scroller opens side bars if the viewport is not exactly 16:9).
- Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- The three reference videos in `C:\Users\jorda\Downloads\` are commercial templates — **never commit or redistribute them**; on-disk reference only.

---

### Task 1: Scaffold + CDP harness (`tools/cdp.py`) with input & virtual-time support

**Files:**
- Create: `showcase-videos/.gitignore`, `showcase-videos/README.md`
- Create: `showcase-videos/tools/cdp.py` (copy then extend)
- Test: `showcase-videos/tools/selftest_cdp.py`

**Interfaces:**
- Produces: `Chrome(port=9333, width=1440, height=900, extra_args=None)` with methods `send(method, **params)`, `eval(expr, await_promise=False)`, `metrics(width, height, dsf=1)`, `goto(url, settle=3.0)`, `shot(path)` (PNG), `shot_jpeg(path, quality=90)`, `rect(sel)` → `{x,y,w,h}` center dict or None, `mouse(mtype, x, y, button="none", clicks=0)`, `click(x, y)`, `type_text(text)`, `vt_pause()`, `vt_step(ms=16.667)`, `wait_expr(expr, timeout=15)`, `close()`. Frame-loop contract used by every later task: `vt_pause()` once, then per frame `vt_step()` → `shot_jpeg()`.

- [ ] **Step 1: Scaffold the folder**

```powershell
New-Item -ItemType Directory -Force "showcase-videos\tools","showcase-videos\capture","showcase-videos\compose\assets","showcase-videos\render","showcase-videos\dist","showcase-videos\music","showcase-videos\raw" | Out-Null
Set-Content -Encoding utf8 "showcase-videos\.gitignore" "raw/`ncompose/render-config.js`n"
Set-Content -Encoding utf8 "showcase-videos\README.md" "# showcase-videos`n`nCode-built recruiter showcase videos. See docs/superpowers/specs/2026-08-08-showcase-videos-design.md. Render: python render/render.py --help`n"
```

- [ ] **Step 2: Copy the existing harness into the repo**

Copy `C:\Users\jorda\AppData\Local\Temp\claude\C--Users-jorda-OneDrive---Brigham-Young-University-Portfolio\9560de76-97cb-49b2-a4c8-739aad2361cf\scratchpad\cdp.py` → `showcase-videos\tools\cdp.py`. If that file no longer exists, the full original source is reproduced in the spec's session; it is a ~140-line stdlib WS client with classes `WS` and `Chrome` (`send`/`eval`/`metrics`/`goto`/`shot`/`close`, Chrome path constant `C:\Program Files\Google\Chrome\Application\chrome.exe`). Verify after copying:

```powershell
python -c "import sys; sys.path.insert(0,'showcase-videos/tools'); import cdp; print('ok', hasattr(cdp,'Chrome'))"
```
Expected: `ok True`

- [ ] **Step 3: Write the failing selftest**

`showcase-videos/tools/selftest_cdp.py`:

```python
"""Proves the frame-loop contract: virtual time advances rAF/CSS deterministically
and screenshots reflect it. Run: python showcase-videos/tools/selftest_cdp.py"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from cdp import Chrome

PAGE = (
    "data:text/html,<style>@keyframes m{from{margin-left:0}to{margin-left:800px}}"
    "%23b{width:120px;height:120px;background:%234da3ff;animation:m 2s linear forwards}</style>"
    "<div id=b></div><script>let n=0;requestAnimationFrame(function s(){n++;window.__raf=n;"
    "requestAnimationFrame(s)})</script>"
)

def px(path):
    return os.path.getsize(path)

c = Chrome(port=9377, width=960, height=540)
try:
    c.metrics(960, 540, dsf=1)
    c.send("Page.navigate", url=PAGE)
    c.wait_expr("!!document.getElementById('b')")
    c.vt_pause()
    raf0 = c.eval("window.__raf||0")
    left0 = c.eval("getComputedStyle(document.getElementById('b')).marginLeft")
    for _ in range(30):                      # 0.5s of virtual time
        c.vt_step()
    raf1 = c.eval("window.__raf||0")
    left1 = c.eval("getComputedStyle(document.getElementById('b')).marginLeft")
    assert raf1 - raf0 >= 25, f"rAF did not advance under virtual time ({raf0}->{raf1})"
    assert left0 != left1, f"CSS animation frozen ({left0})"
    d = tempfile.mkdtemp(prefix="cdpself-")
    a, b = os.path.join(d, "a.jpg"), os.path.join(d, "b.jpg")
    c.shot_jpeg(a)
    for _ in range(30):
        c.vt_step()
    c.shot_jpeg(b)
    assert px(a) > 5000 and px(b) > 5000, "screenshots suspiciously small"
    assert open(a, "rb").read() != open(b, "rb").read(), "identical frames after 0.5s virtual time"
    r = c.rect("#b")
    assert r and r["w"] == 120, f"rect() wrong: {r}"
    c.eval("document.body.addEventListener('click',e=>window.__hit=[e.clientX,e.clientY])")
    c.click(200, 300)
    assert c.eval("window.__hit") == [200, 300], "click dispatch failed"
    c.eval("const i=document.createElement('input');i.id='t';document.body.append(i);i.focus()")
    c.type_text("hi")
    assert c.eval("document.getElementById('t').value") == "hi", "type_text failed"
    print("PASS selftest_cdp")
finally:
    c.close()
```

- [ ] **Step 4: Run it — expect failure (methods missing)**

Run: `python showcase-videos/tools/selftest_cdp.py`
Expected: `AttributeError: 'Chrome' object has no attribute 'wait_expr'` (or `vt_pause`).

- [ ] **Step 5: Extend `Chrome` in `tools/cdp.py`**

Add `extra_args` to `__init__` (append to the arg list before `"about:blank"`; also append `"--allow-file-access-from-files"`, `"--force-device-scale-factor=1"`, `"--font-render-hinting=none"` always). Replace `metrics` and add the new methods:

```python
    def metrics(self, width, height, dsf=1):
        self.send("Emulation.setDeviceMetricsOverride", width=width, height=height,
                  deviceScaleFactor=dsf, mobile=False)

    def rect(self, sel):
        return self.eval(
            "(()=>{const e=document.querySelector(%s);if(!e)return null;"
            "const r=e.getBoundingClientRect();"
            "return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),"
            "w:Math.round(r.width),h:Math.round(r.height)};})()" % json.dumps(sel))

    def mouse(self, mtype, x, y, button="none", clicks=0):
        self.send("Input.dispatchMouseEvent", type=mtype, x=x, y=y,
                  button=button, clickCount=clicks)

    def click(self, x, y):
        self.mouse("mouseMoved", x, y)
        self.mouse("mousePressed", x, y, "left", 1)
        self.mouse("mouseReleased", x, y, "left", 1)

    def type_text(self, text):
        for ch in text:
            self.send("Input.dispatchKeyEvent", type="keyDown", text=ch)
            self.send("Input.dispatchKeyEvent", type="keyUp", text=ch)

    def vt_pause(self):
        self.send("Emulation.setVirtualTimePolicy", policy="pause")

    def vt_step(self, ms=16.667):
        t0 = self.eval("performance.now()")
        self.send("Emulation.setVirtualTimePolicy",
                  policy="pauseIfNetworkFetchesPending", budget=ms,
                  maxVirtualTimeTaskStarvationCount=100000)
        for _ in range(400):
            if self.eval("performance.now()") - t0 >= ms - 0.5:
                return
            time.sleep(0.004)
        raise RuntimeError("virtual time budget never expired")

    def wait_expr(self, expr, timeout=15):
        end = time.time() + timeout
        while time.time() < end:
            if self.eval(expr):
                return True
            time.sleep(0.15)
        raise RuntimeError("timeout waiting for: " + expr)

    def shot_jpeg(self, path, quality=90):
        r = self.send("Page.captureScreenshot", format="jpeg", quality=quality)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        return path
```

`type_text` note: `keyDown` with `text` inserts the character into the focused input (the app's `input` events fire); the plain `char` type skips keydown handlers some UIs need.

- [ ] **Step 6: Run selftest — expect PASS**

Run: `python showcase-videos/tools/selftest_cdp.py`
Expected: `PASS selftest_cdp`. If the two screenshots compare equal, screenshots are not reflecting virtual time — try adding `"--run-all-compositor-stages-before-draw"` to the Chrome args and re-run; keep whichever configuration passes.

- [ ] **Step 7: Commit**

```bash
git add showcase-videos/.gitignore showcase-videos/README.md showcase-videos/tools/
git commit -m "showcase: CDP harness relocated into repo, extended with input + virtual-time stepping

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Compositor engine (`compose/engine.js`) + browser selftest harness

**Files:**
- Create: `showcase-videos/compose/engine.js`
- Create: `showcase-videos/compose/selftest.html`
- Create: `showcase-videos/render/selftest.ps1`

**Interfaces:**
- Consumes: nothing (pure browser JS).
- Produces: global `TL.build(cfg)` where `cfg = {fps, frames, tracks:[...]}`. Track kinds:
  - `{el, f0, f1, ease, apply(el, p)}` — `p` is eased 0..1 progress, called with p clamped; `apply` runs for every seek (also outside [f0,f1] with p=0 or 1).
  - `{el, f0, f1, seq:{root, count, srcFps, pad:5, ext:'.jpg', prefix:'f'}}` — image-sequence layer; at frame `f` shows `root + '/f' + String(idx).padStart(5,'0') + ext` with `idx = Math.min(count-1, Math.floor((f - f0) / fpsRatio))` where `fpsRatio = fps / srcFps`.
  - `{f0, run(f)}` — free function every frame at/after f0.
  - Eases: `linear, inQuad, outQuad, inOutQuad, outCubic, inOutCubic, outExpo, outBack` (outBack overshoots ~10%).
  - Globals set by `build`: `window.__frames`, `window.__fps`, `window.__seek(f)` → **Promise** resolving after every visible `<img>` for that frame has decoded (`img.decode()`), fonts ready (`document.fonts.ready`).
  - Selftest emit protocol (mirrors `myplanBYU/tests`): with `?emit`, page writes `<pre id="emit">` containing base64 JSON `{pass, fail, checks:[{name, ok, detail}]}`.

- [ ] **Step 1: Write the failing selftest page**

`showcase-videos/compose/selftest.html`:

```html
<!DOCTYPE html><meta charset="utf-8"><title>engine selftest</title>
<style>#box{position:absolute;width:100px;height:50px;background:#4da3ff}</style>
<div id="box"></div><img id="seqimg" alt="">
<script src="engine.js"></script>
<script>
(async () => {
  const checks = [], ok = (n, c, d) => checks.push({name:n, ok:!!c, detail:String(d||'')});
  const box = document.getElementById('box'), seq = document.getElementById('seqimg');
  // 1x1 px data-uri "frame files" cannot exist as a directory; seq resolution is
  // tested via the src it ASSIGNS, not via load success.
  TL.build({fps:60, frames:120, tracks:[
    {el:box, f0:0, f1:60, ease:'linear', apply:(el,p)=>el.style.opacity = p},
    {el:seq, f0:30, f1:120, seq:{root:'no-such-dir', count:24, srcFps:24, pad:5, ext:'.jpg', prefix:'f'}},
    {f0:0, run:f=>window.__lastRun = f},
  ]});
  ok('frames global', window.__frames === 120, window.__frames);
  await window.__seek(30).catch(()=>{});          // seq img 404s — seek must not hang
  ok('opacity mid', Math.abs(parseFloat(box.style.opacity) - 0.5) < 0.02, box.style.opacity);
  ok('seq first', seq.getAttribute('src').endsWith('no-such-dir/f00000.jpg'), seq.getAttribute('src'));
  await window.__seek(90).catch(()=>{});
  ok('opacity clamped', parseFloat(box.style.opacity) === 1, box.style.opacity);
  // f=90, f0=30 -> 60 timeline frames elapsed at 60fps over 24fps source = src 24 -> clamped 23
  ok('seq mapped+clamped', seq.getAttribute('src').endsWith('f00023.jpg'), seq.getAttribute('src'));
  ok('run track', window.__lastRun === 90, window.__lastRun);
  const eb = TL.eases.outBack(0.7);
  ok('outBack overshoots', eb > 1.0 && eb < 1.15, eb);
  const pass = checks.filter(c=>c.ok).length;
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({pass, fail:checks.length-pass, checks}))));
  if (location.search.includes('emit')) {
    const pre = document.createElement('pre'); pre.id = 'emit'; pre.textContent = payload;
    document.body.appendChild(pre);
  } else console.table(checks);
})();
</script>
```

- [ ] **Step 2: Write the headless runner**

`showcase-videos/render/selftest.ps1` (ASCII only):

```powershell
# Runs a compose selftest page headlessly and reports pass/fail.
#   .\selftest.ps1                      # compose/selftest.html
#   .\selftest.ps1 -Page other.html
[CmdletBinding()] param([string] $Page = "selftest.html", [int] $TimeoutSec = 60)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$compose = Join-Path (Split-Path -Parent $here) "compose"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$urlPath = ((Join-Path $compose $Page) -replace '\\', '/') -replace ' ', '%20'
$url = "file:///" + $urlPath + "?emit"
$profileDir = Join-Path $env:TEMP ("showcase-selftest-" + [guid]::NewGuid().ToString("N"))
$dump = [System.IO.Path]::GetTempFileName()
$err = [System.IO.Path]::GetTempFileName()
try {
  $args = @("--headless=new", "--disable-gpu", "--no-first-run", "--allow-file-access-from-files",
            "--user-data-dir=$profileDir", "--virtual-time-budget=$($TimeoutSec * 1000)",
            "--dump-dom", $url)
  $p = Start-Process -FilePath $chrome -ArgumentList $args -NoNewWindow -PassThru `
        -RedirectStandardOutput $dump -RedirectStandardError $err
  if (-not $p.WaitForExit($TimeoutSec * 1000)) { $p.Kill(); throw "timed out" }
  $html = Get-Content $dump -Raw -Encoding UTF8
  if (-not ($html -match '(?s)<pre id="emit"[^>]*>(.*?)</pre>')) { throw "no emit payload" }
  $r = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Matches[1].Trim())) | ConvertFrom-Json
  foreach ($c in $r.checks) {
    $col = if ($c.ok) { "Green" } else { "Red" }
    Write-Host ("  {0}  {1}  {2}" -f ($(if ($c.ok) {"PASS"} else {"FAIL"})), $c.name, $c.detail) -ForegroundColor $col
  }
  Write-Host ("{0} passed, {1} failed" -f $r.pass, $r.fail)
  if ($r.fail -eq 0) { exit 0 } else { exit 1 }
} finally {
  Remove-Item $dump, $err -ErrorAction SilentlyContinue
  Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}
```

- [ ] **Step 3: Run — expect FAIL (engine.js missing)**

Run: `powershell -File showcase-videos\render\selftest.ps1`
Expected: `no emit payload` (script error before checks run) — confirms the harness detects a broken page.

- [ ] **Step 4: Implement `compose/engine.js`**

```javascript
/* Frame-addressed timeline. Everything is a pure function of frame index so a
   headless harness can render any frame in any order deterministically. */
(function () {
  const eases = {
    linear: p => p,
    inQuad: p => p * p,
    outQuad: p => p * (2 - p),
    inOutQuad: p => p < .5 ? 2*p*p : -1 + (4 - 2*p) * p,
    outCubic: p => 1 + (--p) * p * p,
    inOutCubic: p => p < .5 ? 4*p*p*p : (p-1) * (2*p-2) * (2*p-2) + 1,
    outExpo: p => p === 1 ? 1 : 1 - Math.pow(2, -10 * p),
    outBack: p => { const s = 1.70158; return --p * p * ((s+1)*p + s) + 1; },
  };
  function pad(n, w) { return String(n).padStart(w, '0'); }

  function build(cfg) {
    const fps = cfg.fps || 60;
    window.__fps = fps;
    window.__frames = cfg.frames;
    window.__seek = async function (f) {
      f = Math.max(0, Math.min(cfg.frames - 1, f));
      const pending = [];
      for (const t of cfg.tracks) {
        if (t.run) { if (f >= (t.f0 || 0)) t.run(f); continue; }
        if (t.seq) {
          const s = t.seq, ratio = fps / s.srcFps;
          const raw = Math.floor((f - t.f0) / ratio) + (s.start || 0);
          const idx = Math.max(s.start || 0, Math.min((s.start || 0) + s.count - 1, raw));
          const src = s.root + '/' + (s.prefix ?? 'f') + pad(idx, s.pad ?? 5) + (s.ext ?? '.jpg');
          t.el.style.visibility = (f >= t.f0 && f <= t.f1) ? 'visible' : 'hidden';
          if (t.el.getAttribute('src') !== src) {
            t.el.setAttribute('src', src);
            pending.push(t.el.decode ? t.el.decode().catch(() => {}) : Promise.resolve());
          }
          continue;
        }
        const p0 = (f - t.f0) / Math.max(1, (t.f1 - t.f0));
        const p = eases[t.ease || 'linear'](Math.max(0, Math.min(1, p0)));
        t.apply(t.el, p, f);
      }
      if (document.fonts && document.fonts.status !== 'loaded') pending.push(document.fonts.ready);
      await Promise.all(pending);
      return f;
    };
  }
  window.TL = { build, eases };
})();
```

- [ ] **Step 5: Run selftest — expect PASS**

Run: `powershell -File showcase-videos\render\selftest.ps1`
Expected: `7 passed, 0 failed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add showcase-videos/compose/engine.js showcase-videos/compose/selftest.html showcase-videos/render/selftest.ps1
git commit -m "showcase: frame-addressed compositor engine + headless selftest harness

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Render harness (`render/render.py`) — compositor page → MP4

**Files:**
- Create: `showcase-videos/render/render.py`
- Test: rendering `compose/selftest.html`'s demo timeline (add a tiny `demo.html`)

**Interfaces:**
- Consumes: `tools/cdp.py` `Chrome` (Task 1); compositor contract `window.__seek/__frames` (Task 2).
- Produces: CLI `python showcase-videos/render/render.py <page.html> --out <file.mp4> [--music <file>] [--crf 19] [--quality 92] [--from N] [--to N] [--stride N]`. Writes `compose/render-config.js` (gitignored) before load, defining `window.RENDER = {framesRoot: "file:///C:/Users/jorda/AppData/Local/Temp/showcase", final: true}`. Compose pages read `window.RENDER?.framesRoot` for sequence roots. Exit code 0 and prints `WROTE <path> <MB> MB, <s> s`.

- [ ] **Step 1: Write `render/render.py`**

```python
"""Steps a compositor page frame-by-frame in headless Chrome and encodes MP4.
Usage: python render.py ../compose/myplanbyu.html --out ../dist/x.mp4 [--music m.mp3]
Paths may be relative to this file's directory."""
import argparse, json, os, shutil, subprocess, sys, tempfile, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from cdp import Chrome

def file_url(p):
    return "file:///" + urllib.parse.quote(os.path.abspath(p).replace("\\", "/"), safe="/:")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--out", required=True)
    ap.add_argument("--music")
    ap.add_argument("--crf", type=int, default=19)
    ap.add_argument("--quality", type=int, default=92)
    ap.add_argument("--from", dest="f0", type=int, default=0)
    ap.add_argument("--to", dest="f1", type=int, default=-1)
    ap.add_argument("--stride", type=int, default=1)   # stride>1 = fast preview
    a = ap.parse_args()
    page = a.page if os.path.isabs(a.page) else os.path.join(HERE, a.page)
    out = a.out if os.path.isabs(a.out) else os.path.join(HERE, a.out)
    if a.music and not os.path.isabs(a.music):
        a.music = os.path.join(HERE, a.music)

    cfg = os.path.join(HERE, "..", "compose", "render-config.js")
    frames_root = os.path.join(os.environ.get("TEMP", tempfile.gettempdir()), "showcase")
    with open(cfg, "w", encoding="utf-8") as f:
        f.write("window.RENDER=%s;\n" % json.dumps(
            {"framesRoot": file_url(frames_root), "final": True}))

    tmp = tempfile.mkdtemp(prefix="showcase-render-", dir=os.environ.get("TEMP"))
    c = Chrome(port=9411, width=1920, height=1080)
    try:
        c.metrics(1920, 1080, dsf=1)
        c.goto(file_url(page), settle=2.0)
        c.wait_expr("typeof window.__seek==='function'")
        total = c.eval("window.__frames")
        f1 = total - 1 if a.f1 < 0 else min(a.f1, total - 1)
        n = 0
        for f in range(a.f0, f1 + 1, a.stride):
            c.eval("window.__seek(%d)" % f, await_promise=True)
            c.shot_jpeg(os.path.join(tmp, "r%05d.jpg" % n), quality=a.quality)
            n += 1
            if n % 120 == 0:
                print("  frame %d/%d" % (f, f1))
        fps = 60 // a.stride
        cmd = ["ffmpeg", "-y", "-v", "error", "-framerate", str(fps),
               "-i", os.path.join(tmp, "r%05d.jpg")]
        if a.music:
            cmd += ["-i", a.music, "-filter:a",
                    "loudnorm=I=-14:TP=-1.5,afade=t=out:st=%s:d=1.5" % (n / fps - 1.5),
                    "-c:a", "aac", "-b:a", "160k", "-shortest"]
        cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf),
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True)
        mb = os.path.getsize(out) / 1e6
        print("WROTE %s %.1f MB, %.1f s" % (out, mb, n / fps))
    finally:
        c.close()
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write a 1-second demo page to prove the loop**

`showcase-videos/compose/demo.html`:

```html
<!DOCTYPE html><meta charset="utf-8"><title>demo</title>
<style>body{margin:0;background:#05070f}#t{position:absolute;left:0;top:490px;width:100%;
text-align:center;color:#eaf2ff;font:700 80px system-ui}</style>
<div id="t">RENDER TEST</div>
<script src="render-config.js"></script><script src="engine.js"></script>
<script>
TL.build({fps:60, frames:60, tracks:[
  {el:document.getElementById('t'), f0:0, f1:59, ease:'outCubic',
   apply:(el,p)=>{el.style.opacity=p; el.style.transform=`translateY(${(1-p)*60}px)`}},
]});
</script>
```

- [ ] **Step 3: Render it and verify with ffprobe**

```bash
python showcase-videos/render/render.py ../compose/demo.html --out ../dist/_demo.mp4
ffprobe -v error -show_entries "format=duration:stream=width,height,r_frame_rate" -of default=noprint_wrappers=1 "showcase-videos/dist/_demo.mp4"
```
Expected: `WROTE ... 1.0 s`; probe shows `width=1920 height=1080 r_frame_rate=60/1 duration=1.0...`. Then delete the scratch output: `Remove-Item showcase-videos\dist\_demo.mp4` (and remove `demo.html`? **No** — keep it; it is the render harness's living test).

- [ ] **Step 4: Commit**

```bash
git add showcase-videos/render/render.py showcase-videos/compose/demo.html
git commit -m "showcase: render harness — steps compositor pages and encodes MP4

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Cursor, text FX, terminal components (+ scraper log asset)

**Files:**
- Create: `showcase-videos/compose/cursor.js`, `showcase-videos/compose/fx.js`, `showcase-videos/compose/theme.css`, `showcase-videos/compose/terminal.js`, `showcase-videos/compose/assets/scraper_log.js`
- Modify: `showcase-videos/compose/selftest.html` (append component checks)

**Interfaces:**
- Consumes: `TL.eases` (Task 2).
- Produces:
  - `Cursor.stateAt(log, f)` → `{x, y, pressed, ripple, over}` where `log = {fps, events:[{f, kind:'click'|'hover'|'type', x, y}]}`; position interpolates between consecutive positioned events with `inOutCubic` plus an `outBack` arrival overshoot when the segment is longer than 300px; `ripple` decays 1→0 over the 24 frames after each click; `pressed` true for 6 frames from the click frame.
  - `Cursor.mount(container)` → returns `{layer, update(state)}`; injects the pointer SVG (below) at 2× scale with a drop shadow, and a `.cur-ripple` div animated via `ripple`.
  - `FX.title(container, {lines:[...]})`, `FX.caption(container, text)`, `FX.pill(container, text)`, `FX.typewriter(el, text, p)` — all return an element; animate by calling the returned element's `._fx(p)` with eased progress from a normal track.
  - `Terminal.mount(container, {title})` → `{el, update(lines, p)}` where `lines` is `window.SCRAPER_LOG` and `p` reveals `Math.floor(p*lines.length)` lines, type-on for the newest.
  - `window.SCRAPER_LOG = [{t:'ok'|'run'|'warn'|'gate', s:'line text'}]` — 14–18 real lines.
  - Pointer SVG (use verbatim in `Cursor.mount`):
    ```html
    <svg width="17" height="24" viewBox="0 0 17 24"><path d="M1 1 L1 19 L5.5 15.2 L8.6 22.4 L11.7 21.1 L8.6 14 L14.6 13.6 Z" fill="#05070f" stroke="#eaf2ff" stroke-width="1.4" stroke-linejoin="round"/></svg>
    ```

- [ ] **Step 1: Append failing checks to `selftest.html`**

Add before the emit block (new script tags for `cursor.js`, `fx.js`, `terminal.js` in the head):

```javascript
  const log = {fps:60, events:[{f:0,kind:'hover',x:100,y:100},{f:60,kind:'click',x:700,y:400}]};
  let s = Cursor.stateAt(log, 0);
  ok('cursor start', s.x === 100 && s.y === 100 && !s.pressed, JSON.stringify(s));
  s = Cursor.stateAt(log, 30);
  ok('cursor between', s.x > 110 && s.x < 790, s.x);   // outBack overshoot is expected on long hops
  s = Cursor.stateAt(log, 62);
  ok('cursor pressed', s.pressed === true && s.ripple > 0.8, JSON.stringify(s));
  s = Cursor.stateAt(log, 100);
  ok('ripple decayed', s.ripple === 0, s.ripple);
  const host = document.createElement('div'); document.body.appendChild(host);
  const pill = FX.pill(host, 'Plan optimized');
  pill._fx(0);  ok('pill hidden at 0', getComputedStyle(pill).opacity === '0', getComputedStyle(pill).opacity);
  pill._fx(1);  ok('pill shown at 1', getComputedStyle(pill).opacity === '1', getComputedStyle(pill).opacity);
  const term = Terminal.mount(host, {title:'weekly refresh'});
  term.update([{t:'ok',s:'a'},{t:'ok',s:'b'},{t:'gate',s:'c'}], 0.67);
  ok('terminal reveals 2 of 3', term.el.querySelectorAll('.tl-line').length === 2, term.el.innerHTML.length);
```

Run: `powershell -File showcase-videos\render\selftest.ps1` — Expected: FAIL (`Cursor is not defined`).

- [ ] **Step 2: Implement `cursor.js`**

```javascript
(function () {
  const E = TL.eases;
  function positioned(events) { return events.filter(e => e.x !== undefined); }
  function stateAt(log, f) {
    const evs = positioned(log.events);
    let a = evs[0], b = evs[evs.length - 1];
    for (let i = 0; i < evs.length - 1; i++)
      if (f >= evs[i].f && f <= evs[i + 1].f) { a = evs[i]; b = evs[i + 1]; break; }
    let x, y;
    if (f <= a.f) { x = a.x; y = a.y; }
    else if (f >= b.f) { x = b.x; y = b.y; }
    else {
      const span = Math.max(1, b.f - a.f);
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const p = (f - a.f) / span;
      const ease = dist > 300 ? E.outBack : E.inOutCubic;   // long hops overshoot
      const q = ease(p);
      x = a.x + (b.x - a.x) * q; y = a.y + (b.y - a.y) * q;
    }
    let pressed = false, ripple = 0;
    for (const e of log.events) if (e.kind === 'click') {
      if (f >= e.f && f < e.f + 6) pressed = true;
      if (f >= e.f && f < e.f + 24) ripple = Math.max(ripple, 1 - (f - e.f) / 24);
    }
    return { x, y, pressed, ripple, over: b.kind === 'click' };
  }
  function mount(container) {
    const layer = document.createElement('div');
    layer.className = 'cursor-layer';
    layer.innerHTML =
      '<div class="cur-ripple"></div>' +
      '<svg width="17" height="24" viewBox="0 0 17 24"><path d="M1 1 L1 19 L5.5 15.2 ' +
      'L8.6 22.4 L11.7 21.1 L8.6 14 L14.6 13.6 Z" fill="#05070f" stroke="#eaf2ff" ' +
      'stroke-width="1.4" stroke-linejoin="round"/></svg>';
    container.appendChild(layer);
    function update(s) {
      layer.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.pressed ? 1.7 : 2})`;
      const r = layer.querySelector('.cur-ripple');
      r.style.opacity = s.ripple * 0.6;
      r.style.transform = `translate(-14px,-14px) scale(${1 + (1 - s.ripple) * 1.6})`;
    }
    return { layer, update };
  }
  window.Cursor = { stateAt, mount };
})();
```

- [ ] **Step 3: Implement `fx.js`, `terminal.js`, `theme.css`**

`theme.css` (tokens + component styles — the baseline to art-direct later):

```css
:root{--bg:#05070f;--bg2:#070b18;--ink:#eaf2ff;--accent:#4da3ff;--accent2:#43e7d0;
  --mono:'Cascadia Code','Consolas',monospace;--sans:'Segoe UI',system-ui,sans-serif}
body{margin:0;width:1920px;height:1080px;overflow:hidden;background:
  radial-gradient(120% 90% at 70% -10%,#0b1330 0%,transparent 60%),
  radial-gradient(100% 80% at 10% 110%,#081226 0%,transparent 55%),var(--bg);
  font-family:var(--sans);color:var(--ink)}
.stage{position:absolute;inset:0}
.screen-frame{position:absolute;border-radius:18px;overflow:hidden;background:#0b0f1c;
  box-shadow:0 0 0 1px rgba(234,242,255,.08),0 30px 90px rgba(0,0,0,.55),
  0 0 120px rgba(77,163,255,.22);transform-style:preserve-3d}
.screen-frame .bar{height:44px;background:#0b0f1c;display:flex;align-items:center;gap:8px;
  padding:0 18px;border-bottom:1px solid rgba(234,242,255,.07)}
.screen-frame .dot{width:11px;height:11px;border-radius:50%;background:#26314f}
.screen-frame .url{margin-left:12px;font:500 15px var(--mono);color:#8fa3c8;
  background:#111731;border-radius:8px;padding:5px 14px}
.screen-frame img{display:block;width:100%}
.cursor-layer{position:absolute;left:0;top:0;z-index:40;will-change:transform;
  filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.cur-ripple{position:absolute;width:28px;height:28px;border-radius:50%;
  border:2px solid var(--accent);opacity:0}
.fx-title{position:absolute;width:100%;text-align:center;font-weight:800;
  font-size:92px;letter-spacing:-.02em;line-height:1.06}
.fx-title .w{display:inline-block;will-change:transform,opacity,filter}
.fx-caption{position:absolute;left:80px;bottom:72px;font:600 30px var(--sans);
  background:rgba(7,11,24,.82);border:1px solid rgba(77,163,255,.35);border-radius:14px;
  padding:16px 26px;backdrop-filter:blur(6px)}
.fx-pill{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  font:800 54px var(--sans);color:#04131f;padding:26px 64px;border-radius:999px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  box-shadow:0 0 90px rgba(67,231,208,.5)}
.term{position:absolute;background:#070b18;border:1px solid rgba(234,242,255,.1);
  border-radius:14px;font:500 24px/1.7 var(--mono);padding:0;overflow:hidden;
  box-shadow:0 30px 90px rgba(0,0,0,.5)}
.term .tbar{height:40px;background:#0b0f1c;display:flex;align-items:center;gap:8px;padding:0 16px;
  color:#8fa3c8;font-size:16px}
.term .tbody{padding:18px 26px}
.tl-line{white-space:pre}
.tl-line.ok{color:#7ee2a8}.tl-line.run{color:var(--ink)}
.tl-line.warn{color:#ffd479}.tl-line.gate{color:var(--accent2);font-weight:700}
```

`fx.js`:

```javascript
(function () {
  function title(container, {lines}) {
    const el = document.createElement('div');
    el.className = 'fx-title';
    el.innerHTML = lines.map(l =>
      l.split(' ').map(w => `<span class="w">${w}</span>`).join(' ')).join('<br>');
    container.appendChild(el);
    const words = [...el.querySelectorAll('.w')];
    el._fx = p => words.forEach((w, i) => {
      const q = TL.eases.outCubic(Math.max(0, Math.min(1, p * words.length * 0.55 - i * 0.35)));
      w.style.opacity = q;
      w.style.transform = `translateY(${(1 - q) * 46}px)`;
      w.style.filter = `blur(${(1 - q) * 8}px)`;
    });
    el._fx(0);
    return el;
  }
  function caption(container, text) {
    const el = document.createElement('div');
    el.className = 'fx-caption';
    el.textContent = text;
    container.appendChild(el);
    el._fx = p => {
      el.style.opacity = Math.min(1, p * 3) * (p > 0.9 ? (1 - p) * 10 : 1);
      el.style.transform = `translateY(${(1 - Math.min(1, p * 3)) * 30}px)`;
    };
    el._fx(0);
    return el;
  }
  function pill(container, text) {
    const el = document.createElement('div');
    el.className = 'fx-pill';
    el.textContent = text;
    container.appendChild(el);
    el._fx = p => {
      const q = TL.eases.outBack(Math.min(1, p * 2));
      el.style.opacity = p === 0 ? 0 : Math.min(1, p * 4);
      el.style.transform = `translate(-50%,-50%) scale(${0.6 + q * 0.4})`;
    };
    el._fx(0);
    return el;
  }
  function typewriter(el, text, p) {
    el.textContent = text.slice(0, Math.round(text.length * Math.min(1, p)));
  }
  window.FX = { title, caption, pill, typewriter };
})();
```

`terminal.js`:

```javascript
(function () {
  function mount(container, {title}) {
    const el = document.createElement('div');
    el.className = 'term';
    el.innerHTML = `<div class="tbar"><span class="dot"></span><span class="dot"></span>` +
      `<span class="dot"></span><span style="margin-left:10px">${title}</span></div>` +
      `<div class="tbody"></div>`;
    container.appendChild(el);
    function update(lines, p) {
      const shown = Math.floor(Math.max(0, Math.min(1, p)) * lines.length);
      const body = el.querySelector('.tbody');
      const frac = p * lines.length - shown;      // type-on for the newest line
      body.innerHTML = lines.slice(0, shown).map((l, i) => {
        const s = (i === shown - 1 && frac < 0.5)
          ? l.s.slice(0, Math.ceil(l.s.length * frac * 2)) : l.s;
        return `<div class="tl-line ${l.t}">${s}</div>`;
      }).join('');
    }
    return { el, update };
  }
  window.Terminal = { mount };
})();
```

- [ ] **Step 4: Curate the scraper log asset from the real log**

```powershell
Get-Content "myplanBYU\scraper\run.log" -Tail 150
Get-Content "myplanBYU\scraper\data\_rejected\20260802-032257\_health_report.txt"
```

From that output pick 14–18 lines telling this story in order: run starts → per-source lines with real counts (catalog, class schedule, MAPs, Kennedy study abroad, scholarships/policies, clubs, research grants…) → health checks → the quarantine gate. Rules: copy line text **verbatim** (trim timestamps to `HH:MM:SS`), skip any line containing an API key, token, email, or absolute local path. Write them as `showcase-videos/compose/assets/scraper_log.js`:

```javascript
window.SCRAPER_LOG = [
  {t:'run',  s:'> weekly refresh - 12 sources'},
  // ...real lines here, typed t:'ok' for per-source successes,
  // t:'warn' for any warning worth showing, and end with:
  {t:'gate', s:'health gate: PASS - promoted to live data/'},
];
```

The final `gate` line must reflect what the health report actually says — if the real artifact phrases it differently, use the real phrasing.

- [ ] **Step 5: Run selftest — expect PASS, then commit**

Run: `powershell -File showcase-videos\render\selftest.ps1`
Expected: all checks pass (engine 7 + new 8), exit 0.

```bash
git add showcase-videos/compose/
git commit -m "showcase: cursor, text FX, terminal components + curated scraper log

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: myplanBYU capture (`capture/capture_myplan.py`)

**Files:**
- Create: `showcase-videos/capture/capture_myplan.py`
- Create: `showcase-videos/capture/validate_frames.py`
- Output (not committed): `$env:TEMP\showcase\myplan\s1|s2|s3\f00000.jpg...`, `showcase-videos/raw/events/s1.json|s3.json`

**Interfaces:**
- Consumes: `Chrome` frame-loop contract (Task 1); the app at `http://localhost:8130` served by `myplanBYU/.claude/serve.ps1`.
- Produces: three scenes at 1920×1080 **dsf=2** (3840×2160 JPEGs, quality 88) named `f%05d.jpg` from 0:
  - **s1** (600 frames, 10s): wizard open → major typed & picked → steps → solve. Events log `raw/events/s1.json`.
  - **s2** (240 frames, 4s): the solved board settling (no cursor needed → no events file).
  - **s3** (480 frames, 8s): left panel — flags, then `#timelineSec` accordions (Relevant scholarships, Study abroad) opening. Events log `raw/events/s3.json`.
  - Event schema (consumed by `Cursor.stateAt` — coordinates in **CSS px at 1920×1080**): `{"fps":60, "events":[{"f":30, "kind":"hover", "x":960, "y":540, "sel":"#newPlanBtn"}, {"f":90, "kind":"click", "x":960, "y":540, "sel":"#newPlanBtn"}, {"f":140, "kind":"type", "x":960, "y":300, "text":"Information Systems"}]}`.
- Key app selectors (verified in `myplanBYU/index.html`): `#newPlanBtn`, `#wizardModal`, `#wizBody`, `#wizNext`, `#wizBack`, `#board`, `#panelLeft`, `#flagList`, `#timelineSec`, `#timelineList`, accordion `<details class="tl-acc"><summary>` inside `#timelineSec`.

- [ ] **Step 1: Write the capture script**

```python
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
            ["powershell", "-NoProfile", "-File",
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

    def type(self, f, sel, text):
        def fn():
            r = self.c.rect(sel)
            assert r, f"selector not found: {sel}"
            self.c.click(r["x"], r["y"])
            self.c.type_text(text)
            self.events.append({"f": f, "kind": "type", "x": r["x"], "y": r["y"], "text": text})
        self.at(f, fn)

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
    """Click #wizNext at frame f if the wizard is still open; returns next slot."""
    sc.click(f, "#wizNext")
    return f + 55

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", default="all")
    ap.add_argument("--debug", action="store_true")
    a = ap.parse_args()
    server = ensure_server()
    c = Chrome(port=9422, width=1920, height=1080)
    try:
        c.metrics(1920, 1080, dsf=2)
        c.goto(URL, settle=4.0)
        c.wait_expr("document.readyState==='complete' && !!document.querySelector('#board')")
        c.vt_pause()

        if a.scene in ("s1", "all"):
            sc = Scene(c, "s1", 600)
            sc.hover(20, "#newPlanBtn")
            sc.click(55, "#newPlanBtn")
            # wizard step 1: search + pick the major. The exact controls inside
            # #wizBody are dynamic — resolve them at runtime, prefer the search input.
            sc.type(110, "#wizBody input", MAJOR)
            sc.click(220, "#wizBody .wiz-choice, #wizBody li, #wizBody button")
            f = 290
            for _ in range(4):                      # advance through remaining steps;
                f = wizard_advance(c, sc, f)        # match count to the real wizard
            sc.run()

        if a.scene in ("s2", "all"):
            c.wait_expr("!!document.querySelector('#board') && document.querySelectorAll('#board *').length > 20")
            sc = Scene(c, "s2", 240)
            sc.js(0, "document.querySelector('#board').scrollIntoView({block:'start'})")
            sc.run()

        if a.scene in ("s3", "all"):
            sc = Scene(c, "s3", 480)
            sc.js(0, "document.querySelector('#panelLeft').scrollTop = 0")
            sc.hover(20, "#flagList")
            sc.js(70, "document.querySelector('#flagList').scrollIntoView({behavior:'smooth',block:'center'})")
            sc.js(150, "document.querySelector('#timelineSec').scrollIntoView({behavior:'smooth',block:'start'})")
            sc.click(230, "#timelineSec details.tl-acc:nth-of-type(1) summary")
            sc.click(340, "#timelineSec details.tl-acc:nth-of-type(2) summary")
            sc.run()

        if a.debug:
            c.shot(os.path.join(OUT, "debug-final.png"))
    finally:
        c.close()
        if server:
            server.terminate()

if __name__ == "__main__":
    main()
```

Wizard-flow honesty note: the number of wizard steps and the pick-list selector inside `#wizBody` are dynamic. The first run IS the discovery pass: run with `--debug --scene s1`, inspect frames in `$env:TEMP\showcase\myplan\s1` around f110–f290, and adjust the `sc.type` / `sc.click` selectors and frame slots in `main()` until the sequence shows: modal opens → query typed → major chosen → steps advance → wizard closes with the board filling. Selector spelunking helpers:

```bash
python -c "import sys; sys.path.insert(0,'showcase-videos/tools'); from cdp import Chrome; c=Chrome(port=9433,width=1920,height=1080); c.metrics(1920,1080,dsf=1); c.goto('http://localhost:8130/index.html',settle=4); c.eval(\"document.querySelector('#newPlanBtn').click()\"); import time; time.sleep(1); print(c.eval(\"document.querySelector('#wizBody').innerHTML.slice(0,3000)\")); c.close()"
```

While tuning, match the number of `wizard_advance` calls to the wizard's real step count — if fewer than 4 steps exist, extra `#wizNext` clicks fire after the wizard closes and the assert trips (`#wizNext` has no rect when hidden); delete the extra advances. Note `--scene s2`/`s3` alone assume s1 already solved a plan in the same Chrome session — `--scene all` is the canonical flow.

- [ ] **Step 2: Write the frame validator**

`showcase-videos/capture/validate_frames.py`:

```python
"""Sanity-checks a captured scene dir: count, JPEG dimensions, size floor.
Usage: python validate_frames.py <dir> <expected_count> [--min-kb 30] [--w 3840] [--h 2160]"""
import argparse, glob, os, struct, sys

def jpeg_dims(path):
    with open(path, "rb") as f:
        data = f.read(65536)
    i = 2
    while i < len(data) - 9:
        if data[i] != 0xFF: i += 1; continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7: i += 2; continue
        seg = struct.unpack(">H", data[i + 2:i + 4])[0]
        i += 2 + seg
    return None, None

ap = argparse.ArgumentParser()
ap.add_argument("dir"); ap.add_argument("count", type=int)
ap.add_argument("--min-kb", type=int, default=30)
ap.add_argument("--w", type=int, default=3840); ap.add_argument("--h", type=int, default=2160)
a = ap.parse_args()
files = sorted(glob.glob(os.path.join(a.dir, "f*.jpg")))
bad = []
if len(files) != a.count:
    bad.append(f"count {len(files)} != {a.count}")
for p in files[:: max(1, len(files) // 25)]:
    w, h = jpeg_dims(p)
    kb = os.path.getsize(p) // 1024
    if (w, h) != (a.w, a.h): bad.append(f"{os.path.basename(p)} dims {w}x{h}")
    if kb < a.min_kb: bad.append(f"{os.path.basename(p)} only {kb} KB")
print("FAIL:\n  " + "\n  ".join(bad) if bad else f"PASS {a.dir} ({len(files)} frames)")
sys.exit(1 if bad else 0)
```

- [ ] **Step 3: Capture and validate all three scenes**

```bash
python showcase-videos/capture/capture_myplan.py --scene all --debug
python showcase-videos/capture/validate_frames.py "$TEMP/showcase/myplan/s1" 600
python showcase-videos/capture/validate_frames.py "$TEMP/showcase/myplan/s2" 240
python showcase-videos/capture/validate_frames.py "$TEMP/showcase/myplan/s3" 480
```
Expected: three `PASS` lines; `raw/events/s1.json` and `s3.json` exist with ≥4 and ≥4 events. Eyeball `s1` frames at f60/f240/f560 (Read them as images): wizard visibly opens, major typed, board fills. Iterate the scenario constants until the story reads.

- [ ] **Step 4: Commit (scripts only)**

```bash
git add showcase-videos/capture/capture_myplan.py showcase-videos/capture/validate_frames.py
git commit -m "showcase: deterministic myplanBYU scene capture with interaction event log

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Tests-page, scroller captures + draft-test asset prep

**Files:**
- Create: `showcase-videos/capture/capture_tests.py`, `showcase-videos/capture/capture_scroller.py`, `showcase-videos/capture/explode_clips.ps1`
- Output (not committed): `$env:TEMP\showcase\tests\report.png` + `showcase-videos/raw/tests/report.json`; `$env:TEMP\showcase\scroller\hook|outro\f*.jpg`; `$env:TEMP\showcase\clips\<name>\f*.jpg`

**Interfaces:**
- Consumes: `Chrome` (Task 1); `myplanBYU/tests/index.html?run=curated&emit=report` (its `#emit` pre holds base64 JSON with `totals={pass,cases,fail,known,warn}`, `ms`); `Universe scroller/index.html` (exposes `window.__uni`, driven by page scroll); draft-test media at 864×496@24fps.
- Produces:
  - `report.png` — the tests page fully rendered at dsf=2 (single still), `report.json` — the decoded emit payload.
  - Scroller scenes at 1920×1080 dsf=1: `hook` 300 frames (fast scrub, low→high scale), `outro` 270 frames (slow scrub).
  - Clip sequences at native 24fps: `clips/clip1/f%05d.jpg` (120), `clips/clip2` (120), `clips/stitched/f%05d.jpg` (236 = 9.8s), plus `clips/anchors/` copies of `anchor-A-city.png`, `anchor-B-earth.png`, `anchor-C-earthmoon.png`.

- [ ] **Step 1: `capture_tests.py`**

```python
"""Renders the myplanBYU in-browser test report; saves still + parsed totals."""
import base64, json, os, sys, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from cdp import Chrome

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
page = os.path.join(ROOT, "myplanBYU", "tests", "index.html")
url = "file:///" + urllib.parse.quote(page.replace("\\", "/"), safe="/:") + "?run=curated&emit=report"
out_dir = os.path.join(os.environ["TEMP"], "showcase", "tests")
os.makedirs(out_dir, exist_ok=True)
raw_dir = os.path.join(HERE, "..", "raw", "tests")
os.makedirs(raw_dir, exist_ok=True)

c = Chrome(port=9444, width=1920, height=1080)
try:
    c.metrics(1920, 1080, dsf=2)
    c.goto(url, settle=3.0)
    c.wait_expr("!!document.querySelector('#emit') && document.querySelector('#emit').textContent.length > 10", timeout=180)
    payload = json.loads(base64.b64decode(c.eval("document.querySelector('#emit').textContent")).decode("utf-8"))
    with open(os.path.join(raw_dir, "report.json"), "w") as f:
        json.dump(payload, f, indent=1)
    c.eval("document.querySelector('#emit').style.display='none'; window.scrollTo(0,0)")
    c.shot(os.path.join(out_dir, "report.png"))
    t = payload["totals"]
    print("PASS" if t["fail"] == 0 else "FAIL", t)
finally:
    c.close()
```

Run: `python showcase-videos/capture/capture_tests.py`
Expected: `PASS {'cases': ..., 'pass': ..., 'fail': 0, ...}`; if `fail != 0`, **stop** — a red test report is not showcase material; report to Jordan instead of proceeding.

- [ ] **Step 2: `capture_scroller.py`**

```python
"""Scrubs the live Universe Scroller under virtual time; captures two scenes.
Serves the repo root with http.server (the scroller loads 1445 frame JPEGs)."""
import math, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
from cdp import Chrome

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(os.environ["TEMP"], "showcase", "scroller")
URL = "http://localhost:8140/Universe%20scroller/index.html"

def ease_io(p): return 2*p*p if p < .5 else -1 + (4 - 2*p) * p

srv = subprocess.Popen([sys.executable, "-m", "http.server", "8140"], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
c = Chrome(port=9455, width=1920, height=1080)
try:
    c.metrics(1920, 1080, dsf=1)          # EXACT 16:9 or the engine opens side bars
    c.goto(URL, settle=6.0)
    c.wait_expr("!!window.__uni")
    H = c.eval("document.documentElement.scrollHeight - innerHeight")
    c.vt_pause()
    for name, frames, a, b, ease in (
        ("hook", 300, 0.12, 0.94, ease_io),      # 5s fast city->galaxy scrub
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
    c.close()
    srv.terminate()
```

Run + validate:

```bash
python showcase-videos/capture/capture_scroller.py
python showcase-videos/capture/validate_frames.py "$TEMP/showcase/scroller/hook" 300 --w 1920 --h 1080
python showcase-videos/capture/validate_frames.py "$TEMP/showcase/scroller/outro" 270 --w 1920 --h 1080
```
Expected: `PASS` ×2, and the printed `__uni.idx` values during `hook` **strictly increase** (the scrub actually travels). The scroller's playhead eases toward the scroll target — a fast scrub trailing slightly behind is the intended cinematic feel. Tune `a`/`b` fractions after eyeballing f000/f150/f299: hook should start on recognizable city and end deep in space.

- [ ] **Step 3: `explode_clips.ps1`**

```powershell
# Explodes the Higgsfield draft-test media into frame sequences for the compositor.
$ErrorActionPreference = "Stop"
$src = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "Universe scroller\draft-test"
$out = Join-Path $env:TEMP "showcase\clips"
$jobs = @(
  @{ in = "clip1-city-to-earth.mp4";    dir = "clip1" },
  @{ in = "clip2-earth-to-moon.mp4";    dir = "clip2" },
  @{ in = "stitched-city-to-moon.mp4";  dir = "stitched" }
)
foreach ($j in $jobs) {
  $d = Join-Path $out $j.dir
  New-Item -ItemType Directory -Force $d | Out-Null
  ffmpeg -v error -y -i (Join-Path $src $j.in) -start_number 0 (Join-Path $d "f%05d.jpg")
  Write-Host ("{0}: {1} frames" -f $j.dir, (Get-ChildItem "$d\f*.jpg").Count)
}
$anchors = Join-Path $out "anchors"
New-Item -ItemType Directory -Force $anchors | Out-Null
Copy-Item (Join-Path $src "anchor-*.png") $anchors
Write-Host ("anchors: {0}" -f (Get-ChildItem "$anchors\*.png").Count)
```

Run: `powershell -File showcase-videos\capture\explode_clips.ps1`
Expected: `clip1: 120 frames`, `clip2: 120 frames`, `stitched: ~236 frames`, `anchors: 3`.

- [ ] **Step 4: Commit**

```bash
git add showcase-videos/capture/capture_tests.py showcase-videos/capture/capture_scroller.py showcase-videos/capture/explode_clips.ps1
git commit -m "showcase: tests-report, scroller-scrub, and clip-explosion captures

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: myplanBYU composition (`compose/myplanbyu.html`)

**Files:**
- Create: `showcase-videos/compose/myplanbyu.html`
- Consumes: all Task 2/4 components; frames under `RENDER.framesRoot + '/myplan/s1..s3'`, `'/tests/report.png'`; `raw/events/s1.json` + `s3.json` (inline their contents — see Step 1); `raw/tests/report.json` totals; `assets/scraper_log.js`.

Timeline: **2100 frames @60fps (35.0s)**. Beat map (from the spec): hook 0–240, optimizer 240–720, insights 720–1140, scraper 1140–1560, tests 1560–1860, outro 1860–2100.

- [ ] **Step 1: Inline the event logs**

`fetch()` is unreliable over `file://`; copy the JSON into the page. Generate the snippet:

```powershell
"window.EVENTS_S1 = " + (Get-Content "showcase-videos\raw\events\s1.json" -Raw) + ";"
"window.EVENTS_S3 = " + (Get-Content "showcase-videos\raw\events\s3.json" -Raw) + ";"
"window.TEST_TOTALS = " + ((Get-Content "showcase-videos\raw\tests\report.json" -Raw | ConvertFrom-Json).totals | ConvertTo-Json -Compress) + ";"
```

Paste the three outputs into a `<script>` block in the page (Step 2). Re-run this step whenever captures are redone.

- [ ] **Step 2: Build the page**

```html
<!DOCTYPE html><meta charset="utf-8"><title>myplanBYU showcase</title>
<link rel="stylesheet" href="theme.css">
<div class="stage" id="stage">
  <!-- beat 1+2: app in a tilted glowing frame; same frame carries s1,s2,s3 -->
  <div class="screen-frame" id="appframe" style="left:240px;top:120px;width:1440px">
    <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
      <span class="url">jordanheaton.com/myplanBYU</span></div>
    <img id="app" alt="">
  </div>
  <div id="titles"></div>
</div>
<script src="render-config.js"></script>
<script>/* PASTE from Step 1: window.EVENTS_S1 / EVENTS_S3 / TEST_TOTALS */</script>
<script src="engine.js"></script><script src="cursor.js"></script>
<script src="fx.js"></script><script src="terminal.js"></script>
<script src="assets/scraper_log.js"></script>
<script>
const R = (window.RENDER && RENDER.framesRoot) || '../raw';   // render-config injected by render.py
const stage = document.getElementById('stage');
const frameEl = document.getElementById('appframe');
const app = document.getElementById('app');
const titles = document.getElementById('titles');

/* --- static mounts --- */
const title = FX.title(titles, {lines:['170+ majors. Every prereq.', 'One optimized plan.']});
title.style.top = '780px';
const cap = {
  opt:  FX.caption(stage, 'In-browser constraint solver — prereqs, cohort blocks, credit caps'),
  ins:  FX.caption(stage, 'Warnings, recommendations — plus scholarships & study abroad for YOUR plan'),
  scr:  FX.caption(stage, 'A weekly scraper keeps it honest — a broken scrape can\'t reach the live site'),
  tst:  FX.caption(stage, 'Every plan property checked by an in-browser test harness'),
};
const pill = FX.pill(stage, 'Plan optimized — every prereq satisfied');
const cur = Cursor.mount(stage);
const term = Terminal.mount(stage, {title:'weekly refresh — scraper/_pipeline.ps1'});
term.el.style.cssText += 'left:360px;top:200px;width:1200px;height:640px';
const tests = document.createElement('img');
tests.style.cssText = 'position:absolute;left:240px;top:120px;width:1440px;border-radius:18px';
stage.appendChild(tests);
const testsWipe = document.createElement('div');   // reveal mask over the report
testsWipe.style.cssText = 'position:absolute;left:240px;top:120px;width:1440px;height:810px;background:linear-gradient(#05070f,#05070f)';
stage.appendChild(testsWipe);
const counter = document.createElement('div');
counter.className = 'fx-caption'; counter.style.cssText += 'left:auto;right:80px;font-size:44px';
stage.appendChild(counter);
const outro = FX.title(titles, {lines:['jordanheaton.com/myplanBYU']});
outro.style.top = '500px';

/* --- event logs shifted onto the master timeline --- */
const s1log = {fps:60, events: EVENTS_S1.events.map(e => ({...e, f: e.f + 240}))};
const s3log = {fps:60, events: EVENTS_S3.events.map(e => ({...e, f: e.f + 720}))};
/* app frames are 3840x2160 for a 1440px-wide frame: cursor coords (CSS px @1920)
   map into the frame at scale 1440/1920 = 0.75 plus the frame's offset. */
const mapCur = (s) => ({...s, x: 240 + s.x * 0.75, y: 164 + s.y * 0.75});  // 164 = frame top 120 + bar 44

const seq = (f0, f1, name, count, srcFps=60) =>
  ({el: app, f0, f1, seq: {root: R + '/myplan/' + name, count, srcFps}});

TL.build({fps:60, frames:2100, tracks:[
  /* hook: board (s2) drifting behind the title, then title clears */
  seq(0, 240, 's2', 240),
  {el: frameEl, f0: 0, f1: 240, ease: 'inOutQuad',
   apply: (el, p) => el.style.transform =
     `perspective(2200px) rotateX(${8 - p * 8}deg) rotateY(${-10 + p * 10}deg) scale(${0.92 + p * 0.08})`},
  {el: title, f0: 10, f1: 200, ease: 'linear', apply: (el, p) => el._fx(p < 0.75 ? p / 0.75 : 1)},
  {el: title, f0: 200, f1: 240, ease: 'outQuad', apply: (el, p) => el.style.opacity = 1 - p},

  /* optimizer: s1 frames, cursor, caption, payoff pill at solve */
  seq(240, 720, 's1', 600),
  {f0: 0, run: f => { cur.layer.style.opacity = (f >= 240 && f < 1080) ? 1 : 0; }},
  {f0: 240, run: f => { if (f >= 240 && f < 720) cur.update(mapCur(Cursor.stateAt(s1log, f))); }},
  {el: cap.opt, f0: 270, f1: 700, ease: 'linear', apply: (el, p) => el._fx(p)},
  {el: pill, f0: 640, f1: 720, ease: 'linear', apply: (el, p) => el._fx(p < 0.85 ? p / 0.85 : 1 - (p - 0.85) / 0.15)},

  /* insights: s3 frames + punch-in AFTER the last click (a zoom while the cursor
     is live would desync pointer coords from the transformed frame) */
  seq(720, 1140, 's3', 480),
  {f0: 720, run: f => { if (f >= 720 && f < 1080) cur.update(mapCur(Cursor.stateAt(s3log, f))); }},
  {el: frameEl, f0: 1080, f1: 1140, ease: 'inOutCubic',
   apply: (el, p) => el.style.transform = `scale(${1 + p * 0.12}) translate(${-p * 90}px, ${-p * 45}px)`},
  {el: cap.ins, f0: 750, f1: 1120, ease: 'linear', apply: (el, p) => el._fx(p)},

  /* scraper: app frame yields to the terminal */
  {el: frameEl, f0: 1140, f1: 1180, ease: 'inQuad', apply: (el, p) => el.style.opacity = 1 - p},
  {f0: 1140, run: f => {
    const p = Math.max(0, Math.min(1, (f - 1160) / 340));
    term.el.style.opacity = f < 1140 || f >= 1570 ? 0 : 1;
    term.update(SCRAPER_LOG, p);
  }},
  {el: cap.scr, f0: 1180, f1: 1540, ease: 'linear', apply: (el, p) => el._fx(p)},

  /* tests: report still wipes in, counter ticks to the real totals */
  {f0: 1560, run: f => {
    tests.src = R + '/tests/report.png';
    const p = Math.max(0, Math.min(1, (f - 1560) / 200));
    tests.style.opacity = f >= 1560 && f < 1880 ? 1 : 0;
    testsWipe.style.opacity = tests.style.opacity;
    testsWipe.style.transform = `translateY(${p * 810}px)`;
    const shown = Math.round(TEST_TOTALS.pass * p);
    counter.textContent = `${shown}/${TEST_TOTALS.cases} invariants green`;
    counter.style.opacity = tests.style.opacity;
  }},
  {el: cap.tst, f0: 1590, f1: 1850, ease: 'linear', apply: (el, p) => el._fx(p)},

  /* outro */
  {el: outro, f0: 1880, f1: 2020, ease: 'linear', apply: (el, p) => el._fx(p)},
]});
</script>
```

- [ ] **Step 3: Fast-preview render, then iterate**

```bash
python showcase-videos/render/render.py ../compose/myplanbyu.html --out ../dist/_myplan-preview.mp4 --stride 4 --quality 80
```
Expected: `WROTE ... 35.0 s` at 15fps preview. Open it, and also Read spot frames. Check against the spec checklist: hook title legible ≤4s, cursor lands on what it clicks (if offset, fix the `mapCur` math — the 0.75 scale and 240/164 offsets must match `#appframe`'s geometry), captions never overlap the cursor, terminal type-on readable, counter matches `report.json`. Iterate copy/spacing until it reads at 400px wide (zoom a frame to 400px and Read it).

- [ ] **Step 4: Commit**

```bash
git add showcase-videos/compose/myplanbyu.html
git commit -m "showcase: myplanBYU composition — six beats, cursor-driven demo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Scroller composition (`compose/scroller.html`)

**Files:**
- Create: `showcase-videos/compose/scroller.html`
- Consumes: frames under `RENDER.framesRoot + '/scroller/hook|outro'` (1920×1080@60) and `'/clips/clip1|clip2|stitched'` (864×496@24) and `'/clips/anchors/*.png'`.

Timeline: **2100 frames @60fps (35s)**: hook 0–240, anchors 240–660, generation 660–1140, stitch & scrub 1140–1680, outro 1680–2100.

- [ ] **Step 1: Build the page**

```html
<!DOCTYPE html><meta charset="utf-8"><title>Universe Scroller — process</title>
<link rel="stylesheet" href="theme.css">
<style>
.full{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover}
.anchor{position:absolute;top:330px;width:420px;border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(234,242,255,.1);opacity:0}
.arrow{position:absolute;top:445px;font:700 64px var(--sans);color:var(--accent2);opacity:0}
.clipbox{position:absolute;top:250px;width:864px;border-radius:14px;overflow:hidden;
  box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 90px rgba(77,163,255,.25);opacity:0}
.clipbox img{display:block;width:100%}
.gridwrap{position:absolute;inset:0;display:grid;grid-template-columns:repeat(8,1fr);
  gap:6px;padding:60px;opacity:0}
.gridwrap img{width:100%;border-radius:6px}
.scrollbar{position:absolute;right:40px;top:140px;width:10px;height:800px;
  border-radius:5px;background:rgba(234,242,255,.12);opacity:0}
.scrollbar .thumb{position:absolute;left:0;width:10px;height:90px;border-radius:5px;
  background:linear-gradient(var(--accent),var(--accent2))}
</style>
<div class="stage" id="stage">
  <img class="full" id="hookseq" alt="">
  <img class="anchor" id="a1" style="left:220px">
  <img class="anchor" id="a2" style="left:750px">
  <img class="anchor" id="a3" style="left:1280px">
  <div class="arrow" id="ar1" style="left:655px">→</div>
  <div class="arrow" id="ar2" style="left:1185px">→</div>
  <div class="clipbox" id="c1box" style="left:170px"><img id="c1"></div>
  <div class="clipbox" id="c2box" style="left:890px"><img id="c2"></div>
  <div class="gridwrap" id="grid"></div>
  <img class="full" id="stitchfull" alt="" style="opacity:0">
  <img class="full" id="outroseq" alt="" style="opacity:0">
  <div class="scrollbar" id="sb"><div class="thumb"></div></div>
  <div id="titles"></div>
</div>
<script src="render-config.js"></script>
<script src="engine.js"></script><script src="fx.js"></script>
<script>
const R = (window.RENDER && RENDER.framesRoot) || '../raw';
const $ = id => document.getElementById(id);
const stage = $('stage'), titles = $('titles');
$('a1').src = R + '/clips/anchors/anchor-A-city.png';
$('a2').src = R + '/clips/anchors/anchor-B-earth.png';
$('a3').src = R + '/clips/anchors/anchor-C-earthmoon.png';
for (let i = 0; i < 24; i++) {                        // frame-grid: every 10th stitched frame
  const im = document.createElement('img');
  im.src = R + '/clips/stitched/f' + String(i * 10).padStart(5, '0') + '.jpg';
  $('grid').appendChild(im);
}
const t1 = FX.title(titles, {lines:['One continuous zoom.', '1,445 frames.']});  t1.style.top='420px';
const capA = FX.caption(stage, 'Step 1 — direct a still image at each scale');
const capG = FX.caption(stage, 'Step 2 — AI video (Higgsfield) bridges each pair');
const capS = FX.caption(stage, 'Step 3 — color-match, stitch, precompute frames. Scroll drives the film.');
const outroT = FX.title(titles, {lines:['jordanheaton.com']});  outroT.style.top='760px';
/* Fade-outs must not clobber earlier tracks: apply() runs for EVERY track on every
   seek (p clamped), so a plain 1-p writes opacity 1 before its window. Min-guard
   against the value set earlier in the same seek. Forward-render only. */
const fadeOut = (el, f0, f1) => ({el, f0, f1, ease:'inQuad',
  apply:(e,p)=>e.style.opacity = Math.min(parseFloat(e.style.opacity || 1), 1 - p)});

TL.build({fps:60, frames:2100, tracks:[
  /* hook: real scroller scrub full-bleed under the title */
  {el:$('hookseq'), f0:0, f1:250, seq:{root:R+'/scroller/hook', count:300, srcFps:72}}, // 300 in 250 -> slight speedup
  {el:t1, f0:15, f1:210, ease:'linear', apply:(el,p)=>el._fx(p<0.8?p/0.8:1)},
  fadeOut($('hookseq'), 210, 250),
  fadeOut(t1, 210, 245),

  /* anchors slide up in sequence, arrows pop between them */
  ...[['a1',260],['a2',310],['a3',360]].map(([id,f0]) => (
    {el:$(id), f0, f1:f0+50, ease:'outCubic',
     apply:(el,p)=>{el.style.opacity=p; el.style.transform=`translateY(${(1-p)*70}px)`}})),
  ...[['ar1',420],['ar2',450]].map(([id,f0]) => (
    {el:$(id), f0, f1:f0+25, ease:'outBack', apply:(el,p)=>{el.style.opacity=p; el.style.transform=`scale(${p})`}})),
  {el:capA, f0:280, f1:640, ease:'linear', apply:(el,p)=>el._fx(p)},
  ...['a1','a2','a3','ar1','ar2'].map(id => (
    {el:$(id), f0:620, f1:660, ease:'inQuad', apply:(el,p)=>el.style.opacity=Math.min(parseFloat(el.style.opacity||1),1-p)})),

  /* generation: the two bridge clips play side by side */
  ...[['c1box',670],['c2box',700]].map(([id,f0]) => (
    {el:$(id), f0, f1:f0+40, ease:'outCubic', apply:(el,p)=>{el.style.opacity=p; el.style.transform=`translateY(${(1-p)*60}px)`}})),
  {el:$('c1'), f0:710, f1:1010, seq:{root:R+'/clips/clip1', count:120, srcFps:24}},
  {el:$('c2'), f0:740, f1:1040, seq:{root:R+'/clips/clip2', count:120, srcFps:24}},
  {el:capG, f0:700, f1:1110, ease:'linear', apply:(el,p)=>el._fx(p)},
  fadeOut($('c1box'), 1100, 1140),
  fadeOut($('c2box'), 1100, 1140),

  /* stitch & scrub: grid assembles, then the stitched film plays full-bleed with a scrollbar */
  {el:$('grid'), f0:1150, f1:1230, ease:'outCubic', apply:(el,p)=>{el.style.opacity=p; el.style.transform=`scale(${0.94+p*0.06})`}},
  fadeOut($('grid'), 1330, 1380),
  {el:$('stitchfull'), f0:1380, f1:1680, seq:{root:R+'/clips/stitched', count:236, srcFps:48}}, // 236@48 ~ 295 frames, clamps at end
  {el:$('stitchfull'), f0:1380, f1:1420, ease:'outQuad', apply:(el,p)=>el.style.opacity=p},
  {el:$('sb'), f0:1390, f1:1420, ease:'outQuad', apply:(el,p)=>el.style.opacity=p},
  {f0:1390, run:f=>{ if (f>=1390 && f<1680)
    $('sb').querySelector('.thumb').style.top = `${((f-1390)/290)*710}px`; }},
  {el:capS, f0:1400, f1:1660, ease:'linear', apply:(el,p)=>el._fx(p)},
  fadeOut($('stitchfull'), 1650, 1685),
  fadeOut($('sb'), 1650, 1680),

  /* outro: slow live scrub + URL */
  {el:$('outroseq'), f0:1680, f1:2099, seq:{root:R+'/scroller/outro', count:270, srcFps:39}}, // 270 over 420 frames
  {el:$('outroseq'), f0:1680, f1:1720, ease:'outQuad', apply:(el,p)=>el.style.opacity=p},
  {el:outroT, f0:1760, f1:1940, ease:'linear', apply:(el,p)=>el._fx(p)},
]});
</script>
```

- [ ] **Step 2: Preview render + iterate**

```bash
python showcase-videos/render/render.py ../compose/scroller.html --out ../dist/_scroller-preview.mp4 --stride 4 --quality 80
```
Checks: hook footage actually travels city→space (else adjust Task 6 scrub fractions and re-capture); anchor stills read at feed size; the 864px clips are never upscaled past 1× (crispness); the stitched sequence's 24fps origin shows no judder at the 48-src-fps playback mapping (if it judders, change `srcFps` to 24 and shorten the window to `f0:1380, f1:1970` — then rebalance the outro to start at 1970). Beat boundaries within ±1s of the spec beat sheet.

- [ ] **Step 3: Commit**

```bash
git add showcase-videos/compose/scroller.html
git commit -m "showcase: Universe Scroller process composition — five beats

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Music, final renders, QC

**Files:**
- Create: `showcase-videos/music/LICENSE.md` (+ two track files chosen by Jordan)
- Create: `showcase-videos/render/qc.py`
- Output: `showcase-videos/dist/myplanbyu-showcase.mp4`, `dist/universe-scroller-process.mp4`, `dist/myplanbyu-poster.jpg`, `dist/universe-scroller-poster.jpg`

**Interfaces:**
- Consumes: both compositions; `render.py --music`.
- Produces: the final committed MP4s + posters used by Task 10.

- [ ] **Step 1: Shortlist music with Jordan (BLOCKING — needs the user)**

Search pixabay.com/music (Pixabay Content License: free for commercial use, no attribution required — still record it) for: (a) myplanBYU — "minimal tech house 120bpm" feel, confident, not corporate; (b) Scroller — "ambient cinematic build" feel, awe without cheese. Present 3 candidate links per video in chat. **Ask Jordan to pick, and ask his approval to download the two files** (name, source URL, size). Do not download without that approval. Save as `showcase-videos/music/myplan.mp3` and `music/scroller.mp3`; write `music/LICENSE.md` with track names, author, source URLs, license name + URL, download date.

- [ ] **Step 2: Final renders**

```bash
python showcase-videos/render/render.py ../compose/myplanbyu.html --out ../dist/myplanbyu-showcase.mp4 --music ../music/myplan.mp3
python showcase-videos/render/render.py ../compose/scroller.html --out ../dist/universe-scroller-process.mp4 --music ../music/scroller.mp3
ffmpeg -y -v error -ss 2 -i showcase-videos/dist/myplanbyu-showcase.mp4 -frames:v 1 showcase-videos/dist/myplanbyu-poster.jpg
ffmpeg -y -v error -ss 1 -i showcase-videos/dist/universe-scroller-process.mp4 -frames:v 1 showcase-videos/dist/universe-scroller-poster.jpg
```
Expected: two `WROTE ... 35.0 s` lines. If either exceeds 10 MB re-render with `--crf 21`.

- [ ] **Step 3: Write and run `render/qc.py`**

```python
"""Final QC: spec conformance + determinism. Usage: python qc.py"""
import hashlib, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "..", "dist")

def probe(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=width,height,r_frame_rate,codec_name",
        "-of", "json", p], capture_output=True, text=True, check=True).stdout
    return json.loads(out)

fail = []
for name in ("myplanbyu-showcase.mp4", "universe-scroller-process.mp4"):
    p = os.path.join(DIST, name)
    if not os.path.exists(p):
        fail.append(name + " missing"); continue
    j = probe(p)
    dur = float(j["format"]["duration"]); mb = int(j["format"]["size"]) / 1e6
    v = [s for s in j["streams"] if s["codec_name"] in ("h264",)][0]
    a = [s for s in j["streams"] if s["codec_name"] == "aac"]
    if not (30 <= dur <= 40): fail.append(f"{name}: duration {dur:.1f}s outside 30-40")
    if mb > 10: fail.append(f"{name}: {mb:.1f} MB > 10")
    if (v["width"], v["height"]) != (1920, 1080): fail.append(f"{name}: {v['width']}x{v['height']}")
    if v["r_frame_rate"] != "60/1": fail.append(f"{name}: fps {v['r_frame_rate']}")
    if not a: fail.append(f"{name}: no AAC audio")
    print(f"{name}: {dur:.1f}s {mb:.1f}MB {v['width']}x{v['height']}@{v['r_frame_rate']} ok")
print("FAIL\n  " + "\n  ".join(fail) if fail else "QC PASS")
sys.exit(1 if fail else 0)
```

Run: `python showcase-videos/render/qc.py` — Expected: `QC PASS`.

Determinism spot-check (frames must be reproducible):

```bash
python showcase-videos/render/render.py ../compose/myplanbyu.html --out ../dist/_det.mp4 --from 300 --to 302
python showcase-videos/render/render.py ../compose/myplanbyu.html --out ../dist/_det2.mp4 --from 300 --to 302
```
Extract first frame of each (`ffmpeg -i _det.mp4 -frames:v 1 d1.png` / same for `_det2`) into the scratchpad and compare hashes — must match. Delete `_det*.mp4` and any `_*-preview.mp4` from `dist/` afterward.

Legibility gate: `ffmpeg -i dist/myplanbyu-showcase.mp4 -vf "fps=1/5,scale=400:-1,tile=4x2" -frames:v 1 <scratchpad>/legibility-myplan.jpg` (same for scroller), Read both — every overlay line must be readable at 400px. Fix copy sizes in compositions if not, re-render.

- [ ] **Step 4: Commit**

```bash
git add showcase-videos/dist/ showcase-videos/music/LICENSE.md showcase-videos/render/qc.py
git commit -m "showcase: final renders + music licenses + QC gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
(Track MP3s: commit them too if the license text permits redistribution — Pixabay's does; note it in LICENSE.md.)

---

### Task 10: Portfolio embed + verification

**Files:**
- Modify: `index.html` (both project stories), `portfolio-3d.css` (video section style), `portfolio-3d.js` (play/pause on story open/close — `openStory` at ~line 760, `closeStory` at ~line 829)

**Interfaces:**
- Consumes: `dist/*.mp4` + posters (Task 9). Story mechanics: opening a card moves its live story node into `#wmax-body` (`portfolio-3d.js:747`), `wmax.classList.add("show")` on open, `.remove("show")` on close.

- [ ] **Step 1: Add the video section to each story**

Locate each project's story markup: `grep -n "wx-sec" index.html` and find the myplanBYU and Universe Scroller cards (Scroller card is near line 290). Insert as the **first** `.wx-sec` of each story:

```html
<section class="wx-sec wx-video">
  <video class="wx-showcase" src="showcase-videos/dist/myplanbyu-showcase.mp4"
         poster="showcase-videos/dist/myplanbyu-poster.jpg"
         muted playsinline loop preload="metadata"></video>
</section>
```
(Scroller story: same block with `universe-scroller-process.mp4` / its poster.)

In `portfolio-3d.css` add — **the stylesheet has a generic `section { padding: 16vh 7vw }` rule that must be zeroed or the video gets huge phantom padding**:

```css
.wx-sec.wx-video { padding: 0; }
.wx-showcase { width: 100%; display: block; border-radius: 14px; cursor: pointer; }
```

- [ ] **Step 2: Wire play/pause + click-to-unmute**

In `portfolio-3d.js`, inside `openStory(card)` immediately after `wmax.classList.add("show")`:

```javascript
    wmax.querySelectorAll("video.wx-showcase").forEach(v => {
      v.currentTime = 0;
      v.play().catch(() => {});          // muted autoplay; NotAllowedError is fine
    });
```

Inside `closeStory()` next to `wmax.classList.remove("show")`:

```javascript
    wmax.querySelectorAll("video.wx-showcase").forEach(v => v.pause());
```

One delegated listener near the other wmax handlers (click toggles sound):

```javascript
  wmax.addEventListener("click", e => {
    const v = e.target.closest("video.wx-showcase");
    if (v) v.muted = !v.muted;
  });
```

- [ ] **Step 3: Verify (hidden-pane recipe + headless)**

Browser pane: open the portfolio preview, then per project: click the card, assert via JS that `#wmax-body video.wx-showcase` exists, has the right `src`, and `getBoundingClientRect().width > 0`; remember screenshots lag one frame — take two. The pane freezes rAF but `play()` on a muted video still flips `paused` to false — assert `!v.paused` too. Then a real check in headless Chrome via the harness: load `http://localhost:8140/index.html` (http.server from Task 6), `eval` a click on each card, `vt_step` ×30, screenshot both open stories to the scratchpad, Read them — video poster visible inside the story, no layout overflow.

- [ ] **Step 4: Commit**

```bash
git add index.html portfolio-3d.css portfolio-3d.js
git commit -m "portfolio: embed showcase videos in myplanBYU and Universe Scroller stories

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: LinkedIn captions + README wrap-up

**Files:**
- Create: `showcase-videos/dist/linkedin-captions.md`
- Modify: `showcase-videos/README.md`

- [ ] **Step 1: Write the captions (voice: personal-first, plain-spoken)**

```markdown
# LinkedIn captions

## myplanBYU (attach dist/myplanbyu-showcase.mp4)
I built a degree planner that treats a BYU four-year plan like the constraint problem it is —
170+ majors, prereqs, cohort blocks, credit caps, and five priorities you weight yourself.
Here's 35 seconds of it thinking. Live at jordanheaton.com/myplanBYU

## Universe Scroller (attach dist/universe-scroller-process.mp4)
I directed AI video between hand-picked anchor images, color-matched and stitched the clips,
then precomputed 1,445 frames so your scroll wheel drives the film.
The making of my universe scroller → jordanheaton.com
```

- [ ] **Step 2: Finish README.md** — document the three-stage pipeline, the exact commands to re-render each video from scratch (capture → explode → render → qc), and the OneDrive/temp-dir rule. Commit:

```bash
git add showcase-videos/dist/linkedin-captions.md showcase-videos/README.md
git commit -m "showcase: LinkedIn captions + pipeline README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Plan Self-Review (done at authoring time)

- **Spec coverage:** deliverables/specs → Tasks 3/9; factory (capture/compose/render, temp-dir rule) → Tasks 1–6; cursor requirement + Zelios style → Tasks 4/5/7; six myplanBYU beats → Task 7; five Scroller beats → Task 8; music + license → Task 9; verification bullets → Tasks 5 (validators), 9 (qc.py, determinism, legibility), 10 (embed checks); portfolio integration → Task 10; captions → Task 11. Out-of-scope items have no tasks — correct.
- **Known judgment points (not placeholders):** wizard selector tuning (Task 5) and scrub-range tuning (Task 6) are explicit discovery loops with concrete debug commands; music choice is a designed user gate.
- **Type consistency:** event schema (`{fps,events:[{f,kind,x,y,sel,text}]}`) matches between Task 5 producer and Task 4/7 consumers; `seq` config keys match engine (Task 2) usage in Tasks 7/8; `validate_frames.py` defaults match dsf=2 capture and are overridden for dsf=1 scenes.

---

# Revision 1 tasks (2026-08-09) — ad-style myplanBYU cut

Spec: see "Revision 1" section of the design doc. Scroller video unchanged
apart from music. Full detail lives in the SDD dispatches; per-task contracts:

### Task R1: Music intake + scroller audio master
Controller-inline: download Jordan's two picked Pixabay tracks (approved),
`music/myplan.mp3` + `music/scroller.mp3` + `music/LICENSE.md`; verify both
≥35s; re-render scroller with `--music ../music/scroller.mp3 --crf 27`;
`qc.py --no-audio-ok` (myplan still silent). Commit music/ + scroller MP4.

### Task R2: Captures s4 (course modal) + s5 (advisor replay)
Extend `capture/capture_myplan.py`: **s4** (300 frames) — click a course card
on the solved board, `#courseModal` opens showing "Fall 2026 sections · live
seat counts"; pick a course whose modal actually shows section/seat data
(discovery loop). **s5** (360 frames) — open `#chatFab` → `#chatPanel`, type a
real question, stream a REAL answer from `myplanBYU/scraper/eval/
transcript_*.md` into the live chat DOM (inject via the page's own bubble
markup; deterministic reveal). Events logged for both (cursor replay).
Validators for both scenes; commit script only.

### Task R3: FX additions — callout, credits, circle wipe
`compose/fx.js` gains: `FX.callout(container,{x,y,text,side})` (pointer line +
chip, pop-in), `FX.credits(container,{lines})` (movie-credits roll, one line
popping after another), `FX.wipe(container,{color})` (accent circle wipe for
beat transitions). Selftest additions first (TDD), keep 15 existing green.

### Task R4: myplanbyu.html ad-cut rework
Rebuild timeline to the Revision-1 beat sheet: 9 segments, outBack pop-ins,
srcFps-retimed s1 (~2×), punch-zooms (coursework step, insights panel, modal
seat-count region), s4/s5 beats with cursor, credits roll, outro slam.
Single-writer-per-property discipline throughout. Preview + frame evidence +
400px legibility. Commit composition only.

### Task R5: Audio master + strict QC + focused final re-review
`render.py --music ../music/myplan.mp3` final; STRICT `qc.py` (no flag) must
PASS both files incl. AAC + duration-sync checks; determinism spot-check;
focused reviewer pass over R2–R4 diffs; ledger + captions check (captions
unchanged unless beats renamed); commit final MP4.

---

# Revision 2 tasks (2026-08-09) — "MyMAP ad" polish pass

Spec: "Revision 2" section of the design doc (binding copy table + motion rules).

### Task R6: New captures s6-s10
Extend `capture/capture_myplan.py`: s6 transcript-import (paste real-format
transcript text into `#tiText`, click `#tiScan`, courses populate + toast; 360f),
s7 majors-list scroll (wizard Programs step, smooth wheel; 300f), s8 bucket
expand + CDP drag of a class card into a semester + 150f plan-sit tail (480f),
s9 ACC 200 course modal (recapture of the s4 pattern on ACC 200; 300f),
s10 chat via the REAL `#chatQuick` "Critique my plan" chip + real transcript
answer replay, fetch-guarded (400f). All dsf=2 q88, events logged, validators,
visual frame confirmations. Commit script only.

### Task R7: Infra — font, browser bar, ring highlight, audio builder
DM Sans WOFF2 + OFL license committed under `compose/assets/fonts/` (explicitly
authorized by the brief); `FX.browserbar` (URL bar + typed text + caret);
`FX.ring` (animated ellipse stroke drawing around a target region);
seamless tests reveal helper (image self-mask via clip-path inset, no cover
rects); `render/build_myplan_audio.py` synthesizing soft key clicks at given
frame timestamps and premixing with `music/myplan.mp3` → local-only
`music/myplan-mix.m4a` (gitignored). Selftest TDD for the two FX.

### Task R8: Composition v3 (`compose/myplanbyu.html`)
2700 frames to the Revision-2 beat map + exact copy; DM Sans everywhere;
isometric long-perspective camera rig (single writer); NO wipes; cursor
visible beats 2-8 incl. zooms; import border-highlight/zoom; insights ring;
plan-sit bucket highlights (GE/Religion/Major-IS emphasis); seamless tests
reveal; no em dashes on screen; "Classmates text me" line removed. Preview +
frame evidence + 400px legibility. Commit composition only.

### Task R9: Audio premix + final master + strict QC + focused review
Build the click-synced premix from R8's final type-in frame timings; render
final with `--music ../music/myplan-mix.m4a`; strict `qc.py` PASS (45s is
within a relaxed 30-50s window — qc duration bounds updated accordingly, one
line); determinism + legibility; poster re-pick; focused reviewer over R6-R9;
captions update if needed; ledger; ship to Jordan.

---

# Revision 3 tasks (2026-08-10) — one continuous session

Spec: "Revision 3" section (binding sequence + global rules).

### Task R10: Continuous-session capture chain (s11-s16)
One Chrome session, narrative order, state persisting throughout: s11 majors
scroll (330f) -> s12 import + scan + wizard-finish so the PLAN GENERATES on
screen (420f) -> s13 bucket-expand dropdown click, NO drag (330f) -> s14
opportunities: physical open + visible scrub through scholarships/clubs/
abroad (450f) -> s15 ACC 200 modal + PHYSICAL click of the live-seat-count
button with `/sections` allowed through the fetch guard, real data renders
(450f) -> s16 modal X close + chat open + the ACC 200 question + real
transcript answer replay (510f). All dsf=2 q88, events logged per scene,
validators, frame confirmations at every seam (last frame of sN and first of
sN+1 must show identical app state). Commit script only.

### Task R11: Composition v4 (~3360f continuous cut)
Rebuild to the Revision-3 sequence: single camera trajectory (one rig
run-track; pans between focal points, zero recenters across beats 2-7);
cursor tip-to-center hotspot fix (verify tip lands mid-button on every
click frame); FX.credits gains (or a new FX.bullets provides) sequential
downward slide-out for the 12 tech items; terminal statement never obscured;
seamless reveal; DM Sans; exact copy incl. the colon substitution. Preview +
frame evidence at every seam + cursor table + 400px legibility. Commit
composition only.

### Task R12: Premix + final master + strict QC + closing review
New keystroke lists -> premix; qc window 30-60s (one line); final render
(crf ladder as needed, <=10MB); strict qc both files; determinism;
legibility; poster re-pick; caption duration update; focused closing review
over R10-R12; ledger; ship.

---

# Revision 4 tasks (2026-08-10) — continuous mouse + tweaks

Spec: "Revision 4" section. Small pass; scope discipline matters.

### Task R13: Capture tweaks + chain re-run
`capture_myplan.py` rev3 chain edits: s11/s12 open the plan via the CENTERED
empty-state new-plan control (discover it; not #newPlanBtn top-right); s13
expands the bucket AND clicks a real class option (PHIL 201 preferred);
s16 suppresses the advisor offline notice BEFORE the chat opens (zero
error-bubble frames — verify by reading every frame around chat-open);
scenes keep dash-clean sweep + dense enough waypoints that every action has
a positioned event. Full `--scene rev3` re-run; validators; seam checks;
events regenerated. Commit script only.

### Task R14: Composition tweaks + final master
`compose/myplanbyu.html`: ONE merged master cursor log spanning beats 2-7
(single cursor run-track; stateAt interpolates across all former seam jumps
— verify mid-glide frames at each reported jump point); re-inline all six
event blocks (frames/coords changed with the re-capture); camera opening
adjusted for the centered new-plan click; replace box/ring highlights with
the new two-arc corner marks (`FX.arcs` in fx.js + selftest checks, TDD);
beat-4 gains the class-pick moment. Then master: premix (verify keystroke
windows unchanged, else rebuild), render crf 28, strict qc, determinism,
legibility, poster re-check, frame evidence at every former jump. Commit
fx.js/selftest/theme(if needed)/composition/MP4/poster(if changed).
Closing (controller): README refresh line, ledger, ship.
