import { test, eq } from './harness';
import { parseIcs, termDates } from '../src/lib/connectorImport';

const ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:Spring 2027 Registration opens', 'DTSTART;VALUE=DATE:20261102', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:Spring 2027 registration closes', 'DTSTART:20270108T170000Z', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:Spring 2027: First day of classes', 'DTSTART:20270111', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:Spring 2027 Last day to add', 'DTSTART:20270118', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:Spring 2027 Classes end', 'DTSTART:20270430', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:Fall 2027 Classes begin', 'DTSTART:20270825', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:Homecoming wee', ' kend', 'DTSTART:20271010', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
test('ICS: folded lines, date and date-time starts', () => eq(parseIcs(ICS).map((e) => e.start).slice(0, 2), ['2026-11-02', '2027-01-08']));
test('term dates: a complete term, an incomplete term, and unused events', () => {
  const r = termDates(parseIcs(ICS));
  eq(r.terms.map((t) => [t.term, t.missing.length]), [['Fall 2027', 4], ['Spring 2027', 0]]);
  eq(r.terms[1].dates, { regOpens: '2026-11-02', regCloses: '2027-01-08', classesStart: '2027-01-11', addDropEnds: '2027-01-18', classesEnd: '2027-04-30' });
  eq(r.unused, ['Homecoming weekend']);
});
