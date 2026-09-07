import { useState } from 'react';
import { Page } from '../components/Page';
import { useAI } from '../ai/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { MODELS, configured, modelLabel, route, routeLabel, saveSettings, settings } from '../lib/claude';
import { OPENAI_MODELS } from '../lib/openai';
import { money, monthStart, read as readSpend, since, total, RATES_READ } from '../lib/spend';

/**
 * Where the answers come from, and the way in to the assistant.
 *
 * This screen used to be the assistant: a course chip row, a transcript, a
 * box, proposals, the lot. It is not any more, and that is the point of the
 * whole rewrite — the assistant is in the shell now, on every screen, and it
 * knows what you are looking at. A second conversation living inside a screen
 * would be a second assistant with its own turns and its own idea of where
 * you are, which is the failure the brief names first.
 *
 * What is left here is the part that was never conversation: which provider
 * answers, which model, and what it has cost. Those belong on a screen you go
 * to deliberately, not in a sheet you open mid-question.
 */
export function Ask() {
  const ai = useAI();
  const [config, setConfig] = useState(settings());
  const [showKey, setShowKey] = useState(!configured());
  const spend = readSpend();
  const month = total(since(spend, monthStart(new Date())));

  return (
    <Page>
      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.75, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        The assistant is on every screen now — the button in the corner, or{' '}
        <kbd style={{ padding: '1px 5px', border: '1px solid var(--app-line-top)', borderRadius: 'var(--r-sm)' }}>A</kbd>{' '}
        from anywhere. It sees what that screen is showing, so a question about
        your grades asked on Grades does not need to name the course.
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => ai.show()}
        style={{ height: 44, marginTop: 'var(--sp-6)', fontSize: 'var(--type-sm)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        Open the assistant
      </button>

      {!configured(config) || showKey ? (
        <Blueprint style={{ padding: 'var(--sp-7)', marginTop: 14 }}>
          <div className="kicker">Setup</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(19px * var(--text-scale, 1))', marginTop: 5 }}>
            Where the answers come from
          </div>
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.78, lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-3)', textWrap: 'pretty' }}>
            {config.provider === 'openai'
              ? 'Two providers, so a lapsed account or an outage the night before a midterm does not stop the app working. Nothing above this setting knows which one answered.'
              : route() === 'shared'
                ? 'Signed in, so this is already working — the shared key lives in a server function, metered per account, and never reaches this browser. Add your own key below only if you want past the monthly limit.'
                : 'A key typed here is stored on this device and sent only to Anthropic. Be clear-eyed about it: anything running in this browser can read a key in this browser. Signing in uses the shared key instead, and a proxy you run is better still — the proxy field wins when both are filled in.'}
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
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
                    fontSize: 'var(--type-xs)',
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
              <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-5)' }}>
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
                style={{ fontSize: 'var(--type-base)', marginTop: 'var(--sp-5)' }}
                aria-label="OpenAI API key"
              />
              <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
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
                        fontSize: 'var(--type-xs)',
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
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-3)' }}>
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
            style={{ fontSize: 'var(--type-base)', marginTop: 'var(--sp-6)' }}
            aria-label="API key"
          />
          <input
            className="input"
            placeholder="https://your-proxy.example.com  (better)"
            value={config.proxy}
            onChange={(e) => setConfig({ ...config, proxy: e.target.value })}
            style={{ fontSize: 'var(--type-base)', marginTop: 'var(--sp-4)' }}
            aria-label="Proxy URL"
          />

          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
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
                    fontSize: 'var(--type-xs)',
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
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-3)' }}>
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
              fontSize: 'var(--type-base)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 'var(--sp-6)',
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
            {modelLabel()} · {routeLabel()}
          </div>
          <button
            type="button"
            className="bare"
            onClick={() => setShowKey(true)}
            style={{ flex: 'none', width: 'auto', fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em' }}
          >
            SETTINGS
          </button>
        </div>
      )}


      {month.asks > 0 && (
        <>
          <SectionLabel>What this has cost</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
            About {money(month.dollars)} this month, over {month.asks}{' '}
            {month.asks === 1 ? 'answer' : 'answers'}.{' '}
            <span style={{ opacity: 0.6 }}>
              Tokens are counted by the API; the money is an estimate at list prices as at{' '}
              {RATES_READ}, so treat it as a scale rather than a bill.
              {month.unpriced > 0
                ? ` ${month.unpriced} were answered by a model with no rate here, so the total is short by those.`
                : ''}{' '}
              All time: {money(total(spend).dollars)}.
            </span>
          </div>
        </>
      )}

      {/* Two lists, both written from what the code does rather than from what
          the feature was meant to do. The first stopped being true once `ask`
          widened past one course, which is exactly how these go wrong. */}
      <SectionLabel>What it can see</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        Your course codes and today’s date, always — and what the screen you are on says it is
        showing, after its own filters. For a question about your own records: the deadlines in the
        window you asked about, and the grades, attendance and unit names for the courses you named.
        Cards travel only when you name one course and ask about its material.
        <br />
        <br />
        Never, whatever is asked: your notes, your drafts, your files, anyone in People or Letters,
        and no key or token of any kind. That list is one file — <code>lib/context.ts</code> — and it
        is the only thing that decides what leaves this device. Every screen’s description goes
        through it too, rather than around it.
      </div>

      <SectionLabel>What it can do</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        Offer to tick off a deadline, add or move one of your own tasks, mark you at a class, start a
        timer, keep a note, add a source, track or move an application, set your study budget, change
        the accent, text size, background or spacing, or take you to a screen. Nothing happens until
        you tap it, and everything it changes has an Undo beside it.
        <br />
        <br />
        It cannot delete anything, and it cannot touch a grade, a dropped score, the grading scale or
        a date that came from a syllabus. There is no tool for any of those, so it cannot do them by
        accident and cannot do them by being asked. It does not comment on how you are feeling: the
        app holds a timetable, not a person.
      </div>
    </Page>
  );
}
