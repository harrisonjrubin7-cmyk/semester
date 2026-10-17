def retry_allowed(record):
    """429 or 503, attempt below max_attempts, GET or nonempty idempotency_key."""
    raise NotImplementedError("Implement lab 12")
