-- Releasing grades writes its outbox event in the same transaction.
--
-- Phase 3, domain A ("publication + outbox in one transaction"). Until now
-- `gradebook_release` inserted the released versions and returned; anything
-- downstream (the LMS passback queue, a notification, a projection) had to be
-- asked for by a second call, so a release could commit with nothing to say it
-- had. The release now emits a `gradebook.grades_released` domain event through
-- `private.emit_domain_event` before it returns. Both land or neither does: a
-- refused release raises before the insert, and a release that releases nothing
-- raises after it, which rolls the event back with the rows.
--
-- The event is keyed by the release's own idempotency key, so a replayed
-- release (which answers from the ledger and never reaches this line) and a
-- retried emit both leave one event. The ledger takes a key of 8 to 200
-- characters and the outbox a correlation id of 8 to 128, so a key longer
-- than 128 is carried whole as the idempotency key (300 allowed there) and
-- correlated by its digest; copying it would make a contract-valid key abort
-- the release it was meant to label. The payload carries counts and the item's
-- identity, never a student id or a score: the projection that wants those
-- reads the released rows under its own policy.
--
-- Everything else about `gradebook_release` is unchanged from 20260929310000.

create or replace function public.gradebook_release(want_item uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  school   text := private.gradebook_school();
  it       public.gradebook_items;
  req      jsonb := jsonb_build_object('item', want_item);
  prior    jsonb;
  must     boolean;
  s        uuid;
  cur      public.grade_entries;
  released integer := 0;
  held     integer := 0;
  answer   jsonb;
  corr     text;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, it.course_code, it.term, 'grades:release', false);
  prior := private.gradebook_replay(school, want_key, 'release', req);
  if prior is not null then return prior; end if;

  select coalesce((select sc.moderation_required from public.gradebook_schemes sc
                    where sc.tenant_id = school and sc.course_code = it.course_code and sc.term = it.term
                    order by sc.version desc limit 1), false) into must;
  for s in select distinct g.student_id from public.grade_entries g where g.item_id = it.id order by 1 loop
    cur := private.gradebook_current(it.id, s);
    continue when cur.status = 'released';
    if must and cur.status <> 'moderated' then
      held := held + 1;
      continue;
    end if;
    insert into public.grade_entries
      (tenant_id, course_code, term, item_id, student_id, version, score, mark, comment,
       status, action, graded_by, actor, reason, regrade_id, operation)
    values (cur.tenant_id, cur.course_code, cur.term, cur.item_id, cur.student_id, cur.version + 1, cur.score, cur.mark,
            cur.comment, 'released', 'released', cur.graded_by, me, '', cur.regrade_id, want_key);
    released := released + 1;
  end loop;
  if released = 0 then
    raise exception 'semester: nothing to release (% waiting for moderation)', held using errcode = 'check_violation';
  end if;
  answer := jsonb_build_object('released', released, 'held', held);

  -- The outbox, in this transaction. Counts and the item, not people. The
  -- correlation id is the key itself when it fits the outbox's 128, else its
  -- digest; the idempotency key is always the whole key.
  corr := case when length(want_key) <= 128 then want_key else 'gb:' || md5(want_key) end;
  perform private.emit_domain_event(
    'gradebook_item', it.id::text, 'gradebook.grades_released', 1,
    school, 'gradebook', corr, want_key,
    jsonb_build_object('item', it.id, 'course_code', it.course_code, 'term', it.term,
                       'released', released, 'held', held),
    'education_record', 'student_record'
  );

  perform private.gradebook_spend(school, want_key, 'release', req, answer);
  return answer;
end $$;
