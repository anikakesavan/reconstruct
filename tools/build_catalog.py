"""Build the furniture catalogue.

For every model this measures its real size, finds the height of its main top surface (so lamps can sit on it),
and splits its colour texture into up to three "parts" (for example upholstery, frame, metal) so each part can be
recoloured on its own without touching the others.

Inputs : <raw_dir>/<id>.glb or <raw_dir>/<id>/<id>.gltf  full-resolution originals, used for analysis
         <opt_dir>/<id>.glb                              web-optimised copies (gltf-transform), shipped as they are
Outputs: apps/web/public/models/<id>.glb, <id>.mask.png, apps/web/lib/catalog.generated.json

Usage: python tools/build_catalog.py <abo_raw> <abo_opt> <polyhaven_raw> <polyhaven_opt>
Sources and licences: ASSETS.md.
"""
import json, os, shutil, sys
import cv2, numpy as np, trimesh
from PIL import Image

ABO_RAW, ABO_OPT, PH_RAW, PH_OPT = sys.argv[1:5]
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "web")
OUT = os.path.join(WEB, "public", "models")

def A(name, cls, cat, place="floor", yaw=0, scale=1.0): return dict(name=name, cls=cls, category=cat, place=place, yaw=yaw, scale=scale, source="abo")
def P(name, cls, cat, place="floor", yaw=0, scale=1.0): return dict(name=name, cls=cls, category=cat, place=place, yaw=yaw, scale=scale, source="polyhaven")

ITEMS = {
  # beds
  "B075X2LMTC": A("Arched fabric bed", "bed", "Beds"), "B075QFCHM9": A("Low platform bed", "bed", "Beds"),
  "B07B4SCPH1": A("Upholstered bed, brass legs", "bed", "Beds"), "B07B4VY16J": A("Tufted bed", "bed", "Beds"),
  "B071FJR3T4": A("Pine panel bed", "bed", "Beds"),
  # tables
  "B07QD6TXWS": A("Two-drawer nightstand", "nightstand", "Tables"), "B07RPZSM4W": A("Open nightstand", "nightstand", "Tables"),
  "B072ZMHBKQ": A("Lacquer side table", "nightstand", "Tables"), "B0728KSP33": A("Louvered nightstand", "nightstand", "Tables"),
  "B07HSCN9RM": A("Mid-century desk", "desk", "Tables"), "B08C2NYN5Y": A("Simple writing desk", "desk", "Tables"),
  "B07GFT7H76": A("Four-drawer desk", "desk", "Tables"), "B07QC6354F": A("Hairpin desk", "desk", "Tables"),
  "coffee_table_round_01": P("Round coffee table", "table", "Tables"),
  # seating
  "B075YMXWZM": A("Walnut chair", "chair", "Seating"), "B085559VGM": A("Shell chair", "chair", "Seating"),
  "B00IIFW2L4": A("Mesh office chair", "chair", "Seating"), "B0853KR33B": A("Upholstered chair", "chair", "Seating"),
  "B07B7DMMTH": A("Soft office chair", "chair", "Seating"),
  "B072PZVYC2": A("Leather accent chair", "armchair", "Seating"), "B071J7Q9WN": A("Steel-arm leather chair", "armchair", "Seating"),
  "B071W5VJFK": A("Tufted armchair", "armchair", "Seating"), "B075X4F3R5": A("Low-arm leather chair", "armchair", "Seating"),
  "B07DBDV64G": A("Rolled-arm armchair", "armchair", "Seating"),
  "modern_arm_chair_01": P("Wood-frame lounge chair", "armchair", "Seating"),
  "B07G2HBKB4": A("Three-seat sofa", "sofa", "Seating"), "B07J2JGT7Y": A("Leather sofa", "sofa", "Seating"),
  "B07J2JGXD7": A("Tufted sofa", "sofa", "Seating"), "B07P5LM42Y": A("Mid-century sofa", "sofa", "Seating"),
  "B07J2VY54Z": A("Ottoman", "ottoman", "Seating"), "B0871DCNRM": A("Storage bench", "ottoman", "Seating"),
  "B07B4DB65T": A("Round tufted pouf", "ottoman", "Seating"),
  # storage
  "B07GFL6W68": A("Six-drawer chest", "dresser", "Storage"), "B071FJR479": A("Oak dresser", "dresser", "Storage"),
  "B07HSL4TS1": A("Three-drawer chest", "dresser", "Storage"), "B075X2PC3L": A("Two-tone dresser", "dresser", "Storage"),
  "B075YZPG5Y": A("Seven-drawer dresser", "dresser", "Storage"),
  "B079TYF1GK": A("Two-door wardrobe", "wardrobe", "Storage"), "B07H8V7P3H": A("Oak and white wardrobe", "wardrobe", "Storage"),
  "B07H8JN9QF": A("Mirrored wardrobe", "wardrobe", "Storage"), "B07GFS1R5B": A("Three-door wardrobe", "wardrobe", "Storage"),
  "B07QF9X1LH": A("White bookcase", "bookcase", "Storage"), "B07HSCNKCT": A("Mixed bookcase", "bookcase", "Storage"),
  "B07QTB45S5": A("Tall open bookcase", "bookcase", "Storage"), "B07QW1L8H6": A("Zigzag bookcase", "bookcase", "Storage"),
  "wooden_display_shelves_01": P("Cube shelves", "bookcase", "Storage", yaw=-90), "modern_wooden_cabinet": P("Sideboard", "dresser", "Storage"),
  "wicker_basket_02": P("Wicker basket", "basket", "Storage", scale=1.9),
  # lighting
  "B07DTLF7DN": A("Globe floor lamp", "floor_lamp", "Lighting"), "B073P36T7M": A("Arc floor lamp", "floor_lamp", "Lighting"),
  "B07374K536": A("Task floor lamp", "floor_lamp", "Lighting"),
  "B075X2LKNZ": A("Ceramic table lamp", "table_lamp", "Lighting", "surface"), "B07HKFXCNC": A("Faceted table lamp", "table_lamp", "Lighting", "surface"),
  "B0825CP3NS": A("Blond-wood table lamp", "table_lamp", "Lighting", "surface"), "B07MBFDHM9": A("Textured table lamp", "table_lamp", "Lighting", "surface"),
  "desk_lamp_arm_01": P("Arm desk lamp", "table_lamp", "Lighting", "surface"),
  # mirrors and decor
  "B084HTZ2C6": A("Round mirror with shelf", "mirror", "Decor", "wall"), "B084HV5LK3": A("Oval mirror", "mirror", "Decor", "wall"),
  "B07RNMNGYF": A("Black-frame mirror", "mirror", "Decor", "wall"), "B0718ZKL8B": A("Full-length mirror", "mirror", "Decor", "wall"),
  "B07BMQ657W": A("Striped pillow", "pillow", "Decor", "surface"), "B07JKJSTYT": A("Textured pillow", "pillow", "Decor", "surface"),
  "B07JL5PT1J": A("Patterned pillow", "pillow", "Decor", "surface"),
  "B07HSJKY8H": A("Planter on stand", "planter", "Decor"), "B075HR7LHQ": A("Stoneware pot", "planter", "Decor", "surface"),
  "B07QB8L7YC": A("Chevron planter", "planter", "Decor", "surface"),
  "ceramic_vase_01": P("Round vase", "vase", "Decor", "surface"), "ceramic_vase_03": P("Tall vase", "vase", "Decor", "surface"),
  "book_encyclopedia_set_01": P("Row of books", "books", "Decor", "surface"),
  # plants
  "potted_plant_01": P("Tall plant", "plant", "Plants"), "potted_plant_02": P("Leafy plant", "plant", "Plants"),
  "potted_plant_04": P("Small succulent", "plant", "Plants", "surface"),
  # rugs
  "B07B4SDLJM": A("Jute rug, large", "rug", "Rugs", "rug"), "B0719STM26": A("Round braided rug", "rug", "Rugs", "rug"),
  "B07HSHPHW2": A("Grey wool rug", "rug", "Rugs", "rug"), "B07121ZWNC": A("Wave rug", "rug", "Rugs", "rug"),
  "B075Z8GZ45": A("Chevron rug", "rug", "Rugs", "rug"),
}
# furniture you can put things on
SUPPORTS = {"nightstand", "desk", "dresser", "table", "bookcase", "ottoman", "bed"}


def load(item_id, src):
    path = os.path.join(ABO_RAW, item_id + ".glb") if src == "abo" else os.path.join(PH_RAW, item_id, item_id + ".gltf")
    return trimesh.load(path, process=False)


def geometry(scene, yaw_deg, scale):
    mesh = scene.to_geometry() if hasattr(scene, "to_geometry") else scene.dump(concatenate=True)
    c, s = np.cos(np.radians(yaw_deg)), np.sin(np.radians(yaw_deg))
    V = mesh.vertices @ np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]]).T * scale
    lo, hi = V.min(0), V.max(0)
    size = (hi - lo)
    # main top surface: the height holding the most upward-facing area, in the upper two thirds
    m = trimesh.Trimesh(V, mesh.faces, process=False)
    up = m.face_normals[:, 1] > 0.9
    tc = m.triangles_center[:, 1] - lo[1]
    ok = up & (tc > size[1] * 0.3)
    surface = float(size[1])
    if ok.any():
        hist, edges = np.histogram(tc[ok], bins=60, weights=m.area_faces[ok])
        surface = float((edges[np.argmax(hist)] + edges[np.argmax(hist) + 1]) / 2)
    return [round(float(x), 3) for x in size], round(surface, 3)


def lab(rgb):
    return cv2.cvtColor(rgb.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)


def parts(scene, item_id, cls):
    """Cluster the main colour texture into up to three recolourable parts. Returns (parts, material_name) or ([], None)."""
    geoms = list(scene.geometry.values()) if hasattr(scene, "geometry") else [scene]
    best = None
    for g in geoms:
        mat = getattr(g.visual, "material", None)
        tex = getattr(mat, "baseColorTexture", None)
        uv = getattr(g.visual, "uv", None)
        if tex is None or uv is None: continue
        if best is None or g.area > best[0].area: best = (g, mat, tex, uv)
    if best is None: return [], None
    g, mat, tex, uv = best
    N = 512
    img = np.asarray(tex.convert("RGB").resize((N, N), Image.BILINEAR))
    # texels actually used by the surface
    used = np.zeros((N, N), np.uint8)
    for gg in geoms:
        if getattr(getattr(gg.visual, "material", None), "baseColorTexture", None) is not tex or gg.visual.uv is None: continue
        t = gg.visual.uv[gg.faces] % 1.0
        pts = np.stack([t[..., 0] * (N - 1), (1 - t[..., 1]) * (N - 1)], -1).round().astype(np.int32)
        cv2.fillPoly(used, list(pts[:: max(1, len(pts) // 60000)]), 1)
    used = cv2.dilate(used, np.ones((3, 3), np.uint8)).astype(bool)
    if used.sum() < 500: used[:] = True
    px = img[used]
    sample = px[np.random.default_rng(0).choice(len(px), min(len(px), 30000), replace=False)]
    L = lab(sample)
    _, labels, centres = cv2.kmeans(L, 3, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.5), 4, cv2.KMEANS_PP_CENTERS)
    # merge clusters that look alike, drop slivers
    centres = list(centres); frac = [float((labels == i).mean()) for i in range(3)]
    keep = [i for i in np.argsort(frac)[::-1] if frac[i] > 0.06]
    merged = []
    for i in keep:
        if all(np.linalg.norm(centres[i] - centres[j]) > 16 for j in merged): merged.append(i)
    C = np.stack([centres[i] for i in merged])
    full = lab(img.reshape(-1, 3))
    assign = np.argmin(((full[:, None, :] - C[None]) ** 2).sum(-1), 1).reshape(N, N).astype(np.uint8)
    metal_tex = getattr(mat, "metallicRoughnessTexture", None)
    metal = np.asarray(metal_tex.convert("RGB").resize((N, N)))[..., 2] / 255.0 if metal_tex is not None else np.zeros((N, N))
    out = []
    lin = (img / 255.0) ** 2.2
    lum = lin @ [0.2126, 0.7152, 0.0722]
    for k in range(len(C)):
        m = (assign == k) & used
        if m.sum() < 50: m = assign == k
        mean = img[m].mean(0)
        hsv = cv2.cvtColor(np.uint8([[mean]]), cv2.COLOR_RGB2HSV)[0, 0]
        is_metal = float(metal[m].mean()) > 0.5
        woody = 8 <= hsv[0] <= 24 and 50 <= hsv[1] <= 190 and hsv[2] < 215
        soft = cls in ("bed", "sofa", "armchair", "chair", "ottoman", "pillow", "rug")
        kind = "metal" if is_metal else "wood" if woody and not (soft and k == 0) else "fabric" if soft else "wood" if woody else "paint"
        out.append({"kind": kind, "color": "#%02x%02x%02x" % tuple(int(round(v)) for v in mean),
                    "share": round(float(m.sum() / max(1, used.sum())), 3), "lum": round(float(lum[m].mean()), 4)})
    cv2.imwrite(os.path.join(OUT, item_id + ".mask.png"), assign * 100)  # 0, 100, 200 = part index
    return out, getattr(mat, "name", None)


os.makedirs(OUT, exist_ok=True)
catalog = []
for item_id, d in ITEMS.items():
    scene = load(item_id, d["source"])
    size, surface = geometry(scene, d["yaw"], d["scale"])
    p, mat_name = parts(scene, item_id, d["cls"])
    shutil.copy(os.path.join(ABO_OPT if d["source"] == "abo" else PH_OPT, item_id + ".glb"), os.path.join(OUT, item_id + ".glb"))
    entry = {"id": item_id, "name": d["name"], "cls": d["cls"], "category": d["category"], "place": d["place"], "yaw": d["yaw"], "scale": d["scale"],
             "size": size, "source": d["source"], "parts": p, "partsMaterial": mat_name}
    if d["cls"] in SUPPORTS: entry["surface"] = surface
    catalog.append(entry)
    print(item_id.ljust(28), d["cls"].ljust(11), size, "surface", surface if d["cls"] in SUPPORTS else "-", [(x["kind"], x["color"], x["share"]) for x in p])
json.dump(catalog, open(os.path.join(WEB, "lib", "catalog.generated.json"), "w"), indent=1)
print(len(catalog), "items")
