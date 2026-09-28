# Vendor and Subprocessor Register

**Status: `IN_PROGRESS`, dated 2026-09-28.** This list was built from the
code, not from memory. It records every outside service the tree sends data
to, found by reading the hosts the code calls and the page's Content Security
Policy (`app/index.html`). It moves HECVAT PRIV-5 from "constructible" to
"written".

What it does **not** have yet is the diligence: no provider's DPA has been
reviewed or signed, and no provider's SOC report has been collected. Every
**DPA** and **Assurance** cell below says so. A university should read those
columns as the gap they are.

`app/src/lib/trust.test.ts` checks that every path cited here exists. When a
new outside host appears in the code, add a row in the same pull request.

## Subprocessors: services Semester chooses and pays for

These process data on Semester's behalf. A university's DPA flows down to them.

| Vendor | Service | Data categories | Purpose | Criticality | Where in the code | DPA | Assurance | Exit plan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Supabase | Postgres, auth, edge functions, storage | Account identity, course and coursework records, education records where an institution connects them, credentials (hashed by the auth service) | The system of record | Critical | `supabase/migrations`, `supabase/functions` | Not reviewed | SOC report not collected | Postgres dump plus the migration history rebuilds on any Postgres 17 host; auth users need a separate export |
| GitHub | Source control, CI, Pages hosting of the static app | Source code and CI logs. No student data: the app is a static bundle and student data goes browser to Supabase | Build, test and serve the app | High | `.github/workflows/pages.yml`, `.github/workflows/ci.yml` | Not reviewed | SOC report not collected | The build is a static bundle any static host can serve |
| Anthropic | Claude API, through the `claude` edge function on the project's key | Prompts, which can include course material and a student's own work | The AI features, metered per account | High | `supabase/functions/claude/index.ts` | Not reviewed; training-use terms not recorded | Not collected | A second provider already exists (`app/src/lib/openai.ts`); AI features also degrade to off |
| OpenAI | Responses API, through the institutional gateway, with `store: false` | Approved course source text and the question asked, scoped by tenant AI policy | Institutional AI, when a tenant enables it | High, where enabled | `app/server/institution/providers/openai.ts` | Not reviewed | Not collected | Tenant policy can disable it; the gateway fails closed |

**Hosting location is not recorded.** The Supabase project's region is set in
the dashboard, not the repository. Write it here before any DPA asks.

## Services a student connects, on their own account

These are not Semester's subprocessors. The student holds the relationship,
signs in to it directly, and can disconnect it. They are listed because a
reviewer asking "where does data go" deserves the whole answer.

| Service | What leaves the device | When | Where in the code |
| --- | --- | --- | --- |
| Anthropic, OpenAI (student's own key) | The student's prompts, sent straight from the browser | Only if the student pastes their own key; the key never leaves the device | `app/src/lib/claude.ts`, `app/src/lib/openai.ts` |
| Google, Microsoft, Apple, Zoom | OAuth sign-in; calendar, mail or meeting data the student authorizes | Only after the student connects the account | `app/src/lib/connect.ts` |
| OpenStreetMap Nominatim, Komoot Photon | Text the student types into a lookup box; position only for reverse lookup, which is behind its own switch and off by default | Only when switched on | `app/src/lib/geocode.ts` |
| OpenStreetMap tile servers | The visitor's IP address and the map area viewed | When a map is shown | `app/index.html` |
| Browser push services | Notification payloads, relayed to the device by the browser vendor's push service | Only for devices that subscribed | `supabase/functions/push` |

## Review fields, per vendor, once diligence starts

The brief asks for these, and each row above should gain them:

| Field | Required value |
| --- | --- |
| Business owner | The person accountable for the vendor |
| Geographic processing | Hosting, support, backup and AI model locations |
| Security evidence | SOC report, ISO certificate, pen-test letter or questionnaire |
| Privacy evidence | DPA, subprocessor list, retention and deletion terms |
| AI review | Training use, retention, opt-out and zero-retention availability |
| Contract dates | Effective, renewal, termination |
| Risk | Inherent risk, residual risk, approver, exceptions |
| Review frequency | Annual at minimum; more often for critical vendors |

## Next

1. Record the Supabase region.
2. Accept or execute each subprocessor's DPA and file the copy under
   `docs/evidence/`.
3. Request the Supabase and GitHub SOC 2 reports. Both publish them to customers.
4. Record Anthropic's and OpenAI's API data-retention and training terms as
   they apply to this account, with the date read.
