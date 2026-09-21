import { useEffect, useMemo, useRef, useState } from 'react';
import { DIMMED_ROW } from '../lib/dim';
import type { CSSProperties } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { HowMuch } from '../components/HowMuch';
import { useRowStyle } from '../components/shell/useShell';
import { backupOf } from '../lib/export';
import { takeSnapshot } from '../lib/snapshots';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, FilePick, SectionLabel, TickBox } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { troubleOf, useTrouble } from '../lib/trouble';
import { intakeFiles, intakeText, type Intake } from '../lib/intake';
import { Capture } from '../components/Capture';
import type { ShotFile } from '../lib/shots';
import { readPages } from '../lib/claude';
import { keepSources } from '../lib/topage';
import { generateCourse, type GenerationResult } from '../lib/generate';
import { NO_POLICY, hasPolicy } from '../lib/attend';
import { packSummary, provenance, readPack } from '../lib/handoff';
import { configured } from '../lib/assistant';
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
import { Folding } from '../components/Fold';
import { NeedsKey } from '../components/NeedsKey';
import { reviewReady } from '../lib/import-review';
import { DOCUMENTS } from '../lib/extract';

/**
 * What the picker will offer.
 *
 * Every extension `lib/extract.ts` can actually read, and it had drifted: the
 * list offered PDF, Word, text and zip while `extract.ts` had grown a slide
 * reader, and `.pptx` is the commonest thing a professor posts after the
 * syllabus itself. A format missing from here is not refused with a sentence —
 * it is greyed out in the operating system's own dialog, which reads as the
 * app being broken rather than as an answer.
 *
 * The wildcards stay at the end for the mobile pickers that ignore extensions.
 */
/*
 * The formats `lib/extract.ts` can read, plus the media types for them.
 *
 * Still documents only, and now for a narrower reason than before. This said
 * "Import takes documents only; Update is the one that also takes a photo",
 * which was a true division of labour and left a student with a paper syllabus
 * nowhere to go: `lib/intake.ts` refuses an image with *"a photograph — read
 * it with the camera, which can see it"*, and the camera was on a screen that
 * adds material to a course you already have. Somebody photographing a
 * syllabus has not got one yet. The directions could not be followed from
 * where they were given.
 *
 * So the camera is on this screen now, as its own door below — and this list
 * stays documents-only deliberately. An image in the *file* picker would go to
 * `extractText`, which cannot see it, and be refused; the camera path reads it
 * with `readPages` instead. Two doors, because they are two different things a
 * browser does, exactly as `components/Capture.tsx` says of its own pair.
 */
const ACCEPT = `${DOCUMENTS}text/*,application/pdf,application/zip`;

/**
 * The quiet "…or" lines under the picker.
 *
 * `display: block` matters and is the whole reason this is shared. `.bare`
 * sets `width: 100%`, so each of these overrides it to `auto` — and a
 * `<button>` is inline-level, so on any screen wide enough for two of them the
 * three doors ran together as one sentence: "…or open a course somebody shared
 * with you…or add a course by hand, with no syllabus". Three ways in, reading
 * as one broken line.
 */
const QUIET: CSSProperties = {
  display: 'block',
  fontSize: 'var(--type-sm-plus)',
  color: 'var(--app-dim)',
  marginTop: 'var(--sp-5)',
  width: 'auto',
  paddingBlock: 'calc(6px * var(--density, 1))', paddingInline: '0',
  textAlign: 'left',
};

/**
 * What this screen can still do for somebody with no key.
 *
 * `NeedsKey` writes the half that is true everywhere — sign in, or add your
 * own, and everything else works without it. This is the half that is true
 * *here*, and it is the reason the sentence changed: the old one said only
 * why a key is wanted ("building a course asks it to read the documents you
 * gave it"), which is a closed door described from the inside. Two of the
 * four doors on this screen need no key at all, they are already drawn above
 * the gate, and a student who has just been told the app needs something they
 * do not have will not go looking for them.
 */
const NO_KEY_HERE =
  'Reading a document is the part that needs it — adding a course by hand, or ' +
  'opening one somebody shared with you, needs no key at all.';

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
  const { state, dispatch, say, catalog } = useStore();
  const rowEleven = useRowStyle(11);
  const [files, setFiles] = useState<Intake[]>([]);
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
  const abort = useRef<AbortController | null>(null);
  /** Whether a file is being dragged over the screen right now. */
  const [over, setOver] = useState(false);
  /**
   * Whether the drop box is open, and whether something is being held over it.
   *
   * The screen has always taken a drop anywhere on it, but nothing on it said
   * so: a person who wanted to drag a folder in had to guess that the guess
   * would work, and the only visible control opened the operating system's
   * file dialog instead. So pressing that control now also opens a box under
   * it that names the gesture and shows exactly where it lands — and because
   * it opens as the dialog does, it is already standing there for anyone who
   * cancels the dialog looking for the other way in.
   *
   * It stays open once opened. Adding a second reading after the syllabus is
   * the common second act, and a target that disappears after one use makes
   * the person hunt for it again.
   */
  const [zone, setZone] = useState(false);
  const [overZone, setOverZone] = useState(false);
  /*
   * The camera door: photographs taken, and whether they are being read.
   *
   * Held next to `pasted` rather than inside `files`, because a shot is not an
   * intake until it has been through `readPages` — the thing that turns a
   * photograph into words. Once it has, it joins `files` as an ordinary
   * `Intake` with `door: 'photo'` and everything downstream treats it exactly
   * like a PDF, which is the point of doing it this way rather than giving the
   * camera a pipeline of its own.
   */
  const [shots, setShots] = useState<ShotFile[]>([]);
  const [reading, setReading] = useState(false);

  /** The paste box, which is the way in when there is no file to pick. */
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');

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

  /**
   * Read what was chosen, however it arrived.
   *
   * Through `intakeFiles`, which is the app's one reader: it unpacks a zip,
   * reads PDFs, Word files and slide decks, and names everything it could not
   * read with a sentence saying why. This screen used to do that itself, in a
   * copy that had drifted — it refused slide decks the reader handles, and
   * handed a photograph to the text extractor to fail with the wrong message.
   *
   * One unreadable file never abandons the other nine: whatever was read is
   * kept and the rest is reported.
   */
  const addFiles = async (chosen: File[]) => {
    if (chosen.length === 0) return;
    trouble.clear();
    setBusy('Opening what you picked…');
    try {
      const got = await intakeFiles(chosen, (done, total) =>
        setBusy(total > 1 ? `Reading ${done + 1} of ${total}…` : 'Reading it…'),
      );
      if (got.read.length > 0) {
        setFiles((f) => [
          ...f.filter((x) => !got.read.some((r) => r.name === x.name)),
          ...got.read,
        ]);
      }
      if (got.refused.length > 0) {
        // Choosing them again would refuse them again — a .pages file is still
        // a .pages file on the second go — so this is said without a retry.
        trouble.wrong(`Left out: ${got.refused.map((r) => `${r.name} (${r.why})`).join('; ')}.`);
      } else if (got.read.length === 0) {
        trouble.wrong('Nothing readable came out of that. Paste the text in instead.');
      }
    } catch (e) {
      trouble.wrong(troubleOf(e) ?? 'Those files could not be opened.');
    } finally {
      setBusy('');
    }
  };

  /**
   * The syllabus as text, when there is no file to give.
   *
   * Two error messages in `lib/extract.ts` and the line under "Add your first
   * course" have told people to paste the text in since before there was
   * anywhere to paste it. This is that place. It is also the way in that
   * cannot fail: a scanned PDF, a schedule that only exists inside a
   * Brightspace page, a phone that will not open its own file picker — all of
   * them end with the words on screen and nothing to upload.
   */
  const takePasted = () => {
    const read = intakeText(pasted, 'paste');
    if (!read) return;
    trouble.clear();
    setFiles((f) => [...f.filter((x) => x.name !== read.name), read]);
    setPasted('');
    setPasting(false);
    say(`${read.words.toLocaleString()} words taken. Build the course when you are ready.`);
  };

  /**
   * The syllabus as photographs, when the only copy is on paper.
   *
   * The case this door exists for: a professor hands out the syllabus in the
   * first lecture and never posts it. Before this there were four ways in and
   * all four wanted a file or the words already typed out — so the student
   * with a sheet of paper in their hand had to type it, which nobody does.
   *
   * It ends where the file door ends, on purpose. `readPages` gives back the
   * text that is on the pages and `intakeText` makes that an ordinary
   * `Intake`, so the review step, the hashing, the word count and
   * `generateCourse` cannot tell it came from a camera — and nothing
   * downstream had to learn about photographs.
   *
   * The shots are dropped once they are read. Keeping them would put the
   * thumbnails under a row that now says "1,400 words taken", which reads as
   * though they were still waiting to be used.
   */
  const readShotsIn = async () => {
    if (shots.length === 0 || reading) return;
    setReading(true);
    trouble.clear();
    try {
      const text = await readPages(shots.map((sh) => sh.shot));
      const read = intakeText(text, 'photo');
      if (!read) {
        trouble.wrong('Nothing readable came off those photographs. Try again in better light.');
        return;
      }
      setFiles((f) => [...f.filter((x) => x.name !== read.name), read]);
      setShots([]);
      say(`${read.words.toLocaleString()} words read off the photographs. Check them before building.`);
    } catch (e) {
      trouble.failed(e, () => void readShotsIn());
    } finally {
      setReading(false);
    }
  };

  // The term a new course lands in. Defaults to the one the app is showing,
  // which is what somebody importing in September means, and is changeable
  // before it is saved because August imports of a spring course happen.
  const term = readTerm(state.term);

  /**
   * Every course id already spoken for, so a new one cannot land on top.
   *
   * Both lists, because both are real to the student: `state.courses` is what
   * the account holds, and `catalog.modules` also carries the shipped semester
   * while the sample is switched on. A course id keys deadlines, office hours,
   * grades and the guide, so an import that reused one produced a course
   * wearing another course's material. See `courseId` in `lib/edit.ts`.
   */
  const taken = useMemo(
    () => [
      ...new Set([
        ...state.courses.map((c: (typeof state.courses)[number]) => c.course.id),
        ...catalog.modules.map((m) => m.course.id),
      ]),
    ],
    [state.courses, catalog.modules],
  );

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
        // A shared pack is somebody else's built course, not a syllabus being
        // read, so there is no rule to have found. `NO_POLICY` says that
        // rather than leaving the field to be guessed at downstream.
        attendance: NO_POLICY,
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
        { documents: files, hint, year: term.year, taken, controls: state.controls },
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
    /*
     * The attendance rule, filed against the course it was read from.
     *
     * Only when the syllabus stated one. An empty policy dispatched anyway
     * would overwrite a rule the student had typed by hand on a re-import —
     * which is the one case where reading a syllabus again should cost them
     * nothing, and is why this is a guard rather than an unconditional write.
     */
    const fileAttendance = (courseId: string) => {
      if (hasPolicy(result.attendance)) {
        dispatch({ type: 'setAttendPolicy', courseId, policy: result.attendance });
      }
    };

    /*
     * The syllabus itself, kept in the drive against the course it built.
     *
     * The app read the PDF, took the dates out of it and let the bytes go —
     * and then printed "p. 12" under every deadline, which is a footnote to a
     * document nobody can open. `lib/topage.ts` is the way back; this is the
     * half of it that has to happen while the file is still in memory.
     *
     * Not awaited. A student who has just approved twelve deadlines should
     * not wait on a twelve-megabyte write they did not ask for, and a browser
     * that refuses storage must not fail the import over it — the page
     * numbers simply stay as inert as they were.
     */
    const keep = (courseId: string) => void keepSources(files, courseId).catch(() => {});

    if (existing) {
      const merged = keepIds(existing, reviewed);
      dispatch({ type: 'replaceCourse', module: merged });
      fileAttendance(merged.course.id);
      keep(merged.course.id);
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
    fileAttendance(filed.course.id);
    keep(filed.course.id);
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
      {/*
        Dropping a folder on the screen works, and says so while you hold it.

        The one gesture everybody tries with a download folder open beside the
        browser, and the app used to ignore it — worse than ignore it, because
        an unhandled drop navigates the tab to the PDF and loses whatever was
        already picked. This takes the drop wherever it lands on the screen.
      */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (busy === '') setOver(true);
        }}
        onDragLeave={(e) => {
          // Only when the pointer has actually left the screen, not on every
          // crossing between the children inside it.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (busy !== '') return;
          void addFiles(Array.from(e.dataTransfer.files));
        }}
        style={
          over
            ? { outline: '2px dashed var(--app-accent-deep)', outlineOffset: 6, borderRadius: 'var(--r-md)' }
            : undefined
        }
      >
      <div className="chrome-text" style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 1.08 }}>
        Upload it. Walk away.
      </div>
      <div style={{ fontSize: 'var(--type-md)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        The syllabus gives the dates and how the grade is built. Add the readings and you get the
        study guide too — cards, terms and a self-test made from what they actually argue.
      </div>

      {/* The input is the button — see `FilePick`. Nothing here calls
          `.click()` on a hidden input, which is what used to make this the one
          press in the app that could silently do nothing. */}
      <FilePick
        accept={ACCEPT}
        disabled={busy !== ''}
        onOpen={() => setZone(true)}
        onPick={(picked) => void addFiles(picked)}
        style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-7)' }}
      >
        {busy || (over ? 'Drop them here' : 'Choose files — PDF, Word, slides, text, or a zip')}
      </FilePick>

      {/*
        The camera, for the syllabus that only exists on paper.

        Under the file picker rather than beside it, because uploading is what
        most people are here to do and a screen that offers two equal primary
        actions has chosen neither. `<Capture>` draws its own pair — the rear
        camera and the photo library — and says why in its own header.

        Behind the key gate like the file door, and for the same reason: a
        photograph has to be read by a model before it is words. The two doors
        that need no key at all are named inside `NeedsKey` below, and neither
        of them is this one.
      */}
      {configured() && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <Capture shots={shots} onChange={setShots} label="Photograph the syllabus" />
          {shots.length > 0 && (
            <ActionButton
              onClick={() => void readShotsIn()}
              disabled={reading || busy !== ''}
              style={{ marginTop: 'var(--sp-4)' }}
            >
              {reading
                ? 'Reading the pages…'
                : `Read ${shots.length === 1 ? 'the page' : `the ${shots.length} pages`}`}
            </ActionButton>
          )}
          <div
            style={{
              fontSize: 'var(--type-xs)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            One photograph per page, in order. The words come back as they are written — the
            grading table stays a table, the dates stay as typed, and anything too blurred to
            read is marked rather than guessed at.
          </div>
        </div>
      )}

      {/*
        The drop box. Opened by the press above, and drawn as the dashed
        rectangle everybody already reads as "put it here".

        The box is itself a `FilePick`, so it is a target for the drag and a
        second way to open the dialog, and neither of those is a scripted
        click. The drop is not handled here: it bubbles to the screen-wide
        handler above, whose `preventDefault` also stops the browser handing
        the same files to the input underneath — which is what would otherwise
        add every file twice.
      */}
      {zone && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (busy === '') setOverZone(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverZone(false);
          }}
          onDrop={() => setOverZone(false)}
          style={{ marginTop: 'var(--sp-4)' }}
        >
          <FilePick
            accept={ACCEPT}
            disabled={busy !== ''}
            onPick={(picked) => void addFiles(picked)}
            style={{
              height: 'auto',
              minHeight: 140,
              flexDirection: 'column',
              gap: 'var(--sp-2)',
              padding: 'var(--sp-7)',
              textAlign: 'center',
              textTransform: 'none',
              letterSpacing: 'normal',
              border: `1px dashed ${overZone ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
              background: overZone ? 'rgba(236, 238, 242, 0.09)' : 'transparent',
            }}
          >
            <span style={{ fontSize: 'var(--type-md)', fontFamily: 'var(--font-body)', lineHeight: 'var(--leading-normal)' }}>
              {busy || (overZone ? 'Let go — they land here' : 'Drag your files into this box')}
            </span>
            <span
              style={{
                fontSize: 'var(--type-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                color: 'var(--app-dim)',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              PDF, Word, slides, text, or a zip · or click the box to browse again
            </span>
          </FilePick>
        </div>
      )}

      {/* The door with no file behind it at all. See `takePasted`. */}
      <button
        type="button"
        className="bare tappable"
        onClick={() => setPasting((was) => !was)}
        aria-expanded={pasting}
        style={QUIET}
      >
        …or paste the syllabus in as text
      </button>

      {pasting && (
        <>
          <label
            htmlFor="paste-syllabus"
            className="section-label"
            style={{ display: 'block', marginTop: 'var(--sp-4)' }}
          >
            Paste the syllabus
          </label>
          <textarea
            id="paste-syllabus"
            className="input"
            rows={7}
            autoFocus
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="The schedule, the grading, the dates — however it is written."
            style={{
              fontSize: 'var(--type-base-plus)',
              lineHeight: 'var(--leading-normal)',
              height: 'auto',
              resize: 'vertical',
            }}
          />
          <ActionButton
            onClick={takePasted}
            disabled={pasted.trim() === ''}
            style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-4)' }}
          >
            Take this text
          </ActionButton>
        </>
      )}

      {/* The other door in. A course somebody has already generated arrives
          as a file and needs no upload and no request — but it goes through
          exactly the same review as a course generated here, including the
          diff against a course you already hold, because a shared course can
          be from a different section with different dates. */}
      <FilePick
        accept="application/json,.json"
        multiple={false}
        disabled={busy !== ''}
        tone="bare"
        onPick={([file]) => void openShared(file)}
        style={QUIET}
      >
        …or open a course somebody shared with you
      </FilePick>

      <ByHand />

      {files.map((f) => (
        <div
          key={f.name}
          style={{
            display: 'flex',
            gap: 'var(--sp-5)',
            alignItems: 'baseline',
            ...rowEleven,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base-plus)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {f.name}
          </span>
          <span style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', flex: 'none' }}>
            {f.words.toLocaleString()} words
          </span>
          <button
            type="button"
            className="bare"
            onClick={() => setFiles((list) => list.filter((x) => x.name !== f.name))}
            style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
          >
            REMOVE
          </button>
        </div>
      ))}

      {files.length > 0 && (
        <>
          <SectionLabel>Anything it should know</SectionLabel>
          <input
            aria-label="Anything it should know"
            className="input"
            placeholder="Optional — “the midterm moved to Oct 8”, “skip chapter 4”"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            style={{ fontSize: 'var(--type-base-plus)' }}
          />

          {/* Beside the build button rather than in Settings: the moment
              somebody wants a shorter deck is the moment they are looking at
              the syllabus about to make one. */}
          <HowMuch />

          {/*
            The gate stands *instead of* the button, which is the shape the
            other five screens that need a key already use — see
            `components/NeedsKey.tsx`, and `Essay`, `Deck`, `Exam` and
            `changes/FromText` for the ternary.

            This screen drew the button live and put the gate underneath it,
            and that is the worst place in the app for it to be: Import is
            what `screens/FirstRun.tsx` sends a brand-new account to, so the
            first real action anybody takes here is a full-width primary
            button reading "Build the course from 8,412 words" that cannot
            succeed. It reads the files, spends the wait, and comes back with
            "No key yet. Sign in to use the shared one, or add your own under
            Settings" (`lib/claude.ts`) — directions, in an error card, after
            the work. `NeedsKey` exists because that sentence with no button
            on it is a dead end, and this was the one screen still drawing it.
          */}
          {configured() ? (
            <ActionButton
              disabled={busy !== ''}
              onClick={() => void build()}
              tone="primary"
              style={{ fontSize: 'var(--type-lg)', marginTop: 'calc(14px * var(--density, 1))' }}
            >
              {busy && !busy.startsWith('Reading ') ? busy : `Build the course from ${words.toLocaleString()} words`}
            </ActionButton>
          ) : (
            <NeedsKey also={NO_KEY_HERE} />
          )}

          {busy && !busy.startsWith('Reading ') && (
            <button
              type="button"
              className="bare"
              onClick={() => abort.current?.abort()}
              style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', marginTop: 'var(--sp-5)' }}
            >
              STOP
            </button>
          )}
        </>
      )}

      {/*
        And at rest, before a file is picked, so the answer arrives before the
        upload rather than after it. Only then: with files staged the gate is
        drawn above, in the button's place, and two of them on one screen is
        the doubling this pass was about.
      */}
      {!configured() && files.length === 0 && <NeedsKey also={NO_KEY_HERE} />}

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
          onRevise={setResult}
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
      )}
      </div>
    </Page>
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
  const { state, dispatch, say, catalog } = useStore();
  /*
   * Open already, on the install where it is the only door that works.
   *
   * The drop box, the paste field and the shared-course file all end at
   * `generateCourse`, and `generateCourse` needs a key. This one does not,
   * and `NO_KEY_HERE` above now says so in the gate — "adding a course by
   * hand, or opening one somebody shared with you, needs no key at all".
   *
   * Which is what makes the default matter rather than settle it. A sentence
   * that names this door while the door itself is a 12.5px link at 0.65
   * opacity, fourth in a stack of three that cannot open, is a promise the
   * screen does not keep: the student has just been told the app needs
   * something they do not have, and is then asked to go and find the
   * exception in the small print. The state is the other half of that
   * sentence — unkeyed, the form is the thing on screen rather than a link
   * to it.
   *
   * Keyed, nothing moves. The syllabus is the better route and this stays
   * the quiet aside it was.
   */
  const [open, setOpen] = useState(() => !configured());
  /*
   * Whether the field was *asked* for, which is the only time it may take
   * the caret.
   *
   * `autoFocus` was right while opening this was a press: you pressed a link
   * reading "add a course by hand" and the cursor was waiting in the box.
   * Opened by default it is a different thing — the caret is taken from a
   * screen headed "Upload it. Walk away." before the student has read it,
   * and on a phone the keyboard comes up over the drop box. Seen in the
   * browser, not in the suite: a focus ring around the field in the first
   * screenshot of the change.
   */
  const [asked, setAsked] = useState(false);
  const [code, setCode] = useState('');
  const term = readTerm(state.term);
  /*
   * Matched on the code, not on the slug of it.
   *
   * This compared `blankCourse(code).course.id` against the ids held, which
   * asks the wrong question twice over: the shipped ECON 1020 is filed under
   * `econ`, so typing "ECON 1020" here read as a course nobody had and added
   * a second one — and it never saw the sample semester at all, which is
   * where the four courses in front of the student actually are.
   */
  const held = [...state.courses, ...catalog.modules];
  const taken =
    code.trim() !== '' &&
    held.some((c) => c.course.code.trim().toLowerCase() === code.trim().toLowerCase());

  const make = () => {
    const clean = code.trim();
    if (!clean || taken) return;
    // Never on top of an id already in use: two courses under one id are one
    // course to every screen that reads a course id. See `courseId`.
    const module = blankCourse(clean, term.id, held.map((c) => c.course.id));
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
        onClick={() => {
          setOpen(true);
          setAsked(true);
        }}
        style={{ ...QUIET, marginTop: 'var(--sp-2)' }}
      >
        …or add a course by hand, with no syllabus
      </button>
    );
  }

  return (
    <Blueprint style={{ paddingBlock: 'calc(14px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', marginTop: 'var(--sp-6)' }}>
      <Folding name="ByHand">
      <SectionLabel>Add it by hand</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'stretch' }}>
        <input
          aria-label="Add a course by hand"
          className="input"
          autoFocus={asked}
          placeholder="ECON 1020"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') make();
          }}
          style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={make}
          disabled={code.trim() === '' || taken}
          style={{
            flex: 'none',
            width: 'auto',
            paddingBlock: '0', paddingInline: 'calc(18px * var(--density, 1))',
            fontSize: 'var(--type-sm)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Add
        </button>
      </div>
      <div
        style={{
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          marginTop: 'var(--sp-5)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {taken
          ? `You already have ${code.trim()}. Open it and edit it, or import its syllabus over the top.`
          : `The code is all it needs. Everything else — the name, the professor, when it meets, what
             is due — you fill in next, and you can import the syllabus over this later without
             losing anything you have ticked off.`}
      </div>
      </Folding>
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
        gap: 'var(--sp-6)',
        alignItems: 'baseline',
        paddingBlock: 'calc(9px * var(--density, 1))', paddingInline: '0',
        borderBottom: '1px solid var(--app-line-soft)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base-plus)', lineHeight: 1.35 }}>{label}</span>
      <span style={{ flex: 'none', fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)' }}>{right}</span>
    </div>
  );

  return (
    <Folding name="Rediff">
      <SectionLabel>You already have {code}</SectionLabel>
      <Blueprint style={{ paddingBlock: 'calc(14px * var(--density, 1))', paddingInline: 'calc(15px * var(--density, 1))' }}>
        <div className="chrome-text" style={{ fontSize: 'calc(20px * var(--text-scale, 1))', lineHeight: 1.2, textWrap: 'pretty' }}>
          {rediffSummary(changes)}
        </div>
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'calc(7px * var(--density, 1))', lineHeight: 'var(--leading-relaxed)' }}>
          {changes.same} unchanged. Saving replaces the course you have rather than adding a second
          copy of it.
        </div>
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
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
    </Folding>
  );
}

/** What was found, what was dropped, and the chance to say no. */
function Preview({
  result,
  onSave,
  onRevise,
  replacing = false,
  dropped,
  onToggle,
}: {
  result: GenerationResult;
  onSave: () => void;
  onRevise: (result: GenerationResult) => void;
  replacing?: boolean;
  /** Dates taken off the import. See the state in `Import`. */
  dropped: Set<string>;
  onToggle: (id: string) => void;
}) {
  const rowTen = useRowStyle(10);
  const now = useNow();
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => setConfirmed(false), [result, dropped]);
  const { module: m, notes } = result;
  const ready = reviewReady(m.items, dropped, confirmed, now.getFullYear());
  const [summary, ...warnings] = notes;
  const keeping = m.items.filter((i) => !dropped.has(i.id)).length;

  return (
    <Folding name="Review extracted information">
      <SectionLabel>Review your course</SectionLabel>
      <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
        <div className="chrome-text" style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 1.1 }}>
          {m.course.code}
        </div>
        <div style={{ fontSize: 'var(--type-md)', marginTop: 'calc(3px * var(--density, 1))' }}>{m.course.name}</div>
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
          {[m.course.prof, m.course.meets, m.course.room, m.course.credits]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xs-plus)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-6)',
            paddingTop: 'var(--sp-5)',
            borderTop: '1px solid var(--app-line)',
          }}
        >
          {summary}
        </div>
      </Blueprint>

      {warnings.length > 0 && (
        <>
          <SectionLabel>Worth knowing</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
            {warnings.map((w) => (
              <div key={w} style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
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
      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginBottom: 'var(--sp-2)', lineHeight: 'var(--leading-relaxed)' }}>
        {m.items.length} found
        {dropped.size > 0 ? ` \u00b7 ${dropped.size} taken off \u00b7 ${keeping} will be added` : ' \u00b7 untick anything the syllabus does not say'}
      </div>
      {m.items.map((i) => {
        const off = dropped.has(i.id);
        return (
          <div key={i.id} className="import-review-item">
          <button
            type="button"
            className="bare tappable"
            onClick={() => onToggle(i.id)}
            aria-pressed={!off}
            aria-label={off ? `Put ${i.title} back` : `Take ${i.title} off this import`}
            style={{ ...rowTen, width: '100%', textAlign: 'left', display: 'block', opacity: off ? DIMMED_ROW : 1 }}
          >
            <span style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
              <span style={{ flex: 'none', alignSelf: 'center' }}>
                <TickBox on={!off} size={18} />
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-dim)',
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
                  fontSize: 'var(--type-md)',
                  lineHeight: 'var(--leading-tight)',
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
                  fontSize: 'var(--type-xs-plus)',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-2)',
                  lineHeight: 'var(--leading-normal)',
                  paddingLeft: 'calc(92px * var(--density, 1))',
                }}
              >
                “{i.quote}”
              </span>
            )}
          </button>
          {!i.quote && <p className="import-evidence-note">No source excerpt supplied. Check this date in the original syllabus.</p>}
          <details className="import-correction"><summary>Edit title or date</summary><div>
            <label>Title<input className="input" aria-label={`Title for ${i.title}`} value={i.title} onChange={e => onRevise({...result,module:{...m,items:m.items.map(row=>row.id===i.id?{...row,title:e.target.value}:row)}})}/></label>
            <label>Date<input className="input" type="date" aria-label={`Date for ${i.title}`} value={`${i.year??now.getFullYear()}-${String(i.month+1).padStart(2,'0')}-${String(i.day).padStart(2,'0')}`} onChange={e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))return;const [year,month,day]=e.target.value.split('-').map(Number);onRevise({...result,module:{...m,items:m.items.map(row=>row.id===i.id?{...row,year,month:month-1,day}:row)}});}}/></label>
          </div></details>
          </div>
        );
      })}

      <SectionLabel>The first unit</SectionLabel>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(16px * var(--text-scale, 1))' }}>{m.guide.units[0]?.name}</div>
      {(m.guide.units[0]?.cards ?? []).slice(0, 2).map((c) => (
        <div key={c.q} style={{ marginTop: 'var(--sp-4)' }}>
          <div style={{ fontSize: 'var(--type-base-plus)', fontWeight: 600, lineHeight: 1.35 }}>{c.q}</div>
          <div style={{ fontSize: 'var(--type-base-plus)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-1)' }}>{c.a}</div>
        </div>
      ))}

      <label className="import-confirmation"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked the course information and selected dates against my syllabus. Add only the dates I approved.</span></label>
      <p className="import-evidence-note" role="status">{ready ? 'Verified dates are ready to add.' : 'Review the dates above before adding this course. Reminders begin only after you approve and save.'}</p>
      <ActionButton
        onClick={() => { if (ready) onSave(); }}
        disabled={!ready}
        tone="primary"
        style={{ fontSize: 'var(--type-lg)', marginTop: 'calc(18px * var(--density, 1))' }}
      >
        {/* The count on the button, because it is the number that changed
            and the button is what commits it. */}
        {replacing
          ? `Replace ${m.course.code} — ${keeping} ${keeping === 1 ? 'date' : 'dates'}`
          : `Add ${m.course.code} — ${keeping} ${keeping === 1 ? 'date' : 'dates'}`}
      </ActionButton>
      <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-relaxed)' }}>
        {replacing
          ? 'The changes above are what this replaces. Your ticks and your drill history stay where they are.'
          : 'You can add readings to it later, and everything you add flows into the cards, the quiz and the slides at once.'}
        {dropped.size > 0
          ? ` The ${dropped.size} you took off ${dropped.size === 1 ? 'is' : 'are'} not added at all — re-import the syllabus to get ${dropped.size === 1 ? 'it' : 'them'} back.`
          : ''}
      </div>
    </Folding>
  );
}
