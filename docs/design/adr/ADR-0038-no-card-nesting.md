# ADR-0038 · Eliminate card nesting and decorative dashboard clutter

Status: **Proposed** (2026-10-04, phase D0). Cannot be measured statically; needs a render audit.

## Context

Cards should group decisions, with a hairline border, 16px padding and no shadow. Card-in-card could not be verified from source; Today is 2,146 lines with cards; 69 box-shadow declarations include ordinary cards.

## Proposed decision

ObjectCard is the only card for a decision. No card inside a card; no shadow on ordinary cards; Today leads with agenda, deadlines and required actions and states why each item appears. A DOM test (Playwright over the gallery and key screens) fails on a card ancestor of a card.

## Consequences

Needs the D5 render harness before it can be enforced; until then it is a review rule. Removes shadows from .desk-panel, .today-dominant-card, .action-panel-primary and similar.

## Evidence

docs/design/VISUAL_DEBT_REGISTER.md VD-017.

## Not decided here

Which Today modules are removed rather than restyled.
