import { useState } from 'react';
import { useStore } from '../state/store';
import { useRowStyle } from '../components/shell/useShell';
import { Page } from '../components/Page';
import { has } from '../lib/search';
import { SectionLabel } from '../components/ui';
import { Blueprint } from '../components/Blueprint';
import { CAMPUS_LINKS } from '../data/campus';
import type { CampusLink } from '../lib/types';


/**
 * Every address the app knows, on a screen of its own.
 *
 * These lived at the bottom of Connect, under the accounts, the calendar
 * feeds and the Claude settings. That was the right place for them when they
 * were an afterthought and the wrong one once there were a dozen: a bookmark
 * you open twice a week should not be four screens of OAuth away, and
 * "Connect accounts" is not where anybody looks for the bookstore.
 *
 * Connect is now about connecting — the things you set up once. This is about
 * going somewhere, which is a different errand and a different frequency.
 *
 * The state is unchanged. `linkUrls` still holds the addresses somebody has
 * corrected and `extraLinks` the ones they added; both are read here exactly
 * as they were read there.
 */

const GROUPS = ['Campus', 'Books', 'Tickets', 'Social', 'Yours'] as const;

export function Links() {
  const { state, dispatch } = useStore();
  const rowTwelve = useRowStyle(12);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Links you add yourself land under "Yours" rather than among the defaults,
  // so which addresses the app guessed and which you chose stays obvious.
  const links: CampusLink[] = [
    ...CAMPUS_LINKS,
    ...state.extraLinks.map((l) => ({ ...l, group: 'Yours' as const })),
  ];
  const addressOf = (link: CampusLink) => state.linkUrls[link.id] ?? link.url;

  const host = (url: string) => {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const save = (id: string) => {
    // A bare "yes.vanderbilt.edu" is what people paste; make it a real address
    // rather than refusing it.
    const url = draft.trim();
    dispatch({ type: 'setLinkUrl', id, url: url && !/^https?:\/\//i.test(url) ? `https://${url}` : url });
    setEditing(null);
  };

  return (
    <Page
      search={{
        placeholder: 'Find a link',
        select: () => links,
        // The address as well as the name: people look for "brightspace"
        // and people look for "the one on vanderbilt.edu that is not YES".
        match: (l, q) => has(q, l.name, l.group, addressOf(l), host(addressOf(l))),
      }}
    >
      {(shown) => (
        <>
          {/*
            Grouped rather than one flat list. Eleven links under a single
            heading reads as a dump; Campus, Tickets and Social are three
            different errands and you are only ever on one of them.
          */}
          {GROUPS.map((group) => {
            const inGroup = shown.filter((l) => (l.group ?? 'Campus') === group);
            if (inGroup.length === 0) return null;
            return (
              <div key={group}>
                <SectionLabel>{group}</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
            {inGroup.map((link) => {
              const url = addressOf(link);
              const open = editing === link.id;
              return (
                <div
                  key={link.id}
                  style={rowTwelve}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="bare"
                        style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                      >
                        <span style={{ display: 'block', fontSize: 'calc(14.5px * var(--text-scale, 1))', lineHeight: 'var(--leading-tight)' }}>
                          {link.name}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--type-xs)',
                            opacity: 0.5,
                            fontFamily: 'var(--font-heading)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            marginTop: 2,
                          }}
                        >
                          {host(url)}
                        </span>
                      </a>
                    ) : (
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 'calc(14.5px * var(--text-scale, 1))', lineHeight: 'var(--leading-tight)' }}>
                          {link.name}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--type-xs)',
                            opacity: 0.5,
                            fontFamily: 'var(--font-heading)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            marginTop: 2,
                          }}
                        >
                          No address yet
                        </span>
                      </span>
                    )}
                    <button
                      type="button"
                      className="bare"
                      onClick={() => {
                        setDraft(url);
                        setEditing(open ? null : link.id);
                      }}
                      style={{ fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
                    >
                      {open ? 'CANCEL' : url ? 'EDIT' : 'ADD'}
                    </button>
                    {state.extraLinks.some((l) => l.id === link.id) && !open && (
                      <button
                        type="button"
                        className="bare"
                        onClick={() => dispatch({ type: 'removeLink', id: link.id })}
                        style={{ fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
                      >
                        REMOVE
                      </button>
                    )}
                  </div>

                  {open && (
                    <>
                      <input
                        className="input"
                        value={draft}
                        placeholder={link.hint || 'https://…'}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && save(link.id)}
                        style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', marginTop: 9 }}
                        aria-label={`${link.name} address`}
                      />
                      {link.note && (
                        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 'var(--leading-normal)', marginTop: 7 }}>
                          {link.note}
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => save(link.id)}
                        style={{
                          marginTop: 9,
                          fontSize: 'var(--type-xs)',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Save
                      </button>
                    </>
                  )}
                </div>
              );
            })}
                </div>
              </div>
            );
          })}

          {adding ? (
            <Blueprint style={{ padding: '13px 14px', marginTop: 12 }}>
              <div className="kicker">Your own link</div>
              <input
                className="input"
                placeholder="What it is — Commodore Card, the gym"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ fontSize: 'var(--type-base)', marginTop: 9 }}
              />
              <input
                className="input"
                placeholder="https://…"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', marginTop: 8 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAdding(false)}
                  style={{ flex: 1, height: 40, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!newName.trim() || !newUrl.trim()}
                  onClick={() => {
                    const url = newUrl.trim();
                    dispatch({
                      type: 'addLink',
                      name: newName,
                      url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
                    });
                    setNewName('');
                    setNewUrl('');
                    setAdding(false);
                  }}
                  style={{ flex: 1, height: 40, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                >
                  Add it
                </button>
              </div>
            </Blueprint>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setAdding(true)}
              style={{ height: 40, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 12 }}
            >
              Add a link of your own
            </button>
          )}

          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 'var(--leading-normal)', marginTop: 10, textWrap: 'pretty' }}>
            These open the system itself — the app on a phone that recognises the address, the site
            otherwise. None of them expose an API a student can use alone, so the app links out rather
            than pretending to read them. Correct any address here and the correction is what sticks.
          </div>
        </>
      )}
    </Page>
  );
}

