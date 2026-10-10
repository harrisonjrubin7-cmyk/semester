# API

FastAPI publishes the full OpenAPI schema at `/docs` and `/openapi.json`. All routes except health, register, and login require `Authorization: Bearer <token>`.

Implemented route groups cover users/authentication, courses, two-step uploads, file lifecycle and classification, review items, conflicts, editable calendar and ICS, study asset generation/lifecycle/exports, card review, quiz attempts, learner progress, and benchmark results. Upload completion verifies the stored object before it creates a durable completion receipt and asynchronous extraction job. An identical retry returns the same receipt and job; a retry with different completion data returns `409`. External clients can poll `/jobs/{job_id}` or refresh the file list.

The production Google/Outlook layer is intentionally an adapter boundary. No uncertain or conflicting event is synced externally.
