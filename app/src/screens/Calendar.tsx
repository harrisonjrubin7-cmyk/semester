import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, EmptyState, SectionLabel, Segmented } from '../components/ui';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { COURSE_BY_ID } from '../data/courses';
import { DOW_INITIALS, MONTHS, monthGrid, sameDay } from '../lib/date';
import { datedEvents, dotsForMonth, itemsOn } from '../lib/select';
import type { EventKind } from '../lib/types';

const EV_FILTERS = ['All', 'Athletics', 'Clubs', 'University', 'Saved'] as const;

function Deadlines() {
  const { state, dispatch, now } = useStore();
  const { calYear, calMonth } = state;
  const cells = monthGrid(calYear, calMonth);
  const dots = dotsForMonth(now, calYear, calMonth);

  const selectedDay = state.selDate
    ? Number(state.selDate.split('-')[2])
    : sameDay(now, new Date(calYear, calMonth, now.getDate()))
      ? now.getDate()
      : null;

  const selItems = selectedDay ? itemsOn(now, calYear, calMonth, selectedDay) : [];

  return (
    <div style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => dispatch({ type: 'stepMonth', delta: -1 })}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div
          className="chrome-text"
          style={{ fontSize: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {MONTHS[calMonth]} {calYear}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => dispatch({ type: 'stepMonth', delta: 1 })}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7,1fr)',
          gap: 1,
          marginBottom: 6,
        }}
      >
        {DOW_INITIALS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-heading)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.45,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <Blueprint
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7,1fr)',
          gap: 1,
          background: 'var(--app-line)',
          padding: 1,
        }}
      >
        {cells.map((d, i) => {
          if (d === null) {
            return <div key={i} style={{ aspectRatio: '1', background: 'var(--app-bg)' }} />;
          }
          const isToday = sameDay(now, new Date(calYear, calMonth, d));
          const isSelected = selectedDay === d;
          const count = Math.min(dots[d] ?? 0, 3);
          return (
            <button
              key={i}
              type="button"
              className="bare"
              onClick={() =>
                dispatch({
                  type: 'selectDate',
                  date: `${calYear}-${calMonth}-${d}`,
                })
              }
              style={{
                aspectRatio: '1',
                background: isSelected ? 'var(--app-hero)' : 'var(--app-bg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                border: isToday ? '1px solid var(--app-accent)' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 15,
                  opacity: isToday || isSelected ? 1 : 0.8,
                  color: isToday ? 'var(--app-accent)' : 'var(--app-fg)',
                }}
              >
                {d}
              </span>
              <span style={{ display: 'flex', gap: 2, height: 4 }}>
                {Array.from({ length: count }).map((_, k) => (
                  <span
                    key={k}
                    style={{ width: 4, height: 4, background: 'var(--app-accent)' }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </Blueprint>

      <SectionLabel style={{ margin: '22px 0 6px' }}>
        {selectedDay ? `${MONTHS[calMonth]} ${selectedDay}` : 'Pick a day'}
      </SectionLabel>

      {selItems.map((i) => (
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
          }}
        >
          <span className="tag tag-accent">{COURSE_BY_ID[i.c].code}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{i.title}</span>
            <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>{i.dueTime}</span>
          </span>
        </button>
      ))}

      {selectedDay && selItems.length === 0 && (
        <div style={{ padding: '22px 0', fontSize: 14, opacity: 0.5 }}>
          Nothing due. Rare. Enjoy it.
        </div>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

function Campus() {
  const { state, dispatch, now } = useStore();
  const all = datedEvents(now);
  const events = all.filter((e) => {
    if (state.evFilter === 'All') return !e.isPast;
    if (state.evFilter === 'Saved') return !!state.saved[e.id];
    return e.kind === (state.evFilter as EventKind) && !e.isPast;
  });

  return (
    <>
      <div
        style={{
          padding: '14px 0 10px 18px',
          borderBottom: '1px solid var(--app-line)',
        }}
      >
        <ChipRow
          options={EV_FILTERS}
          value={state.evFilter as (typeof EV_FILTERS)[number]}
          onChange={(f) => dispatch({ type: 'setEvFilter', filter: f })}
        />
      </div>

      <div style={{ padding: '14px 18px' }}>
        <div className="section-label" style={{ marginBottom: 12 }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map((e) => {
            const saved = !!state.saved[e.id];
            return (
              <Blueprint
                key={e.id}
                style={{
                  display: 'flex',
                  gap: 13,
                  padding: '13px 14px',
                  alignItems: 'flex-start',
                }}
              >
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'openEvent', id: e.id })}
                  style={{
                    width: 44,
                    flex: 'none',
                    fontFamily: 'var(--font-heading)',
                    lineHeight: 1,
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
                    {e.mon}
                  </div>
                  <div style={{ fontSize: 26 }}>{e.day}</div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      opacity: 0.5,
                    }}
                  >
                    {e.dow}
                  </div>
                </button>
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'openEvent', id: e.id })}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      className={`tag ${e.kind === 'Athletics' ? 'tag-accent' : e.kind === 'University' ? 'tag-outline' : 'tag-neutral'}`}
                    >
                      {e.kind}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.55,
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {e.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.25 }}>{e.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                    {e.time} · {e.where}
                  </div>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => dispatch({ type: 'toggleSaved', id: e.id })}
                  style={{
                    flex: 'none',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '4px 6px',
                  }}
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </Blueprint>
            );
          })}
        </div>

        {events.length === 0 && (
          <EmptyState
            title={state.evFilter === 'Saved' ? 'Nothing saved yet.' : 'Nothing coming up.'}
            body={
              state.evFilter === 'Saved'
                ? 'Hit save on a game and it lands on your Today rail.'
                : 'Try another filter — the season may have moved on.'
            }
          />
        )}
        <div style={{ height: 22 }} />
      </div>
    </>
  );
}

export function Calendar() {
  const { state, dispatch } = useStore();
  return (
    <>
      <div style={{ padding: '14px 18px 0' }}>
        <Segmented
          options={[
            { id: 'deadlines', label: 'Deadlines' },
            { id: 'campus', label: 'Campus' },
          ]}
          value={state.calTab}
          onChange={(tab) => dispatch({ type: 'setCalTab', tab })}
        />
      </div>
      {state.calTab === 'campus' ? <Campus /> : <Deadlines />}
    </>
  );
}

export function EventDetail() {
  const { state, dispatch, now } = useStore();
  const all = datedEvents(now);
  const event = all.find((e) => e.id === state.eventId) ?? all[0];
  if (!event) return null;
  const saved = !!state.saved[event.id];

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
        <div className="kicker">
          {event.kind} · {event.tag}
        </div>
        <div
          className="chrome-text"
          style={{
            fontSize: 28,
            lineHeight: 1.08,
            letterSpacing: '-0.01em',
            marginTop: 8,
            textWrap: 'pretty',
          }}
        >
          {event.title}
        </div>
        <div style={{ display: 'flex', marginTop: 14, borderTop: '1px solid var(--app-line)' }}>
          <div style={{ flex: 1, padding: '11px 0' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              When
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>
              {event.dow} {event.mon} {event.day}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{event.time}</div>
          </div>
          <div style={{ width: 1, background: 'var(--app-line)' }} />
          <div style={{ flex: 1, padding: '11px 0 11px 14px' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              Where
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, lineHeight: 1.15 }}>
              {event.where}
            </div>
          </div>
        </div>
      </Blueprint>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          marginTop: 18,
          opacity: 0.85,
          textWrap: 'pretty',
        }}
      >
        {event.detail}
      </div>

      <SectionLabel style={{ margin: '22px 0 6px' }}>Getting in</SectionLabel>
      <div style={{ fontSize: 14, opacity: 0.8 }}>{event.ticket}</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'toggleSaved', id: event.id })}
          style={{ flex: 1, height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
