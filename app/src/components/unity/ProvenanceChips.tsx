import { cues, originChip, phrase, type FactProvenance } from '../../lib/factprovenance';
import { freshnessLine } from '../../lib/source';

/**
 * A fact's origin and its most important cues, drawn the one way.
 *
 * The origin chip always shows; at most two further cues follow it, chosen by
 * `lib/factprovenance.ts`'s priority (restricted, then age, then doubt, then
 * process, then good news). What does not fit is not lost: the sentence for a
 * screen reader carries every cue, and the Source & details drawer is where a
 * sighted reader finds the rest.
 *
 * Each chip is a glyph, a word and a tone, and origin has a second carrier in
 * how the chip is drawn — solid for an institution's, outlined for the rest,
 * dashed for a sample — so it survives greyscale and forced colours
 * (`a11y/tellings.test.ts`). The visible chips are hidden from assistive
 * technology and replaced by the one sentence, so a reader hears
 * "Institution verified by the Registrar, out of date, updated 5 days ago"
 * once, not four fragments with their glyphs read out.
 *
 * Not interactive. Opening the drawer is the card's job, so there is no
 * second button to tab through on every row.
 */
export function ProvenanceChips({ provenance, now }: { provenance: FactProvenance; now?: number }) {
  const origin = originChip(provenance);
  const age = freshnessLine(provenance.observedAt, now);
  return (
    <span className="prov" data-origin={provenance.origin} title={origin.meaning}>
      <span className="prov-visible" aria-hidden="true">
        <span className="status-chip prov-chip" data-tone={origin.tone} data-fill={origin.fill}>
          <span className="status-glyph">{origin.glyph}</span>
          {origin.word}
        </span>
        {cues(provenance).map((c) => (
          <span key={c.key} className="status-chip prov-chip" data-tone={c.tone} data-fill="outline" data-cue={c.key}>
            <span className="status-glyph">{c.glyph}</span>
            {c.word}
          </span>
        ))}
        {age && <span className="prov-age">{age}</span>}
      </span>
      <span className="sr-only">{phrase(provenance, now)}</span>
    </span>
  );
}
