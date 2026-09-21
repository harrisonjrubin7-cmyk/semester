# 0006 · One ranker for search, extended rather than duplicated

**Status:** Accepted.

## Decision

`lib/find.ts` is the only search. It covers deadlines, courses, study units,
notes, tasks, appointments, documents, sheets, decks — **and the app's own 59
screens**, so "sync" reaches Account without anybody knowing that Account is
where syncing lives. `lib/desk.ts` ranks.

New entity kinds (people, organisations, events, listings) are added to that
ranker. They do not get a search of their own.

## Why

Because the alternative was measured and it was bad. Search used to cover
deadlines and nothing else, which meant the app knew far more than it would
admit: "monopoly" returned nothing though a unit by that name had nine cards in
it; "gmail" returned nothing though there was a screen for exactly that. **A
search that silently covers a tenth of the app teaches people not to search**,
and then everything has to be found by remembering where it was put.

§3 of the transformation command says "do not duplicate search logic across
pages" for the same reason. The way to obey that here is to extend the ranker
that already exists.

## Why the ranking is dull on purpose

A match at the start of a name beats one in the middle, which beats one in body
text. People scan the first three results; being obvious matters more than being
clever.

## Two faults recorded, because both would recur in a second implementation

1. **A phrase whose words sit apart scored zero everywhere.** All four ranking
   tiers asked about the query as one unbroken run, so `study guide` — the thing
   this app is best at — returned "No app matches that", because Study's label
   says *study* and its keywords say *guide*, never adjacently.
2. **The fix's first test passed against the unfixed matcher.** `guide study`
   scored because the space joining two fields spelled the phrase out at the
   seam. The seam is a newline now, and a control asserts that no field pair's
   junction can be matched as a phrase.

That second one is the argument for one ranker rather than two: the seam bug is
invisible unless something is explicitly looking for it, and a second search
implementation would not be.

## What this constrains

Phase 3 is an extension, not a new subsystem. The entity kinds get added to the
registry the ranker and the sweeps both read, so instrument and app cannot drift
— which is the same reason `scripts/destinations.mjs` exists.
