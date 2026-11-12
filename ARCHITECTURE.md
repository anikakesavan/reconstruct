# Architecture

Last updated after the first slice of Phase 5 (upload and reconstruct).

```
reconstruct/
├─ apps/web/                      Next.js 16 (App Router), React 19, TypeScript, Tailwind 4
│  ├─ app/                        layout, global tokens (globals.css), single page
│  ├─ components/scene/           everything inside the WebGL canvas (React Three Fiber)
│  │  ├─ Viewport.tsx             Canvas, cutting-mat grid, frame stats
│  │  ├─ ScanMesh.tsx             loads the scan GLB, colour-space fix, BVH raycasting, click routing
│  │  ├─ Volumes.tsx              block-out boxes: select, drag on floor plane, snap
│  │  ├─ Annotations.tsx          measure line, inspect pin, labels
│  │  └─ CameraRig.tsx            orbit / plan (OrbitControls) and walk (custom controller)
│  ├─ components/studio/          DOM chrome around the viewport
│  │  ├─ Studio.tsx               shell, keyboard shortcuts, loading and error states
│  │  ├─ TopBar, ToolRail, RoomSheet, Inspector, WalkPad
│  │  └─ UploadDialog.tsx         pick files, upload, live stages, list / open / delete scans
│  ├─ lib/store.ts                single Zustand store: current scan, calibration, tools, volumes
│  ├─ lib/api.ts                  client for the reconstruction service
│  ├─ lib/types.ts                RoomMeta, Volume, Confidence ("measured" | "estimated")
│  └─ public/scans/<id>/          scan.glb + room.json for each prepared scan
├─ services/reconstruction/       Python
│  ├─ app/main.py                 FastAPI: upload, status, assets, delete (see file header)
│  ├─ app/jobs.py                 one-at-a-time job queue; each job is a folder under data/jobs/
│  ├─ app/pipeline.py             the five stages below
│  ├─ app/frames.py               EXIF rotation, HEIC, sharpest-frame sampling from video
│  ├─ app/fuse.py                 NumPy TSDF fusion + marching cubes
│  ├─ app/roomfit.py              gravity, wall direction, floor and wall planes
│  ├─ scripts/setup.sh            installs packages, clones Depth Anything 3 at a pinned commit
│  └─ scripts/prepare_demo_scan.py  offline: raw Redwood scan -> web-ready GLB + room.json
└─ tests/smoke.py                 Playwright script that drives the real UI and saves screenshots
```

## Data flow today

```
raw RGB-D reconstruction (10.2M triangles, uncoloured)   colour fragments + camera poses
                    │                                              │
                    └──────────── prepare_demo_scan.py ────────────┘
                       decimate → transfer colour → find gravity and wall directions
                       → remove floating specks → fit floor / wall planes
                                         │
                         scan.glb (390k triangles)   room.json (envelope, provenance)
                                         │
                        Next.js static files → ScanMesh + store.room
```

## Decisions and their reasons

**The scan is rendered unlit.** Vertex colours already contain the room's real lighting. Adding
virtual lights on top would look plausible and be wrong. Relighting (Phase 3 "experiment with lighting")
needs separated albedo, which this scan does not have; see LIMITATIONS.

**Two kinds of scene content.** The scan is one immutable mesh. Things the user adds are data
(`Volume[]` in the store) rendered by components. Phase 3 widens `Volume` into a general `SceneObject`
with a catalogue model, materials and price; the store shape is already "list of plain objects plus
operations" so that undo/redo and AI edits (Phase 4) can both be expressed as the same operation list.

**Every dimension carries a confidence.** `Confidence` is part of the type, and the UI component
`ConfidenceMark` renders it. A number without a mark should be treated as a bug.

**Room envelope is fitted, not assumed.** The capture frame of the dataset is arbitrary (not gravity
aligned). The script takes a gravity prior from the handheld camera's average "up", refines it with
area-weighted surface normals, then finds the wall direction from a histogram of horizontal normals.

**Raycasting uses a BVH** (`three-mesh-bvh`) so that clicking a 390k-triangle mesh stays instant.

**Walk mode does not use pointer lock.** Drag-to-look plus keys / on-screen pad works the same on
desktop and touch, and never traps the cursor.

**State is client-only for now.** Persistence (Supabase / Postgres, object storage) arrives with
saved layouts in Phase 3. Nothing is stored or uploaded today.

## Reconstruction pipeline (built)

```
photos / video ──► frames.py ──► Depth Anything 3 Base ──► scale ──► fuse.py ──► roomfit.py ──► scan.glb
                  rotate, resize,   one forward pass:        metric     TSDF on a     gravity, wall      room.json
                  pick sharp        depth + confidence +     depth      room-sized    direction, floor
                  video frames      intrinsics + camera      model      voxel grid    and wall planes
                  (max 16 views)    poses for all views      guess
```

Why this design:

- **Feed-forward geometry instead of COLMAP.** People take a handful of photos with little overlap and
  lots of blank wall, which is where feature matching fails. Depth Anything 3 predicts depth and poses
  for all views in one pass. The Base model is Apache 2.0 and small enough for a laptop CPU.
- **A surface, not a splat.** The editor needs something to measure, click and collide with, so views
  are fused into one mesh. Unobserved space is masked, so nothing is invented where no camera looked.
- **Scale is never assumed to be right.** Photos alone have no absolute size. A metric depth model
  (DA3 Metric Large, Apache 2.0) gives a first guess, marked `estimated`. The user fixes it by
  calibrating one measured line; the factor is stored per scan in the browser and applied to the mesh
  and every dimension, which then read `measured`.
- **Privacy.** Everything runs on the user's machine. Uploaded originals and extracted frames are
  deleted when the job ends; only the mesh and its metadata are kept, and a scan can be deleted from the app.
- **Jobs are folders** (`data/jobs/<id>/job.json`, `scan.glb`, `room.json`). No database yet; the
  web app polls `GET /reconstructions/{id}`. A restart marks unfinished jobs as failed.

Alternatives considered:

| Approach | Gives | Why not (yet) |
|---|---|---|
| COLMAP (SfM + MVS) | Consistent geometry from dense overlap | Fails on sparse photos and blank walls; dense stage needs CUDA |
| Larger feed-forward models (DA3 Large / Giant, VGGT, MASt3R) | Better geometry | Non-commercial licences and GPU-sized memory; swappable through `RECONSTRUCT_GEOMETRY_MODEL` |
| Gaussian splatting | Best-looking views | Not a surface: hard to measure or edit |
| Phone depth sensors (ARKit / RoomPlan) | True metric scale, wall and door primitives | Needs a native iOS capture app |

Still to build in Phase 5: wall, door and window primitives, furniture segmentation, more than 16
views (chunked inference), and a GPU worker for hosted use.
