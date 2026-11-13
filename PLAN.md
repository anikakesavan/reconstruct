# Plan

Update this file at the end of every session.

## Done
- **Scan to editable room**: depth and poses, room fit, furniture / window / door detection lifted to 3D, catalogue matching, confidence per item, raw-scan overlay, scale calibration.
- **Catalogue**: 77 pieces (60 ABO product models, 12 Poly Haven), built by script with sizes, top surfaces and recolourable parts; thumbnails rendered from the models.
- **Editor**: select, drag (mouse and touch), rotate handle, typed resize, swap, duplicate, remove, put back, add; collisions, wall snapping, parent-child; per-part recolouring; undo / redo.
- **Room**: wall colour (any), three floors, size, windows and doors on any wall.
- **Saving**: autosave, named designs in the browser, download as a file. **Before and after** slider.
- **Views**: orbit, plan, walk; measure. Phone layout with a foldable editing sheet.
- **Deployment**: GitHub Pages on every push; container recipe for hosting the scan service (untested).

## Next (in order)
1. **Host the scan service** (see `services/reconstruction/HOSTING.md`): build the container, deploy, set `RECONSTRUCT_API`. Needs an account from the owner.
2. **Check accuracy against a tape measure** on two or three real rooms and record the errors; tune the detection thresholds from that.
3. **Detection quality**: resolve overlaps between neighbouring detections, use more views (chunked inference), handle non-rectangular rooms, place wall art, curtains and TVs (need catalogue classes).
4. **Match appearance better**: choose the catalogue piece by shape and colour, not size alone; estimate colour from well-lit pixels only.
5. **Materials**: swap texture sets (weaves, wood species, rug patterns), not only colour; per-part roughness and metalness.
6. **Editor**: drag-to-resize handles, multi-select, free rotation, open a downloaded design file, ambient occlusion pass.
7. AI assistant emitting the same edit operations; style presets; budget and shopping list; shareable links.

## Known gaps
- No normal-length phone video, iPhone HEIC, or graphics-card run has been tested.
- `setup.sh` and the Dockerfile have not been run on a clean machine.
- Frame rate on low-end phones is unmeasured.
