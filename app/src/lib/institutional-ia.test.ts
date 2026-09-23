import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';
import {
  PRIMARY_DESTINATIONS,
  WORKSPACES,
  allMappedDestinationIds,
  workspaceFor,
} from './institutional-ia';

describe('institutional information architecture', () => {
  it('pins the approved five primary destinations', () => {
    expect(PRIMARY_DESTINATIONS.map((item) => item.id)).toEqual([
      'home',
      'calendar',
      'discover',
      'ask-semester',
      'inbox',
    ]);
  });

  it('pins the approved seven workspaces', () => {
    expect(WORKSPACES.map((workspace) => workspace.id)).toEqual([
      'home',
      'courses',
      'study',
      'create',
      'campus',
      'career',
      'messages',
    ]);
  });

  it('maps every registered destination exactly once', () => {
    const mapped = allMappedDestinationIds();
    const registered = DESTINATIONS.map((destination) => destination.screen);

    expect(mapped).toHaveLength(new Set(mapped).size);
    expect([...mapped].sort()).toEqual([...registered].sort());
  });

  it('resolves a current screen to its contextual workspace', () => {
    expect(workspaceFor('degree').id).toBe('courses');
    expect(workspaceFor('draw').id).toBe('create');
    expect(workspaceFor('mail').id).toBe('messages');
    expect(workspaceFor('search').id).toBe('home');
  });
});
