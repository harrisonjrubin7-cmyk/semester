const {chromium}=require('playwright');const fs=require('fs');
const list=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage();
for(const it of list){ await p.goto('file://'+it.html,{waitUntil:'load',timeout:120000}); await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;})));});
 const broken=await p.evaluate(()=>[...document.images].filter(i=>!i.naturalWidth).length);
 await p.pdf({path:it.pdf,format:'Letter',printBackground:true,preferCSSPageSize:true}); console.log(it.pdf.split('/').pop(),broken?('BROKEN '+broken):'');}
await b.close();})();
