# Plan

Legend: done, partly done, not started. Update this file at the end of every session.

## Phase 1: research, feasibility, design system (done)
- [x] Reconstruction approaches compared (see ARCHITECTURE.md, "Planned reconstruction pipeline")
- [x] Real, public-domain room scan sourced and licence checked
- [x] Design direction, tokens and layout (DESIGN_SYSTEM.md)
- [ ] Hands-on audit of reference tools (Spline, Figma, room planners). Notes so far are from memory.

## Phase 2: 3D room editor on a prepared real scan (done, with gaps listed)
- [x] Scan preparation script (decimate, colour, orient, fit envelope)
- [x] Viewer: orbit, pan, zoom, plan view, first-person walk (keys and touch pad)
- [x] Measure and Inspect tools on the scan surface
- [x] Block-out volumes: add, select in 3D, drag, snap, resize, turn, remove, wall limits
- [x] Estimated / stated marks on dimensions
- [x] Desktop and mobile layouts, browser-tested (LIMITATIONS.md, "Test record")
- [ ] Selecting scanned furniture (needs segmentation; later in Phase 5)
- [ ] Frame rate measured on real GPUs (only a software renderer was available)
- [ ] Touch drag of volumes verified on a physical phone

## Phase 3: furniture, materials, lighting, undo/redo, saved layouts (next)
1. Generalise `Volume` to `SceneObject` (catalogue id, model, material slots, price field).
2. Operation log in the store: every edit is `{type, target, before, after}`; undo/redo falls out of it.
3. Small catalogue of real 3D models with known dimensions and licences (bed, desk, sofa, shelf, lamp, rug).
4. Collision against other objects and against the scan (BVH box queries), rotation by free angle, duplicate.
5. Saved layouts: local first, then Supabase (projects, layouts tables; scan assets in storage).
6. Wall colour / flooring: requires separating wall and floor faces in the scan. Start with the fitted
   floor plane and wall planes as overlay surfaces, labelled as an approximation.
7. Lighting applies to added objects only until the scan has albedo.

## Phase 4: AI structured scene editing
Model receives the room envelope + object list, returns operations in the Phase 3 operation schema,
validated before applying, shown as a reviewable diff, undoable one by one.

## Phase 5: real photo / video reconstruction (first slice done, pulled ahead of Phases 3 and 4)
- [x] Upload photos (JPEG, PNG, WebP, HEIC) and video (MP4, MOV, WebM) from the app
- [x] Pipeline: frame selection, Depth Anything 3 depth and poses, TSDF fusion, room fit
- [x] Job progress in the UI, list / open / delete scans, originals deleted after processing
- [x] Learned scale estimate, plus user calibration from one real measurement
- [x] End-to-end browser test with real room photos and a real room video (tests/upload.py)
- [ ] Test with a phone-shot video of normal length (only an 8-frame sample video was available)
- [ ] More than 16 views (chunk the model, align chunks)
- [ ] Higher-resolution depth for sharper surfaces; textures instead of vertex colours
- [ ] Wall / door / window detection; furniture segmentation so scanned objects can be selected
- [ ] Hole filling for unseen areas, clearly marked as synthetic
- [ ] Hosted deployment: GPU worker, object storage, per-user privacy rules

## Phase 6: moodboards, budget, shopping list
## Phase 7: before / after slider, exports, Design Battle with explicit publishing
## Phase 8: performance, accessibility, mobile polish

## Housekeeping
- The demo GLB (10 MB) is committed. If more scans are added, move them to object storage or Git LFS.
- Raw dataset files are not in the repo; `prepare_demo_scan.py` documents its inputs.
