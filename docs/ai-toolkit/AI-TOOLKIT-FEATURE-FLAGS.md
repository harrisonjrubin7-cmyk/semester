# AI Toolkit feature flags

**Code:** `app/src/lib/toolkit/flags.ts`. **Build mapping:** `.github/workflows/pages.yml`
(guarded by `lib/deploy.test.ts`).

States: `off` · `preview` · `sandbox` · `production`. Anything else reads as `off`.

**Deployed app:** all six are `production`, set in the committed `app/.env.production`.
A build without that file (local `npm run dev`, tests) has them all `off`.

| Flag | Variable | Default in code | Controls |
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

**Fastest, no commit:** set the repository variable `VITE_AI_TOOLKIT` to `off` and re-run
the Pages deploy (Actions → Pages → Run workflow). A repository variable wins over
`app/.env.production` — checked by building with `VITE_AI_TOOLKIT=off` in the
environment, which compiled the toolkit off — and `off` forces the other five off.
The entry disappears from Study.

**It is not instant.** The flags are compiled into the bundle, so switching them off
means a new build and deploy (a few minutes), and a browser that already has the
app keeps running the cached bundle until its service worker picks up the new one —
usually on the next visit after the deploy. For an emergency, expect minutes to
hours, not seconds.

**Permanent:** remove the lines from `app/.env.production`.

Either way, student data stays on their devices under `semester.toolkit.v1` and
`semester.toolkit-data.v1`, untouched, and reappears if the flag is turned back on.
There is no migration to reverse.
