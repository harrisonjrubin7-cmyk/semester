#!/usr/bin/env python3
"""
Render a documentary cut of a course's two-voice episode.

    python3 pipeline/documentary.py econ --seconds 90
    python3 pipeline/documentary.py econ --dry-run
    python3 pipeline/documentary.py econ --broll none

Step 4 of docs/VIDEO_PODCAST_ROADMAP.md, and the half of it that costs nothing.
The spine is the podcast MP3 every student already streams; the picture is its
chapter marks, drawn as lower-thirds that arrive on the second the chapter
does. Nothing is synthesised and no audio is cut.

There are no captions. `audio/synth.py` records where a *chapter* starts and
nothing records where a line does, so a caption track would have to be invented
— see video/src/Documentary.tsx for why an invented one is worse than none.

`--broll <provider>` is the paid half and is not wired to any provider. The
accounting for it is built and guarded (video/src/clipspend.ts,
app/src/lib/clipspend.test.ts): before a single clip can be bought, the manifest
that stops a re-run buying it twice already exists. Choosing a provider and a
price is a spending decision, so it is left to whoever is spending.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("course")
    ap.add_argument("--seconds", type=int, help="Render only the first N seconds.")
    ap.add_argument("--broll", default="none", help="Establishing-shot provider (only 'none' works).")
    ap.add_argument("--ground", help="Ground id from lib/look.ts (default: ink).")
    ap.add_argument("--accent", help="Accent id from lib/look.ts (default: sterling).")
    ap.add_argument("--dry-run", action="store_true", help="Print what it would render, and stop.")
    args = ap.parse_args()

    video = ROOT / "video"
    if not (video / "node_modules").exists():
        print(
            f"{video}/node_modules is missing — run `npm install` in {video} first.",
            file=sys.stderr,
        )
        return 1

    cmd = ["node", "render-documentary.mjs", args.course, "--broll", args.broll]
    if args.seconds is not None:
        cmd += ["--seconds", str(args.seconds)]
    if args.ground:
        cmd += ["--ground", args.ground]
    if args.accent:
        cmd += ["--accent", args.accent]
    if args.dry_run:
        cmd.append("--dry-run")

    return subprocess.run(cmd, cwd=video).returncode


if __name__ == "__main__":
    raise SystemExit(main())
