# My syllabus didn't parse, or the dates look wrong

> **Type:** help · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when Add a course fails, builds a course with missing dates, or shows a date you do not recognise; stop reading if you only want to type a course in yourself, because Add it by hand needs none of this.

**Status:** PARTIAL. Reading a document uses an AI model and needs a key or a signed-in account. Adding a course by hand does not. See [known limits](../../pilot/KNOWN-LIMITATIONS.md).

## Symptom

You say one of these:

- "I uploaded my syllabus and nothing happened."
- "It says nothing readable came out."
- "The course is there but a deadline is missing."
- "A date is wrong, or it is in the wrong year."
- "I changed my syllabus and want the new dates."

## Check

1. Open **Add a course** and read the message on the screen. The wording tells you which of the following you have.
2. "Nothing readable came out of that. Paste the text in instead." means no text could be read from the files you chose.
3. A scanned PDF is a picture of text. The app says so: "A scanned PDF is a picture of text — it needs to be run through OCR first, or pasted in by hand." If most of a file is images, it says "Most of this file is probably scanned images. Photograph the pages instead, or paste their text."
4. A line that begins "Left out:" lists files the app refused, with a reason for each. Choosing them again refuses them again.
5. "The course was not built" is a failure after the files were read. That step uses the AI model; see [the assistant is unavailable](ai-unavailable.md).
6. Is a key missing? "No key yet. Sign in to use the shared one, or add your own under Settings." appears when nothing can read the document.

## Fix

1. Choose files with **Choose files — PDF, Word, slides, text, or a zip**, or drag them onto the box. If a file is a scan, use **Photograph the syllabus**, or copy the text out of the file and paste it into the text box.
2. If you see **Try building it again**, press it once the cause (connection or AI) is cleared. A message with no retry button means pressing again would fail the same way, so change the input first.
3. Review before you add. The section **The dates it found** lists each date with its source excerpt. Where the app has none, it says "No source excerpt supplied. Check this date in the original syllabus."
4. To correct a date, open **Edit title or date** on that row and change the Title or Date. If your syllabus gave no year, the Date field starts from the current year, so check the year.
5. Tick "I checked the course information and selected dates against my syllabus. Add only the dates I approved." The page says: "Review the dates above before adding this course. Reminders begin only after you approve and save."
6. A deadline that is missing: add it by hand with **Add it by hand**, or put the missing text in the box and build again.
7. If your instructor changed the syllabus, import the new one. The review shows what changed under **Gone from the new syllabus** and **Reworded, same date**, and says: "Your ticks and your drill history stay where they are."
8. Nothing worked: **Add it by hand** needs no AI and no key.

The dates Semester shows came from what you gave it. The official source for a deadline is your syllabus and your school's own system. Semester is not connected to your school's systems ([known limits](../../pilot/KNOWN-LIMITATIONS.md)).

## Not your fault

- **The AI service is off or limited.** The shared key can be switched off, can be at its monthly limit, or can be stopped by a kill switch. The messages are in [the assistant is unavailable](ai-unavailable.md). Your files are not lost.
- **The app is offline or out of date.** An offline device shows "This screen has not been downloaded." for a screen it never opened. A stale tab shows "Reload to pick up the new version." See [the app shows an old version](old-version-showing.md).
- **Scanned or image-only slides.** Their pictures are not in the course that gets built. The app says so when it happens.

## Contact

### What to send

- Which message you saw, word for word.
- The file type (PDF, Word, slides, photographs, pasted text) and roughly how long it is.
- Which date is wrong, what the syllabus says, and what Semester shows. Quote one line of the syllabus, not the whole file.
- The Reference if one is shown (SEM-0000).

### What not to send

- The whole syllabus or readings if a short quote answers the question.
- Anything with other students' names or grades, or your student ID number.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Add a course", "Choose files — PDF, Word, slides, text, or a zip", "Photograph the syllabus", "Nothing readable came out of that. Paste the text in instead.", "A scanned PDF is a picture of text — it needs to be run through OCR first, or pasted in by hand.", "Most of this file is probably scanned images. Photograph the pages instead, or paste their text.", "Left out:", "The course was not built", "Try building it again", "No key yet. Sign in to use the shared one, or add your own under Settings.", "The dates it found", "No source excerpt supplied. Check this date in the original syllabus.", "Edit title or date", "I checked the course information and selected dates against my syllabus. Add only the dates I approved.", "Review the dates above before adding this course. Reminders begin only after you approve and save.", "Add it by hand", "Gone from the new syllabus", "Reworded, same date", "Your ticks and your drill history stay where they are.", "This screen has not been downloaded.", "Reload to pick up the new version."] -->
