"""End-to-end scan test: upload through the UI, wait for the scan, calibrate, make a clean room from it.
Needs the site and the reconstruction service running.
Usage: python tests/upload.py <dir-of-photos-or-a-video> [url] [out_dir] [--mobile]"""
import sys, json, glob, os, time
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
src = args[0]; url = args[1] if len(args) > 1 else "http://localhost:3200/reconstruct/"; out = args[2] if len(args) > 2 else "/tmp/shots"
files = sorted(glob.glob(os.path.join(src, "*"))) if os.path.isdir(src) else [src]
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
S = "window.__studio.getState()"

def run(p, name, vw, vh, touch):
    b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
    page = b.new_context(viewport={"width": vw, "height": vh}, has_touch=touch, is_mobile=touch).new_page(); errs = []
    page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    page.goto(url); page.wait_for_selector("canvas", timeout=60000)
    page.wait_for_function("!document.querySelector('main > [role=status]')", timeout=180000); page.wait_for_timeout(2000)
    get = lambda expr: page.evaluate(f"(() => {{ const s = {S}; return {expr}; }})()")
    shot = lambda s: page.screenshot(path=f"{out}/{name}-{s}.png")
    res = {"view": name, "files": len(files)}
    page.get_by_role("button", name="Scan").first.click(); page.wait_for_selector("[role=dialog][aria-modal=true]"); page.wait_for_timeout(800)
    shot("s1-dialog")
    dlg = page.locator("[role=dialog][aria-modal=true]")
    dlg.locator("input[type=file]").set_input_files(files); dlg.get_by_label("Name").fill("Test bedroom"); page.wait_for_timeout(300)
    t = time.time(); dlg.get_by_role("button", name="Build 3D scan").click()
    page.wait_for_selector("[role=dialog][aria-modal=true] ol", timeout=60000); page.wait_for_timeout(5000); shot("s2-working")
    page.wait_for_selector("[role=dialog][aria-modal=true]", state="detached", timeout=900000)
    res["seconds_to_open"] = round(time.time() - t)
    page.wait_for_function(f"{S}.scanMeta !== null", timeout=60000)
    page.wait_for_function("!document.querySelector('main > [role=status]')", timeout=180000); page.wait_for_timeout(4000)
    res["quality"] = get("s.scanMeta.quality")
    res["panel"] = page.locator("#room-panel dl").inner_text().replace("\n", " ")
    res["furniture_hidden_with_raw_scan"] = get("!s.showRoom")
    res["add_furniture_disabled"] = page.get_by_role("button", name="Add furniture").is_disabled()
    shot("s3-scan")
    if touch: page.get_by_label("Close room panel").click()
    # measure on the scan in plan view, then calibrate that line to 1.000 m
    page.get_by_role("radio", name="Plan").click(); page.wait_for_timeout(1500)
    page.get_by_role("button", name="Measure", exact=True).click()
    cx, cy = vw / 2, vh / 2
    tap = (lambda x, y: page.touchscreen.tap(x, y)) if touch else (lambda x, y: page.mouse.click(x, y))
    for dy in (0, 60, -60, 120, -120, 180, -180):
        for dx in (-120, 0, 120):
            tap(cx + dx - 40, cy + dy); page.wait_for_timeout(250); tap(cx + dx + 40, cy + dy); page.wait_for_timeout(350)
            if page.get_by_label("True length").count(): break
            page.keyboard.press("Escape"); page.get_by_role("button", name="Measure", exact=True).click()
        if page.get_by_label("True length").count(): break
    before = get("s.scanMeta.envelope.width_m * s.calibration")
    page.get_by_label("True length").fill("1"); page.get_by_role("button", name="Set scale").click(); page.wait_for_timeout(600)
    res["calibration"] = {"width_before": round(before, 2), "width_after": round(get("s.scanMeta.envelope.width_m * s.calibration"), 2), "factor": round(get("s.calibration"), 3)}
    page.evaluate(f"{S}.calibrate(1 / {S}.calibration)")  # put the model's own scale back for the next step
    page.get_by_role("button", name="Move", exact=True).click()
    if not page.locator("#room-panel").count(): page.get_by_role("button", name="Room", exact=True).click(); page.wait_for_timeout(300)
    page.get_by_role("button", name="Make a clean room this size").click(); page.wait_for_timeout(1500)
    res["clean_room"] = get("[s.room.width, s.room.depth, s.room.height, s.room.origin, s.objects.length]")
    if touch: page.get_by_label("Close room panel").click()
    page.get_by_role("radio", name="Orbit").click(); page.wait_for_timeout(600)
    page.get_by_role("button", name="Add furniture").click(); page.wait_for_timeout(300)
    page.get_by_role("button", name="Platform bed, double").click(); page.wait_for_timeout(2500)
    page.get_by_role("button", name="Close", exact=True).click()
    res["furnished"] = get("s.objects.map(o => o.item)")
    page.wait_for_timeout(1500); shot("s4-clean-room-with-scan-guide")
    res["errors"] = errs[:5]; print(json.dumps(res, indent=1)); b.close()

with sync_playwright() as p:
    if "--mobile" in sys.argv: run(p, "mobile", 390, 844, True)
    else: run(p, "desktop", 1440, 900, False)
