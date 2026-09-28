# Community privacy model

Code: `app/src/community/identity.ts`, `pii.ts`, `metadata.ts`, `alias.ts`.

## Three identities

| Layer | Holds | Who sees it |
| --- | --- | --- |
| Verification | Legal name, institution email, student ID if the institution's flow requires it | Nobody in Community. It lives in the identity vault and is referenced as `vaultRef` |
| Account | Opaque `sem_` + 26 random base32 characters, the tenant, verification state and expiry | Authorization, moderation and audit. Never peers |
| Presentation | Preferred name and pronouns, or an alias inside one approved community | Peers, through a per-community `ref` (`communityRef`) |

Peer payloads are built with `allowlisted`, never by deleting known-bad fields.
The `identityLeaks` scan (`FORBIDDEN_FIELDS`) is a tripwire behind that
allowlist.

## Data minimization

| Data | Rule |
| --- | --- |
| Legal name, institution email | Identity vault only. Revalidate from SSO claims rather than persist, where possible |
| Student ID | Avoided unless verification requires it. Never a display identifier |
| Student status | State and expiry only (`isVerified`) |
| GPS, housing, address | Never collected for Community |
| Schedule | Never read. Matching uses coarse availability the student typed in (`AvailabilitySlot`) |
| Reporter identity | Professional store only. Never in the blind view or the student notice |
| Safety state | Staff-only, behind a flag, never a ranking input |

## Who can see restricted identity

- **Peers** see presentation identity.
- **Volunteers** see the blind case view: category, severity and status. They
  never see a name, email, student ID, reporter, GPS or social graph.
- **Professionals** see a vault reference only with a just-in-time grant. The
  grant must be for this case and this reviewer, approved by someone else,
  carry a written reason, and be unexpired. Every attempt is audited, granted
  or refused.
- **Behind an alias,** that grant is `request_alias_identity` and
  `decide_alias_identity` in the database: for one case, one reviewer and four
  hours. Every look is a case event (`PSEUDONYMITY-POLICY.md`).
- **Liaisons and admins** have no standing access. Platform administration
  grants no identity access.

## Anti-doxxing

1. **Before posting**, `prePostCheck` looks for phone numbers, emails, street
   addresses, coordinates, tenant-shaped student IDs, rooms and residences,
   and exact day-and-time patterns. A high-confidence hit requires an edit or
   an explicit "this is mine". A medium-confidence hit shows a warning.
2. **On upload**, `stripMetadata` rewrites JPEG, PNG and WebP files without
   EXIF, XMP, text chunks or comments. Anything else is refused.
3. **After posting**, a high-confidence `pii_doxxing` signal or a
   `private_information_or_doxxing` report puts a temporary hold on the post
   and routes it to urgent professional review.
4. **In search**, the index is built only from presentation fields. Support
   community membership is never visible (`membershipVisibleTo`).

## The account safety state

Semester has no karma. The one running number it can keep about a Community
account is the private safety state (`safety-state.ts`;
`community_safety_entries` in the database). It is off unless both the
`VITE_ACCOUNT_SAFETY_STATE` build flag and the school's `community_programs`
row for `account_safety_state` are on.

- **What moves it.** Only a professional reviewer's decision that enforces
  something: P0 −40, P1 −20, P2 −8. Nothing at P3. Never an "allow", a
  report count, a detector or a volunteer.
- **What undoes it.** A granted appeal marks the entry reversed; the entry
  stays for the audit trail but no longer counts. After a year the sweep
  deletes it.
- **Who sees it.** No role reads the table through the API. A reviewer
  calls `case_author_safety` for one case's author with a written reason,
  and every read is a case event. The student calls `my_community_standing`
  and gets one of two sentences, never the number. Nobody else gets anything.
- **What it is never used for.** Ranking, search, academics, aid, admissions,
  housing, work or advising. No other function reads the table.

In the app, the reviewer's read is `components/community/SafetyRead.tsx`,
closed until opened and never kept after the card closes. The student's
sentence appears in Community under "Your standing". Both need the build flag
and the school's switch.

