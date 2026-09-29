import { useEffect, useMemo, useState } from 'react';
import { FilePick, Notice } from './ui';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import {
  DOCUMENTS,
  EMPTY_TRANSFER_CREDIT,
  MAX_COURSES,
  STATUS_MEANING,
  STATUS_TEXT,
  TRANSFER_CREDIT_KEY,
  evaluate,
  newCourseId,
  packet,
  parsePathway,
  readTransferCredit,
  totals,
  type Rule,
  type Status,
} from '../lib/transfer-credit';

const TEMPLATE = 'from_institution,from_course,to_course,credits\nNashville State CC,CSC 1010,CS 101,3\n';
const ORDER: Status[] = ['published', 'estimated', 'pending_review', 'not_evaluated'];

type Load = 'idle' | 'loading' | 'ready' | 'unavailable';

/**
 * The transfer credit workspace, on The degree.
 *
 * `loadPublished` reads the school's approved equivalencies; it is passed in
 * (null when nobody is signed in) so the screen works device-only and the
 * tests never need an account.
 */
export function TransferCredit({
  school,
  loadPublished,
}: {
  school: string | null;
  loadPublished: (() => Promise<Rule[]>) | null;
}) {
  const library = useDeviceLibrary(TRANSFER_CREDIT_KEY, readTransferCredit, EMPTY_TRANSFER_CREDIT);
  const data = library.value;
  // The result of the last read, keyed by the loader it came from, so a
  // loader that changes (sign in, sign out) reads as loading or idle during
  // render rather than through a state update inside the effect.
  const [result, setResult] = useState<{ from: (() => Promise<Rule[]>) | null; ok: boolean; rules: Rule[] }>({
    from: null,
    ok: false,
    rules: [],
  });
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState({ institution: '', code: '', title: '', credits: '3', grade: '', term: '' });

  useEffect(() => {
    if (!loadPublished) return;
    let live = true;
    loadPublished().then(
      (rules) => {
        if (live) setResult({ from: loadPublished, ok: true, rules });
      },
      () => {
        if (live) setResult({ from: loadPublished, ok: false, rules: [] });
      },
    );
    return () => {
      live = false;
    };
  }, [loadPublished]);

  const current = loadPublished !== null && result.from === loadPublished;
  const load: Load = !loadPublished ? 'idle' : !current ? 'loading' : result.ok ? 'ready' : 'unavailable';
  const published = useMemo(() => (current ? result.rules : []), [current, result.rules]);

  const rows = useMemo(() => evaluate(data, published), [data, published]);
  const t = totals(rows);
  const text = packet(data, rows, school);

  const add = () => {
    const credits = Number(draft.credits);
    if (!draft.institution.trim() || !draft.code.trim()) {
      setStatus('Add the school and the course code.');
      return;
    }
    if (!Number.isFinite(credits) || credits < 0 || credits > 30) {
      setStatus('Credits must be a number between 0 and 30.');
      return;
    }
    if (data.courses.length >= MAX_COURSES) {
      setStatus(`You can list up to ${MAX_COURSES} prior courses.`);
      return;
    }
    const ok = library.update((d) => ({
      ...d,
      courses: [
        ...d.courses,
        {
          id: newCourseId(d.courses),
          institution: draft.institution.trim(),
          code: draft.code.trim(),
          title: draft.title.trim(),
          credits,
          grade: draft.grade.trim().slice(0, 10),
          term: draft.term.trim().slice(0, 40),
        },
      ],
    }));
    if (ok) {
      setDraft((d) => ({ ...d, code: '', title: '', grade: '', term: '' }));
      setStatus(`Added ${draft.code.trim()}.`);
    }
  };

  const importPathway = async (file: File) => {
    try {
      const rules = parsePathway(await file.text());
      if (library.update((d) => ({ ...d, imported: rules }))) {
        setStatus(`Imported ${rules.length} pathway rows. They are labelled estimated — your school has not confirmed them here.`);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'The pathway file could not be read.');
    }
  };

  return (
    <div className="portal-workspace transfer-credit">
      {library.error ? (
        <Notice alert>
          {library.error}
          <button
            onClick={() => download({ name: 'Semester transfer credit recovery.json', body: library.recovery(), mime: 'application/json' })}
          >
            Download recovery copy
          </button>
        </Notice>
      ) : null}

      <section className="portal-panel" aria-labelledby="tc-intro">
        <span className="portal-eyebrow">Transfer credit</span>
        <h3 id="tc-intro">Prepare your credit evaluation</h3>
        <p className="portal-muted">
          List what you took before. Semester shows what each might count as here and builds the packet for your
          official evaluation. Only {school ?? 'your school'} decides what transfers.
        </p>
        <p className="portal-muted" role="status">
          {load === 'ready'
            ? `${published.length} published equivalenc${published.length === 1 ? 'y' : 'ies'} from ${school ?? 'your school'}.`
            : load === 'loading'
              ? 'Checking your school’s published equivalencies…'
              : load === 'unavailable'
                ? 'Your school’s published equivalencies could not be read right now. Matches below use only what you entered or imported.'
                : 'Sign in with your school account to match against the equivalencies your school has published.'}
        </p>
        <div className="portal-stats" aria-label="Transfer credit summary">
          {ORDER.map((s) => (
            <div key={s}>
              <strong>{t.byStatus[s].credits} cr</strong>
              <span>
                {STATUS_TEXT[s]} · {t.byStatus[s].courses} course{t.byStatus[s].courses === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="portal-panel" aria-labelledby="tc-add">
        <h3 id="tc-add">Add a course you took</h3>
        <div className="portal-filter-row">
          <label className="portal-check">
            Previous school
            <input className="input" value={draft.institution} maxLength={200} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} />
          </label>
          <label className="portal-check">
            Course code
            <input className="input" value={draft.code} maxLength={60} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </label>
          <label className="portal-check">
            Title
            <input className="input" value={draft.title} maxLength={200} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
        </div>
        <div className="portal-filter-row">
          <label className="portal-check">
            Credits
            <input className="input" type="number" inputMode="decimal" min={0} max={30} value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: e.target.value })} />
          </label>
          <label className="portal-check">
            Grade
            <input className="input" value={draft.grade} maxLength={10} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} />
          </label>
          <label className="portal-check">
            Term taken
            <input className="input" value={draft.term} maxLength={40} onChange={(e) => setDraft({ ...draft, term: e.target.value })} />
          </label>
        </div>
        <div className="portal-actions">
          <button className="portal-primary" onClick={add}>
            Add course
          </button>
        </div>
      </section>

      <section className="portal-panel" aria-labelledby="tc-list">
        <h3 id="tc-list">Your prior courses</h3>
        {rows.length === 0 ? (
          <p className="portal-muted">Nothing listed yet. Start with the courses on your unofficial transcript.</p>
        ) : (
          rows.map((r) => (
            <article key={r.course.id} className="portal-panel">
              <h4>
                {r.course.code} {r.course.title ? `· ${r.course.title}` : ''}
              </h4>
              <p className="portal-muted">
                {r.course.institution}
                {r.course.term ? ` · ${r.course.term}` : ''} · {r.course.credits} credits
                {r.course.grade ? ` · grade ${r.course.grade}` : ''}
              </p>
              <p>
                <span className="portal-tag">{STATUS_TEXT[r.status]}</span>{' '}
                {r.toCourse ? <strong>Might count as {r.toCourse}</strong> : null}
              </p>
              <p className="portal-muted">{STATUS_MEANING[r.status]}</p>
              {r.rule?.source !== 'institution_verified' ? (
                <div className="portal-filter-row">
                  <label className="portal-check">
                    What you think it counts as
                    <input
                      className="input"
                      maxLength={60}
                      value={data.guesses[r.course.id]?.toCourse ?? ''}
                      placeholder={r.rule?.toCourse ?? 'e.g. CS 101'}
                      onChange={(e) =>
                        library.update((d) => ({
                          ...d,
                          guesses: { ...d.guesses, [r.course.id]: { toCourse: e.target.value, note: d.guesses[r.course.id]?.note ?? '' } },
                        }))
                      }
                    />
                  </label>
                  <label className="portal-check">
                    Note for the evaluator
                    <input
                      className="input"
                      maxLength={500}
                      value={data.guesses[r.course.id]?.note ?? ''}
                      onChange={(e) =>
                        library.update((d) => ({
                          ...d,
                          guesses: { ...d.guesses, [r.course.id]: { toCourse: d.guesses[r.course.id]?.toCourse ?? '', note: e.target.value } },
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
              <div className="portal-actions">
                <button
                  aria-label={`Remove ${r.course.code} from ${r.course.institution}`}
                  onClick={() =>
                    library.update((d) => {
                      const guesses = { ...d.guesses };
                      delete guesses[r.course.id];
                      return { ...d, courses: d.courses.filter((c) => c.id !== r.course.id), guesses };
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="portal-panel" aria-labelledby="tc-pathway">
        <h3 id="tc-pathway">Import a published pathway</h3>
        <p className="portal-muted">
          If your old school or a state transfer site publishes an equivalency list, import it as CSV. Matches from it
          are labelled estimated, because Semester cannot check a file with your school.
          {data.imported.length ? ` ${data.imported.length} rows imported.` : ''}
        </p>
        <div className="portal-actions">
          <FilePick block={false} multiple={false} accept=".csv,text/csv" onPick={(files) => { if (files[0]) void importPathway(files[0]); }}>
            Import pathway CSV
          </FilePick>
          <button onClick={() => download({ name: 'Semester transfer pathway template.csv', body: TEMPLATE, mime: 'text/csv' })}>
            Download template
          </button>
          {data.imported.length ? (
            <button onClick={() => library.update((d) => ({ ...d, imported: [] }))}>Remove imported pathway</button>
          ) : null}
        </div>
      </section>

      <section className="portal-panel" aria-labelledby="tc-docs">
        <h3 id="tc-docs">Documents for the evaluation</h3>
        <ul className="regday-checklist">
          {DOCUMENTS.map((d) => (
            <li key={d.id}>
              <label className="portal-check">
                <input
                  type="checkbox"
                  checked={data.documents.includes(d.id)}
                  onChange={() =>
                    library.update((x) => ({
                      ...x,
                      documents: x.documents.includes(d.id) ? x.documents.filter((y) => y !== d.id) : [...x.documents, d.id],
                    }))
                  }
                />
                <span>
                  <strong>{d.label}</strong>
                  <small className="portal-block">{d.why}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="portal-panel" aria-labelledby="tc-packet">
        <h3 id="tc-packet">Your evaluation packet</h3>
        <pre className="regday-list">{text}</pre>
        <div className="portal-actions">
          <button
            className="portal-primary"
            onClick={() => download({ name: 'Semester transfer credit packet.txt', body: text, mime: 'text/plain' })}
          >
            Download packet
          </button>
        </div>
        <div className="portal-filter-row">
          <label className="portal-check">
            Date I sent it for official evaluation
            <input
              className="input"
              type="date"
              value={data.submittedOn ?? ''}
              onChange={(e) => library.update((d) => ({ ...d, submittedOn: e.target.value || null }))}
            />
          </label>
        </div>
        <p className="portal-muted">
          Semester does not send this for you. Submit it the way {school ?? 'your school'}’s transfer or registrar
          office asks, and record the date here so your matches read as pending review.
        </p>
        {status ? (
          <p className="portal-notice" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </div>
  );
}
