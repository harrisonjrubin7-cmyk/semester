# Privacy-preserving event taxonomy

> **Status: a plan, not sent.** This page describes what the company would like to measure. It is not what the app sends: the app's student activity marks are exactly three (`opened`, `course`, `studied`; see [`/ANALYTICS.md`](../../ANALYTICS.md) and [`../ANALYTICS-EVENTS.md`](../ANALYTICS-EVENTS.md)). Separately, the go-to-market tables (`gtm_*`) and `site_leads` record prospect and lead activity for the company site; those are governed by `docs/privacy-operations/04-PRIVACY-BY-DESIGN-REVIEW.md`, not by this plan. Do not read any funnel step below as collected today.

Envelope: `event_name`, `version`, `occurred_at`, pseudonymous `actor_id`, approved `tenant_id/cohort_id`, `surface`, coarse `object_type`, `outcome`, `setup_mode`, `correlation_id`, consent/authority basis. Never include free text, titles, grades, disability/health, messages, exact location or raw source content.

Core events: `onboarding_started/completed`, `source_added/failed/revoked`, `course_added`, `first_week_plan_confirmed`, `recommended_action_completed/scheduled/snoozed/deferred`, `student_activated`, `student_first_win`, `weekly_plan_completed`, `support_opened/resolved`, `notification_opted_in/out`, `export_requested/completed`, `deletion_requested/completed`, `share_created/revoked`, `integration_degraded/recovered`, `admin_config_changed`, `feature_disabled`, `incident_opened/resolved`. `student_activated` is setup-only; `student_first_win` is the later source/limitations-aware, help-aware intentional-action decision. Never infer one from the other, and do not treat a full first-week plan as an extra first-win gate.

Version and validate events; document purpose/retention/owner; suppress aggregate cells under 10; reject unregistered properties.
