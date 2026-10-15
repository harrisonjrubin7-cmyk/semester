-- TEST-ONLY PostgreSQL controller. No changes to public/production tables.
BEGIN;
SET LOCAL lock_timeout='3s';
CREATE SCHEMA cutover_test;
REVOKE ALL ON SCHEMA cutover_test FROM PUBLIC;
CREATE TABLE cutover_test.control(
 scope text PRIMARY KEY, writer text NOT NULL CHECK(writer IN ('legacy','semester','held')),
 epoch bigint NOT NULL DEFAULT 1, native_commits bigint NOT NULL DEFAULT 0,
 uncertain_dispatches bigint NOT NULL DEFAULT 0,
 CHECK(native_commits>=0 AND uncertain_dispatches>=0));
CREATE TABLE cutover_test.events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,scope text NOT NULL,
 at timestamptz NOT NULL DEFAULT clock_timestamp(),action text NOT NULL,reason text NOT NULL);
CREATE TABLE cutover_test.mock_legacy(id text PRIMARY KEY,student text NOT NULL,section text NOT NULL,status text NOT NULL,revision integer NOT NULL);
CREATE TABLE cutover_test.candidate(LIKE cutover_test.mock_legacy INCLUDING ALL);
CREATE FUNCTION cutover_test.guard(p_scope text,p_mismatch bigint,p_drift boolean,p_isolation boolean)
RETURNS text LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r cutover_test.control; result text;
BEGIN
 IF p_mismatch IS NULL OR p_drift IS NULL OR p_isolation IS NULL THEN
   RAISE EXCEPTION 'Incomplete telemetry; external controller must hold release';
 END IF;
 IF p_mismatch<0 THEN RAISE EXCEPTION 'Invalid metric'; END IF;
 SELECT * INTO STRICT r FROM cutover_test.control WHERE scope=p_scope FOR UPDATE;
 IF p_mismatch=0 AND NOT p_drift AND NOT p_isolation THEN RETURN 'observe'; END IF;
 result:=CASE WHEN r.native_commits=0 AND r.uncertain_dispatches=0 AND NOT p_isolation
 THEN 'return_to_legacy_candidate' ELSE 'hold_preserve_writes' END;
 UPDATE cutover_test.control SET writer=CASE WHEN result='return_to_legacy_candidate' THEN 'legacy' ELSE 'held' END,epoch=epoch+1 WHERE scope=p_scope;
 INSERT INTO cutover_test.events(scope,action,reason) VALUES(p_scope,result,'validation_trigger');
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION cutover_test.guard(text,bigint,boolean,boolean) FROM PUBLIC;
COMMIT;
-- Caller is the reviewed test owner. Production counters must be transactionally
-- coupled to actual commits and dispatches; this isolated controller is not wired.
