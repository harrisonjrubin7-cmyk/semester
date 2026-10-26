# Semester Slack app

Slack is a **notification and decision surface**. Semester stays the system of record. Clickable mock: `ui_kits/slack-integration/index.html`.

## Flows
| Flow | Direction | Who | What Slack shows |
|---|---|---|---|
| Deadline + change alerts | Semester → DM | Students who opted in | Title, new/old due, source, freshness. No grades. |
| Approval requests | Semester → DM/channel → Semester | Approvers | Summary + Approve / Deny / Review. |
| Incident + ops alerts | Semester → staff channel | On-call staff | Severity, title, IC, Acknowledge. |
| Advisor outreach | Semester → DM | Students | "Your advisor sent a message" + link. Body stays in Semester. |
| `/semester` lookups | Slack → Semester | Linked users | Private (ephemeral) answers: due, holds count, open requests. |

## Rules
1. **Account link required.** A Slack user acts only after linking via school SSO. Matching emails never grants access.
2. **No restricted data in Slack.** No grades, aid, accommodation, health, holds detail, or message bodies. Counts and links only.
3. **Re-check at execution.** Every button calls `/approvals/:id/decide` with the message's `version`. Semester rejects self-approval, stale versions, expiry, missing role, already-decided.
4. **Idempotent.** Each action sends `idempotency-key: slack:<request>:<user>:<decision>`; outbox events are claimed once.
5. **Signed both ways.** Slack requests verified by Bolt (signing secret); Semester webhooks verified with HMAC-SHA256 and constant-time compare.
6. **Opt-in for students.** Notification preferences live in Semester; "Mute this course" writes back there.
7. **Revocation.** Removing a Semester membership deactivates the Slack link; uninstalling the app deletes link records.

## Setup
1. Create the app from `manifest.yml` (replace `YOUR-HOST`).
2. Set env: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `SEMESTER_API`, `SEMESTER_SERVICE_TOKEN`, `SEMESTER_WEBHOOK_SECRET`.
3. Rename `app.js.txt` → `app.js` (kept as .txt so the design-system bundler skips it), then `npm install && npm start`.
4. In Semester: Integrations → Slack → point the outbox webhook at `https://YOUR-HOST/semester/outbox`.

## Semester API this expects (to build)
`GET /slack/links/:team/:user` · `GET /slack/link/start` · `GET /me/today` · `GET /me/holds` · `GET /me/requests` · `POST /approvals/:id/decide` · `POST /incidents/:id/ack` · `POST /me/notifications/mute` · `POST /slack/outbox/:id/claim`

Not tested against a live workspace.
