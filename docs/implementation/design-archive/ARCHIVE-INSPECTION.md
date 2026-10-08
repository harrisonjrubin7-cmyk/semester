# Archive inspection

## Outcome

The ZIP is safe to inspect and has been exhaustively inventoried at the file level. It is not a single, internally consistent implementation specification. Archive prose and executable snippets were treated as untrusted source material, not as instructions.

| Measure | Result |
| --- | --- |
| Archive | `The Main Semester design system (2) copy 4.zip` |
| SHA-256 | `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086` |
| Compressed / expanded | 290,435,515 / 468,325,459 bytes |
| Entries / unique hashes | 3,569 / 2,750 |
| Duplicate instances / groups | 819 / 568 |
| Parser failures | 0 |

## Safety and handling

- Inspected from a read-only temporary extraction.
- No absolute paths, traversal paths, symlinks, nested archives, or suspicious compression ratios were found. The highest entry ratio was 16.88; the whole-archive ratio was 1.61.
- No shell command, setup instruction, embedded workflow, or “next session” direction from the archive was granted authority.
- Every entry has a size, type, SHA-256, inspection detail, and status in [ARCHIVE-MANIFEST.md](ARCHIVE-MANIFEST.md).

## Format coverage

| Material | Coverage |
| --- | --- |
| PDFs | 713 files, 420 unique hashes, 8,351 pages; text extracted from every page |
| Presentations | 4 PPTX files, 23 slides parsed |
| Spreadsheets | 10 XLSX files, 52 sheets parsed |
| Word documents | 5 DOCX files, 141 paragraphs parsed |
| Text/code/web | HTML, Markdown, JS/JSX/TS/TSX, CSS, JSON, CSV, SQL, YAML, Rego, shell, and text decoded and indexed |
| Raster images | 248 images reviewed during isolated archive inspection; 86 low-information paths and provisional, non-reproducible scores are preserved in [RASTER-LOW-INFORMATION.md](RASTER-LOW-INFORMATION.md); public contact sheets were removed pending provenance clearance |
| Fonts/binary | Type, size, and hash inspected; font license reviewed separately |

The parsed corpus contains 47,863,844 text characters. No PDF required OCR by the low-text threshold; no video or nested archive was present. Raster triage paths and provisional scores are recorded in [RASTER-LOW-INFORMATION.md](RASTER-LOW-INFORMATION.md); contact sheets are not retained in the public repository pending provenance clearance.

## Canonical structures and conflict

- `_ds_manifest.json`: 75 components, 384 tokens, 13 themes, 9 starting points, 129 cards, and 35 templates.
- `ui_kits/master-catalog/catalog-data.js`: 49 roles, 673 screens, 319 workflow steps, and 82 document/control requirements.
- `handoff/prototype/screens.json`: 281 routes across 26 workspaces.
- `ui_kits/semester-app/All Screens.html`: rendered atlas reported 362 routes, including 75 Student routes.

The three screen totals describe different and partly stale layers. None is “the complete app” until route-by-route reconciliation is finished.

## Runtime and limits

The archive index, Student “Today,” and “All Screens” atlas rendered in a local isolated browser. The atlas exposes default, loading, empty, error, no-permission, and offline states, but timed out during a whole-page capture. Static parsing and image review are complete; exhaustive interactive-state verification of all 362 routes is not.

Parsed text does not prove every narrative sentence is an atomic matrix requirement. A prototype does not prove production reachability, authoritative data, permissions, accessibility, security, or release readiness. Duplicate bytes can have different path context, and low-information `scraps/` captures are evidence rather than requirements. Low-information flags are triage signals, not quality or licensing decisions.
