#!/usr/bin/env python3
"""
Read a course guide out of its TypeScript source.

The guides are data written as TypeScript so the app typechecks them. Reading
that source directly — rather than compiling it, or duplicating it as JSON —
keeps one copy of the material and no build step. It costs a sensitivity to
formatting, which is fine: the repo is Prettier-formatted, so the shapes are
stable, and everything that reads a guide reads it through here.

    from guide_reader import read_guide
    guide = read_guide("econ")
    guide["units"][0]["cards"][0]["q"]
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSES = ROOT / "app/src/data/courses"

# The keys of a Guide that follow the unit list. A unit block runs until one of
# these, or the file ends — without this the last unit swallows the self-test.
TOP_LEVEL = r"\n {2}(?:frames|selfTest|terms|cases|figures)\s*:"

CARD = re.compile(r"\{\n\s*q: '((?:[^'\\]|\\.)*)',\n\s*a:\n?\s*'((?:[^'\\]|\\.)*)',\n\s*\}")
PAIR = re.compile(r"\{\n\s*t: '((?:[^'\\]|\\.)*)',\n\s*d:\n?\s*'((?:[^'\\]|\\.)*)',\n\s*\}")


def unquote(s: str) -> str:
    return s.replace("\\'", "'").replace("\\\\", "\\").replace("\\n", "\n")


def field(src: str, key: str, default: str = "") -> str:
    m = re.search(rf"\n  {key}: '((?:[^'\\]|\\.)*)'", src)
    return unquote(m.group(1)) if m else default


def cards(block: str) -> list[dict]:
    return [{"q": unquote(q), "a": unquote(a)} for q, a in CARD.findall(block)]


def pairs(src: str, key: str) -> list[dict]:
    start = src.find(f"\n  {key}: [")
    if start == -1:
        return []
    block = src[start:]
    end = re.search(TOP_LEVEL, block[1:])
    if end:
        block = block[: end.start() + 1]
    return [{"t": unquote(t), "d": unquote(d)} for t, d in PAIR.findall(block)]


def read_guide(course: str) -> dict:
    path = COURSES / course / "guide.ts"
    if not path.exists():
        raise SystemExit(f"No guide at {path}")
    src = path.read_text()

    units = []
    for raw in re.split(r"\n {4}\{\n {6}name: '", src)[1:]:
        name = unquote(raw[: raw.index("'")])
        end = re.search(TOP_LEVEL, raw)
        block = raw[: end.start()] if end else raw
        mastery = re.search(r"mastery: (\d+)", block)
        found = cards(block)
        if found:
            units.append(
                {
                    "name": name,
                    "mastery": int(mastery.group(1)) if mastery else 0,
                    "cards": found,
                }
            )

    self_test = []
    start = src.find("\n  selfTest: [")
    if start != -1:
        block = src[start:]
        end = re.search(TOP_LEVEL, block[1:])
        self_test = cards(block[: end.start() + 1] if end else block)

    return {
        "id": course,
        "code": field(src, "code", course.upper()),
        "name": field(src, "name"),
        "blurb": field(src, "blurb"),
        "source": field(src, "source"),
        "units": units,
        "terms": pairs(src, "terms"),
        "frames": pairs(src, "frames"),
        "selfTest": self_test,
    }


def unit_title(name: str) -> str:
    """"5 · Surplus & elasticity" → "Surplus & elasticity"."""
    return re.sub(r"^\d+(/\d+)?\s*·\s*", "", name)


def all_courses() -> list[str]:
    return sorted(p.name for p in COURSES.iterdir() if (p / "guide.ts").exists())


if __name__ == "__main__":
    for course in all_courses():
        g = read_guide(course)
        cards_n = sum(len(u["cards"]) for u in g["units"])
        print(
            f"{course:6} {g['code']:10} {len(g['units']):2} units  {cards_n:3} cards  "
            f"{len(g['terms']):2} terms  {len(g['selfTest']):2} self-test"
        )
