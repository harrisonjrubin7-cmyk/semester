# Architecture

The system has four durable layers: encrypted original objects, normalized source chunks and citation records, relational course knowledge, and versioned study/calendar outputs. PostgreSQL owns the truth; JSONB-style JSON columns hold flexible extracted and generated structures. Redis/Celery handles extraction and generation work. MinIO provides the production-shaped local object-store service.

The processing path is: validate declared size/extension and checksum → malware-scanner hook → preserve original → enqueue worker → specialized extractor → location-bearing chunks → citation records → structured fact/generation adapters → citation validation → review/conflict records → confirmed calendar and study assets → PDF/DOCX/ICS renderers.

The development LLM returns no facts when evidence is absent. A production adapter must implement `StructuredLLMClient`, validate each Pydantic response, retry bounded transient failures, and reject unknown citation IDs before persistence.

Security boundaries include JWT authentication, per-query ownership checks, duplicate checksums, safe ZIP extraction with traversal and expansion limits, explicit supported extensions, soft deletion, and an injectable malware scanner. Production still requires managed encryption/KMS, real AV scanning, rate limiting, audit logging, signed downloads, secret management, and tenant-level operational review.
