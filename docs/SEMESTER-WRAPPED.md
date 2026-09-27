# Semester Wrapped: Phase L

**Flag:** `semester_wrapped` (`VITE_SEMESTER_WRAPPED`). Off by default
(D-012). With it off, Me is unchanged; a test holds this, with a flag-on
control.

**Destination:** Me → `me` › **You**, as a card at the top.

**Server:** no change. **Decision:** D-054.

> *Private to you*
> **Your Fall 2026 in Semester**
> Aug 1 – Nov 30, 2026. Made on this device from your own records — what you planned, finished and wrote. Not from how often you opened the app, and nothing from your school.
> • 2 semester plans saved • 14 study sessions finished • 3 advisor agendas prepared • 1 portfolio project recorded • 4 campus events saved
> **You moved forward by:** • Ticking off 12 deadlines • Finishing 5 next steps you chose • Completing 1 course on your record
> [Plan Spring 2027] [Export my progress…] [Save as image…] [Share…]

## What the command asks, and how

| Command asks for | How |
|---|---|
| Private, student-owned recap | Worked out on the device from the student's own stores each time the card is shown. Nothing is stored or sent. The card says "Private to you" |
| Private by default, explicit share only | Export, image and share each open a confirmation. It shows the exact text and says where it goes. Share appears only where the device has a share sheet |
| No social leaderboard | No other student's data exists on the device, and nothing compares. A test checks every sentence it can produce |
| No pressure or streak shame | Zeros are left out. A quiet term is "fine". There is no streak, rank or "could have" |
| Do not expose institution data | No office action, demand count, seat, catalog figure or grade point is read. The export holds counts and the term only |
| Generate from student-owned action history and study data | Phase B's Action Center choices (completed steps); study sessions; ticked deadlines; plus the registration, advisor (Phase G) and career evidence (Phase I) stores |
| `semester_wrapped` flag | `Me({ semesterWrapped })`, defaulting to the flag |
| Shareable client-side image/export only after confirmation | Text file, or a PNG drawn on a canvas. Each goes through `ConfirmDialog`, with focus on Cancel |
| Tests for privacy scope | Below |

**Never counted:** screens visited, recent screens, `countScreens`, or
`lib/usage.ts`. Opening an app is not an achievement (D-005, rule 7).

## Files

| New | Purpose |
|---|---|
| `lib/wrapped.ts` | `termWindow`, `nextTerm`, `wrapped`, `wrappedText` |
| `components/SemesterWrapped.tsx` | The card: a term picker, the counts, Plan next term, and export/image/share |

| Changed | Change |
|---|---|
| `screens/Me.tsx` | `semesterWrapped` prop (default: the flag); the card, lazy-loaded, on You |
| `styles/app.css` | `.wrapped*` |

## Tests

| File | Covers |
|---|---|
| `lib/wrapped.test.ts` | **The term:** window and next term. **What counts:** only inside the term; only finished or made, not snoozed or drafts; the wording. Zeros left out; a quiet term is fine. No streak, rank or comparison in any sentence. Usage is not an input. **The export:** counts and the term only — no course code, title, agenda text or date, even when the records hold them |
| `components/SemesterWrapped.test.tsx` | Flag off: no card (with a flag-on control). The student's own counts. Export only after showing the exact text, with focus on Cancel. The image falls back honestly without a canvas. Share only after confirmation, with exactly the text. No share button where the device has none. The same card however much the app was used. Another account's Action Center is not counted, and this device's is |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- export or share without a confirmation;
- zeros shown;
- counts from outside the term;
- a usage line;
- the flag ignored;
- no image fallback;
- snoozed actions counted;
- draft bullets counted.

## Responsive manual-test checklist

- [x] 390 and 1280px, in Chromium: the card on Me › You, and the export
  confirmation. No overflow and no `pageerror`.
- [ ] Parchment (light) ground; VoiceOver / NVDA.
- [ ] The PNG on a real phone's share sheet.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `wrapped_exported` | After the confirmation (`format`: text, image or share); never the contents |

## Rollback

Leave the flag unset (the default). There is no stored data and no server
change, so nothing else is left behind.
