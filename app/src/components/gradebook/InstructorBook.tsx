import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { Field, Result, RowItem, Rows, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { download } from '../../lib/deliver';
import { current, latestReleased } from '../../lib/gradebook/ledger';
import { schemeProblems } from '../../lib/gradebook/compute';
import { MARKS, type Category, type GradeCapability, type LetterStep, type Mark, type Scheme } from '../../lib/gradebook/model';
import {
  addItem,
  asGradebook,
  enterScore,
  exportCsv,
  exportRows,
  loadBook,
  moderate,
  queuePassback,
  release,
  resolveRegrade,
  setScheme,
  type LoadedBook,
} from '../../lib/gradebook/client';

/**
 * The instructor's gradebook of record for one course and term.
 *
 * Grading is one item at a time — pick the item, and the table is every
 * student with their current version of that grade and a row to change it.
 * That is how a stack of papers is marked, and it keeps the table to five
 * columns, which reflows at 320px where a students-by-items grid could not.
 *
 * A draft is visibly a draft: every cell says which version the student can
 * see ("Draft — the student cannot see this"), and a change to a released
 * grade says the released one stays what the student sees until this one is
 * released too. The one primary action is releasing the chosen item, because
 * that is the moment grades leave the instructor's hands.
 *
 * The roster is not readable by a client. The table's rows are the students
 * who already have a version of any grade in this course, and a student is
 * added by their account id — which the database checks against the
 * course's `grades:receive` grants before accepting a score.
 */

type Caps = readonly GradeCapability[];

const MARK_SAID: Record<Mark, string> = { late: 'Late', excused: 'Excused', incomplete: 'Incomplete', missing: 'Missing' };

const STATUS_SAID = {
  draft: 'Draft — the student cannot see this',
  moderated: 'Moderated — not released yet',
  released: 'Released — the student sees this',
} as const;

const DEFAULT_LETTERS: LetterStep[] = [
  { letter: 'A', min: 90 },
  { letter: 'B', min: 80 },
  { letter: 'C', min: 70 },
  { letter: 'D', min: 60 },
  { letter: 'F', min: 0 },
];

/** "A 90, B 80, F 0" ↔ the letter scale. */
export const lettersSaid = (l: readonly LetterStep[]) => l.map((s) => `${s.letter} ${s.min}`).join(', ');
export function readLetters(text: string): LetterStep[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [letter, min] = p.split(/\s+/);
      return { letter: (letter ?? '').toUpperCase(), min: Number(min) };
    });
}

/** A category key from its name: "Problem sets" → "problem-sets". */
export const keyOf = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^([0-9])/, 'c$1').slice(0, 31) || 'category';

const shortId = (id: string) => (id.length > 8 ? `${id.slice(0, 8)}…` : id);

interface Draft {
  score: string;
  mark: Mark | '';
  comment: string;
  reason: string;
}

export function InstructorBook({ course, term, caps, me }: { course: string; term: string; caps: Caps; me: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [book, setBook] = useState<LoadedBook | null | string>(null);
  const [reads, setReads] = useState(0);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const [itemId, setItemId] = useState('');
  const [extra, setExtra] = useState<string[]>([]);
  const [newStudent, setNewStudent] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [schemeForm, setSchemeForm] = useState<{ categories: Category[]; letters: string; moderation: boolean } | null>(null);
  const [itemForm, setItemForm] = useState({ category: '', title: '', points: '10', lineItem: '' });
  const [resolving, setResolving] = useState<Record<string, { outcome: 'upheld' | 'changed'; score: string; note: string }>>({});

  const can = (c: GradeCapability) => caps.includes(c);

  useEffect(() => {
    let live = true;
    loadBook(course, term).then(
      (b) => {
        if (!live) return;
        setBook(b);
        setItemId((was) => (b.items.some((i) => i.id === was) ? was : (b.items[0]?.id ?? '')));
        setSchemeForm((was) =>
          was ?? {
            categories: b.scheme?.categories.map((c) => ({ ...c })) ?? [{ key: 'coursework', name: 'Coursework', weight: 100, dropLowest: 0 }],
            letters: lettersSaid(b.scheme?.letters ?? DEFAULT_LETTERS),
            moderation: b.scheme?.moderationRequired ?? false,
          },
        );
      },
      (e: unknown) => { if (live) setBook(e instanceof Error ? e.message : 'Could not load this gradebook.'); },
    );
    return () => { live = false; };
  }, [course, term, reads]);

  /** One write through its attempt: said in words, a retry kept for an unknown outcome. */
  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<boolean> {
      setBusy(true);
      setSaid(null);
      try {
        const v = await attempt(what, run);
        const text = done(v);
        setSaid({ tone: 'ok', text });
        say(text);
        setReads((n) => n + 1);
        return true;
      } catch (e) {
        const text = e instanceof Error ? e.message : 'That was not saved.';
        setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void write(what, run, done) });
        return false;
      } finally {
        setBusy(false);
      }
  }

  const model = useMemo(() => (book && typeof book === 'object' ? asGradebook(book) : null), [book]);

  if (typeof book === 'string') {
    return (
      <>
        <Notice alert>{book} Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
          Load again
        </button>
      </>
    );
  }
  if (book === null || model === null || schemeForm === null) return <p role="status">Loading the {course} gradebook for {term}…</p>;

  const item = book.items.find((i) => i.id === itemId) ?? null;
  const categories = book.scheme?.categories ?? [];
  const students = [...new Set([...book.entries.map((e) => e.studentId), ...extra])].sort();
  const open = book.regrades.filter((r) => !book.resolutions.some((x) => x.requestId === r.id));

  const draftOf = (student: string): Draft => {
    const kept = drafts[`${itemId}:${student}`];
    if (kept) return kept;
    const cur = item ? current(model, item.id, student) : null;
    return { score: cur?.score == null ? '' : String(cur.score), mark: cur?.mark ?? '', comment: cur?.comment ?? '', reason: '' };
  };
  const setDraft = (student: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [`${itemId}:${student}`]: { ...draftOf(student), ...patch } }));

  const saveScore = async (student: string) => {
    if (!item) return;
    const d = draftOf(student);
    const score = d.score.trim() === '' ? null : Number(d.score);
    const ok = await write(
      `enter:${item.id}:${student}:${d.score}:${d.mark}:${d.comment}:${d.reason}`,
      (key) => enterScore({ itemId: item.id, studentId: student, score, mark: d.mark || null, comment: d.comment, reason: d.reason }, key),
      (v) => `Saved as a draft of ${item.title} for student ${shortId(student)} (version ${v}). The student cannot see it until it is released.`,
    );
    if (ok) setDrafts((all) => { const next = { ...all }; delete next[`${item.id}:${student}`]; return next; });
  };

  const schemeDraft: Scheme = { categories: schemeForm.categories, letters: readLetters(schemeForm.letters), moderationRequired: schemeForm.moderation };
  const problems = schemeProblems(schemeDraft);

  const saveScheme = async (e: FormEvent) => {
    e.preventDefault();
    if (problems.length) return;
    await write(`scheme:${course}:${term}:${JSON.stringify(schemeDraft)}`, (key) => setScheme(course, term, schemeDraft, key), (v) => `The grading scheme for ${course} is saved (version ${v}).`);
  };

  const saveItem = async (e: FormEvent) => {
    e.preventDefault();
    const f = itemForm;
    const category = f.category || book.scheme?.categories[0]?.key || '';
    const ok = await write(
      `item:${course}:${term}:${category}:${f.title}:${f.points}:${f.lineItem}`,
      (key) => addItem(course, term, { categoryKey: category, title: f.title.trim(), pointsPossible: Number(f.points), lineItem: f.lineItem.trim() || null }, key),
      () => `${f.title.trim()} is added to ${course}.`,
    );
    if (ok) setItemForm({ category, title: '', points: '10', lineItem: '' });
  };

  const csv = async () => {
    setBusy(true);
    setSaid(null);
    try {
      const list = await exportRows(course, term);
      download({ name: `${course.replace(/\s+/g, '-')}-${term}-released-grades.csv`, body: exportCsv(course, term, list), mime: 'text/csv' });
      const text = `Downloaded ${list.length} released ${list.length === 1 ? 'grade' : 'grades'} for ${course}. Drafts are never in the file.`;
      setSaid({ tone: 'ok', text });
      say(text);
    } catch (e) {
      setSaid({ tone: settled(e) ? 'refused' : 'unknown', text: e instanceof Error ? e.message : 'The export was not made.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Result said={said} />

      <SectionLabel>Grading scheme</SectionLabel>
      {book.scheme ? (
        <p>
          {book.scheme.categories.map((c) => `${c.name} ${c.weight}%${c.dropLowest ? ` (lowest ${c.dropLowest} dropped)` : ''}`).join(' · ')}.{' '}
          {book.scheme.moderationRequired ? 'A second instructor moderates each grade before it can be released.' : 'Grades can be released without moderation.'}
        </p>
      ) : (
        <EmptyState inline title="No grading scheme yet" body="Set the categories and their weights first. Items and scores come after." />
      )}
      {can('grades:release') && (
        <form onSubmit={(e) => void saveScheme(e)}>
          <Stack label="Categories and weights">
            {schemeForm.categories.map((c, i) => (
              <Row key={i} end>
                <Field label={`Category ${i + 1} name`}>
                  {(ids) => (
                    <input id={ids.id} aria-describedby={ids.hint}
                      className="input"
                      value={c.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setSchemeForm((s) => s && { ...s, categories: s.categories.map((x, j) => (j === i ? { ...x, name, key: book.items.some((it) => it.categoryKey === x.key) ? x.key : keyOf(name) } : x)) });
                      }}
                    />
                  )}
                </Field>
                <Field label="Weight (%)">
                  {(ids) => (
                    <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={0} max={100} step={0.001} value={c.weight} onChange={(e) => { const weight = Number(e.target.value); setSchemeForm((s) => s && { ...s, categories: s.categories.map((x, j) => (j === i ? { ...x, weight } : x)) }); }} />
                  )}
                </Field>
                <Field label="Drop lowest">
                  {(ids) => (
                    <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={0} step={1} value={c.dropLowest} onChange={(e) => { const dropLowest = Number.parseInt(e.target.value, 10) || 0; setSchemeForm((s) => s && { ...s, categories: s.categories.map((x, j) => (j === i ? { ...x, dropLowest } : x)) }); }} />
                  )}
                </Field>
                {schemeForm.categories.length > 1 && (
                  <button type="button" className="btn" onClick={() => setSchemeForm((s) => s && { ...s, categories: s.categories.filter((_, j) => j !== i) })}>
                    Remove {c.name || `category ${i + 1}`}
                  </button>
                )}
              </Row>
            ))}
            <Row>
              <button type="button" className="btn" onClick={() => setSchemeForm((s) => s && { ...s, categories: [...s.categories, { key: `category-${s.categories.length + 1}`, name: '', weight: 0, dropLowest: 0 }] })}>
                Add a category
              </button>
            </Row>
            <Field label="Letter scale" hint="Letters with the lowest percentage that earns each, highest first, ending at 0.">
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.hint} className="input" value={schemeForm.letters} onChange={(e) => setSchemeForm((s) => s && { ...s, letters: e.target.value })} />
              )}
            </Field>
            <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
              <input type="checkbox" checked={schemeForm.moderation} onChange={(e) => setSchemeForm((s) => s && { ...s, moderation: e.target.checked })} />
              A second instructor moderates each grade before release
            </label>
            {/* Always in the document, so the reader is already watching when a problem appears; polite, because it changes per keystroke. */}
            <div role="status">
              {problems.length > 0 && <Sub>{problems.join(' ')}</Sub>}
            </div>
            <Row>
              <button type="submit" className="btn" disabled={busy || problems.length > 0}>
                Save the scheme
              </button>
            </Row>
          </Stack>
        </form>
      )}

      <SectionLabel aside={book.items.length ? `${book.items.length} items` : undefined}>Items</SectionLabel>
      {book.items.length === 0 ? (
        <EmptyState inline title="No items yet" body={book.scheme ? 'Add the first assignment or exam to grade.' : 'Set the grading scheme, then add items to it.'} />
      ) : (
        <Field label="Item to grade">
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {book.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title} · {i.pointsPossible} points
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {can('grades:release') && book.scheme && (
        <form onSubmit={(e) => void saveItem(e)}>
          <Stack label="Add an item">
            <Row end>
              <Field label="New item title">
                {(ids) => (
                  <input id={ids.id} aria-describedby={ids.hint} className="input" value={itemForm.title} onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))} required />
                )}
              </Field>
              <Field label="Category">
                {(ids) => (
                  <select id={ids.id} aria-describedby={ids.hint} className="input" value={itemForm.category || categories[0]?.key} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}>
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Points possible">
                {(ids) => (
                  <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={0.001} step="any" value={itemForm.points} onChange={(e) => setItemForm((f) => ({ ...f, points: e.target.value }))} required />
                )}
              </Field>
            </Row>
            <Field label="Learning-system column (optional)" hint="Where passback sends this item's released scores. Leave empty to keep it out of passback.">
              {(ids) => (
                <input id={ids.id} aria-describedby={ids.hint} className="input" value={itemForm.lineItem} onChange={(e) => setItemForm((f) => ({ ...f, lineItem: e.target.value }))} />
              )}
            </Field>
            <Row>
              <button type="submit" className="btn" disabled={busy || !itemForm.title.trim()}>
                Add the item
              </button>
            </Row>
          </Stack>
        </form>
      )}

      {item && (
        <>
          <SectionLabel>Scores for {item.title}</SectionLabel>
          {can('grades:release') && (
            <Row>
              <ActionButton
                tone="primary"
                disabled={busy}
                style={{ width: 'auto', flex: '1 1 auto' }}
                onClick={() => void write(`release:${item.id}`, (key) => release(item.id, key), (r) => `${r.released} ${r.released === 1 ? 'grade' : 'grades'} for ${item.title} released to students.${r.held ? ` ${r.held} still wait for moderation.` : ''}`)}
              >
                Release grades for {item.title}
              </ActionButton>
            </Row>
          )}
          {students.length === 0 ? (
            <EmptyState inline title="No students with a grade yet" body="Add a student by their account id below. Semester checks they are enrolled in this course before it saves a score." />
          ) : (
            <div className="integration-table-wrap">
              <table className="integration-table">
                <caption className="sr-only">
                  Scores for {item.title}, out of {item.pointsPossible}. One row per student.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Now</th>
                    <th scope="col">Score of {item.pointsPossible}</th>
                    <th scope="col">Mark</th>
                    <th scope="col">Comment and save</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const cur = current(model, item.id, s);
                    const shown = latestReleased(model, item.id, s);
                    const d = draftOf(s);
                    const who = `student ${shortId(s)}`;
                    const needsReason = !!shown;
                    const canModerate = can('grades:moderate') && cur?.status === 'draft' && cur.gradedBy !== me;
                    return (
                      <tr key={s}>
                        <th scope="row">{shortId(s)}</th>
                        <td>
                          {cur ? (
                            <>
                              {cur.score ?? '—'}
                              {cur.mark ? ` · ${MARK_SAID[cur.mark]}` : ''}
                              <Sub>{STATUS_SAID[cur.status]}</Sub>
                              {shown && cur.status !== 'released' && <Sub>The student still sees {shown.score ?? MARK_SAID[shown.mark ?? 'missing']}.</Sub>}
                            </>
                          ) : (
                            'No grade yet'
                          )}
                        </td>
                        <td>
                          <input className="input" inputMode="decimal" aria-label={`Score for ${who}`} value={d.score} onChange={(e) => setDraft(s, { score: e.target.value })} />
                        </td>
                        <td>
                          <select className="input" aria-label={`Mark for ${who}`} value={d.mark} onChange={(e) => setDraft(s, { mark: e.target.value as Mark | '' })}>
                            <option value="">None</option>
                            {MARKS.map((m) => (
                              <option key={m} value={m}>
                                {MARK_SAID[m]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Stack>
                            <input className="input" aria-label={`Comment for ${who}`} placeholder="Comment" value={d.comment} onChange={(e) => setDraft(s, { comment: e.target.value })} />
                            {needsReason && (
                              <input className="input" aria-label={`Reason for changing a released grade for ${who}`} placeholder="Reason for the change" value={d.reason} onChange={(e) => setDraft(s, { reason: e.target.value })} />
                            )}
                            <Row>
                              {can('grades:enter') && (
                                <button type="button" className="btn" disabled={busy || (needsReason && !d.reason.trim())} onClick={() => void saveScore(s)}>
                                  Save draft for {shortId(s)}
                                </button>
                              )}
                              {canModerate && (
                                <button type="button" className="btn" disabled={busy} onClick={() => void write(`moderate:${item.id}:${s}:${cur!.version}`, (key) => moderate(item.id, s, key), () => `Moderated ${item.title} for ${who}.`)}>
                                  Moderate {shortId(s)}
                                </button>
                              )}
                            </Row>
                          </Stack>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {can('grades:enter') && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const id = newStudent.trim();
                if (id) setExtra((x) => (x.includes(id) ? x : [...x, id]));
                setNewStudent('');
              }}
            >
              <Row end>
                <Field label="Add a student by account id">
                  {(ids) => (
                    <input id={ids.id} aria-describedby={ids.hint} className="input" value={newStudent} onChange={(e) => setNewStudent(e.target.value)} />
                  )}
                </Field>
                <button type="submit" className="btn" disabled={!newStudent.trim()}>
                  Add the student
                </button>
              </Row>
            </form>
          )}
          {can('grades:release') && (
            <Row>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void write(`passback:${item.id}`, (key) => queuePassback(item.id, key), (r) => r.said)}
              >
                Send {item.title} to your learning system
              </button>
            </Row>
          )}
        </>
      )}

      <SectionLabel aside={open.length ? `${open.length} open` : undefined}>Regrade requests</SectionLabel>
      {open.length === 0 ? (
        <EmptyState inline title="No open requests" body="When a student asks for a released grade to be looked at again, it appears here." />
      ) : (
        <Rows label="Open regrade requests">
          {open.map((r) => {
            const it = book.items.find((i) => i.id === r.itemId);
            const f = resolving[r.id] ?? { outcome: 'upheld' as const, score: '', note: '' };
            const setF = (patch: Partial<typeof f>) => setResolving((all) => ({ ...all, [r.id]: { ...f, ...patch } }));
            return (
              <RowItem key={r.id}>
                <div>
                  <strong>{it?.title ?? 'An item'}</strong> · student {shortId(r.studentId)}
                  <Sub>“{r.reason}”</Sub>
                </div>
                {can('grades:enter') && (
                  <Stack label={`Resolve the request on ${it?.title ?? 'this item'}`}>
                    <Field label="Outcome">
                      {(ids) => (
                        <select id={ids.id} aria-describedby={ids.hint} className="input" value={f.outcome} onChange={(e) => setF({ outcome: e.target.value as 'upheld' | 'changed' })}>
                          <option value="upheld">Keep the grade</option>
                          <option value="changed">Change the grade</option>
                        </select>
                      )}
                    </Field>
                    {f.outcome === 'changed' && (
                      <Field label={`New score of ${it?.pointsPossible ?? ''}`} hint="Saved as a draft; release it like any other.">
                        {(ids) => (
                          <input id={ids.id} aria-describedby={ids.hint} className="input" inputMode="decimal" value={f.score} onChange={(e) => setF({ score: e.target.value })} />
                        )}
                      </Field>
                    )}
                    <Field label="Note to the student" hint="The student reads this.">
                      {(ids) => (
                        <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={2} value={f.note} onChange={(e) => setF({ note: e.target.value })} />
                      )}
                    </Field>
                    <Row>
                      <button
                        type="button"
                        className="btn"
                        disabled={busy || !f.note.trim() || (f.outcome === 'changed' && f.score.trim() === '')}
                        onClick={() =>
                          void write(
                            `resolve:${r.id}:${f.outcome}:${f.score}:${f.note}`,
                            (key) => resolveRegrade({ requestId: r.id, outcome: f.outcome, score: f.outcome === 'changed' ? Number(f.score) : null, mark: null, note: f.note }, key),
                            () => (f.outcome === 'changed' ? 'The request is resolved and the new score is saved as a draft.' : 'The request is resolved and the grade stands.'),
                          )
                        }
                      >
                        Resolve the request
                      </button>
                    </Row>
                  </Stack>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}

      {can('grades:export') && (
        <>
          <SectionLabel>Export</SectionLabel>
          <p>The file holds each student’s latest released grade on each item, and nothing still in draft.</p>
          <Row>
            <button type="button" className="btn" disabled={busy} onClick={() => void csv()}>
              Download released grades (CSV)
            </button>
          </Row>
        </>
      )}
    </>
  );
}
