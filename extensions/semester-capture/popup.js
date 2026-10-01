const field = id => document.getElementById(id);
let page;
(async()=>{
 const saved=await chrome.storage.local.get('semesterAddress');
 field('app').value=saved.semesterAddress||'https://harrisonjrubin7-cmyk.github.io/semester/';
 [page]=await chrome.tabs.query({active:true,currentWindow:true});
 field('title').value=page?.title||'';
 field('source').value=page?.url||'';
})();
field('selection').addEventListener('click',async()=>{
 try{const results=await chrome.scripting.executeScript({target:{tabId:page.id},func:()=>window.getSelection()?.toString()||''});field('context').value=(results[0]?.result||'').slice(0,6000);}catch{field('status').textContent='This page does not allow selected-text capture. You can paste context yourself.';}
});
field('capture').addEventListener('click',async()=>{
 try{
  const app=new URL(field('app').value);
  if(app.protocol!=='https:' && !(app.protocol==='http:'&&['localhost','127.0.0.1'].includes(app.hostname)))throw new Error('Use a secure Semester address.');
  if(app.username||app.password)throw new Error('Do not include credentials in the Semester address.');
  const source=field('source').value;if(!/^https?:\/\//i.test(source))throw new Error('Only public web page links can be captured.');
  const payload={title:field('title').value.slice(0,300),source:source.slice(0,2000),context:field('context').value.slice(0,6000)};
  app.hash='#pathway?'+new URLSearchParams({semesterCapture:JSON.stringify(payload)}).toString();
  await chrome.storage.local.set({semesterAddress:field('app').value});
  await chrome.tabs.create({url:app.href});
 }catch(e){field('status').textContent=e.message;}
});
