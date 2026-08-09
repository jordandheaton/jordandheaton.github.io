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
