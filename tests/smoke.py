"""Browser smoke test. Usage: python tests/smoke.py [base_url] [out_dir]
Drives the real UI with pointer events and saves screenshots. Prints what it observed; asserts little."""
import sys, json
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/shots"
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]

def run(p, name, viewport, touch):
    b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
    ctx = b.new_context(viewport=viewport, has_touch=touch, is_mobile=touch, device_scale_factor=1)
    page = ctx.new_page(); errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base); page.wait_for_selector("canvas", timeout=60000)
    page.wait_for_function("!document.querySelector('[role=status]')", timeout=120000)
    page.wait_for_timeout(2500)
    shot = lambda s: page.screenshot(path=f"{out}/{name}-{s}.png")
    shot("1-orbit")
    w, h = viewport["width"], viewport["height"]; cx, cy = w / 2, h / 2
    click = (lambda x, y: page.touchscreen.tap(x, y)) if touch else (lambda x, y: page.mouse.click(x, y))
    res = {"view": name}
    if touch and page.get_by_role("button", name="Hide details").count(): page.get_by_role("button", name="Hide details").first.click()
    # plan view + measure
    page.get_by_role("radio", name="Plan").click(); page.wait_for_timeout(1200)
    page.get_by_role("button", name="Measure").click()
    click(cx - 60, cy); page.wait_for_timeout(300); click(cx + 60, cy); page.wait_for_timeout(600)
    res["measure"] = page.locator("aside[aria-label=Inspector] p.figures").first.inner_text() if page.locator("aside[aria-label=Inspector] p.figures").count() else None
    shot("2-plan-measure")
    # inspect
    page.get_by_role("button", name="Inspect").click(); click(cx, cy + 40); page.wait_for_timeout(500)
    res["inspect"] = page.locator("aside[aria-label=Inspector]").inner_text().replace("\n", " | ")
    # block out + drag
    page.get_by_role("button", name="Block out").click(); page.wait_for_timeout(300)
    page.get_by_role("menuitem", name="Desk").click(); page.wait_for_timeout(600)
    res["volume_panel"] = page.locator("aside[aria-label=Inspector] h2").inner_text()
    if not touch:
        page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 40, cy + 30, steps=6); page.mouse.move(cx + 900, cy + 30, steps=10); page.mouse.up()
        page.wait_for_timeout(400)
        res["volumes_after_drag"] = page.evaluate("null")
    shot("3-plan-volume")
    page.get_by_role("radio", name="Orbit").click(); page.wait_for_timeout(1200); shot("4-orbit-volume")
    page.get_by_role("radio", name="Walk").click(); page.wait_for_timeout(800)
    if not touch:
        page.keyboard.down("KeyW"); page.wait_for_timeout(700); page.keyboard.up("KeyW")
        page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 220, cy + 10, steps=8); page.mouse.up()
    else:
        page.get_by_role("button", name="Walk forward").dispatch_event("pointerdown", {"pointerId": 1}); page.wait_for_timeout(700)
        page.get_by_role("button", name="Walk forward").dispatch_event("pointerup", {"pointerId": 1})
    page.wait_for_timeout(800); shot("5-walk")
    st = page.locator("p.figures.pointer-events-none")
    res["status"] = st.inner_text() if st.count() and st.is_visible() else None
    res["errors"] = errors[:5]
    print(json.dumps(res, indent=1)); b.close()

with sync_playwright() as p:
    run(p, "desktop", {"width": 1440, "height": 900}, False)
    run(p, "mobile", {"width": 390, "height": 844}, True)
