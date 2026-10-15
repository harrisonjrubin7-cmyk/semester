# Bring in a calendar

> **Type:** help · **Audience:** students · **Owner:** `product` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/help.test.ts`

Use this page to show the dates from another calendar beside your classes; stop reading if you want grades or submissions, which a calendar link does not carry.

## What you need first

- A calendar link from the other service, or a downloaded `.ics` file. Most calendar services publish one.
- In Brightspace, open Calendar, click Subscribe and copy the link. The link already carries your access.

## Steps

1. Open **Connect accounts**.
2. Under **Calendars**, find **Paste a calendar link**. Paste the link and choose **Subscribe**. A `webcal://` link works, and so does one with `https://` missing.
3. Or choose **Add an .ics file** and pick one or more downloaded files. You can also drag them onto the card.
4. Open **Calendar** to see the new dates ([Use the calendar](use-the-calendar.md)).

## What you will see

- The other calendar's dates sit on the same days as your classes, kept apart and labelled with their source.
- Adding the same calendar again refreshes it instead of duplicating it.
- A calendar link carries dates only. It never says whether you submitted anything.

## If it does not work

- Grades, submissions and files from Brightspace are not available. Those need a registration by your university, which a student cannot do alone. The app reads the dates and links you to each course page.
- A link fails: check that you copied the whole link, then try **Add an .ics file** instead. A downloaded file needs no network.
- Dates look out of date: add the same link again to refresh it.
- See [When something is missing or wrong](when-something-is-missing.md).

## Where your data goes

A calendar link is fetched to read its dates, and the feed is saved with your semester. The link carries your access, so treat it like a password. The app only reads the calendar and writes nothing back. See [Back up, sync and what stays on your device](back-up-and-sync.md).

<!-- live: Plan: calendar -->
<!-- labels: Connect accounts | Calendars | Paste a calendar link | Subscribe | Add an .ics file | Calendar -->
