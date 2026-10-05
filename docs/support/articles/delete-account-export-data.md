# Delete my account, or export my data

> **Type:** help · **Audience:** students, support · **Owner:** `privacy` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when you want a copy of your data, want your account removed, or a delete or export did not finish; stop reading if you only want to remove one note or course, which is [the deleted-item page](deleted-item-came-back.md).

**Status:** LIVE when an account service is configured. Counsel review of the privacy policy is pending; this page states what the app does, not a legal conclusion ([data retention](../../DATA-RETENTION-EXPORT-DELETION.md)).

## Symptom

You say one of these:

- "I want all my data."
- "I want my account deleted."
- "I pressed delete and it says it can't tell whether anything was deleted."
- "It says my data is deleted but the sign-in remains."
- "I deleted my account and my courses are still on my laptop."

## Check

1. Open **Privacy and your rights**. Three controls matter: **Download my account data**, **Delete my account** and **Erase from this device**. Each has its own confirmation.
2. They are different things. The first saves what the server holds as one file. The second removes your account and its server data. The third removes what is stored in this browser.
3. **Take it with you** (the Export screen) saves your records as files you can open elsewhere, including "Everything, as data", which restores into a fresh browser.
4. You must be signed in to download account data or delete an account. Signed out, the screen says "You are not signed in, so there is no account to delete — nothing about this semester has ever left the device."

## Fix

1. Export first. Press **Download my account data**. The result says "Saved" with the file name and how many tables it covers. Also use **Take it with you** for the files that are only on your device (attachments never sync).
2. To delete, press **Delete my account**, read the confirmation, and confirm. It removes every row belonging to your account and then the account and its sign-in, in one step on the server. If any of it fails you stay signed in and are told what happened.
3. If the answer is "No answer came back from the server, so this cannot say whether anything was deleted. You are still signed in here. Press Delete my account again — it is safe to repeat, and the answer will say what is left." then press it again.
4. If the answer is "Your data is deleted, but the sign-in could not be removed yet. Press Delete my account again to finish." press it again.
5. If the answer is "Nothing was deleted. Try again in a minute." wait and retry.
6. After a successful delete, the device keeps its own copy. The app says: "This device still has its own copy — Erase from this device removes that." Use **Erase from this device** when you want that gone too. It restarts the app empty.
7. Before you erase the device, check that anything you want is in a file. A device erase removes the semester, courses, notes, attachments and the daily copies from this browser.
8. A deletion cannot be undone from the app. A cooling-off restore is a design only ([Recovery Center R3](../../RECOVERY-CENTER.md)).

## Not your fault

- **Some records stay, by design.** A report you filed about somebody, a school's own record of you, billing records (unlinked from your account) and similar rows are kept or detached rather than erased. The Privacy screen lists each with the reason.
- **A failed export or delete is usually the connection or the service.** The message says "Nothing was downloaded:" and why. Retry in a minute.
- **Staff accounts.** Deletion fails closed for staff who wrote to four immutable history tables ([truth table](../../FEATURE-TRUTH-TABLE.md)).

## Contact

Data-rights requests that cannot be done in the app are handled by the [data rights request runbook](../../DATA-RIGHTS-REQUEST-RUNBOOK.md). Support does not decide a legal question; privacy and counsel do.

### What to send

- Which button you pressed and the exact message afterwards.
- Whether you were signed in and on which device.
- Whether you want an export, a deletion or both.

### What not to send

- Your password, a reset link or an export file. An export contains your private data; do not attach it to a message.
- A government ID. Nothing on this page asks for one.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Privacy and your rights", "Download my account data", "Delete my account", "Erase from this device", "Take it with you", "Everything, as data", "You are not signed in, so there is no account to delete", "Nothing was downloaded:", "No answer came back from the server, so this cannot say whether anything was deleted.", "Your data is deleted, but the sign-in could not be removed yet. Press Delete my account again to finish.", "Nothing was deleted. Try again in a minute.", "This device still has its own copy — Erase from this device removes that."] -->
