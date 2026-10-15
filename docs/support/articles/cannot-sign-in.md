# I can't sign in

> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when the Account screen will not let you in or a sign-in message confuses you; stop reading if the app opens and shows your courses, because you do not need an account for that.

**Status:** LIVE where the build has an account service. The Account screen says "This build has no account service" when it does not.

## Symptom

You say one of these:

- "The Sign in button does nothing."
- "It says my session expired."
- "I made an account and never got the email."
- "It says Semester is invite-only."
- "I forgot my password."

## Check

1. Do you need to sign in at all? The app works without an account. Signed out, the app says "Everything stays on this device. An account is optional." An account only keeps the same semester on your phone and your laptop.
2. Open **Account**. If the heading reads "This build has no account service", this copy of Semester has no accounts. There is nothing to sign in to, and nothing is wrong.
3. Read the line under the form. The button stays off until the form is complete, and the line says what is missing: "Enter your email address to continue." or "Enter your password to continue." When you make an account it also asks for at least 8 characters and your date of birth.
4. Think about how you made the account. If you pressed a provider button (Google, Microsoft or Apple), use the same button. The signed-in Account screen shows "Through" and the provider, which is what to press on a second device.

## Fix

1. Open **Account**, type your email address and password, and press **Sign in**.
2. Forgot your password: type your email address, then press **Send a reset link**. The app answers "a reset link is on its way to it." whether or not the address has an account. Open the link in the email and set a new password on the page it opens.
3. You made an account and no email came: look in spam, then follow what the app told you after you pressed **Create the account**: "Check your email for the confirmation link, then come back and sign in." If the link opens a page that will not load, the confirmation still worked. Come back to Semester and sign in anyway.
4. The invite message ("Semester is invite-only while it is being piloted") means the address you used is not on the list. Try the address the invitation was sent to. Nothing was created and nothing was lost.
5. A message ending "The session has expired. Sign out and back in." means your sign-in on this device has lapsed. Press **Sign out (keeps data on this device)**, then sign in again. Signing out does not delete anything on this device.
6. To switch between the two forms, use **Make an account** or **I already have one** under the form.

An institution sign-in button ("Continue with" your school) appears only after your university has authorized its identity provider and Semester has verified the connection. No institution has this configured today (see [known limits](../../pilot/KNOWN-LIMITATIONS.md)). Multi-factor sign-in is planned, not built.

## Not your fault

- **The service is down or slow.** Sign-in, sync and shared features need the account service. Your plan, notes and deadlines live on your device and keep working ([degraded modes](../../DEGRADED-MODE-MAP.md)). Check the status page from the Help screen.
- **Your session ended.** The app says "You are not signed in any more." and "Everything on this device is still here."
- **Read-only mode.** A banner reads "Read-only mode: your changes stay on this device until it ends." Sign-in still works in this mode.
- **Email delivery.** Confirmation and reset mail depend on an email provider. If it is delayed, there is nothing to fix on your side.

## Contact

Support cannot see or set your password, and cannot sign you in. The reset link is the only route this page describes.

### What to send

- The exact words on the screen, and the Reference if one is shown (it looks like SEM-0000).
- Which button you pressed and which screen you were on.
- Your browser, and whether it is a phone or a computer.
- Whether you used a provider button or an email address and password.

### What not to send

- Your password, a reset link, a confirmation link or a one-time code.
- A student ID number, a screenshot of your school record, or anyone else's details.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Sign in", "Send a reset link", "Make an account", "I already have one", "Create the account", "Sign out (keeps data on this device)", "This build has no account service", "Enter your email address to continue.", "Enter your password to continue.", "Everything stays on this device. An account is optional.", "a reset link is on its way to it.", "Check your email for the confirmation link, then come back and sign in.", "Semester is invite-only while it is being piloted", "The session has expired. Sign out and back in.", "You are not signed in any more.", "Everything on this device is still here.", "Read-only mode: your changes stay on this device until it ends."] -->
