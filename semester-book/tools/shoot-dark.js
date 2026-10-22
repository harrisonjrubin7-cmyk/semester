const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const P=process.argv[2], T=process.argv[3], OUT=process.argv[4], BASE='http://127.0.0.1:8765';
const lib=n=>fs.readFileSync(T+'/node_modules/'+n);
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const ctx=await b.newContext({deviceScaleFactor:2});
await ctx.route(/unpkg\.com|jsdelivr\.net/,r=>{const u=r.request().url();
 const mm=u.match(/(?:unpkg\.com|npm)\/(@?[^@\/]+(?:\/[^@\/]+)?)@[^\/]+\/(.+)$/); const m=mm?mm[1]+'/'+mm[2]:null;
 if(!m) return r.abort(); r.fulfill({body:lib(m),contentType:'text/javascript'});});
await ctx.route(/\/__pre__\.html$/,()=>{});
const report=[];
const jobs=[];
for(const c of fs.readdirSync(P+'/components')){const f=`components/${c}/preview.html`;if(fs.existsSync(P+'/'+f))jobs.push({kind:'comp',name:c,f});}
for(const g of []) if(g.endsWith('.html')) jobs.push({kind:'guide',name:g.replace('.html',''),f:'guidelines/'+g});
for(const j of jobs){
 let h=fs.readFileSync(P+'/'+j.f,'utf8'); const first=h.split('\n')[0];
 let w=860; const vp=first.match(/viewport="(\d+)x(\d+)"/); const wm=first.match(/width=(\d+)/);
 if(vp) w=+vp[1]; if(wm) w=+wm[1]; if(j.name==='Cover') w=960;
 const meta={}; for(const k of ['group','subtitle','name']){const m=first.match(new RegExp(k+'="([^"]*)"'));if(m)meta[k]=m[1];}
 if(j.kind==='comp'){
  const pre=`<link rel="stylesheet" href="${BASE}/tokens.css"><link rel="stylesheet" href="${BASE}/components/bundle.css"><script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script><script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script><script src="${BASE}/components/bundle.js"></script>`;
  h=h.replace(/<head>/i,'<head>'+pre); h=h.replace(/<html([^>]*)>/i,'<html$1 data-theme="dark">');
  const tmp=`components/${j.name}/__shot.html`; fs.writeFileSync(P+'/'+tmp,h); j.url=`${BASE}/${tmp}`; j.tmp=P+'/'+tmp;
 } else j.url=`${BASE}/${j.f}`;
 const p=await ctx.newPage({viewport:{width:w,height:400}}); const errs=[];
 p.on('pageerror',e=>errs.push(e.message));
 try{await p.goto(j.url,{waitUntil:'networkidle',timeout:30000});}catch(e){errs.push('goto '+e.message);}
 await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(j.kind==='guide'?600:200);
 const hgt=await p.evaluate(()=>{let m=0;for(const e of document.body.querySelectorAll('*')){const r=e.getBoundingClientRect();if(r.width&&r.height)m=Math.max(m,r.bottom+window.scrollY);}const pb=parseFloat(getComputedStyle(document.body).paddingBottom)||0;return Math.ceil(m+Math.max(pb,16));});
 await p.setViewportSize({width:w,height:Math.min(Math.max(hgt,60),4000)});
 const file=`${j.kind}-${j.name}.png`; await p.screenshot({path:OUT+'/'+file,clip:{x:0,y:0,width:w,height:Math.min(Math.max(hgt,60),4000)}});
 report.push({...j,meta,file,w,h:hgt,errs}); if(j.tmp) fs.unlinkSync(j.tmp); await p.close();
 console.log(j.kind,j.name,w,hgt,errs.slice(0,1).join('').slice(0,120));
}
fs.writeFileSync(OUT+'/../shots-dark.json',JSON.stringify(report.map(({tmp,url,...r})=>r),null,1));
await b.close();})();
