"""Photos / video -> gravity-aligned coloured room mesh.

Stages
  1. frames   : normalise uploads, sample sharp video frames            (frames.py)
  2. geometry : Depth Anything 3 (any-view) predicts per-view depth, confidence,
                intrinsics and camera poses in one forward pass
  3. scale    : optional metric depth model estimates metres-per-unit
  4. fusion   : TSDF integration of all views into one coloured mesh    (fuse.py)
  5. room fit : gravity, wall direction, floor / wall planes            (roomfit.py)

What this does NOT do: recognise furniture, doors or windows, or measure anything.
Scale is a learned estimate until the user calibrates it in the app.
"""
from __future__ import annotations
import json, os, sys, time
from pathlib import Path
from typing import Callable
import numpy as np

from . import frames as frames_mod
from .roomfit import orient_and_fit
from .fuse import fuse

ROOT = Path(__file__).resolve().parents[1]
_DA3_SRC = Path(os.environ.get("RECONSTRUCT_DA3_SRC", ROOT / "third_party" / "Depth-Anything-3" / "src"))
if _DA3_SRC.is_dir() and str(_DA3_SRC) not in sys.path:
    sys.path.insert(0, str(_DA3_SRC))

GEOMETRY_MODEL = os.environ.get("RECONSTRUCT_GEOMETRY_MODEL", "depth-anything/DA3-BASE")
METRIC_MODEL = os.environ.get("RECONSTRUCT_METRIC_MODEL", "depth-anything/DA3METRIC-LARGE")  # "" disables
MAX_VIEWS = int(os.environ.get("RECONSTRUCT_MAX_VIEWS", "16"))
MAX_FACES = 400_000
_models: dict = {}


class ReconstructionError(Exception):
    """A failure the user can act on. The message is shown in the app as written."""


def _device():
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


def _model(name: str):
    if name not in _models:
        try:
            from depth_anything_3.api import DepthAnything3
        except ImportError as e:
            raise ReconstructionError(
                "The reconstruction model is not installed. Run services/reconstruction/scripts/setup.sh once."
            ) from e
        _models[name] = DepthAnything3.from_pretrained(name).to(_device()).eval()
    return _models[name]


def _mask(depth, conf, conf_floor):
    """Drop low-confidence pixels and depth discontinuities (they smear into fins when fused)."""
    import cv2
    ok = (conf >= conf_floor) & np.isfinite(depth) & (depth > 0)
    gx = np.abs(np.diff(depth, axis=1, prepend=depth[:, :1])); gy = np.abs(np.diff(depth, axis=0, prepend=depth[:1]))
    edge = (np.maximum(gx, gy) / np.maximum(depth, 1e-6)) > 0.04
    edge = cv2.dilate(edge.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    return ok & ~edge


def _metric_scale(paths, depth, masks, K, log):
    """Median ratio between a metric monocular depth model and the any-view depth, on a few views."""
    if not METRIC_MODEL:
        return None
    import torch
    try:
        model = _model(METRIC_MODEL)
        idx = sorted(set(np.linspace(0, len(paths) - 1, min(3, len(paths))).round().astype(int).tolist()))
        ratios = []
        for i in idx:
            with torch.inference_mode():
                pred = model.inference([str(paths[i])])
            net = pred.depth[0]
            if net.shape != depth[i].shape:
                continue
            focal = (K[i][0, 0] + K[i][1, 1]) / 2
            metric = focal * net / 300.0  # documented conversion for DA3METRIC
            m = masks[i] & (metric > 0.1)
            if m.sum() > 500:
                ratios.append(float(np.median(metric[m] / depth[i][m])))
        if not ratios:
            return None
        return {"metres_per_unit": float(np.median(ratios)), "per_view": ratios, "model": METRIC_MODEL}
    except ReconstructionError:
        raise
    except Exception as e:  # scale is optional; geometry is still valid without it
        log(f"metric scale skipped: {type(e).__name__}: {e}")
        return None


def reconstruct(upload_dir: Path, out_dir: Path, progress: Callable[[str, float, str], None] = lambda *a: None,
                title: str = "Uploaded room") -> dict:
    import torch
    t0 = time.time(); notes: list[str] = []
    log = notes.append
    out_dir.mkdir(parents=True, exist_ok=True)

    progress("frames", 0.05, "Reading your files")
    got = frames_mod.collect(upload_dir, out_dir / "frames", MAX_VIEWS)
    paths = got["frames"]
    if len(paths) < 2:
        raise ReconstructionError(
            "At least two usable photos, or one video, are needed. "
            + (f"Could not read: {', '.join(got['skipped'])}." if got["skipped"] else ""))

    progress("geometry", 0.15, f"Working out depth and camera positions for {len(paths)} views")
    model = _model(GEOMETRY_MODEL)
    with torch.inference_mode():
        pred = model.inference([str(p) for p in paths])
    depth = np.asarray(pred.depth, np.float32); conf = np.asarray(pred.conf, np.float32)
    K = np.asarray(pred.intrinsics, np.float64); ext = np.asarray(pred.extrinsics, np.float64)
    rgb = np.asarray(pred.processed_images)
    n, h, w = depth.shape
    floor_conf = float(np.percentile(conf, 20))
    masks = [_mask(depth[i], conf[i], floor_conf) for i in range(n)]

    progress("scale", 0.55, "Estimating real-world scale")
    scale_info = _metric_scale(paths, depth, masks, K, log)
    if scale_info and 0.05 < scale_info["metres_per_unit"] < 50:
        s = scale_info["metres_per_unit"]
        spread = (max(scale_info["per_view"]) - min(scale_info["per_view"])) / s if len(scale_info["per_view"]) > 1 else None
        scale = {"confidence": "estimated", "method": "Learned metric depth model", "metres_per_unit": s,
                 "disagreement_between_views": spread}
    else:
        s = 2.0 / float(np.median(np.concatenate([depth[i][masks[i]] for i in range(n)])))
        scale = {"confidence": "uncalibrated", "method": "Assumed surfaces are about 2 m from the camera",
                 "metres_per_unit": s, "disagreement_between_views": None}

    progress("fusion", 0.65, "Fusing the views into one surface")
    centres, ups, w2cs, metric = [], [], [], []
    for i in range(n):
        E = np.eye(4); E[:3] = ext[i]; E[:3, 3] *= s  # world-to-camera, OpenCV convention
        w2cs.append(E); metric.append(depth[i] * s)
        c2w = np.linalg.inv(E); centres.append(c2w[:3, 3]); ups.append(-c2w[:3, 1])
    V, F, C, voxel = fuse(metric, masks, rgb, K, w2cs)
    if len(F) < 500:
        raise ReconstructionError("The views did not produce a usable surface. Try more photos with the room well lit.")
    raw_faces = len(F)
    if raw_faces > MAX_FACES:
        import fast_simplification
        from scipy.spatial import cKDTree
        V2, F = fast_simplification.simplify(V.astype(np.float32), F.astype(np.int32), target_reduction=1 - MAX_FACES / raw_faces)
        C = C[cKDTree(V).query(V2)[1]]; V = V2.astype(np.float64)

    progress("room", 0.85, "Finding the floor and walls")
    room_mesh, envelope, diag = orient_and_fit(V, F, C, np.mean(ups, axis=0), np.array(centres))
    room_mesh.export(out_dir / "scan.glb")

    coverage = float(np.mean([m.mean() for m in masks]))
    room = {
        "source": {"kind": "upload", "title": title,
                   "detail": " and ".join(
                       f"{c} {w}{'' if c == 1 else 's'}" for c, w in ((got["photos"], "photo"), (got["videos"], "video")) if c),
                   "license": None, "url": None},
        "units": "metres", "up": "Y",
        "scale": scale,
        "processing": {
            "pipeline": f"{GEOMETRY_MODEL} + TSDF fusion ({voxel * 100:.0f} cm voxels)",
            "views": n, "view_resolution": [int(w), int(h)], "device": _device(),
            "faces_before_reduction": int(raw_faces), "faces": int(len(room_mesh.faces)),
            "vertices": int(len(room_mesh.vertices)), "pixels_kept": coverage,
            "seconds": round(time.time() - t0, 1), "skipped_files": got["skipped"], "notes": notes, **diag,
        },
        "envelope": envelope,
        "bounds": {"min": room_mesh.bounds[0].tolist(), "max": room_mesh.bounds[1].tolist()},
    }
    (out_dir / "room.json").write_text(json.dumps(room, indent=2))
    progress("done", 1.0, "Ready")
    return room


if __name__ == "__main__":
    r = reconstruct(Path(sys.argv[1]), Path(sys.argv[2]), lambda st, p, msg: print(f"[{p:4.0%}] {st}: {msg}", flush=True))
    print(json.dumps({k: r[k] for k in ("scale", "envelope")}, indent=1)); print(json.dumps({k: v for k, v in r["processing"].items() if k != "camera_positions"}, indent=1))
