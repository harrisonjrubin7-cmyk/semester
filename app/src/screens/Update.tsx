import { useMemo, useRef, useState } from 'react';
import { Capture } from '../components/Capture';
import { RecordButton } from '../components/RecordButton';
import { Rework } from '../components/Rework';
import { configured, provider, readMaterial, readShots } from '../lib/claude';
import { extractText } from '../lib/extract';
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
import type { CourseId, Term } from '../lib/types';

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
export function AddMaterial() {
  const { state, dispatch, catalog } = useStore();
  const courseId = state.guideId;
  const { guide, updates } = useLive(courseId);

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
  const [readSummary, setReadSummary] = useState('');
  const [readError, setReadError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseMaterial(text), [text]);
  const empty =
    parsed.cards.length === 0 &&
    parsed.terms.length === 0 &&
    !parsed.body &&
    !files.length &&
    shotCards.length === 0 &&
    readCards.length === 0;

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
      if (got.cards.length === 0 && got.terms.length === 0 && !got.note) {
        setReadError('Nothing came back from that. It is still attached and kept as notes.');
      }
    } catch (e) {
      setReadError(e instanceof Error ? e.message : String(e));
    } finally {
      setStudying(false);
    }
  };

  const save = () => {
    dispatch({
      type: 'addUpdate',
      update: {
        courseId,
        unit,
        title: title.trim() || (unit !== null ? 'Added material' : 'New reading'),
        source: source.trim(),
        body: parsed.body,
        cards: [...parsed.cards, ...shotCards, ...readCards],
        terms: [...parsed.terms, ...readTerms],
        fileIds: files.map((f) => f.id),
      },
    });
    dispatch({ type: 'back' });
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
        }
      } catch (e) {
        // One unreadable file must not lose the rest of the batch. Named,
        // because a silent miss is how somebody studies from half a folder.
        unread.push(`${piece.name} (${e instanceof Error ? e.message : String(e)})`);
      }
    }

    setFiles((f) => [...f, ...added]);
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
            The moment you save, Cards, Quiz, Read, Cram and the slides for this course all
            include it. Nothing is regenerated and nothing you had is replaced — the new material
            is layered over the syllabus the course was built from, and anything you add is listed
            at the bottom of this screen where it can be taken out again.
          </p>
        </>
      }
    >

      <SectionLabel>Which course</SectionLabel>
      <div className="chiprow">
        <div style={{ display: 'flex', gap: 6 }}>
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
                  fontSize: 'calc(11px * var(--text-scale, 1))',
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
            gap: 10,
            padding: '11px 0',
            borderBottom: '1px solid var(--app-line)',
            textAlign: 'left',
            opacity: unit === null ? 1 : 0.55,
          }}
        >
          <span style={{ width: 26, flex: 'none', color: 'var(--app-accent)' }}>
            {unit === null ? '■' : '□'}
          </span>
          <span style={{ fontSize: 'calc(14px * var(--text-scale, 1))' }}>A unit of its own, at the end</span>
        </button>
        {guide.units.map((u, i) => (
          <button
            key={u.name}
            type="button"
            className="bare tappable"
            onClick={() => setUnit(i)}
            style={{
              display: 'flex',
              gap: 10,
              padding: '11px 0',
              borderBottom: '1px solid var(--app-line)',
              textAlign: 'left',
              opacity: unit === i ? 1 : 0.55,
            }}
          >
            <span style={{ width: 26, flex: 'none', color: 'var(--app-accent)' }}>
              {unit === i ? '■' : '□'}
            </span>
            <span style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.3 }}>{u.name}</span>
          </button>
        ))}
      </div>

      <SectionLabel>What it is</SectionLabel>
      <input
        className="input"
        placeholder="Trounstine ch. 4"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ fontSize: 'calc(14px * var(--text-scale, 1))' }}
      />
      <input
        className="input"
        placeholder="Where it came from — Brightspace, Oct 8 lecture"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        style={{ fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 8 }}
      />

      <SectionLabel>The material</SectionLabel>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Q: What does the four-hurdle test ask first?\nA: Is there a plausible causal mechanism?\n\nOr paste the reading and keep it as notes.'}
        style={{ minHeight: 190, fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.5 }}
        aria-label="New material"
      />
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'calc(11px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.6,
          marginTop: 6,
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
                  marginTop: 12,
                  fontSize: 'calc(12px * var(--text-scale, 1))',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {studying ? 'Reading it…' : 'Make cards and terms from this'}
              </button>
              <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
                {provider()} reads what you pasted or attached and writes cards and definitions from
                what is in it — nothing from general knowledge. Optional: the text is kept as the
                unit's notes either way.
              </div>
            </>
          ) : (
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
              Turning a reading into cards needs {provider()}. Sign in to use the shared key, or add
              your own under Connect → Claude. The text is still kept as the unit's notes.
            </div>
          )}
        </>
      )}

      {(readSummary || readCards.length > 0 || readTerms.length > 0) && (
        <Blueprint plain style={{ padding: '11px 13px', marginTop: 12 }}>
          <div className="kicker">What it read</div>
          {readSummary && (
            <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.5, marginTop: 4 }}>
              {readSummary}
            </div>
          )}
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6 }}>
            {readCards.length} {readCards.length === 1 ? 'card' : 'cards'} and {readTerms.length}{' '}
            {readTerms.length === 1 ? 'term' : 'terms'} ready — they save with everything else below.
          </div>
        </Blueprint>
      )}

      {readError && (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            color: 'var(--app-accent)',
            marginTop: 10,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
          }}
        >
          {readError}
        </div>
      )}

      {parsed.cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
          {parsed.cards.slice(0, 3).map((c) => (
            <Blueprint key={c.q} style={{ padding: '11px 13px' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.2 }}>
                {c.q}
              </div>
              <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.45, marginTop: 3 }}>
                {c.a}
              </div>
            </Blueprint>
          ))}
          {parsed.cards.length > 3 && (
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55 }}>
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
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.62, lineHeight: 1.5, marginBottom: 10 }}>
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
                marginTop: 12,
                fontSize: 'calc(12px * var(--text-scale, 1))',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {reading ? 'Reading the photos…' : `Read ${shots.length === 1 ? 'it' : 'them'}`}
            </button>
          )}
          {readNote && (
            <Blueprint plain style={{ padding: '11px 13px', marginTop: 12 }}>
              <div className="kicker">What it saw</div>
              <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.5, marginTop: 4 }}>{readNote}</div>
              {shotCards.length > 0 && (
                <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 6 }}>
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
                marginTop: 10,
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
              }}
            >
              {shotError}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.5 }}>
          Reading a photograph needs {provider()}. Sign in to use the shared key, or add your own under
          Connect → Claude. You can still attach the photo as a file below.
        </div>
      )}

      {/* A lecture, kept — and written down while it happens, which is the
          only kind of transcript a browser can make. The text drops straight
          into the box above, so what was said becomes material the same way a
          reading does. */}
      <SectionLabel>Record the lecture</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.62, lineHeight: 1.5, marginBottom: 10 }}>
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
        style={{ height: 42, fontSize: 'calc(12px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy ? 'Reading…' : 'Attach slides, a PDF, a photo of the board, or a zip'}
      </button>
      {files.map((f) => (
        <div
          key={f.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: 'calc(13px * var(--text-scale, 1))',
            padding: '9px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
          <span style={{ opacity: 0.5, flex: 'none' }}>{formatBytes(f.size)}</span>
        </div>
      ))}
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
        Images become figures for the unit. A PDF, a Word file or a text file is read into the box
        above as well as attached, so what is in it can become cards. Everything stays on this
        device.
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={empty}
        onClick={save}
        style={{
          height: 50,
          fontSize: 'calc(15px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 16,
          opacity: empty ? 0.4 : 1,
        }}
      >
        Add to {guide.code}
      </button>

      <Rework courseId={courseId} guide={guide} updates={updates} />

      {updates.length > 0 && (
        <>
          <SectionLabel>Already added</SectionLabel>
          {updates.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                padding: '11px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.3 }}>{u.title}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'calc(11px * var(--text-scale, 1))',
                    opacity: 0.55,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}
                >
                  {u.unit !== null && guide.units[u.unit]
                    ? guide.units[u.unit].name.slice(0, 28)
                    : 'Own unit'}
                  {u.cards.length > 0 && ` · ${u.cards.length} cards`}
                  {u.fileIds.length > 0 && ` · ${u.fileIds.length} files`}
                </span>
              </span>
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'deleteUpdate', id: u.id })}
                style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, letterSpacing: '0.1em', flex: 'none' }}
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
