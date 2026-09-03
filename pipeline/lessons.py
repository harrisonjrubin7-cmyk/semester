#!/usr/bin/env python3
"""
Render a narrated lesson for every unit of a course's guide.

    python3 pipeline/lessons.py econ
    python3 pipeline/lessons.py econ --unit 3 --dry-run

A lesson is a lecture on one unit: the tutor introduces it, poses each question,
leaves a beat, answers it in full, and closes with what to carry away. The
narration is rendered to an MP3, and alongside it a list of cues — the second at
which each line begins — so the app can put the matching slide on screen as it
plays. That is the video: type and figures moving in step with the voice, drawn
live rather than baked into a file, which keeps it sharp at any size and costs
kilobytes instead of megabytes.

Output goes to app/public/audio/lessons/<course>/unit-<n>.mp3, with a
lessons.json beside it to paste into the course module.

    --mp4   also render a real video file per unit, for offline use.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "audio"))

# The synthesiser already knows how to speak, pause and time a script.
from synth import GAP_TURN, load_voices, mmss, resample, say  # noqa: E402

import numpy as np  # noqa: E402


def read_guide(course: str) -> tuple[str, list[dict]]:
    """Pull the unit names and cards out of a guide's TypeScript source."""
    path = ROOT / "app/src/data/courses" / course / "guide.ts"
    if not path.exists():
        raise SystemExit(f"No guide at {path}")
    src = path.read_text()

    code = (re.search(r"code: '([^']+)'", src) or [None, course.upper()])[1]

    units = []
    for block in re.split(r"\n {4}\{\n {6}name: '", src)[1:]:
        name = block[: block.index("'")]
        # The last split runs to the end of the file, so it would otherwise
        # swallow frames, selfTest and terms into the final unit. Cut at the
        # next top-level key of the guide object.
        end = re.search(r"\n {2}(?:frames|selfTest|terms|cases)\s*:", block)
        if end:
            block = block[: end.start()]
        cards = [
            {"q": q.replace("\\'", "'"), "a": a.replace("\\'", "'")}
            for q, a in re.findall(
                r"\{\n\s*q: '((?:[^'\\]|\\.)*)',\n\s*a: '((?:[^'\\]|\\.)*)',\n\s*\}", block
            )
        ]
        if cards:
            units.append({"name": name, "cards": cards})
    return code, units


def speakable(text: str) -> str:
    """Symbols a synthesiser reads badly, spelled out."""
    replacements = [
        (r"(\d)\s*%", r"\1 percent"),
        (r"\|ε\||\|E\|", "the absolute value of elasticity"),
        ("≈", " about "), ("≠", " is not equal to "),
        ("≥", " at least "), ("≤", " at most "),
        ("→", " then "), ("×", " times "), ("÷", " divided by "),
        ("±", " plus or minus "), ("√", " the square root of "),
        ("²", " squared"), ("·", ", "), ("—", ", "),
    ]
    for pattern, rep in replacements:
        text = re.sub(pattern, rep, text)
    text = re.sub(r"\$([\d,.]+)", r"\1 dollars", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def lesson_script(code: str, unit: dict, index: int) -> list[dict]:
    """The beats of one lesson. Each becomes a spoken line and an on-screen cue."""
    clean_name = re.sub(r"^\d+(/\d+)?\s*·\s*", "", unit["name"])
    beats = [
        {
            "kind": "title",
            "text": clean_name,
            "speak": f"{code}. {speakable(clean_name)}. "
            f"{len(unit['cards'])} things to know here.",
        }
    ]
    for card in unit["cards"]:
        beats.append({"kind": "q", "text": card["q"], "speak": speakable(card["q"]), "pause": 2.0})
        beats.append({"kind": "a", "text": card["a"], "speak": speakable(card["a"])})
    beats.append(
        {
            "kind": "close",
            "text": f"{clean_name} — {len(unit['cards'])} cards",
            "speak": "That is the unit. Run the cards on it while it is fresh.",
        }
    )
    return beats


def render(course: str, code: str, units: list[dict], only: int | None, mp4: bool, dry: bool):
    out_dir = ROOT / "app/public/audio/lessons" / course
    voices = None if dry else load_voices({"tutor": "en-us-ryan-high"})
    rate = 22050 if dry else voices["tutor"].config.sample_rate

    lessons = {}
    for i, unit in enumerate(units):
        if only is not None and i != only:
            continue
        beats = lesson_script(code, unit, i)

        if dry:
            words = sum(len(b["speak"].split()) for b in beats)
            print(f"  unit {i:2}  {len(beats):3} beats  ~{words / 150:.1f} min  {unit['name'][:52]}")
            continue

        out_dir.mkdir(parents=True, exist_ok=True)
        pieces: list[np.ndarray] = []
        cues = []
        position = 0.0

        def silence(seconds: float):
            nonlocal position
            if seconds <= 0:
                return
            pieces.append(np.zeros(int(seconds * rate), dtype=np.float32))
            position += seconds

        for beat in beats:
            if pieces:
                silence(GAP_TURN)
            cues.append({"at": round(position, 2), "kind": beat["kind"], "text": beat["text"]})
            audio, src_rate = say(voices["tutor"], beat["speak"])
            pieces.append(resample(audio, src_rate, rate))
            position += audio.size / src_rate
            silence(beat.get("pause", 0))

        track = np.concatenate(pieces)
        track *= 0.89 / (float(np.max(np.abs(track))) or 1.0)

        import wave

        wav = out_dir / f"unit-{i}.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes((track * 32767).astype(np.int16).tobytes())

        import imageio_ffmpeg

        ff = imageio_ffmpeg.get_ffmpeg_exe()
        mp3 = out_dir / f"unit-{i}.mp3"
        subprocess.run(
            [ff, "-y", "-loglevel", "error", "-i", str(wav),
             "-codec:a", "libmp3lame", "-b:a", "80k", "-ar", "44100", str(mp3)],
            check=True,
        )

        if mp4:
            # A minimal video for offline use: the app renders the real thing.
            video = out_dir / f"unit-{i}.mp4"
            subprocess.run(
                [ff, "-y", "-loglevel", "error",
                 "-f", "lavfi", "-i", f"color=c=0x0a0b0e:s=1280x720:d={position:.2f}",
                 "-i", str(wav), "-shortest",
                 "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage",
                 "-c:a", "aac", "-b:a", "96k", str(video)],
                check=True,
            )

        wav.unlink()
        lessons[i] = {
            "unit": i,
            "title": re.sub(r"^\d+(/\d+)?\s*·\s*", "", unit["name"]),
            "file": f"/audio/lessons/{course}/unit-{i}.mp3",
            "seconds": int(position),
            "len": mmss(position),
            "cues": cues,
        }
        print(f"  unit {i:2}  {mmss(position)}  {len(cues):3} cues  {mp3.name}")

    if not dry and lessons:
        # Merge with whatever was rendered before, so `--unit 3` re-renders one
        # lesson without dropping the other ten.
        meta = out_dir / "lessons.json"
        merged = json.loads(meta.read_text()) if meta.exists() else {}
        merged.update({str(k): v for k, v in lessons.items()})
        ordered = {k: merged[k] for k in sorted(merged, key=int)}
        meta.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")

        write_module(course, ordered)
        print(f"\n{meta}")


def write_module(course: str, lessons: dict) -> None:
    """Emit the TypeScript the course module imports.

    The app reads lessons as data, not as a fetched file, so a missing lesson is
    a type error rather than a player that loads nothing.
    """
    path = ROOT / "app/src/data/courses" / course / "lessons.ts"
    body = json.dumps(lessons, indent=2, ensure_ascii=False)
    path.write_text(
        "// Generated by pipeline/lessons.py — do not edit by hand.\n"
        "// Re-render with: python3 pipeline/lessons.py " + course + "\n"
        "import type { Lesson } from '../../../lib/types';\n\n"
        f"const lessons: Record<number, Lesson> = {body};\n\n"
        "export default lessons;\n"
    )
    print(f"{path}")
    print(f"Import it in courses/{course}/index.ts as `lessons` if it is not already.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("course")
    ap.add_argument("--unit", type=int, help="Render one unit only.")
    ap.add_argument("--mp4", action="store_true", help="Also write an MP4 per unit.")
    ap.add_argument("--dry-run", action="store_true", help="Show what would be rendered.")
    args = ap.parse_args()

    code, units = read_guide(args.course)
    print(f"{args.course}: {code}, {len(units)} units")
    render(args.course, code, units, args.unit, args.mp4, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
