import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Dictate } from '../components/Dictate';
import { proposalsLine, readProposal, TOOLS, type Proposal } from '../lib/tools';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { datedItems } from '../lib/select';
import { MODELS, ask, configured, makeCards, modelLabel, provider, route, routeLabel, saveSettings, settings, type Turn } from '../lib/claude';
import { OPENAI_MODELS } from '../lib/openai';
import type { CourseId } from '../lib/types';

/**
 * Claude, with the course in front of it.
 *
 * The point is not a chat window. It is that the app already holds the guide,
 * the deadlines and what you are weakest at, so the question "explain hurdle
 * three again" can be answered against this course rather than in general — and
 * that an answer worth keeping becomes cards, which land in Cards, Read, Quiz,
 * Cram and the lesson slides at once.
 */
export function Ask() {
  const { state, dispatch, now, catalog } = useStore();
  const courseId: CourseId = state.guideId;
  const { guide } = useLive(courseId);

  const [config, setConfig] = useState(settings());
  const [showKey, setShowKey] = useState(!configured());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const [made, setMade] = useState(0);
  /**
   * What Claude has offered to do, waiting on a tap.
   *
   * Cleared at the start of every question: an offer from three turns ago is
   * an offer about a state of the world that has moved on.
   */
  const [proposals, setProposals] = useState<Proposal[]>([]);
  /** The last question asked, so a failure can be tried again without retyping. */
  const abort = useRef<AbortController | null>(null);

  /**
   * The deadlines this course still has, with their ids.
   *
   * The ids go into the prompt because a tool call has to name one — and
   * every id that comes back is checked against this same list before it
   * becomes a button, so an invented one produces nothing. See `lib/tools.ts`.
   */
  const dueNow = useMemo(
    () =>
      datedItems(catalog, now)
        .filter((i) => i.c === courseId && !i.isPast)
        .slice(0, 6)
        .map((i) => ({ id: i.id, title: i.title, mon: i.mon, day: i.day, weight: i.weight })),
    [catalog, now, courseId],
  );

  // The course, compressed enough to send and specific enough to be useful.
  const context = useMemo(() => {
    const due = dueNow
      .map((i) => `- [${i.id}] ${i.title} · ${i.mon} ${i.day} · ${i.weight}`)
      .join('\n');
    const units = guide.units
      .map(
        (u, i) =>
          `${i + 1}. ${u.name} (${u.mastery}% mastered)\n` +
          u.cards.slice(0, 4).map((c) => `   · ${c.q} — ${c.a}`).join('\n'),
      )
      .join('\n');
    return `${guide.code} — ${guide.name}\n${guide.blurb}\n\nUpcoming:\n${due || '- nothing left'}\n\nUnits:\n${units}`;
  }, [guide, dueNow]);

  const system =
    'You are helping a Vanderbilt undergraduate study one specific course. ' +
    'The course guide below is the material they are being examined on — prefer it over general knowledge, ' +
    'and say so when the guide does not cover something. Be specific: numbers, names, mechanisms. ' +
    'Short paragraphs, no filler, no restating the question. ' +
    'Each deadline below carries its id in brackets; use those ids when a tool needs one, ' +
    'and never invent one. Offer a tool only when the student has actually asked for the thing ' +
    'it does — an unasked-for offer is noise they have to dismiss.\n\n' +
    context;

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: text.trim() }];
    setTurns(next);
    setDraft('');
    setStreaming('');
    trouble.clear();
    setProposals([]);
    setBusy(true);
    abort.current = new AbortController();
    let sofar = '';
    try {
      const reply = await ask({
        system,
        messages: next,
        // Every question about this course opens with the same guide. Caching
        // is a prefix match, so the saving is real only because `context`
        // holds absolute dates rather than "in three days" — a relative time
        // would rewrite the prompt every thirty seconds and quietly cost the
        // whole thing. A short course will not reach the minimum cacheable
        // length and simply will not cache, which costs nothing.
        cache: true,
        // Proposals only. `readProposal` re-checks every argument against
        // what the app actually holds, and nothing runs until it is tapped.
        // See `lib/tools.ts`.
        tools: TOOLS,
        onToolUse: (call) => {
          const p = readProposal(call, { deadlines: dueNow });
          if (p) setProposals((was) => (was.some((q) => q.id === p.id) ? was : [...was, p]));
        },
        signal: abort.current.signal,
        onText: (chunk) => {
          sofar += chunk;
          setStreaming(sofar);
        },
      });
      setTurns([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      // Pressing Stop is a decision, not a failure. Keep what had arrived —
      // half an answer you asked to cut short is still worth reading.
      if (e instanceof DOMException && e.name === 'AbortError') {
        if (sofar.trim()) setTurns([...next, { role: 'assistant', content: sofar }]);
      } else {
        // `send` here is the one from the render that failed, so it still
        // closes over the transcript as it was *before* this question was
        // appended. Calling it again re-appends the same turn rather than
        // stacking a second copy of it.
        trouble.failed(e, () => void send(text));
      }
    } finally {
      setStreaming('');
      setBusy(false);
    }
  };

  /** Turn the last answer into cards on this course. */
  const keep = async () => {
    const last = turns.filter((t) => t.role === 'assistant').at(-1);
    if (!last || busy) return;
    setBusy(true);
    trouble.clear();
    try {
      const cards = await makeCards(last.content, context);
      if (cards.length === 0) {
        // Not a failure to retry: the answer is prose that does not break
        // into questions, and asking again would cost a request to be told so
        // a second time.
        trouble.wrong('Nothing in that answer made a clean card. Nothing was added.');
        return;
      }
      dispatch({
        type: 'addUpdate',
        update: {
          courseId,
          unit: null,
          title: 'From a question you asked',
          // Recorded on the material so a card's origin is still readable in a
          // month, whichever provider was answering when it was made.
          source: provider(),
          body: '',
          cards,
          terms: [],
          fileIds: [],
        },
      });
      setMade(cards.length);
    } catch (e) {
      trouble.failed(e, () => void keep());
    } finally {
      setBusy(false);
    }
  };

  const weakest = guide.units.reduce((a, b) => (b.mastery < a.mastery ? b : a), guide.units[0]);

  return (
    <div style={{ padding: 18 }}>
      <div className="chiprow">
        <div style={{ display: 'flex', gap: 6 }}>
          {catalog.courses.map((c) => {
            const on = c.id === courseId;
            return (
              <button
                key={c.id}
                type="button"
                className="btn"
                onClick={() => dispatch({ type: 'openGuide', id: c.id, mode: state.mode })}
                aria-pressed={on}
                style={{
                  flex: 'none',
                  padding: '5px 11px',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: on ? 'var(--chrome)' : 'transparent',
                  color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                  borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                }}
              >
                {catalog.byId[c.id].code.split(/\s+/)[0]}
              </button>
            );
          })}
        </div>
      </div>

      {!configured(config) || showKey ? (
        <Blueprint style={{ padding: 16, marginTop: 14 }}>
          <div className="kicker">Setup</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, marginTop: 5 }}>
            Where the answers come from
          </div>
          <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.5, marginTop: 6, textWrap: 'pretty' }}>
            {config.provider === 'openai'
              ? 'Two providers, so a lapsed account or an outage the night before a midterm does not stop the app working. Nothing above this setting knows which one answered.'
              : route() === 'shared'
                ? 'Signed in, so this is already working — the shared key lives in a server function, metered per account, and never reaches this browser. Add your own key below only if you want past the monthly limit.'
                : 'A key typed here is stored on this device and sent only to Anthropic. Be clear-eyed about it: anything running in this browser can read a key in this browser. Signing in uses the shared key instead, and a proxy you run is better still — the proxy field wins when both are filled in.'}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {(
              [
                { id: 'anthropic', label: 'Claude' },
                { id: 'openai', label: 'ChatGPT' },
              ] as const
            ).map((p) => {
              const on = config.provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="btn"
                  onClick={() => setConfig({ ...config, provider: p.id })}
                  aria-pressed={on}
                  style={{
                    flex: 1,
                    padding: '7px 11px',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: on ? 'var(--chrome)' : 'transparent',
                    color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                    borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {config.provider === 'openai' ? (
            <>
              <div style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.5, marginTop: 10 }}>
                There is no shared key on this side — the server function holds an Anthropic key
                and nothing else. So this means your own OpenAI key, in this browser, where
                anything running here can read it. It is billable and has no spend cap of its own.
              </div>
              <input
                className="input"
                type="password"
                placeholder="sk-…"
                value={config.openaiKey}
                onChange={(e) => setConfig({ ...config, openaiKey: e.target.value })}
                style={{ fontSize: 13, marginTop: 10 }}
                aria-label="OpenAI API key"
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {OPENAI_MODELS.map((m) => {
                  const on = config.openaiModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="btn"
                      onClick={() => setConfig({ ...config, openaiModel: m.id })}
                      aria-pressed={on}
                      style={{
                        padding: '5px 11px',
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        background: on ? 'var(--chrome)' : 'transparent',
                        color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                        borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6 }}>
                {OPENAI_MODELS.find((m) => m.id === config.openaiModel)?.note}
                {' '}Extended thinking is Anthropic-only, so the screens that ask for it simply do
                not get it here.
              </div>
            </>
          ) : (
            <>
          <input
            className="input"
            type="password"
            placeholder="sk-ant-…"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            style={{ fontSize: 13, marginTop: 12 }}
            aria-label="API key"
          />
          <input
            className="input"
            placeholder="https://your-proxy.example.com  (better)"
            value={config.proxy}
            onChange={(e) => setConfig({ ...config, proxy: e.target.value })}
            style={{ fontSize: 13, marginTop: 8 }}
            aria-label="Proxy URL"
          />

          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {MODELS.map((m) => {
              const on = config.model === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className="btn"
                  onClick={() => setConfig({ ...config, model: m.id })}
                  aria-pressed={on}
                  style={{
                    padding: '5px 11px',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: on ? 'var(--chrome)' : 'transparent',
                    color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                    borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6 }}>
            {MODELS.find((m) => m.id === config.model)?.note}
          </div>
            </>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              saveSettings(config);
              setShowKey(false);
            }}
            style={{
              height: 44,
              fontSize: 13,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 12,
            }}
          >
            Save on this device
          </button>
        </Blueprint>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 14,
          }}
        >
          <div className="kicker">
            {guide.code} · {modelLabel()} · {routeLabel()}
          </div>
          <button
            type="button"
            className="bare"
            onClick={() => setShowKey(true)}
            style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em' }}
          >
            SETTINGS
          </button>
        </div>
      )}

      {turns.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
          {[
            `Explain ${weakest?.name ?? 'the first unit'} as if I have not read it.`,
            'Give me three exam questions on this course and mark my answers as I go.',
            'What is the difference between the two things I keep confusing in this course?',
          ].map((prompt) => (
            <Blueprint
              key={prompt}
              onClick={() => void send(prompt)}
              style={{ padding: '12px 14px', textAlign: 'left', fontSize: 13.5, lineHeight: 1.4 }}
            >
              {prompt}
            </Blueprint>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {turns.map((t, i) => (
          <div key={i}>
            <div className="kicker" style={{ color: t.role === 'user' ? 'inherit' : 'var(--app-accent)' }}>
              {t.role === 'user' ? 'You' : provider()}
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                marginTop: 4,
                whiteSpace: 'pre-wrap',
                opacity: t.role === 'user' ? 0.75 : 1,
                textWrap: 'pretty',
              }}
            >
              {t.content}
            </div>
          </div>
        ))}
        {streaming && (
          <div>
            <div className="kicker" style={{ color: 'var(--app-accent)' }}>
              {provider()}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, marginTop: 4, whiteSpace: 'pre-wrap' }}>
              {streaming}
            </div>
          </div>
        )}
      </div>

      {/* What it has offered to do. Nothing here has happened: each line says
          exactly what its button will change, and the button is the only
          thing that changes it. See `lib/tools.ts`. */}
      {proposals.length > 0 && !busy && (
        <div
          style={{
            marginTop: 14,
            padding: '11px 13px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--app-line)',
            background: 'var(--app-panel)',
          }}
        >
          <div className="kicker">{proposalsLine(proposals)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
            {proposals.map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.4 }}>
                  {p.said}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    dispatch(p.action);
                    setProposals((was) => was.filter((q) => q.id !== p.id));
                  }}
                  style={{ flex: 'none', height: 34, fontSize: 12 }}
                >
                  {p.verb}
                </button>
                <button
                  type="button"
                  className="bare"
                  aria-label={`Dismiss: ${p.said}`}
                  onClick={() => setProposals((was) => was.filter((q) => q.id !== p.id))}
                  style={{ flex: 'none', width: 22, opacity: 0.4, fontSize: 14 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The question is still the last turn, so asking again is asking the
          same thing — no retyping, and the conversation keeps its shape. */}
      <Trouble said={trouble.said} onRetry={trouble.again} busy={busy} />
      {made > 0 && (
        <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 12, lineHeight: 1.45 }}>
          {made} cards added to {guide.code}. They are in Cards, Read, Quiz and Cram now.
        </div>
      )}

      <textarea
        className="input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send(draft);
        }}
        placeholder="Ask about this course, or paste a reading to turn into cards…"
        style={{ minHeight: 84, fontSize: 13.5, lineHeight: 1.5, marginTop: 16 }}
        aria-label="Your question"
      />
      <Dictate compact current={draft} onText={setDraft} label="Say it instead" />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !draft.trim()}
          onClick={() => void send(draft)}
          style={{ flex: 1, height: 44, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
        {busy ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => abort.current?.abort()}
            style={{ height: 44, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!turns.some((t) => t.role === 'assistant')}
            onClick={() => void keep()}
            style={{ height: 44, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Keep as cards
          </button>
        )}
      </div>

      <SectionLabel>What it can see</SectionLabel>
      <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        This course’s guide — {guide.units.length} units, their cards and how well you know them —
        and the deadlines still ahead. Not your notes, not your files, not the other courses.
        Nothing is sent anywhere else, and nothing is stored beyond this conversation.
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
