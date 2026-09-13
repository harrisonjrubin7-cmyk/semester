import { describe, expect, it } from 'vitest';
import { ORDER, clashes, commands, live, misordered, tidy, type Menu } from './menus';

const noop = () => {};

const bar = (): Menu[] => [
  {
    id: 'file',
    label: 'File',
    groups: [
      [{ id: 'file.new', label: 'New', run: noop }],
      [
        { id: 'file.word', label: 'Word (.docx)', run: noop },
        { id: 'file.print', label: 'Print', run: noop },
      ],
    ],
  },
  {
    id: 'view',
    label: 'View',
    groups: [[{ id: 'view.outline', label: 'Outline', on: true, run: noop }]],
  },
];

describe('tidying the bar', () => {
  it('greys a command with nothing behind it', () => {
    const [menu] = tidy([
      { id: 'file', label: 'File', groups: [[{ id: 'a', label: 'Save' }]] },
    ]);
    expect(menu.groups[0][0].disabled).toBe(true);
  });

  it('leaves one that has something behind it alone', () => {
    const [menu] = tidy(bar());
    expect(menu.groups[0][0].disabled).toBeUndefined();
  });

  it('keeps a command that is disabled on purpose disabled', () => {
    const [menu] = tidy([
      { id: 'f', label: 'File', groups: [[{ id: 'a', label: 'Save', run: noop, disabled: true }]] },
    ]);
    expect(menu.groups[0][0].disabled).toBe(true);
  });

  it('drops a group that a condition emptied, rather than drawing a rule above nothing', () => {
    const tidied = tidy([
      { id: 'file', label: 'File', groups: [[{ id: 'a', label: 'Save', run: noop }], []] },
    ]);
    expect(tidied[0].groups).toHaveLength(1);
  });

  it('drops a menu that has emptied entirely', () => {
    expect(tidy([{ id: 'format', label: 'Format', groups: [[], []] }])).toEqual([]);
  });

  it('drops an item with no label, which is a hole in a list of words', () => {
    const tidied = tidy([
      {
        id: 'file',
        label: 'File',
        groups: [[{ id: 'a', label: '', run: noop }, { id: 'b', label: 'Save', run: noop }]],
      },
    ]);
    expect(tidied[0].groups[0].map((c) => c.id)).toEqual(['b']);
  });
});

describe('reading the bar', () => {
  it('lists every command in the order it is drawn', () => {
    expect(commands(bar()).map((c) => c.id)).toEqual([
      'file.new',
      'file.word',
      'file.print',
      'view.outline',
    ]);
  });

  it('counts as live only what can be pressed now', () => {
    const menus = bar();
    menus[0].groups[1][0] = { id: 'file.word', label: 'Word (.docx)' };
    expect(live(menus).map((c) => c.id)).toEqual(['file.new', 'file.print', 'view.outline']);
  });
});

describe('ids', () => {
  it('finds nothing to complain about in a bar built properly', () => {
    expect(clashes(bar())).toEqual([]);
  });

  it('names an id used twice, because React would silently drop the second', () => {
    expect(
      clashes([
        {
          id: 'file',
          label: 'File',
          groups: [[{ id: 'same', label: 'One' }], [{ id: 'same', label: 'Two' }]],
        },
      ]),
    ).toEqual(['same']);
  });
});

describe('the order the bar is read in', () => {
  it('passes a bar that is a subsequence of the house order', () => {
    expect(misordered(bar())).toBe(null);
  });

  it('passes the full house order', () => {
    expect(misordered(ORDER.map((id) => ({ id, label: id, groups: [] })))).toBe(null);
  });

  it('names a menu that comes before one it should follow', () => {
    expect(
      misordered([
        { id: 'insert', label: 'Insert', groups: [] },
        { id: 'edit', label: 'Edit', groups: [] },
      ]),
    ).toBe('edit');
  });

  it('names a menu nobody has ever seen on a menu bar', () => {
    expect(misordered([{ id: 'stuff', label: 'Stuff', groups: [] }])).toBe('stuff');
  });

  it('names a menu drawn twice', () => {
    expect(
      misordered([
        { id: 'file', label: 'File', groups: [] },
        { id: 'file', label: 'File', groups: [] },
      ]),
    ).toBe('file');
  });
});
