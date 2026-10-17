def safe_destination(record):
    """For literal-IP HTTPS URLs only, return True if IP is globally routable, no credentials and port absent or 443. DNS hostnames are intentionally rejected."""
    raise NotImplementedError("Implement this lab")
