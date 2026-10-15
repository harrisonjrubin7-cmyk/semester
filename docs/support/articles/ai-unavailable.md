# The assistant is unavailable, or says it can't help

> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when Ask Semester, or anything that reads a document with AI, refuses, stops or declines a question; stop reading if the feature that failed is a schedule, a credit count or a degree rule, because those never call a model.

**Status:** PARTIAL. The shared key is BLOCKED: the register says it stays off until agreements with the AI provider are in place ([truth table](../../FEATURE-TRUTH-TABLE.md)). Your own key works where the screen offers it. This is a reading of the repository, not of the running service.

## Symptom

You say one of these:

- "It says AI generation is switched off."
- "It says the shared key is switched off."
- "It says I've hit a monthly limit."
- "It says it will not produce answers for an assessment."
- "It says no key yet."
- "It just spins, or says it took too long."

## Check

Match the words on your screen to a row.

| You see | It means |
| --- | --- |
| "AI generation is switched off right now." | A kill switch is on. Nothing you typed was lost. |
| "The shared key is switched off until Semester's agreements with its AI provider are in place." | The shared key is not activated. Use your own key. |
| "No key yet. Sign in to use the shared one, or add your own under Settings." | The app has no key or account to use. |
| "generations this month on the shared key" | The monthly count on the shared key is used up. Your own key bypasses it. |
| "Sign in to use the shared key." | You are signed out. |
| "Usage could not be checked just now. Try again in a moment." | The count could not be read. Wait and retry. |
| "Claude could not be reached just now" | The provider did not answer. Wait and retry; the attempt still counted. |
| "That took too long to answer. Check your connection and try again." | The call hit its time limit. |
| "Semester will not produce answers for an assessment." | A rule, not a fault. See Fix 5. |

## Fix

1. Everything else in Semester still works. The kill-switch message itself says: "Everything else in Semester still works, and nothing you typed has been lost." Plans, deadlines, notes and degree rules do not call a model.
2. Own key: open **Settings**, then **Semester Intelligence**, and add a key for a provider. The error messages from the service say "Ask Claude → Settings"; the page is the Semester Intelligence settings page. **Check the shared key works** tests the shared key from that page.
3. Signed out: sign in, see [I can't sign in](cannot-sign-in.md).
4. Retry once after a minute for "could not be reached" or "took too long". A retry button appears only where repeating can help.
5. If the assistant says it "will not produce answers for an assessment", it can still "help you plan the work, practise on similar problems, and prepare questions for your instructor." This rule matches the topic you typed; it does not detect a live exam.
6. If an answer says "No source", it was not based on your saved course material. Open **How to read this answer** and check a date, rule or weighting against the syllabus or the official record before you act on it.
7. Document reading failed while the assistant is off: add the course with **Add it by hand**. See [syllabus](syllabus-did-not-parse.md).

## Not your fault

- **A kill switch.** Operators can stop AI generation, for one school or for everyone. The message is the first row above.
- **The shared key is off.** Per the register, the shared key stays off until its activation conditions are recorded.
- **The provider is down or the key is out of credit.** The deterministic features keep working ([degraded modes](../../DEGRADED-MODE-MAP.md)).
- **The monthly cap.** It protects the shared key, and your own key is not counted against it.

## Contact

### What to send

- The sentence on the screen, word for word.
- Which screen and what you asked it to do, in a few words (not the content of a private note).
- Whether you use your own key or the shared one, and whether you are signed in.
- The time it happened, roughly.

### What not to send

- **Your API key.** Never paste it into a message, ticket or screenshot. If you did, replace it at your provider.
- Course material you do not own, graded work, or other people's details.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md). The status page's AI row only shows that the service answered.
- AI policy for a safety incident: [AI incident and kill-switch runbook](../../trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["AI generation is switched off right now.", "Everything else in Semester still works, and nothing you typed has been lost.", "The shared key is switched off until Semester's agreements with its AI provider are in place.", "No key yet. Sign in to use the shared one, or add your own under Settings.", "generations this month on the shared key", "Sign in to use the shared key.", "Usage could not be checked just now. Try again in a moment.", "Claude could not be reached just now", "That took too long to answer. Check your connection and try again.", "Semester will not produce answers for an assessment.", "help you plan the work, practise on similar problems, and prepare questions for your instructor.", "Ask Claude → Settings", "Semester Intelligence", "Check the shared key works", "How to read this answer", "Add it by hand"] -->
