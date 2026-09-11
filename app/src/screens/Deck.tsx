import { useMemo, useRef, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, SectionLabel, Segmented } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { PrintButton } from '../components/PrintButton';
import { ask, configured } from '../lib/claude';
import { download } from '../lib/deliver';
import { deckFileName, pptx, type Deck as DeckFile } from '../lib/pptx';
import { DeckEdit, DeckShelf } from './deck/Edit';
import { keepable } from '../lib/decks';
import {
  KINDS,
  SYSTEM,
  brief,
  fromTable,
  fromUnit,
  holes,
  kind as kindById,
  readPlan,
  slidesFor,
  speakerNotes,
  toDeck,
  type Planned,
} from '../lib/deck';
import { filled } from '../lib/sheet';
import { UseSources, appendTo } from '../components/UseSources';
import { NeedsKey } from '../components/NeedsKey';

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
  const { state } = useStore();
  const open = state.decks.find((d) => d.id === state.deckId) ?? null;
  // A deck being edited takes the whole screen; the builders below are how one
  // comes into being in the first place.
  return open ? <DeckEdit deck={open} /> : <Build />;
}

function Build() {
  const { state, catalog, dispatch, courseCode } = useStore();
  const { guide, figuresOn, onUnit } = useLive(state.guideId);

  const [source, setSource] = useState<'unit' | 'brief' | 'sheet'>('unit');
  const [sheetId, setSheetId] = useState<string | null>(null);
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

  const unitDeck = useMemo(
    () =>
      fromUnit(guide, unit, {
        // The unit's figures and any prose a reading brought. Without these a
        // deck handed in carried the cards and left the table the unit is
        // about behind in the app.
        figures: figuresOn(unit),
        notes: onUnit(unit)
          .filter((u) => u.body)
          .map((u) => ({
            title: u.title || 'Added since',
            text: u.body,
            from: u.source || 'Added by you',
          })),
      }),
    [guide, unit, figuresOn, onUnit],
  );
  const planned = plan ? toDeck(plan) : null;

  /*
   * A sheet, as a deck.
   *
   * No model and no guide — the same free door `From a unit` is, for the same
   * reason: a table somebody built is already the content of a slide, and the
   * only thing standing between the two was a file format. Long tables are
   * split across slides by `fromTable` rather than shrunk to fit.
   */
  const chosen = state.sheets.find((sheet) => sheet.id === sheetId) ?? state.sheets[0] ?? null;
  const sheetDeck = useMemo(
    () =>
      chosen
        ? fromTable(
            chosen.title || 'Table',
            filled(chosen),
            chosen.courseId ? courseCode(chosen.courseId) : '',
          )
        : null,
    [chosen, courseCode],
  );

  const file: DeckFile | null =
    source === 'unit' ? unitDeck : source === 'sheet' ? sheetDeck : planned;
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
    <Page bottom={26}>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        A real PowerPoint file, built here. It opens in PowerPoint, Keynote and Google Slides, in
        whichever of the four themes you choose — two for a projector, two for printing.
      </div>

      <DeckShelf />

      <ActionButton
        onClick={() => dispatch({ type: 'newDeck', courseId: null })}
        style={{ marginTop: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}
      >
        Start an empty deck
      </ActionButton>

      <Segmented
        options={[
          { id: 'unit', label: 'From a unit' },
          { id: 'sheet', label: 'From a sheet' },
          { id: 'brief', label: 'From a brief' },
        ]}
        value={source}
        onChange={setSource}
        style={{ marginTop: 14 }}
      />

      {source === 'sheet' ? (
        <>
          <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-relaxed)' }}>
            No model in the loop either. A table you built goes on the slides as a real PowerPoint
            table you can still edit — split over several slides if it is long, rather than shrunk
            until nobody at the back can read it.
          </div>

          <SectionLabel>Which sheet</SectionLabel>
          {state.sheets.length === 0 ? (
            <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
              You have not made a sheet yet. Sheet or table is where they live.
            </div>
          ) : (
            <select
              className="input"
              aria-label="Which sheet"
              value={chosen?.id ?? ''}
              onChange={(e) => setSheetId(e.target.value)}
              style={{ width: '100%' }}
            >
              {state.sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.title || 'Untitled sheet'}
                </option>
              ))}
            </select>
          )}
        </>
      ) : source === 'unit' ? (
        <>
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-relaxed)' }}>
            No model in the loop and nothing invented — your own guide, rearranged. Question on one
            slide, answer on the next.
          </div>

          <SectionLabel>{guide.code}</SectionLabel>
          <select
            className="input"
            aria-label="Which unit"
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
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.45, marginTop: 'var(--sp-3)' }}>
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
                  <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{option.label}</span>
                  <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-1)' }}>
                    {option.blurb}
                  </span>
                </button>
              );
            })}
          </div>

          <SectionLabel>What it is about</SectionLabel>
          <input
            aria-label="What it is about"
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Federalism and the spending power"
            style={{ width: '100%' }}
          />

          <SectionLabel>The material it may use</SectionLabel>
          <textarea
            aria-label="The material it may use"
            className="input"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Your notes, the reading, the findings. Paste it — this is the only thing it is allowed to state as fact."
            style={{ width: '100%', minHeight: 120, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
          />
          <UseSources
            courseId={state.guideId}
            onFill={(lines) => setMaterial((now) => appendTo(now, lines))}
            label="readings"
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            Anything not in here comes back as a blank in square brackets. A number invented on a
            slide is believed by a whole room at once.
          </div>

          <SectionLabel>What was asked for</SectionLabel>
          <textarea
            aria-label="What was asked for"
            className="input"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="The assignment, or what the audience wants out of it."
            style={{ width: '100%', minHeight: 70, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
          />

          <SectionLabel>Who is in the room</SectionLabel>
          <input
            aria-label="Who is in the room"
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
            <ActionButton
              onClick={() => void make()}
              disabled={busy}
              tone="primary"
              style={{ marginTop: 18 }}
            >
              {busy ? 'Planning it…' : plan ? 'Plan it again' : 'Plan the deck'}
            </ActionButton>
          ) : (
            <NeedsKey also="Building a deck from a unit needs no key at all." />
          )}
        </>
      )}

      <Trouble said={trouble.said} onRetry={trouble.again} />

      {file && file.slides.length > 0 && (
        <>
          <SectionLabel>{file.slides.length} slides</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {file.slides.map((slide, i) => (
              <Blueprint plain key={`${slide.title}-${i}`} style={{ padding: '11px 13px' }}>
                <div className="kicker">
                  {i + 1}
                  {slide.note ? ` · ${slide.note}` : ''}
                </div>
                <div
                  style={{
                    fontSize: slide.opening ? 17 : 14.5,
                    lineHeight: 'var(--leading-tight)',
                    marginTop: 5,
                    textWrap: 'pretty',
                  }}
                >
                  {slide.title}
                </div>
                {slide.bullets.map((b, n) => (
                  <div
                    key={`${b}-${n}`}
                    style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 5, lineHeight: 'var(--leading-normal)' }}
                  >
                    · {b}
                  </div>
                ))}
                {/*
                  A table slide has no bullets, so without this it previewed as
                  a title and nothing else — which reads as an empty slide
                  rather than as a slide whose content is a table. The rows are
                  shown as they will be laid out, tab-width apart.
                */}
                {slide.table?.map((row, n) => (
                  <div
                    key={`row-${n}`}
                    style={{
                      ...secondLine(),
                      // On the scale, unlike the bullets above it: the rule for
                      // anything new here is that a file with no entry in the
                      // ledger owes nothing, and half a pixel is not worth one.
                      fontSize: 'var(--type-sm)',
                      marginTop: 'var(--sp-3)',
                      lineHeight: 'var(--leading-normal)',
                      fontWeight: n === 0 ? 600 : 400,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {row.join('  ·  ')}
                  </div>
                ))}
              </Blueprint>
            ))}
          </div>

          {left.length > 0 && (
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.65, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-relaxed)' }}>
              {left.length} {left.length === 1 ? 'blank' : 'blanks'} in square brackets. Those are
              the facts it would have had to invent — fill them before you present.
            </div>
          )}

          <ActionButton
            onClick={() => void save()}
            disabled={saving}
            tone="primary"
            style={{ marginTop: 14 }}
          >
            {saving ? 'Writing the file…' : 'Save as PowerPoint'}
          </ActionButton>

          {/*
            The other way out, and the one that was missing. A deck built here
            went straight to a file and was gone — so cutting a slide, fixing a
            title or adding speaker notes meant doing it in PowerPoint, and
            everything this app knows stayed behind.
          */}
          {file && (
            <ActionButton
              onClick={() =>
                dispatch({
                  type: 'makeDeck',
                  deck: keepable(file, state.guideId),
                  open: true,
                })
              }
              style={{ marginTop: 'var(--sp-4)' }}
            >
              Keep it, and edit the slides
            </ActionButton>
          )}

          {plan && (
            <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
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
          <PrintButton label="Print the slides" style={{ marginTop: 'var(--sp-4)' }} />
          <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
            The notes hold what you say over each slide, which is deliberately not what is written
            on it — a slide read aloud is a slide nobody listens to.
          </div>
        </>
      )}
    </Page>
  );
}
