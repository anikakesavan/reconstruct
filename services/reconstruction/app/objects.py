"""Find furniture, windows and doors in the views and place them in the room.

Method: a panoptic segmentation model (OneFormer, MIT licence, trained on ADE20K, whose classes are indoor scenes) labels every
pixel of every view. Each labelled region is lifted to 3D with the depth and camera pose already computed for that
view, regions of the same kind that overlap in 3D are merged across views, and a gravity-aligned box is fitted to each.

Everything reported carries a confidence, and anything that cannot be placed sensibly is listed as skipped rather
than guessed. Sizes are lower bounds when an object was only partly seen.
"""
from __future__ import annotations
import os
import cv2
import numpy as np

SEG_MODEL = os.environ.get("RECONSTRUCT_SEGMENT_MODEL", "shi-labs/oneformer_ade20k_swin_tiny")
_seg = {}

# ADE20K name (first synonym) -> label reported to the app
FURNITURE = {
    "bed": "bed", "desk": "desk", "table": "table", "coffee table": "coffee table", "chair": "chair", "armchair": "armchair",
    "swivel chair": "swivel chair", "sofa": "sofa", "wardrobe": "wardrobe", "chest of drawers": "chest of drawers",
    "cabinet": "cabinet", "bookcase": "bookcase", "shelf": "shelf", "lamp": "lamp", "mirror": "mirror", "rug": "rug",
    "ottoman": "ottoman", "stool": "stool", "plant": "plant",
}
MERGE_GROUP = {"armchair": "seat", "chair": "seat", "swivel chair": "seat", "desk": "table", "table": "table", "coffee table": "table",
               "chest of drawers": "case", "cabinet": "case", "wardrobe": "case", "bookcase": "shelf", "shelf": "shelf"}
OPENINGS = {"windowpane": "window", "window": "window", "door": "door"}
# plausible size ranges (width, height, depth) in metres: [min], [max]
LIMITS = {
    "bed": ([0.9, 0.4, 1.9], [2.2, 1.6, 2.4]), "desk": ([0.7, 0.55, 0.4], [2.0, 1.0, 1.0]), "table": ([0.4, 0.3, 0.4], [2.2, 1.0, 1.4]),
    "coffee table": ([0.4, 0.25, 0.4], [1.6, 0.6, 1.2]), "chair": ([0.35, 0.6, 0.35], [0.8, 1.3, 0.8]), "armchair": ([0.55, 0.6, 0.55], [1.2, 1.2, 1.2]),
    "swivel chair": ([0.45, 0.7, 0.45], [0.8, 1.3, 0.8]), "sofa": ([1.2, 0.6, 0.7], [2.8, 1.1, 1.2]), "wardrobe": ([0.6, 1.4, 0.4], [2.6, 2.4, 0.8]),
    "chest of drawers": ([0.4, 0.4, 0.3], [1.9, 1.5, 0.7]), "cabinet": ([0.4, 0.4, 0.3], [2.2, 2.2, 0.8]), "bookcase": ([0.4, 0.8, 0.2], [2.2, 2.3, 0.6]),
    "shelf": ([0.4, 0.3, 0.15], [2.2, 2.3, 0.6]), "lamp": ([0.12, 0.25, 0.12], [0.7, 2.0, 0.7]), "mirror": ([0.2, 0.3, 0.02], [1.5, 2.1, 0.15]),
    "rug": ([0.6, 0.01, 0.5], [3.5, 0.05, 3.0]), "ottoman": ([0.3, 0.25, 0.3], [1.2, 0.6, 1.2]), "stool": ([0.25, 0.3, 0.25], [0.6, 0.9, 0.6]),
    "plant": ([0.15, 0.2, 0.15], [1.0, 2.0, 1.0]),
}
BACK_TO_WALL = {"bed", "desk", "sofa", "wardrobe", "chest of drawers", "cabinet", "bookcase", "shelf", "armchair", "mirror", "table"}


def _load():
    if "m" not in _seg:
        import torch
        from transformers import OneFormerForUniversalSegmentation, OneFormerProcessor
        _seg["p"] = OneFormerProcessor.from_pretrained(SEG_MODEL)
        _seg["m"] = OneFormerForUniversalSegmentation.from_pretrained(SEG_MODEL).eval()
        _seg["torch"] = torch
    return _seg["p"], _seg["m"], _seg["torch"]


def _segment(image):
    """image: (H,W,3) uint8. Returns (id map (H,W) int, [{id, name, score}])."""
    proc, model, torch = _load()
    with torch.inference_mode():
        out = model(**proc(images=image, task_inputs=["panoptic"], return_tensors="pt"))
    res = proc.post_process_panoptic_segmentation(out, target_sizes=[image.shape[:2]], label_ids_to_fuse=set())[0]
    names = model.config.id2label
    info = [{"id": s["id"], "name": names[s["label_id"]].split(",")[0].strip().lower(), "score": float(s["score"])} for s in res["segments_info"]]
    return res["segmentation"].numpy(), info


def _lift(depth, mask, K, c2w, to_room, limit=5000, rng=np.random.default_rng(0)):
    vs, us = np.nonzero(mask)
    if len(vs) > limit:
        pick = rng.choice(len(vs), limit, replace=False); vs, us = vs[pick], us[pick]
    z = depth[vs, us]
    cam = np.stack([(us - K[0, 2]) / K[0, 0] * z, (vs - K[1, 2]) / K[1, 1] * z, z, np.ones_like(z)], 1)
    return (cam @ (to_room @ c2w).T)[:, :3], vs, us


def _srgb_median(pixels, q=50):
    m = np.percentile(pixels.reshape(-1, 3), q, axis=0)
    return "#%02x%02x%02x" % tuple(int(v) for v in m)


def _box(points, label, half_w, half_d):
    """Gravity-aligned box around an object's points. Returns dict or None."""
    P = points[(points[:, 1] > -0.1)]
    if len(P) < 150:
        return None
    lo, hi = np.percentile(P, 3, axis=0), np.percentile(P, 97, axis=0)
    P = P[np.all((P >= lo - 0.02) & (P <= hi + 0.02), axis=1)]
    xz = P[:, [0, 2]].astype(np.float32)
    (cx, cz), (e1, e2), ang = cv2.minAreaRect(xz)
    ang = np.radians(ang)
    # furniture nearly always sits square to the walls: snap when the fitted box is within 20 degrees of that
    off = (ang + np.pi / 4) % (np.pi / 2) - np.pi / 4
    snapped = abs(off) < np.radians(20)
    if snapped:
        ang = 0.0
        ex, ez = np.ptp(np.percentile(xz[:, 0], [2, 98])), np.ptp(np.percentile(xz[:, 1], [2, 98]))
        cx, cz = np.mean(np.percentile(xz[:, 0], [2, 98])), np.mean(np.percentile(xz[:, 1], [2, 98]))
    else:
        ex, ez = e1, e2  # extents along the box's own axes, rotated by `ang` from X
    top = float(np.percentile(P[:, 1], 98)); base = float(np.percentile(P[:, 1], 2))
    standing = label not in ("mirror", "lamp") or base < 0.25
    # where the tall part is (a headboard, a chair back), relative to the centre: real evidence for which way it faces
    tall = P[P[:, 1] > base + 0.72 * (top - base)]
    high = (np.median(tall[:, [0, 2]], axis=0) - np.array([cx, cz])) if len(tall) >= 40 else None
    return {"cx": float(cx), "cz": float(cz), "ex": float(ex), "ez": float(ez), "ang": float(ang), "snapped": bool(snapped),
            "base": 0.0 if standing else base, "height": top if standing else top - base, "high": high}


def _orient(b, label, half_w, half_d, tables):
    """Decide which way the object faces. Returns (rot for the app, width, depth, note)."""
    c, s = np.cos(b["ang"]), np.sin(b["ang"])
    axes = [np.array([c, s]), np.array([-s, c])]          # box axis 1 (extent ex) and axis 2 (extent ez), in (x, z)
    centre = np.array([b["cx"], b["cz"]])
    def wall_gap(direction):  # free distance from the object's side to the wall in that direction
        ext = b["ex"] / 2 if abs(direction @ axes[0]) > 0.7 else b["ez"] / 2
        t = np.inf
        for axis, half in ((0, half_w), (1, half_d)):
            if abs(direction[axis]) > 1e-6:
                t = min(t, ((half if direction[axis] > 0 else -half) - centre[axis]) / direction[axis])
        return t - ext
    cands = [axes[0], -axes[0], axes[1], -axes[1]]
    note = None
    if label == "bed":
        if b["high"] is not None and np.linalg.norm(b["high"]) > 0.15:
            # the headboard is the tall end, even when only part of the bed's length was seen
            head = max(cands, key=lambda d: d @ b["high"]); note = "headboard side taken from its tall end"
        else:
            long_axis = axes[0] if b["ex"] >= b["ez"] else axes[1]
            head = min((long_axis, -long_axis), key=wall_gap)   # otherwise the headboard goes to the nearer wall
        front = -head
    elif label in ("chair", "swivel chair", "stool") and tables:
        t = min(tables, key=lambda p: np.linalg.norm(p - centre))
        if np.linalg.norm(t - centre) < 1.3:
            v = t - centre; front = max(cands, key=lambda d: d @ v); note = "turned toward the nearest table"
        else:
            front = -min(cands, key=wall_gap)
    elif label in BACK_TO_WALL:
        # back to the nearest wall; prefer the long side along the wall
        back = min(cands, key=lambda d: wall_gap(d) + (0.25 if (abs(d @ axes[0]) > 0.7) == (b["ex"] >= b["ez"]) else 0))
        front = -back
    else:
        front = -min(cands, key=wall_gap)
    depth_is_ex = abs(front @ axes[0]) > 0.7
    width, depth = (b["ez"], b["ex"]) if depth_is_ex else (b["ex"], b["ez"])
    return float(np.arctan2(front[0], front[1])), float(width), float(depth), note


def detect(images, depth, valid, K, w2c, to_room, envelope, progress=lambda f: None):
    """images (n,H,W,3) uint8; depth (n,H,W) metres; valid (n,H,W) bool; K (n,3,3); w2c (n,4,4) metric.
    Returns dict with room extras, objects, skipped."""
    n = len(images)
    half_w, half_d = envelope["width_m"] / 2, envelope["depth_m"] / 2
    inst, stuff, open_pts = [], {"wall": [], "floor": [], "ceiling": []}, []
    for i in range(n):
        seg, info = _segment(images[i])
        c2w = np.linalg.inv(w2c[i])
        for s in info:
            m = (seg == s["id"]) & valid[i]
            if s["name"] in stuff:
                if m.sum() > 500:
                    pts, vs, us = _lift(depth[i], m, K[i], c2w, to_room, 1500)
                    stuff[s["name"]].append((images[i][vs, us], pts))
                continue
            if m.sum() < 350 or s["score"] < 0.5:
                continue
            pts, vs, us = _lift(depth[i], m, K[i], c2w, to_room)
            rec = {"name": s["name"], "score": s["score"], "view": i, "pts": pts, "rgb": images[i][vs, us]}
            if s["name"] in OPENINGS: open_pts.append(rec)
            else: inst.append(rec)
        progress((i + 1) / n)

    # --- merge the same object seen in several views
    clusters = []
    for r in sorted(inst, key=lambda r: -len(r["pts"])):
        label = FURNITURE.get(r["name"])
        group = MERGE_GROUP.get(label, label) if label else r["name"]
        c = np.median(r["pts"], axis=0); lo, hi = np.percentile(r["pts"], 5, axis=0), np.percentile(r["pts"], 95, axis=0)
        home = None
        for cl in clusters:
            if cl["group"] != group: continue
            inter = np.clip(np.minimum(hi, cl["hi"]) - np.maximum(lo, cl["lo"]), 0, None)[[0, 2]].prod()
            smaller = min((hi - lo)[[0, 2]].prod(), (cl["hi"] - cl["lo"])[[0, 2]].prod()) + 1e-6
            if inter / smaller > 0.3 or np.linalg.norm((c - cl["c"])[[0, 2]]) < 0.35: home = cl; break
        if home is None:
            clusters.append({"group": group, "name": r["name"], "label": label, "parts": [r], "c": c, "lo": lo, "hi": hi})
        else:
            home["parts"].append(r)
            allp = np.concatenate([p["pts"] for p in home["parts"]])
            home["c"] = np.median(allp, axis=0); home["lo"], home["hi"] = np.percentile(allp, 5, axis=0), np.percentile(allp, 95, axis=0)

    objects, skipped = [], []
    boxes = []
    for cl in clusters:
        views = len({p["view"] for p in cl["parts"]})
        if cl["label"] is None:
            skipped.append({"label": cl["name"], "reason": "not a kind of furniture the catalogue has"}); continue
        # the label with the most evidence wins when views disagree (chair vs armchair)
        votes = {}
        for p in cl["parts"]: votes[FURNITURE[p["name"]]] = votes.get(FURNITURE[p["name"]], 0) + p["score"] * len(p["pts"])
        label = max(votes, key=votes.get)
        pts = np.concatenate([p["pts"] for p in cl["parts"]])
        b = _box(pts, label, half_w, half_d)
        if b is None:
            skipped.append({"label": label, "reason": "too little of it was visible to place"}); continue
        boxes.append((cl, label, b, views, pts))
    tables = [np.array([b["cx"], b["cz"]]) for _, label, b, _, _ in boxes if label in ("desk", "table")]
    for cl, label, b, views, pts in boxes:
        rot, width, depth, note = _orient(b, label, half_w, half_d, tables)
        if not b["snapped"]:
            rot = float(rot)  # free angle kept
        size = np.array([width, b["height"], depth]); lo, hi = map(np.array, LIMITS[label])
        clamped = np.clip(size, lo, hi)
        off = float(np.max(np.abs(np.log(np.maximum(size, 1e-3) / clamped))))
        if off > 0.9:
            skipped.append({"label": label, "reason": f"its measured size ({size[0]:.1f} x {size[2]:.1f} m, {size[1]:.1f} m high) is not believable for a {label}"}); continue
        if label == "lamp": label = "floor lamp" if (b["base"] < 0.3 and b["height"] > 1.05) else "lamp"
        if label == "table" and max(clamped[0], clamped[2]) < 0.75: label = "side table"
        score = float(np.mean([p["score"] for p in cl["parts"]]))
        conf = score * {1: 0.6, 2: 0.8}.get(views, 1.0) * (1.0 if off < 0.05 else 0.8 if off < 0.4 else 0.6)
        rgb = np.concatenate([p["rgb"] for p in cl["parts"]])
        objects.append({"label": label, "confidence": round(conf, 2), "views": views,
                        "x": round(b["cx"], 3), "z": round(b["cz"], 3), "y": round(b["base"], 3), "rot": round(rot, 4),
                        "size": [round(float(v), 3) for v in clamped], "measured_size": [round(float(v), 3) for v in size],
                        "color": _srgb_median(rgb), "note": note})
    objects.sort(key=lambda o: -o["confidence"])
    # one line per kind of thing that was seen but not placed
    grouped = {}
    for s in skipped:
        g = grouped.setdefault((s["label"], s["reason"]), 0); grouped[(s["label"], s["reason"])] = g + 1
    skipped = [{"label": f"{label} (x{k})" if k > 1 else label, "reason": reason} for (label, reason), k in grouped.items()]

    # --- windows and doors: project onto the nearest wall
    frames = {"back": (np.array([0, -half_d]), np.array([1, 0]), np.array([0, 1]), half_w * 2),
              "front": (np.array([0, half_d]), np.array([-1, 0]), np.array([0, -1]), half_w * 2),
              "left": (np.array([-half_w, 0]), np.array([0, -1]), np.array([1, 0]), half_d * 2),
              "right": (np.array([half_w, 0]), np.array([0, 1]), np.array([-1, 0]), half_d * 2)}
    openings = []
    for r in sorted(open_pts, key=lambda r: -len(r["pts"])):
        kind = OPENINGS[r["name"]]; P = r["pts"]; xz = np.median(P[:, [0, 2]], axis=0)
        wall = min(frames, key=lambda w: abs((xz - frames[w][0]) @ frames[w][2]))
        origin, u, nrm, length = frames[wall]
        dist = float(abs((xz - origin) @ nrm))
        along = (P[:, [0, 2]] - origin) @ u
        a0, a1 = np.percentile(along, [6, 94]); y0, y1 = np.percentile(P[:, 1], [6, 94])
        width = float(np.clip(a1 - a0, 0.45, min(3.0, length - 0.2))); centre = float(np.clip((a0 + a1) / 2, -length / 2 + width / 2 + 0.05, length / 2 - width / 2 - 0.05))
        sill = 0.0 if kind == "door" else float(np.clip(y0, 0.3, 1.5)); height = float(np.clip(y1 - sill, 0.5, 2.3))
        if kind == "door": height = float(np.clip(y1, 1.8, 2.2))
        conf = r["score"] * (1.0 if dist < 0.4 else 0.6 if dist < 1.0 else 0.35)
        dup = next((o for o in openings if o["wall"] == wall and o["kind"] == kind and abs(o["centre"] - centre) < (o["width"] + width) / 2), None)
        if dup:
            dup["confidence"] = round(min(1.0, max(dup["confidence"], conf) + 0.1), 2); continue
        if dist > 1.5:
            skipped.append({"label": kind, "reason": "it could not be matched to a wall"}); continue
        openings.append({"wall": wall, "kind": kind, "centre": round(centre, 3), "width": round(width, 3), "sill": round(sill, 3), "height": round(height, 3), "confidence": round(conf, 2)})

    wall_rgb = np.concatenate([c for c, _ in stuff["wall"]]) if stuff["wall"] else None
    floor_rgb = np.concatenate([c for c, _ in stuff["floor"]]) if stuff["floor"] else None
    ceil_y = float(np.median(np.concatenate([p[:, 1] for _, p in stuff["ceiling"]]))) if stuff["ceiling"] else None
    return {"objects": objects, "skipped": skipped, "openings": openings,
            # walls are mostly seen in shadow, so take their brighter side as the paint colour
            "wall_color": _srgb_median(wall_rgb, 80) if wall_rgb is not None else None,
            "floor_color": _srgb_median(floor_rgb) if floor_rgb is not None else None,
            "ceiling_y": ceil_y}
