# ADR-0031 · Use Ink chrome and Parchment content grounds

Status: **Proposed** (2026-10-04, phase D0). Needs decision: U-1, U-5, U-6.

## Context

Default ground is Ink (state/shape.ts:1547); Parchment is the light result of Match my device (look.ts:468). Chrome is a brushed-metal gradient (--chrome, look.ts:1757) and the rail follows the chosen ground. Light-ground hero/raise steps are #ffffff.

## Proposed decision

Define chrome (rail, tab bar, console scope bar, system context bar) as always Ink, and content as the chosen ground (Parchment in light, Ink tonal in dark). Chrome loses its gradient. Cards on light grounds use the panel step, not #ffffff. The other twelve grounds remain user-selectable but chrome stays Ink.

## Consequences

Rail, tab bar and bars stop following the ground; mediumrail, tiers, deadcss and textscale tests read the stylesheet as text and change with it; 143 accent × ground contrast pairings must be re-run with Ink chrome as a surface; the default for new accounts changes only if U-1 says so.

## Evidence

app/src/lib/look.ts:203,1757; app/src/styles/app.css:884-892; docs/COLOR-AND-DARK-MODE-SPEC.md.

## Not decided here

Whether Industry, Fog, Wine and similar grounds keep their own chrome.
