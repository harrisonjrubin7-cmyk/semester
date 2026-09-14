import { describe, it, expect } from 'vitest';
import { reviewReady } from './import-review';
const item = {id:'exam',title:'Midterm',year:2026,month:8,day:15};
describe('activating an imported course calendar',()=>{
 it('requires explicit verification even when dates are valid',()=>expect(reviewReady([item],new Set(),false,2026)).toBe(false));
 it('accepts verified dates',()=>expect(reviewReady([item],new Set(),true,2026)).toBe(true));
 it('rejects impossible dates and blank titles',()=>{
  expect(reviewReady([{...item,month:1,day:30}],new Set(),true,2026)).toBe(false);
  expect(reviewReady([{...item,title:' '}],new Set(),true,2026)).toBe(false);
 });
 it('does not activate rejected dates and permits a leap day only in a leap year',()=>{
  expect(reviewReady([{...item,day:35}],new Set(['exam']),true,2026)).toBe(true);
  expect(reviewReady([{...item,month:1,day:29,year:2028}],new Set(),true,2026)).toBe(true);
  expect(reviewReady([{...item,month:1,day:29}],new Set(),true,2026)).toBe(false);
 });
});
