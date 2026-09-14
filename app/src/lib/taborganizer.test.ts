import {describe,it,expect} from 'vitest';
import {readOrganizer,samePlace,GROUP_COLORS} from './taborganizer';
import type {AppTab} from './browser';
const known=(s:string)=>['home','course','write','search'].includes(s);
const tab:AppTab={id:'a',title:'Today',screen:'home',place:[{type:'go',screen:'home'}]};
describe('bookmarks and groups',()=>{
 it('restores names, colors and membership',()=>{const v=readOrganizer(JSON.stringify({groups:[{id:'g',name:'Academic',color:GROUP_COLORS[1],collapsed:true}],membership:{a:'g',b:'missing'},bookmarks:[tab]}),known);expect(v.groups[0].collapsed).toBe(true);expect(v.membership).toEqual({a:'g'});expect(samePlace(v.bookmarks[0],tab)).toBe(true);});
 it('does not restore mutation actions through a saved bookmark',()=>{const v=readOrganizer(JSON.stringify({bookmarks:[{...tab,place:[{type:'dropCourse',id:'course'},{type:'go',screen:'home'}]}]}),known);expect(v.bookmarks[0].place.every(a=>a.type==='go')).toBe(true);});
 it('recovers from malformed storage and removes unavailable screens',()=>{expect(readOrganizer('bad',known)).toEqual({groups:[],membership:{},bookmarks:[]});expect(readOrganizer(JSON.stringify({bookmarks:[{...tab,screen:'unknown'}]}),known).bookmarks).toEqual([]);});
 it('keeps a bookmarked new tab through restoration',()=>{const b={...tab,screen:null,place:[],title:'New tab'};expect(readOrganizer(JSON.stringify({bookmarks:[b]}),known).bookmarks).toHaveLength(1);});
 it('distinguishes two places within the same app',()=>{expect(samePlace(tab,{...tab,id:'different'})).toBe(true);expect(samePlace({...tab,screen:'write'},tab)).toBe(false);});
});
