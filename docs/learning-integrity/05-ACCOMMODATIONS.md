# 05 · Accommodations

Deliverable covered: **accommodation considerations** and the accommodation
requirements for assignments, assessments, gradebook and proctoring.

**Scope note.** This document specifies product behaviour. What an institution
is legally required to provide (ADA / Section 504, FERPA treatment of
accommodation records, accessibility-law conformance claims, jurisdictions
outside the US) is a legal conclusion for qualified counsel and the
institution's disability-services office, and is routed to
[`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md). Nothing here is a
statement of what the law requires.

## 1. Principles

1. **Disability services decides; the platform applies.** The authoritative
   determination of an accommodation comes from the institution's office. The
   platform never decides, infers, suggests or diagnoses.
2. **Effect, not reason.** Instructors and systems that apply an accommodation
   receive its *effect* ("1.5× time", "captioned media", "breaks of 10 minutes
   per hour") and never the underlying condition.
3. **The student controls who sees what.** Sharing is per instructor, per
   course, time-bound and revocable, and every read leaves an event the
   student can see.
4. **Never required for flexibility.** The platform offers some flexibility
   (no-questions extensions, universal access modes) that does not require
   registration or disclosure, so most students never need to explain
   themselves.
5. **Applied automatically.** A student with an approved accommodation should
   not have to remember to ask again for each assessment; the effect is applied
   to the window, the format and the tools by the system.
6. **Accommodation overrides integrity settings.** No AI policy, proctoring
   setting or time limit may remove an accommodation.
7. **Never used for prediction.** Accommodation data is excluded from every
   analytic, alert, recommendation and risk computation — held already as a
   prohibited measure: `lib/institution-ops.ts` and
   `lib/governance/module-privacy.ts` ("accommodation or basic-needs data in
   performance prediction").

## 2. What exists

`supabase/migrations/20260926150000_expansion_roles_and_features.sql` defines
`accommodation_passports` and `accommodation_shares`:

- A passport holds a **free-text functional summary** (1–1000 characters,
  "never a diagnosis"), issued by disability services (capability
  `accommodation:verify`), with `verified_at`, `expires_at` (at most 400 days),
  and `revoked_at`.
- A student reads their own passport; they cannot issue one; disability
  services can issue and amend.
- A share links a passport to one faculty member for one course, for at most
  200 days, revocable by the student. The header comment says instructors read
  through `read_shared_accommodation`, "which writes an access event the
  student can see."
- The register records these as "never applied to anything yet"
  (`LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md`, L08).

`app/src/lib/accessmode.ts` provides user-chosen access modes, "never
inferred", with no code path from behaviour to the mode.

**The gap is the middle**: the passport is a sentence a human reads; nothing
turns it into a behaviour the system applies. An instructor reading "extended
time 1.5×" and re-keying it into a quiz setting is the failure mode this
document exists to remove.

## 3. The accommodation-effect model (proposed)

Keep the passport as the issued, authoritative document; add a structured
**effects** record that disability services sets when issuing it. The effect is
what systems consume.

| Effect | Parameters | Consumed by | Instructor sees |
| --- | --- | --- | --- |
| Extended time | multiplier, or fixed minutes added | assessment delivery (window length), proctoring integration | "Extended time applies (×1.5)" |
| Extended deadline | days per assignment type, or a ceiling | assignment settings, late policy | "Deadline extension applies (up to N days)" |
| Rest breaks | minutes per hour, clock stops or not | assessment delivery, proctoring | "Breaks apply" |
| Alternative format | captions, transcripts, accessible PDF/EPUB, large print, screen-reader-ready, alt text required | content delivery, quiz delivery | "Alternative formats apply" |
| Assistive technology permitted | read-aloud, dictation, screen reader, magnification, text-to-speech, word prediction | policy engine (assistive class, [03 §6](03-AI-TUTORING-AND-BOUNDARIES.md)), proctoring | "Assistive technology applies" |
| Reduced-distraction setting | one question at a time, no timers displayed, etc. | assessment delivery | "Delivery setting applies" |
| Separate or private setting | alternative venue/room (in-person) | institutional scheduling | "Alternative setting applies" |
| Alternative assessment mode | oral, written, extended-project substitute | assessment builder | "Alternative mode applies" |
| Attendance / participation flexibility | rules per course | course policy | "Participation flexibility applies" |
| Note-taker / materials access | designated | course | "Materials access applies" |

Each effect carries its own start and end, issuing office, and a
**human-readable explanation to the student** of what changes for them. The
`summary` text remains for the student and disability-services use and is not
shown to instructors by default.

### Requirements

| ID | Requirement | Today |
| --- | --- | --- |
| LI-ACC-01 | A passport has a structured effects set (type, parameters, dates) alongside the summary; effect types are a closed list the platform validates. | Absent (summary text only) |
| LI-ACC-02 | Assessment delivery applies time, break, format and setting effects automatically and records, on the attempt, which effects were applied. | Absent (register: "Accommodation-aware timing and availability" unchecked) |
| LI-ACC-03 | The assignment/late-policy engine applies deadline effects; the student sees their effective deadline, and the instructor sees the effect (not the reason). | Absent |
| LI-ACC-04 | The policy engine treats the assistive-technology effect as always permitted regardless of course AI policy, and permits assistive-class uses for **everyone** ([03 §6](03-AI-TUTORING-AND-BOUNDARIES.md)). | Absent |
| LI-ACC-05 | Instructors read only the *effects* shared by the student, through an access path that writes an event the student can see; they cannot read the summary unless the student shared it. | Partial: designed in the migration header (`read_shared_accommodation`); not wired; summary-versus-effect split absent |
| LI-ACC-06 | Share, revoke and expiry are visible to the student in one list; a revoked or expired share removes the instructor's access and the system falls back to *the student asking for the effect to be applied to a specific assessment* — never to a silent loss of the accommodation. | Partial: table constraints exist; no UI evidenced |
| LI-ACC-07 | If a student has an approved accommodation and has **not** shared it with a course, the *student* can still apply the effect to their own attempt (e.g. extra time) without the instructor learning why; the instructor sees "extended time applied" and may request verification through disability services, not from the student. | Absent |
| LI-ACC-08 | No accommodation or share record is read by any analytics, recommendation, alert, support-prioritisation, integrity or risk path. A test lists every consumer of the tables and fails on an unknown reader. | Partial: prohibited as a measure (`institution-ops.test.ts`); no reader-allowlist test on the tables |
| LI-ACC-09 | The access modes (`accessmode.ts`) remain student-chosen and never inferred; the system never *suggests* an accommodation based on behaviour. | Held: `lib/accessmode.ts` |
| LI-ACC-10 | **No-questions flexibility:** the course can offer N extensions per term that any student may take without a reason; the count and rules are published in the policy card. | Absent |
| LI-ACC-11 | **Requests**: a student without a passport can start a request to disability services from within the platform; its status is visible to them; pending status never blocks them from using universal modes. | Absent |
| LI-ACC-12 | **Proctoring and match tools receive effects only** and are configured from them, not from the passport summary ([04 LI-PRC-07](04-ACADEMIC-INTEGRITY-CONTROLS.md)). | Absent |
| LI-ACC-13 | **Expiry is humane**: a passport nearing expiry warns the student and disability services; an expiry mid-assessment never removes an effect from the attempt in progress. | Absent |
| LI-ACC-14 | **Audit**: issuance, amendment, share, read, apply, revoke and expiry are append-only events; the student can export their own access log. | Partial: access events specified for reads; others not evidenced |

## 4. Accommodation interactions to test explicitly

| Scenario | Required outcome |
| --- | --- |
| Course bans generative AI; student has read-aloud and dictation effect | Read-aloud and dictation work; tutor generative modes remain off for the assessed task |
| Course bans generative AI; student with **no** passport uses read-aloud | Works — assistive class is never blockable |
| Timed quiz with ×1.5 effect, window closes for others | Attempt window is extended for this student; late-policy engine does not penalise |
| Proctored exam with breaks effect | Service configured with break allowance; no "left the frame" flag during a break |
| Share expires on day 200 mid-term | Instructor loses read access; effect still applies to the student's attempts if the passport is valid; student notified |
| Student revokes share the day before an exam | The student, not the instructor, can still apply the effect (LI-ACC-07); the instructor sees "applied" with no reason |
| Instructor tries to read the passport summary | Refused unless the student shared the summary; refusal is logged |
| Analytics query joins attempts to effects | Query refused (LI-ACC-08) |

## 5. Items for disability services and counsel (not decided here)

| # | Question | Owner |
| --- | --- | --- |
| AC-1 | Is the closed effect list (§3) sufficient for the first institution, or does it need institution-specific extensions? | Disability services |
| AC-2 | Should instructors ever see the summary text, and who authorises that? | Disability services + counsel |
| AC-3 | How are accommodation records classified, retained and deleted at the institution (FERPA / equivalent treatment)? | Counsel |
| AC-4 | May a student apply an effect without sharing (LI-ACC-07), or must the institution verify each time? | Disability services |
| AC-5 | Which accessibility conformance statements may be made about Semester and on what evidence? | Counsel + accessibility specialist; see [`docs/accessibility/AT-PASS-PROTOCOL.md`](../accessibility/AT-PASS-PROTOCOL.md) |
| AC-6 | How are non-disability flexibilities (illness, caring responsibilities, religious observance, military duty, emergencies) handled so they do not have to be routed through disability services? | Registrar / student affairs |
