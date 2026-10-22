# Layout and responsive behaviour

| Tier | Width | Navigation | Page pad |
| --- | --- | --- | --- |
| Compact | < 760px | Labelled bottom TabBar: Today · My Path · Search · Plan · Me | 18px |
| Medium | 760–1099px | Compact rail (72px, icons + tooltip names) | 20px |
| Wide | ≥ 1100px | SideRail 248px (272 at very wide) with group labels | 30px |

- **Shell:** SideRail (Ink) │ SystemContextBar (44px: location · term · ⌘K · sync · tools) over a scrolling page.
- **Page:** pagehead (kicker · H1 · one-line purpose · ≤2 actions) → `cols` grid `minmax(0,1.6fr) minmax(300px,1fr)` → main column leads with the next action; aside holds "Needs you", context, policy. Stacks to one column under 1000px.
- **Measures:** reading 66ch; operational content ≤ 1180px.
- **Tables** keep row identity and the first action on compact screens; the table region scrolls, not the document.
- **Five canonical destinations** are the spine: Today, My Path, Search, Plan, Me. Specialist tools open in context (OpenIn), never as a sixth global product.
- **Workspace modes** (presentation only): Guided · Focused (navigation steps back, FocusBar is the way out) · Detailed (source sentences up front) · Accessibility.
