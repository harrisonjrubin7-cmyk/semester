# Support production UAT — 2026-10-03

Status: **in-app path passed; email path governance-gated and inbox receipt pending**

Current activation boundary: this record proves delivery mechanics exercised
on the date above. It is not current authorization to process student data
through Resend. The scheduled worker, deployed function and app UI are gated
until the Resend vendor review, executed terms/DPA, owner and explicit
activation decision are recorded. Outlook inbox receipt also remains pending.

Production evidence recorded against deployed commit `a1504691a60af3499803d0e9fd38fa1cb4ea7ec9`:

- The scheduled `support-reply-notify` job was active and returned HTTP 200.
- An individual beta user created ticket `SUP-9357-FB26-801E-4BB0` with email notice explicitly enabled.
- A production `support_agent` recorded a generic reply and set the resolution state to “Support thinks this is solved.”
- The reply appeared in the student’s Help thread.
- The notification outbox recorded provider acceptance with no retry, dead letter or provider error.
- Microsoft Defender recorded the exact recipient, sender and subject, quarantined it under the institution’s anti-spam policy, and then recorded recipient release to the inbox.
- Outlook search, Focused, Other and Junk did not yet show the released message at the time of this record.

Verdict: the staffed in-app ticket and reply path passed production UAT. The email path reached the recipient tenant during this controlled exercise, but it is now parked and must remain non-green until vendor governance is complete and the released message is visible in the mailbox client. This record does not establish published support hours, a 24/7 rota or contractual service levels.

Repository follow-through in this release parks the notification worker and requires an explicit vendor-approval switch before the deployed function can use Resend. It also adds a daily 180-day retention sweep for creation-time-classified individual-beta resolved or closed tickets that have no signed deployment association, with legal-hold protection and a partial due-row index. School-domain membership alone stays on the individual-beta clock. Tickets opened under a currently effective signed institutional order form remain outside that sweep until an institution-specific contract rule is configured. Tickets created before the durable classifier remain outside automated and ticket-only deletion until their historical authority is verified; the migration does not infer history from a current profile or an unbounded terminated contract. Whole-account erasure deletes classified tickets but detaches legacy records from `auth.users`, disables delivery and preserves them with an opaque former-account review key so potentially held evidence is not destroyed. The production UAT did not create a dedicated support-domain address: the published fallback remains `harrisonjrubin7@gmail.com`.
