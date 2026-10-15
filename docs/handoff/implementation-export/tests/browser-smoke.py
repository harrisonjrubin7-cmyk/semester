import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  page=await browser.new_page(viewport={"width":390,"height":844})
  errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
  await page.goto((Path(__file__).resolve().parents[1]/"public-site/standalone-preview.html").as_uri())
  await page.wait_for_selector("#content h1")
  report=await page.evaluate("""()=>{let pages=0,states=0;const overflow=[];for(const s of D.routes){routePage(s);if(document.querySelector('#content h1').textContent!==s.title)throw Error(s.route);pages++;for(const k of C.states){const sel=document.querySelector('#region');sel.value=k;sel.dispatchEvent(new Event('change'));if(!document.querySelector('.state').textContent)throw Error(k);states++;}if(document.documentElement.scrollWidth>innerWidth)overflow.push(s.route);}return {pages,states,overflow};}""")
  report['errors']=errors
  assert report['pages']==44 and report['states']==308 and not report['overflow'] and not errors
  print(json.dumps(report,indent=2));await browser.close()
asyncio.run(main())
