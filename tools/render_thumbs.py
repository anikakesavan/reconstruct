"""Render a thumbnail for every catalogue piece from the app's own ?thumb=<id> view.
Usage: python tools/render_thumbs.py <site_url> [id ...]   (site must be running)"""
import io, json, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright

url = sys.argv[1].rstrip("/") + "/"
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "web")
ids = sys.argv[2:] or [i["id"] for i in json.load(open(os.path.join(WEB, "lib", "catalog.generated.json")))]
os.makedirs(os.path.join(WEB, "public", "thumbs"), exist_ok=True)
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"]
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=ARGS)
    page = b.new_context(viewport={"width": 420, "height": 420}).new_page()
    for n, i in enumerate(ids):
        with page.expect_response(lambda r: r.url.endswith(f"/models/{i}.glb"), timeout=60000): page.goto(f"{url}?thumb={i}")
        page.wait_for_selector("canvas"); page.wait_for_timeout(2600)
        img = Image.open(io.BytesIO(page.screenshot())).convert("RGB").resize((240, 240), Image.LANCZOS)
        img.save(os.path.join(WEB, "public", "thumbs", f"{i}.webp"), "WEBP", quality=84)
        print(n + 1, len(ids), i, flush=True)
    b.close()
