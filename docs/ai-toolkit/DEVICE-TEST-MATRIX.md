# Device test matrix

Driven in headless Chromium against the dev server with every toolkit flag at
`preview` (the `run` skill's setup), soft layout, tab-bar navigation. Script: open
Study → *Open AI Toolkit* → *Write a paper* → open *Why this workspace?* → *AI-use
policy* tab → *Research Studio* → start a project → add a source → *Mark verified*.

| Viewport | Size | Page errors | Horizontal scroll | All 7 tabs present | Observed |
| --- | --- | --- | --- | --- | --- |
| Phone | 390 × 900 | 0 | none | yes | Goals wrap two per row; form collapses to one column; tab strip scrolls sideways within itself; refusal reasons listed under *Mark verified* |
| Tablet | 820 × 1100 | 0 | none | yes | Two-column form |
| Desktop | 1440 × 1000 | 0 | none | yes | Rail navigation; policy card shows *Policy unavailable — ask your instructor* for a course with nothing recorded |

Same capabilities at every size: nothing is hidden or removed by width; only the
layout changes (`portal-form-grid` → one column at 640px).

## Not yet checked

- A real phone and tablet (touch targets were not measured beyond the app's existing
  `sweep:targets` rules).
- Screen readers (VoiceOver, NVDA, TalkBack). The label lint passes; that is not the
  same as a screen-reader session.
- 200% and 400% zoom / reflow.
- `prefers-reduced-motion` — the toolkit adds no motion of its own.

These are launch gates in [AI-TOOLKIT-TEST-PLAN.md](AI-TOOLKIT-TEST-PLAN.md).
