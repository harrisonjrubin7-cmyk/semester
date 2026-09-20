#!/usr/bin/env python3
"""
Cut a course's narrated lessons into one vertical short per flashcard.

    python3 pipeline/shorts.py econ --unit 3
    python3 pipeline/shorts.py econ --all --dry-run
    python3 pipeline/shorts.py econ --unit 3 --card 2

Step 2 of docs/VIDEO_PODCAST_ROADMAP.md, and the cheapest format in it: a short
is a question, the beat the narration already leaves after it, and the answer —
cut straight out of the unit's MP3 by the cue list, at 1080x1920.

Nothing is synthesised and no audio file is written. A cue records the second
its line begins, so a card already has an in and an out inside a file every
student streams; Remotion trims what it plays. That is why 278 shorts across
four courses cost compute and nothing else.

The roadmap said this script should walk `guide.ts` card-by-card. It walks the
cue list instead, for the timings — which means a card added to a guide after
its unit was narrated has no short until the unit is re-rendered. The app
already lives with exactly that: the lesson player calls those cards "Added
since this was recorded".

Output goes to app/public/audio/shorts/<course>/unit-<n>-card-<m>.mp4, which is
gitignored along with the rest of the rendered video — see video/README.md.
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
    ap.add_argument("--unit", type=int, help="Cut one unit only.")
    ap.add_argument("--card", type=int, help="Cut one card of that unit only.")
    ap.add_argument("--all", action="store_true", help="Cut every unit of the course.")
    ap.add_argument("--ground", help="Ground id from lib/look.ts (default: ink).")
    ap.add_argument("--accent", help="Accent id from lib/look.ts (default: sterling).")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the shot list and what it would cost, and render nothing.",
    )
    args = ap.parse_args()

    if args.unit is None and not args.all:
        ap.error("pass --unit N for one unit, or --all for the whole course")

    video = ROOT / "video"
    if not (video / "node_modules").exists():
        print(
            f"{video}/node_modules is missing — run `npm install` in {video} first.\n"
            "It is a separate package on purpose: Remotion brings a browser with it, "
            "and the app's own install should not carry that.",
            file=sys.stderr,
        )
        return 1

    cmd = ["node", "render-shorts.mjs", args.course]
    if args.unit is not None:
        cmd += ["--unit", str(args.unit)]
    if args.card is not None:
        cmd += ["--card", str(args.card)]
    if args.all:
        cmd.append("--all")
    if args.ground:
        cmd += ["--ground", args.ground]
    if args.accent:
        cmd += ["--accent", args.accent]
    if args.dry_run:
        cmd.append("--dry-run")

    return subprocess.run(cmd, cwd=video).returncode


if __name__ == "__main__":
    raise SystemExit(main())
