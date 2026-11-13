"""Small dense TSDF fusion in NumPy: many depth views -> one coloured surface.

Kept in-house (about 100 lines) instead of depending on a 3D library for it: the grid is
sized to the room, each view is integrated with vectorised projection, and the surface is
extracted with marching cubes. Unobserved space is masked out, so no surface is invented
where no camera looked.
"""
from __future__ import annotations
import numpy as np
from skimage import measure

MAX_VOXELS = 30_000_000


def _unproject(depth, mask, K, c2w, step=6):
    h, w = depth.shape
    v, u = np.mgrid[0:h:step, 0:w:step]
    m = mask[::step, ::step]; z = depth[::step, ::step][m]
    x = (u[m] - K[0, 2]) / K[0, 0] * z; y = (v[m] - K[1, 2]) / K[1, 1] * z
    return np.stack([x, y, z], 1) @ c2w[:3, :3].T + c2w[:3, 3]


def fuse(depths, masks, colors, Ks, w2cs, min_voxel=0.012):
    """depths[i] (H,W) metres, masks[i] bool, colors[i] (H,W,3) uint8, Ks[i] 3x3, w2cs[i] 4x4 (OpenCV).
    Returns vertices (N,3), faces (M,3), vertex colours (N,3) uint8, voxel size."""
    n = len(depths); h, w = depths[0].shape
    c2ws = [np.linalg.inv(E) for E in w2cs]
    pts = np.concatenate([_unproject(depths[i], masks[i], Ks[i], c2ws[i]) for i in range(n)])
    lo, hi = np.percentile(pts, 0.5, axis=0), np.percentile(pts, 99.5, axis=0)
    voxel = max(min_voxel, float(np.cbrt(np.prod(hi - lo + 0.3) / MAX_VOXELS)))
    lo -= 4 * voxel; hi += 4 * voxel
    dims = np.ceil((hi - lo) / voxel).astype(int) + 1
    trunc = 4 * voxel
    tsdf = np.zeros(dims, np.float32); weight = np.zeros(dims, np.float32)
    rgb = np.zeros((*dims, 3), np.float32); cw = np.zeros(dims, np.float32)

    ys = lo[1] + voxel * np.arange(dims[1]); zs = lo[2] + voxel * np.arange(dims[2])
    gy, gz = np.meshgrid(ys, zs, indexing="ij")
    slab = max(1, int(2_000_000 // (dims[1] * dims[2])))
    for i in range(n):
        R, t = w2cs[i][:3, :3], w2cs[i][:3, 3]
        fx, fy, cx, cy = Ks[i][0, 0], Ks[i][1, 1], Ks[i][0, 2], Ks[i][1, 2]
        d_img = np.where(masks[i], depths[i], 0).astype(np.float32)
        for a in range(0, dims[0], slab):
            b = min(dims[0], a + slab)
            gx = (lo[0] + voxel * np.arange(a, b))[:, None, None]
            X = gx + 0 * gy[None]; Y = gy[None] + 0 * gx; Z = gz[None] + 0 * gx
            zc = R[2, 0] * X + R[2, 1] * Y + R[2, 2] * Z + t[2]
            front = zc > 0.05
            zs_safe = np.where(front, zc, 1)
            uu = np.rint((R[0, 0] * X + R[0, 1] * Y + R[0, 2] * Z + t[0]) / zs_safe * fx + cx).astype(np.int32)
            vv = np.rint((R[1, 0] * X + R[1, 1] * Y + R[1, 2] * Z + t[1]) / zs_safe * fy + cy).astype(np.int32)
            inside = front & (uu >= 0) & (uu < w) & (vv >= 0) & (vv < h)
            uu = np.where(inside, uu, 0); vv = np.where(inside, vv, 0)
            d = d_img[vv, uu]
            sdf = d - zc
            upd = inside & (d > 0) & (sdf > -trunc)
            if not upd.any():
                continue
            val = np.clip(sdf / trunc, -1, 1)
            T, W = tsdf[a:b], weight[a:b]
            T[upd] = (T[upd] * W[upd] + val[upd]) / (W[upd] + 1); W[upd] += 1
            near = upd & (np.abs(sdf) < trunc)
            col = colors[i][vv, uu].astype(np.float32)
            rgb[a:b][near] += col[near]; cw[a:b][near] += 1

    seen = weight > 0
    if seen.sum() < 1000 or not ((tsdf < 0) & seen).any():
        return np.zeros((0, 3)), np.zeros((0, 3), int), np.zeros((0, 3), np.uint8), voxel
    tsdf[~seen] = 1.0
    verts, faces, _, _ = measure.marching_cubes(tsdf, level=0.0, mask=seen)
    idx = np.clip(np.rint(verts).astype(int), 0, dims - 1)
    c = rgb[idx[:, 0], idx[:, 1], idx[:, 2]]; k = cw[idx[:, 0], idx[:, 1], idx[:, 2]]
    cols = (c / np.maximum(k, 1)[:, None]).clip(0, 255).astype(np.uint8)
    verts = verts * voxel + lo
    # make faces look toward the cameras that saw them
    centre = np.mean([c2w[:3, 3] for c2w in c2ws], axis=0)
    tri = verts[faces[:: max(1, len(faces) // 20000)]]
    nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    if np.sum(np.einsum("ij,ij->i", nrm, centre - tri.mean(1))) < 0:
        faces = faces[:, ::-1]
    return verts, faces, cols, voxel
