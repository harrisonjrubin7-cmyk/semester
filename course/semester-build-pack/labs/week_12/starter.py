def retry_allowed(record):
    """Return True for 429 or 503 only when attempt < max_attempts and method GET or idempotency_key is nonempty."""
    raise NotImplementedError("Implement this lab")
