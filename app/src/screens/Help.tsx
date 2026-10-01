import { useMemo, useState } from 'react';
import { secondLine } from '../lib/dim';
import { Page } from '../components/Page';
import { build, toMarkdown, type Section } from '../lib/guidebook';
import { download } from '../lib/deliver';
import { useNow, useStore } from '../state/store';
import { BetaPanel } from '../components/BetaPanel';
import { KnownLimitations } from '../components/KnownLimitations';
import { NoWrongDoor } from '../components/NoWrongDoor';
import { AskAHuman } from '../components/AskAHuman';
import { SupportTicketsPanel } from '../components/SupportTicketsPanel';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import { availableContext } from '../lib/supporttickets';
import { LOG_KEY, read as readLog } from '../lib/diagnose';
import { asOf } from '../lib/offline-mode';
import { SYNC_WORDS } from '../lib/syncstatus';
import { handoff, takeOrigin } from '../lib/tickethandoff';

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
  const { dispatch, account, sync, state } = useStore();
  const now = useNow();
  // Noted by whichever screen sent the student here (`noteOrigin`), read
  // once; without it the handoff would say they were on Help.
  const [origin] = useState(() => takeOrigin());
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
          <BetaPanel account={account} />
          <NoWrongDoor />
          <AskAHuman />
          <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: '0 0 var(--sp-6)', lineHeight: 'var(--leading-relaxed)' }}>
            Is it just you? The <a href={`${import.meta.env.BASE_URL}status.html`}>status page</a> checks the service from your own browser and lists incidents and planned maintenance.
          </p>
          <KnownLimitations />
          {EXPERIENCE_FLAGS.supportTickets !== 'off' && (
            <SupportTicketsPanel
              account={account}
              handoff={handoff({
                hash: origin?.hash ?? window.location.hash,
                action: origin?.action ?? '',
                lastError: lastLogged(),
                reference: origin?.reference ?? null,
                userAgent: navigator.userAgent,
                width: window.innerWidth,
                saved: SYNC_WORDS[sync.status].standing,
                sources: state.feeds.map((f) => ({ name: f.name, state: f.synced > 0 ? asOf(f.synced, now.getTime()) : 'never synced' })),
                now: now.getTime(),
              })}
              context={availableContext({
                build: (import.meta.env.VITE_BUILD_ID as string | undefined) ?? '',
                width: window.innerWidth,
                hash: window.location.hash,
                signedIn: account !== null,
                sync: sync.status,
                online: navigator.onLine,
              })}
            />
          )}
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
          paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: '0',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)' }}>
          {section.title}
        </span>
        {/* The one glyph that says the section opens, so it is dimmed with
            the token rather than to 3.4:1 — the affordance should not be the
            faintest mark on its own control. */}
        <span style={{ flex: 'none', ...secondLine(), fontSize: 'var(--type-sm)' }}>
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
            paddingBlock: 'calc(2px * var(--density, 1))', paddingInline: '0',
          }}
        >
          <span style={{ ...secondLine(), flex: 'none' }}>·</span>
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
            paddingBlock: 'calc(1px * var(--density, 1))', paddingInline: 'calc(5px * var(--density, 1))',
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

/** The most recent failure this device logged (`lib/diagnose.ts`), or null; storage that refuses is null too. */
function lastLogged() {
  try {
    return readLog(localStorage.getItem(LOG_KEY)).filter((e) => e.kind === 'error').sort((a, b) => b.at - a.at)[0] ?? null;
  } catch {
    return null;
  }
}
