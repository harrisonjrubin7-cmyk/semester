const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const p=await b.newPage(); const errs=[]; p.on('requestfailed',r=>errs.push(r.url()));
await p.goto('file://'+process.argv[2],{waitUntil:'networkidle'}); await p.evaluate(()=>document.fonts.ready);
const broken=await p.evaluate(()=>[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src));
console.log('failed',errs.length,errs.slice(0,5),'broken imgs',broken.length);
await p.pdf({path:process.argv[3],format:'Letter',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,
 headerTemplate:'<div></div>',footerTemplate:'<div style="width:100%;font-size:7pt;color:#888;padding:0 0.65in;display:flex;justify-content:space-between;font-family:sans-serif"><span>Semester Design System — Complete reference</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'});
await b.close();})();
