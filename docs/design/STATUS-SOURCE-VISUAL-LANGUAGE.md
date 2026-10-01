# Status and source visual language

Decoration never looks like state. Colour reinforces a word and glyph; it
never carries meaning alone.

## State tones

| Meaning | Treatment | Use |
|---|---|---|
| Informational / student-entered | Slate/neutral word and border | Context, personal input, optional information |
| Suggested / estimated | Brass word and outline | A recommendation or assumption that needs judgment |
| Verified / complete / healthy | Sage word and glyph | Confirmed source, saved or complete state |
| Needs review / stale | Muted warning plus missing fact and action | Uncertain or old data |
| Blocked / failed | Rose/error word, explicit impact and recovery | Consequential failure |
| Inactive / unavailable | Gray plus the reason | Disabled, archived or policy-restricted state |

## Provenance words

`app/src/lib/source.ts` is the source of truth. UI uses
`app/src/components/SourceBadge.tsx`; it does not invent another badge.

- **Institution verified** — source and timestamp are available.
- **Imported** — came from a connected or uploaded source.
- **Student entered** — editable personal information, not an official record.
- **Estimated** — assumptions are visible and editable.
- **Needs review** — says what is missing and links to a source or fallback.
- **AI assisted** — sources, limitations and correction controls remain visible.
- **External** — names the owner and warns before leaving Semester when needed.

Freshness is text: updated time, update time not recorded, out of date, or
official confirmation pending. A generic `info` label is not enough.

## Placement

Put source and certainty beside the decision they qualify. Layer 1 keeps the
short label; Layer 2 shows owner, timestamp, assumptions and exact source
anchor; Layer 3 holds history, excerpts and the original document.

Save/sync state uses `app/src/components/unity/Status.tsx` near the object.
Short inline confirmations replace celebratory popups. Toasts are reserved for
the result of a deliberate action and never substitute for persistent state.

## Tests

`app/src/a11y/tellings.test.ts` rejects color-only communication.
`app/src/lib/contrast.test.ts` checks every ground. Status wording is defined
by `app/src/lib/status.ts` and guarded by `app/src/lib/unity.test.ts`.
