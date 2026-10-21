-- Schema scaffolding for the durable access worker. Before use: canonical foreign keys, restricted grants/RLS,
-- operation constraints, audit tables, retention and migration review. Reconcile with the repo's own migrations.
CREATE TABLE access_jobs (
  id uuid PRIMARY KEY,
  saga_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  generation bigint NOT NULL CHECK (generation > 0),
  operation text NOT NULL,
  operation_key text NOT NULL UNIQUE,
  request_digest text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'quarantined')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text
);

CREATE INDEX access_jobs_due ON access_jobs (available_at) WHERE status IN ('queued', 'running');

CREATE TABLE access_operation_receipts (
  job_id uuid PRIMARY KEY REFERENCES access_jobs(id),
  operation_key text NOT NULL UNIQUE,
  request_digest text NOT NULL,
  result jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE access_outbox (
  id uuid PRIMARY KEY,
  event_type text NOT NULL,
  tenant_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
