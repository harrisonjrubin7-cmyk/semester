import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { Meter, SectionLabel } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { COURSES } from '../data/courses';
import { GUIDES, PLAN_MIN, allCards } from '../data/guides';
import { nextExam, tonightPlan } from '../lib/select';

export function Study() {
  const { dispatch, now } = useStore();
  const exam = nextExam(now);
  const plan = tonightPlan();

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
              const guide = GUIDES[exam.item.c];
              const cold = guide.units.filter((u) => u.mastery < 40).length;
              const perDay = Math.max(1, Math.ceil(cold * 3 / Math.max(1, exam.days)));
              return cold === 0
                ? `Every unit in ${guide.code} is above 40%. Keep it warm.`
                : `${guide.units.length} units on it. ${cold} ${cold === 1 ? 'is' : 'are'} cold. About ${perDay * 5} minutes a day clears them in time.`;
            })()}
          </div>
        </Blueprint>
      )}

      <SectionLabel>Study guides</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {COURSES.map((c) => {
          const g = GUIDES[c.id];
          const cards = allCards(g).length;
          return (
            <Blueprint
              key={c.id}
              onClick={() => dispatch({ type: 'openGuide', id: c.id })}
              style={{ padding: '14px 15px', display: 'block' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div className="chrome-text" style={{ fontSize: 20 }}>
                  {g.code}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    opacity: 0.55,
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
            </Blueprint>
          );
        })}
      </div>

      <SectionLabel style={{ margin: '26px 0 4px' }}>Tonight’s 25 minutes</SectionLabel>
      <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 12, textWrap: 'pretty' }}>
        Built from your four weakest units and what’s on the next quiz. Torres Colón’s routine,
        applied across all four courses.
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
            {PLAN_MIN[p.courseId]}
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
