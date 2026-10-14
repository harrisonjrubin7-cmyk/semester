def tenant_access(record):
    """Require principal_tenant == resource_tenant (exact, case-sensitive, both nonempty), active exactly True, and tasks:read in scopes."""
    raise NotImplementedError("Implement this lab")
