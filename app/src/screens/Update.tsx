import type { CSSProperties } from 'react';
import { useMemo, useRef, useState } from 'react';
import { Capture } from '../components/Capture';
import { RecordButton } from '../components/RecordButton';
import { Rework } from '../components/Rework';
import { configured, provider, readMaterial, readShots } from '../lib/claude';
import { extractText } from '../lib/extract';
import { classify, guess, KIND_LABEL, SURE, type Verdict as Told } from '../lib/classify';
import { alreadyAdded, hashOf, materialHash, type Intake } from '../lib/intake';
import { harvest, type Where } from '../lib/harvest';
import { anything, piecesFrom, type Pasted } from '../lib/pasted';
import { describe as houseOf, styleFor } from '../lib/house';
import { findGaps } from '../lib/gaps';
import { diff, type Change, type ChangeSet, type Held } from '../lib/changeset';
import { adopt } from '../lib/adoptpieces';
import { ReviewSheet } from '../components/ReviewSheet';
import type { ShotFile } from '../lib/shots';
import type { StudyCard } from '../lib/types';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { Page } from '../components/Page';
import { SectionLabel } from '../components/ui';
import { addFile, formatBytes, type FileMeta } from '../lib/files';
import { gather } from '../lib/bundle';
import { describeParse, parseMaterial } from '../lib/parse';
import type { CourseId, Figure, Term } from '../lib/types';

/** No frames, no out-loud questions, no cases — the starting state and the reset. */
const NO_PARTS: StudyParts = { frames: [], selfTest: [], cases: [], examples: [] };
import { describeFigure } from '../lib/figure';
import { describeStudyParts, type StudyParts } from '../lib/study';

/** Handled by the camera path above, which can see them. */
const IMAGE = /\.(png|jpe?g|webp|gif|heic|heif)$/i;

/**
 * Enough text to be worth a request.
 *
 * A sentence typed into the box is not a reading, and asking the model to make
 * a study guide out of it wastes a call and returns nothing useful.
 */
const ENOUGH = 400;

/**
 * Add material to a course that is already in the app.
 *
 * A semester does not sit still: a reading gets posted in week six, a professor
 * hands out a sheet before the midterm. What is pasted here is parsed into
 * cards where it clearly is cards, kept as prose where it is not, and merged
 * into the guide for every study format at once — Cards, Read, Quiz, Cram,
 * Figures and the lesson slides all pick it up as soon as it is saved.
 *
 * Nothing is invented. Prose that does not split cleanly into a question and an
 * answer stays prose, because a made-up card gets drilled and believed.
 */
/** The explanatory line under a control on this screen. */
const HINT: CSSProperties = {
  fontSize: 'var(--type-sm)',
  opacity: 0.7,
  lineHeight: 'var(--leading-relaxed)',
  textWrap: 'pretty',
};

export function AddMaterial() {
  const { state, dispatch, catalog } = useStore();
  const courseId = state.guideId;
  const { guide, updates, figures, extras } = useLive(courseId);

  const claudeReady = configured();
  const [unit, setUnit] = useState<number | null>(state.updateUnit);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<ShotFile[]>([]);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState('');
  const [shotCards, setShotCards] = useState<StudyCard[]>([]);
  const [shotError, setShotError] = useState('');
  const [studying, setStudying] = useState(false);
  const [readCards, setReadCards] = useState<StudyCard[]>([]);
  const [readTerms, setReadTerms] = useState<Term[]>([]);
  const [readFigs, setReadFigs] = useState<Figure[]>([]);
  const [readLong, setReadLong] = useState<StudyParts>(NO_PARTS);
  const [readSummary, setReadSummary] = useState('');
  const [readError, setReadError] = useState('');

  /*
   * The one intake, and the review that follows it.
   *
   * `arrived` is what was read out of the file; `told` is what the classifier
   * decided it is; `set` is what it would change about this course. Nothing
   * is written while any of these are set — the sheet at the bottom is the
   * only thing that writes, and only what has been ticked.
   */
  const [arrived, setArrived] = useState<Intake | null>(null);
  const [told, setTold] = useState<Told | null>(null);
  const [set, setSet] = useState<ChangeSet | null>(null);
  const [saidOf, setSaidOf] = useState('');
  const [droppedBy, setDroppedBy] = useState<string[]>([]);
  /**
   * Where a *pasted* set of changes came from.
   *
   * The file path carries this on `arrived` and `told`. Pasted text has no
   * file and no classifier, so it says so plainly rather than borrowing a
   * filename it does not have.
   */
  const [pastedAs, setPastedAs] = useState<Where | null>(null);
  const [looking, setLooking] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseMaterial(text), [text]);

  /*
   * Whether this exact material is already in the course.
   *
   * The file path has always compared hashes — see `held()` below. The paste
   * path did not, so pasting the same reading twice, which is what happens
   * when you are not sure the first one saved, made two copies of it and
   * doubled every count in the app.
   */
  const mine = useMemo(
    () => materialHash([text, ...shotCards.map((c) => `${c.q} ${c.a}`), ...files.map((f) => f.name)]),
    [text, shotCards, files],
  );
  const already = alreadyAdded(updates, courseId, mine);
  const empty =
    parsed.cards.length === 0 &&
    parsed.terms.length === 0 &&
    !parsed.body &&
    !files.length &&
    shotCards.length === 0 &&
    readFigs.length === 0 &&
    describeStudyParts(readLong) === '' &&
    readCards.length === 0;

  /**
   * What this course is still missing.
   *
   * Recomputed on every render, which means after every import — it is a pure
   * function of the course and costs nothing. See `lib/gaps.ts`.
   */
  const gaps = useMemo(() => {
    const module_ = catalog.moduleById[courseId];
    return module_ ? findGaps(module_, updates) : [];
  }, [catalog.moduleById, courseId, updates]);

  /** What the model is told about the course, so it files things correctly. */
  const context = `${guide.code} — ${guide.name}\nUnits:\n${guide.units
    .map((u, i) => `${i + 1}. ${u.name}`)
    .join('\n')}`;

  /** Read the photographs and hold the cards until the whole thing is saved. */
  const readPhotos = async () => {
    if (shots.length === 0 || reading) return;
    setReading(true);
    setShotError('');
    try {
      const got = await readShots(
        shots.map((sh) => sh.shot),
        context,
      );
      setReadNote(got.note);
      setShotCards(got.cards);
      if (got.cards.length === 0 && !got.note) {
        setShotError('Nothing came back from those photos. Nothing was added.');
      }
    } catch (e) {
      setShotError(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  };

  /**
   * Turn the reading itself into cards and terms.
   *
   * `parseMaterial` only finds what is already written as a question and an
   * answer. A journal article is not, so a reading used to add a file and
   * nothing else. This reads the prose the way the camera path reads a board.
   */
  const readInto = async () => {
    if (text.trim().length < ENOUGH || studying) return;
    setStudying(true);
    setReadError('');
    try {
      const got = await readMaterial(text, context);
      setReadSummary(got.note);
      setReadCards(got.cards);
      setReadTerms(got.terms);
      setReadFigs(got.figures);
      const long = {
        frames: got.frames,
        selfTest: got.selfTest,
        cases: got.cases,
        examples: got.examples,
      };
      setReadLong(long);
      if (
        got.cards.length === 0 &&
        got.terms.length === 0 &&
        got.figures.length === 0 &&
        describeStudyParts(long) === '' &&
        !got.note
      ) {
        setReadError('Nothing came back from that. It is still attached and kept as notes.');
      }
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e));
    } finally {
      setStudying(false);
    }
  };

  /**
   * What this course already holds, in the shape the comparison needs.
   *
   * `useLive` merges the syllabus module with everything added since, which is
   * exactly what a new file has to be compared against — otherwise the second
   * deck duplicates the first.
   */
  const held = (): Held => ({
    guide,
    items: catalog.moduleById[courseId]?.items ?? [],
    updates,
    grading: catalog.byId[courseId]?.grading ?? [],
    // The hash, not the filename. A deck re-posted as "Session 7
    // (updated).pptx" is the same material under a different name, and
    // comparing names would call all of it new.
    sources: updates.map((u) => u.sourceHash ?? '').filter(Boolean),
    // Both merged, so a second copy of a figure or a worked example is
    // recognised as a second copy rather than proposed as new.
    examples: guide.examples,
    figures: [...Object.values(figures).filter(Boolean), ...extras] as Figure[],
  });

  /**
   * Read one file all the way to a change set, and write nothing.
   *
   * The three steps are separate on purpose: what it is, what is in it, and
   * what that would change here. Each can be wrong in its own way and each is
   * shown before the next one runs on it.
   */
  const look = async (item: Intake) => {
    setLooking(true);
    setReadError('');
    setSet(null);
    try {
      const first = guess(item);
      setTold(first);
      setArrived(item);
      // Below the threshold the free pass is not an answer, it is a guess.
      // The model is asked only then, which is what keeps eleven files at
      // once from being eleven requests.
      const verdict = first.confidence >= SURE ? first : await classifyWith(item, first);
      setTold(verdict);
      // What this course's own cards look like, so a new one does not stand
      // out among them. See `lib/house.ts`.
      const got = await harvest(item, verdict.kind, context, styleFor(houseOf(guide, updates)));
      setSaidOf(got.says);
      setDroppedBy(got.dropped);
      setSet(diff(got.pieces, held()));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLooking(false);
    }
  };

  /** The model's opinion, when the free one was not confident enough. */
  const classifyWith = async (item: Intake, fallback: Told): Promise<Told> => {
    if (!claudeReady) return fallback;
    return classify(item, context);
  };

  /**
   * Write the ticked changes, and only those.
   *
   * One dispatch for the material and at most one for the course, so an import
   * is one entry in the undo history rather than forty.
   */
  const applyChanges = (accepted: Change[]) => {
    // Either origin. A file brings a name, a hash and a classifier's verdict;
    // a paste brings what the student typed above the box.
    const where: Where | null =
      arrived && told
        ? { source: arrived.name, sourceHash: arrived.hash, as: told.kind, at: Date.now() }
        : pastedAs;
    if (!where) return;
    const module_ = state.courses.find((c) => c.course.id === courseId) ?? null;
    const out = adopt(accepted, module_ ?? catalog.moduleById[courseId] ?? null, where);
    if (out.update) {
      dispatch({
        type: 'addUpdate',
        update: {
          ...out.update,
          courseId,
          /*
           * Files attached by hand carry no pieces of their own — they are the
           * material itself, kept, not a claim about the course — so there is
           * nothing to review about them and they ride along with whatever was
           * accepted. `adopt` returns none because the file path stores its
           * own separately.
           */
          fileIds: out.update.fileIds.length ? out.update.fileIds : files.map((f) => f.id),
          // The unit chosen above the box, when the reader chose one. `adopt`
          // can only infer a unit from a name that matches one the guide has.
          unit: out.update.unit ?? unit,
        },
      });
    }

    /*
     * Dates and weights need the course itself, and a sample course is built
     * into the app rather than stored.
     *
     * Announce already draws this line and says so on screen. Here the first
     * version did not: an accepted deadline on a sample course was quietly
     * dropped, and the only way to find out was to re-import the file and see
     * it offered again. Saying it beats a silent no.
     */
    if (out.module && module_) {
      dispatch({ type: 'replaceCourse', module: out.module });
    } else if (out.module) {
      setReadError(
        `The cards and terms were added. The ${out.provenance.addedItems.length === 1 ? 'deadline' : 'deadlines'} could not be — ${guide.code} is one of the sample courses built into the app, so its dates cannot be changed. Make it yours from the course screen first.`,
      );
      setSet(null);
      setArrived(null);
      setTold(null);
      setPastedAs(null);
      return;
    }

    setSet(null);
    setArrived(null);
    setTold(null);
    setPastedAs(null);
    dispatch({ type: 'back' });
  };

  /**
   * Take an import back out — the material and the dates it added.
   *
   * One import wrote at most one `CourseUpdate` and at most one changed
   * course, and `addedItems` on the update says which deadlines were its. So
   * undoing is those two writes reversed rather than a search for anything
   * that looks like it came from that file.
   *
   * What this does not yet restore is a row the import *replaced* — a
   * deadline whose date was overwritten by an accepted conflict. `adopt`
   * already returns the old rows under `provenance.replaced`; they are not
   * stored anywhere yet, so undoing a replacement removes the new row without
   * putting the old one back. Said here rather than left to be discovered.
   */
  const undoImport = (u: (typeof updates)[number]) => {
    dispatch({ type: 'deleteUpdate', id: u.id });
    const module_ = state.courses.find((c) => c.course.id === courseId);
    const added = u.addedItems ?? [];
    if (module_ && added.length > 0) {
      dispatch({
        type: 'replaceCourse',
        module: { ...module_, items: module_.items.filter((i) => !added.includes(i.id)) },
      });
    }
  };

  /**
   * Show what pasting would change, and write nothing.
   *
   * This used to dispatch straight to the store. A file has been reviewed
   * before it lands since the import pipeline existed, and pasted text — the
   * door with *less* provenance, since a file at least has a name and a hash —
   * had no review at all. Same diff, same sheet, same commit.
   */
  const review = () => {
    if (already) return;
    const where: Where = {
      source: source.trim() || title.trim() || 'What you pasted',
      sourceHash: mine,
      // Not a classifier's verdict, because nothing classified it. `reading`
      // is what pasted prose is, and the shape it is read into.
      as: 'reading',
      at: Date.now(),
    };
    const pasted: Pasted = {
      cards: [...parsed.cards, ...shotCards, ...readCards],
      terms: [...parsed.terms, ...readTerms],
      figures: readFigs,
      frames: readLong.frames,
      selfTest: readLong.selfTest,
      cases: readLong.cases,
      examples: readLong.examples,
      body: parsed.body,
      title: title.trim() || (unit !== null ? 'Added material' : 'New reading'),
      source: where.source,
    };
    if (!anything(pasted) && files.length === 0) return;

    setPastedAs(where);
    setSet(diff(piecesFrom(pasted, where), held()));
  };

  const pick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setReadNote('');

    // Zips are unpacked here too — a professor posting a week's readings as
    // one archive is the normal case, not an edge one.
    const got = await gather(Array.from(list));
    const added: FileMeta[] = [];
    const unread: string[] = [];
    const readable: Intake[] = [];

    for (const piece of got.files) {
      try {
        added.push(await addFile(piece.file, courseId));
      } catch {
        // Storage refused it — a private window, or the quota. Say nothing
        // here; the list simply will not show it.
      }

      /*
       * And read what is in it.
       *
       * This used to look only for `text/*`, which meant a PDF or a Word file
       * — the two things a reading actually arrives as — was attached and
       * never opened. The screen said the material was added, and every study
       * format carried on showing exactly what it had before. `extract.ts`
       * reads all three; it is the same path the syllabus import uses.
       *
       * Images are left out on purpose: they go through the camera path
       * above, which can actually see them.
       */
      if (IMAGE.test(piece.name)) continue;
      try {
        const out = await extractText(piece.file);
        if (out.text.trim()) {
          setText((t) => (t ? `${t}\n\n${out.text}` : out.text));
          readable.push({
            name: out.name,
            text: out.text,
            words: out.words,
            door: 'file',
            hash: hashOf(out.text),
            size: piece.file.size,
            ...(out.pages ? { pages: out.pages } : {}),
            ...(out.pdf ? { pdf: out.pdf } : {}),
          });
        }
      } catch (e) {
        // One unreadable file must not lose the rest of the batch. Named,
        // because a silent miss is how somebody studies from half a folder.
        unread.push(`${piece.name} (${e instanceof Error ? e.message : String(e)})`);
      }
    }

    setFiles((f) => [...f, ...added]);

    /*
     * One file is a thing to read; several are a folder to attach.
     *
     * The review sheet compares one source against one course, and stacking
     * three decks into one change set would produce a sheet nobody could
     * reason about — which of the three said the midterm moved? So the
     * pipeline runs on a single file and a batch keeps the old behaviour of
     * landing in the box above.
     */
    if (readable.length === 1) void look(readable[0]);

    const notes = [
      got.skipped.length > 0
        ? `Left out: ${got.skipped.map((sk) => `${sk.name} (${sk.why})`).join('; ')}.`
        : '',
      unread.length > 0 ? `Attached but not read: ${unread.join('; ')}` : '',
    ].filter(Boolean);
    if (notes.length > 0) setReadNote(notes.join('\n'));
    setBusy(false);
  };

  return (
    /*
      The 26px "Something new for ECON 1020" that stood here is gone, not
      moved. The app's header already prints this screen's title, so the line
      was the second heading on the page — the exact duplication `<Page>`
      refuses to reintroduce. The course is named in the save button and in
      the header's kicker, both of which were already saying it.
    */
    <Page
      blurb={
        <>
          <p style={{ margin: 0 }}>
            A chapter, a handout, a lecture, a recording. Paste it, attach it, photograph it, or
            record it — whatever reads as a question and an answer becomes cards, and the rest is
            kept as the unit's notes.
          </p>
          <p style={{ margin: 'var(--sp-4) 0 0' }}>
            You see what it would change before anything is written. Accept it and Cards, Quiz,
            Read, Cram and the slides for this course all
            include it. Nothing is regenerated and nothing you had is replaced — the new material
            is layered over the syllabus the course was built from, and anything you add is listed
            at the bottom of this screen where it can be taken out again.
          </p>
        </>
      }
    >

      <SectionLabel>Which course</SectionLabel>
      <div className="chiprow">
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          {catalog.courses.map((c) => {
            const on = c.id === courseId;
            return (
              <button
                key={c.id}
                type="button"
                className="btn"
                onClick={() => dispatch({ type: 'openUpdate', courseId: c.id as CourseId })}
                aria-pressed={on}
                style={{
                  flex: 'none',
                  padding: '5px 11px',
                  fontSize: 'var(--type-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: on ? 'var(--chrome)' : 'transparent',
                  color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                  borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                }}
              >
                {catalog.byId[c.id].code}
              </button>
            );
          })}
        </div>
      </div>

      <SectionLabel>Where it belongs</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <button
          type="button"
          className="bare tappable"
          onClick={() => setUnit(null)}
          style={{
            display: 'flex',
            gap: 'var(--sp-5)',
            padding: '11px 0',
            borderBottom: '1px solid var(--app-line)',
            textAlign: 'left',
            opacity: unit === null ? 1 : 0.55,
          }}
        >
          <span style={{ width: 26, flex: 'none', color: 'var(--app-accent)' }}>
            {unit === null ? '■' : '□'}
          </span>
          <span style={{ fontSize: 'var(--type-md)' }}>A unit of its own, placed by session</span>
        </button>
        {guide.units.map((u, i) => (
          <button
            key={u.name}
            type="button"
            className="bare tappable"
            onClick={() => setUnit(i)}
            style={{
              display: 'flex',
              gap: 'var(--sp-5)',
              padding: '11px 0',
              borderBottom: '1px solid var(--app-line)',
              textAlign: 'left',
              opacity: unit === i ? 1 : 0.55,
            }}
          >
            <span style={{ width: 26, flex: 'none', color: 'var(--app-accent)' }}>
              {unit === i ? '■' : '□'}
            </span>
            <span style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>{u.name}</span>
          </button>
        ))}
      </div>

      <SectionLabel>What it is</SectionLabel>
      <input
        className="input"
        placeholder="Trounstine ch. 4"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ fontSize: 'var(--type-md)' }}
      />
      <input
        className="input"
        placeholder="Where it came from — Brightspace, Oct 8 lecture"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-4)' }}
      />

      {/*
        What arrived, and what it was taken to be — before the change set
        below is worth reading. The class decides which shape the material is
        forced into, so a wrong one is cheapest to catch here.
      */}
      {told && arrived && (
        <>
          <SectionLabel>What you added</SectionLabel>
          <Blueprint plain style={{ padding: '11px 13px' }}>
            <div className="kicker">{arrived.name}</div>
            <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)', marginTop: 'var(--sp-2)' }}>
              {looking && !set
                ? `Reading it — this looks like ${told.says || KIND_LABEL[told.kind]}.`
                : `This is ${told.says || KIND_LABEL[told.kind]}${told.about ? ` — ${told.about}` : ''}.`}
            </div>
            {told.confidence < SURE && (
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-warn)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                It is not sure about that. Check it before taking anything below.
              </div>
            )}
            {told.because.length > 0 && (
              <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                because: {told.because.map((b) => `“${b}”`).join(', ')}
              </div>
            )}
          </Blueprint>
        </>
      )}

      {set && (arrived || pastedAs) && (
        <ReviewSheet
          set={set}
          says={arrived ? saidOf : readSummary}
          dropped={arrived ? droppedBy : []}
          source={arrived?.name ?? pastedAs?.source ?? 'what you pasted'}
          course={guide.code}
          onApply={applyChanges}
        />
      )}

      <SectionLabel>The material</SectionLabel>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Q: What does the four-hurdle test ask first?\nA: Is there a plausible causal mechanism?\n\nOr paste the reading and keep it as notes.'}
        style={{ minHeight: 190, fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' }}
        aria-label="New material"
      />
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.6,
          marginTop: 'var(--sp-3)',
        }}
      >
        {describeParse(parsed)}
      </div>

      {/*
        The step that makes an attached reading worth attaching.
        `parseMaterial` above finds cards only where the text is already
        written as a question and an answer; a chapter is not, and without this
        the guide gained a file and every study format stayed as it was.
      */}
      {text.trim().length >= ENOUGH && (
        <>
          {claudeReady ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                disabled={studying}
                onClick={() => void readInto()}
                style={{
                  height: 42,
                  marginTop: 'var(--sp-6)',
                  fontSize: 'var(--type-sm)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {studying ? 'Reading it…' : 'Make cards and terms from this'}
              </button>
              <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                {provider()} reads what you pasted or attached and writes cards and definitions from
                what is in it — nothing from general knowledge. Optional: the text is kept as the
                unit's notes either way.
              </div>
            </>
          ) : (
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
              Turning a reading into cards needs {provider()}. Sign in to use the shared key, or add
              your own under Connect → Claude. The text is still kept as the unit's notes.
            </div>
          )}
        </>
      )}

      {(readSummary ||
        readCards.length > 0 ||
        readTerms.length > 0 ||
        readFigs.length > 0 ||
        describeStudyParts(readLong) !== '') && (
        <Blueprint plain style={{ padding: '11px 13px', marginTop: 'var(--sp-6)' }}>
          <div className="kicker">What it read</div>
          {readSummary && (
            <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-2)' }}>
              {readSummary}
            </div>
          )}
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-3)' }}>
            {readCards.length} {readCards.length === 1 ? 'card' : 'cards'} and {readTerms.length}{' '}
            {readTerms.length === 1 ? 'term' : 'terms'} ready — they save with everything else below.
          </div>
          {/*
            Named one by one rather than counted. A figure is the one thing
            here that is drawn rather than read, so it is the one thing worth
            checking against the reading before it joins the guide and starts
            looking like something the course said.
          */}
          {describeStudyParts(readLong) !== '' && (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <div className="kicker">For the field guide and the cram sheet</div>
              <div style={{ fontSize: 'var(--type-sm)', opacity: 0.75, marginTop: 'var(--sp-2)' }}>
                {describeStudyParts(readLong)}
              </div>
            </div>
          )}
          {readFigs.length > 0 && (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              <div className="kicker">
                {readFigs.length === 1 ? 'A figure' : `${readFigs.length} figures`}, in the guide’s own
                formats
              </div>
              {readFigs.map((f, i) => (
                <div
                  key={i}
                  style={{ fontSize: 'var(--type-sm)', opacity: 0.75, marginTop: 'var(--sp-2)' }}
                >
                  {describeFigure(f)}
                </div>
              ))}
            </div>
          )}
        </Blueprint>
      )}

      {readError && (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            color: 'var(--app-accent)',
            marginTop: 'var(--sp-5)',
            lineHeight: 'var(--leading-normal)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {readError}
        </div>
      )}

      {parsed.cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'var(--sp-6)' }}>
          {parsed.cards.slice(0, 3).map((c) => (
            <Blueprint key={c.q} style={{ padding: '11px 13px' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)', lineHeight: 1.2 }}>
                {c.q}
              </div>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 'var(--leading-normal)', marginTop: 3 }}>
                {c.a}
              </div>
            </Blueprint>
          ))}
          {parsed.cards.length > 3 && (
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}>
              and {parsed.cards.length - 3} more
            </div>
          )}
        </div>
      )}

      {/*
        Photographing the board is the reason material never makes it into a
        study app: nobody types up a whiteboard. The picture goes to {provider()},
        which transcribes what is written and turns it into cards — and says so
        rather than filling in the parts that are out of focus.
      */}
      <SectionLabel>Photograph it</SectionLabel>
      {claudeReady ? (
        <>
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.62, lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-5)' }}>
            The board at the end of a lecture, a page of a textbook, a printed handout. Read into
            cards from what is actually written — anything unreadable is left out and said so.
          </div>
          <Capture shots={shots} onChange={setShots} label="Use the camera" />
          {shots.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={reading}
              onClick={() => void readPhotos()}
              style={{
                height: 44,
                marginTop: 'var(--sp-6)',
                fontSize: 'var(--type-sm)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {reading ? 'Reading the photos…' : `Read ${shots.length === 1 ? 'it' : 'them'}`}
            </button>
          )}
          {readNote && (
            <Blueprint plain style={{ padding: '11px 13px', marginTop: 'var(--sp-6)' }}>
              <div className="kicker">What it saw</div>
              <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-2)' }}>{readNote}</div>
              {shotCards.length > 0 && (
                <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-3)' }}>
                  {shotCards.length} {shotCards.length === 1 ? 'card' : 'cards'} ready — they save
                  with everything else below.
                </div>
              )}
            </Blueprint>
          )}
          {shotError && (
            <div
              style={{
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                color: 'var(--app-accent)',
                marginTop: 'var(--sp-5)',
                lineHeight: 'var(--leading-normal)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {shotError}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 'var(--leading-relaxed)' }}>
          Reading a photograph needs {provider()}. Sign in to use the shared key, or add your own under
          Connect → Claude. You can still attach the photo as a file below.
        </div>
      )}

      {/* A lecture, kept — and written down while it happens, which is the
          only kind of transcript a browser can make. The text drops straight
          into the box above, so what was said becomes material the same way a
          reading does. */}
      <SectionLabel>Record the lecture</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.62, lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-5)' }}>
        Keeps the audio against this course, and can write it down as it goes. The transcript lands
        in the material box above, where it becomes cards, a quiz and a guide like anything else.
      </div>
      <RecordButton
        courseId={courseId}
        label={guide.code}
        onSaved={(meta, seconds, transcript) => {
          setFiles((f) => [...f, meta]);
          if (!transcript) return;
          // Appended, never overwritten — you may have typed notes in there.
          setText((prior) =>
            prior.trim() ? `${prior.trim()}\n\n${transcript}` : transcript,
          );
          if (!title.trim()) setTitle(`Lecture · ${new Date().toLocaleDateString()}`);
          if (!source.trim()) setSource(`Recorded in class · ${Math.round(seconds / 60)} min`);
        }}
      />

      <SectionLabel>Files</SectionLabel>
      <input
        ref={fileInput}
        type="file"
        multiple
        onChange={(e) => void pick(e.target.files)}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => fileInput.current?.click()}
        style={{ height: 42, fontSize: 'var(--type-sm)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy ? 'Reading…' : 'Attach slides, a PDF, a photo of the board, or a zip'}
      </button>
      {files.map((f) => (
        <div
          key={f.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 'var(--sp-5)',
            fontSize: 'var(--type-base)',
            padding: '9px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
          <span style={{ opacity: 0.5, flex: 'none' }}>{formatBytes(f.size)}</span>
        </div>
      ))}
      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        Images become figures for the unit. A PDF, a Word file or a text file is read into the box
        above as well as attached, so what is in it can become cards. Everything stays on this
        device.
      </div>

      {/*
        Already here, so the button says so rather than making a second copy.
        Told before the press, not after: a message that appears once the
        damage is done is a receipt, not a guard.
      */}
      {already && (
        <div style={{ ...HINT, marginTop: 'var(--sp-7)' }}>
          You added this to {guide.code} already —{' '}
          {already.title || 'an earlier import'}
          {already.source ? ` from ${already.source}` : ''}, on{' '}
          {new Date(already.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
          Change something above to add it as a separate piece, or leave it — it is all still here.
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={empty || Boolean(already)}
        onClick={review}
        style={{
          height: 50,
          fontSize: 'var(--type-lg)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: already ? 'var(--sp-4)' : 'var(--sp-7)',
          opacity: empty || already ? 0.4 : 1,
        }}
      >
        {already ? 'Already added' : `Review and add to ${guide.code}`}
      </button>

      <Rework courseId={courseId} guide={guide} updates={updates} />

      {/*
        What is still missing, after everything above.
        Every other screen shows what is there; this is the only one that says
        what is not, and the difference matters most in the week before an exam
        when "I have imported everything" and "I have material for everything"
        feel identical. No score and no progress bar: a bar invites filling the
        bar, and the point is the one unit that will be on the exam.
      */}
      {gaps.length > 0 && (
        <>
          <SectionLabel>Still missing from {guide.code}</SectionLabel>
          {gaps.map((g) => (
            <div
              key={g.says}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'baseline',
                padding: '10px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' }}>
                {g.says}
              </span>
              <button
                type="button"
                className="bare tappable"
                onClick={() => dispatch({ type: 'go', screen: g.action.screen })}
                style={{
                  width: 'auto',
                  flex: 'none',
                  fontSize: 'var(--type-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  opacity: 0.6,
                }}
              >
                {g.action.label}
              </button>
            </div>
          ))}
        </>
      )}

      {updates.length > 0 && (
        <>
          <SectionLabel>Already added</SectionLabel>
          {updates.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'baseline',
                padding: '11px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>{u.title}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--type-xs)',
                    opacity: 0.55,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 'var(--sp-1)',
                  }}
                >
                  {u.unit !== null && guide.units[u.unit]
                    ? guide.units[u.unit].name.slice(0, 28)
                    : 'Own unit'}
                  {u.cards.length > 0 && ` · ${u.cards.length} cards`}
                  {u.fileIds.length > 0 && ` · ${u.fileIds.length} files`}
                  {/* Where it came from, on the thing itself. "From Session 7
                      slides, 12 Oct" is the difference between material you
                      can check and material that simply appeared. */}
                  {u.source && ` · from ${u.source}`}
                  {u.created > 0 &&
                    `, ${new Date(u.created).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                </span>
              </span>
              <button
                type="button"
                className="bare"
                onClick={() => undoImport(u)}
                style={{ fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em', flex: 'none' }}
              >
                REMOVE
              </button>
            </div>
          ))}
        </>
      )}
    </Page>
  );
}
