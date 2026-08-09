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
    if a.stride < 1 or 60 % a.stride:
        ap.error("--stride must be a divisor of 60 (1,2,3,4,5,6,10,12,15,20,30,60)")
    page = a.page if os.path.isabs(a.page) else os.path.join(HERE, a.page)
    out = a.out if os.path.isabs(a.out) else os.path.join(HERE, a.out)
    if a.music and not os.path.isabs(a.music):
        a.music = os.path.join(HERE, a.music)

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)

    cfg = os.path.join(HERE, "..", "compose", "render-config.js")
    frames_root = os.path.join(os.environ.get("TEMP", tempfile.gettempdir()), "showcase")
    with open(cfg, "w", encoding="utf-8") as f:
        f.write("window.RENDER=%s;\n" % json.dumps(
            {"framesRoot": file_url(frames_root), "final": True}))

    tmp = tempfile.mkdtemp(prefix="showcase-render-", dir=os.environ.get("TEMP"))
    c = None
    try:
        c = Chrome(port=9411, width=1920, height=1080)
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
        cmd += ["-vf", "scale=1920:1080:in_range=pc:out_range=tv:flags=lanczos",
                "-color_range", "tv", "-colorspace", "bt709",
                "-color_primaries", "bt709", "-color_trc", "bt709"]
        cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf),
                "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True)
        mb = os.path.getsize(out) / 1e6
        print("WROTE %s %.1f MB, %.1f s" % (out, mb, n / fps))
    finally:
        if c:
            c.close()
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    main()
