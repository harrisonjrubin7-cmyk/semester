import { useState } from 'react';
import { useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { ActionButton, SectionLabel } from './ui';
import { safeUrl } from '../lib/apply';
import { CSC_URL, NIL_GO_URL } from '../lib/nil';

/**
 * The three places this app is not, with the one that matters first.
 *
 * NIL Go and the College Sports Commission are national, so their addresses
 * are constants. **A compliance office is not**, and that is the whole reason
 * this component exists rather than a third `<a>` beside the other two.
 *
 * Every athlete's compliance office is a different page at a different
 * university, and it is the *first* place they should go — before NIL Go,
 * before the explainer, before anything this app says. Leaving it as the one
 * destination with no link, in a sentence reading "your compliance office is
 * the place that knows", makes the two links that *are* here look like the
 * answer. They are not: they are the national backstop.
 *
 * ## It is pasted, not guessed
 *
 * The app cannot know the address and will not invent one — the same refusal
 * `lib/cost.ts` makes about textbook prices and `lib/registrar.ts` makes about
 * term dates. So the row exists with the address empty and a field to paste
 * it into, which is exactly what `data/campus.ts` already does for myVU: a
 * known destination, an unknown address, and a line saying to go and copy it.
 *
 * ## Stored where every other corrected address is stored
 *
 * `state.linkUrls`, through `setLinkUrl` — the same record the Links screen
 * writes when somebody fixes a bundled address. So it is account data: it
 * syncs, it survives a reload, and it is in an export, unlike the deal record,
 * which stays in a device library. That split is deliberate. The address of a
 * public web page is not the sensitive half of this screen; what somebody was
 * paid is, and that never leaves the device.
 *
 * **It does not appear on the Links screen**, and an earlier version of this
 * file said it did. That screen draws rows it knows about — `CAMPUS_LINKS`
 * and the six addresses off the school profile — and corrects their addresses
 * out of `linkUrls`. An id with no row behind it is stored and never drawn.
 * Measured by reading the rendered page rather than the code: the word
 * "compliance" appears nowhere on it after saving here.
 *
 * Giving it a row is the obvious fix and is not obviously right: Links is
 * every student's screen and a compliance office is an athlete's, so the row
 * would be clutter for everyone who is not one. Left as it is, deliberately,
 * with this note so the next person meets the decision rather than the bug.
 */

/** The id this address is filed under, shared with the Links screen. */
export const COMPLIANCE_LINK = 'athletics-compliance';

export function ComplianceLink() {
  const { state, dispatch } = useStore();
  const saved = state.linkUrls[COMPLIANCE_LINK] ?? '';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [said, setSaid] = useState('');

  const line = {
    fontSize: 'var(--type-sm)',
    ...secondLine(),
    lineHeight: 'var(--leading-normal)',
    textWrap: 'pretty',
  } as const;

  const save = () => {
    const url = safeUrl(draft);
    if (draft.trim() && !url) {
      setSaid('That is not a web address this app can open. Paste the whole thing, starting with https.');
      return;
    }
    dispatch({ type: 'setLinkUrl', id: COMPLIANCE_LINK, url });
    setEditing(false);
    setSaid(url ? 'Saved to your account, so it is here on every device.' : 'Address cleared.');
  };

  return (
    <>
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>Where it actually goes</SectionLabel>
      <p style={{ ...line, marginBlock: 0 }}>
        Your own compliance office comes first — they know your school, your conference and your
        state. Submission happens at NIL Go. This app has no connection to either and never submits
        anything on your behalf.
      </p>

      {saved && !editing ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
          <a
            className="btn btn-primary"
            href={saved}
            target="_blank"
            rel="noreferrer noopener"
            style={{ flex: '1 1 auto' }}
          >
            Your compliance office
          </a>
          <ActionButton
            onClick={() => {
              setDraft(saved);
              setEditing(true);
            }}
            style={{ flex: '0 1 auto' }}
          >
            Change
          </ActionButton>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
              Your compliance office’s page — open it once, copy the address, paste it here
            </span>
            <input
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
            <ActionButton onClick={save} style={{ flex: '1 1 auto' }}>
              Save the address
            </ActionButton>
            {editing && (
              <ActionButton
                onClick={() => {
                  setDraft(saved);
                  setEditing(false);
                  setSaid('');
                }}
                style={{ flex: '0 1 auto' }}
              >
                Cancel
              </ActionButton>
            )}
          </div>
        </div>
      )}

      {said && (
        <p
          role="status"
          style={{
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-normal)',
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {said}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <a className="btn btn-ghost" href={NIL_GO_URL} target="_blank" rel="noreferrer noopener" style={{ flex: '1 1 auto' }}>
          Open NIL Go
        </a>
        <a className="btn btn-ghost" href={CSC_URL} target="_blank" rel="noreferrer noopener" style={{ flex: '1 1 auto' }}>
          College Sports Commission
        </a>
      </div>
    </>
  );
}
