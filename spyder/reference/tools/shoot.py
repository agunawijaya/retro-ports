"""Render the reference scene in headless Chromium and save QA screenshots."""
import asyncio, sys, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "screens-new")
STATES = sys.argv[2].split(",") if len(sys.argv) > 2 else ["title", "dirty", "action", "makeover", "clean", "results"]

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        await page.goto((ROOT / "living-room.html").as_uri() + "?qa=1")
        await page.wait_for_function("window.__spyder && window.__spyder.ready", timeout=60000)
        await page.evaluate("document.fonts.ready")
        for name in STATES:
            await page.evaluate(f"window.__spyder.setup('{name}')")
            await page.wait_for_timeout(700)
            await page.screenshot(path=str(OUT / f"{name}.png"))
            print("saved", name)
        print("errors:", errors[:10])
        await browser.close()

asyncio.run(main())
