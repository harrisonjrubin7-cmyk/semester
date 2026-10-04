# ADR-0035 · Adopt five-destination mobile navigation and a grouped desktop rail

Status: **Proposed** (2026-10-04, phase D0). Needs decision: the word Tasks; hiding labels.

## Context

The five-tab bar already exists (lib/tabbar.ts:165, journeyNavigation). The rail has five items plus quiet extras, no groups, and no ⌘K. DESTINATIONS and NAV_AREAS use other groupings. The content ledger retires the word task in student copy (DD-001) but the target rail lists Tasks. state.labels can hide tab labels.

## Proposed decision

Keep the five destinations (Today, My Path, Search, Plan, Me). Add a Rail with groups Today, Learning, My Path, Life, Me from a new NAV_RAIL structure that references existing Screen ids; Tasks, Advising and Accessibility are routes to decide. Rail is fixed 248px at 1200 and up. Tab labels are always visible; the labels-off setting is removed or limited to the rail. Reuse state.finder for ⌘K.

## Consequences

complexity-budgets.json (63 destinations) changes; chromeFor semantics and chrome.test.ts stay; mediumrail and widthgate tests change; persisted state.tabs and state.labels need a migration. RESPONSIVE-CONTRACTS.md is corrected to the code's 600/840/1200/1600.

## Evidence

docs/design/RESPONSIVE_SHELL_AUDIT.md §2-4.

## Not decided here

Build Tasks, Advising, Accessibility routes, or fold them into existing screens.
