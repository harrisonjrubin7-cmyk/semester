# Customer commitments

<!-- Rendered from app/src/lib/ops/commitments.ts by commitments.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

Every promise made to a named customer: what was promised, to whom, in
which document, resting on which rows of the
[master readiness register](../../docs/MASTER-LAUNCH-READINESS-REGISTER.md),
with the evidence that it was kept and the approval that closed it. This is
how a sales promise and the product’s reality are made to meet, and it is as
important as the roadmap: a roadmap says what will be built, this says what
somebody is already relying on.

## Where it stands

**No commitments.** There is no customer: the council’s `champion` seat is vacant, no pilot agreement is signed, and the company that would sign one is not formed ([`docs/LAUNCH-DECISIONS.md`](../../docs/LAUNCH-DECISIONS.md) items 4, 5 and 7). The test holds the register empty while the seat is vacant, so the first promise cannot be recorded before there is somebody to have made it to.

## The columns

| Column | What goes in it |
| --- | --- |
| Customer | The institution or department. Never a person, never an address. |
| Commitment | What was promised, in the words it was promised in. |
| Scope | What is in, and what is out. |
| Contract reference | The identifier on the signed document. The document stays in the private operations system. |
| Owner | A council seat, from [`docs/LAUNCH-READINESS-COUNCIL.md`](../../docs/LAUNCH-READINESS-COUNCIL.md). |
| Due date | ISO date. |
| Product dependency | Master-register row ids the promise rests on. Their status is the truth about how far along it is. |
| Support tier | T1, T2, T3 from [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](../../docs/market-readiness/SUPPORT_PLAYBOOK.md). |
| Evidence | Paths under `docs/evidence/`, or private-system references, showing it was kept. |
| Status | `proposed` → `accepted` → `in-progress` → `delivered` → `approved` → `withdrawn` |
| Risk | The severity of missing the date, and why. |
| Customer communication | What the customer was last told, and when. |
| Completion approval | The founder seat, dated. Nobody else approves completion. |

## Statuses

| Status | Meaning |
| --- | --- |
| `proposed` | Offered in a conversation; not yet in a signed document |
| `accepted` | In a signed document, with a due date |
| `in-progress` | Work under way; the dependency rows say how far |
| `delivered` | Done, with evidence filed; awaiting completion approval |
| `approved` | The founder seat approved completion, and the customer was told |
| `withdrawn` | Withdrawn or renegotiated, with the customer communication recorded |

## The rules `problems()` enforces

- Every promise names at least one register row, and each must exist.
- A binding promise (`accepted`, `in-progress`, `delivered`, `approved`) has a contract reference.
- `delivered` and `approved` need evidence, and no dependency below `tested` (`tested`, `evidenced`, `operational`, `launch-approved` count).
- Only the founder seat approves completion, dated, and the customer is told.
- A customer relying on a row below `tested` has a named risk.
- A withdrawal is communicated.

Each rule was shown a commitment it must refuse before it was trusted to
accept one. `app/src/lib/ops/commitments.test.ts` holds the fixtures.

## Recording one

1. Add the row to `COMMITMENTS` in `app/src/lib/ops/commitments.ts`.
2. Run `npm test -- commitments` from `app/`; fix what `problems()` names.
3. Run `npm run registers` to rewrite this page, and open the pull request
   with the contract reference in its description.
