import asyncio, pathlib
from playwright.async_api import async_playwright
PAGE = (pathlib.Path(__file__).resolve().parent.parent / "living-room.html").as_uri() + "?qa=1"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page(viewport={"width": 1280, "height": 720})
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(PAGE)
        await page.wait_for_function("window.__spyder && window.__spyder.ready", timeout=60000)
        r = await page.evaluate("""() => {
          __spyder.setup('dirty');
          const before = __spyder.state;
          __spyder.clearRoom();
          __spyder.step(0.1);
          const during = __spyder.state;
          __spyder.step(6);
          const after = __spyder.state;
          const card = document.querySelector('[data-card=results]').classList.contains('is-open');
          return { before, during, after, card };
        }""")
        print(r, "errors:", errs)
        await b.close()
asyncio.run(main())
