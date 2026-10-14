# Readiness state vocabulary — item display states vs evaluation states

Two levels, one meaning. The prototype (`ui_kits/readiness-pilot`) and the design-system `ReadinessState` component show **per-item** states; `source-state.ts` defines the **overall evaluation**. Keep both names; never invent a third.

| Item display state (UI, per checklist item) | Overall evaluation (source-state.ts) | Rule |
|---|---|---|
| `ready_as_of` (✓ Ready · as of time) | contributes to `ready` | only when freshness = current and connection = confirmed |
| `blocked` (⊘) | `blocked` | names the approved next step |
| `review_required` (?) | `needs_review` | same meaning, older name — UI may keep the label "Review required" |
| `unknown` (◌) | `unknown` | missing record ≠ not eligible |
| `stale` (◷ Out of date) | `stale` | blocks a definitive result |
| `handoff_pending` (⇄) | `needs_review` | an office has the case; still not ready |
| `action_completed` | — (receipt state) | a student action finished; doesn't change the evaluation by itself |
| — | `failed`, `cancelled` | workflow states; shown as "needs review" or "start again", never as a negative result |

**Overall rule (same as `mayShowDefinitiveReadiness`):** the headline "You’re ready" appears only when every item is `ready_as_of` — so one stale SIS value turns it off. Checked against the prototype on 14 Oct: it already does this.

**Fixed on 14 Oct:** the prototype's "You’re ready" headline had no not-enrollment statement. It now says: "The available Vanderbilt information supports the next step shown here. This is not enrollment or confirmation of a seat. Review the registration process before taking action."
