import { describe, expect, it } from '../../../app/node_modules/vitest/dist/index.js';
import {
  SCIM_PATCH_SCHEMA,
  SCIM_USER_SCHEMA,
  mapScimGroupsToRoles,
  parseScimFilter,
  parseScimGroup,
  parseScimPatch,
  parseScimUser,
  scimUserResource,
} from './provisioning.ts';

describe('SCIM provisioning contracts', () => {
  it('parses only bounded equality filters on supported user attributes', () => {
    expect(parseScimFilter('userName eq "student@vanderbilt.edu"')).toEqual({
      attribute: 'userName',
      operator: 'eq',
      value: 'student@vanderbilt.edu',
    });
    expect(parseScimFilter('externalId EQ "vu-1001"')).toEqual({
      attribute: 'externalId',
      operator: 'eq',
      value: 'vu-1001',
    });
    expect(() => parseScimFilter('tenantId eq "another-school"')).toThrow(/filter/i);
    expect(() => parseScimFilter('userName co "vanderbilt"')).toThrow(/filter/i);
    expect(() => parseScimFilter(`userName eq "${'x'.repeat(301)}"`)).toThrow(/filter/i);
  });

  it('accepts an explicitly inactive user without defaulting it back to active', () => {
    expect(parseScimUser({
      schemas: [SCIM_USER_SCHEMA],
      externalId: 'vu-1001',
      userName: 'student@vanderbilt.edu',
      displayName: 'Student One',
      active: false,
    })).toEqual({
      schemas: [SCIM_USER_SCHEMA],
      externalId: 'vu-1001',
      userName: 'student@vanderbilt.edu',
      displayName: 'Student One',
      active: false,
    });
  });

  it('normalizes supported add, replace and remove patch operations', () => {
    expect(parseScimPatch({
      schemas: [SCIM_PATCH_SCHEMA],
      Operations: [
        { op: 'Replace', path: 'active', value: false },
        { op: 'add', path: 'displayName', value: 'New Name' },
        { op: 'remove', path: 'externalId' },
      ],
    }, 'User')).toEqual([
      { op: 'replace', path: 'active', value: false },
      { op: 'add', path: 'displayName', value: 'New Name' },
      { op: 'remove', path: 'externalId' },
    ]);
  });

  it('rejects unknown patch paths and missing mutation values', () => {
    expect(() => parseScimPatch({
      schemas: [SCIM_PATCH_SCHEMA],
      Operations: [{ op: 'replace', path: 'tenantId', value: 'other-school' }],
    }, 'User')).toThrow(/patch/i);
    expect(() => parseScimPatch({
      schemas: [SCIM_PATCH_SCHEMA],
      Operations: [{ op: 'add', path: 'displayName' }],
    }, 'User')).toThrow(/patch/i);
  });

  it('maps approved groups to distinct roles and grants nothing for unknown groups', () => {
    expect(mapScimGroupsToRoles(
      ['vanderbilt-students', 'unknown-group', 'vanderbilt-students', 'vanderbilt-advisors'],
      {
        'vanderbilt-students': ['student'],
        'vanderbilt-advisors': ['advisor', 'staff'],
      },
    )).toEqual(['student', 'advisor', 'staff']);
    expect(mapScimGroupsToRoles(['unknown-group'], {})).toEqual([]);
  });

  it('keeps pilot teaching-assistant, applicant, family and alumni roles distinct', () => {
    expect(mapScimGroupsToRoles(
      ['tas', 'applicants', 'families', 'alumni'],
      {
        tas: ['teaching_assistant'],
        applicants: ['applicant'],
        families: ['family'],
        alumni: ['alumni'],
      },
    )).toEqual(['teaching_assistant', 'applicant', 'family', 'alumni']);
  });

  it('parses bounded groups and members without accepting internal tenant fields', () => {
    expect(parseScimGroup({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      externalId: 'group-1',
      displayName: 'Vanderbilt students',
      members: [{ value: 'user-1', display: 'Student One' }],
      tenantId: 'attacker-selected',
    })).toEqual({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      externalId: 'group-1',
      displayName: 'Vanderbilt students',
      members: [{ value: 'user-1', display: 'Student One' }],
    });
  });

  it('redacts tenant, audit and authorization state from a SCIM user response', () => {
    const response = scimUserResource({
      tenantId: 'vanderbilt',
      userId: 'internal-user-1',
      externalId: 'vu-1001',
      userName: 'student@vanderbilt.edu',
      displayName: 'Student One',
      active: true,
      roles: ['student'],
      groupIds: ['secret-group-row-id'],
      auditId: 'audit-1',
      createdAt: '2026-09-24T12:00:00.000Z',
      updatedAt: '2026-09-24T13:00:00.000Z',
      location: 'https://semester.example/api/scim/v2/Users/internal-user-1',
    });

    expect(response).toEqual({
      schemas: [SCIM_USER_SCHEMA],
      id: 'internal-user-1',
      externalId: 'vu-1001',
      userName: 'student@vanderbilt.edu',
      displayName: 'Student One',
      active: true,
      meta: {
        resourceType: 'User',
        created: '2026-09-24T12:00:00.000Z',
        lastModified: '2026-09-24T13:00:00.000Z',
        location: 'https://semester.example/api/scim/v2/Users/internal-user-1',
      },
    });
    expect(JSON.stringify(response)).not.toMatch(/tenantId|auditId|roles|groupIds/);
  });
});
