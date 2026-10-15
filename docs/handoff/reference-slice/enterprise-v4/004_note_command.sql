-- Patch after consolidated sx reference v3. Fresh staging first; trusted owner.
BEGIN;
CREATE TABLE sx_private.note_command_receipts(
 actor_id uuid NOT NULL REFERENCES auth.users(id), request_key uuid NOT NULL,
 request_payload jsonb NOT NULL, response jsonb NOT NULL,
 PRIMARY KEY(actor_id,request_key)
);
ALTER TABLE sx_private.note_command_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.note_command_receipts FROM PUBLIC,anon,authenticated;
CREATE FUNCTION sx_personal.create_note(p_key uuid,p_title text,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); old record; payload jsonb; n uuid; result jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Unauthenticated'; END IF;
 IF p_key IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 200 OR p_body IS NULL OR length(p_body)>100000 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid note input'; END IF;
 payload:=jsonb_build_object('title',btrim(p_title),'body',p_body);
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||p_key::text,0));
 SELECT * INTO old FROM sx_private.note_command_receipts WHERE actor_id=u AND request_key=p_key;
 IF FOUND THEN IF old.request_payload<>payload THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Idempotency conflict'; END IF;RETURN old.response;END IF;
 INSERT INTO sx_personal.notes(owner_id,title,body) VALUES(u,btrim(p_title),p_body) RETURNING id INTO n;
 result:=jsonb_build_object('id',n,'title',btrim(p_title),'body',p_body);
 INSERT INTO sx_private.note_command_receipts VALUES(u,p_key,payload,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION sx_personal.create_note(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sx_personal.create_note(uuid,text,text) TO authenticated;
COMMIT;
