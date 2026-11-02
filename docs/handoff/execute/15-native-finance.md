# Stream 15 — Native finance

Branch: `feat/native-family-finance-p2` (finance part may start earlier for pilot quotes/invoices).

## Paste this

> Act as CFO, payments architect, billing lead and security lead. Read design/docs/finance/README.md and every doc it links. Audit existing commercial/billing/student-account tables first and map handoff/semester-platform/supabase/migrations/090_native_finance.sql onto them — extend, never duplicate. Install lib/payments/*, app/api/payments/webhook/route.ts and tests/finance.test.ts. Run the quality gates. Stop before connecting any real payment rail.

## Rules

- Semester owns checkout, billing, ledger, entitlements, plans, refunds, reconciliation and the finance console. A regulated rail moves money as an adapter.
- No raw card data. Tokens only. Provider credentials server-side only.
- Idempotency key on every payment/refund/journal command. Webhooks verified server-side.
- Ledger append-only and balanced. Approvals by threshold; requester never approves.
- Forecasts labelled. Accounting/legal/payments material marked for professional review.

## Done when

All gates in docs/finance/FINANCE_RELEASE_GATES.md items 1–2 pass in CI. Items 3–8 are human-only.

## Report

Existing finance architecture · capability matrix · rail boundary · checkout · ledger · adapter · routes · workflows · controls · roadmap · backlog · professional review list · 90-day/12-month plan.
