import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { download, zipOf } from '../../lib/deliver';
import { formatDateTime } from '../../lib/locale';
import { exportItems, importItems, type ItemKind, type QtiItem } from '../../lib/assessments/qti3';
import {
  KIND_WORDS, addItem, closeTest, createBank, createTest, grantTime, loadAttempts, loadBanks, loadItems, loadTests, publishTest, retireItem,
  type AttemptRow, type Bank, type BankItem, type Test,
} from '../../lib/assessments/client';
import { ActionButton, EmptyState, FilePick, Notice, SectionLabel } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
const iso = (local: string): string => new Date(local).toISOString();

const BLANK_ITEM = { kind: 'multiple_choice' as ItemKind, stem: '', options: '', correct: '', points: '1' };
const BLANK_TEST = { title: '', instructions: '', minutes: '30', opens: '', closes: '', attempts: '1', pool: '', showAnswers: false, shuffle: false };

/** The options box holds one option per line; the id is its position (a, b, c…). */
const optionList = (box: string): { id: string; text: string }[] =>
  box.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10).map((text, i) => ({ id: String.fromCharCode(97 + i), text }));

/** Builds the item the server's key shape wants from the form, or says what is missing. */
export function itemFromForm(f: typeof BLANK_ITEM): QtiItem | string {
  const stem = f.stem.trim();
  const points = Number(f.points);
  if (!stem) return 'Write the question.';
  if (!(points > 0)) return 'Points must be more than zero.';
  const correct = f.correct.trim();
  if (f.kind === 'multiple_choice' || f.kind === 'multiple_response') {
    const options = optionList(f.options);
    if (options.length < 2) return 'Give at least two options, one per line.';
    const letters = correct.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (letters.length === 0 || letters.some((l) => !options.some((o) => o.id === l))) return `Name the correct option by its letter (a to ${options[options.length - 1].id}).`;
    if (f.kind === 'multiple_choice' && letters.length !== 1) return 'A multiple-choice question has one correct option.';
    return { kind: f.kind, stem, options, key: f.kind === 'multiple_choice' ? { correct: letters[0] } : { correct: letters }, points };
  }
  if (f.kind === 'true_false') {
    if (!/^(true|false)$/i.test(correct)) return 'Write true or false as the answer.';
    return { kind: 'true_false', stem, options: [], key: { correct: correct.toLowerCase() === 'true' }, points };
  }
  if (f.kind === 'numeric') {
    const [v, tol] = correct.split(/[±,;]/).map((x) => Number(x.trim()));
    if (!Number.isFinite(v)) return 'Write the answer as a number, then optionally ± a tolerance.';
    return { kind: 'numeric', stem, options: [], key: { value: v, tolerance: Number.isFinite(tol) ? Math.abs(tol) : 0 }, points };
  }
  if (f.kind === 'short_answer') {
    const accepted = correct.split('|').map((x) => x.trim()).filter(Boolean);
    if (accepted.length === 0) return 'Write the accepted answers, separated by |.';
    return { kind: 'short_answer', stem, options: [], key: { accepted }, points };
  }
  return { kind: 'essay', stem, options: [], key: {}, points };
}

/**
 * An instructor's question banks and tests for one course and term: write
 * questions (or import QTI 3, with every omission said), draw a test from the
 * bank or a random pool of it, publish and close it, and grant one student
 * extra time. Scores here are figures on an attempt; they do not become grades
 * (the gradebook releases those, by an instructor). The database decides who
 * may and what is accepted.
 */
export function InstructorTests({ school, course, term }: { school: string; course: string; term: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [banks, setBanks] = useState<Bank[] | string | null>(null);
  const [bank, setBank] = useState('');
  const [items, setItems] = useState<BankItem[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [reads, setReads] = useState(0);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const [bankTitle, setBankTitle] = useState('');
  const [item, setItem] = useState(BLANK_ITEM);
  const [form, setForm] = useState(BLANK_TEST);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [grant, setGrant] = useState<{ test: string; student: string; percent: string; reason: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const b = await loadBanks(school, course, term);
        const t = await loadTests(school, course, term);
        const a = await loadAttempts(t.map((x) => x.id));
        const chosen = b.find((x) => x.id === bank)?.id ?? b[0]?.id ?? '';
        const it = chosen ? await loadItems(chosen) : [];
        if (live) { setBanks(b); setBank(chosen); setItems(it); setTests(t); setAttempts(a); }
      } catch (e) { if (live) setBanks(e instanceof Error ? e.message : 'The banks could not be read.'); }
    })();
    return () => { live = false; };
    // `bank` is read to keep the chosen bank across a refresh, not to trigger one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school, course, term, reads]);

  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<boolean> {
    setBusy(true); setSaid(null);
    try {
      const v = await attempt(what, run);
      const t = done(v);
      setSaid({ tone: 'ok', text: t }); say(t);
      setReads((n) => n + 1);
      return true;
    } catch (e) {
      const t = e instanceof Error ? e.message : 'That was not saved.';
      setSaid(e instanceof ServiceError && !e.answered ? { tone: 'unknown', text: t, retry: () => void write(what, run, done) } : { tone: 'refused', text: t });
      return false;
    } finally { setBusy(false); }
  }

  const live = items.filter((i) => !i.retired);

  async function importFiles(files: File[]) {
    if (!bank) return;
    const docs = await Promise.all(files.map(async (f) => ({ name: f.name, xml: await f.text() })));
    const r = importItems(docs);
    setWarnings(r.warnings);
    let added = 0;
    for (const [n, it] of r.items.entries()) {
      try { await addItem(bank, it, `import.${Date.now().toString(36)}.${n}.${Math.random().toString(36).slice(2, 8)}`); added += 1; }
      catch (e) { setWarnings((w) => [...w, `${it.stem.slice(0, 40)}…: ${e instanceof Error ? e.message : 'not added'}`]); }
    }
    setSaid({ tone: added > 0 ? 'ok' : 'refused', text: `${added} question${added === 1 ? '' : 's'} imported${r.warnings.length ? `; ${r.warnings.length} omitted or refused (below)` : ''}.` });
    setReads((n) => n + 1);
  }

  async function exportBank() {
    const docs = exportItems(live.map((i) => ({ kind: i.kind, stem: i.stem, options: i.options, key: i.key, points: i.points })));
    const blob = await zipOf(docs.map((d) => ({ name: d.name, body: d.xml, mime: 'application/xml' })));
    download({ name: `${course.replace(/\s+/g, '')}-${term}-questions-qti3.zip`, body: blob, mime: 'application/zip' });
  }

  const addForm = itemFromForm(item);
  const poolN = form.pool.trim() === '' ? null : Number(form.pool);
  const testReady = bank !== '' && form.title.trim() !== '' && form.opens !== '' && form.closes !== '' && (poolN !== null ? poolN >= 1 : live.length > 0);

  return (
    <section aria-label="Tests">
      <SectionLabel>Tests · {course} · {term}</SectionLabel>
      <Result said={said} />
      {banks === null && <p role="status">Reading this course’s banks…</p>}
      {typeof banks === 'string' && <p role="alert">{banks}</p>}

      <SectionLabel>Question bank</SectionLabel>
      {Array.isArray(banks) && banks.length > 0 && (
        <Field label="Bank">
          {(ids) => <select id={ids.id} className="input" value={bank} onChange={(e) => { setBank(e.target.value); setReads((n) => n + 1); }}>{banks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select>}
        </Field>
      )}
      <Row end>
        <Field label="New bank">{(ids) => <input id={ids.id} className="input" value={bankTitle} maxLength={200} onChange={(e) => setBankTitle(e.target.value)} />}</Field>
        <ActionButton disabled={busy || !bankTitle.trim()} onClick={() => void write(`bank:${course}:${term}:${bankTitle}`, (k) => createBank(course, term, bankTitle.trim(), k), () => 'Bank created.').then((ok) => { if (ok) setBankTitle(''); })}>Create the bank</ActionButton>
      </Row>

      {bank && (
        <>
          {live.length === 0 ? <EmptyState inline title="No questions yet" body="Write one below, or import QTI 3 files." /> : (
            <Rows label="Questions">
              {live.map((i) => (
                <RowItem key={i.id}>
                  <div>{i.stem} <Sub>{KIND_WORDS[i.kind]} · {i.points} point{i.points === 1 ? '' : 's'}</Sub></div>
                  <Row><ActionButton tone="ghost" disabled={busy} onClick={() => void write(`retire:${i.id}`, (k) => retireItem(i.id, k), () => 'Question retired.')}>Retire</ActionButton></Row>
                </RowItem>
              ))}
            </Rows>
          )}
          <Row>
            <FilePick multiple accept=".xml,application/xml,text/xml" tone="secondary" block={false} onPick={(f) => void importFiles(f)}>Import QTI 3 files</FilePick>
            <ActionButton tone="ghost" disabled={live.length === 0} onClick={() => void exportBank()}>Export as QTI 3</ActionButton>
          </Row>
          {warnings.length > 0 && (
            <Notice>
              <strong>Not imported:</strong>
              <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </Notice>
          )}
          <Stack label="New question">
            <Field label="Kind">
              {(ids) => (
                <select id={ids.id} className="input" value={item.kind} onChange={(e) => setItem({ ...BLANK_ITEM, kind: e.target.value as ItemKind })}>
                  {(Object.keys(KIND_WORDS) as ItemKind[]).map((k) => <option key={k} value={k}>{KIND_WORDS[k]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Question">{(ids) => <textarea id={ids.id} className="input" rows={3} value={item.stem} onChange={(e) => setItem({ ...item, stem: e.target.value })} />}</Field>
            {(item.kind === 'multiple_choice' || item.kind === 'multiple_response') && (
              <Field label="Options" hint="One per line; they are lettered a, b, c… in order.">{(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={4} value={item.options} onChange={(e) => setItem({ ...item, options: e.target.value })} />}</Field>
            )}
            {item.kind !== 'essay' && (
              <Field label="Correct answer" hint={{ multiple_choice: 'The letter, such as b.', multiple_response: 'The letters, such as a, c.', true_false: 'true or false.', numeric: 'A number, optionally ± a tolerance: 3.14 ± 0.01.', short_answer: 'Accepted answers, separated by |. Case and extra spaces are ignored.' }[item.kind]}>
                {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={item.correct} onChange={(e) => setItem({ ...item, correct: e.target.value })} />}
              </Field>
            )}
            <Field label="Points">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={item.points} onChange={(e) => setItem({ ...item, points: e.target.value })} />}</Field>
            {typeof addForm === 'string' && item.stem.trim() !== '' && <Sub>{addForm}</Sub>}
            <ActionButton tone="primary" disabled={busy || typeof addForm === 'string'} onClick={() => typeof addForm !== 'string' && void write(`item:${bank}:${item.stem}`, (k) => addItem(bank, addForm, k), () => 'Question added.').then((ok) => { if (ok) setItem({ ...BLANK_ITEM, kind: item.kind }); })}>Add the question</ActionButton>
          </Stack>
        </>
      )}

      <SectionLabel>Tests</SectionLabel>
      {tests.length === 0 && <EmptyState inline title="No tests yet" body="Draw one from the bank below. A student sees it only once you publish it." />}
      {tests.length > 0 && (
        <Rows label="Tests">
          {tests.map((t) => {
            const mine = attempts.filter((a) => a.assessmentId === t.id);
            return (
              <RowItem key={t.id}>
                <div><strong>{t.title}</strong> · {t.status}</div>
                <Sub>{t.poolSize ? `${t.poolSize} drawn at random` : `${t.itemCount} named questions`} · {t.minutes} minutes · {at(t.opensAt)} to {at(t.closesAt)} · {t.attempts} attempt{t.attempts === 1 ? '' : 's'} · {mine.length} started, {mine.filter((a) => a.needsReview).length} with essays to read</Sub>
                <Row>
                  {t.status === 'draft' && <ActionButton disabled={busy} onClick={() => void write(`publish:${t.id}`, (k) => publishTest(t.id, k), () => `${t.title} is published.`)}>Publish</ActionButton>}
                  {t.status === 'published' && <ActionButton disabled={busy} onClick={() => void write(`close:${t.id}`, (k) => closeTest(t.id, k), () => `${t.title} is closed.`)}>Close</ActionButton>}
                  {t.status !== 'draft' && <ActionButton tone="ghost" onClick={() => setGrant(grant?.test === t.id ? null : { test: t.id, student: '', percent: '50', reason: '' })}>Give a student extra time</ActionButton>}
                </Row>
                {grant?.test === t.id && (
                  <Stack label={`Extra time for ${t.title}`}>
                    <Field label="Student’s account id" hint="From the roster in the gradebook.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={grant.student} onChange={(e) => setGrant({ ...grant, student: e.target.value.trim() })} />}</Field>
                    <Field label="Extra time, percent of the limit">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={grant.percent} onChange={(e) => setGrant({ ...grant, percent: e.target.value })} />}</Field>
                    <Field label="Reason" hint="A reference, such as “approved by the access office”. Not a diagnosis.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" maxLength={200} value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} />}</Field>
                    <ActionButton tone="primary" disabled={busy || !grant.student || !grant.reason.trim() || !(Number(grant.percent) >= 1)} onClick={() => void write(`time:${t.id}:${grant.student}:${grant.percent}`, (k) => grantTime(t.id, grant.student, Number(grant.percent), grant.reason, k), () => 'Extra time granted.').then((ok) => { if (ok) setGrant(null); })}>Grant the time</ActionButton>
                  </Stack>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}

      {bank && (
        <Stack label="New test">
          <Field label="Title">{(ids) => <input id={ids.id} className="input" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
          <Field label="Instructions">{(ids) => <textarea id={ids.id} className="input" rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />}</Field>
          <Row end>
            <Field label="Opens">{(ids) => <input id={ids.id} className="input" type="datetime-local" value={form.opens} onChange={(e) => setForm({ ...form, opens: e.target.value })} />}</Field>
            <Field label="Closes">{(ids) => <input id={ids.id} className="input" type="datetime-local" value={form.closes} onChange={(e) => setForm({ ...form, closes: e.target.value })} />}</Field>
          </Row>
          <Row end>
            <Field label="Minutes">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />}</Field>
            <Field label="Attempts">{(ids) => <select id={ids.id} className="input" value={form.attempts} onChange={(e) => setForm({ ...form, attempts: e.target.value })}>{[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>}</Field>
            <Field label="Draw at random (optional)" hint={`Leave empty to use all ${live.length} questions in the bank.`}>{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" inputMode="numeric" value={form.pool} onChange={(e) => setForm({ ...form, pool: e.target.value })} />}</Field>
          </Row>
          <label style={{ display: 'block' }}><input type="checkbox" checked={form.shuffle} onChange={(e) => setForm({ ...form, shuffle: e.target.checked })} /> Shuffle the order</label>
          <label style={{ display: 'block' }}><input type="checkbox" checked={form.showAnswers} onChange={(e) => setForm({ ...form, showAnswers: e.target.checked })} /> Show students what was right after the test closes</label>
          <ActionButton
            tone="primary"
            disabled={busy || !testReady}
            onClick={() => void write(`create:${bank}:${form.title}:${form.opens}`, (k) => createTest(bank, {
              title: form.title.trim(), instructions: form.instructions, itemIds: poolN === null ? live.map((i) => i.id) : null, poolSize: poolN,
              minutes: Number(form.minutes) || 30, opensAt: iso(form.opens), closesAt: iso(form.closes), attempts: Number(form.attempts), shuffle: form.shuffle, showAnswers: form.showAnswers,
            }, k), () => 'Saved as a draft. Publish it when students should see it.').then((ok) => { if (ok) setForm(BLANK_TEST); })}
          >
            Save as a draft
          </ActionButton>
        </Stack>
      )}
    </section>
  );
}
