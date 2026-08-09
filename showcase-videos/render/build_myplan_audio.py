"""Synthesizes soft keyboard-click SFX (stdlib only, fixed seed) and premixes
them under a music bed at given frame timestamps, producing a deterministic
PCM WAV.

Usage:
  python build_myplan_audio.py --music ../music/myplan.mp3 \\
      --clicks "12,18,24,30,36,44,50,58,66,72,80,88,96" \\
      --clicks2 "2530,2540,2550,2560,2570" \\
      --fps 60 --out ../music/myplan-mix.wav

--clicks / --clicks2 are frame numbers (at --fps) of individual keystrokes --
one per FX.browserbar character reveal -- for the intro and outro type-in
beats respectively (see the [0.12, 0.85] typing-window mapping documented on
FX.browserbar in compose/fx.js). Both are optional and are merged into one
click track; either may be omitted if a cut only types once. Paths may be
relative to this file's directory. Requires ffmpeg/ffprobe on PATH.

Determinism: click synthesis uses a fixed RNG seed (no wall-clock, no
hardware entropy) and the ffmpeg pass strips container metadata and forces
bitexact muxing/demuxing, so re-running with the same inputs reproduces the
same output bytes.
"""
import argparse
import json
import math
import os
import random
import shutil
import struct
import subprocess
import sys
import tempfile
import wave

HERE = os.path.dirname(os.path.abspath(__file__))

SEED = 20260809            # fixed -> deterministic click synthesis, no wall-clock
CLICK_MS = 18               # noise-burst length
CLICK_DBFS = -18.0          # target peak level


def parse_frames(spec):
    if not spec:
        return []
    return [int(tok) for tok in spec.split(',') if tok.strip() != '']


def synth_click(path, sample_rate, channels, ms=CLICK_MS, dbfs=CLICK_DBFS, seed=SEED):
    """Writes a short, soft key-click WAV to `path`: a white-noise burst under
    an exponential-decay envelope, darkened toward low-mid via a 2-sample
    moving average (a cheap one-pole low-pass -- attenuates the harsh top end
    a raw noise burst would have, so it reads as a soft mechanical click
    rather than a hiss), normalized to `dbfs` peak. Identical samples are
    written to every channel (centered, no stereo width)."""
    rng = random.Random(seed)
    n = max(1, int(round(sample_rate * ms / 1000.0)))
    peak = 10 ** (dbfs / 20.0)
    raw = [rng.uniform(-1.0, 1.0) for _ in range(n)]
    tau = n / 4.5  # ~4.5 time-constants across the burst -> decays to near-silence by the end
    env = [math.exp(-i / tau) for i in range(n)]
    shaped = [raw[i] * env[i] for i in range(n)]
    # 2-sample moving average: y[i] = (x[i] + x[i-1]) / 2 -- simple low-pass
    smoothed = [shaped[0]] + [(shaped[i] + shaped[i - 1]) / 2.0 for i in range(1, n)]
    m = max(abs(s) for s in smoothed) or 1.0
    scaled = [s / m * peak for s in smoothed]
    ints = [max(-32768, min(32767, int(round(s * 32767)))) for s in scaled]
    with wave.open(path, 'wb') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        buf = bytearray()
        for v in ints:
            buf += struct.pack('<h', v) * channels  # same sample on every channel
        w.writeframes(bytes(buf))


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('command failed: %s\n--- stderr ---\n%s' % (' '.join(cmd), r.stderr))
    return r


def ffprobe_audio_info(path):
    r = run(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
             '-show_entries', 'stream=sample_rate,channels:format=duration',
             '-of', 'json', path])
    data = json.loads(r.stdout)
    stream = data['streams'][0]
    return {
        'sample_rate': int(stream['sample_rate']),
        'channels': int(stream['channels']),
        'duration': float(data['format']['duration']),
    }


def build_mix(music, click_wav, frames, fps, out_path, music_dur):
    """One ffmpeg command: adelay a copy of the click per frame timestamp,
    amix them (unnormalized, so the music stays at full level and the clicks
    sit under it) trimmed to the music's duration, bitexact PCM WAV out."""
    base = ['ffmpeg', '-y', '-fflags', '+bitexact', '-flags:a', '+bitexact']
    if not frames:
        cmd = base + ['-i', music, '-t', '%.6f' % music_dur,
                       '-map_metadata', '-1', '-c:a', 'pcm_s16le', out_path]
        run(cmd)
        return

    inputs = ['-i', music]
    filter_parts = []
    amix_labels = ['0:a']
    for i, f in enumerate(frames):
        delay_ms = int(round(f / fps * 1000.0))
        inputs += ['-i', click_wav]
        idx = i + 1
        filter_parts.append('[%d:a]adelay=%d:all=1[c%d]' % (idx, delay_ms, idx))
        amix_labels.append('c%d' % idx)
    labels = ''.join('[%s]' % l for l in amix_labels)
    filter_parts.append('%samix=inputs=%d:duration=first:normalize=0[mix]' %
                         (labels, len(amix_labels)))
    filt = ';'.join(filter_parts)

    cmd = base + inputs + [
        '-filter_complex', filt, '-map', '[mix]', '-t', '%.6f' % music_dur,
        '-map_metadata', '-1', '-c:a', 'pcm_s16le', out_path]
    run(cmd)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--music', required=True)
    ap.add_argument('--clicks', default='', help='comma-separated frame numbers (intro type-in)')
    ap.add_argument('--clicks2', default='', help='comma-separated frame numbers (outro type-in)')
    ap.add_argument('--fps', type=float, default=60)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    if shutil.which('ffmpeg') is None or shutil.which('ffprobe') is None:
        sys.exit('ffmpeg/ffprobe not found on PATH')

    music = a.music if os.path.isabs(a.music) else os.path.join(HERE, a.music)
    out_path = a.out if os.path.isabs(a.out) else os.path.join(HERE, a.out)
    if not os.path.isfile(music):
        sys.exit('music not found: %s' % music)

    frames = sorted(set(parse_frames(a.clicks) + parse_frames(a.clicks2)))
    info = ffprobe_audio_info(music)
    os.makedirs(os.path.dirname(out_path) or '.', exist_ok=True)

    with tempfile.TemporaryDirectory(prefix='myplan-click-') as tmp:
        click_wav = os.path.join(tmp, 'click.wav')
        synth_click(click_wav, info['sample_rate'], info['channels'])
        build_mix(music, click_wav, frames, a.fps, out_path, info['duration'])

    mb = os.path.getsize(out_path) / (1024 * 1024)
    print('WROTE %s  %.2f MB  clicks=%d  duration=%.3fs' %
          (out_path, mb, len(frames), info['duration']))


if __name__ == '__main__':
    main()
