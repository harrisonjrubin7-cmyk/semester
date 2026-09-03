import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, DateRow, Meter, SectionLabel, Segmented, TickBox } from '../components/ui';
import { Check, ChevronRight } from '../components/Icons';
import {
  appointmentsOn,
  railFor,
  tasksOn,
  feedFilters,
  feed,
  filterFeed,
  itemsDueToday,
  nextClass,
  punchline,
  upcomingItems,
  type FeedFilter,
} from '../lib/select';
import { minutesNow } from '../lib/date';
import { datedEvents, datedItems } from '../lib/select';
import { tally } from '../lib/review';

/** The next-class card, shared by both nav modes. */
function NextClassCard() {
  const { now, catalog } = useStore();
  const next = nextClass(catalog, now);
  if (!next) return null;

  return (
    <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="kicker">Next class</div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--app-accent-deep)',
          }}
        >
          {next.untilLabel}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
        <div className="chrome-text" style={{ fontSize: 34, lineHeight: 1 }}>
          {next.block.time}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 21, lineHeight: 1.1 }}>
            {next.block.title}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {next.block.c ? catalog.byId[next.block.c].room : next.block.meta}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          paddingTop: 11,
          borderTop: '1px solid var(--app-line)',
          fontSize: 13,
          opacity: 0.85,
          textWrap: 'pretty',
        }}
      >
        {next.note}
      </div>
    </Blueprint>
  );
}

/**
 * Your own tasks for today, below the coursework and clearly labelled as yours.
 * The app's premise is that syllabus content is trustworthy because it has a
 * citation attached; this does not, and says so.
 */
function YourTasks() {
  const { state, dispatch, now, catalog } = useStore();
  const mine = tasksOn(state.tasks, now);
  const appts = appointmentsOn(state.appointments, now);
  if (mine.length === 0 && appts.length === 0) return null;

  const left = mine.filter((t) => !t.done).length;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '26px 0 12px',
        }}
      >
        <div className="section-label">Yours today</div>
        <button
          type="button"
          className="bare"
          onClick={() => dispatch({ type: 'go', screen: 'mine' })}
          style={{
            width: 'auto',
            fontFamily: 'var(--font-heading)',
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--app-accent)',
          }}
        >
          {left > 0 ? `${left} left` : 'All done'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mine.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '10px 0',
              borderBottom: '1px solid var(--app-line)',
            }}
          >
            <button
              type="button"
              className="bare"
              onClick={() => dispatch({ type: 'toggleTask', id: t.id })}
              aria-label={t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
              style={{ width: 20, flex: 'none', marginTop: 2 }}
            >
              <TickBox on={t.done} />
            </button>
            <div style={{ flex: 1, minWidth: 0, opacity: t.done ? 0.42 : 1 }}>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.3,
                  textDecoration: t.done ? 'line-through' : 'none',
                }}
              >
                {t.title}
              </div>
              {(t.time || t.courseId) && (
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                  {t.courseId ? `${catalog.byId[t.courseId]?.code} · ` : ''}
                  {t.time}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Nav mode 1A — a fixed sequence: next class, checklist, rail, campus, week. */
function TabHome() {
  const { state, dispatch, now, catalog } = useStore();
  const today = itemsDueToday(catalog, now);
  const doneCount = today.filter((i) => state.done[i.id]).length;
  const left = today.length - doneCount;
  const rail = railFor(catalog, now, state.appointments);
  const minutes = minutesNow(now);
  const ahead = upcomingItems(catalog, now).filter((i) => !i.isToday);
  const nextEvent = datedEvents(now, state.sample).find((e) => !e.isPast);
  const tab = state.homeTab;

  return (
    <div style={{ padding: 18 }}>
      <Segmented
        options={[
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'This week' },
          { id: 'done', label: 'Done' },
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setHomeTab', tab: next })}
        style={{ margin: '0 0 16px' }}
      />

      {tab === 'today' && (
        <>
      <NextClassCard />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '26px 0 4px',
        }}
      >
        <div className="section-label">Due today</div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 12,
            letterSpacing: '0.12em',
            opacity: 0.5,
          }}
        >
          {doneCount} of {today.length} done
        </div>
      </div>
      <div
        className="chrome-text"
        style={{
          fontSize: 27,
          lineHeight: 1.08,
          marginBottom: 14,
          textWrap: 'pretty',
        }}
      >
        {punchline(left, today.length)}
      </div>

      {left === 0 && (
        <Blueprint style={{ padding: '26px 18px', textAlign: 'center' }}>
          <div
            style={{
              width: 34,
              height: 34,
              margin: '0 auto 12px',
              border: '1.5px solid var(--app-accent)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--app-accent)',
            }}
          >
            <Check size={18} />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 21 }}>
            {today.length === 0 ? 'Nothing due today.' : 'Nothing left today.'}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
            {ahead[0]
              ? `Next up is ${ahead[0].title}, ${ahead[0].dueShort.toLowerCase()}.`
              : 'The semester is clear.'}
          </div>
        </Blueprint>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {today.map((it) => {
          const done = !!state.done[it.id];
          return (
            <Blueprint
              key={it.id}
              plain
              style={{
                display: 'flex',
                gap: 12,
                padding: '13px 14px',
                alignItems: 'flex-start',
                background: done ? 'transparent' : 'var(--app-panel)',
              }}
            >
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'toggleDone', id: it.id })}
                aria-label={done ? `Mark ${it.title} not done` : `Mark ${it.title} done`}
                style={{ width: 20, flex: 'none', marginTop: 2 }}
              >
                <TickBox on={done} />
              </button>
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'openItem', id: it.id })}
                style={{ flex: 1, minWidth: 0, opacity: done ? 0.4 : 1 }}
              >
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
                  <span className="tag tag-accent">{catalog.byId[it.c].code}</span>
                  <span
                    style={{
                      fontSize: 11,
                      opacity: 0.55,
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {it.kind}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    lineHeight: 1.3,
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {it.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3 }}>
                  {it.dueTime} · {it.where}
                </div>
              </button>
            </Blueprint>
          );
        })}
      </div>

      <YourTasks />

      <SectionLabel>Today’s rail</SectionLabel>
      {rail.length === 0 ? (
        <div style={{ fontSize: 14, opacity: 0.5, paddingBottom: 8 }}>
          No classes today. The rail picks up again on your next teaching day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rail.map((b, i) => {
            const past = b.at < minutes;
            return (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <div
                  style={{
                    width: 56,
                    flex: 'none',
                    textAlign: 'right',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 14,
                    paddingTop: 12,
                    opacity: 0.6,
                  }}
                >
                  {b.time}
                </div>
                <div style={{ width: 1, background: 'var(--app-line)', position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      left: -3,
                      width: 7,
                      height: 7,
                      background: b.canceled
                        ? 'var(--app-track)'
                        : b.mine
                          ? 'transparent'
                          : b.optional
                            ? 'var(--app-accent-deep)'
                            : 'var(--app-accent)',
                      border: b.mine ? '1px solid var(--app-accent)' : 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1, padding: '11px 0 15px', minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 19,
                      lineHeight: 1.15,
                      opacity: b.canceled ? 0.45 : past ? 0.6 : 1,
                      textDecoration: b.canceled ? 'line-through' : 'none',
                    }}
                  >
                    {b.title}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {b.mine && (
                      <span className="tag tag-neutral" style={{ marginRight: 6 }}>
                        Yours
                      </span>
                    )}
                    {b.meta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {tab === 'week' && (
        <>
      {nextEvent && (
        <>
          <SectionLabel style={{ margin: '14px 0 12px' }}>On campus</SectionLabel>
          <Blueprint
            onClick={() => dispatch({ type: 'openEvent', id: nextEvent.id })}
            style={{ padding: '13px 14px', display: 'flex', gap: 13, alignItems: 'center' }}
          >
            <div
              style={{ width: 44, flex: 'none', fontFamily: 'var(--font-heading)', lineHeight: 1 }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  opacity: 0.5,
                }}
              >
                {nextEvent.mon}
              </div>
              <div style={{ fontSize: 26 }}>{nextEvent.day}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, lineHeight: 1.25 }}>{nextEvent.title}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {nextEvent.time} · {nextEvent.where}
              </div>
            </div>
            <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
          </Blueprint>
        </>
      )}

      <SectionLabel>What’s coming</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ahead.slice(0, 5).map((u) => (
          <DateRow
            key={u.id}
            top={u.dow}
            bottom={String(u.day)}
            title={u.title}
            meta={`${catalog.byId[u.c].code} · ${u.weight}`}
            onClick={() => dispatch({ type: 'openItem', id: u.id })}
          />
        ))}
      </div>
        </>
      )}

      {tab === 'done' && <DoneToday />}

      <div style={{ height: 26 }} />
    </div>
  );
}

/**
 * What you have finished, which nothing in the app showed.
 *
 * The checklist hides an item the moment it is ticked, which is right for
 * getting through a day and wrong at the end of one — the evidence that you did
 * the work disappears exactly when it would be worth seeing.
 */
function DoneToday() {
  const { state, dispatch, now, catalog } = useStore();
  const done = datedItems(catalog, now).filter((i) => state.done[i.id]);
  const cards = tally(state.reviews);

  return (
    <>
      <Blueprint style={{ padding: 15, background: 'var(--app-hero)' }}>
        <div className="kicker">Finished</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <div className="chrome-text" style={{ fontSize: 34, lineHeight: 1 }}>
            {done.length}
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {done.length === 1 ? 'thing ticked off' : 'things ticked off'}
          </div>
        </div>
        {cards.cards > 0 && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 11,
              borderTop: '1px solid var(--app-line)',
              fontSize: 13,
              opacity: 0.8,
              lineHeight: 1.5,
            }}
          >
            {cards.cards} cards answered, {cards.pct}% right — every one of those moved a unit's
            mastery.
          </div>
        )}
      </Blueprint>

      {done.length === 0 ? (
        <div style={{ padding: '22px 0', fontSize: 14, opacity: 0.55, lineHeight: 1.5 }}>
          Nothing ticked off yet. Anything you finish shows up here, so a day leaves a trace rather
          than just emptying out.
        </div>
      ) : (
        <>
          <SectionLabel>What you did</SectionLabel>
          {done.map((i) => (
            <button
              key={i.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: i.id })}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--app-line)',
                textAlign: 'left',
              }}
            >
              <span className="tag tag-accent" style={{ flex: 'none' }}>
                {catalog.byId[i.c]?.code}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    lineHeight: 1.3,
                    textDecoration: 'line-through',
                    opacity: 0.7,
                  }}
                >
                  {i.title}
                </span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.5, marginTop: 2 }}>
                  {i.dueShort} · {i.kind}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
      <div style={{ height: 22 }} />
    </>
  );
}

/** Nav mode 1B — one chronological scroll, sliced by the chip row. */
function FeedHome() {
  const { state, dispatch, now, catalog } = useStore();
  const entries = filterFeed(catalog, feed(catalog, now, state.done), state.filter as FeedFilter);

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--app-bg)',
          borderBottom: '1px solid var(--app-line)',
          padding: '10px 0 10px 18px',
        }}
      >
        <ChipRow
          options={feedFilters(catalog)}
          value={state.filter as FeedFilter}
          onChange={(f) => dispatch({ type: 'setFilter', filter: f })}
        />
      </div>

      <div style={{ padding: 18 }}>
        <NextClassCard />

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column' }}>
          {entries.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`bare${f.itemId ? ' tappable' : ''}`}
              onClick={f.itemId ? () => dispatch({ type: 'openItem', id: f.itemId! }) : undefined}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '13px 0',
                borderBottom: '1px solid var(--app-line)',
                cursor: f.itemId ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  width: 54,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1.05,
                  paddingTop: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    opacity: 0.5,
                  }}
                >
                  {f.top}
                </div>
                <div style={{ fontSize: 17, opacity: 0.85 }}>{f.bottom}</div>
              </div>
              <div
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  background: f.isClass ? 'var(--app-line)' : 'var(--app-accent)',
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  opacity: f.done || f.canceled ? 0.42 : 1,
                }}
              >
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
                  <span className={`tag ${f.isClass ? 'tag-neutral' : 'tag-accent'}`}>{f.code}</span>
                  <span
                    style={{
                      fontSize: 11,
                      opacity: 0.55,
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {f.kind}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    lineHeight: 1.3,
                    textDecoration: f.done || f.canceled ? 'line-through' : 'none',
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{f.meta}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ height: 70 }} />
      </div>
    </>
  );
}

export function Today() {
  const { state, catalog } = useStore();
  if (catalog.empty) return <FirstRun where="on today" />;
  return state.nav === 'feed' ? <FeedHome /> : <TabHome />;
}

/** Re-exported for the Me screen's load bars. */
export { Meter };
