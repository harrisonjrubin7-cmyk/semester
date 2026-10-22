# UI grammar

_Semester design, intelligence, workflow and data system · 2026-10-05 · Source: uploads/expand further on brand identy algorthims workflow.pdf, reconciled with this design system (readme.md, tokens/, components/). Where they differ, this design system wins and the difference is listed._

> Semester should make an institutionally complex world feel personally clear.

## Universal page shell

Context bar (logo, location, search ⌘K, notifications, profile) → primary navigation (Today · Path · Plan · Courses · Workspace · Support · Career; rail on desktop, tab bar on mobile) → page title + what it helps you do + source/freshness → Layer 1 → Layer 2 → Layer 3. Built from SystemContextBar, SideRail, TabBar and the student-screen template.

## Three-layer disclosure

| Layer | Purpose | Example |
| --- | --- | --- |
| 1 | Immediate decision | “Your registration opens Tuesday at 8:00 AM. You have one hold.” |
| 2 | Explanation and action | “The hold is from Student Accounts. Here’s why it matters and who can help.” |
| 3 | Advanced detail | Source system, policy text, history, export, integration state, audit trail |

A student never needs Layer 3 for a normal daily action. Staff use Layer 3 often but start collapsed.

## Every screen answers

- Where am I?
- What is this screen for?
- What matters now?
- What can I do?
- What is official?
- What is stale or uncertain?
- What happens if I take this action?
- Who can help?
- Where is deeper detail?

## Standard panels

**Data trust:** Source · Updated · Authority · Status · Policy (with version) · Action (view official details). Built from SourceBadge + SourceLine + Fields.

**AI answer:** Answer · Sources · What this means · Suggested next step · Limits and uncertainty · Course/institution policy · Give feedback · Ask a person / official office. Built from AIResponse + ProvenanceChips.

**Error:** What happened · What data may be affected · What you can do now · Whether it saved · Whether it will retry · Who can help · Reference ID. Built from ErrorState.
