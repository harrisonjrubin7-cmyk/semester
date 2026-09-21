import { describe, expect, it } from 'vitest';
import { MATERIAL_STATES, materialGrid, newProgram, type Program, type ProgramMaterial } from './pathway';

/**
 * The transpose, and the two facts it must not confuse.
 *
 * A blank cell and "Not started" are different claims — one says the programme
 * never asked for the thing, the other says it asked and nothing has been done
 * — and a grid that drew them the same would invent a requirement nobody
 * recorded. Every test below is ultimately about keeping those apart.
 */

const material = (title: string, status: ProgramMaterial['status'] = 'Not started'): ProgramMaterial => ({
  id: `${title}:${status}:${Math.random()}`,
  title,
  status,
  due: '',
});

const program = (school: string, materials: ProgramMaterial[] = []): Program => ({
  ...newProgram(),
  school,
  program: `${school} program`,
  materials,
});

describe('the requirements grid', () => {
  it('is one column per material title in use, in the order they are first met', () => {
    const grid = materialGrid([
      program('A', [material('Transcript'), material('Essay')]),
      program('B', [material('Essay'), material('Writing sample')]),
    ]);
    expect(grid.titles).toEqual(['Transcript', 'Essay', 'Writing sample']);
    expect(grid.rows.map((r) => r.program.school)).toEqual(['A', 'B']);
  });

  it('puts each programme’s own status in the cell', () => {
    const grid = materialGrid([
      program('A', [material('Essay', 'Ready locally')]),
      program('B', [material('Essay', 'Reported received')]),
    ]);
    expect(grid.rows[0].cells).toEqual(['Ready locally']);
    expect(grid.rows[1].cells).toEqual(['Reported received']);
  });

  /*
   * The whole reason this is not a count. "B does not ask for a transcript"
   * and "B has not started its transcript" are different sentences, and only
   * one of them is true of a programme with no material of that title.
   */
  it('leaves a cell blank where the programme has no material of that title, rather than calling it unstarted', () => {
    const grid = materialGrid([program('A', [material('Transcript')]), program('B', [material('Essay')])]);
    expect(grid.titles).toEqual(['Transcript', 'Essay']);
    expect(grid.rows[0].cells).toEqual(['Not started', '']);
    expect(grid.rows[1].cells).toEqual(['', 'Not started']);
  });

  it('folds one requirement typed two ways into one column, keeping the first spelling', () => {
    const grid = materialGrid([
      program('A', [material('Writing sample', 'Preparing')]),
      program('B', [material('writing SAMPLE', 'Ready locally')]),
    ]);
    expect(grid.titles).toEqual(['Writing sample']);
    expect(grid.rows.map((r) => r.cells)).toEqual([['Preparing'], ['Ready locally']]);
  });

  it('shows the first of two materials a programme gave the same title', () => {
    const grid = materialGrid([program('A', [material('Essay', 'Preparing'), material('Essay', 'Not started')])]);
    expect(grid.rows[0].cells).toEqual(['Preparing']);
  });

  it('ignores a blank title rather than opening a nameless column', () => {
    const grid = materialGrid([program('A', [material('   '), material('Essay')])]);
    expect(grid.titles).toEqual(['Essay']);
    expect(grid.rows[0].cells).toEqual(['Not started']);
  });

  it('has no columns at all when nothing has been recorded', () => {
    expect(materialGrid([])).toEqual({ titles: [], rows: [] });
    const only = program('A');
    expect(materialGrid([only])).toEqual({ titles: [], rows: [{ program: only, cells: [] }] });
  });

  it('gives every row exactly as many cells as there are columns', () => {
    const grid = materialGrid([
      program('A', [material('Transcript'), material('Essay')]),
      program('B', []),
      program('C', [material('Recommendation')]),
    ]);
    for (const row of grid.rows) expect(row.cells).toHaveLength(grid.titles.length);
  });

  /*
   * Every value in a cell is one the student chose from `MATERIAL_STATES`, or
   * nothing. The grid derives no fifth state of its own — no "complete", no
   * "behind" — because it is a view of what was typed and not a reading of it.
   */
  it('puts nothing in a cell that is not a state the student picked', () => {
    const grid = materialGrid(
      MATERIAL_STATES.map((status, i) => program(`P${i}`, [material('Essay', status)])),
    );
    for (const row of grid.rows) {
      for (const cell of row.cells) expect(cell === '' || MATERIAL_STATES.includes(cell)).toBe(true);
    }
    expect(grid.rows.map((r) => r.cells[0])).toEqual([...MATERIAL_STATES]);
  });
});
