"""Drives the furniture editor through the real UI and prints what happened. The site must be running.
Usage: python tests/editor.py [url] [out_dir] [--mobile]"""
import sys, json, math
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
url = args[0] if args else "http://localhost:3200/reconstruct/"
out = args[1] if len(args) > 1 else "/tmp/shots"
MOBILE = "--mobile" in sys.argv
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
S = "window.__studio.getState()"
RES = {}

def run(p):
    vw, vh = (390, 844) if MOBILE else (1440, 900)
    b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
    ctx = b.new_context(viewport={"width": vw, "height": vh}, has_touch=MOBILE, is_mobile=MOBILE)
    page = ctx.new_page(); errs = []
    page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    page.on("response", lambda r: errs.append(f"{r.status} {r.url}") if r.status >= 400 else None)
    def boot():
        page.wait_for_selector("canvas", timeout=60000)
        page.wait_for_function("!document.querySelector('main > [role=status]')", timeout=240000); page.wait_for_timeout(2500)
    page.goto(url); boot()
    get = lambda expr: page.evaluate(f"(() => {{ const s = {S}; const by = (k) => s.objects.find(o => o.id === 's-' + k); return {expr}; }})()")
    shot = lambda s: page.screenshot(path=f"{out}/{'m' if MOBILE else 'd'}-{s}.png")
    res = RES; res["view"] = "mobile" if MOBILE else "desktop"
    shot("1-orbit")
    close_panel = lambda: page.get_by_label("Close room panel").click() if MOBILE and page.locator("#room-panel").count() else None
    close_panel()
    page.get_by_role("radio", name="Plan").click(); page.wait_for_timeout(1500)
    cam_y = get(f"Math.max(s.room.width, s.room.depth) / 5.6 * {34 if vh > vw else 17}")
    ppm = (vh / 2) / (math.tan(math.radians(14)) * cam_y)
    px = lambda x, z: (vw / 2 + x * ppm, vh / 2 + z * ppm)
    cdp = ctx.new_cdp_session(page) if MOBILE else None
    def drag(x0, z0, x1, z1, steps=8):
        a, c = px(x0, z0), px(x1, z1)
        pts = [(a[0] + (c[0] - a[0]) * i / steps, a[1] + (c[1] - a[1]) * i / steps) for i in range(steps + 1)]
        if MOBILE:  # real touch events through the browser's input pipeline
            tp = lambda q: [{"x": q[0], "y": q[1], "id": 1}]
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": tp(pts[0])})
            for q in pts[1:]: cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": tp(q)}); page.wait_for_timeout(40)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        else:
            page.mouse.move(*pts[0]); page.mouse.down()
            for q in pts[1:]: page.mouse.move(*q)
            page.mouse.up()
        page.wait_for_timeout(450)
    r2 = lambda v: [round(n, 2) for n in v]
    insp = page.locator("aside[aria-label=Inspector]")
    def fold(want):  # phones only: fold the editing sheet away so the room can be touched
        btn = insp.get_by_role("button", name="Fold" if want else "Edit", exact=True)
        if MOBILE and btn.count(): btn.click(); page.wait_for_timeout(250)

    # 1. select and drag a floor piece
    arm = get("by('armchair')")
    drag(arm["x"], arm["z"], arm["x"] - 0.5, arm["z"] - 0.1)
    res["select"] = get("s.objects.find(o => o.id === s.selectedId)?.id")
    res["drag_armchair"] = {"from": r2([arm["x"], arm["z"]]), "to": r2(get("[by('armchair').x, by('armchair').z]")), "undo_steps": get("s.past.length")}
    fold(True)
    # 2. things on the desk travel with it
    before = get("['desk','desklamp','succulent','books'].map(k => [by(k).x, by(k).z])")
    drag(before[0][0] + 0.18, before[0][1] + 0.15, before[0][0] + 0.38, before[0][1] + 0.15)   # grab a clear patch of desk top
    after = get("['desk','desklamp','succulent','books'].map(k => [by(k).x, by(k).z])")
    res["children_follow"] = {"desk_moved": r2([after[0][0] - before[0][0], after[0][1] - before[0][1]]),
                              "children_moved": [r2([a[0] - b_[0], a[1] - b_[1]]) for a, b_ in zip(after[1:], before[1:])]}
    # 3. a piece cannot be dropped inside another: it goes back
    ch = get("by('chair')"); dr = get("by('dresser')")
    drag(ch["x"], ch["z"], dr["x"] - 0.05, dr["z"])
    res["collision"] = {"chair_back_at_start": r2(get("[by('chair').x, by('chair').z]")) == r2([ch["x"], ch["z"]]),
                        "message": page.locator("main > p[role=status]").inner_text() if page.locator("main > p[role=status]").count() else None}
    # 4. walls stop furniture
    fl = get("by('floorlamp')")
    drag(fl["x"], fl["z"], fl["x"] + 3.0, fl["z"] + 0.6)
    res["wall_stop"] = {"lamp_x": round(get("by('floorlamp').x"), 2), "room_half_width": get("s.room.width / 2")}
    page.wait_for_timeout(3500)
    # 5. turn with the handle on the selected piece (the armchair's handle sits in front of it)
    drag(arm["x"] - 0.5 + 0.02, arm["z"] - 0.1 + 0.02, arm["x"] - 0.5 + 0.03, arm["z"] - 0.1 + 0.03, 2)   # select the armchair again
    a = get("by('armchair')"); size_z = 0.843; reach = size_z / 2 + 0.28
    hx, hz = a["x"] + math.sin(a["rot"]) * reach, a["z"] + math.cos(a["rot"]) * reach
    drag(hx, hz, a["x"] + 1.0, a["z"] - 0.2)
    res["rotate_handle_deg"] = {"before": round(math.degrees(a["rot"])), "after": round(math.degrees(get("by('armchair').rot")))}
    shot("2-plan-selected")
    fold(False)
    res["inspector"] = insp.locator("h2").inner_text()
    # 6. materials: white fabric on the grey armchair
    insp.get_by_role("radio", name="White fabric").first.click(); page.wait_for_timeout(1800)
    res["recolour"] = get("by('armchair').colors")
    # 7. resize by typing, then an impossible size is refused
    insp.get_by_label("Width").fill("95"); page.wait_for_timeout(400)
    res["resize_width_m"] = round(get("by('armchair').scale[0] * 0.821"), 2)
    past = get("s.past.length"); insp.get_by_label("Width").fill("400"); page.wait_for_timeout(500)
    res["oversize_refused"] = {"no_new_step": get("s.past.length") == past, "message": page.locator("main > p[role=status]").inner_text() if page.locator("main > p[role=status]").count() else None}
    page.get_by_role("radio", name="Orbit").click(); page.wait_for_timeout(1500); shot("3-white-armchair")
    # 8. swap, duplicate, remove
    insp.get_by_role("button", name="Swap for Low-arm leather chair").click(); page.wait_for_timeout(1200)
    res["swap"] = get("by('armchair').item")
    n = get("s.objects.length"); insp.get_by_role("button", name="Duplicate").click(); page.wait_for_timeout(600)
    res["duplicate"] = [n, get("s.objects.length")]
    page.locator("aside[aria-label=Inspector]").get_by_role("button", name="Remove").click(); page.wait_for_timeout(300)
    # 9. add: a sofa finds a free spot; a lamp lands on the selected dresser
    page.get_by_role("button", name="Add furniture").click(); page.wait_for_timeout(300)
    page.get_by_role("tab", name="Seating").click(); page.wait_for_timeout(600); shot("4-catalogue")
    page.get_by_role("button", name="Storage bench").click(); page.wait_for_timeout(1500)
    res["added_bench"] = get("(o => ({item: o.item, at: [o.x, o.z]}))(s.objects[s.objects.length - 1])")
    page.evaluate(f"{S}.select('s-dresser')")
    page.get_by_role("tab", name="Lighting").click(); page.get_by_role("button", name="Faceted table lamp").click(); page.wait_for_timeout(1200)
    res["lamp_on_dresser"] = get("(o => ({parent: o.parent, y: +o.y.toFixed(2)}))(s.objects[s.objects.length - 1])")
    page.get_by_role("button", name="Close", exact=True).click()
    # 10. remove the dresser: what stood on it drops to the floor
    page.evaluate(f"{S}.select('s-dresser')"); page.locator("aside[aria-label=Inspector]").get_by_role("button", name="Remove").click(); page.wait_for_timeout(300)
    res["orphans_on_floor"] = get("s.objects.filter(o => ['s-vase2'].includes(o.id)).map(o => [o.parent, o.y])")
    # 11. room: colour, floor, a window moved
    if not page.locator("#room-panel").count(): page.get_by_role("button", name="Room", exact=True).click(); page.wait_for_timeout(300)
    page.get_by_role("radio", name="Pale sage").click(); page.get_by_role("radio", name="Herringbone").click()
    page.get_by_label("window wall").first.select_option("left"); page.wait_for_timeout(1200)
    res["room"] = get("[s.room.wallColor, s.room.floor, s.room.openings[0].wall]")
    close_panel(); page.wait_for_timeout(600); shot("5-restyled")
    # 12. save under a name, reload, reopen
    page.get_by_title("Save, rename or open a design").click(); page.get_by_label("Design name").fill("Test design")
    page.get_by_label("Save and open designs").get_by_role("button", name="Save", exact=True).click(); page.wait_for_timeout(400)
    snapshot = get("JSON.stringify([s.room, s.objects])")
    page.evaluate(f"{S}.openSample()"); page.reload(); boot()
    page.get_by_title("Save, rename or open a design").click(); page.wait_for_timeout(300)
    page.locator("li", has_text="Test design").get_by_role("button", name="Open").click(); page.wait_for_timeout(1500)
    res["save_reopen_identical"] = get("JSON.stringify([s.room, s.objects])") == snapshot
    # 13. before and after
    close_panel(); page.get_by_role("button", name="Before and after").click(); page.wait_for_timeout(6000)
    res["compare_canvases"] = page.locator("canvas").count(); shot("6-before-after")
    page.get_by_role("button", name="Before and after").click()
    # 14. undo back to the start of this design
    steps = get("s.past.length")
    res["undo_available_after_reopen"] = steps
    # 15. measure
    page.get_by_role("radio", name="Plan").click(); page.wait_for_timeout(1500)
    page.get_by_role("button", name="Measure", exact=True).click(); zf = get("s.room.depth / 2 - 0.1")
    tap = (lambda q: page.touchscreen.tap(*q)) if MOBILE else (lambda q: page.mouse.click(*q))
    tap(px(-0.5, zf)); page.wait_for_timeout(300); tap(px(0.5, zf)); page.wait_for_timeout(500)
    res["measure_1m_reads"] = insp.locator("p.figures").first.inner_text() if insp.locator("p.figures").count() else None
    page.get_by_role("button", name="Move", exact=True).click()
    page.get_by_role("radio", name="Walk").click(); page.wait_for_timeout(2500); shot("7-walk")
    res["errors"] = errs[:6]; print(json.dumps(res, indent=1)); b.close()

with sync_playwright() as p:
    try: run(p)
    except Exception as e:
        print("STOPPED:", str(e)[:300]); print(json.dumps(RES, indent=1)); sys.exit(1)
