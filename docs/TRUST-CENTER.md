# Trust & Data Center: Phase N

**Flag:** `trust_center` (`VITE_TRUST_CENTER`). Off by default (D-012). With
it off, Your data and Me are unchanged. A test holds both, with flag-on
controls.

**Where:**

- **Me › You › Trust & data** opens **Your data** (`privacy`).
- The center sits at the top of that page, above what was already there:
  the privacy explanation, supporter access, the diagnostics export, account
  deletion and erasing this device.

**Server:** no change. **Decision:** D-057, which also resolves D-018.

## What the command asks, and how

| Command asks for | How |
|---|---|
| Connected sources | Account, school, course catalog and courses, each with its state; the catalog carries **Imported** with its time |
| Source labels | All five, each with what it means (`SOURCE_MEANING`) |
| Last sync | "Last synced …" from the account's last sync, or "Not synced from this device yet", or "not signed in. Everything stays on this device." |
| Permissions/scopes | Notification permission, and every live share with its scope (the advisor it is shared with) and expiry. Supporter access, with its own scopes, is on the same page |
| Imported materials | Sources saved, and the course catalog |
| AI source usage controls | How many materials are marked so AI never uses them (Source Locker, Phase H), and where to change it per material |
| Active advisor/supporter shares | Advisor shares (Phase G): live ones with expiry and **Revoke…**, and a count of earlier ones. Supporter access is below on the page; family and supporters are one tap away |
| Share expiration/revocation | Each live share shows "until {date}"; revoking confirms first and the list updates |
| Notification preferences | Permission state, plus **Choose which reminders** (`notifs`) |
| Data export | **Export my data** (`export`). The export now covers every device store |
| Account deletion | Below on the same page (`TypeToConfirm`), unchanged |
| Privacy explanation | The rest of the page, unchanged |
| AI history / delete outputs | Conversations with Semester (`lib/threads.ts`, archived ones included): how many and how many messages, and **Delete it…**, which removes those and nothing else. Guides, quizzes and documents you made are yours in Study and Write, and are deleted there |
| "What Semester remembers" editable memory | `aboutMe`, the lines the student typed: each with **Forget…**, plus **Add or edit in Profile**. Nothing is inferred |

## Export now covers every device store

- **D-018** found Export missing two stores. The phases after it added nine
  more.
- `lib/workspace-backup.ts` gains a `device` scope (a store keyed by its name
  alone). It now backs up:
  - registration;
  - registration day;
  - graduation;
  - life balance;
  - shortlist;
  - advisor meetings;
  - Source Locker;
  - study readiness;
  - career evidence (per term).
- **The guard is `workspace-backup.coverage.test.ts`.** It lists every file
  that calls `useDeviceLibrary` and how many times, and every store prefix
  as backed up or exempt with a sentence. A new store fails the test until
  somebody decides.
- **Exempt:**
  - the offline ledger, which is sync bookkeeping;
  - the stores other modules added, listed as waiting on their owners.

## Files

| New | Purpose |
|---|---|
| `components/TrustCenter.tsx` | The center |
| `lib/workspace-backup.coverage.test.ts` | The guard, and a round trip of the new stores |

| Changed | Change |
|---|---|
| `lib/workspace-backup.ts` | `device` scope; nine stores; `BACKED_UP_PREFIXES` |
| `screens/Privacy.tsx` | `trustCenter` prop (default: the flag); the center at the top, lazy-loaded |
| `screens/Me.tsx` | `trustCenter` prop; the **Trust & data** row |
| `styles/app.css` | `.trust-*` |

## Tests

| File | Covers |
|---|---|
| `components/TrustCenter.test.tsx` | Flag off: no center and no row, with flag-on controls, including the row opening Your data. The connected sources, labels and AI line. Revoke after a confirmation, with the list updating. Forget one line only after a confirmation. Delete the conversations, archive included, only after one, removing nothing else. Export one tap away |
| `lib/workspace-backup.coverage.test.ts` | The scanner finds the calls (the control). Every calling file is known. Every prefix is backed up or exempt, and nothing unnamed. The new stores round-trip |

**Revert checks.** Each guard was shown red against a revert and green on
restore:

- revoke, forget or delete without a confirmation;
- deleting everything instead of the conversation;
- forgetting every line;
- the flag ignored on Your data, and on Me;
- a store dropped from the backup;
- a new, unlisted store.

## Responsive manual-test checklist

- [x] 390 and 1280px, in Chromium: the center at the top of Your data. No
  overflow and no `pageerror`.
- [ ] Signed in against a preview with a live advisor share.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `trust_revoked` | A share revoked (count only) |
| `trust_forgot` | A remembered line forgotten (count only; never the text) |
| `trust_conversation_deleted` | The saved conversation deleted |

## Rollback

- **The center:** leave the flag unset (the default). The center and the
  row go.
- **The backup coverage:** not flagged, because it only adds to what Export
  includes. Reverting it returns Export to omitting those stores.
