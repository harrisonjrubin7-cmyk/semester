# My calendar isn't updating

> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when a calendar you subscribed to looks stale, a calendar link is refused, or deadlines you sent to Google or Microsoft are duplicated; stop reading if the problem is a deadline that is wrong in Semester itself, which is [the syllabus page](syllabus-did-not-parse.md).

**Status:** LIVE for calendars you add yourself (a link or an .ics file). No school calendar or system connection is live for any institution ([known limits](../../pilot/KNOWN-LIMITATIONS.md)).

## Symptom

You say one of these:

- "I added my Brightspace calendar and it has not changed since."
- "It says the address is a web page, not a calendar."
- "The calendar says it could not be reached."
- "I sent my deadlines to Google twice and now there are two of everything."
- "A calendar event is missing, or an event replaced my deadline."

## Check

1. Open **Connect accounts** and find **Connected calendars**. Each row says when it was last read: "never checked", "checked today", "checked yesterday" or "checked N days ago".
2. In the code this page was written from, Semester reads a subscribed calendar when you add it with **Subscribe** and when you press **REFRESH** on its row. Nothing re-reads it in the background. A calendar that is days old has not been refreshed.
3. A calendar you added as a file has no REFRESH button, because there is nowhere to read it from again. Add the new file; adding the same calendar again refreshes it rather than duplicating it.
4. Feed events appear on **Calendar** under Campus, marked with where they came from. They never overwrite a deadline the syllabus stated.

## Fix

1. Open **Connect accounts**, then **Connected calendars**, and press **REFRESH** on the calendar. The note under it says how many events were read.
2. If the message says the address answered with a web page, you pasted the page you read the calendar on, not the feed. The app says: "That address answered with a web page rather than a calendar". Use the .ics or webcal link: in Brightspace it is Calendar, then Subscribe.
3. If the message says "The browser could not reach that calendar directly", most calendar servers refuse to be read by a web page. Download the calendar as a file and use **Add an .ics file**.
4. If the row says "could not be reached", check the link still works in a browser, then press **REFRESH** again. If your school changed the link, use **REMOVE**, then paste the new one into **Calendar link** under **Paste a calendar link** and press **Subscribe**.
5. A calendar that "was read, but there is nothing dated in it." is usually the wrong one of several calendars, not an empty term. Pick another calendar from the same source.
6. Sending to Google or Microsoft: the buttons "These add rather than sync". Running one twice makes duplicates, and nothing there removes anything. Delete the duplicates in Google or Microsoft yourself, and press each button once.

## Not your fault

- **The link was replaced at the source.** The link carries your access. A link replaced by your school may stop answering, and the row then says it could not be reached.
- **The calendar host blocks browsers.** The app tries the host directly, then through a forwarder. Some hosts refuse both.
- **You are offline.** The Account screen says "No connection. Everything here is saved on this device, and it will sync when the connection is back." Your saved calendar stays as it was last read.
- **The service is down.** Check the status page from the Help screen.

## Contact

### What to send

- The row's last-read wording ("checked yesterday") and the message under it.
- Which calendar app the link came from (Brightspace, Outlook, Google, Canvas, Zoom, Apple).
- Whether you used a link or a file, and whether REFRESH is shown.
- The Reference if one is shown (SEM-0000).

### What not to send

- **The calendar link itself.** It carries your access, so anyone with it can read your calendar. Say which service it came from instead.
- A screenshot that shows the link, a token, or other people's events.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Connect accounts", "Connected calendars", "Paste a calendar link", "Calendar link", "Subscribe", "REFRESH", "REMOVE", "Add an .ics file", "That address answered with a web page rather than a calendar", "The browser could not reach that calendar directly", "could not be reached", "was read, but there is nothing dated in it.", "never checked", "checked today", "checked yesterday", "These add rather than sync", "They never overwrite a deadline the syllabus stated.", "No connection. Everything here is saved on this device, and it will sync when the connection is back."] -->
