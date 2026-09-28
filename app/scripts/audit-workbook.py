#!/usr/bin/env python3
"""
Fill the four-pillar audit workbook from the rendered register.

    python3 scripts/audit-workbook.py <template.xlsx> <out.xlsx>

`docs/operating-model/FOUR-PILLAR-AUDIT.md` is rendered from
`src/lib/audit.ts` by its test; this reads that page's control tables and
writes the Score, Evidence, Gap and Status columns of each pillar sheet of
the workbook the brief supplied, leaving every other sheet as it was. The
register is the source of truth; the workbook is a view of it, so the two
cannot disagree.

Status words follow the workbook's own list: a 4 is "Validated", a 3 is
"Released", a 2 is "In progress", a 1 is "Planned", a 0 is "Not started".
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs" / "operating-model" / "FOUR-PILLAR-AUDIT.md"
SHEETS = {"WEB": "Website Pillar", "APP": "App & Console Pillar", "OPE": "Operations Pillar", "FUN": "Funnels Pillar"}
STATUS = {4: "Validated", 3: "Released", 2: "In progress", 1: "Planned", 0: "Not started"}
ROW = re.compile(r"^\| ((?:WEB|APP|OPE|FUN)-\d{3}) \| (.*?) \| (.*?) \| (\d) \| (.*?) \| (.*?) \|$")


def rows() -> dict[str, tuple[int, str, str]]:
    out: dict[str, tuple[int, str, str]] = {}
    for line in DOC.read_text(encoding="utf-8").splitlines():
        m = ROW.match(line)
        if not m:
            continue
        cid, _domain, _control, score, evidence, gap = m.groups()
        path = re.sub(r"\[`(.*?)`\]\(.*?\)", r"\1", evidence)
        out[cid] = (int(score), "" if path == "—" else path, gap.replace("\\|", "|"))
    return out


def main(template: str, out: str) -> None:
    data = rows()
    if len(data) != 45:
        raise SystemExit(f"expected 45 controls in {DOC}, found {len(data)}")
    wb = openpyxl.load_workbook(template)
    header = None
    for prefix, name in SHEETS.items():
        ws = wb[name]
        for r in ws.iter_rows(min_row=2):
            cells = {c.column_letter: c for c in r}
            if r[0].value == "ID":
                header = {c.value: c.column_letter for c in r}
                continue
            cid = r[0].value
            if not isinstance(cid, str) or not cid.startswith(prefix):
                continue
            score, path, gap = data[cid]
            ws[f"{header['Score (0-4)']}{r[0].row}"] = score
            ws[f"{header['Evidence / link']}{r[0].row}"] = path
            ws[f"{header['Owner']}{r[0].row}"] = "founder (every seat is vacant)"
            ws[f"{header['Gap or action']}{r[0].row}"] = gap
            ws[f"{header['Status']}{r[0].row}"] = STATUS[score]
            _ = cells
    wb.save(out)
    print(f"wrote {out}: {len(data)} controls scored from {DOC.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
