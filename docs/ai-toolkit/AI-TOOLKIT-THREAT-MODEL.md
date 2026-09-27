# AI Toolkit threat model

Scope: a client-only toolkit that stores on the student's device, with no network
calls and no model calls of its own.

| # | Threat | Where it would land | Mitigation | Residual / next phase |
| --- | --- | --- | --- | --- |
| 1 | Recommendation uses grades, health or location | `recommend()` | `Context` has no such fields; `explicitOnly()` strips extras at run time; test passes GPA, risk, GPS and checks identical output | Any server-side recommender must keep the same allowlist |
| 2 | Evidence marked verified without the original | `verify()` | Requires *original opened*, citable kind, full citation, matched quotation or page; edits clear it; reads re-check it | The tick is self-attested; nothing can prove a student read a paper |
| 3 | AI summary cited as a source | research export | `citable()`; excluded from RIS/BibTeX; `verify()` refuses | — |
| 4 | Fabricated citation fields | `reference()` | Missing fields print as `[… missing]`; nothing generated | — |
| 5 | Correlation reported as causation | claim audit, data interpretation | Causal-wording check vs. non-experimental designs, on the claim, the conclusion and *what the data shows*; export blocked on the data side | Keyword-based; misses unusual phrasing |
| 6 | Regulated or education-record data leaves the device | `importCsv()`, Data Studio export | Classification required at import; T4+ refused; stored T4+ refused on read; **the gate is asked again at export**, so T3 cannot be exported (F1) | Self-declared tier; a student can mislabel. Server phase needs a data-steward path |
| 7 | Unknown AI policy read as permission | `resolve()`, `fromCourse()` | Fallback is `unavailable`, which never permits; an unrecognised stored stance produces no layer (F7) | Only the student's own record exists as a source |
| 8 | "AI allowed" read as allowing assessment answers | `fromCourse()` | `final-answers` forced to `prohibited` under any blanket | — |
| 9 | High-risk workbench enabled by config mistake | `entitle()` | `restricted` unavailable even when approved; `NEVER` ids refused whatever the list | Real enablement needs a reviewed implementation |
| 10 | Code execution / connectors switched on by env | `toolkitFlags()` | Hard-wired `off`; tested | Unpin only with the sandbox in [CODE-STUDIO-AND-SANDBOX.md](CODE-STUDIO-AND-SANDBOX.md) |
| 11 | One flag left on after the kill switch | `toolkitFlags()` | `VITE_AI_TOOLKIT=off` forces every flag off; tested | Build-time: needs a redeploy, and a cached service worker serves the old bundle until it updates (F12) |
| 12 | Local data lost or overwritten | `useDeviceLibrary`, Data Studio | Refuses writes on a failed read; recovery download on both toolkit keys; a refused dataset save says it was not imported (F3) | Device-only data is lost with the device |
| 13 | Hand-edited storage bypasses rules | readers | `readProjects` re-verifies; `readWorkspaces` forces private; `readDataProjects` refuses T4+, and the refusal is now shown with a recovery download instead of silently blocking imports (F6); RIS fields cannot carry line breaks (F10) | — |
| 14 | Shared device exposes one student's work to another | device storage | Both toolkit keys are per account (`semester.toolkit.v1:<account>`), like Family, Pathway and Athletics; Study remounts the toolkit on account change (F5) | Anyone using the same browser profile *signed in as the same account* sees it, as with every device library |
| 15 | Declaration used for surveillance | declaration | Stored locally, per account; no reader; content of inputs never recorded | Keep it out of any future analytics |
| 16 | Spreadsheet formula in an exported CSV | Data Studio "Export cleaned CSV" | `toCsv()` prefixes cells starting `=` `+` `-` `@` tab or CR with `'`, and quotes quote, comma, CR and LF (F2) | Other exports are text or reference formats, not spreadsheets |
| 17 | Toolkit fills the origin's localStorage quota and breaks sign-in, threads and other libraries | both toolkit keys | Per-key budgets in `useDeviceLibrary` (data 1 M characters, the rest 750 k); 400 KB per imported file; an import that would not fit is refused up front (F4) | Other features' own storage is outside this model |
| 18 | Regex denial of service on long input | causal-wording check | `effects? of [^.]{0,200} on` instead of `.*`: 30 ms → 1.3 ms on a 20k-character worst case (F9) | — |

## Review

An independent adversarial review (a separate Claude agent, not a human) checked every
row above against the code on 27 September 2026, probing each with tests. It found
five issues it rated blocking (F1–F5) and seven lower (F6–F12). All twelve are fixed,
each with a test that fails when the fix is removed:

| Finding | Severity | Fixed in |
| --- | --- | --- |
| F1 T3 export | high | Data Studio phase (#784) |
| F2 CSV formula injection | medium | #784 |
| F3 false "Imported", hidden errors | medium | #784 |
| F4 localStorage quota | medium | #784 |
| F5 not per account | medium | review follow-ups |
| F6 one bad record locks the Data Studio silently | low | #784 (error now shown) |
| F7 unknown stance read as allowed | low | review follow-ups |
| F8 AI text ignored the data's tier | low | review follow-ups |
| F9 causal check narrow; quadratic regex | low | review follow-ups |
| F10 RIS record injection | info | review follow-ups |
| F11 unsafe download names | info | #784 (`safeName`) |
| F12 kill switch is build-time | info | flags doc |

A human review of this threat model is still a launch gate in
[AI-TOOLKIT-TEST-PLAN.md](AI-TOOLKIT-TEST-PLAN.md). An AI reviewing an AI's work is a
real check, not the same one.
