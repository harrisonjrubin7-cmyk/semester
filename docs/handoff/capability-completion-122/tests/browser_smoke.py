import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  page=await b.new_page(viewport={"width":390,"height":844})
  errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
  await page.goto((Path(__file__).resolve().parents[1]/"workbench/semester-completion-workbench.html").as_uri())
  await page.wait_for_selector(".navitem")
  report=await page.evaluate("""()=>{let n=0,m=0;const overflow=[];for(const c of caps){select(c.id,false);if(document.querySelector('#detail h1').textContent!==c.area)throw Error(c.id);n++;for(const s of L.states){const f=document.querySelector('#regionState');f.value=s;f.dispatchEvent(new Event('change'));if(!document.querySelector('.state').textContent)throw Error(c.id);m++;}if(document.documentElement.scrollWidth>innerWidth)overflow.push(c.id);}return {capabilities:n,states:m,overflow};}""")
  report["page_errors"]=errors
  assert report["capabilities"]==122 and report["states"]==854 and not report["overflow"] and not errors
  print(json.dumps(report,indent=2));await b.close()
asyncio.run(main())
