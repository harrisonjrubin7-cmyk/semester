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
