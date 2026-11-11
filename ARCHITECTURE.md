# Architecture

Last updated at the end of Phase 2.

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
│  ├─ lib/store.ts                single Zustand store: tools, view, volumes, measurements
│  ├─ lib/types.ts                RoomMeta, Volume, Confidence ("measured" | "estimated")
│  └─ public/scans/<id>/          scan.glb + room.json for each prepared scan
├─ services/reconstruction/       Python
│  ├─ app/main.py                 FastAPI: /health, /scans/{id}; /reconstructions returns 501
│  └─ scripts/prepare_demo_scan.py  offline: raw scan -> web-ready GLB + room.json
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

## Planned reconstruction pipeline (Phase 5, not built)

Researched options, with the trade-off that matters for this product:

| Approach | Gives | Problem for us |
|---|---|---|
| COLMAP (SfM + MVS) | Reliable, consistent geometry | Slow; struggles on blank walls; no metric scale from photos alone |
| Feed-forward models (DUSt3R, MASt3R, VGGT) | Fast dense point maps from uncalibrated images | Larger geometric residuals; GPU memory limits frame count; no metric scale |
| Gaussian splatting | Best-looking novel views | Not a surface: hard to measure, collide with, or edit |
| Phone depth sensors (ARKit / RoomPlan style capture) | Metric scale, wall/door/window primitives | iOS Pro devices only; needs a native capture step |

Intended design: feed-forward model for poses and dense points → TSDF fusion to a mesh → the same
`prepare` stage used here (orientation, envelope fit) → plane and opening detection → semantic
segmentation for furniture. Scale from photos alone is ambiguous, so the user will calibrate by
entering one real measurement (for example a door width); until they do, all dimensions stay "estimated".
Runs on a GPU worker behind FastAPI with a job queue; the web app polls job status.
