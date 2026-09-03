#!/usr/bin/env python3
"""
Turn a source document into clean, readable text.

    python3 pipeline/ingest.py syllabus.pdf                 # to stdout
    python3 pipeline/ingest.py guide.html -o guide.txt
    python3 pipeline/ingest.py sources/*.pdf -d extracted/

Handles PDF, HTML, Markdown and plain text. HTML gets structural markers kept
(#, ##, -, |) so headings and tables survive tag-stripping, which is what makes
a field guide readable enough to port from.

This exists because the same extraction was needed three different ways while
building the first four courses: a syllabus PDF, a published HTML artifact, and
a study-guide PDF. One tool, so the next course is one command.
"""

from __future__ import annotations

import argparse
import html as html_module
import re
import sys
from pathlib import Path

# Entities that matter in academic prose and are not in html.unescape's fast path.
EXTRA_ENTITIES = {
    "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”",
    "&mdash;": "—", "&ndash;": "–", "&middot;": "·", "&hellip;": "…",
    "&times;": "×", "&divide;": "÷", "&plusmn;": "±", "&deg;": "°",
    "&rarr;": "→", "&larr;": "←", "&harr;": "↔", "&asymp;": "≈",
    "&le;": "≤", "&ge;": "≥", "&ne;": "≠", "&minus;": "−",
    "&sup2;": "²", "&frac12;": "½", "&sigma;": "σ", "&epsilon;": "ε",
    "&radic;": "√", "&sum;": "∑", "&pi;": "π", "&check;": "✓",
    "&nbsp;": " ",
}


def from_pdf(path: Path) -> str:
    """Extract text from a PDF. Falls back through the libraries that might be present."""
    data = path.read_bytes()

    try:
        from pypdf import PdfReader  # type: ignore

        reader = PdfReader(str(path))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        pass

    try:
        import subprocess

        out = subprocess.run(
            ["pdftotext", "-layout", str(path), "-"], capture_output=True, check=True
        )
        return out.stdout.decode("utf-8", "replace")
    except Exception:
        pass

    raise SystemExit(
        f"Cannot read {path.name}: install one of pypdf or poppler-utils.\n"
        "  pip install pypdf        (or)  apt-get install poppler-utils\n"
        "Node alternative, if you already ran npm install in app/:\n"
        '  node -e "const{PDFParse}=require(\'pdf-parse\');..."'
    )


def from_html(text: str) -> str:
    """Strip HTML to readable text, keeping enough structure to work from."""
    # Published artifacts carry a large runtime preamble; drop it and all scripts.
    text = re.sub(r"<!-- frame-runtime -->.*?<!-- /frame-runtime -->", "", text, flags=re.S)
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.S | re.I)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.S | re.I)
    text = re.sub(r"<svg[^>]*>.*?</svg>", "", text, flags=re.S | re.I)
    text = re.sub(r"<head[^>]*>.*?</head>", "", text, flags=re.S | re.I)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)

    # Structural markers, so headings and tables survive the tag strip.
    for level in range(1, 7):
        text = re.sub(rf"<h{level}[^>]*>", "\n\n" + "#" * level + " ", text, flags=re.I)
    text = re.sub(r"<li[^>]*>", "\n- ", text, flags=re.I)
    text = re.sub(r"<tr[^>]*>", "\n| ", text, flags=re.I)
    text = re.sub(r"<t[dh][^>]*>", " | ", text, flags=re.I)
    text = re.sub(r"<dt[^>]*>", "\n* ", text, flags=re.I)
    text = re.sub(r"<dd[^>]*>", "\n  ", text, flags=re.I)
    text = re.sub(r"<summary[^>]*>", "\n?? ", text, flags=re.I)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(
        r"</(p|div|section|article|h[1-6]|li|tr|table|ul|ol|dl|dt|dd|blockquote"
        r"|figure|figcaption|details|summary)>",
        "\n",
        text,
        flags=re.I,
    )

    text = re.sub(r"<[^>]+>", "", text)

    for entity, char in EXTRA_ENTITIES.items():
        text = text.replace(entity, char)
    text = html_module.unescape(text)
    return text


def tidy(text: str) -> str:
    """Collapse whitespace without losing the block structure."""
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in text.split("\n")]
    out: list[str] = []
    for line in lines:
        if line == "" and (not out or out[-1] == ""):
            continue
        out.append(line)
    return "\n".join(out).strip() + "\n"


def extract(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return tidy(from_pdf(path))
    raw = path.read_text(encoding="utf-8", errors="replace")
    if suffix in (".html", ".htm", ".xhtml"):
        return tidy(from_html(raw))
    return tidy(raw)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sources", nargs="+", type=Path)
    ap.add_argument("-o", "--out", type=Path, help="Write one source to this file.")
    ap.add_argument("-d", "--dir", type=Path, help="Write each source into this directory as .txt.")
    args = ap.parse_args()

    if args.out and len(args.sources) > 1:
        ap.error("--out takes a single source; use --dir for several.")

    for src in args.sources:
        if not src.exists():
            print(f"missing: {src}", file=sys.stderr)
            continue
        text = extract(src)
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(text)
            print(f"{src.name} → {args.out} ({len(text):,} chars)", file=sys.stderr)
        elif args.dir:
            args.dir.mkdir(parents=True, exist_ok=True)
            dest = args.dir / f"{src.stem}.txt"
            dest.write_text(text)
            print(f"{src.name} → {dest} ({len(text):,} chars)", file=sys.stderr)
        else:
            sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
