"""End-to-end scan test: upload through the UI, wait for the reconstruction, then edit what it found.
Needs the site and the reconstruction service running.
Usage: python tests/upload.py <dir-of-photos-or-a-video> [url] [out_dir]"""
import sys, json, glob, os, time
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
src = args[0]; url = args[1] if len(args) > 1 else "http://localhost:3200/reconstruct/"; out = args[2] if len(args) > 2 else "/tmp/shots"
files = sorted(glob.glob(os.path.join(src, "*"))) if os.path.isdir(src) else [src]
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
S = "window.__studio.getState()"

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
    page = b.new_context(viewport={"width": 1440, "height": 900}).new_page(); errs = []
    page.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    page.goto(url); page.wait_for_selector("canvas", timeout=60000); page.wait_for_timeout(6000)
    get = lambda expr: page.evaluate(f"(() => {{ const s = {S}; return {expr}; }})()")
    shot = lambda s: page.screenshot(path=f"{out}/scan-{s}.png")
    res = {"files": len(files)}
    page.get_by_role("button", name="Scan your room").click(); dlg = page.locator("[role=dialog][aria-modal=true]"); dlg.wait_for(); page.wait_for_timeout(600); shot("1-dialog")
    dlg.locator("input[type=file]").set_input_files(files); dlg.get_by_label("Name").fill("Test bedroom")
    t = time.time(); dlg.get_by_role("button", name="Rebuild my room").click()
    page.wait_for_selector("[role=dialog][aria-modal=true] ol", timeout=60000); page.wait_for_timeout(4000); shot("2-working")
    dlg.wait_for(state="detached", timeout=900000); res["seconds_to_open"] = round(time.time() - t)
    page.wait_for_timeout(9000)
    res["room"] = get("[s.room.width, s.room.depth, s.room.height, s.room.origin, s.room.wallColor, s.room.floor, s.room.openings.length]")
    res["found"] = get("s.objects.map(o => [o.detected.label, o.item, o.detected.confidence, o.detected.views])")
    res["quality"] = get("s.scanResult.quality.level"); res["skipped"] = get("s.scanResult.skipped.length")
    shot("3-editable-room")
    page.get_by_label("Overlay the raw scan").check(); page.wait_for_timeout(5000); shot("4-overlay")
    page.get_by_label("Overlay the raw scan").uncheck()
    # select a found piece from the list, move it, recolour it, put it back
    page.locator("#room-panel").get_by_role("button", name="Bed as").click(); page.wait_for_timeout(500)
    bed = get("s.objects.find(o => o.id === s.selectedId)")
    res["selected"] = bed["detected"]["label"]
    page.evaluate(f"(() => {{ const s = {S}; s.beginDrag(); s.dragTo(s.selectedId, {bed['x']} + 0.15, {bed['z']} + 0.3); s.endDrag(); }})()"); page.wait_for_timeout(400)
    insp = page.locator("aside[aria-label=Inspector]")
    insp.get_by_role("radio", name="Navy fabric").first.click(); page.wait_for_timeout(1500)
    moved = get("s.objects.find(o => o.id === s.selectedId)")
    res["moved_and_recoloured"] = {"dx": round(moved["x"] - bed["x"], 2), "dz": round(moved["z"] - bed["z"], 2), "colors": moved["colors"]}
    shot("5-edited")
    insp.get_by_role("button", name="Put back as it was found").click(); page.wait_for_timeout(500)
    back = get("s.objects.find(o => o.id === s.selectedId)")
    res["put_back"] = [round(back["x"] - bed["x"], 3), round(back["z"] - bed["z"], 3), back["colors"] == bed["colors"]]
    # delete a found piece, add a new one, save, reload, reopen
    insp.get_by_role("button", name="Remove").click(); n = get("s.objects.length")
    page.get_by_role("button", name="Add furniture").click(); page.get_by_role("button", name="Low platform bed").click(); page.wait_for_timeout(1500)
    page.get_by_role("button", name="Close", exact=True).click()
    res["after_remove_and_add"] = [n, get("s.objects.length")]
    page.get_by_title("Save, rename or open a design").click(); page.get_by_label("Design name").fill("Scanned test")
    page.get_by_label("Save and open designs").get_by_role("button", name="Save", exact=True).click(); page.wait_for_timeout(400)
    snap = get("JSON.stringify([s.room, s.objects])")
    page.reload(); page.wait_for_selector("canvas"); page.wait_for_timeout(6000)
    res["autosave_survives_reload"] = get("JSON.stringify([s.room, s.objects])") == snap
    page.get_by_role("button", name="Before and after").click(); page.wait_for_timeout(6000); shot("6-before-after")
    res["errors"] = errs[:5]; print(json.dumps(res, indent=1)); b.close()
