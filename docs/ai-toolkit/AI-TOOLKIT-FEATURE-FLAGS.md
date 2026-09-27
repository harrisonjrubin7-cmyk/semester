# AI Toolkit feature flags

**Code:** `app/src/lib/toolkit/flags.ts`. **Build mapping:** `.github/workflows/pages.yml`
(guarded by `lib/deploy.test.ts`).

States: `off` · `preview` · `sandbox` · `production`. Anything else reads as `off`.

| Flag | Variable | Default | Controls |
| --- | --- | --- | --- |
| `aiToolkit` | `VITE_AI_TOOLKIT` | off | The toolkit entry on Study. **Kill switch**: `off` forces every flag below off |
| `researchStudio` | `VITE_TOOLKIT_RESEARCH` | off | Research Studio tab, research recommendations, Today's research items |
| `dataStudio` | `VITE_TOOLKIT_DATA` | off | Data Studio tab and recommendations |
| `dataUpload` | `VITE_TOOLKIT_DATA_UPLOAD` | off | Importing CSV (file or paste) inside Data Studio |
| `subjectWorkbenches` | `VITE_TOOLKIT_WORKBENCHES` | off | Subject-specific tools in *All tools* and subject recommendations |
| `aiDisclosure` | `VITE_TOOLKIT_DISCLOSURE` | off | The AI-use declaration form |
| `codeExecution` | — | **always off** | Nothing built behind it |
| `externalConnectors` | — | **always off** | Nothing built behind it |

## Differences from the experience flags

`lib/experience-flags.ts` turns its six flags to `preview` whenever the institutional
preview is on. **These do not** — a test pins it. Several guard exactly the things the
brief says need human review, and following another switch would enable them by
accident.

## Rollback

Set `VITE_AI_TOOLKIT=off` (or unset it) and rebuild. The entry disappears from Study.
Student data stays on their devices under `semester.toolkit.v1` and
`semester.toolkit-data.v1`, untouched, and reappears if the flag is turned back on.
No migration to reverse.
