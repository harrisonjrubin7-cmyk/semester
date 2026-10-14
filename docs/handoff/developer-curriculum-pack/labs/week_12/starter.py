def retry_allowed(record):
    """Return True only for status 429 or 503, when attempt < max_attempts, and when method is GET or idempotency_key is a nonempty string."""
    raise NotImplementedError("Implement this lab")
