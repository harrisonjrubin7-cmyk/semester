# API

FastAPI publishes the full OpenAPI schema at `/docs` and `/openapi.json`. All routes except health, register, and login require `Authorization: Bearer <token>`.

Implemented route groups cover users/authentication, courses, two-step uploads, file lifecycle and classification, review items, conflicts, editable calendar and ICS, study asset generation/lifecycle/exports, card review, quiz attempts, learner progress, and benchmark results. Upload completion verifies the stored object before it creates a durable completion receipt and asynchronous extraction job. An identical retry returns the same receipt and job; a retry with different completion data returns `409`. External clients can poll `/jobs/{job_id}`, cancel non-completed work with `POST /jobs/{job_id}/cancel`, or refresh the file list. Job reads and cancellation use the owning course boundary and return `404` across tenants.

`GET /citations/{citation_id}/source-view` resolves an authorized citation to its stored quote, exact page/slide/sheet/cell/time/bounding-box location, and immutable original checksum. Other course owners receive the same `404` as an unknown citation. Local development uses the authenticated file-download route. Configured object storage returns a private original URL with an exact 120-second expiry plus the signed request headers the client must send when fetching it.

The production Google/Outlook layer is intentionally an adapter boundary. No uncertain or conflicting event is synced externally.
