import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type AdrFile, fileLinks, problems, readAdrs } from './adrprogram';

const root = join(process.cwd(), '..');

const adr = (folder: AdrFile['folder'], n: string, status: string, extra = ''): AdrFile => {
  const file = `ADR-${n}-x.md`;
  return {
    path: `docs/decisions/${folder}/${file}`,
    folder,
    rel: `${folder}/${file}`,
    file,
    text: `# ADR-${n} · x\n\n| Field | Value |\n| --- | --- |\n| Status | ${status} |\n\n## Fitness functions\nsomething\n${extra}`,
  };
};

const lists = (...as: AdrFile[]) => as.map((a) => `[${a.file}](${a.rel})`).join('\n');
const check = (adrs: AdrFile[], over: { index?: string; backlog?: string; exists?: (p: string) => boolean } = {}) =>
  problems({ adrs, index: over.index ?? lists(...adrs), backlog: over.backlog ?? lists(...adrs), exists: over.exists ?? (() => true) });

describe('the ADR program in docs/decisions/', () => {
  it('holds the real ADRs to its own rules', () => {
    const adrs = readAdrs(root);
    expect(adrs.length).toBeGreaterThanOrEqual(25);
    const found = problems({
      adrs,
      index: readFileSync(join(root, 'docs/decisions/ADR_INDEX.md'), 'utf8'),
      backlog: readFileSync(join(root, 'docs/decisions/DECISION_BACKLOG.md'), 'utf8'),
      exists: (p) => existsSync(join(root, p)),
    });
    expect(found).toEqual([]);
  });

  // The controls: a checker that found nothing would pass the test above on
  // any input, so each rule is shown the fault it exists to catch.
  it('control: a clean pair of ADRs raises nothing', () => {
    expect(check([adr('proposed', '0001', 'Proposed'), adr('accepted', '0002', 'Accepted')])).toEqual([]);
  });

  it('control: sees a Status that disagrees with the folder it is in', () => {
    const found = check([adr('accepted', '0001', 'Proposed')]);
    expect(found.join('\n')).toMatch(/Status "Proposed" does not belong in accepted\//);
  });

  it('control: sees a number written twice', () => {
    const found = check([adr('proposed', '0001', 'Proposed'), adr('accepted', '0001', 'Accepted')]);
    expect(found.join('\n')).toMatch(/ADR-0001 is written 2 times/);
  });

  it('control: sees a heading that is not the file\'s number', () => {
    const a = adr('proposed', '0001', 'Proposed');
    a.text = a.text.replace('# ADR-0001', '# ADR-0009');
    expect(check([a]).join('\n')).toMatch(/heading is ADR-0009, the file is ADR-0001/);
  });

  it('control: sees an ADR the index or backlog does not link', () => {
    const a = adr('proposed', '0001', 'Proposed');
    const found = check([a], { index: '', backlog: lists(a) });
    expect(found).toEqual([`docs/decisions/ADR_INDEX.md: does not link proposed/ADR-0001-x.md, so a moved or new ADR is missing from it`]);
  });

  it('control: sees a link that resolves to nothing', () => {
    const a = adr('proposed', '0001', 'Proposed', '\nsee [gone](../../nowhere.md)\n');
    expect(check([a], { exists: (p) => p !== 'docs/nowhere.md' }).join('\n')).toMatch(/resolves to docs\/nowhere\.md, which does not exist/);
  });

  it('control: sees a citation of an ADR that does not exist, which is how ADR-0004 gets read as 0004', () => {
    const a = adr('proposed', '0001', 'Proposed', '\nsee ADR-0042\n');
    expect(check([a]).join('\n')).toMatch(/cites ADR-0042, which does not exist/);
  });

  it('control: an accepted ADR with an empty Fitness functions section is refused', () => {
    const a = adr('accepted', '0001', 'Accepted');
    a.text = a.text.replace('something\n', '');
    expect(check([a]).join('\n')).toMatch(/needs a Fitness functions section/);
  });

  it('reads links without anchors, URLs or mail addresses', () => {
    expect(fileLinks('[a](x.md#y) [b](https://e.com) [c](#z) [d](mailto:a@b)')).toEqual(['x.md']);
  });
});
