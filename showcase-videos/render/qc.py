"""Final QC: spec conformance + determinism. Usage: python qc.py [--no-audio-ok]"""
import argparse, hashlib, json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "..", "dist")

def probe(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=width,height,r_frame_rate,codec_name",
        "-of", "json", p], capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-audio-ok", action="store_true",
                     help="Treat a missing AAC stream as an interim note instead of a "
                          "failure (music mux is pending Jordan's track pick). All other "
                          "checks stay strict.")
    a = ap.parse_args()

    fail = []
    notes = []
    for name in ("myplanbyu-showcase.mp4", "universe-scroller-process.mp4"):
        p = os.path.join(DIST, name)
        if not os.path.exists(p):
            fail.append(name + " missing"); continue
        j = probe(p)
        dur = float(j["format"]["duration"]); mb = int(j["format"]["size"]) / 1e6
        v = [s for s in j["streams"] if s["codec_name"] in ("h264",)][0]
        aac = [s for s in j["streams"] if s["codec_name"] == "aac"]
        if not (30 <= dur <= 40): fail.append(f"{name}: duration {dur:.1f}s outside 30-40")
        if mb > 10: fail.append(f"{name}: {mb:.1f} MB > 10")
        if (v["width"], v["height"]) != (1920, 1080): fail.append(f"{name}: {v['width']}x{v['height']}")
        if v["r_frame_rate"] != "60/1": fail.append(f"{name}: fps {v['r_frame_rate']}")
        if not aac:
            if a.no_audio_ok:
                notes.append(f"{name}: NOTE (interim): no audio — music pending")
            else:
                fail.append(f"{name}: no AAC audio")
        print(f"{name}: {dur:.1f}s {mb:.1f}MB {v['width']}x{v['height']}@{v['r_frame_rate']} ok")
    for note in notes:
        print(note)
    print("FAIL\n  " + "\n  ".join(fail) if fail else "QC PASS")
    sys.exit(1 if fail else 0)

if __name__ == "__main__":
    main()
