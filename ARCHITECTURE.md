# Architecture

Last updated after scan-to-editable-room, the product-model catalogue, and the placement rules.

```
reconstruct/
├─ apps/web/                        Next.js 16 static export, React 19, TypeScript, Tailwind 4, React Three Fiber
│  ├─ lib/types.ts                  Room, Opening, Placed, ScanResult
│  ├─ lib/catalog.ts                catalogue loader, floors, colour palettes
│  ├─ lib/placement.ts              collisions, wall snapping, surfaces, free spots
│  ├─ lib/sample.ts                 the sample bedroom: one Room + a list of Placed
│  ├─ lib/store.ts                  Zustand store: design, undo/redo history, selection, scan layer
│  ├─ lib/api.ts                    client for the reconstruction service
│  ├─ components/scene/
│  │  ├─ Viewport.tsx               canvas, lighting, layers
│  │  ├─ Room.tsx                   walls, floor, windows, skirting generated from Room
│  │  ├─ Furniture.tsx              one group per Placed: loads the model or built piece, handles drag and selection
│  │  ├─ recolor.ts                 per-part recolouring that keeps texture detail
│  │  ├─ ScanLayer.tsx              an uploaded scan: unlit, measurable, never editable
│  │  └─ CameraRig.tsx, Annotations.tsx, materials.ts
│  ├─ components/studio/            TopBar, ToolBar (+ catalogue), RoomPanel, Inspector, UploadDialog, WalkPad
│  └─ public/                       models, textures, env, thumbs (all CC0, see ASSETS.md)
├─ services/reconstruction/         FastAPI + the photo/video pipeline (Python)
│  └─ app/  main.py  jobs.py  pipeline.py  frames.py  fuse.py  roomfit.py  objects.py  quality.py
├─ tools/build_catalog.py, render_thumbs.py   build the catalogue data and thumbnails from model files
├─ tests/editor.py, tests/upload.py Playwright scripts that drive the real UI
└─ .github/workflows/pages.yml      builds and deploys the web app to GitHub Pages on every push to main
```

## The editable scene

Everything the user can change is plain data (`lib/types.ts`):

```ts
Room   { width, depth, height, wallColor, floor, openings[], origin }
Placed { id, item, x, z, y, rot, scale[3], colors[], parent, detected? }
```

- `Room.tsx` generates walls (with holes for windows and doors), floor and trim from `Room`. `Furniture.tsx` renders one
  object per `Placed`. Every wall, opening and piece is its own mesh.
- **Rules live in `lib/placement.ts`**, not in components: rotated-rectangle collision (separating axis test), wall
  containment, wall snapping, finding the surface under a point, finding a free spot. The store calls them on every edit.
  - Floor pieces may not overlap (chairs may tuck under desks; rugs never collide). A drag into an occupied spot shows a red
    frame and returns the piece on release.
  - `parent` links a piece to what it stands on. Moving or turning the parent carries its children; resizing keeps them on
    top; removing it drops them to the floor.
  - Wall pieces slide along the nearest wall and hide with it when the camera is behind it.
- **Catalogue** (`lib/catalog.generated.json`, built by `tools/build_catalog.py`): real size, the height of the top surface,
  and up to three recolourable *parts* per model found by clustering its colour texture.
- **Recolouring** (`scene/recolor.ts`): for a chosen part, each pixel keeps its brightness relative to the part's average
  (weave, grain, seams, baked shading) and takes the target colour. Normal and roughness maps are untouched. Results are cached.
- Every edit goes through `commit()`, which snapshots `{room, objects}` for undo. A drag or a handle turn is one step.
- **Before and after** draws the design as first opened in a second canvas that follows the editor's camera, clipped by a draggable divider.

## From a scan to an editable room

```
photos / video
   │  frames.py      rotate, resize, sharpest video frames (max 16 views)
   ▼
Depth Anything 3    depth + confidence + camera pose for every view, one pass
   │  scale         metric depth model → metres (a guess, labelled as one)
   ▼
fuse.py             TSDF fusion → one surface (kept only as an overlay for checking)
   ▼
roomfit.py          gravity, wall direction, floor and four wall planes → room width, depth
   ▼
objects.py          OneFormer labels every pixel (bed, desk, chair, wall, window, door ...)
   │                each labelled region is lifted to 3D with that view's depth and pose,
   │                merged across views, and boxed (snapped square to the walls when close)
   ▼
scene.json          room size + colours + openings + objects {label, position, size, facing, colour, confidence}
   ▼
store.designFromScan   closest catalogue piece per object, stretched toward the detected size (within limits),
                       main part recoloured to the detected colour, wall items snapped, small items seated on what is under them
```

How facing is decided, since a box alone has four possible fronts: a bed's headboard is its tall end (measured from the
points), otherwise it goes to the nearer wall; chairs turn to the nearest table; storage and sofas put their back to the nearest wall.

What is reported honestly: every object and opening has a confidence built from the segmentation score, how many views saw
it, and whether its measured size is plausible for its kind. Implausible objects and anything the catalogue has no class for
are listed as "seen but not placed" instead of being guessed.

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

### Why a fused scan is not the editable result

A fused surface has no separate objects, and its geometry is too rough to pass for furniture. So the scan is used for what it
is good at (where things are and how big) and catalogue models are used for what they are good at (looking right, being editable).

Alternatives considered for geometry: COLMAP (fails on sparse photos; dense stage needs CUDA), larger feed-forward models
(better, but non-commercial licences and GPU memory; swappable through `RECONSTRUCT_GEOMETRY_MODEL`), Gaussian splatting
(prettier, not measurable), phone depth sensors (true scale, needs a native capture app).
