# Uploaded enterprise v3 slice (6 Oct 2026)

`001_core`, `002_billing` and `003_rls` are kept verbatim. They use schemas `sem_core`, `sem_billing` and `sem_private`.

**Don't run them alongside the repo or `semester-platform`.** The repo already has billing tables (billing_accounts, invoices, payment_events, checkout_sessions, cancellation_requests); see `../../REPO-CROSSWALK.md`.

Worth taking from 002, only if the repo lacks them:
- payment_allocations (match a payment to invoice lines)
- reconciliation_runs and reconciliation_items (provider vs ledger)
- refunds as their own records
- a private payment_methods table holding provider tokens, never card data

The uploaded `migration_runbook.pdf` and `enterprise_architecture_spec.pdf` stay in `uploads/`.
