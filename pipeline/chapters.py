#!/usr/bin/env python3
"""
Recover chapter marks from a recording that shipped without any.

    python3 pipeline/chapters.py app/public/audio/core-full.mp3
    python3 pipeline/chapters.py lecture.mp3 --names names.txt --json

A narrator pauses between sections. Those pauses are visible in the waveform, so
the section starts can be measured rather than guessed — which matters, because
a chapter mark that is thirty seconds out is worse than no chapter mark at all.

The method was checked against a recording whose real timestamps were published:
running it over the PSCI condensed edition reproduced all twenty marks to within
a second. That is why the CORE marks in the app are trustworthy despite that
episode never shipping a chapter list.

If nothing is found, the recording has no pauses long enough — say so in the
data rather than inventing marks. The ECON full read is in exactly that state.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def ffmpeg() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def duration(path: Path) -> float:
    out = subprocess.run(
        [ffmpeg(), "-i", str(path)], capture_output=True, text=True
    ).stderr
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    if not m:
        raise SystemExit(f"Could not read the duration of {path}.")
    h, mm, ss = m.groups()
    return int(h) * 3600 + int(mm) * 60 + float(ss)


def silences(path: Path, noise_db: int, min_len: float) -> list[float]:
    """Seconds at which speech resumes after a pause of at least `min_len`."""
    out = subprocess.run(
        [
            ffmpeg(), "-i", str(path),
            "-af", f"silencedetect=noise=-{noise_db}dB:d={min_len}",
            "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
    ).stderr
    return [float(m) for m in re.findall(r"silence_end: ([\d.]+)", out)]


def mmss(seconds: float) -> str:
    total = int(round(seconds))
    return f"{total // 60}:{total % 60:02d}"


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("audio", type=Path)
    ap.add_argument("--noise", type=int, default=38, help="Silence threshold in -dB (default 38).")
    ap.add_argument("--min", type=float, default=1.1, help="Shortest pause that counts, in seconds.")
    ap.add_argument("--gap", type=float, default=60.0, help="Ignore marks closer together than this.")
    ap.add_argument("--names", type=Path, help="One chapter name per line, in order.")
    ap.add_argument("--json", action="store_true", help="Emit JSON instead of TypeScript.")
    args = ap.parse_args()

    if not args.audio.exists():
        raise SystemExit(f"No such file: {args.audio}")

    total = duration(args.audio)
    found = silences(args.audio, args.noise, args.min)

    # A self-test section is a run of short pauses; the --gap filter keeps those
    # from becoming forty chapters.
    marks: list[float] = [0.0]
    for s in found:
        if s - marks[-1] >= args.gap:
            marks.append(s)

    if len(marks) == 1:
        print(
            f"No pauses of {args.min}s found in {args.audio.name} "
            f"({mmss(total)}). Try --min 0.7 or --noise 45.\n"
            "If still nothing, this recording has no section breaks to lock to — "
            "label its chapters approximate in the data rather than inventing marks.",
            file=sys.stderr,
        )
        return 1

    names = []
    if args.names and args.names.exists():
        names = [line.strip() for line in args.names.read_text().splitlines() if line.strip()]

    chapters = [
        {
            "t": mmss(s),
            "s": int(round(s)),
            "name": names[i] if i < len(names) else f"TODO — section {i + 1}",
        }
        for i, s in enumerate(marks)
    ]

    if args.json:
        print(json.dumps({"len": mmss(total), "seconds": int(total), "chapters": chapters}, indent=2))
    else:
        print(f"// {args.audio.name} — {mmss(total)}, {len(chapters)} sections")
        print(f"len: '{mmss(total)}',")
        print(f"seconds: {int(total)},")
        print("chapters: [")
        for c in chapters:
            print(f"  {{ t: '{c['t']}', s: {c['s']}, name: '{c['name']}' }},")
        print("],")

    if not names:
        print(
            f"\nFound {len(chapters)} sections. Listen at each mark and name them, "
            "or pass --names with one name per line.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
