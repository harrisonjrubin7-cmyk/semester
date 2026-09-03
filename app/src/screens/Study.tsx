import { allCards } from '../data/catalog';
import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { extraFigures, forCourse, liveGuide, mergeFigures } from '../lib/live';
import { modesFor } from '../lib/modes';
import { Blueprint } from '../components/Blueprint';
import { Meter, SectionLabel } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { nextExam, tonightPlan } from '../lib/select';

export function Study() {
  const { state, dispatch, now, catalog } = useStore();
  const exam = nextExam(catalog, now);
  const plan = tonightPlan(catalog, state.updates);
  if (catalog.empty) return <FirstRun where="to study" />;

  return (
    <div style={{ padding: 18 }}>
      {exam && (
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Exam radar</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            <div className="chrome-text" style={{ fontSize: 38, lineHeight: 1 }}>
              {exam.days}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, lineHeight: 1.1 }}>
                {exam.days === 1 ? 'day' : 'days'} to {exam.code} {exam.item.title}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {exam.item.mon} {exam.item.day} · {exam.item.dueTime} · {exam.item.weight}
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
            {(() => {
              const guide = liveGuide(catalog, exam.item.c, state.updates);
              const coldUnits = guide.units.filter((u) => u.mastery < 40);
              if (coldUnits.length === 0) {
                return `All ${guide.units.length} units in ${guide.code} are above 40%. Keep them warm.`;
              }
              const coldCards = coldUnits.reduce((n, u) => n + u.cards.length, 0);
              return `${guide.units.length} units on it, and ${coldUnits.length} ${
                coldUnits.length === 1 ? 'is' : 'are'
              } cold — ${coldCards} cards. Drill those first.`;
            })()}
          </div>
        </Blueprint>
      )}

      <Blueprint
        onClick={() => dispatch({ type: 'go', screen: 'ask' })}
        style={{ padding: '13px 15px', marginTop: 14, display: 'flex', gap: 12, alignItems: 'center' }}
      >
        <span style={{ width: 8, height: 34, background: 'var(--chrome)', flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="kicker" style={{ display: 'block' }}>
            Ask Claude
          </span>
          <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3, marginTop: 2 }}>
            A question about a course, answered against that course’s guide
          </span>
        </span>
        <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
      </Blueprint>

      <Blueprint
        onClick={() => dispatch({ type: 'go', screen: 'work' })}
        style={{ padding: '13px 15px', marginTop: 10, display: 'flex', gap: 12, alignItems: 'center' }}
      >
        <span style={{ width: 8, height: 34, background: 'var(--chrome)', flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="kicker" style={{ display: 'block' }}>
            Work on it
          </span>
          <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3, marginTop: 2 }}>
            An assignment broken down — rubric, plan, dates, what to ask about
          </span>
        </span>
        <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
      </Blueprint>

      <SectionLabel>Study guides</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {catalog.courses.map((c) => {
          const g = liveGuide(catalog, c.id, state.updates);
          const cards = allCards(g).length;
          const mine = forCourse(state.updates, c.id);
          // Every way into this course that actually has something in it. They
          // used to be reachable only by opening the guide and then finding a
          // chip row that scrolled sideways, so most of them went unused.
          const ways = modesFor(catalog, c.id, {
            guide: g,
            lessons: catalog.lessons[c.id] ?? {},
            figures: mergeFigures(catalog.figures[c.id] ?? {}, mine),
            extras: extraFigures(catalog.extraFigures[c.id] ?? [], mine),
          }).filter((m) => m.ready);
          return (
            <Blueprint key={c.id} style={{ padding: '14px 15px', display: 'block' }}>
              <button
                type="button"
                className="bare tappable"
                onClick={() => dispatch({ type: 'openGuide', id: c.id })}
                style={{ display: 'block', width: '100%', textAlign: 'left' }}
              >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                {/* The code is the name of the thing and never wraps; the
                    counts give way to it. */}
                <div
                  className="chrome-text"
                  style={{ fontSize: 20, flex: 'none', whiteSpace: 'nowrap' }}
                >
                  {g.code}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    opacity: 0.55,
                    textAlign: 'right',
                    minWidth: 0,
                  }}
                >
                  {g.units.length} units · {cards} cards
                </div>
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{g.blurb}</div>
              <div style={{ marginTop: 11 }}>
                <Meter pct={g.mastery} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.5,
                  marginTop: 5,
                  fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {g.mastery}% mastered
              </div>
              </button>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 12,
                  paddingTop: 11,
                  borderTop: '1px solid var(--app-line)',
                }}
              >
                {ways.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn"
                    title={m.blurb}
                    onClick={() => dispatch({ type: 'openGuide', id: c.id, mode: m.id })}
                    style={{
                      flex: 'none',
                      padding: '5px 10px',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      background: 'transparent',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Blueprint>
          );
        })}
      </div>

      <SectionLabel style={{ margin: '26px 0 4px' }}>Tonight’s 25 minutes</SectionLabel>
      <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 12, textWrap: 'pretty' }}>
        Your weakest unit in each course, and what’s on the next quiz — one short sitting rather
        than a plan you will not keep.
      </div>
      {plan.map((p) => (
        <button
          key={p.courseId}
          type="button"
          className="bare tappable"
          onClick={() => dispatch({ type: 'openGuide', id: p.courseId, mode: 'cards' })}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <span
            style={{
              width: 44,
              flex: 'none',
              fontFamily: 'var(--font-heading)',
              fontSize: 15,
              opacity: 0.5,
            }}
          >
            {catalog.planMinutes[p.courseId]}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{p.unit.name}</span>
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
              {p.code} · {p.unit.mastery}% mastered
            </span>
          </span>
          <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
        </button>
      ))}
      <div style={{ height: 22 }} />
    </div>
  );
}
