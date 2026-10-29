// Migration hkb-001: Support help articles (role app "Support Agent": help articles). Requires co_has() from lib/coRoles.ts.
// - Only support agents write; a different support agent reviews the exact text (hash-bound) before it is published.
// - Internal articles, once published, are readable by support agents in Company OS.
// - Customer-facing articles can be approved but are NOT delivered: delivery is a CHECK-constrained 'disabled' column, like
//   marketing sending, until the owner approves customer publishing. An article that makes a price, customer, outcome,
//   certification or security claim needs a cited approved source before it can be submitted.
// - Published text is never edited in place: a revision is a new draft; publishing it retires the one it replaces.
// - One hkb_cmd() call = one transaction (change, version, history, receipt). History and receipts are append-only.
export const HKB_CLAIMS = ['price', 'customer', 'outcome', 'certification', 'security'] as const;
export const HKB_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS hkb_articles (id text PRIMARY KEY, number serial, title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 140),
     body text NOT NULL CHECK (length(trim(body)) BETWEEN 40 AND 20000), audience text NOT NULL CHECK (audience IN ('internal', 'customer')),
     claim_types text[] NOT NULL DEFAULT '{}' CHECK (claim_types <@ ARRAY['price','customer','outcome','certification','security']::text[]), claim_sources text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'in_review', 'published', 'retired')),
     author_id text NOT NULL, reviewer_id text, review_note text NOT NULL DEFAULT '', supersedes text REFERENCES hkb_articles(id), published_at timestamptz,
     delivery text NOT NULL DEFAULT 'disabled' CHECK (delivery = 'disabled'), version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (reviewer_id IS NULL OR reviewer_id <> author_id), CHECK (state <> 'published' OR (reviewer_id IS NOT NULL AND published_at IS NOT NULL)),
     CHECK (cardinality(claim_types) = 0 OR length(trim(claim_sources)) >= 10))`,
  `CREATE TABLE IF NOT EXISTS hkb_commands (actor_id text NOT NULL, command_key text NOT NULL, payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS hkb_receipts (actor_id text NOT NULL, command_key text NOT NULL, article_id text, result_code text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (actor_id, command_key), FOREIGN KEY (actor_id, command_key) REFERENCES hkb_commands (actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS hkb_events (id bigserial PRIMARY KEY, article_id text NOT NULL REFERENCES hkb_articles(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION hkb_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS hkb_events_append_only ON hkb_events`,
  `CREATE TRIGGER hkb_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON hkb_events FOR EACH STATEMENT EXECUTE FUNCTION hkb_refuse_change()`,
  `DROP TRIGGER IF EXISTS hkb_receipts_append_only ON hkb_receipts`,
  `CREATE TRIGGER hkb_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON hkb_receipts FOR EACH STATEMENT EXECUTE FUNCTION hkb_refuse_change()`,
  `CREATE OR REPLACE FUNCTION hkb_hash(a hkb_articles) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT md5(concat_ws('|', a.title, a.body, a.audience, array_to_string(a.claim_types, ','), a.claim_sources)) $$`,
  `CREATE OR REPLACE FUNCTION hkb_cmd(p_actor text, p_key text, p_hash text, p_step text, p_id text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c hkb_commands%ROWTYPE; a hkb_articles%ROWTYPE; v_code text := 'OK'; v_msg text; v_id text := p_id; v_detail text := ''; v_claims text[]; n text := trim(coalesce(p->>'note', ''));
BEGIN
  SELECT * INTO c FROM hkb_commands WHERE actor_id = p_actor AND command_key = p_key;
  IF FOUND THEN
    IF c.payload_hash <> p_hash THEN RETURN jsonb_build_object('resultCode', 'IDEMPOTENCY_CONFLICT', 'message', 'This request key was already used with different details.'); END IF;
    RETURN (SELECT jsonb_build_object('replay', true, 'id', article_id, 'resultCode', result_code, 'message', message) FROM hkb_receipts WHERE actor_id = p_actor AND command_key = p_key);
  END IF;
  INSERT INTO hkb_commands (actor_id, command_key, payload_hash) VALUES (p_actor, p_key, p_hash);
  v_claims := coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p->'claimTypes', '[]'::jsonb))), '{}');

  IF NOT co_has(p_actor, 'support_agent') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Help articles need the support agent role.';
  ELSIF p_step = 'draft' THEN
    IF length(trim(coalesce(p->>'title', ''))) < 5 OR length(trim(coalesce(p->>'body', ''))) < 40 THEN v_code := 'BAD_INPUT'; v_msg := 'Write a title (5+ characters) and the answer (40+ characters).';
    ELSIF coalesce(p->>'audience', '') NOT IN ('internal', 'customer') THEN v_code := 'BAD_INPUT'; v_msg := 'Choose internal or customer-facing.';
    ELSIF NOT (v_claims <@ ARRAY['price','customer','outcome','certification','security']::text[]) THEN v_code := 'BAD_INPUT'; v_msg := 'Unknown claim type.';
    ELSIF cardinality(v_claims) > 0 AND length(trim(coalesce(p->>'claimSources', ''))) < 10 THEN v_code := 'NEEDS_SOURCE'; v_msg := 'This article makes a claim. Cite the approved source first.';
    ELSE v_id := 'hkb_' || substr(md5(p_actor || '|' || p_key), 1, 12);
      INSERT INTO hkb_articles (id, title, body, audience, claim_types, claim_sources, author_id) VALUES (v_id, trim(p->>'title'), trim(p->>'body'), p->>'audience', v_claims, trim(coalesce(p->>'claimSources', '')), p_actor);
      v_msg := 'Draft saved.'; v_detail := p->>'audience';
    END IF;
  ELSE
    SELECT * INTO a FROM hkb_articles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN v_code := 'NOT_FOUND'; v_msg := 'Article not found.';
    ELSIF (p->>'version')::int IS DISTINCT FROM a.version THEN v_code := 'STALE'; v_msg := 'This article changed since you opened it. Reload and try again.';
    ELSIF p_step = 'edit' THEN
      IF a.author_id <> p_actor THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the author edits a draft.';
      ELSIF a.state <> 'draft' THEN v_code := 'BAD_STATE'; v_msg := 'Only drafts can be edited. Published text changes through a revision.';
      ELSIF length(trim(coalesce(p->>'title', a.title))) < 5 OR length(trim(coalesce(p->>'body', a.body))) < 40 THEN v_code := 'BAD_INPUT'; v_msg := 'Write a title (5+ characters) and the answer (40+ characters).';
      ELSIF NOT (v_claims <@ ARRAY['price','customer','outcome','certification','security']::text[]) THEN v_code := 'BAD_INPUT'; v_msg := 'Unknown claim type.';
      ELSIF cardinality(CASE WHEN p ? 'claimTypes' THEN v_claims ELSE a.claim_types END) > 0 AND length(trim(coalesce(p->>'claimSources', a.claim_sources))) < 10 THEN v_code := 'NEEDS_SOURCE'; v_msg := 'This article makes a claim. Cite the approved source first.';
      ELSE UPDATE hkb_articles SET title = trim(coalesce(p->>'title', title)), body = trim(coalesce(p->>'body', body)), audience = coalesce(nullif(p->>'audience', ''), audience),
          claim_types = CASE WHEN p ? 'claimTypes' THEN v_claims ELSE claim_types END, claim_sources = trim(coalesce(p->>'claimSources', claim_sources)) WHERE id = a.id;
        v_msg := 'Saved.'; END IF;
    ELSIF p_step = 'submit' THEN
      IF a.author_id <> p_actor THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the author submits it.';
      ELSIF a.state <> 'draft' THEN v_code := 'BAD_STATE'; v_msg := 'Only drafts are submitted.';
      ELSIF cardinality(a.claim_types) > 0 AND length(trim(a.claim_sources)) < 10 THEN v_code := 'NEEDS_SOURCE'; v_msg := 'This article makes a claim. Cite the approved source first.';
      ELSE UPDATE hkb_articles SET state = 'in_review' WHERE id = a.id; v_msg := 'Sent for review.'; END IF;
    ELSIF p_step IN ('publish', 'return') THEN
      IF a.author_id = p_actor THEN v_code := 'SEPARATION_OF_DUTIES'; v_msg := 'You wrote this article, so another support agent reviews it.';
      ELSIF a.state <> 'in_review' THEN v_code := 'BAD_STATE'; v_msg := 'This article is not waiting for review.';
      ELSIF p->>'seenHash' IS DISTINCT FROM hkb_hash(a) THEN v_code := 'CONTENT_CHANGED'; v_msg := 'The article changed since you opened it. Reload and review again.';
      ELSIF p_step = 'return' AND length(n) < 5 THEN v_code := 'BAD_INPUT'; v_msg := 'Say what needs changing.';
      ELSIF p_step = 'return' THEN UPDATE hkb_articles SET state = 'draft', review_note = n WHERE id = a.id; v_msg := 'Returned to the author.'; v_detail := n;
      ELSE
        UPDATE hkb_articles SET state = 'published', reviewer_id = p_actor, review_note = n, published_at = now() WHERE id = a.id;
        v_msg := CASE WHEN a.audience = 'customer' THEN 'Approved exactly as shown. Customer delivery is disabled: no customer can see it yet.' ELSE 'Published for support agents.' END;
        v_detail := 'hash ' || hkb_hash(a);
        IF a.supersedes IS NOT NULL THEN
          UPDATE hkb_articles SET state = 'retired', version = version + 1, updated_at = now() WHERE id = a.supersedes AND state = 'published';
          INSERT INTO hkb_events (article_id, actor_id, action, detail) VALUES (a.supersedes, p_actor, 'superseded', 'by ' || a.id);
        END IF;
      END IF;
    ELSIF p_step = 'revise' THEN
      IF a.state <> 'published' THEN v_code := 'BAD_STATE'; v_msg := 'Only a published article is revised.';
      ELSIF EXISTS (SELECT 1 FROM hkb_articles WHERE supersedes = a.id AND state IN ('draft', 'in_review')) THEN v_code := 'BAD_STATE'; v_msg := 'A revision of this article is already open.';
      ELSE v_id := 'hkb_' || substr(md5(p_actor || '|' || p_key), 1, 12);
        INSERT INTO hkb_articles (id, title, body, audience, claim_types, claim_sources, author_id, supersedes) VALUES (v_id, a.title, a.body, a.audience, a.claim_types, a.claim_sources, p_actor, a.id);
        v_msg := 'Revision started as a new draft. The published version stays live until the revision is published.'; v_detail := 'of ' || a.id; END IF;
    ELSIF p_step = 'retire' THEN
      IF a.state <> 'published' THEN v_code := 'BAD_STATE'; v_msg := 'Only a published article is retired.';
      ELSIF length(n) < 5 THEN v_code := 'BAD_INPUT'; v_msg := 'Say why it is retired.';
      ELSE UPDATE hkb_articles SET state = 'retired' WHERE id = a.id; v_msg := 'Retired.'; v_detail := n; END IF;
    ELSE v_code := 'UNKNOWN_ACTION'; v_msg := 'Unknown step.';
    END IF;
  END IF;

  IF v_code = 'OK' THEN
    IF p_step NOT IN ('draft', 'revise') THEN UPDATE hkb_articles SET version = version + 1, updated_at = now() WHERE id = v_id; END IF;
    INSERT INTO hkb_events (article_id, actor_id, action, detail) VALUES (v_id, p_actor, p_step, left(v_detail, 600));
  END IF;
  INSERT INTO hkb_receipts (actor_id, command_key, article_id, result_code, message) VALUES (p_actor, p_key, v_id, v_code, v_msg);
  RETURN jsonb_build_object('id', v_id, 'resultCode', v_code, 'message', v_msg);
END $$`,
];
