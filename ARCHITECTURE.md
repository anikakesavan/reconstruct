# Architecture

Last updated after the editor rebuild (designed sample room, furniture editing, scan as a guide layer).

```
reconstruct/
├─ apps/web/                        Next.js 16 static export, React 19, TypeScript, Tailwind 4, React Three Fiber
│  ├─ lib/types.ts                  Room, Placed (a piece of furniture), ScanMeta
│  ├─ lib/catalog.ts                the furniture catalogue, floors, woods, colours
│  ├─ lib/sample.ts                 the sample bedroom: one Room + a list of Placed
│  ├─ lib/store.ts                  Zustand store: design, undo/redo history, selection, scan layer
│  ├─ lib/api.ts                    client for the reconstruction service
│  ├─ components/scene/
│  │  ├─ Viewport.tsx               canvas, lighting, layers
│  │  ├─ Room.tsx                   walls, floor, windows, skirting generated from Room
│  │  ├─ Furniture.tsx              one group per Placed: loads the model or built piece, handles drag and selection
│  │  ├─ Built.tsx                  bed, desk, chair, rug, print generated from dimensions
│  │  ├─ ScanLayer.tsx              an uploaded scan: unlit, measurable, never editable
│  │  └─ CameraRig.tsx, Annotations.tsx, materials.ts
│  ├─ components/studio/            TopBar, ToolBar (+ catalogue), RoomPanel, Inspector, UploadDialog, WalkPad
│  └─ public/                       models, textures, env, thumbs (all CC0, see ASSETS.md)
├─ services/reconstruction/         FastAPI + the photo/video pipeline (Python)
│  └─ app/  main.py  jobs.py  pipeline.py  frames.py  fuse.py  roomfit.py  quality.py
├─ tests/editor.py, tests/upload.py Playwright scripts that drive the real UI
└─ .github/workflows/pages.yml      builds and deploys the web app to GitHub Pages on every push to main
```

## The editable scene

Everything the user can change is plain data:

```ts
Room   { width, depth, height, wallColor, floor, origin }
Placed { id, item, x, z, y, rot, tint, finish }
```

- `Room.tsx` generates the shell from `Room`; `Furniture.tsx` renders one object per `Placed`. Walls, floor, windows and
  every piece of furniture are separate meshes.
- Every edit goes through `commit()` in the store, which pushes the previous `{room, objects}` onto a history stack. Undo and
  redo swap whole snapshots (cheap: the data is small). A drag records one step, on release, and none if nothing moved.
- Catalogue items are either **models** (CC0 GLB files, re-centred on load so the origin is the middle of the footprint at floor
  level; their size is read from the file) or **built** pieces generated from dimensions, which is what makes wood finish and
  fabric colour real material changes rather than tints.
- The same list of plain operations is what an AI assistant (Phase 4) will emit, so its edits will be reviewable and undoable for free.

## Scans are a separate layer

```
photos / video → service → scan.glb + room.json ─┬─► ScanLayer (look, walk, measure, calibrate)
                                                 └─► "Make a clean room this size": Room.width/depth/height
                                                      taken from the fitted envelope → furnish from the catalogue,
                                                      scan shown at 38% opacity as a guide
```

The sample bedroom is never presented as a scan, and a scan is never presented as editable furniture.

## Reconstruction pipeline

```
frames.py ──► Depth Anything 3 Base ──► scale ──► fuse.py ──► roomfit.py ──► quality.py
rotate, resize,   depth + confidence +    metric    NumPy TSDF,   gravity, wall     plain-language
sharpest video    intrinsics + poses,     depth     marching      direction, floor  capture report
frames (≤16)      one pass, all views     guess     cubes         and wall planes
```

Why this design: people shoot a handful of photos with little overlap and a lot of blank wall, which is where classical
feature matching (COLMAP) fails; a feed-forward model handles it and runs on a laptop CPU. Views are fused into a surface
(not a splat) so it can be measured. Scale from photos is only ever a guess, so it is labelled and the user can calibrate.
Everything runs locally; originals are deleted when a job ends.

### What was wrong with scans, stage by stage (investigated November 2026)

| Stage | Finding | Status |
|---|---|---|
| Old demo room | Not produced by this pipeline: a dataset scan shot in dim light, reduced 26x, coloured per vertex. Could not reach design quality | Replaced by a designed room |
| Frame selection | Sharpest frame per time window; blur and darkness were never reported | Now measured per frame and reported |
| Camera poses | Predicted by the model with no cross-check. Photos and video of the same room gave room lengths within 6% of each other; no ground truth available | Unchanged |
| Depth | Predicted at 504 px regardless of view count | 644 px for up to 10 views on CPU |
| Scale | Raising depth resolution exposed a size mismatch with the metric pass that silently dropped views, leaving a one-view estimate about 27% off | Fixed: metric depth is rescaled to match |
| Surface | 2 cm voxels, 400k triangle cap | 1.2 to 1.4 cm voxels for a bedroom, 600k cap |
| Colour | One colour per vertex, averaged in the voxel grid: soft, "muddy" | Sharper from finer voxels; real texture mapping not built |
| Missing surfaces | Only what a camera saw exists. In the test set the camera moved 0.7 m in total, the main cause of holes | Inherent; now explained to the user |
| Editability | A fused surface has no separate objects | Addressed by the hybrid below, not by the scan |

### Hybrid approach

Built: the scan's fitted envelope sizes a clean procedural room, which the user furnishes from the catalogue with the scan as a guide.

Not built (proposed): detect furniture, doors and windows automatically. Run an open-vocabulary detector and segmenter on the
selected frames, lift each mask to a 3D box using the depth and poses already computed, merge boxes across views, then place the
nearest catalogue item by class and size for the user to confirm. Replace the bounding-box room with a wall-by-wall layout
(plane fitting under a right-angle assumption) so non-rectangular rooms work.

Alternatives considered for geometry: COLMAP (fails on sparse photos; dense stage needs CUDA), larger feed-forward models
(better, but non-commercial licences and GPU memory; swappable through `RECONSTRUCT_GEOMETRY_MODEL`), Gaussian splatting
(prettier, not measurable), phone depth sensors (true scale, needs a native capture app).
