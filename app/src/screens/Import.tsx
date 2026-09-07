import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { backupOf } from '../lib/export';
import { takeSnapshot } from '../lib/snapshots';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, TickBox } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { troubleOf, useTrouble } from '../lib/trouble';
import { gather } from '../lib/bundle';
import { extractText, type Extracted } from '../lib/extract';
import { generateCourse, type GenerationResult } from '../lib/generate';
import { packSummary, provenance, readPack } from '../lib/handoff';
import { configured, provider } from '../lib/claude';
import { readTerm } from '../lib/term';
import {
  diff,
  keepIds,
  movedLine,
  summary as rediffSummary,
  ticksKept,
  type Diff,
} from '../lib/rediff';
import { arrivedByShare, forgetShare, takeShared } from '../lib/shared';
import { blankCourse } from '../lib/edit';

/**
 * Upload a syllabus, get a course.
 *
 * The prototype faked this screen — a progress bar and a canned list of dates.
 * This is the real thing: the files are read in the browser, sent once to
 * Claude, and what comes back is checked before it is shown. Nothing is saved
 * until the student has seen what was found and what was thrown away.
 *
 * Readings are worth uploading alongside the syllabus. A syllabus alone gives
 * deadlines and a topic list; the readings are where the cards come from.
 */
export function Import() {
  const { state, dispatch, say } = useStore();
  const rowEleven = useRowStyle(11);
  const [files, setFiles] = useState<Extracted[]>([]);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState('');
  const trouble = useTrouble();
  const [result, setResult] = useState<GenerationResult | null>(null);
  /**
   * Dates the person has taken off the import, before it happens.
   *
   * A syllabus is prose and a parser reading one will occasionally file the
   * professor's office hours as a deadline, or split one assignment into two.
   * Until now the only answers to that were to accept it and delete the row
   * afterwards — inside the course, where the quote that would tell you which
   * row was wrong is no longer beside it — or to abandon the import. Neither
   * is review. This is: untick it here, where the sentence it came from is
   * still on screen, and it is never added.
   *
   * Kept as the exception rather than the selection, so it empties itself
   * whenever a new result arrives and the default is always "take all of it".
   */
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const shared = useRef<HTMLInputElement>(null);

  // A syllabus shared in from Brightspace or Mail arrives here already
  // chosen. Runs once: `takeShared` deletes as it reads, so a second pass
  // finds nothing rather than adding the file twice. See `lib/shared.ts`.
  useEffect(() => {
    if (!arrivedByShare()) return;
    let alive = true;
    void takeShared().then((shared) => {
      forgetShare();
      if (!alive || shared.length === 0) return;
      void addFiles(shared);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The picker hands back a FileList; a share hands back an array. */
  const add = (list: FileList | null) => (list?.length ? addFiles(Array.from(list)) : undefined);

  const addFiles = async (chosen: File[]) => {
    if (chosen.length === 0) return;
    trouble.clear();
    setBusy('Opening what you picked…');

    // A zip is unpacked rather than refused: nobody has one syllabus, they
    // have a download folder and whatever the professor posted.
    const got = await gather(chosen);
    if (got.skipped.length > 0) {
      // Picking them again would skip them again — a .pages file is still a
      // .pages file on the second go — so this is said without a retry.
      trouble.wrong(
        `Left out: ${got.skipped.map((sk) => `${sk.name} (${sk.why})`).join('; ')}.`,
      );
    }

    for (const piece of got.files) {
      setBusy(`Reading ${piece.name}…`);
      try {
        const extracted = await extractText(piece.file);
        setFiles((f) => [...f.filter((x) => x.name !== extracted.name), extracted]);
      } catch (e) {
        // One unreadable file should not abandon the other nine, so this is
        // added to whatever is already showing rather than replacing it.
        trouble.add(`${piece.name}: ${troubleOf(e) ?? 'could not be read.'}`);
      }
    }
    setBusy('');
  };

  // The term a new course lands in. Defaults to the one the app is showing,
  // which is what somebody importing in September means, and is changeable
  // before it is saved because August imports of a spring course happen.
  const term = readTerm(state.term);

  /**
   * A shared course, opened.
   *
   * It lands in `result` like a generated one, so the review, the diff
   * against a course you already have, and the confirm are all the same
   * code. The provenance sentence rides in the notes list the preview
   * already shows, which is where the reasons a generated course was
   * adjusted appear — the right place for "this came from someone else".
   */
  const openShared = async (file: File | null) => {
    if (!file) return;
    trouble.clear();
    setResult(null);
    setDropped(new Set());
    setBusy('Opening it…');
    try {
      const opened = readPack(await file.text());
      if (!opened.module) {
        trouble.wrong(opened.trouble);
        return;
      }
      // Slot 0 is the preview's kicker — short, uppercase, the same shape a
      // generated course gets. The provenance is prose and belongs in the
      // list under it.
      setDropped(new Set());
      setResult({
        module: opened.module,
        notes: [packSummary(opened), provenance(opened)],
      });
    } catch (e) {
      trouble.failed(e, () => void openShared(file));
    } finally {
      setBusy('');
    }
  };

  const build = async () => {
    if (files.length === 0) return;
    trouble.clear();
    setResult(null);
    setDropped(new Set());
    setBusy('Reading the syllabus…');
    abort.current = new AbortController();
    try {
      const built = await generateCourse(
        { documents: files, hint, year: term.year },
        abort.current.signal,
      );
      setDropped(new Set());
      setResult(built);
    } catch (e) {
      // The extracted text is still held, so a second run costs the upload
      // nothing — only the request.
      trouble.failed(e, () => void build());
    } finally {
      setBusy('');
    }
  };

  /**
   * The course you already have that this import looks like a new copy of.
   *
   * Matched on the course code, which is the one thing that does not get
   * re-worded between two printings of the same syllabus. Only your own
   * courses — the four samples are compiled in and cannot be replaced.
   */
  const existing = result
    ? state.courses.find(
        (c: (typeof state.courses)[number]) =>
          c.course.code.trim().toLowerCase() === result.module.course.code.trim().toLowerCase(),
      )
    : undefined;

  const changes = useMemo(
    () => (existing && result ? diff(existing, result.module, term.year) : null),
    [existing, result, term.year],
  );

  const save = () => {
    if (!result) return;
    // A copy of the account first, because this is the change most worth
    // being able to undo an hour later: a model read a PDF and is about to
    // rewrite a course, and a re-import that got the weights wrong is not
    // something anybody notices until the grade projection looks strange.
    // Not awaited — the import must happen whether or not the copy did.
    void takeSnapshot('import', backupOf(state) as unknown as Record<string, unknown>);
    // What the person actually approved. Dropping a date here drops it before
    // it is ever a row in the course, so nothing has to be tidied up after.
    const reviewed = {
      ...result.module,
      items: result.module.items.filter((i) => !dropped.has(i.id)),
    };
    // Replacing rather than adding, when it is the same course, and with the
    // surviving items keeping the ids their ticks are filed under — otherwise
    // a re-import silently un-ticks everything already done.
    if (existing) {
      const merged = keepIds(existing, reviewed);
      dispatch({ type: 'replaceCourse', module: merged });
      dispatch({ type: 'openCourse', id: merged.course.id });
      return;
    }
    // Stamped with the term it was imported into, so its dates resolve to the
    // right year and it does not follow you into next semester.
    const filed = {
      ...reviewed,
      course: { ...reviewed.course, term: reviewed.course.term ?? term.id },
    };
    dispatch({ type: 'addCourse', module: filed });
    // The screen changes underneath, which is no confirmation at all if you
    // are not looking at it.
    say(
      `${filed.course.code} imported. ${filed.items.length} dated ${
        filed.items.length === 1 ? 'obligation' : 'obligations'
      }.`,
    );
    dispatch({ type: 'openCourse', id: filed.course.id });
  };

  const words = files.reduce((n, f) => n + f.words, 0);

  return (
    <Page>
      <div className="chrome-text" style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 1.08 }}>
        Upload it. Walk away.
      </div>
      <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.72, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
        The syllabus gives the dates and how the grade is built. Add the readings and you get the
        study guide too — cards, terms and a self-test made from what they actually argue.
      </div>

      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.csv,.html,.zip,text/*,application/pdf,application/zip"
        style={{ display: 'none' }}
        onChange={(e) => void add(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => input.current?.click()}
        disabled={busy !== ''}
        style={{ height: 46, fontSize: 'calc(12px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 16 }}
      >
        {busy ? busy : 'Choose files — PDF, Word, text, or a zip of them'}
      </button>

      {/* The other door in. A course somebody has already generated arrives
          as a file and needs no upload and no request — but it goes through
          exactly the same review as a course generated here, including the
          diff against a course you already hold, because a shared course can
          be from a different section with different dates. */}
      <input
        ref={shared}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          void openShared(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="bare tappable"
        onClick={() => shared.current?.click()}
        disabled={busy !== ''}
        style={{
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          opacity: 0.65,
          marginTop: 10,
          width: 'auto',
          padding: '6px 0',
          textAlign: 'left',
        }}
      >
        …or open a course somebody shared with you
      </button>

      <ByHand />

      {files.map((f) => (
        <div
          key={f.name}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'baseline',
            ...rowEleven,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {f.name}
          </span>
          <span style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, flex: 'none' }}>
            {f.words.toLocaleString()} words
          </span>
          <button
            type="button"
            className="bare"
            onClick={() => setFiles((list) => list.filter((x) => x.name !== f.name))}
            style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
          >
            REMOVE
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <>
          <SectionLabel>Anything it should know</SectionLabel>
          <input
            className="input"
            placeholder="Optional — “the midterm moved to Oct 8”, “skip chapter 4”"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
          />

          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy !== ''}
            onClick={() => void build()}
            style={{
              height: 50,
              fontSize: 'calc(15px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 14,
            }}
          >
            {busy && !busy.startsWith('Reading ') ? busy : `Build the course from ${words.toLocaleString()} words`}
          </button>

          {busy && !busy.startsWith('Reading ') && (
            <button
              type="button"
              className="bare"
              onClick={() => abort.current?.abort()}
              style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.55, letterSpacing: '0.1em', marginTop: 10 }}
            >
              STOP
            </button>
          )}
        </>
      )}

      {!configured() && (
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.65, marginTop: 12, lineHeight: 1.5, textWrap: 'pretty' }}>
          Building a course asks {provider()} to read the documents, which needs a key. Set one under{' '}
          <strong>Ask Claude → Settings</strong>, or sign in and use the shared one.
        </div>
      )}

      {/* The files are still read and still in state, so the retry costs
          nothing already spent — which is the whole reason a dead end here
          was the worst one in the app. */}
      <Trouble
        said={trouble.said}
        onRetry={trouble.again}
        label="Try building it again"
        busy={busy !== ''}
      />

      {result && changes && existing ? (
        <Rediff
          changes={changes}
          kept={ticksKept(existing, result.module, state.done)}
          code={result.module.course.code}
        />
      ) : null}
      {result && (
        <Preview
          result={result}
          onSave={save}
          replacing={Boolean(existing)}
          dropped={dropped}
          onToggle={(id) =>
            setDropped((was) => {
              const next = new Set(was);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      )}</Page>
  );
}

/**
 * Adding a course without a syllabus and without a model.
 *
 * Every way into this app went through an upload and a generation, which
 * meant adding a course required three things that have nothing to do with
 * having a course: a PDF, a working key, and Anthropic being up. A student
 * who joined a seminar in week two, or whose professor mailed the schedule as
 * a paragraph, or who simply never set a key, could not add it at all — the
 * planner refused the thing it exists to do.
 *
 * This is one field and one button. What it makes is a real course, owned and
 * editable, with the same id an import of that code would produce — so the
 * syllabus can still be imported over it later and every tick and grade filed
 * against it survives the upgrade.
 */
function ByHand() {
  const { state, dispatch, say } = useStore();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const term = readTerm(state.term);
  const taken = state.courses.some(
    (c) => c.course.id === blankCourse(code).course.id && code.trim() !== '',
  );

  const make = () => {
    const clean = code.trim();
    if (!clean || taken) return;
    const module = blankCourse(clean, term.id);
    dispatch({ type: 'addCourse', module });
    say(`${clean} added. Fill in the rest here — nothing is required.`);
    dispatch({ type: 'openCourse', id: module.course.id });
    dispatch({ type: 'go', screen: 'edit' });
  };

  if (!open) {
    return (
      <button
        type="button"
        className="bare tappable"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          opacity: 0.65,
          marginTop: 4,
          width: 'auto',
          padding: '6px 0',
          textAlign: 'left',
        }}
      >
        …or add a course by hand, with no syllabus
      </button>
    );
  }

  return (
    <Blueprint style={{ padding: 14, marginTop: 12 }}>
      <SectionLabel>Add it by hand</SectionLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          className="input"
          autoFocus
          placeholder="ECON 1020"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') make();
          }}
          style={{ flex: 1, minWidth: 0, fontSize: 'calc(14px * var(--text-scale, 1))' }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={make}
          disabled={code.trim() === '' || taken}
          style={{
            flex: 'none',
            width: 'auto',
            padding: '0 18px',
            fontSize: 'calc(12px * var(--text-scale, 1))',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Add
        </button>
      </div>
      <div
        style={{
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.65,
          marginTop: 10,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {taken
          ? `You already have ${code.trim()}. Open it and edit it, or import its syllabus over the top.`
          : `The code is all it needs. Everything else — the name, the professor, when it meets, what
             is due — you fill in next, and you can import the syllabus over this later without
             losing anything you have ticked off.`}
      </div>
    </Blueprint>
  );
}

/**
 * What a re-import would change, before it changes it.
 *
 * Importing a syllabus twice used to replace the course wholesale and say
 * nothing, so the safe thing to do with a corrected syllabus was nothing —
 * and a course updated mid-term stayed wrong on purpose. Removals are listed
 * first because they are what a person actually loses.
 */
function Rediff({
  changes,
  kept,
  code,
}: {
  changes: Diff;
  kept: { kept: number; lost: number };
  code: string;
}) {
  const line = (label: string, right: string) => (
    <div
      key={`${label}-${right}`}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'baseline',
        padding: '9px 0',
        borderBottom: '1px solid var(--app-line-soft)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>{label}</span>
      <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6 }}>{right}</span>
    </div>
  );

  return (
    <>
      <SectionLabel>You already have {code}</SectionLabel>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="chrome-text" style={{ fontSize: 'calc(20px * var(--text-scale, 1))', lineHeight: 1.2, textWrap: 'pretty' }}>
          {rediffSummary(changes)}
        </div>
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 7, lineHeight: 1.5 }}>
          {changes.same} unchanged. Saving replaces the course you have rather than adding a second
          copy of it.
        </div>
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.5 }}>
          {kept.lost === 0
            ? `Everything you have ticked off stays ticked${kept.kept > 0 ? ` — all ${kept.kept} of them` : ''}.`
            : `${kept.kept} of your ticks carry over; ${kept.lost} ${kept.lost === 1 ? 'belongs' : 'belong'} to a deadline this syllabus no longer has.`}
          {' '}Cards and drill history are keyed to the question text and are untouched.
        </div>
      </Blueprint>

      {changes.removed.length > 0 && (
        <>
          <SectionLabel>Gone from the new syllabus</SectionLabel>
          {changes.removed.map((i) => line(i.title, `${i.month + 1}/${i.day}`))}
        </>
      )}

      {changes.moved.length > 0 && (
        <>
          <SectionLabel>Moved</SectionLabel>
          {changes.moved.map((m) =>
            line(m.after.title, `${m.before.month + 1}/${m.before.day} → ${m.after.month + 1}/${m.after.day} · ${movedLine(m)}`),
          )}
        </>
      )}

      {changes.added.length > 0 && (
        <>
          <SectionLabel>New</SectionLabel>
          {changes.added.map((i) => line(i.title, `${i.month + 1}/${i.day}`))}
        </>
      )}

      {changes.renamed.length > 0 && (
        <>
          <SectionLabel>Reworded, same date</SectionLabel>
          {changes.renamed.map((r) => line(r.after.title, 'was ' + r.before.title))}
        </>
      )}

      {(changes.reweighted.length > 0 ||
        changes.gradingAdded.length > 0 ||
        changes.gradingRemoved.length > 0) && (
        <>
          <SectionLabel>How the grade is built</SectionLabel>
          {changes.reweighted.map((r) => line(r.what, `${r.before} → ${r.after}`))}
          {changes.gradingRemoved.map((r) => line(r.what, `${r.pct} · gone`))}
          {changes.gradingAdded.map((r) => line(r.what, `${r.pct} · new`))}
        </>
      )}

      {changes.fields.length > 0 && (
        <>
          <SectionLabel>The course itself</SectionLabel>
          {changes.fields.map((f) => line(f.field, `${f.before || '—'} → ${f.after || '—'}`))}
        </>
      )}
    </>
  );
}

/** What was found, what was dropped, and the chance to say no. */
function Preview({
  result,
  onSave,
  replacing = false,
  dropped,
  onToggle,
}: {
  result: GenerationResult;
  onSave: () => void;
  replacing?: boolean;
  /** Dates taken off the import. See the state in `Import`. */
  dropped: Set<string>;
  onToggle: (id: string) => void;
}) {
  const rowTen = useRowStyle(10);
  const { module: m, notes } = result;
  const [summary, ...warnings] = notes;
  const keeping = m.items.filter((i) => !dropped.has(i.id)).length;

  return (
    <>
      <SectionLabel>What came back</SectionLabel>
      <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
        <div className="chrome-text" style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 1.1 }}>
          {m.course.code}
        </div>
        <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 3 }}>{m.course.name}</div>
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6, lineHeight: 1.5 }}>
          {[m.course.prof, m.course.meets, m.course.room, m.course.credits]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.7,
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--app-line)',
          }}
        >
          {summary}
        </div>
      </Blueprint>

      {warnings.length > 0 && (
        <>
          <SectionLabel>Worth knowing</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {warnings.map((w) => (
              <div key={w} style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.45, textWrap: 'pretty' }}>
                · {w}
              </div>
            ))}
          </div>
        </>
      )}

      <SectionLabel>The dates it found</SectionLabel>
      {/*
        All of them, and each one refusable.

        This showed the first eight and then asked you to accept thirty. The
        eight were the reassuring part and the other twenty-two were the ones
        with the mistakes in, because a parser goes wrong further down a
        syllabus than it does at the top.

        Untick anything wrong here rather than deleting it from the course
        later. Here, the sentence it was read out of is still next to it, which
        is the only thing that tells you whether it is wrong.
      */}
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 4, lineHeight: 1.5 }}>
        {m.items.length} found
        {dropped.size > 0 ? ` \u00b7 ${dropped.size} taken off \u00b7 ${keeping} will be added` : ' \u00b7 untick anything the syllabus does not say'}
      </div>
      {m.items.map((i) => {
        const off = dropped.has(i.id);
        return (
          <button
            key={i.id}
            type="button"
            className="bare tappable"
            onClick={() => onToggle(i.id)}
            aria-pressed={!off}
            aria-label={off ? `Put ${i.title} back` : `Take ${i.title} off this import`}
            style={{ ...rowTen, width: '100%', textAlign: 'left', display: 'block', opacity: off ? 0.4 : 1 }}
          >
            <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ flex: 'none', alignSelf: 'center' }}>
                <TickBox on={!off} size={18} />
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(12px * var(--text-scale, 1))',
                  opacity: 0.55,
                  width: 54,
                  flex: 'none',
                }}
              >
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i.month]} {i.day}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'calc(14px * var(--text-scale, 1))',
                  lineHeight: 1.3,
                  textDecoration: off ? 'line-through' : 'none',
                }}
              >
                {i.title}
              </span>
            </span>
            {i.quote && (
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.5,
                  marginTop: 4,
                  lineHeight: 1.45,
                  paddingLeft: 92,
                }}
              >
                “{i.quote}”
              </span>
            )}
          </button>
        );
      })}

      <SectionLabel>The first unit</SectionLabel>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(16px * var(--text-scale, 1))' }}>{m.guide.units[0]?.name}</div>
      {(m.guide.units[0]?.cards ?? []).slice(0, 2).map((c) => (
        <div key={c.q} style={{ marginTop: 8 }}>
          <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', fontWeight: 600, lineHeight: 1.35 }}>{c.q}</div>
          <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.78, lineHeight: 1.5, marginTop: 2 }}>{c.a}</div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={onSave}
        style={{
          height: 50,
          fontSize: 'calc(15px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 18,
        }}
      >
        {/* The count on the button, because it is the number that changed
            and the button is what commits it. */}
        {replacing
          ? `Replace ${m.course.code} — ${keeping} ${keeping === 1 ? 'date' : 'dates'}`
          : `Add ${m.course.code} — ${keeping} ${keeping === 1 ? 'date' : 'dates'}`}
      </button>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 10, lineHeight: 1.5 }}>
        {replacing
          ? 'The changes above are what this replaces. Your ticks and your drill history stay where they are.'
          : 'You can add readings to it later, and everything you add flows into the cards, the quiz and the slides at once.'}
        {dropped.size > 0
          ? ` The ${dropped.size} you took off ${dropped.size === 1 ? 'is' : 'are'} not added at all — re-import the syllabus to get ${dropped.size === 1 ? 'it' : 'them'} back.`
          : ''}
      </div>
    </>
  );
}
