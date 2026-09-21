#!/usr/bin/env python3
"""
Render a YouTube-length explainer for a course.

    python3 pipeline/explainer.py econ
    python3 pipeline/explainer.py econ --from 0 --to 5
    python3 pipeline/explainer.py econ --dry-run

The last format in §3 of docs/VIDEO_PODCAST_ROADMAP.md: 8-15 minutes, a hook
in the first fifteen seconds, and a chapter mark on every unit boundary.

Nothing is synthesised. A lesson is 52 seconds to four minutes, so an explainer
is a *run of units played in order* — the MP3s the app already serves,
sequenced, with those units' own cue lists offset onto one timeline. The
chapter marks are the unit boundaries, known exactly because the durations are,
which is what the roadmap means by taking them from the cue list rather than
recovering them with chapters.py.

It is always a truncation. Not one of the four courses fits whole: ECON is
closest at 15:00 of narration and the beats between its units put it eight
seconds over. pipeline/explainer.mjs does that arithmetic and says how many
units it left behind.

A chapters.txt lands beside the MP4, ready to paste into a description box.
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
    ap.add_argument("--from", dest="start", type=int, help="First unit (default 0).")
    ap.add_argument("--to", dest="end", type=int, help="Last unit (default: as many as fit).")
    ap.add_argument("--ground", help="Ground id from lib/look.ts (default: ink).")
    ap.add_argument("--accent", help="Accent id from lib/look.ts (default: sterling).")
    ap.add_argument("--dry-run", action="store_true", help="Print the plan and the chapters, and stop.")
    args = ap.parse_args()

    video = ROOT / "video"
    if not (video / "node_modules").exists():
        print(
            f"{video}/node_modules is missing — run `npm install` in {video} first.",
            file=sys.stderr,
        )
        return 1

    cmd = ["node", "render-explainer.mjs", args.course]
    if args.start is not None:
        cmd += ["--from", str(args.start)]
    if args.end is not None:
        cmd += ["--to", str(args.end)]
    if args.ground:
        cmd += ["--ground", args.ground]
    if args.accent:
        cmd += ["--accent", args.accent]
    if args.dry_run:
        cmd.append("--dry-run")

    return subprocess.run(cmd, cwd=video).returncode


if __name__ == "__main__":
    raise SystemExit(main())
