# Privacy-preserving event taxonomy

Envelope: `event_name`, `version`, `occurred_at`, pseudonymous `actor_id`, approved `tenant_id/cohort_id`, `surface`, coarse `object_type`, `outcome`, `setup_mode`, `correlation_id`, consent/authority basis. Never include free text, titles, grades, disability/health, messages, exact location or raw source content.

Core events: `onboarding_started/completed`, `source_added/failed/revoked`, `course_added`, `first_week_plan_confirmed`, `recommended_action_completed/scheduled/snoozed/deferred`, `student_activated`, `student_first_win`, `weekly_plan_completed`, `support_opened/resolved`, `notification_opted_in/out`, `export_requested/completed`, `deletion_requested/completed`, `share_created/revoked`, `integration_degraded/recovered`, `admin_config_changed`, `feature_disabled`, `incident_opened/resolved`. `student_activated` is setup-only; `student_first_win` is the later plan-plus-intentional-action decision. Never infer one from the other.

Version and validate events; document purpose/retention/owner; suppress aggregate cells under 10; reject unregistered properties.
