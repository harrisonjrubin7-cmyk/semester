import { useMemo, useRef, useState } from 'react';
import { Capture } from '../components/Capture';
import { RecordButton } from '../components/RecordButton';
import { configured, readShots } from '../lib/claude';
import type { ShotFile } from '../lib/shots';
import type { StudyCard } from '../lib/types';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { addFile, formatBytes, type FileMeta } from '../lib/files';
import { describeParse, parseMaterial } from '../lib/parse';
import type { CourseId } from '../lib/types';

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
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseMaterial(text), [text]);
  const empty =
    parsed.cards.length === 0 &&
    parsed.terms.length === 0 &&
    !parsed.body &&
    !files.length &&
    shotCards.length === 0;

  /** Read the photographs and hold the cards until the whole thing is saved. */
  const readPhotos = async () => {
    if (shots.length === 0 || reading) return;
    setReading(true);
    setShotError('');
    try {
      const context = `${guide.code} — ${guide.name}\nUnits:\n${guide.units
        .map((u, i) => `${i + 1}. ${u.name}`)
        .join('\n')}`;
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

  const save = () => {
    dispatch({
      type: 'addUpdate',
      update: {
        courseId,
        unit,
        title: title.trim() || (unit !== null ? 'Added material' : 'New reading'),
        source: source.trim(),
        body: parsed.body,
        cards: [...parsed.cards, ...shotCards],
        terms: parsed.terms,
        fileIds: files.map((f) => f.id),
      },
    });
    dispatch({ type: 'back' });
  };

  const pick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    const added: FileMeta[] = [];
    for (const file of Array.from(list)) {
      try {
        added.push(await addFile(file, courseId));
      } catch {
        // Storage refused it — a private window, or the quota. Say nothing
        // here; the list simply will not show it.
      }
      // A text file can also be read straight into the box, which is what
      // makes an exported reading useful rather than just attached.
      if (/^text\/|json|markdown/.test(file.type) || /\.(txt|md|csv)$/i.test(file.name)) {
        const body = await file.text();
        setText((t) => (t ? `${t}\n\n${body}` : body));
      }
    }
    setFiles((f) => [...f, ...added]);
    setBusy(false);
  };

  return (
    <div style={{ padding: 18 }}>
      <div className="chrome-text" style={{ fontSize: 26, lineHeight: 1.1 }}>
        Something new for {guide.code}
      </div>
      <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6, textWrap: 'pretty' }}>
        Paste it, attach it, or both. Whatever reads as a question and an answer becomes cards;
        the rest is kept as notes. Every study mode picks it up as soon as you save.
      </div>

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
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: on ? 'var(--chrome)' : 'transparent',
                  color: on ? '#0a0b0e' : 'var(--app-fg)',
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
          <span style={{ fontSize: 14 }}>A unit of its own, at the end</span>
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
            <span style={{ fontSize: 14, lineHeight: 1.3 }}>{u.name}</span>
          </button>
        ))}
      </div>

      <SectionLabel>What it is</SectionLabel>
      <input
        className="input"
        placeholder="Trounstine ch. 4"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ fontSize: 14 }}
      />
      <input
        className="input"
        placeholder="Where it came from — Brightspace, Oct 8 lecture"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        style={{ fontSize: 14, marginTop: 8 }}
      />

      <SectionLabel>The material</SectionLabel>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Q: What does the four-hurdle test ask first?\nA: Is there a plausible causal mechanism?\n\nOr paste the reading and keep it as notes.'}
        style={{ minHeight: 190, fontSize: 13, lineHeight: 1.5 }}
        aria-label="New material"
      />
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.6,
          marginTop: 6,
        }}
      >
        {describeParse(parsed)}
      </div>

      {parsed.cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
          {parsed.cards.slice(0, 3).map((c) => (
            <Blueprint key={c.q} style={{ padding: '11px 13px' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, lineHeight: 1.2 }}>
                {c.q}
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.45, marginTop: 3 }}>
                {c.a}
              </div>
            </Blueprint>
          ))}
          {parsed.cards.length > 3 && (
            <div style={{ fontSize: 12, opacity: 0.55 }}>
              and {parsed.cards.length - 3} more
            </div>
          )}
        </div>
      )}

      {/*
        Photographing the board is the reason material never makes it into a
        study app: nobody types up a whiteboard. The picture goes to Claude,
        which transcribes what is written and turns it into cards — and says so
        rather than filling in the parts that are out of focus.
      */}
      <SectionLabel>Photograph it</SectionLabel>
      {claudeReady ? (
        <>
          <div style={{ fontSize: 12.5, opacity: 0.62, lineHeight: 1.5, marginBottom: 10 }}>
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
                fontSize: 12,
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
              <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{readNote}</div>
              {shotCards.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                  {shotCards.length} {shotCards.length === 1 ? 'card' : 'cards'} ready — they save
                  with everything else below.
                </div>
              )}
            </Blueprint>
          )}
          {shotError && (
            <div
              style={{
                fontSize: 12.5,
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
        <div style={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.5 }}>
          Reading a photograph needs Claude. Sign in to use the shared key, or add your own under
          Connect → Claude. You can still attach the photo as a file below.
        </div>
      )}

      {/* A lecture, kept. Audio only — transcribing an hour of it is not
          something a browser does, and the button says so rather than
          implying a transcript is coming. */}
      <SectionLabel>Record the lecture</SectionLabel>
      <div style={{ fontSize: 12.5, opacity: 0.62, lineHeight: 1.5, marginBottom: 10 }}>
        Captures audio and keeps the file against this course. It is a recording to play back, not
        a transcript — for speech to text, dictate into a note instead.
      </div>
      <RecordButton
        courseId={courseId}
        label={guide.code}
        onSaved={(meta) => setFiles((f) => [...f, meta])}
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
        style={{ height: 42, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy ? 'Reading…' : 'Attach slides, a PDF, a photo of the board'}
      </button>
      {files.map((f) => (
        <div
          key={f.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: 13,
            padding: '9px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
          <span style={{ opacity: 0.5, flex: 'none' }}>{formatBytes(f.size)}</span>
        </div>
      ))}
      <div style={{ fontSize: 12, opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
        Images become figures for the unit. Text files are read into the box above as well as
        attached. Everything stays on this device.
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={empty}
        onClick={save}
        style={{
          height: 50,
          fontSize: 15,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 16,
          opacity: empty ? 0.4 : 1,
        }}
      >
        Add to {guide.code}
      </button>

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
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3 }}>{u.title}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
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
                style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em', flex: 'none' }}
              >
                REMOVE
              </button>
            </div>
          ))}
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
