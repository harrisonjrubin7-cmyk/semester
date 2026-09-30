import { useEffect, useState, type FormEvent } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { Field, Result, RowItem, Rows, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime } from '../../lib/locale';
import {
  OVERRIDE_KINDS,
  decide,
  grantOverride,
  loadPending,
  loadSections,
  putSection,
  putTerm,
  sectionName,
  type Answer,
  type LiveSection,
  type OverrideKind,
  type PendingRequest,
  type TermCalendar,
} from '../../lib/enrollment/client';

/**
 * The registrar's half of Enrollment, for an account holding
 * `registration:administer` over this school.
 *
 * Its primary action is granting an override, because that is the decision
 * only the registrar can make for one student. Approving or denying a
 * request is a row-level decision beside each request; term and section
 * setup sit under their own folds below, since a registrar does them once a
 * term rather than every day.
 *
 * The server re-checks everything: an approval that a hold or a clash now
 * blocks is refused with the reason, and a hold is not on the list of things
 * an override can waive.
 */

const WAIVE_SAID: Record<OverrideKind, string> = {
  capacity: 'Seat limit — seats them even when the section is full',
  prerequisite: 'A missing prerequisite',
  time_conflict: 'A clash with another enrolled section',
  credit_limit: 'The term’s credit limit',
  approval: 'The approval step on a restricted section',
  late_add: 'Adding after add/drop has ended',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((x) => Number.parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
};

/** A `datetime-local` value as an instant, or '' when it is empty or unreadable. */
const instant = (local: string): string => {
  const at = new Date(local);
  return local && !Number.isNaN(at.getTime()) ? at.toISOString() : '';
};

const shortId = (id: string) => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

export function RegistrarDesk({ term, calendar, onTermSaved }: { term: string; calendar: TermCalendar | null; onTermSaved: () => void }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [pending, setPending] = useState<PendingRequest[] | null | string>(null);
  const [sections, setSections] = useState<LiveSection[] | string>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const [reads, setReads] = useState(0);
  const [override, setOverride] = useState({ student: '', section: '', reason: '', waives: [] as OverrideKind[] });
  const [termForm, setTermForm] = useState({ term, opens: '', addDrop: '', withdraw: '', maxCredits: String(calendar?.maxCredits ?? 18) });
  const [sectionForm, setSectionForm] = useState({
    course: '', section: '', title: '', credits: '3', capacity: '30', waitlist: '0', days: [] as number[], start: '09:00', end: '09:50', prerequisites: '', approval: false,
  });

  useEffect(() => {
    let live = true;
    loadPending(term).then((v) => { if (live) setPending(v); }, (e: unknown) => { if (live) setPending(e instanceof Error ? e.message : 'Could not load the requests.'); });
    // A failed read is said, not shown as a term with no sections.
    loadSections(term).then((v) => { if (live) setSections(v); }, (e: unknown) => { if (live) setSections(e instanceof Error ? e.message : 'Could not load the sections.'); });
    return () => { live = false; };
  }, [term, reads]);

  async function answered(what: string, run: (key: string) => Promise<Answer>): Promise<boolean> {
      setBusy(true);
      setSaid(null);
      try {
        const a = await attempt(what, run);
        setSaid({ tone: a.ok ? 'ok' : 'refused', text: a.message + (a.replayed ? ' (Already recorded — nothing was sent twice.)' : '') });
        if (a.ok) say(a.message);
        setReads((n) => n + 1);
        return a.ok;
      } catch (e) {
        const text = e instanceof Error ? e.message : 'The change was not sent.';
        setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void answered(what, run) });
        return false;
      } finally {
        setBusy(false);
      }
  }

  const plain = async (run: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setSaid(null);
    try {
      await run();
      setSaid({ tone: 'ok', text: done });
      say(done);
      setReads((n) => n + 1);
      return true;
    } catch (e) {
      setSaid({ tone: settled(e) ? 'refused' : 'unknown', text: e instanceof Error ? e.message : 'That was not saved.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sectionList = typeof sections === 'string' ? [] : sections;
  const chosen = sectionList.find((s) => s.id === override.section);

  const submitOverride = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!chosen) return;
    const ok = await answered(`override:${override.student}:${override.section}:${[...override.waives].sort().join(',')}`, (key) =>
      grantOverride({ student: override.student.trim(), sectionId: override.section, waives: override.waives, reason: override.reason }, key, sectionName(chosen)),
    );
    if (ok) setOverride({ student: '', section: '', reason: '', waives: [] });
  };

  const submitTerm = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await plain(
      () => putTerm({ term: termForm.term.trim().toUpperCase(), opensAt: instant(termForm.opens), addDropEndsAt: instant(termForm.addDrop), withdrawEndsAt: instant(termForm.withdraw), maxCredits: Number(termForm.maxCredits) }),
      `The ${termForm.term.trim().toUpperCase()} calendar is saved.`,
    );
    if (ok) onTermSaved();
  };

  const submitSection = async (e: FormEvent) => {
    e.preventDefault();
    const f = sectionForm;
    await plain(
      () => putSection({
        term,
        courseCode: f.course,
        section: f.section.trim(),
        title: f.title.trim(),
        credits: Number(f.credits),
        capacity: Number.parseInt(f.capacity, 10),
        waitlistCapacity: Number.parseInt(f.waitlist, 10) || 0,
        meetings: f.days.length ? [{ days: [...f.days].sort(), start: minutes(f.start), end: minutes(f.end) }] : [],
        prerequisites: f.prerequisites.split(',').map((p) => p.trim()).filter(Boolean),
        requiresApproval: f.approval,
      }),
      `${f.course.trim().toUpperCase()} ${f.section.trim()} is saved for ${term}.`,
    );
  };

  return (
    <>
      <Result said={said} />

      <SectionLabel aside={Array.isArray(pending) && pending.length ? `${pending.length} waiting` : undefined}>Requests waiting for approval</SectionLabel>
      {typeof pending === 'string' ? (
        <>
          <Notice alert>{pending} Nothing has changed.</Notice>
          <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
            Load again
          </button>
        </>
      ) : pending === null ? (
        <p role="status">Loading the requests…</p>
      ) : pending.length === 0 ? (
        <EmptyState inline title="No requests waiting" body={`Nobody is waiting for approval in ${term}. Requests appear here when a student asks to join a restricted section.`} />
      ) : (
        <Rows label="Requests waiting for approval">
          {pending.map((p) => {
            const where = sectionName(p);
            const reason = reasons[p.enrollmentId] ?? '';
            return (
              <RowItem key={p.enrollmentId}>
                <div>
                  <strong>{where}</strong> · {p.title}
                  <Sub>
                    Student account {shortId(p.student)} · asked {formatDateTime(new Date(p.requestedAt), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Sub>
                </div>
                <Field label={`Reason for the decision on ${where}`} hint="Recorded with the decision.">
                  {(ids) => (
                    <input id={ids.id} aria-describedby={ids.hint} className="input" value={reason} onChange={(e) => setReasons((r) => ({ ...r, [p.enrollmentId]: e.target.value }))} />
                  )}
                </Field>
                <Row>
                  <button type="button" className="btn" disabled={busy || !reason.trim()} onClick={() => void answered(`decide:${p.enrollmentId}:yes`, (key) => decide(p.enrollmentId, true, reason, key, where))}>
                    Approve the request
                  </button>
                  <button type="button" className="btn" disabled={busy || !reason.trim()} onClick={() => void answered(`decide:${p.enrollmentId}:no`, (key) => decide(p.enrollmentId, false, reason, key, where))}>
                    Deny the request
                  </button>
                </Row>
              </RowItem>
            );
          })}
        </Rows>
      )}

      <SectionLabel>Grant an override</SectionLabel>
      <form onSubmit={(e) => void submitOverride(e)}>
        <Stack>
          <Field label="Student account" hint="The student’s account id, as it appears on their request.">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" value={override.student} onChange={(e) => setOverride((o) => ({ ...o, student: e.target.value }))} required />
            )}
          </Field>
          {typeof sections === 'string' && (
            <>
              <Notice alert>{sections} The section list below is empty because it did not load, not because the term has none.</Notice>
              <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
                Load the sections again
              </button>
            </>
          )}
          <Field label="Section">
            {(ids) => (
              <select id={ids.id} aria-describedby={ids.hint} className="input" value={override.section} onChange={(e) => setOverride((o) => ({ ...o, section: e.target.value }))} required>
                <option value="">Choose a section</option>
                {sectionList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sectionName(s)} · {s.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-3)' }}>
            <legend>What to waive</legend>
            {OVERRIDE_KINDS.map((k) => (
              <label key={k} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={override.waives.includes(k)}
                  onChange={(e) => setOverride((o) => ({ ...o, waives: e.target.checked ? [...o.waives, k] : o.waives.filter((w) => w !== k) }))}
                />
                {WAIVE_SAID[k]}
              </label>
            ))}
            <Sub>A hold is not on this list. The office that placed it clears it.</Sub>
          </fieldset>
          <Field label="Reason" hint="Kept with the override for the audit.">
            {(ids) => (
              <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={3} value={override.reason} onChange={(e) => setOverride((o) => ({ ...o, reason: e.target.value }))} required />
            )}
          </Field>
          <ActionButton tone="primary" disabled={busy || !override.student.trim() || !override.section || override.waives.length === 0 || !override.reason.trim()} onClick={() => void submitOverride()}>
            Grant override
          </ActionButton>
        </Stack>
      </form>

      <SectionLabel>Set up the term</SectionLabel>
      <form onSubmit={(e) => void submitTerm(e)}>
        <Stack>
          <Field label="Term" hint="Four digits and FA, SP or SU, as 2026FA.">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" value={termForm.term} onChange={(e) => setTermForm((t) => ({ ...t, term: e.target.value }))} required pattern="[0-9]{4}(FA|SP|SU|fa|sp|su)" />
            )}
          </Field>
          <Field label="Registration opens">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" type="datetime-local" value={termForm.opens} onChange={(e) => setTermForm((t) => ({ ...t, opens: e.target.value }))} required />
            )}
          </Field>
          <Field label="Add/drop ends">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" type="datetime-local" value={termForm.addDrop} onChange={(e) => setTermForm((t) => ({ ...t, addDrop: e.target.value }))} required />
            )}
          </Field>
          <Field label="Withdrawal ends">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" type="datetime-local" value={termForm.withdraw} onChange={(e) => setTermForm((t) => ({ ...t, withdraw: e.target.value }))} required />
            )}
          </Field>
          <Field label="Most credits a student may take">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={1} max={40} step={0.5} value={termForm.maxCredits} onChange={(e) => setTermForm((t) => ({ ...t, maxCredits: e.target.value }))} required />
            )}
          </Field>
          <Row>
            <button type="submit" className="btn" disabled={busy}>
              Save the term
            </button>
          </Row>
        </Stack>
      </form>

      <SectionLabel>Add or change a section</SectionLabel>
      <form onSubmit={(e) => void submitSection(e)}>
        <Stack>
          <Sub>For {term}. Saving a course and section that already exist changes it; raising its seats gives them to the students waiting.</Sub>
          <Field label="Course code" hint="As ECON 1020.">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" value={sectionForm.course} onChange={(e) => setSectionForm((s) => ({ ...s, course: e.target.value }))} required />
            )}
          </Field>
          <Field label="Section">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" value={sectionForm.section} onChange={(e) => setSectionForm((s) => ({ ...s, section: e.target.value }))} required />
            )}
          </Field>
          <Field label="Title">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" value={sectionForm.title} onChange={(e) => setSectionForm((s) => ({ ...s, title: e.target.value }))} required />
            )}
          </Field>
          <Row end>
            <Field label="Credits">
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={0} max={30} step={0.5} value={sectionForm.credits} onChange={(e) => setSectionForm((s) => ({ ...s, credits: e.target.value }))} required />
              )}
            </Field>
            <Field label="Seats">
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={0} step={1} value={sectionForm.capacity} onChange={(e) => setSectionForm((s) => ({ ...s, capacity: e.target.value }))} required />
              )}
            </Field>
            <Field label="Waitlist places">
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={0} step={1} value={sectionForm.waitlist} onChange={(e) => setSectionForm((s) => ({ ...s, waitlist: e.target.value }))} />
              )}
            </Field>
          </Row>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>Meets on</legend>
            <Row>
              {DAYS.map((d, i) => (
                <label key={d} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={sectionForm.days.includes(i)}
                    onChange={(e) => setSectionForm((s) => ({ ...s, days: e.target.checked ? [...s.days, i] : s.days.filter((x) => x !== i) }))}
                  />
                  {d}
                </label>
              ))}
            </Row>
          </fieldset>
          <Row end>
            <Field label="Starts">
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.hint} className="input" type="time" value={sectionForm.start} onChange={(e) => setSectionForm((s) => ({ ...s, start: e.target.value }))} />
              )}
            </Field>
            <Field label="Ends">
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.hint} className="input" type="time" value={sectionForm.end} onChange={(e) => setSectionForm((s) => ({ ...s, end: e.target.value }))} />
              )}
            </Field>
          </Row>
          <Field label="Prerequisites" hint="Course codes, separated by commas. Leave empty for none.">
            {(ids) => (
              <input id={ids.id} aria-describedby={ids.hint} className="input" value={sectionForm.prerequisites} onChange={(e) => setSectionForm((s) => ({ ...s, prerequisites: e.target.value }))} />
            )}
          </Field>
          <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
            <input type="checkbox" checked={sectionForm.approval} onChange={(e) => setSectionForm((s) => ({ ...s, approval: e.target.checked }))} />
            Each enrollment needs the registrar’s approval
          </label>
          <Row>
            <button type="submit" className="btn" disabled={busy}>
              Save the section
            </button>
          </Row>
        </Stack>
      </form>
    </>
  );
}
