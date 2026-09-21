import { secondLine } from '../lib/dim';
import { SectionLabel } from './ui';
import { longLabel } from '../lib/date';
import { CSC_URL, NIL_AS_AT, NIL_GO_URL, NIL_TERMS } from '../lib/nil';

/**
 * Four words, in plain language, with the date they were last read.
 *
 * ## The date is the feature
 *
 * Every explainer of a rule goes stale, and the ones that do damage are the
 * ones that look current. So `NIL_AS_AT` is drawn at the top in ordinary
 * reading size — not a grey line at the bottom, not a tooltip — and it is the
 * first thing on the page under the screen's banner. A reader who can see that this was
 * written a year ago knows exactly how much weight to put on it, which is more
 * useful than anything the paragraphs underneath can tell them.
 *
 * `lib/spend.ts` does the same with API prices and says why: the token counts
 * are a fact and the money is an estimate, so the screen shows which rates it
 * used and never rounds a guess up into a number that looks measured.
 *
 * ## Why each term carries what it does *not* mean
 *
 * Because that is the half people get wrong, and it is the half a paraphrase
 * usually drops. "Five business days" is understood; that it runs from signing
 * rather than from being paid is the part that costs somebody a late report.
 * So every entry has a `careful` line, and it is not smaller or dimmer than
 * the definition above it.
 *
 * ## Paraphrase, never quotation
 *
 * A quoted rule invites the reader to treat this screen as the rule. These are
 * summaries in somebody's own words, they name where they came from, and they
 * link to the bodies that publish the real thing.
 */
export function NilExplainer() {
  const line = {
    fontSize: 'var(--type-sm)',
    ...secondLine(),
    lineHeight: 'var(--leading-normal)',
    textWrap: 'pretty',
  } as const;

  return (
    <>
      {/*
        * No second banner. The screen that holds this already draws
        * `NotOfficial` above the tabs, where it stays for both of them —
        * drawing another one here put the same sentence on the page twice,
        * which is how a warning stops being read at all.
        */}
      <p
        style={{
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-normal)',
          marginBlock: 'var(--sp-5)',
          textWrap: 'pretty',
        }}
      >
        A summary in plain words rather than the rule itself, last read against its sources on{' '}
        {longLabel(new Date(`${NIL_AS_AT}T12:00`))} {NIL_AS_AT.slice(0, 4)}. If that is a long time
        ago, treat everything below as a starting point for a question rather than an answer — rules
        here change, and the places that publish them are linked at the bottom.
      </p>

      {NIL_TERMS.map((t) => (
        <div key={t.term} style={{ borderBottom: '1px solid var(--app-line)', paddingBlock: 'var(--sp-5)' }}>
          <SectionLabel style={{ marginBlock: '0 var(--sp-3)' }}>{t.term}</SectionLabel>
          <p
            style={{
              fontSize: 'var(--type-base)',
              lineHeight: 'var(--leading-normal)',
              marginBlock: 0,
              textWrap: 'pretty',
            }}
          >
            {t.plain}
          </p>
          <p
            style={{
              fontSize: 'var(--type-base)',
              lineHeight: 'var(--leading-normal)',
              marginBlock: 'var(--sp-3) 0',
              textWrap: 'pretty',
            }}
          >
            {t.careful}
          </p>
          <p style={{ ...line, marginBlock: 'var(--sp-3) 0' }}>{t.source}</p>
        </div>
      ))}

      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>The places that publish it</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <a className="btn btn-ghost" href={CSC_URL} target="_blank" rel="noreferrer noopener" style={{ flex: '1 1 auto' }}>
          College Sports Commission
        </a>
        <a className="btn btn-ghost" href={NIL_GO_URL} target="_blank" rel="noreferrer noopener" style={{ flex: '1 1 auto' }}>
          NIL Go
        </a>
      </div>
      <p style={{ ...line, marginTop: 'var(--sp-4)' }}>
        Your own compliance office comes before both of them. They know your school, your conference
        and your state, and they are the only people who can tell you what applies to you.
      </p>
    </>
  );
}
