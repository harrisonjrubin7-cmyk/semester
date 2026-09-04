import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { PrintButton } from '../components/PrintButton';
import { ask, configured } from '../lib/claude';
import { download } from '../lib/deliver';
import { deckFileName, pptx, type Deck as DeckFile } from '../lib/pptx';
import {
  KINDS,
  SYSTEM,
  brief,
  fromUnit,
  holes,
  kind as kindById,
  readPlan,
  slidesFor,
  speakerNotes,
  toDeck,
  type Planned,
} from '../lib/deck';
import { UseSources, appendTo } from '../components/UseSources';

/**
 * A deck you can hand in, from a unit or from a brief.
 *
 * The file that comes out is a real .pptx, written by `lib/pptx.ts` — a zip of
 * OOXML, no library, opened by PowerPoint, Keynote and Google Slides alike.
 * The app used to ship four decks built offline by a Python script, which
 * covered the four sample courses and nothing else; this covers every course a
 * person imports, and everything that is not a course at all.
 *
 * Two doors, and the free one is first. From a unit, there is no model in the
 * loop: a study guide is already questions and answers, which is already a
 * deck. From a brief, a model plans it — and is told the same thing it is told
 * everywhere else in this app, that a figure it invents will be believed by a
 * whole room at once, so a missing number comes back as a blank.
 */
export function Deck() {
  const { state, catalog, dispatch } = useStore();
  const { guide } = useLive(state.guideId);

  const [source, setSource] = useState<'unit' | 'brief'>('unit');
  const [unit, setUnit] = useState(state.lessonUnit ?? 0);

  const [kindId, setKindId] = useState(KINDS[0].id);
  const [topic, setTopic] = useState('');
  const [material, setMaterial] = useState('');
  const [instructions, setInstructions] = useState('');
  const [audience, setAudience] = useState('');
  const [minutes, setMinutes] = useState(10);

  const [plan, setPlan] = useState<Planned | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const trouble = useTrouble();
  const [kept, setKept] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const unitDeck = useMemo(() => fromUnit(guide, unit), [guide, unit]);
  const planned = plan ? toDeck(plan) : null;
  const file: DeckFile | null = source === 'unit' ? unitDeck : planned;
  const left = plan ? holes(plan) : [];

  const make = async () => {
    if (busy) return;
    setBusy(true);
    trouble.clear();
    setPlan(null);
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 4000,
        think: true,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: brief({ kindId, topic, material, instructions, minutes, audience }),
          },
        ],
        onText: (chunk) => {
          sofar += chunk;
        },
      });
      setPlan(readPlan(sofar));
    } catch (e) {
      trouble.failed(e, () => void make());
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!file || saving) return;
    setSaving(true);
    trouble.clear();
    try {
      const blob = await pptx(file);
      download({
        name: deckFileName(file.title),
        body: blob,
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
    } catch (e) {
      // Nothing was consumed: the deck is still in memory and building the
      // file again costs no request.
      trouble.failed(e, () => void save());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        A real PowerPoint file, built here. It opens in PowerPoint, Keynote and Google Slides, and
        it comes out in the app's own palette rather than a template's.
      </div>

      <Segmented
        options={[
          { id: 'unit', label: 'From a unit' },
          { id: 'brief', label: 'From a brief' },
        ]}
        value={source}
        onChange={setSource}
        style={{ marginTop: 14 }}
      />

      {source === 'unit' ? (
        <>
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 10, lineHeight: 1.5 }}>
            No model in the loop and nothing invented — your own guide, rearranged. Question on one
            slide, answer on the next.
          </div>

          <SectionLabel>{guide.code}</SectionLabel>
          <select
            className="input"
            value={unit}
            onChange={(e) => setUnit(Number(e.target.value))}
            style={{ width: '100%' }}
          >
            {guide.units.map((u, i) => (
              <option key={u.name} value={i}>
                {u.name}
              </option>
            ))}
          </select>
          {catalog.courses.length > 1 && (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.45, marginTop: 6 }}>
              Switch course from Study.
            </div>
          )}
        </>
      ) : (
        <>
          <SectionLabel>What kind of talk</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {KINDS.map((option) => {
              const on = option.id === kindId;
              return (
                <button
                  key={option.id}
                  type="button"
                  className="bare tappable"
                  aria-pressed={on}
                  onClick={() => setKindId(option.id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 'var(--r-md)',
                    border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                    background: on ? 'var(--app-accent-wash)' : 'transparent',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))' }}>{option.label}</span>
                  <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                    {option.blurb}
                  </span>
                </button>
              );
            })}
          </div>

          <SectionLabel>What it is about</SectionLabel>
          <input
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Federalism and the spending power"
            style={{ width: '100%' }}
          />

          <SectionLabel>The material it may use</SectionLabel>
          <textarea
            className="input"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Your notes, the reading, the findings. Paste it — this is the only thing it is allowed to state as fact."
            style={{ width: '100%', minHeight: 120, resize: 'vertical', lineHeight: 1.5 }}
          />
          <UseSources
            courseId={state.guideId}
            onFill={(lines) => setMaterial((now) => appendTo(now, lines))}
            label="readings"
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
            Anything not in here comes back as a blank in square brackets. A number invented on a
            slide is believed by a whole room at once.
          </div>

          <SectionLabel>What was asked for</SectionLabel>
          <textarea
            className="input"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="The assignment, or what the audience wants out of it."
            style={{ width: '100%', minHeight: 70, resize: 'vertical', lineHeight: 1.5 }}
          />

          <SectionLabel>Who is in the room</SectionLabel>
          <input
            className="input"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="The seminar, the exec board, a panel"
            style={{ width: '100%' }}
          />

          <SectionLabel>How long you have</SectionLabel>
          <Segmented
            options={[
              { id: '5', label: '5 min' },
              { id: '10', label: '10' },
              { id: '15', label: '15' },
              { id: '25', label: '25' },
            ]}
            value={String(minutes)}
            onChange={(next) => setMinutes(Number(next))}
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 5 }}>
            About {slidesFor(minutes, kindById(kindId))} content slides — a slide and a half a
            minute, which is the rate people actually present at.
          </div>

          {configured() ? (
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void make()}
              disabled={busy}
              style={{
                height: 46,
                marginTop: 18,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {busy ? 'Planning it…' : plan ? 'Plan it again' : 'Plan the deck'}
            </button>
          ) : (
            <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 16, lineHeight: 1.5 }}>
              Needs a key first — set one under Ask Claude → Settings. Building a deck from a unit
              needs no key at all.
            </div>
          )}
        </>
      )}

      <Trouble said={trouble.said} onRetry={trouble.again} />

      {file && file.slides.length > 0 && (
        <>
          <SectionLabel>{file.slides.length} slides</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {file.slides.map((slide, i) => (
              <Blueprint key={`${slide.title}-${i}`} style={{ padding: '11px 13px' }}>
                <div className="kicker">
                  {i + 1}
                  {slide.note ? ` · ${slide.note}` : ''}
                </div>
                <div
                  style={{
                    fontSize: slide.opening ? 17 : 14.5,
                    lineHeight: 1.3,
                    marginTop: 5,
                    textWrap: 'pretty',
                  }}
                >
                  {slide.title}
                </div>
                {slide.bullets.map((b, n) => (
                  <div
                    key={`${b}-${n}`}
                    style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 5, lineHeight: 1.45 }}
                  >
                    · {b}
                  </div>
                ))}
              </Blueprint>
            ))}
          </div>

          {left.length > 0 && (
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.65, marginTop: 10, lineHeight: 1.5 }}>
              {left.length} {left.length === 1 ? 'blank' : 'blanks'} in square brackets. Those are
              the facts it would have had to invent — fill them before you present.
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void save()}
            disabled={saving}
            style={{ height: 46, marginTop: 14, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {saving ? 'Writing the file…' : 'Save as PowerPoint'}
          </button>

          {plan && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  download({
                    name: `${deckFileName(plan.title).replace(/\.pptx$/, '')}-notes.md`,
                    body: speakerNotes(plan),
                    mime: 'text/markdown',
                  })
                }
                style={{ flex: 1, height: 42 }}
              >
                Speaker notes
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  dispatch({
                    type: 'keepNote',
                    title: plan.title,
                    body: speakerNotes(plan),
                    courseId: null,
                  });
                  setKept(true);
                }}
                style={{ flex: 1, height: 42 }}
              >
                {kept ? 'Kept' : 'Keep as note'}
              </button>
            </div>
          )}
          <PrintButton label="Print the slides" style={{ marginTop: 8 }} />
          <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 10, lineHeight: 1.45 }}>
            The notes hold what you say over each slide, which is deliberately not what is written
            on it — a slide read aloud is a slide nobody listens to.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}
