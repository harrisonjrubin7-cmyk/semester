const {chromium}=require('playwright');const fs=require('fs');
const [LIST,OUT,T]=process.argv.slice(2); const list=JSON.parse(fs.readFileSync(LIST,'utf8'));
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const ctx=await b.newContext();
await ctx.route(/unpkg\.com|jsdelivr\.net/,r=>{const u=r.request().url();const mm=u.match(/(?:unpkg\.com|npm)\/(@?[^@\/]+(?:\/[^@\/]+)?)@[^\/]+\/(.+)$/);const p=mm?T+'/node_modules/'+mm[1]+'/'+mm[2]:null;if(p&&fs.existsSync(p))return r.fulfill({body:fs.readFileSync(p),contentType:'text/javascript'});return r.abort();});
await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
for(const d of list){const p=await ctx.newPage();try{await p.goto(d.url,{waitUntil:'networkidle',timeout:45000});await p.waitForTimeout(1500);await p.evaluate(()=>document.fonts.ready);
await p.pdf({path:OUT+'/'+d.id+'.pdf',format:'Letter',printBackground:true,preferCSSPageSize:true});console.log('ok',d.id);}catch(e){console.log('fail',d.id,e.message.slice(0,100));}await p.close();}
await b.close();})();
