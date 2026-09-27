# AI Toolkit threat model

Scope: this slice — a client-only toolkit storing on the student's device, with no
network calls and no model calls of its own.

| # | Threat | Where it would land | Mitigation in this slice | Residual / next phase |
| --- | --- | --- | --- | --- |
| 1 | Recommendation uses grades, health or location | `recommend()` | `Context` has no such fields; `explicitOnly()` strips extras at run time; test passes GPA, risk, GPS and checks identical output | Any server-side recommender must keep the same allowlist |
| 2 | Evidence marked verified without the original | `verify()` | Requires *original opened*, citable kind, full citation, matched quotation or page; edits clear it; reads re-check it | The tick is self-attested; nothing can prove a student read a paper |
| 3 | AI summary cited as a source | research export | `citable()`; excluded from RIS/BibTeX; `verify()` refuses | — |
| 4 | Fabricated citation fields | `reference()` | Missing fields print as `[… missing]`; nothing generated | — |
| 5 | Correlation reported as causation | claim audit, data interpretation | Causal-wording check vs. observational designs; export blocked on data side | Keyword-based; misses unusual phrasing |
| 6 | Regulated data imported | `importCsv()` | Classification required; T4+ refused; stored T4+ refused on read | Self-declared tier; a student can mislabel. Server phase needs a data-steward path |
| 7 | Unknown AI policy read as permission | `resolve()` | Fallback is `unavailable`, which never permits | Only the student's own record exists as a source |
| 8 | "AI allowed" read as allowing assessment answers | `fromCourse()` | `final-answers` forced to `prohibited` under any blanket | — |
| 9 | High-risk workbench enabled by config mistake | `entitle()` | `restricted` unavailable even when approved; `NEVER` ids refused whatever the list | Real enablement needs a reviewed implementation |
| 10 | Code execution / connectors switched on by env | `toolkitFlags()` | Hard-wired `off`; tested | Unpin only with the sandbox in [CODE-STUDIO-AND-SANDBOX.md](CODE-STUDIO-AND-SANDBOX.md) |
| 11 | One flag left on after the kill switch | `toolkitFlags()` | `VITE_AI_TOOLKIT=off` forces every flag off; tested | — |
| 12 | Corrupt local data overwritten | `useDeviceLibrary` | Refuses writes on a failed read; recovery download | Device-only data is lost with the device |
| 13 | Hand-edited storage bypasses rules | readers | `readProjects` re-verifies; `readWorkspaces` forces private; `readDataProjects` refuses T4+ | — |
| 14 | Shared device exposes one student's work to another | device storage | Same exposure as every other device library in the app | Sign-out clearing is an app-wide question, not toolkit-specific |
| 15 | Declaration used for surveillance | declaration | Stored locally; no reader; content of inputs never recorded | Keep it out of any future analytics |

No item here was reviewed by a human yet. That review is a launch gate.
