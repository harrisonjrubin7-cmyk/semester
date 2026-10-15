def safe_destination(record):
    """For HTTPS URLs with a literal IP host only: return True if the IP is globally routable (not private, loopback, link-local or reserved), there are no credentials, and the port is absent or 443. DNS hostnames are rejected."""
    raise NotImplementedError("Implement this lab")
