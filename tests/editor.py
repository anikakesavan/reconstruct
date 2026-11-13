"""Drives the furniture editor through the real UI and prints what happened.
Usage: python tests/editor.py [url] [out_dir] [--mobile]"""
import sys, json, math
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "http://localhost:3200/reconstruct/"
out = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else "/tmp/shots"
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
S = "window.__studio.getState()"

def run(p, name, vw, vh, touch):
    b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
    page = b.new_context(viewport={"width": vw, "height": vh}, has_touch=touch, is_mobile=touch).new_page(); errs = []
    page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    page.on("response", lambda r: errs.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    page.goto(url); page.wait_for_selector("canvas", timeout=60000)
    page.wait_for_function("!document.querySelector('[role=status]')", timeout=180000); page.wait_for_timeout(4000)
    shot = lambda s: page.screenshot(path=f"{out}/{name}-{s}.png")
    get = lambda expr: page.evaluate(f"(() => {{ const s = {S}; return {expr}; }})()")
    res = {"view": name}
    shot("e1-orbit")
    if touch and page.locator("#room-panel").count(): page.get_by_label("Close room panel").click()
    page.get_by_role("radio", name="Plan").click(); page.wait_for_timeout(1500)
    # plan view: straight down, so world metres map linearly to pixels
    cam_y = page.evaluate(f"(() => {{ const s = {S}; return Math.max(s.room.width, s.room.depth) / 5.6 * ({34 if vh > vw else 17}); }})()")
    ppm = (vh / 2) / (math.tan(math.radians(14)) * cam_y)
    px = lambda x, z: (vw / 2 + x * ppm, vh / 2 + z * ppm)
    bed = get("s.objects.find(o => o.item === 'bed_double')")
    x0, y0 = px(bed["x"], bed["z"])
    if touch:
        page.touchscreen.tap(x0, y0); page.wait_for_timeout(500)
        res["selected_by_tap"] = get("s.objects.find(o => o.id === s.selectedId)?.item")
    else:
        page.mouse.move(x0, y0); page.mouse.down(); page.mouse.move(x0 + 20, y0 + 10, steps=4)
        x1, y1 = px(bed["x"] + 0.6, bed["z"] - 0.3); page.mouse.move(x1, y1, steps=8); page.mouse.up(); page.wait_for_timeout(400)
        after = get("s.objects.find(o => o.item === 'bed_double')")
        res["selected_by_click"] = get("s.objects.find(o => o.id === s.selectedId)?.item")
        res["drag"] = {"from": [bed["x"], bed["z"]], "to": [round(after["x"], 2), round(after["z"], 2)], "undo_steps": get("s.past.length")}
        # drag far past the wall: must stop at the wall
        page.mouse.move(x1, y1); page.mouse.down(); page.mouse.move(x1 - 30, y1, steps=3); page.mouse.move(40, y1, steps=8); page.mouse.up(); page.wait_for_timeout(300)
        res["wall_stop_x"] = round(get("s.objects.find(o => o.item === 'bed_double').x"), 2)
        res["room_half_width"] = get("s.room.width / 2")
    insp = page.locator("aside[aria-label=Inspector]")
    res["inspector_title"] = insp.locator("h2").inner_text()
    insp.get_by_role("button", name="Turn left 15 degrees").click()
    insp.get_by_role("radio", name="Sage").click()
    insp.get_by_role("radio", name="Black oak").click(); page.wait_for_timeout(600)
    b2 = get("s.objects.find(o => o.item === 'bed_double')")
    res["after_edit"] = {"rot_deg": round(math.degrees(b2["rot"])), "tint": b2["tint"], "finish": b2["finish"]}
    shot("e2-plan-edited")
    insp.get_by_role("button", name="Platform bed, queen").click(); page.wait_for_timeout(500)
    res["replaced_with"] = get("s.objects.find(o => o.id === s.selectedId)?.item")
    n = get("s.objects.length")
    insp.get_by_role("button", name="Duplicate").click(); page.wait_for_timeout(300)
    res["duplicate"] = [n, get("s.objects.length")]
    page.locator("aside[aria-label=Inspector]").get_by_role("button", name="Remove").click(); page.wait_for_timeout(300)
    res["remove"] = get("s.objects.length")
    # add from the catalogue
    page.get_by_role("button", name="Add furniture").click(); page.wait_for_timeout(400)
    page.get_by_role("tab", name="Plants").click(); shot("e3-catalog")
    page.get_by_role("button", name="Leafy plant").click(); page.wait_for_timeout(1500)
    res["added"] = get("s.objects[s.objects.length - 1].item"); res["count_after_add"] = get("s.objects.length")
    # undo everything back to the sample, redo one
    steps = get("s.past.length")
    for _ in range(steps): page.get_by_role("button", name="Undo").click()
    page.wait_for_timeout(300)
    res["undo_all"] = {"steps": steps, "bed_back_at": get("(o => [o.x, o.z, o.item])(s.objects.find(o => o.item.startsWith('bed')))"), "count": get("s.objects.length")}
    page.get_by_role("button", name="Redo").click(); res["redo_available_after"] = get("s.future.length")
    for _ in range(3): page.get_by_role("button", name="Undo").click() if get("s.past.length") else None
    # room: wall colour, floor, size
    if not page.locator("#room-panel").count(): page.get_by_role("button", name="Room", exact=True).click(); page.wait_for_timeout(300)
    page.get_by_role("radio", name="Pale sage").click(); page.get_by_role("radio", name="Herringbone").click(); page.wait_for_timeout(1200)
    res["room"] = get("[s.room.wallColor, s.room.floor]")
    if touch: page.get_by_label("Close room panel").click()
    page.get_by_role("radio", name="Orbit").click(); page.wait_for_timeout(1500); shot("e4-restyled")
    # measure wall to wall along the floor in plan view
    page.get_by_role("radio", name="Plan").click(); page.wait_for_timeout(1200)
    page.get_by_role("button", name="Measure", exact=True).click(); page.wait_for_timeout(300); res["tool_after_measure_click"] = get("s.tool")
    tap = (lambda x, y: page.touchscreen.tap(x, y)) if touch else (lambda x, y: page.mouse.click(x, y))
    zf = get("s.room.depth / 2 - 0.12")
    a = px(-1.0, zf); c = px(1.0, zf); tap(*a); page.wait_for_timeout(300); tap(*c); page.wait_for_timeout(500)
    res["measure_2m_reads"] = insp.locator("p.figures").first.inner_text() if insp.locator("p.figures").count() else None
    page.get_by_role("button", name="Move", exact=True).click()
    page.get_by_role("radio", name="Walk").click(); page.wait_for_timeout(2000); shot("e5-walk")
    page.reload(); page.wait_for_selector("canvas"); page.wait_for_function("!document.querySelector('[role=status]')", timeout=180000)
    res["saved_after_reload"] = page.evaluate(f"(() => {{ const s = {S}; return [s.room.wallColor, s.room.floor]; }})()")
    res["errors"] = errs[:6]
    print(json.dumps(res, indent=1)); b.close()

with sync_playwright() as p:
    if "--mobile" in sys.argv: run(p, "mobile", 390, 844, True)
    else: run(p, "desktop", 1440, 900, False)
