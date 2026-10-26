// Migration rl-001 (SEC-046): atomic token bucket in Postgres. One row per (bucket, subject); the row lock serializes takes.
export const RL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rl_buckets (bucket text NOT NULL, subject text NOT NULL, tokens double precision NOT NULL, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
     PRIMARY KEY (bucket, subject), CHECK (tokens >= 0))`,
  `CREATE OR REPLACE FUNCTION rl_take(p_bucket text, p_subject text, p_capacity double precision, p_per_sec double precision, p_cost double precision)
   RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE t double precision; ts timestamptz; now_ts timestamptz := clock_timestamp();
   BEGIN
     INSERT INTO rl_buckets (bucket, subject, tokens, updated_at) VALUES (p_bucket, p_subject, p_capacity, now_ts) ON CONFLICT DO NOTHING;
     SELECT tokens, updated_at INTO t, ts FROM rl_buckets WHERE bucket = p_bucket AND subject = p_subject FOR UPDATE;
     t := least(p_capacity, t + greatest(0, extract(epoch FROM now_ts - ts)) * p_per_sec);
     IF t >= p_cost THEN
       UPDATE rl_buckets SET tokens = t - p_cost, updated_at = now_ts WHERE bucket = p_bucket AND subject = p_subject;
       RETURN jsonb_build_object('ok', true, 'retryAfter', 0);
     END IF;
     UPDATE rl_buckets SET tokens = t, updated_at = now_ts WHERE bucket = p_bucket AND subject = p_subject;
     RETURN jsonb_build_object('ok', false, 'retryAfter', ceil((p_cost - t) / p_per_sec));
   END $$`,
];
