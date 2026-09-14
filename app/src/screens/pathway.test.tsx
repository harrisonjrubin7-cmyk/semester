// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {EMPTY_PATHWAY,newProgram} from '../lib/pathway';
const view=vi.hoisted(()=>({id:'application-a'}));
vi.mock('../state/store',()=>({useStore:()=>({account:{id:'test-student'},dispatch:vi.fn()})}));
vi.mock('../lib/browser.hook',()=>({useStrip:()=>({tabs:[{id:view.id}],at:0})}));
import {Pathway} from './Pathway';
let host:HTMLDivElement;
let root:Root;
beforeEach(()=>{localStorage.clear();sessionStorage.clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();localStorage.clear();sessionStorage.clear();});

it('reopens the correct saved application editor independently in each app tab',async()=>{
 const scope='semester.pathway.v1:test-student';
 const first={...newProgram(),school:'Example A',program:'Biology'};
 const second={...newProgram(),school:'Example B',program:'Chemistry'};
 localStorage.setItem(scope,JSON.stringify({...EMPTY_PATHWAY,programs:[first,second]}));
 for(const [tab,id] of [['application-a',first.id],['application-b',second.id]]){
  sessionStorage.setItem(`semester.view.v1:${scope}:${tab}:tab`,'edit');
  sessionStorage.setItem(`semester.view.v1:${scope}:${tab}:programId`,id);
 }
 for(const [tab,school] of [['application-a','Example A'],['application-b','Example B'],['application-a','Example A']]){
  view.id=tab;
  await act(async()=>root.render(<Pathway/>));
  // The field is labelled `school` and capitalised in CSS, so match on the text itself.
  const input=Array.from(host.querySelectorAll('label')).find(label=>label.textContent?.trim().toLowerCase()==='school')?.querySelector('input');
  expect(input?.value).toBe(school);
 }
 expect(JSON.parse(localStorage.getItem(scope)!).programs).toHaveLength(2);
});
