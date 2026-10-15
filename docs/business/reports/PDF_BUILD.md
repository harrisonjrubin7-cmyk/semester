# Building the GTM PDF reports

| Control | Value |
| --- | --- |
| Status | **DRAFT BUILD INSTRUCTIONS** |
| Owner | Harrison Rubin (interim) |
| Evidence date | 2026-10-05 at repository revision `5eba494` plus this branch |
| Labels used | `[VERIFIED]` for commands run during this work |

## What is built `[VERIFIED]`

| Output | Audience | Source |
| --- | --- | --- |
| `output/Semester_GTM_Financial_Sales_Compliance_Playbook.pdf` | Internal, full report (21 sections and appendix) | Sections extracted from `docs/business/` by `app/scripts/gtm-pdf/manifest.mjs` |
| `output/Semester_GTM_Executive_Summary.pdf` | Internal, concise | `docs/business/reports/EXECUTIVE_SUMMARY.md` |
| `output/Semester_GTM_Board_Investor_Summary.pdf` | Internal draft for a board or investors | `docs/business/reports/BOARD_INVESTOR_SUMMARY.md` |
| `output/Semester_GTM_Pilot_Procurement_Pack.pdf` | Customer-safe draft, not approved for distribution | The customer-safe playbook and the customer-facing sections of the proposal and action-plan templates |

The Markdown source of each PDF is written beside it in `docs/business/reports/generated/`. The generator also writes the combined Markdown of the full report there.

## How `[VERIFIED]`

From the repository root, after `npm ci`:

```bash
cd app
npm run generate:gtm-pdf
```

Requirements: Node 22 or newer, the `marked` package (already a workspace dependency), and a Chromium or Chrome binary. The script looks at `GTM_PDF_CHROME`, then `SMOKE_CHROME`, then `/opt/pw-browsers/chromium`. It runs the browser headless and prints through `--print-to-pdf`; it does not need Playwright. No network is used and nothing is uploaded.

```bash
GTM_PDF_CHROME=/path/to/chrome npm run generate:gtm-pdf
npm run generate:gtm-pdf -- --check   # fail if a manifest section or source file is missing; write nothing
```

## How the reports are assembled

Each report is a list of parts in the manifest: hand-written text, or an extract of a named heading (with its subsections) from a source document. Extracting rather than copying keeps the PDF in step with the documents. Relative links are printed as plain references, because a PDF cannot resolve them. Label tags such as `[VERIFIED]` and `[REVIEW: counsel]` are drawn as chips, and a label census for each report is printed on its label-key page.

## Rebuilding after a change

Edit the source document, run the command above, and review the PDF. The generator fails if a heading it extracts has been renamed, so a stale manifest cannot silently drop a section. The PDFs are generated files: the Markdown and the manifest are the source.

## Evidence state

**Repository evidence.** The script and manifest are in the repository. **Operational evidence.** The PDFs were built and inspected on 2026-10-05 in a Linux container with Chromium 141. **Missing proof.** A rebuild on another machine.

## Claim ceiling

Instructions for producing internal and draft documents.

## Prohibited claims

Do not distribute the customer-safe pack until the approval record inside it is completed.

## Professional review required

`[REVIEW: counsel]` before the pilot and procurement pack leaves the company.
