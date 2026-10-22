# Consequential actions

Source: `components/unity/ActionPreview.tsx`, `enrollment/StudentRegistration.tsx`, `console/Approvals.tsx`.

| Kind of action | Pattern |
| --- | --- |
| Reversible, personal (archive, move, rename) | Do it, then **UndoToast** ("Task archived. Undo"). No dialog. |
| Leaves Semester or someone else sees it (share, send, submit) | **Dialog + ActionPreview**: What happens / Exactly what / What stays the same / Taking it back |
| Academic record (enroll, drop, withdraw, regrade) | Two-step **Review → Confirm** in place; state where the request will land ("number 3 in line"; "a W is recorded") |
| Financial (pay, refund, waive) | Dialog + ActionPreview naming amount, method, processor ("Semester does not process the payment; TouchNet does"), refund route |
| Institutional high-risk (release hold, change role, break-glass) | **Two-person duty**: request → approve (≠ requester) → act; MFA fresh within 15 min; audit event written first |

## Writing the dialog
- Title is a question naming the object: "Drop CHEM 101?"
- Buttons name the outcome: "Keep CHEM 101" / "Drop — confirm". Focus lands on the safe one.
- Destructive uses red ink + red hairline (`variant="danger"`), never a solid red fill.
- Recovery is required: `undo` · `request` (with how) · `none` (with what to do if it was a mistake).
- Afterwards: a SuccessState receipt with what changed and "Next:" — never "All set!" while anything is pending.
