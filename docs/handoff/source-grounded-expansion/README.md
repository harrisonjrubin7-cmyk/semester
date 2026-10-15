> In this design project the decoded JavaScript assets end in `.js.txt` (and `decoded/index.html` points at them) so the design-system bundler doesn’t ship 12 MB of them to every consumer. Rename back with `for f in decoded/assets/*.js.txt; do mv "$f" "${f%.txt}"; done` and revert the `.js.txt` references in `decoded/index.html` before serving it.

# Semester source-grounded expansion batch — 2026-10-13
The uploaded HTML is the designated design-source baseline. Repository code remains implementation authority; institutions and qualified reviewers retain their respective activation/legal/security/accessibility authority.

Source SHA-256: 98fce65d4f5d1c4c4563d0e8ea20271ddea28b0c968a30e643421a3bf79bbab6
Extracted without executing uploaded JavaScript: 14 resources; 122 capability definitions; 235 table entries; 127 function entries (120 unique names); 75 component exports.

## Deliverables
source/: original unchanged HTML, asset manifest, database reference and component metadata.
decoded/: recovered prototype and assets, UUID references rewritten locally. No browser rendering was performed.
registers/: source-grounded capabilities, six-fact completion register, columns, functions, components and command reconciliation.
specifications/: detailed review briefs for all 122 capabilities plus three connected-loop specs.
tools/: reproducible non-executing extractor with unit tests.
completion-board.html: new offline source-navigation and completion viewer. It searches/filters capabilities, displays record/command contracts, and exports JSON; it does not call production APIs or grant access.

## Important boundaries
- HTML design references are declared paths; linked prototype targets are not all embedded in this HTML.
- The catalog has reference metadata, not verified executable migrations or function bodies.
- auth.users is outside the included table list, not a missing-table implementation conclusion.
- Source heuristic marks non-api dotted commands as existing without an exact catalog match. The reconciliation register instead requires explicit reference matches.
- Six maturity facts remain unknown pending evidence; source-declared status is preserved separately.
- Repository platform-control uses ten finer-grained stages. Keep those stages intact and use six facts as a reporting view, never overwrite canonical stages.
- New specs/checklists are proposed work, not execution proof.
- No GitHub writes, remote migration, deployment, secret changes, provider calls, financial/academic actions or student-data processing occurred.

## Local use
Run python -m unittest discover -s tests -v.
Run python tools/extract_source.py source/The-Main-Semester-design-system.html > rebuilt-source.json.
For the decoded prototype, serve this package using a local static server if needed. Do not expose it publicly by default. A local server may help browser Babel load separate JSX source; no browser execution is certified here.

Start with specifications/NEXT-BATCH.md. Read current repository instructions first. Preserve student-private work and official-record boundaries. Never apply database-reference metadata as remote SQL.
