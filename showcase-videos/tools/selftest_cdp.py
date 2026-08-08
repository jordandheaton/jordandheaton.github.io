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
    # Floor check: guard against truncated/zero-byte/failed writes only.
    # Blank-vs-real-content discrimination is provided by the rAF-counter and
    # CSS-margin assertions earlier, and by the two-screenshot inequality check below.
    assert px(a) > 2000 and px(b) > 2000, "screenshots suspiciously small"
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
