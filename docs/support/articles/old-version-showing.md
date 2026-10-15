# The app shows an old version

> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when a fix you were told about is not there, a screen says it needs a reload, or a screen will not open offline; stop reading if the whole app is blank on a first visit, which is an outage and is covered under Not your fault.

**Status:** LIVE. The app is a web app with a service worker that keeps copies of files so it opens with no signal.

## Symptom

You say one of these:

- "Support said this was fixed and it isn't."
- "It says to reload to pick up the new version."
- "A screen says it has not been downloaded."
- "I left the tab open for days and things look old."

## Check

1. Look at the bottom of the screen for a bar that says "A newer version of the app is ready." It has **Later** and **Reload** buttons. The app never reloads by itself, because a reload could interrupt something you are writing.
2. If a screen shows the heading "Reload to pick up the new version." under "This app was updated", a new version was published while the app was open and the file that screen needed is gone. Nothing is lost: everything is saved on this device.
3. If a screen shows "This screen has not been downloaded." under "No connection", the screen was never opened on this device and you are offline. It will open once there is a connection.
4. Is it a tab left open for a long time? A running page keeps the code it started with, even while newer files are available.

## Fix

1. Press **Reload** on the bar or on the error screen. Finish what you are writing first if you can; the app saves as you go, at the end of each keystroke.
2. Error screens also offer **Go to Today**. It leaves the broken screen without reloading.
3. No bar and still old: close the tab and open the app again. If you installed it to your home screen or as a window, quit it and open it again.
4. Still old: do a hard reload in your browser (a browser feature, not a Semester button; the shortcut differs by browser and system), then open the app.
5. Offline with "This screen has not been downloaded.": reconnect and open the screen once. After that it opens offline.
6. Last resort, and only after you have a copy: clearing the site's data in your browser removes the copy of your semester on this device. Anything that has not synced would be lost. Open **Take it with you** first and download "Everything, as data". See [syncing](sync-waiting-or-conflict.md).

## Not your fault

- **A new version was published while the app was open.** That is the cause of "This app was updated".
- **First visits need the host.** If the page that serves the app is down, a first visit cannot load. Anyone who already has the app cached or installed keeps working ([degraded modes](../../DEGRADED-MODE-MAP.md)).
- **Offline.** Everything you have opened before works with no signal.

## Contact

### What to send

- The heading you saw word for word, and which screen it was.
- Browser and device, and whether you use the installed app or a tab.
- Whether Reload fixed it.
- The Reference if one is shown (SEM-0000). Error screens also show a message, and the message ends by saying Settings → Storage keeps a log of this on the device.

### What not to send

- Your logs from the browser console, unless support asks. They can contain what you were typing.
- Screenshots that show your grades, notes or other people.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["A newer version of the app is ready.", "Later", "Reload", "Go to Today", "This app was updated", "Reload to pick up the new version.", "This screen has not been downloaded.", "No connection", "Take it with you", "Everything, as data", "Settings → Storage keeps a log of this on the device.", "Everything you have opened before works with no signal"] -->
