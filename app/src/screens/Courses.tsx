import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { DateRow, SectionLabel } from '../components/ui';
import { upcomingItems, datedItems } from '../lib/select';

export function Courses() {
  const { dispatch, now, catalog } = useStore();
  const ahead = upcomingItems(catalog, now);
  if (catalog.empty) return <FirstRun where="in your courses" />;

  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {catalog.courses.map((c) => {
        const next = ahead.find((i) => i.c === c.id);
        return (
          <Blueprint
            key={c.id}
            onClick={() => dispatch({ type: 'openCourse', id: c.id })}
            style={{ padding: '15px 16px', display: 'block' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div className="chrome-text" style={{ fontSize: 22 }}>
                {c.code}
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
                {c.meets}
              </div>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>{c.name}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{c.prof}</div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                marginTop: 12,
                paddingTop: 11,
                borderTop: '1px solid var(--app-line)',
              }}
            >
              <span className="tag tag-accent">{next ? next.dueShort : 'Clear'}</span>
              <span
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {next ? next.title : 'Nothing scheduled'}
              </span>
            </div>
          </Blueprint>
        );
      })}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'import' })}
        style={{
          height: 46,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 6,
        }}
      >
        + Add a course from a syllabus
      </button>
      <div style={{ height: 12 }} />
    </div>
  );
}

export function CourseDetail() {
  const { state, dispatch, now, catalog } = useStore();
  const course = catalog.byId[state.courseId];
  const items = datedItems(catalog, now).filter((i) => i.c === course.id);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 15, lineHeight: 1.3 }}>{course.name}</div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 3 }}>
        {course.prof} · {course.email}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
        <span className="tag tag-outline">{course.meets}</span>
        <span className="tag tag-neutral">{course.room}</span>
        <span className="tag tag-neutral">{course.credits}</span>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => dispatch({ type: 'openGuide', id: course.id })}
        style={{
          height: 46,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 16,
        }}
      >
        Study this course
      </button>

      <SectionLabel style={{ margin: '24px 0 6px' }}>How the grade is built</SectionLabel>
      <table className="table">
        <tbody>
          {course.grading.map((g) => (
            <tr key={g.what}>
              <td style={{ fontSize: 13 }}>{g.what}</td>
              <td
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 15,
                  width: 74,
                }}
              >
                {g.pct}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionLabel style={{ margin: '24px 0 6px' }}>Everything ahead</SectionLabel>
      {items.map((i) => (
        <DateRow
          key={i.id}
          top={i.mon}
          bottom={String(i.day)}
          title={i.title}
          meta={`${i.kind} · ${i.weight}`}
          onClick={() => dispatch({ type: 'openItem', id: i.id })}
        />
      ))}

      <div
        style={{
          fontSize: 11,
          opacity: 0.45,
          marginTop: 14,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
        }}
      >
        Imported from {course.source}
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

export function ItemDetail() {
  const { state, dispatch, now, catalog } = useStore();
  const all = datedItems(catalog, now);
  const item = all.find((i) => i.id === state.itemId) ?? all[0];
  if (!item) return null;
  const done = !!state.done[item.id];

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span className="tag tag-accent">{catalog.byId[item.c].code}</span>
          <span
            style={{
              fontSize: 11,
              opacity: 0.55,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {item.kind}
          </span>
        </div>
        <div
          className="chrome-text"
          style={{
            fontSize: 27,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            margin: '10px 0 12px',
            textWrap: 'pretty',
          }}
        >
          {item.title}
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid var(--app-line)' }}>
          <div style={{ flex: 1, padding: '11px 0' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              Due
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{item.dueShort}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{item.dueTime}</div>
          </div>
          <div style={{ width: 1, background: 'var(--app-line)' }} />
          <div style={{ flex: 1, padding: '11px 0 11px 14px' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              Weight
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{item.weight}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{item.where}</div>
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
        {item.detail}
      </div>

      <SectionLabel style={{ margin: '22px 0 8px' }}>Straight from the syllabus</SectionLabel>
      <div
        style={{
          borderLeft: '2px solid var(--app-accent)',
          padding: '2px 0 2px 14px',
          fontSize: 13,
          lineHeight: 1.5,
          opacity: 0.75,
          fontStyle: 'italic',
        }}
      >
        {item.quote}
      </div>
      <div
        style={{
          fontSize: 11,
          opacity: 0.45,
          marginTop: 8,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
        }}
      >
        {item.source}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'toggleDone', id: item.id })}
          style={{ flex: 1, height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {done ? 'Mark not done' : 'Mark done'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => dispatch({ type: 'openGuide', id: item.c })}
          style={{ height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Study
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}
