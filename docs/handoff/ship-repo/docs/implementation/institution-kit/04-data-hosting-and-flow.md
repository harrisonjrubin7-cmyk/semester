# Data hosting and flow

- **Hosting:** Supabase (region _to confirm_) + Vercel. Subprocessor list on the Trust page.
- **Flow:** SIS → read-only adapter → staging → reconciled projection → student/registrar views. Nothing flows back to the SIS.
- **Classification:** holds, time tickets, prerequisites = restricted. Never sent to AI providers.
- **Retention:** per `privacy/data-lifecycle.yaml` in the build plan.
