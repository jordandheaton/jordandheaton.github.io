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
