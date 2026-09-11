import { describe, expect, it } from 'vitest';
import {
  TABS,
  ZOOMS,
  clashes,
  controls,
  live,
  misordered,
  showing,
  stepZoom,
  tidy,
  type Control,
  type Tab,
} from './ribbon';

const button = (id: string, run?: () => void): Control => ({
  kind: 'button',
  id,
  label: id,
  run,
});

const tab = (id: string, groups: { id: string; controls: Control[] }[]): Tab => ({
  id,
  label: id,
  groups: groups.map((g) => ({ ...g, label: g.id })),
});

/**
 * The ribbon's rules, which exist for the same reason the menu bar's do: a
 * toolbar is the one part of an interface where a wrong control is invisible
 * until somebody presses it.
 */
describe('drawing a ribbon', () => {
  it('drops a group with nothing in it rather than drawing its name over air', () => {
    const drawn = tidy([tab('home', [{ id: 'font', controls: [] }, { id: 'num', controls: [button('b')] }])]);
    expect(drawn[0].groups.map((g) => g.id)).toEqual(['num']);
  });

  it('drops a tab whose groups all emptied', () => {
    expect(tidy([tab('data', [{ id: 'sort', controls: [] }])])).toEqual([]);
  });

  it('counts a control with no handler as dead, whatever kind it is', () => {
    expect(live(button('b'))).toBe(false);
    expect(live(button('b', () => {}))).toBe(true);
    expect(live({ kind: 'pick', id: 'p', label: 'p', value: 'a', options: [] })).toBe(false);
    expect(
      live({ kind: 'slider', id: 's', label: 's', value: 1, min: 0, max: 2, step: 1 }),
    ).toBe(false);
  });

  it('reads every control in the order it is drawn', () => {
    const ribbon = [
      tab('home', [{ id: 'font', controls: [button('b'), button('i')] }]),
      tab('view', [{ id: 'zoom', controls: [button('z')] }]),
    ];
    expect(controls(ribbon).map((c) => c.id)).toEqual(['b', 'i', 'z']);
  });
});

describe('the rules a ribbon has to hold', () => {
  it('finds an id used twice, wherever the two are', () => {
    // React keys by the id, so the second silently replaces the first.
    const ribbon = [
      tab('home', [{ id: 'font', controls: [button('b')] }]),
      tab('view', [{ id: 'font', controls: [button('b')] }]),
    ];
    expect(clashes(ribbon)).toEqual(['b', 'font']);
  });

  it('is happy with a ribbon whose ids are all its own', () => {
    expect(clashes([tab('home', [{ id: 'font', controls: [button('b')] }])])).toEqual([]);
  });

  it('names the first tab that is out of order, and any tab that is not a tab', () => {
    expect(misordered([tab('home', []), tab('view', [])])).toBeNull();
    expect(misordered([tab('view', []), tab('home', [])])).toBe('home');
    expect(misordered([tab('macros', [])])).toBe('macros');
  });

  it('reads its tabs in the order every spreadsheet reads them', () => {
    expect([...TABS]).toEqual(['home', 'insert', 'formulas', 'data', 'view']);
  });
});

describe('which tab is showing', () => {
  const ribbon = [
    tab('home', [{ id: 'font', controls: [button('b')] }]),
    tab('data', [{ id: 'sort', controls: [button('s')] }]),
  ];

  it('is the one that was chosen', () => {
    expect(showing(ribbon, 'data')?.id).toBe('data');
  });

  it('falls back to the first when the chosen one has emptied', () => {
    // Data has nothing in it until a block is selected, and a row of tabs over
    // an empty body reads as broken.
    expect(showing([ribbon[0]], 'data')?.id).toBe('home');
  });

  it('is nothing at all when there is no ribbon', () => {
    expect(showing([], 'home')).toBeNull();
  });
});

describe('zoom', () => {
  it('steps between the settings somebody can get back to', () => {
    expect(stepZoom(100, 1)).toBe(125);
    expect(stepZoom(100, -1)).toBe(90);
  });

  it('stops at each end rather than wrapping round', () => {
    expect(stepZoom(ZOOMS[0], -1)).toBe(ZOOMS[0]);
    expect(stepZoom(ZOOMS[ZOOMS.length - 1], 1)).toBe(ZOOMS[ZOOMS.length - 1]);
  });

  it('finds its way back on to the scale from between two steps', () => {
    expect(stepZoom(87, 1)).toBe(100);
    expect(stepZoom(87, -1)).toBe(75);
  });
});
