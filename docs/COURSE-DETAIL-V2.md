# Course Detail V2: Phase F

**Flag:** `course_detail_v2` (`VITE_COURSE_DETAIL_V2`). Off by default (D-012).
With it off, the registration workspace's side panel is exactly as before, and
a test holds that.

**Destination:** My Path → `yes` › Term plan › Course search. A result
opens the page as:

- **Under 1180px, a modal sheet.** Escape and Close return focus to the result.
- **From 1180px, a drawer on the right.** It is not modal, so the list stays
  usable and another result replaces the drawer.

The Search drawer and a `course/:id` route are later entry points (D-040).

**Builds on:**

- The imported institution catalog (`lib/registration.ts`, `RegistrationPortal`).
- My Path's requirements and recorded courses (`lib/degree.ts`).
- The registration cart and credit target (Phase C).
- Commitments.
- The Career skills graph (`lib/skills-graph.ts`) and saved opportunities.

## Sections

In order, each with its source label:

| Section | Source | What it says |
|---|---|---|
| Header | Imported, with age | Code · section · term, title. "From the catalog you imported"; over two months old says to check the official catalog |
| Facts | Imported | Credits, modality ("Not stated in the catalog" when absent), meetings, instructor, location, seats as "reported in the catalog file … not live availability, and not a seat for you" |
| Actions | — | **Save**, **Compare** (saved courses only, up to three), **Add to cart…** / **Remove from cart…** (preview first), **Official catalog…** (external hand-off first; shown only when the catalog carries an https link) |
| Why it may fit | Estimated | Reasons from the facts below: may count toward a requirement, no overlaps, prerequisites recorded, within the credit target. Folded: what it can't tell you, and other options |
| Requirement fit | Estimated | Requirements on My Path that accept the course and still need something, electives last. "May count. Only your school's degree audit decides." |
| Prerequisites and corequisites | Imported (wording), Student entered (records) | The catalog's words verbatim. Each code: recorded, in progress, in the cart (corequisites), or not recorded ("Check with the department"). Other conditions are flagged, not read. Never "eligible" |
| Schedule fit | Estimated | Overlaps with cart sections (Imported) and timed commitments (Student entered). Another section of the same course is a swap, not a clash |
| Plan impact | Estimated | Cart credits before → after, against the credit target when set. Warns when another section of the course is already in the cart |
| Description | Imported | As supplied |
| Skills and career directions | Estimated | Skills the description's own words name. The student's own saved Career opportunities that ask for them. "Not a claim about what you will learn" |
| Related future courses | Imported | Catalog courses that list this one as a prerequisite, one per code. Each opens its own page |
| Coming later | — | Moderated student insights (with "Semester shows no professor ratings"), faculty-approved study pack, syllabus links. Nothing is estimated in their place |

**Saved courses** appear above the results.

- **Compare** puts up to three side by side:
  - from 760px, a table with course column headers;
  - on a phone, one list per course.
- **Rows:** credits, meetings, prerequisites recorded, may count toward,
  overlaps, and seats from the file.
- "No course is ranked."

## Catalog fields

Two optional columns are added to the import, JSON or CSV:

- **`modality`:** free text, up to 40 characters.
- **`url`:** the official course page. **https only**; anything else is
  dropped on import.

The template carries both. Catalogs without them read as before.

## What it never does

- Decide eligibility, promise a seat, or claim a workload.
- Show professor ratings or unmoderated reviews.
- Register anyone. The cart is a draft on this device, and the confirmation
  says so.
- Invent a career. Directions are only opportunities the student saved.
- Rank courses.

## Data

- **Read:**
  - the registration store (`semester.registration.v1`);
  - the registration-day store (credit target);
  - the store's requirements, courses taken and commitments;
  - the term's Career library.
- **Written:**
  - the cart, only after confirmation;
  - `semester.course-shortlist.v1` (`{ saved ≤ 30, compare ≤ 3 }`), on this
    device only.
- **Not touched:** no table, migration or network call.

## Files

| New | Purpose |
|---|---|
| `lib/course-detail.ts` | `readRequisites`, `requisites`, `requirementFit`, `scheduleFit`, `planImpact`, `relatedFuture`, `describedSkills`, `careerDirections`, `catalogAge`, `seatLine`, `whyItMayFit`, the shortlist |
| `components/CourseDetailV2.tsx` | The page, as a sheet or a drawer, with its confirmations |
| `components/CourseCompare.tsx` | Saved courses and the comparison |

| Changed | Change |
|---|---|
| `lib/registration.ts` | Optional `url` (https only) and `modality`; template |
| `components/RegistrationPortal.tsx` | `courseDetail` prop (default: the flag); V2 in place of the side panel; compare above the results; CSV help |
| `styles/app.css` | `.course-v2*`, `.course-drawer`, `.course-compare*` |

## Tests

| File | Covers |
|---|---|
| `lib/course-detail.test.ts` | **Prerequisites:** codes read and corequisites split; each compared with records, never "eligible"; unreadable conditions flagged. **Fit:** requirement fit, electives last and met ones left out; schedule fit with the cart and commitments, and a same-course section is a swap. **Plan impact:** against the target, and a duplicate course. **Related courses:** once per code. **Skills and careers:** skills only from the wording; careers only from saved opportunities. **Sources:** catalog age; seats never promised; https-only links and modality. **Why it may fit:** reasons, limitations, no promises. **Shortlist:** caps and the reader |
| `components/CourseDetailV2.test.tsx` | Flag off is the old panel. **Phone sheet:** every section in order, source labels, facts, prerequisite states, related course, no ratings, no promises. **Add to cart:** only after the preview, with focus on Cancel. **Clash:** with the cart. **Official catalog:** only after the external notice. **Desktop:** a drawer, replaced by another result. **Compare:** save, then compare in a table without ranking |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- Adding before the confirmation.
- The portal ignoring the flag.
- In-progress read as recorded.
- No corequisite split.
- A seat promise.
- Opening the catalog before the confirmation.
- Any URL accepted.
- Met requirements kept.
- Related courses not de-duplicated.

## Responsive manual-test checklist

Checked in Chromium with the flag on, a three-section catalog, one course in
the cart, a requirement, one recorded course and two saved courses:

- [x] 390px: the sheet opens on a result. Facts, actions and every section fit.
  Escape closes it.
- [x] 1280px: the drawer docks on the right, and the list stays usable.
- [x] Add to cart… previews credits, with focus on Cancel.
- [x] 390px compare: stacked lists. 1280px: a table.
- [x] No horizontal overflow (measured), no `pageerror`.
- [ ] Parchment (light) ground; VoiceOver / NVDA.
- [ ] The drawer covers the right of the result list at 1280px. The list is
  still usable, and a wider screen shows both.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `course_detail_opened` | A result opened (`width`: sheet or drawer) |
| `course_saved` / `_unsaved` | Save toggled |
| `course_compared` | Two or more compared |
| `course_cart_added` / `_removed` | After confirmation |
| `course_catalog_opened` | After the external confirmation; never the URL |

## Rollback

- **The feature.** Leave the flag unset (the default), and the side panel is
  back.
- **The data.**
  - The shortlist stays on the device, unread.
  - Catalogs imported with `url` or `modality` keep those fields, which the
    old panel ignores.
- Nothing is on the server to undo.
