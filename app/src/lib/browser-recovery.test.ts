// @vitest-environment jsdom
import {beforeEach,expect,it} from 'vitest';
import {MAX_TABS,dump,load,placeFor,type Where} from './browser';
import {forgetStrip,strip,here,openTab,openInNew,closeTab,reopenClosed,lastClosed,record,recordSearch,pickTab} from './browser.hook';

beforeEach(()=>{localStorage.clear();forgetStrip();});
it('restores a closed document with its identity, destination, search and original position',()=>{
  record('home','Today',[{type:'go',screen:'home'}]);
  openInNew('write','My paper',[{type:'openDocument',id:'paper'}],'research');
  const document=here();
  openInNew('calendar','Calendar',[{type:'go',screen:'calendar'}]);
  const calendar=here();
  closeTab(1);expect(here()).toEqual(calendar);expect(lastClosed()).toEqual(document);
  expect(reopenClosed()).toEqual(document);expect(strip().at).toBe(1);
  expect(strip().tabs[2]).toEqual(calendar);expect(lastClosed()).toBeUndefined();
});
it('never replaces a tab when creation or search opening reaches the limit',()=>{
  while(strip().tabs.length<MAX_TABS)openTab();
  recordSearch('keep this search');const before=strip();
  expect(openTab()).toBe(false);
  expect(openInNew('calendar','Calendar',[{type:'go',screen:'calendar'}],'new search')).toBe(false);
  expect(strip()).toBe(before);expect(here().query).toBe('keep this search');
});
it('retains a pending closed tab when reopening is blocked by a full bar',()=>{
  record('home','Today',[{type:'go',screen:'home'}]);const first=here();
  openTab();closeTab(0);
  while(strip().tabs.length<MAX_TABS)openTab();
  expect(reopenClosed()).toBeNull();expect(lastClosed()).toEqual(first);
  closeTab(strip().at);const last=lastClosed();
  expect(reopenClosed()).toEqual(last);expect(lastClosed()).toEqual(first);
});
it('recovers the last closed tab even after closing the only tab',()=>{
  record('courses','Courses',[{type:'go',screen:'courses'}]);const course=here();
  closeTab(0);expect(here().screen).toBeNull();expect(reopenClosed()).toEqual(course);
  expect(strip().tabs).toHaveLength(2);expect(new Set(strip().tabs.map(t=>t.id)).size).toBe(2);
  expect(reopenClosed()).toBeNull();
});
it('ignores invalid closes and leaves reopening history unchanged',()=>{
  openTab();closeTab(0);const last=lastClosed();closeTab(99);
  expect(lastClosed()).toEqual(last);
});
it('clears only session recovery history when the strip is reloaded',()=>{
  openTab();closeTab(0);forgetStrip();expect(lastClosed()).toBeUndefined();expect(reopenClosed()).toBeNull();expect(strip().tabs).toHaveLength(1);
});
it('normalizes fractional or non-finite selection indexes without breaking the active tab',()=>{
  openTab();pickTab(0.8);expect(strip().at).toBe(0);pickTab(Number.NaN);expect(strip().at).toBe(0);
  const saved=JSON.parse(dump(strip()));saved.at=0.8;
  expect(load(JSON.stringify(saved),()=>true).at).toBe(0);
});
it('does not load duplicate identities as duplicate workspace tabs',()=>{
  openTab();const saved=strip();
  expect(load(JSON.stringify({...saved,tabs:[...saved.tabs,saved.tabs[0]]}),()=>true).tabs).toHaveLength(2);
});
const where:Where={courseId:'econ',guideId:'econ',itemId:'x',eventId:'',noteId:'',documentId:null,sheetId:null,deckId:null,mode:'cards',openUnit:3,callCode:'study-room'};
it('restores the specific study unit and mode across serialization',()=>{
  const place=placeFor('guide',where);expect(place).toEqual([{type:'openGuide',id:'econ',mode:'cards',unit:3}]);
  openInNew('guide','Study guide',place);
  expect(load(dump(strip()),()=>true).tabs[1].place).toEqual(place);
  expect(placeFor('quiz',where)).toEqual([...place,{type:'go',screen:'quiz'}]);
});
it('restores a call room without starting a different room',()=>{
  const place=placeFor('call',where);expect(place).toEqual([{type:'openCall',code:'study-room'}]);
  openInNew('call','Call',place);expect(load(dump(strip()),()=>true).tabs[1].place).toEqual(place);
  expect(placeFor('call',{...where,callCode:''})).toEqual([{type:'go',screen:'call'}]);
});
