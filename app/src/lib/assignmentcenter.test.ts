import { describe,it,expect } from 'vitest';
import { assignmentProgress,inAssignmentView,workloadByDay } from './assignmentcenter';
import type { DatedItem,PersonalTask } from './types';
const item={id:'paper',isPast:false,isToday:true,daysAway:0,date:new Date(2026,8,13),month:8,day:13,dueShort:'Today'} as DatedItem;
describe('assignment center',()=>{
 it('keeps completed work out of due and in-progress views, even after the deadline',()=>{
  const past={...item,isPast:true,daysAway:-1};
  expect(inAssignmentView(past,'overdue',{paper:true},{paper:123},{})).toBe(false);
  expect(inAssignmentView(past,'working',{paper:true},{paper:123},{})).toBe(false);
  expect(inAssignmentView(past,'completed',{paper:true},{},{})).toBe(true);
 });
 it('uses a half-open seven-day range and preserves recorded zero grades',()=>{
  expect(inAssignmentView({...item,daysAway:6},'week',{},{},{})).toBe(true);
  expect(inAssignmentView({...item,daysAway:7},'week',{},{},{})).toBe(false);
  expect(inAssignmentView(item,'graded',{},{},{paper:'0'})).toBe(true);
 });
 it('counts only linked checklist steps without declaring a submission',()=>{
  const tasks=[{from:'paper',done:true},{from:'paper',done:false},{from:'other',done:true}] as PersonalTask[];
  expect(assignmentProgress('paper',tasks,false)).toMatchObject({checked:1,percent:50});
  expect(assignmentProgress('unknown',tasks,false).percent).toBeNull();
 });
 it('does not invent durations for untimed work or include completed items in workload',()=>{
  const days=workloadByDay([item,{...item,id:'reading'},{...item,id:'done'}],{done:true},new Map([['paper',60]]));
  expect(days).toHaveLength(1);expect(days[0]).toMatchObject({minutes:60,unknown:1});expect(days[0].items).toHaveLength(2);
 });
});
