"""End-to-end upload test. Needs the web app and the reconstruction service running.
Usage: python tests/upload.py <dir-with-room-photos-or-a-video> [base_url] [out_dir]"""
import sys, json, glob, os, time
from playwright.sync_api import sync_playwright

src = sys.argv[1]
base = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:3100"
out = sys.argv[3] if len(sys.argv) > 3 else "/tmp/shots"
files = sorted(glob.glob(os.path.join(src, "*"))) if os.path.isdir(src) else [src]
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]

def run(p, name, viewport, touch):
    b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
    page = b.new_context(viewport=viewport, has_touch=touch, is_mobile=touch).new_page(); errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base); page.wait_for_selector("canvas", timeout=60000)
    page.wait_for_function("!document.querySelector('main > div [role=status]')", timeout=120000)
    res = {"view": name, "files": len(files)}
    page.get_by_role("button", name="Scan").first.click(); page.wait_for_selector("[role=dialog]")
    page.wait_for_timeout(800); page.screenshot(path=f"{out}/{name}-u1-dialog.png")
    page.locator("[role=dialog] input[type=file]").set_input_files(files)
    page.get_by_label("Name").fill("Test bedroom"); page.wait_for_timeout(300)
    page.screenshot(path=f"{out}/{name}-u2-picked.png")
    t = time.time(); page.get_by_role("button", name="Build 3D room").click()
    page.wait_for_selector("[role=dialog] ol", timeout=60000); page.wait_for_timeout(6000)
    page.screenshot(path=f"{out}/{name}-u3-working.png")
    page.wait_for_selector("[role=dialog]", state="detached", timeout=600000)
    res["seconds_to_open"] = round(time.time() - t)
    page.wait_for_function("!document.querySelector('main > div [role=status]')", timeout=120000); page.wait_for_timeout(3000)
    if touch and page.get_by_role("button", name="Hide details").count(): page.get_by_role("button", name="Hide details").click()
    page.screenshot(path=f"{out}/{name}-u4-room.png")
    sheet = page.locator("#room-sheet")
    if not sheet.count(): page.get_by_role("button", name="Room details").click(); page.wait_for_timeout(400)
    res["sheet_before"] = page.locator("#room-sheet dl").inner_text().replace("\n", " ")
    if touch: page.get_by_role("button", name="Hide details").click()
    # measure in plan view, then calibrate that line to exactly 1.000 m
    page.get_by_role("radio", name="Plan").click(); page.wait_for_timeout(1200)
    page.get_by_role("button", name="Measure").click()
    cx, cy = viewport["width"] / 2, viewport["height"] / 2
    tap = (lambda x, y: page.touchscreen.tap(x, y)) if touch else (lambda x, y: page.mouse.click(x, y))
    # the scan has holes, so walk a grid of candidate lines until both ends land on a surface
    for dy in (0, 60, -60, 120, -120, 180, -180):
        for dx in (-120, 0, 120):
            tap(cx + dx - 40, cy + dy); page.wait_for_timeout(250); tap(cx + dx + 40, cy + dy); page.wait_for_timeout(350)
            if page.get_by_label("True length").count(): break
            page.keyboard.press("Escape")
        if page.get_by_label("True length").count(): break
    insp = page.locator("aside[aria-label=Inspector]")
    res["measured_before"] = insp.locator("p.figures").first.inner_text()
    page.get_by_label("True length").fill("1"); page.get_by_role("button", name="Set scale").click(); page.wait_for_timeout(800)
    if not page.locator("#room-sheet").count(): page.get_by_role("button", name="Room details").click(); page.wait_for_timeout(400)
    res["sheet_after"] = page.locator("#room-sheet dl").inner_text().replace("\n", " ")
    page.screenshot(path=f"{out}/{name}-u5-calibrated.png")
    page.get_by_role("radio", name="Walk").click(); page.wait_for_timeout(1500)
    if page.locator("#room-sheet").count(): page.get_by_role("button", name="Hide details").click()
    page.wait_for_timeout(800); page.screenshot(path=f"{out}/{name}-u6-walk.png")
    res["errors"] = errors[:5]; print(json.dumps(res, indent=1)); b.close()

with sync_playwright() as p:
    run(p, "desktop", {"width": 1440, "height": 900}, False)
    if "--mobile" in sys.argv: run(p, "mobile", {"width": 390, "height": 844}, True)
