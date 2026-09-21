// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {EMPTY_PATHWAY,newProgram} from '../lib/pathway';
const view=vi.hoisted(()=>({id:'grid-tab'}));
vi.mock('../state/store',()=>({useStore:()=>({account:{id:'test-student'},dispatch:vi.fn()})}));
vi.mock('../lib/browser.hook',()=>({useStrip:()=>({tabs:[{id:view.id}],at:0})}));
import {Pathway} from './Pathway';
let host:HTMLDivElement;
let root:Root;
const scope='semester.pathway.v1:test-student';
const press=async(label:string)=>{
 const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.trim()===label);
 expect(button,`no button called ${label}`).toBeTruthy();
 await act(async()=>button!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
};
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const a={...newProgram(),school:'Example A',program:'Biology',materials:[
  {id:'a1',title:'Transcript',status:'Ready locally' as const,due:''},
  {id:'a2',title:'Essay',status:'Preparing' as const,due:''},
 ]};
 const b={...newProgram(),school:'Example B',program:'Chemistry',materials:[
  {id:'b1',title:'essay',status:'Not started' as const,due:''},
 ]};
 localStorage.setItem(scope,JSON.stringify({...EMPTY_PATHWAY,programs:[a,b]}));
 sessionStorage.setItem(`semester.view.v1:${scope}:${view.id}:tab`,'programs');
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();sessionStorage.clear();});

it('shows the same saved programs as cards or as a grid, and the grid is a transpose of their materials',async()=>{
 await act(async()=>root.render(<Pathway/>));
 // The list is what the tab opens on, and it has no table in it.
 expect(host.querySelector('table')).toBeNull();

 await press('Grid');
 const table=host.querySelector('table');
 expect(table).toBeTruthy();
 // One column per distinct title, folded case-insensitively: "Essay" and
 // "essay" are one requirement typed twice.
 const headers=Array.from(table!.querySelectorAll('thead th')).map(th=>th.textContent?.trim());
 expect(headers).toEqual(['Program','Transcript','Essay']);

 const rows=Array.from(table!.querySelectorAll('tbody tr')).map(tr=>
  Array.from(tr.querySelectorAll('th,td')).map(c=>c.textContent?.trim()),
 );
 expect(rows).toEqual([
  ['Example A','Ready locally','Preparing'],
  // Blank, not "Not started": B has no transcript material at all.
  ['Example B','','Not started'],
 ]);

 // And back, with nothing about the shortlist changed by having looked at it.
 await press('List');
 expect(host.querySelector('table')).toBeNull();
 expect(JSON.parse(localStorage.getItem(scope)!).programs).toHaveLength(2);
});

it('says what an empty grid means rather than drawing a table with no columns',async()=>{
 localStorage.setItem(scope,JSON.stringify({...EMPTY_PATHWAY,programs:[{...newProgram(),school:'Example A',program:'Biology'}]}));
 await act(async()=>root.render(<Pathway/>));
 await press('Grid');
 expect(host.querySelector('table')).toBeNull();
 expect(host.textContent).toContain('Nothing to line up yet');
});
