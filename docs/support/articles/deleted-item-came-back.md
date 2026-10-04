# I deleted something and it came back, or it didn't go

> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when something you removed reappears on another device, stays on one device after you deleted it, or you removed something by mistake and want it back; stop reading if you want to delete your whole account, which is [its own page](delete-account-export-data.md).

**Status:** PARTIAL. Deletions travel between devices for some kinds of item and not for others. This is a stated limit, not a bug report. See [known limits](../../pilot/KNOWN-LIMITATIONS.md).

## Symptom

You say one of these:

- "I deleted a note on my laptop and it is still on my phone."
- "I deleted it, closed the app, and it came back."
- "I deleted a folder (or an equation, or a place) and it is back."
- "I deleted something on one device and the app asks me to choose."
- "I removed a course by mistake."

## Check

1. Deleting a course, note, action, appointment, document, sheet or deck on one device deletes it on the others once they sync. If you changed it on another device first, the changed one stays and you are asked.
2. Other lists (folders, equations, places and the rest) do not carry a deletion yet. An item deleted from one of those can come back from another device.
3. Did you delete almost everything of one kind while offline and close the app before it synced? The app treats deleting five or more of the same kind, and nearly all you had, as an accident. They come back on the next sync.
4. Is there a card on **Account** that says "Deleted on this device, changed on the other." or "Deleted on the other device, changed on this one."? That is a choice waiting for you.

## Fix

1. Delete it again. For an item that came back, deleting it a second time while you are online sends each deletion up as you make it.
2. For the choice card, press **Keep it deleted** or **Keep this one**. Keeping a deleted version removes the item from both devices: "Deleted. Keeping this removes it from both devices."
3. To get something back, work down this list:
   1. Press **Undo** if it is still shown. Moves and some changes offer Undo for eight seconds.
   2. A deadline you ticked by mistake is under Done on Today.
   3. A course you removed comes back by importing its syllabus again with **Add a course**. The deadlines and study guide are rebuilt; answers you recorded are not.
   4. The app takes copies of your whole workspace on this device, up to seven days back. Open **Take it with you**, pick a copy, read what going back would change, then press **Go back to this**. "A restore replaces what is here; it does not merge." The app takes a copy of right now first.
4. Those copies stay on the device. They are not synced and are not in your export, so they survive a mistake and not a lost phone. For that, use **Take it with you** to download "Everything, as data" on a regular basis.

## Not your fault

- **A kind of item does not propagate deletions.** That is the limit in step 2 of Check. Delete it again.
- **A deleted-offline safeguard fired.** That is step 3 of Check.
- **Two devices were used offline.** The Account screen offers you the other version to choose.
- **No per-item history exists.** There is no earlier version of a single plan. The nearest thing is the whole-workspace copies.

## Contact

### What to send

- The kind of thing (note, course, folder, equation) and what happened, in two sentences.
- Which device you deleted it on and which one still shows it.
- Whether either device was offline at the time.
- Whether you can see a choice card on Account.

### What not to send

- The deleted content itself, or the contents of your export.
- Your password. This page documents no support-side restore of a deleted item; recovery here is from the copies on your own device.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Account", "Add a course", "Take it with you", "Everything, as data", "Go back to this", "Undo", "Keep it deleted", "Keep this one", "Deleted on this device, changed on the other.", "Deleted on the other device, changed on this one.", "Deleted. Keeping this removes it from both devices.", "A restore replaces what is here; it does not merge."] -->
