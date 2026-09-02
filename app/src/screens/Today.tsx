import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, DateRow, Meter, SectionLabel, TickBox } from '../components/ui';
import { Check, ChevronRight } from '../components/Icons';
import { COURSE_BY_ID } from '../data/courses';
import { blocksFor } from '../data/schedule';
import {
  FEED_FILTERS,
  feed,
  filterFeed,
  itemsDueToday,
  nextClass,
  punchline,
  upcomingItems,
  type FeedFilter,
} from '../lib/select';
import { minutesNow } from '../lib/date';
import { datedEvents } from '../lib/select';

/** The next-class card, shared by both nav modes. */
function NextClassCard() {
  const { now } = useStore();
  const next = nextClass(now);
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
            {next.block.c ? COURSE_BY_ID[next.block.c].room : next.block.meta}
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

/** Nav mode 1A — a fixed sequence: next class, checklist, rail, campus, week. */
function TabHome() {
  const { state, dispatch, now } = useStore();
  const today = itemsDueToday(now);
  const doneCount = today.filter((i) => state.done[i.id]).length;
  const left = today.length - doneCount;
  const blocks = blocksFor(now);
  const minutes = minutesNow(now);
  const ahead = upcomingItems(now).filter((i) => !i.isToday);
  const nextEvent = datedEvents(now).find((e) => !e.isPast);

  return (
    <div style={{ padding: 18 }}>
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
                  <span className="tag tag-accent">{COURSE_BY_ID[it.c].code}</span>
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

      <SectionLabel>Today’s rail</SectionLabel>
      {blocks.length === 0 ? (
        <div style={{ fontSize: 14, opacity: 0.5, paddingBottom: 8 }}>
          No classes today. The rail picks up again on your next teaching day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {blocks.map((b, i) => {
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
                        : b.optional
                          ? 'var(--app-accent-deep)'
                          : 'var(--app-accent)',
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
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{b.meta}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
            meta={`${COURSE_BY_ID[u.c].code} · ${u.weight}`}
            onClick={() => dispatch({ type: 'openItem', id: u.id })}
          />
        ))}
      </div>
      <div style={{ height: 26 }} />
    </div>
  );
}

/** Nav mode 1B — one chronological scroll, sliced by the chip row. */
function FeedHome() {
  const { state, dispatch, now } = useStore();
  const entries = filterFeed(feed(now, state.done), state.filter as FeedFilter);

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
          options={FEED_FILTERS}
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
  const { state } = useStore();
  return state.nav === 'feed' ? <FeedHome /> : <TabHome />;
}

/** Re-exported for the Me screen's load bars. */
export { Meter };
