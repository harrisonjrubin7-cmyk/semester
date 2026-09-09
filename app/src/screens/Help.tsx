import { useMemo, useState } from 'react';
import { Page } from '../components/Page';
import { build, toMarkdown, type Section } from '../lib/guidebook';
import { download } from '../lib/deliver';
import { useStore } from '../state/store';

/**
 * The guide, in the app.
 *
 * Nothing on this screen is written here. It renders what `lib/guidebook.ts`
 * assembles from the registry, the shortcut array and the look settings, so a
 * screen added to the app appears here without anybody remembering to add it —
 * and a screen named here that stops existing fails the test suite.
 *
 * ## Rendered rather than parsed
 *
 * The guidebook produces markdown, and this draws it with about twenty lines
 * of rules rather than a markdown library. The guide uses four constructs —
 * a heading, a bullet, bold, and a code span — because those are what the
 * generator emits, and a parser for a language with four constructs is
 * smaller than the dependency that would parse all of it.
 */
export function Help() {
  const { dispatch } = useStore();
  const book = useMemo(() => build(), []);
  const [open, setOpen] = useState<string | null>('what');

  return (
    <Page
      blurb="Every screen in the app, what it is for, and what it will not do. Generated from the app itself, so it cannot describe something that is not there."
      actions={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              download({
                name: 'Semester — the guide.md',
                body: toMarkdown(book),
                mime: 'text/markdown',
              })
            }
            style={{ flex: 1, height: 40, fontSize: 'var(--type-sm)' }}
          >
            Download it
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'restartOnboarding' })}
            style={{ flex: 1, height: 40, fontSize: 'var(--type-sm)' }}
          >
            Show me around again
          </button>
        </>
      }
    >
        <>
          {book.sections.map((s) => (
            <Chapter
              key={s.id}
              section={s}
              open={open === s.id}
              onToggle={() => setOpen(open === s.id ? null : s.id)}
            />
          ))}
        </>
    </Page>
  );
}

function Chapter({
  section,
  open,
  onToggle,
}: {
  section: Section;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--app-line)' }}>
      <button
        type="button"
        className="bare tappable"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          display: 'flex',
          width: '100%',
          gap: 'var(--sp-5)',
          alignItems: 'baseline',
          padding: '12px 0',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)' }}>
          {section.title}
        </span>
        <span style={{ flex: 'none', opacity: 0.4, fontSize: 'var(--type-sm)' }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div style={{ paddingBottom: 'var(--sp-7)' }}>{render(section.body)}</div>}
    </div>
  );
}

/**
 * The four constructs the generator emits, and no more.
 *
 * `### heading`, `- bullet`, `**bold**` and `` `code` ``. Anything else is a
 * paragraph. A markdown library would handle the rest of the language, and
 * the rest of the language never arrives here.
 */
function render(body: string) {
  const blocks = body.split('\n');
  return blocks.map((line, i) => {
    const key = `${i}-${line.slice(0, 24)}`;
    if (!line.trim()) return <div key={key} style={{ height: 'var(--sp-4)' }} />;

    if (line.startsWith('### ')) {
      return (
        <div
          key={key}
          className="chrome-text"
          style={{
            fontSize: 'var(--type-md)',
            lineHeight: 'var(--leading-tight)',
            marginTop: 'var(--sp-6)',
            marginBottom: 'var(--sp-1)',
          }}
        >
          {line.slice(4)}
        </div>
      );
    }

    if (line.startsWith('- ')) {
      return (
        <div
          key={key}
          style={{
            display: 'flex',
            gap: 'var(--sp-4)',
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-relaxed)',
            padding: '2px 0',
          }}
        >
          <span style={{ opacity: 0.4, flex: 'none' }}>·</span>
          <span style={{ flex: 1, minWidth: 0 }}>{inline(line.slice(2))}</span>
        </div>
      );
    }

    return (
      <div
        key={key}
        style={{
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {inline(line)}
      </div>
    );
  });
}

/** Bold and code spans, which is all the generator puts inside a line. */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 16)}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} style={{ fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <span
          key={key}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-sm)',
            padding: '1px 5px',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-sm)',
          }}
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={key}>{part}</span>;
  });
}
