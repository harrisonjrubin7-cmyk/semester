import { useState } from 'react';
import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { secondLine } from '../../lib/dim';
import { checkKey, checkShared } from '../../lib/claude';
import {
  MODELS,
  OPENAI_MODELS,
  configured,
  envProxy,
  modelLabel,
  proxyProblem,
  route,
  routeLabel,
  saveSettings,
  settings,
  sharedEndpoint,
} from '../../lib/assistant';
import {
  UNNAMED,
  byAsker,
  byCourse,
  money,
  monthStart,
  read as readSpend,
  since,
  total,
  RATES_READ,
} from '../../lib/spend';
import { ActionButton, SectionLabel } from '../../components/ui';

/**
 * Where the answers come from, what they cost, and what leaves the device.
 *
 * All of this used to be the Ask Claude *screen* — a tab in the bar, named
 * after the assistant, that opened a key form and two disclosure lists and a
 * button saying the assistant was somewhere else. Somebody tapping "Ask
 * Claude" wants to ask Claude something. The tab is the conversation now, and
 * this is the part of that screen which was never conversation: a choice made
 * once, checked occasionally, and belonging on a page you go to on purpose.
 *
 * The disclosure is here rather than in front of the box for the same reason.
 * It is something to check, not something to read every time — and putting it
 * where checking happens is what makes it read as a claim the app stands
 * behind rather than a notice it is clearing its throat with.
 *
 * ## The second copy, folded in
 *
 * Connect accounts carried its own key field, model picker and `saveSettings`
 * call until `/simplify` found them — two implementations of one setting, which
 * is a setting that can disagree with itself. That copy is gone and the two
 * things it had which this did not came across: the check-the-key button below,
 * and the sentence in the footer saying there is no "sign in with Claude" to
 * look for. Both were the answer to somebody hunting for a login button, and
 * that hunt now ends on this page rather than on a screen about calendars.
 */
export function SettingsAssistant() {
  const [config, setConfig] = useState(settings());
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);

  /*
   * Checked by using it, before it is saved.
   *
   * Came from the second copy of this form, which lived on Connect accounts
   * until the two were merged. The reason it is worth keeping is the one that
   * copy gave: the alternative is discovering a typo halfway through
   * generating a course from a syllabus that took five minutes to upload.
   */
  const verify = async () => {
    setChecking(true);
    setResult(null);
    const got = await checkKey(config.apiKey);
    setResult(got);
    if (got.ok) {
      saveSettings(config);
      setSaved(true);
    }
    setChecking(false);
  };

  /*
   * The same button for the route where the failure is not yours to fix.
   *
   * Nothing is saved on the way out: there is no setting behind this one, only
   * a deployment that either holds a key or does not, so the answer is the
   * whole of what the press is for.
   */
  const verifyShared = async () => {
    setChecking(true);
    setResult(null);
    setResult(await checkShared());
    setChecking(false);
  };
  const spend = readSpend();
  const month = total(since(spend, monthStart(new Date())));
  const courses = byCourse(spend);
  const askers = byAsker(spend);
  const { courseCode } = useStore();
  /*
   * One row of the breakdown. Written here rather than in a component because
   * it is two spans and a gap, and `scripts/styles.mjs` counts what is worth
   * counting — a wrapper would cost more lines than it saves.
   */
  const spendRow = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-1) 0',
  } as const;

  const chip = (on: boolean) => ({
    paddingBlock: 'calc(5px * var(--density, 1))', paddingInline: 'calc(11px * var(--density, 1))',
    fontSize: 'var(--type-xs)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    background: on ? 'var(--chrome)' : 'transparent',
    color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
    borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
  });

  return (
    <SettingsPage
      screen="setAssistant"
      blurb="Which provider answers, which model, and what it has cost. The assistant itself is the Ask tab."
    >
      {(lit) => (
        <>
          <Group
            header="Where the answers come from"
            footer={
              config.provider === 'openai'
                ? 'Two providers, so a lapsed account or an outage the night before a midterm does not stop the app working. Nothing above this setting knows which one answered.'
                : route() === 'shared'
                  ? 'Signed in, so the shared key is the route: it lives in a server function, metered per account, and never reaches this browser. Whether that function holds a key is this deployment’s doing rather than yours — the button below asks it, without spending a generation. Add your own key only to go past the monthly limit.'
                  : 'There is no “sign in with Claude”: Anthropic publishes no consumer login for other apps, so a claude.ai Pro or Max subscription cannot be linked here by any app. What works is a key from console.anthropic.com → API keys, billed separately per use. A key typed here is stored on this device and sent only to Anthropic. Be clear-eyed about it: anything running in this browser can read a key in this browser. Signing in uses the shared key instead, and a proxy you run is better still — an address in the proxy box wins over a key when both are filled in, and anything in it that is not an address is ignored.'
            }
            lit={lights('provider claude openai chatgpt anthropic key api model', lit)}
          >
            <CustomRow>
              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                {(
                  [
                    { id: 'anthropic', label: 'Claude' },
                    { id: 'openai', label: 'ChatGPT' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn"
                    onClick={() => setConfig({ ...config, provider: p.id })}
                    aria-pressed={config.provider === p.id}
                    style={{ flex: 1, ...chip(config.provider === p.id), paddingBlock: 'calc(7px * var(--density, 1))', paddingInline: 'calc(11px * var(--density, 1))' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </CustomRow>

            {config.provider === 'openai' ? (
              <CustomRow>
                <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)' }}>
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
                  {OPENAI_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn"
                      onClick={() => setConfig({ ...config, openaiModel: m.id })}
                      aria-pressed={config.openaiModel === m.id}
                      style={chip(config.openaiModel === m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
                  {OPENAI_MODELS.find((m) => m.id === config.openaiModel)?.note} Extended thinking is
                  Anthropic-only, so the screens that ask for it simply do not get it here.
                </div>
              </CustomRow>
            ) : (
              <CustomRow>
                {/*
                  * The case where there is nothing to do here.
                  *
                  * A copy run with ANTHROPIC_API_KEY in app/.env.local is
                  * already answering, through a proxy the page knows only the
                  * address of. Without this line the screen shows two empty
                  * boxes and no hint that they are empty on purpose, which is
                  * exactly the moment somebody pastes a key into a browser
                  * that did not need one.
                  */}
                {envProxy() && !config.proxy.trim() && !config.apiKey.trim() && (
                  <div
                    style={{
                      fontSize: 'var(--type-sm)',
                      ...secondLine(),
                      lineHeight: 'var(--leading-relaxed)',
                      marginBottom: 'var(--sp-5)',
                      textWrap: 'pretty',
                    }}
                  >
                    This copy already has somewhere to ask: <code>{envProxy()}</code>, holding a key
                    this browser never sees. Leave both boxes empty to keep using it — a key typed
                    here would be used instead, and would live in this browser.
                  </div>
                )}
                <input
                  className="input"
                  type="password"
                  placeholder="sk-ant-…"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  style={{ fontSize: 'var(--type-base)' }}
                  aria-label="API key"
                />
                <input
                  className="input"
                  placeholder="https://your-proxy.example.com  (better)"
                  value={config.proxy}
                  onChange={(e) => setConfig({ ...config, proxy: e.target.value })}
                  style={{ fontSize: 'var(--type-base)', marginTop: 'var(--sp-4)' }}
                  aria-label="Proxy URL"
                  aria-invalid={proxyProblem(config.proxy) ? true : undefined}
                />
                {/*
                  * Said here, where it was typed, rather than as a number in
                  * the middle of a question.
                  *
                  * Two boxes of long identifiers one above the other: a key in
                  * the second one, or a workspace id, used to take the route
                  * and send every question to whatever serves this page —
                  * which answers a POST with 405 and nothing else. It is
                  * ignored now, so the key above answers; this is the line
                  * that says so before somebody spends an evening on it.
                  */}
                {proxyProblem(config.proxy) && (
                  <div
                    style={{
                      fontSize: 'var(--type-sm)',
                      color: 'var(--app-accent)',
                      marginTop: 'var(--sp-3)',
                      lineHeight: 'var(--leading-normal)',
                      textWrap: 'pretty',
                    }}
                  >
                    {proxyProblem(config.proxy)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn"
                      onClick={() => setConfig({ ...config, model: m.id })}
                      aria-pressed={config.model === m.id}
                      style={chip(config.model === m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
                  {MODELS.find((m) => m.id === config.model)?.note}
                </div>
              </CustomRow>
            )}

            <CustomRow>
              <ActionButton
                onClick={() => {
                saveSettings(config);
                setSaved(true);
                }}
                tone="primary"
              >
                {saved ? 'Saved on this device' : 'Save on this device'}
              </ActionButton>
              {config.provider !== 'openai' && config.apiKey.trim() !== '' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  disabled={checking}
                  onClick={() => void verify()}
                  style={{ height: 42, marginTop: 'var(--sp-4)' }}
                >
                  {checking ? 'Checking…' : 'Check this key works'}
                </button>
              )}
              {/*
                * Offered on the strength of the build having a shared key, not
                * of being signed in. Somebody with no account is exactly who
                * the answer is for: whether signing in is worth doing is the
                * question, and until this the only way to find out was to make
                * an account, upload a syllabus and wait.
                */}
              {config.provider !== 'openai' && sharedEndpoint() !== '' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  disabled={checking}
                  onClick={() => void verifyShared()}
                  style={{ height: 42, marginTop: 'var(--sp-4)' }}
                >
                  {checking ? 'Checking…' : 'Check the shared key works'}
                </button>
              )}
              {result && (
                <div
                  style={{
                    fontSize: 'var(--type-sm)',
                    marginTop: 'var(--sp-4)',
                    lineHeight: 'var(--leading-normal)',
                    color: result.ok ? 'var(--app-fg)' : 'var(--app-accent)',
                    textWrap: 'pretty',
                  }}
                >
                  {result.detail}
                </div>
              )}
              {configured() && (
                <div className="kicker" style={{ marginTop: 'var(--sp-4)' }}>
                  {modelLabel()} · {routeLabel()}
                </div>
              )}
            </CustomRow>
          </Group>

          {month.asks > 0 && (
            <Group header="What this has cost" lit={lights('cost spend money tokens billing usage', lit)}>
              <CustomRow>
                <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
                  About {money(month.dollars)} this month, over {month.asks}{' '}
                  {month.asks === 1 ? 'answer' : 'answers'}.{' '}
                  <span style={{ color: 'var(--app-dim)' }}>
                    Tokens are counted by the API; the money is an estimate at list prices as at{' '}
                    {RATES_READ}, so treat it as a scale rather than a bill.
                    {month.unpriced > 0
                      ? ` ${month.unpriced} were answered by a model with no rate here, so the total is short by those.`
                      : ''}{' '}
                    All time: {money(total(spend).dollars)}.
                  </span>
                </div>
              </CustomRow>
              {/*
                * Where the money went, in the two ways the question gets asked.
                *
                * Until the recording moved inside `ask`, this whole section
                * covered the Ask tab and nothing else — one of twenty-five
                * places that spend. Somebody who had built three courses read
                * a figure of a few pence and had no way to know it was the
                * chat's figure rather than the app's.
                *
                * By course first, because "what did this course cost to
                * build" is §7.2's question and the build is the large line.
                * Then by what asked, because the two are different answers:
                * one says which course was expensive, the other says which
                * part of the work was.
                */}
              {courses.length > 0 && (
                <CustomRow>
                  <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                    <SectionLabel>By course</SectionLabel>
                    {courses.map((row) => (
                      <div key={row.courseId} style={spendRow}>
                        <span>{courseCode(row.courseId) || row.courseId}</span>
                        <span style={{ color: 'var(--app-dim)' }}>
                          {money(row.spent.dollars)} · {row.spent.asks}
                        </span>
                      </div>
                    ))}
                  </div>
                </CustomRow>
              )}
              <CustomRow>
                <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
                  <SectionLabel>By what asked</SectionLabel>
                  {askers.map((row) => (
                    <div key={row.from} style={spendRow}>
                      <span>{row.from === UNNAMED ? 'not said' : row.from}</span>
                      <span style={{ color: 'var(--app-dim)' }}>
                        {money(row.spent.dollars)} · {row.spent.asks}
                      </span>
                    </div>
                  ))}
                </div>
              </CustomRow>
            </Group>
          )}

          {/* Two lists, both written from what the code does rather than from
              what the feature was meant to do. The first stopped being true
              once `ask` widened past one course, which is exactly how these
              go wrong. */}
          <Group header="What it can see" lit={lights('privacy sees reads context what is sent', lit)}>
            <CustomRow>
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
                Your course codes and today’s date, always — and what the screen you are on says it
                is showing, after its own filters. For a question about your own records: the
                deadlines in the window you asked about, and the grades, attendance and unit names
                for the courses you named. Cards travel only when you name one course and ask about
                its material.
                <br />
                <br />
                Never, whatever is asked: your notes, your drafts, your files, anyone in People or
                Letters, and no key or token of any kind. That list is one file —{' '}
                <code>lib/context.ts</code> — and it is the only thing that decides what leaves this
                device. Every screen’s description goes through it too, rather than around it.
              </div>
            </CustomRow>
          </Group>

          <Group header="What it can do" lit={lights('tools actions change undo permissions', lit)}>
            <CustomRow>
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
                Offer to tick off a deadline, add or move one of your own tasks, mark you at a class,
                start a timer, keep a note, add a source, track or move an application, set your
                study budget, change the accent, text size, background or spacing, or take you to a
                screen. Nothing happens until you tap it, and everything it changes has an Undo
                beside it.
                <br />
                <br />
                It cannot delete anything, and it cannot touch a grade, a dropped score, the grading
                scale or a date that came from a syllabus. There is no tool for any of those, so it
                cannot do them by accident and cannot do them by being asked. It does not comment on
                how you are feeling: the app holds a timetable, not a person.
              </div>
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
