import type { SourceLabel } from '../source';

/**
 * A shadow receipt for one section while the SIS still enrols.
 *
 * The SIS result is the only input. Semester does not take a seat and does
 * not mark the outcome institution verified. `wroteSeat` stays false. The
 * registration writeback flag stays off; this function does not read it and
 * does not write a row.
 */

export interface SisEnrolNotice {
  /** Opaque reference from the SIS. Not a Semester enrollment id. */
  externalRef: string;
  sectionCode: string;
  term: string;
  outcome: 'enrolled' | 'waitlisted' | 'refused';
}

export interface ShadowReceipt {
  authority: 'sis';
  source: Extract<SourceLabel, 'imported'>;
  externalRef: string;
  sectionCode: string;
  term: string;
  outcome: SisEnrolNotice['outcome'];
  wroteSeat: false;
}

const OUTCOMES = ['enrolled', 'waitlisted', 'refused'] as const;

export function shadowReceipt(notice: SisEnrolNotice): ShadowReceipt {
  const externalRef = notice.externalRef.trim();
  const sectionCode = notice.sectionCode.trim();
  const term = notice.term.trim();
  if (!externalRef || !sectionCode || !term) {
    throw new Error('A shadow receipt needs the SIS reference, the section, and the term.');
  }
  if (!(OUTCOMES as readonly string[]).includes(notice.outcome)) {
    throw new Error('A shadow receipt outcome is enrolled, waitlisted, or refused.');
  }
  return {
    authority: 'sis',
    source: 'imported',
    externalRef,
    sectionCode,
    term,
    outcome: notice.outcome,
    wroteSeat: false,
  };
}
