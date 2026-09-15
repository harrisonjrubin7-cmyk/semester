import {describe,it,expect} from 'vitest';
import {parseCatalog,conflicts,CATALOG_TEMPLATE} from './registration';
const row=CATALOG_TEMPLATE.courses[0];
const load=(courses:unknown[])=>parseCatalog(JSON.stringify({institution:'Test school',courses}));
describe('institution course catalog',()=>{
 it('imports JSON with multiple meetings and preserves unknown seats',()=>{const c=load([{...row,meetings:[...row.meetings,{days:[2],start:'13:00',end:'14:30'}]}]).courses[0];expect(c.meetings[0].start).toBe(540);expect(c.meetings[1].end).toBe(870);expect(c.seats).toBeNull();});
 it('reads CSV quoted values and day lists',()=>{const c=parseCatalog('code,section,title,term,credits,seats,days,start,end\nTEST 101,1,"Words, numbers",Fall 2026,3,,"1,3",09:00,10:00').courses[0];expect(c.title).toBe('Words, numbers');expect(c.meetings[0].days).toEqual([1,3]);expect(c.seats).toBeNull();});
 it('rejects incomplete, duplicate, invalid time and invalid seat data atomically',()=>{for(const patch of [{credits:''},{credits:-1},{title:''},{seats:-2},{meetings:[{days:[8],start:'09:00',end:'10:00'}]},{meetings:[{days:[1],start:'9am',end:'10:00'}]},{meetings:[{days:[1],start:'11:00',end:'10:00'}]}])expect(()=>load([{...row,...patch}])).toThrow();expect(()=>load([row,row])).toThrow(/Duplicate/);});
 it('only reports overlaps in the same term on shared days; touching boundaries are fine',()=>{const a={...row,id:'a'}, b={...row,id:'b',code:'TEST 202',meetings:[{days:[3],start:'09:30',end:'10:30'}]},c={...b,id:'c',term:'Spring 2027'};const result=conflicts(load([a,b,c]).courses);expect(result).toHaveLength(1);expect(result[0].days).toEqual([3]);expect(conflicts(load([a,{...b,meetings:[{days:[1],start:'09:50',end:'10:30'}]}]).courses)).toEqual([]);});
 it('says what is wrong with a file that starts like JSON and is not',()=>{expect(()=>parseCatalog('{"institution":"School","courses":[,]}')).toThrow(/not valid JSON/);expect(()=>parseCatalog('{"institution":"School"')).toThrow(/Export it again/);});
});
