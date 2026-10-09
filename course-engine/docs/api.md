# API

FastAPI publishes the full OpenAPI schema at `/docs` and `/openapi.json`. All routes except health, register, and login require `Authorization: Bearer <token>`.

Implemented route groups cover users/authentication, courses, two-step uploads, file lifecycle and classification, review items, conflicts, editable calendar and ICS, study asset generation/lifecycle/exports, card review, quiz attempts, learner progress, and benchmark results. Upload completion creates an asynchronous extraction job; external clients should poll the returned job record once a job endpoint is added or refresh the file list in the MVP.

The production Google/Outlook layer is intentionally an adapter boundary. No uncertain or conflicting event is synced externally.
