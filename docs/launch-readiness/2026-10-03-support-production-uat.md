# Support production UAT — 2026-10-03

Status: **partially passed; email inbox receipt pending**

Production evidence recorded against deployed commit `a1504691a60af3499803d0e9fd38fa1cb4ea7ec9`:

- The scheduled `support-reply-notify` job was active and returned HTTP 200.
- An individual beta user created ticket `SUP-9357-FB26-801E-4BB0` with email notice explicitly enabled.
- A production `support_agent` recorded a generic reply and set the resolution state to “Support thinks this is solved.”
- The reply appeared in the student’s Help thread.
- The notification outbox recorded provider acceptance with no retry, dead letter or provider error.
- Microsoft Defender recorded the exact recipient, sender and subject, quarantined it under the institution’s anti-spam policy, and then recorded recipient release to the inbox.
- Outlook search, Focused, Other and Junk did not yet show the released message at the time of this record.

Verdict: the staffed in-app ticket and reply path passed production UAT. The email path is deployed and reached the recipient tenant, but it must remain non-green until the released message is visible in the mailbox client. This record does not establish published support hours, a 24/7 rota or contractual service levels.
