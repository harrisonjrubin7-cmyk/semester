# Service and dependency map

Native ownership of a workflow does not require replacing every external dependency. The classes below are the mainframe specification’s, matched to what this repository actually calls.

| Class | Examples in this repository | Treatment |
| --- | --- | --- |
| Legacy replacement bridge | SIS registration, LMS course materials. Official registration screen stays off and names the school’s system. Catalog import and YES paste are bridges. | Show the boundary. Do not claim the domain was replaced. |
| Continuing identity relationship | SSO and SCIM tables and runbooks described in the operations roadmap. | Keep. HTTP SCIM is still a gap. |
| Infrastructure | Vite web host, Vercel config (`app/vercel.json`), Postgres, storage, email and push as delivery. | Dependencies. Not product authority. Live targets unverified. |
| Payment rails | Stripe adapter commits on `origin/main` (`99d1aa08`, `cc3bb701`). Held in shadow per the decision docs. | Rail is replaceable behind the adapter. No charge, refund, or payout in this batch. Raw card data is not collected here. |
| Replaceable AI compute | Assistant key and provider selection in `lib/assistant`. | The registration plan does not call a model. |
| Ecosystem extension | Partner and LTI surfaces in the roadmap. | Approved scopes only. Not built as a marketplace in this batch. |

## Process boundaries

- `app/` client. Commands from `app/`.
- `packages/institution` and `app/server` gateway. `npm run check:university` typechecks that graph under NodeNext. Not run this batch because the change does not import the gateway.
- `supabase/migrations` are reviewed SQL. Applying them to a remote database needs explicit approval. This batch adds none.
- `company-site/` is the public site. This batch does not change it and does not add a marketing claim.

## What the device plan depends on

`readPlanDraft` → `blankCourse` → `addCourse` → screen `yes` → `NamedPlan` when the registration catalog is empty.

It does not depend on Supabase, Stripe, an AI provider, or an identity provider.
