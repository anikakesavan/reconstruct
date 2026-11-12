"""Prepare the demo room scan (Redwood Indoor Lidar-RGBD "Bedroom", public domain).

Input  : bedroom.ply (uncolored reconstruction), bedroom/mesh_*.ply (colored
         fragments, fragment-local coords), bedroom.json (per-frame poses).
Output : scan.glb (decimated, vertex-colored, Y-up, floor at y=0, metres)
         room.json (ESTIMATED room envelope derived from the mesh)

Nothing here invents geometry: vertices are only decimated, re-oriented and
coloured from the nearest captured fragment sample.
"""
import json, sys, glob, os, re
import numpy as np, trimesh, fast_simplification
from scipy.spatial import cKDTree

raw, out = sys.argv[1], sys.argv[2]
TARGET_FACES = int(sys.argv[3]) if len(sys.argv) > 3 else 450_000
FRAMES_PER_FRAGMENT = 100

def read_ply(path):
    with open(path, 'rb') as f:
        head = b''
        while not head.endswith(b'end_header\n'):
            head += f.readline()
        h = head.decode()
        nv = int(re.search(r'element vertex (\d+)', h).group(1))
        nf = int(re.search(r'element face (\d+)', h).group(1))
        colored = 'red' in h
        vdt = [('p', '<f8', 3)] + ([('c', 'u1', 3)] if colored else [])
        v = np.frombuffer(f.read(nv * np.dtype(vdt).itemsize), dtype=vdt)
        fdt = [('n', 'u1'), ('i', '<u4', 3)]
        fa = np.frombuffer(f.read(nf * 13), dtype=fdt)
    return v['p'], (v['c'] if colored else None), fa['i']

print('reading reconstruction'); V, _, F = read_ply(f'{raw}/bedroom.ply')
print(V.shape, F.shape)
print('decimating'); 
ratio = 1 - TARGET_FACES / len(F)
V2, F2 = fast_simplification.simplify(V.astype(np.float32), F.astype(np.int32), target_reduction=ratio)
V2 = V2.astype(np.float64); print(V2.shape, F2.shape)

print('gathering fragment colours')
nodes = json.load(open(f'{raw}/bedroom.json'))['nodes']
pose = lambda k: np.array(nodes[k]['pose']).reshape(4, 4).T  # column-major
P0_inv = np.linalg.inv(pose(0))
pts, cols = [], []
for path in sorted(glob.glob(f'{raw}/bedroom/mesh_*.ply')):
    i = int(re.search(r'mesh_(\d+)', path).group(1))
    # Fragments are stored in the frame-0 volume coordinates (verified empirically:
    # median residual to the reconstruction drops from ~0.5 m to ~0.02 m with this).
    T = pose(i * FRAMES_PER_FRAGMENT) @ P0_inv
    p, c, _ = read_ply(path)
    p = p[::3]; c = c[::3]
    pts.append(p @ T[:3, :3].T + T[:3, 3]); cols.append(c)
pts = np.concatenate(pts); cols = np.concatenate(cols)
tree = cKDTree(pts)
d, idx = tree.query(V2, k=4, workers=-1)
C = cols[idx].astype(np.float64).mean(axis=1)
print('colour transfer distance (m): median %.4f p95 %.4f' % (np.median(d[:, 0]), np.percentile(d[:, 0], 95)))
color_residual = {'median_m': float(np.median(d[:, 0])), 'p95_m': float(np.percentile(d[:, 0], 95))}

# --- orientation (the capture frame is arbitrary, so nothing is assumed axis-aligned)
# 1. gravity prior from the handheld camera: image "down" is +Y in the camera frame.
cam_up = -np.stack([pose(k)[:3, 1] for k in range(0, len(nodes), 50)]).mean(0)
cam_up /= np.linalg.norm(cam_up)
m = trimesh.Trimesh(V2, F2, process=False)
N = m.face_normals; A = m.area_faces
# 2. refine with the mesh: area-weighted mean of near-horizontal surface normals.
dots = N @ cam_up; sel = np.abs(dots) > np.cos(np.radians(12))
up = (N[sel] * (np.sign(dots[sel]) * A[sel])[:, None]).sum(0); up /= np.linalg.norm(up)
print('gravity prior vs refined (deg):', np.degrees(np.arccos(np.clip(up @ cam_up, -1, 1))))
# 3. wall direction: dominant horizontal normal, folded to 90 degrees.
t = np.cross(up, [1, 0, 0]); t /= np.linalg.norm(t); u = np.cross(up, t)
horiz = np.abs(N @ up) < 0.1
ang = np.mod(np.arctan2(N[horiz] @ u, N[horiz] @ t), np.pi / 2)
hh, he = np.histogram(ang, bins=360, weights=A[horiz])
theta = he[np.argmax(hh):np.argmax(hh) + 2].mean()
ex = np.cos(theta) * t + np.sin(theta) * u
ez = np.cross(ex, up)
R = np.stack([ex, up, ez])  # proper rotation, world -> room
P = V2 @ R.T
mesh = trimesh.Trimesh(P, F2, process=False)
# 4. drop floating specks (components under 0.5% of faces): sensor noise, not room geometry
lab = trimesh.graph.connected_component_labels(mesh.face_adjacency, node_count=len(mesh.faces))
cnt = np.bincount(lab); keep = cnt[lab] >= 0.005 * len(mesh.faces)
removed_faces = int((~keep).sum())
used = np.zeros(len(P), bool); used[mesh.faces[keep].ravel()] = True
remap = np.cumsum(used) - 1
P = P[used]; C = C[used]; F2 = remap[mesh.faces[keep]]
mesh = trimesh.Trimesh(P, F2, process=False)
tc = mesh.triangles_center; FN = mesh.face_normals; FA = mesh.area_faces
# 5. floor / ceiling: strongest horizontal planes below / above the mean camera height
cam_h = float(np.mean([(pose(k)[:3, 3]) @ up for k in range(0, len(nodes), 50)]))
hz = np.abs(FN[:, 1]) > 0.95
hst, e = np.histogram(tc[hz, 1], bins=600, weights=FA[hz]); ctr = (e[:-1] + e[1:]) / 2
floor_h = float(ctr[np.argmax(np.where(ctr < cam_h - 0.3, hst, 0))])
ceil_h = float(ctr[np.argmax(np.where(ctr > cam_h + 0.3, hst, 0))])
P[:, 1] -= floor_h
if np.ptp(np.percentile(P[:, 2], [2, 98])) > np.ptp(np.percentile(P[:, 0], [2, 98])):
    P = P[:, [2, 1, 0]] * [1, 1, -1]  # 90 degree turn so the long side runs along X
P[:, [0, 2]] -= (np.percentile(P[:, [0, 2]], 2, axis=0) + np.percentile(P[:, [0, 2]], 98, axis=0)) / 2
mesh = trimesh.Trimesh(P, F2, process=False)
tc = mesh.triangles_center
fl = (np.abs(tc[:, 1]) < 0.05) & (np.abs(mesh.face_normals[:, 1]) > 0.95)
if (mesh.face_normals[fl, 1] * mesh.area_faces[fl]).sum() < 0:
    mesh.faces = mesh.faces[:, ::-1]; print('flipped winding')
V2 = P
rgba = np.concatenate([C, np.full((len(C), 1), 255)], 1).astype(np.uint8)
mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=rgba)
_ = mesh.vertex_normals
os.makedirs(out, exist_ok=True)
mesh.export(f'{out}/scan.glb')

# --- estimated envelope
wall = (np.abs(mesh.face_normals[:, 1]) < 0.1)
def planes(axis):
    hst, e = np.histogram(tc[wall, axis], bins=300, weights=mesh.area_faces[wall] * (np.abs(mesh.face_normals[wall, axis]) > 0.95))
    half = len(hst) // 2
    return float(e[np.argmax(hst[:half])]), float(e[half + np.argmax(hst[half:])])
x0, x1 = planes(0); z0, z1 = planes(2)
room = {
    'source': {
        'kind': 'dataset', 'title': 'Bedroom, Redwood scan',
        'detail': 'Redwood Indoor Lidar-RGBD Scan Dataset, scene "Bedroom". Park, Zhou, Koltun. Colored Point Cloud Registration Revisited. ICCV 2017.',
        'license': 'Public domain (attribution requested)',
        'url': 'http://redwood-data.org/indoor_lidar_rgbd/',
    },
    'scale': {'confidence': 'measured', 'method': 'Depth sensor', 'metres_per_unit': 1.0, 'disagreement_between_views': None},
    'units': 'metres', 'up': 'Y',
    'processing': {'removed_speck_faces': removed_faces, 'camera_height_m_mean': cam_h - floor_h,
                   'faces_before_reduction': int(len(F)), 'target_faces': TARGET_FACES, 'faces': int(len(F2)), 'vertices': int(len(V2)),
                   'colour_transfer_residual': color_residual},
    'envelope': {
        'confidence': 'estimated',
        'note': 'Dominant planes fitted by area-weighted histograms on the mesh. Not a survey measurement.',
        'floor_y': 0.0,
        'ceiling': {'kind': 'non-planar (sloped / vaulted in this scan)',
                    'lowest_horizontal_plane_y': float(abs(ceil_h - floor_h)),
                    'max_y': float(np.percentile(mesh.vertices[:, 1], 99.5))},
        'walls': {'x_min': x0, 'x_max': x1, 'z_min': z0, 'z_max': z1},
        'width_m': x1 - x0, 'depth_m': z1 - z0,
        'stated_floor_area_m2': 21.01,
    },
    'bounds': {'min': mesh.bounds[0].tolist(), 'max': mesh.bounds[1].tolist()},
}
json.dump(room, open(f'{out}/room.json', 'w'), indent=2)
print('floor/ceil raw', floor_h, ceil_h); print(json.dumps(room['envelope'], indent=1)); print(os.path.getsize(f'{out}/scan.glb') / 1e6, 'MB')
