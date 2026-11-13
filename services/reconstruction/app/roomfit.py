"""Turn a raw reconstructed mesh into a gravity-aligned room with an ESTIMATED envelope.

Shared by uploaded reconstructions and the prepared demo scan. Nothing here adds
geometry; it rotates, translates, drops floating specks and fits planes.
"""
from __future__ import annotations
import numpy as np
import trimesh


def _peak(values, weights, bins, mask_fn=None):
    hist, edges = np.histogram(values, bins=bins, weights=weights)
    centres = (edges[:-1] + edges[1:]) / 2
    if mask_fn is not None:
        hist = np.where(mask_fn(centres), hist, 0)
    if hist.sum() <= 0:
        return None, 0.0
    i = int(np.argmax(hist))
    return float(centres[i]), float(hist[i])


def orient_and_fit(vertices, faces, colors, cam_up, cam_centres, speck_fraction=0.005):
    """vertices (N,3) in capture frame, faces (M,3), colors (N,3) uint8.
    cam_up: mean camera 'up' direction in the capture frame (gravity prior).
    cam_centres: (K,3) camera positions in the capture frame.
    Returns (trimesh.Trimesh, envelope dict, diagnostics dict, 4x4 capture-to-room transform)."""
    V = np.asarray(vertices, np.float64); F = np.asarray(faces)
    cam_up = cam_up / np.linalg.norm(cam_up)
    m = trimesh.Trimesh(V, F, process=False)
    N, A = m.face_normals, m.area_faces

    # gravity: refine the camera prior with near-horizontal surfaces, if there are any
    dots = N @ cam_up
    sel = np.abs(dots) > np.cos(np.radians(12))
    up = cam_up
    gravity_refined = False
    if A[sel].sum() > 0.03 * A.sum():
        cand = (N[sel] * (np.sign(dots[sel]) * A[sel])[:, None]).sum(0)
        cand /= np.linalg.norm(cand)
        if cand @ cam_up > np.cos(np.radians(20)):
            up, gravity_refined = cand, True

    # wall direction: dominant horizontal normal folded to 90 degrees
    t = np.cross(up, [1.0, 0, 0])
    if np.linalg.norm(t) < 0.2:
        t = np.cross(up, [0, 0, 1.0])
    t /= np.linalg.norm(t); u = np.cross(up, t)
    horiz = np.abs(N @ up) < 0.15
    walls_found = A[horiz].sum() > 0.05 * A.sum()
    theta = 0.0
    if walls_found:
        ang = np.mod(np.arctan2(N[horiz] @ u, N[horiz] @ t), np.pi / 2)
        theta, _ = _peak(ang, A[horiz], 180)
    ex = np.cos(theta) * t + np.sin(theta) * u
    R = np.stack([ex, up, np.cross(ex, up)])
    P = V @ R.T
    C = np.asarray(colors)
    cams = np.asarray(cam_centres, np.float64) @ R.T

    # floating specks
    mesh = trimesh.Trimesh(P, F, process=False)
    removed = 0
    if len(mesh.faces) > 0 and len(mesh.face_adjacency) > 0:
        lab = trimesh.graph.connected_component_labels(mesh.face_adjacency, node_count=len(mesh.faces))
        cnt = np.bincount(lab); keep = cnt[lab] >= speck_fraction * len(mesh.faces)
        removed = int((~keep).sum())
        used = np.zeros(len(P), bool); used[mesh.faces[keep].ravel()] = True
        remap = np.cumsum(used) - 1
        P, C, F = P[used], C[used], remap[mesh.faces[keep]]
        mesh = trimesh.Trimesh(P, F, process=False)
    tc, FN, FA = mesh.triangles_center, mesh.face_normals, mesh.area_faces

    # floor: strongest up-facing horizontal plane below the cameras
    cam_h = float(np.median(cams[:, 1]))
    upfacing = FN[:, 1] > 0.9
    floor_y, floor_area = (None, 0.0)
    if upfacing.any():
        span = max(np.ptp(P[:, 1]), 1e-6)
        floor_y, floor_area = _peak(tc[upfacing, 1], FA[upfacing], 300, lambda c: c < cam_h - 0.15 * span)
    floor_found = floor_y is not None and floor_area > 0.01 * FA.sum()
    if not floor_found:
        floor_y = float(np.percentile(P[:, 1], 1))
    P[:, 1] -= floor_y; cams[:, 1] -= floor_y
    M = np.eye(4); M[:3, :3] = R; M[1, 3] = -floor_y

    lo, hi = np.percentile(P[:, [0, 2]], 2, axis=0), np.percentile(P[:, [0, 2]], 98, axis=0)
    if (hi - lo)[1] > (hi - lo)[0]:  # long side along X
        P = P[:, [2, 1, 0]] * [1, 1, -1]; cams = cams[:, [2, 1, 0]] * [1, 1, -1]
        M = np.array([[0, 0, 1, 0], [0, 1, 0, 0], [-1, 0, 0, 0], [0, 0, 0, 1.0]]) @ M
        lo, hi = np.percentile(P[:, [0, 2]], 2, axis=0), np.percentile(P[:, [0, 2]], 98, axis=0)
    centre = (lo + hi) / 2
    P[:, [0, 2]] -= centre; cams[:, [0, 2]] -= centre
    M[0, 3] -= centre[0]; M[2, 3] -= centre[1]

    mesh = trimesh.Trimesh(P, F, process=False)
    tc, FN, FA = mesh.triangles_center, mesh.face_normals, mesh.area_faces
    rgba = np.concatenate([C[:, :3], np.full((len(C), 1), 255)], 1).astype(np.uint8)
    mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=rgba)

    # walls: the OUTERMOST substantial vertical plane on each side (a wardrobe front can be a
    # bigger plane than the wall behind it); fall back to the extent of the data
    def wall_pair(axis):
        sel = (np.abs(FN[:, 1]) < 0.15) & (np.abs(FN[:, axis]) > 0.9)
        p_lo, p_hi = float(np.percentile(P[:, axis], 2)), float(np.percentile(P[:, axis], 98))
        out, found = [p_lo, p_hi], [False, False]
        if sel.any():
            hist, edges = np.histogram(tc[sel, axis], bins=200, weights=FA[sel])
            centres = (edges[:-1] + edges[1:]) / 2
            for k, side in enumerate((centres < 0, centres > 0)):
                hs = np.where(side, hist, 0)
                if hs.max() <= 0.004 * FA.sum():
                    continue
                strong = np.nonzero(hs >= 0.35 * hs.max())[0]
                pos = float(centres[strong[0] if k == 0 else strong[-1]])
                # a plane well inside the captured data is furniture, not the room boundary
                if abs(pos - out[k]) <= 0.5:
                    out[k] = pos; found[k] = True
        return out, found
    (x0, x1), fx = wall_pair(0)
    (z0, z1), fz = wall_pair(2)
    # put the origin midway between the fitted walls, so the editable room and the scan share one frame
    shift = np.array([(x0 + x1) / 2, 0.0, (z0 + z1) / 2])
    mesh.vertices = mesh.vertices - shift; cams = cams - shift; M[0, 3] -= shift[0]; M[2, 3] -= shift[2]
    x0, x1, z0, z1 = x0 - shift[0], x1 - shift[0], z0 - shift[2], z1 - shift[2]
    P = np.asarray(mesh.vertices)
    ceiling_max = float(np.percentile(P[:, 1], 99.5))
    envelope = {
        "confidence": "estimated",
        "note": "Planes fitted to the mesh by area-weighted histograms. Not a survey measurement.",
        "floor_y": 0.0,
        "floor_found": bool(floor_found),
        "ceiling": {"max_y": ceiling_max},
        "walls": {"x_min": x0, "x_max": x1, "z_min": z0, "z_max": z1},
        "walls_found": {"x_min": fx[0], "x_max": fx[1], "z_min": fz[0], "z_max": fz[1]},
        "width_m": x1 - x0, "depth_m": z1 - z0,
    }
    diag = {"gravity_refined_from_surfaces": gravity_refined, "wall_direction_found": bool(walls_found),
            "removed_speck_faces": removed, "camera_height_median": float(np.median(cams[:, 1])),
            "camera_positions": cams.round(3).tolist()}
    return mesh, envelope, diag, M
