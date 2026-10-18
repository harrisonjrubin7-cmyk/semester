# Sync says it's waiting, or two devices disagree

> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when the Account screen says your changes are queued, in conflict or need review, or when your phone and laptop show different things; stop reading if you have no account, because then nothing syncs and everything is on this one device.

**Status:** LIVE for signed-in accounts. Files you attach never sync. See [known limits](../../pilot/KNOWN-LIMITATIONS.md).

## Symptom

You say one of these:

- "It says Queued and nothing happens."
- "It says Conflict" or "Conflict needs review".
- "My laptop doesn't have what I did on my phone."
- "Sync failed" or "Sync did not finish".
- "My attachment isn't on my other device."

## Check

1. Open **Account**. The sentence under "Signed in" is the state. These are the exact sentences:
   - Queued: "No connection. Your latest changes are saved on this device and will go to your account as soon as the connection is back."
   - Offline: "No connection. Everything here is saved on this device, and it will sync when the connection is back."
   - Conflict: "Another device keeps changing this semester at the same moment." It adds that nothing has been overwritten and that each round merges both.
   - Review: "Something was changed on two devices before either synced. Both versions are saved on this device — choose which one to use."
   - Read-only: "Read-only mode: this build does not send changes to your account. Everything you change is saved on this device and goes up once read-only mode ends."
2. Open **Recovery** from the Me screen (its description reads "Unsynced work, this device’s copy, and how to get back what went missing") and read **Is my work safe?** and **Is anything waiting?** The second answers yes or no and, if yes, since when.
3. Attachments are the exception. Files you attach stay on the device that has them. Everything else you type or make syncs.

## Fix

1. Press **Check now** on **Account**. It answers in a sentence, for example "Checked. Nothing new since your other devices last saved." Pulling down on a phone does the same check.
2. If a failure shows **Sync did not finish**, read the sentence under it and press **Check now** there. A Reference (SEM-0000) is shown with it; keep it.
3. If you see **Choose a version**, the app has kept both versions on this device. Under each of **This device** and **Other device** press **Keep this one** on the version you want. For a deleted item the button reads **Keep it deleted**.
4. Queued with no connection: do nothing. It goes up by itself when the connection returns.
5. Kept sends. Sharing an advisor meeting and sending your course plan can be held while offline. They do not send by themselves. When you are back online, send each one from **Account** with **Send**. One held more than three days is not sent and has to be made again.
6. For attachments, move the file another way or use **Take it with you**.
7. If nothing helps, sign out with **Sign out (keeps data on this device)** and back in. Do not erase the device before your changes have reached your account.

## Not your fault

- **The account service is down or slow.** Your semester lives on your device; only sharing and sign-in degrade ([degraded modes](../../DEGRADED-MODE-MAP.md)).
- **Read-only mode.** During maintenance a banner reads "Read-only mode: your changes stay on this device until it ends." Keep working. Changes go up once it ends.
- **Two devices edited the same thing.** Merge rules: a note or action edited on two devices keeps the later edit and offers you the other. Notes and checked actions from both devices are kept. Settings use the latest choice.
- **An old signed-in session.** See [I can't sign in](cannot-sign-in.md).

## Contact

### What to send

- The state sentence from Account, word for word, and the Reference if shown.
- How many devices, and which kind (phone, laptop).
- Which item disagrees, by its type (a note, an action, a course), not its contents.
- Whether either device was offline when you edited.

### What not to send

- The text of your notes, grades or files.
- Your password or a reset link. A copy of your whole export is not needed to start.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Account", "Recovery", "Unsynced work, this device’s copy, and how to get back what went missing", "Is my work safe?", "Is anything waiting?", "Check now", "Sync did not finish", "Choose a version", "This device", "Other device", "Keep this one", "Keep it deleted", "Send", "Take it with you", "Sign out (keeps data on this device)", "No connection. Your latest changes are saved on this device and will go to your account as soon as the connection is back.", "No connection. Everything here is saved on this device, and it will sync when the connection is back.", "Another device keeps changing this semester at the same moment.", "Something was changed on two devices before either synced. Both versions are saved on this device — choose which one to use.", "Read-only mode: this build does not send changes to your account. Everything you change is saved on this device and goes up once read-only mode ends.", "Checked. Nothing new since your other devices last saved.", "Read-only mode: your changes stay on this device until it ends.", "Notes and checked actions from both devices are kept. Settings use the latest choice."] -->
