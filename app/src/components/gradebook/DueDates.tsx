import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { DateField } from '../unity/DateField';
import { ErrorState, LoadingState } from '../unity/States';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { deviceTimeZone } from '../../lib/locale';
import { dueSaid, StaleRequest } from '../../lib/gradebook/requests';
import {
  DUE_NOT_SET_UP_SAID,
  dueFor,
  dueLine,
  dueProblem,
  extensionsOn,
  fromInstant,
  itemDates,
  loadDueDates,
  setDue,
  toInstant,
  whenSaid,
  type DueRow,
  type LoadedDueDates,
} from '../../lib/gradebook/duedates';

/**
 * When each graded item is due, on either side of the gradebook.
 *
 * A student reads the date that applies to them: the item's own, or — once
 * their instructor approves an extension in `RequestQueue` — the granted day,
 * said in words ("Extended to Thu, Nov 12, 2026") with the original date
 * under it, so the change never rests on colour. The instructor reads each
 * item's date, which students hold an extension on it, and, holding
 * `grades:release` (the capability that adds items), sets or changes it. A
 * teaching assistant reads the same table without the controls.
 *
 * `gradebook_due_dates` is security invoker, so the server decides whose
 * extensions come back; nothing here filters another student out. The
 * change names the version read: if a colleague moved the date first the
 * server refuses and writes nothing, and this offers a reload, never a retry.
 * Separate from `loadBook`, so a school without the migration keeps its
 * grades and reads "not set up at your school yet" here.
 */

const shortId = (id: string) => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

export function DueDates({ course, term, side, canSet, me }: { course: string; term: string; side: 'teaching' | 'mine'; canSet: boolean; me: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [loaded, setLoaded] = useState<LoadedDueDates | null | string>(null);
  const [reads, setReads] = useState(0);
  const [editing, setEditing] = useState<DueRow | null>(null);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('23:59');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const [stale, setStale] = useState(false);
  const formHead = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    loadDueDates(course, term).then(
      (r) => { if (live) setLoaded(r); },
      (e: unknown) => { if (live) setLoaded(e instanceof Error ? e.message : 'Could not load the due dates.'); },
    );
    return () => { live = false; };
  }, [course, term, reads]);

  useEffect(() => {
    if (editing) formHead.current?.focus();
  }, [editing]);

  const reload = () => { setStale(false); setReads((n) => n + 1); };
  const head = <SectionLabel>Due dates</SectionLabel>;

  if (typeof loaded === 'string') {
    return side === 'mine' ? (
      <>
        {head}
        <ErrorState title="The due dates did not load" body={`${loaded} Nothing has changed.`} recover={{ label: 'Load again', run: reload }} />
      </>
    ) : (
      <>
        {head}
        {/* Not ErrorState: its recovery is a primary button, and releasing grades is this screen's one primary action. */}
        <Notice alert>{loaded} Nothing has changed.</Notice>
        <button type="button" className="btn" onClick={reload}>
          Load the due dates again
        </button>
      </>
    );
  }
  if (loaded === null) {
    return (
      <>
        {head}
        <LoadingState what={`the due dates for ${course}`} bars={[40, 96]} />
      </>
    );
  }
  if (!loaded.available) {
    return (
      <>
        {head}
        <Notice>
          {DUE_NOT_SET_UP_SAID}
          {side === 'teaching' ? ' An approved extension is recorded on its request until it is.' : ' Your instructor’s syllabus has them.'}
        </Notice>
      </>
    );
  }

  const items = [...itemDates(loaded.rows).values()];
  if (items.length === 0) {
    return (
      <>
        {head}
        <EmptyState
          inline
          title="No graded items yet"
          body={side === 'teaching' ? `Add an item to the ${course} gradebook above, then give it a due date here.` : `${course} has no graded items in ${term} yet. Their due dates appear here once your instructor adds them.`}
        />
      </>
    );
  }

  async function save(row: DueRow, due: string | null): Promise<void> {
    setBusy(true);
    setSaid(null);
    setStale(false);
    try {
      const v = await attempt(`due:${row.itemId}:${row.version}:${due ?? 'none'}`, (key) => setDue(row.itemId, due, row.version, key));
      const text = v.due ? `${row.title} is now due ${whenSaid(v.due)}. Students see it at once.` : `${row.title} has no due date now. Students see that at once.`;
      setSaid({ tone: 'ok', text });
      say(text);
      setEditing(null);
      setReads((n) => n + 1);
    } catch (e) {
      const text = e instanceof Error ? e.message : 'The due date was not saved.';
      if (e instanceof StaleRequest) setStale(true);
      setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void save(row, due) });
    } finally {
      setBusy(false);
    }
  }

  const open = (row: DueRow) => {
    const at = fromInstant(row.itemDue);
    setDay(at.day);
    setTime(at.time);
    setSaid(null);
    setEditing(row);
  };

  if (side === 'mine') {
    const mine = items.map((i) => dueFor(loaded.rows, i.itemId, me) ?? i);
    const none = mine.every((r) => r.itemDue === null && !r.extended);
    return (
      <>
        {head}
        {none ? (
          <EmptyState inline title="No due dates set" body={`Your instructor has not set due dates for ${course} in ${term}. They appear here when they do.`} />
        ) : (
          <Table
            caption={`When each ${course} item is due for you in ${term}.`}
            captionHidden
            compact="stack"
            rows={mine}
            rowKey={(r) => r.itemId}
            empty={null}
            columns={[
              { id: 'item', header: 'Item', rowHeader: true, cell: (r) => r.title },
              {
                id: 'due',
                header: 'Due',
                cell: (r) => {
                  const line = dueLine(r);
                  return (
                    <>
                      {line.date}
                      {line.label && <Sub>{line.label}</Sub>}
                    </>
                  );
                },
              },
            ]}
          />
        )}
      </>
    );
  }

  const problem = editing ? dueProblem(day, time) : null;
  return (
    <>
      {head}
      <Result said={said} />
      {stale && (
        <Row>
          <button type="button" className="btn" onClick={reload}>
            Reload the due dates
          </button>
        </Row>
      )}
      {!canSet && <Sub>You can read these dates. The course’s instructor sets them.</Sub>}
      <Table
        caption={`When each ${course} item is due in ${term}, and which students have an extension.`}
        captionHidden
        compact="stack"
        rows={items}
        rowKey={(r) => r.itemId}
        empty={null}
        columns={[
          { id: 'item', header: 'Item', rowHeader: true, cell: (r) => r.title },
          { id: 'due', header: 'Due', cell: (r) => whenSaid(r.itemDue) },
          {
            id: 'extended',
            header: 'Extensions',
            cell: (r) => {
              const ext = extensionsOn(loaded.rows, r.itemId);
              if (ext.length === 0) return 'None';
              return (
                <>
                  {ext.map((x) => (
                    <Sub key={x.studentId}>
                      Student {shortId(x.studentId ?? '')}: {x.extended ? `extended to ${dueSaid(x.grantedDue)}` : `granted ${dueSaid(x.grantedDue)}, before the item’s own date, so it stands`}
                    </Sub>
                  ))}
                </>
              );
            },
          },
          ...(canSet
            ? [
                {
                  id: 'change',
                  header: 'Change',
                  cell: (r: DueRow) => (
                    <button type="button" className="btn" disabled={busy} onClick={() => open(r)}>
                      {r.itemDue ? 'Change' : 'Set'} the due date for {r.title}
                    </button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {editing && canSet && (
        <section aria-labelledby="due-head">
          <h3 id="due-head" ref={formHead} tabIndex={-1}>
            When {editing.title} is due
          </h3>
          <Stack>
            <DateField label="Day it is due" value={day} onChange={setDay} required hint="Students with an approved extension keep their later day." />
            <Field label="Time it is due" hint={`In your time zone, ${deviceTimeZone()}. Each student reads it in theirs.`}>
              {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
            </Field>
            <div role="status">{day !== '' && problem && <Sub>{problem}</Sub>}</div>
            <Row>
              <button type="button" className="btn" disabled={busy || problem !== null} onClick={() => void save(editing, toInstant(day, time))}>
                {busy ? 'Saving…' : 'Save the due date'}
              </button>
              {editing.itemDue && (
                <button type="button" className="btn" disabled={busy} onClick={() => void save(editing, null)}>
                  Clear the due date
                </button>
              )}
              <button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </button>
            </Row>
          </Stack>
        </section>
      )}
    </>
  );
}
