-- Require a completed evaluation outcome before reconciliation can begin.
--
-- The original durable edge table admitted evaluating -> reconciling even
-- after the application workflow removed that shortcut. Replace only the
-- edge predicate so older service-role callers cannot bypass the completed
-- outcome recorded by ready, blocked, needs_review, unknown, or stale.

create or replace function private.registration_readiness_edge_ok(p_from text, p_to text)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (values
    ('requested', 'evaluating'),
    ('evaluating', 'ready'), ('evaluating', 'blocked'), ('evaluating', 'needs_review'),
    ('evaluating', 'unknown'), ('evaluating', 'stale'),
    ('ready', 'evaluating'), ('blocked', 'evaluating'),
    ('needs_review', 'reconciling'), ('unknown', 'reconciling'), ('stale', 'reconciling'),
    ('reconciling', 'evaluating')
  );
$$;

revoke all on function private.registration_readiness_edge_ok(text, text) from public, anon, authenticated;

comment on function private.registration_readiness_edge_ok(text, text) is
  'Fail-closed readiness transition predicate. Reconciliation begins only after a completed evaluation outcome.';
