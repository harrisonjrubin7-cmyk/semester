import {describe,it,expect} from 'vitest';
import {parseDirectory,directoryTemplate} from './campusdirectory';
describe('campus directories',()=>{
 it('imports school supplied profiles for housing, dining and clubs',()=>{for(const kind of ['housing','dining','clubs'] as const){const source=directoryTemplate(kind);const d=parseDirectory(JSON.stringify(source));expect(d.items[0].name).toBe(source.items[0].name);expect(Object.keys(d.items[0].details).length).toBe(4);}});
 it('rejects unsafe URLs, duplicate entries and missing names',()=>{const source=directoryTemplate('clubs'),item=source.items[0];for(const url of ['javascript:alert(1)','data:text/html,test','https://user:secret@example.com','/relative'])expect(()=>parseDirectory(JSON.stringify({...source,items:[{...item,url}]}))).toThrow();expect(()=>parseDirectory(JSON.stringify({...source,items:[item,item]}))).toThrow(/Duplicate/);expect(()=>parseDirectory(JSON.stringify({...source,items:[{...item,name:''}]}))).toThrow();});
 it('allows an empty directory without inventing listings',()=>{expect(parseDirectory('{"institution":"Test School","items":[]}').items).toEqual([]);});
});
