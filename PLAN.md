# Plan

Update this file at the end of every session.

## Done
- **Design system** (twice: the second, bright version is current; see DESIGN_SYSTEM.md).
- **Sample room**: designed bedroom from CC0 models and built pieces, every part a separate object.
- **Furniture editor**: select, drag with 5 cm snap and wall limits, turn in 15 degree steps, recolour, wood finish, swap,
  duplicate, remove, add from a 25-piece catalogue, height off the floor, undo / redo, saved in the browser.
- **Room editing**: wall colour, three floors, width / depth / height.
- **Views and tools**: orbit, plan, walk; measure.
- **Lighting and materials**: HDR environment, daylight with soft shadows, PBR materials, tone mapping.
- **Scanning**: upload photos or video, reconstruction service, progress, capture-quality report, scale calibration,
  clean room sized from a scan with the scan as a guide.
- **Deployment**: GitHub Pages, rebuilt on every push.

## Next (in order)
1. **Collisions**: stop pieces overlapping each other; let tabletop items snap onto the surface under them; let wall items snap to walls.
2. **Free rotation and resize handles** in the viewport, plus multi-select.
3. **Bigger catalogue**: wardrobe, sofa, floor lamp, curtains, bedside lamp, more beds. Needs more CC0 sources or more built pieces.
4. **Named saved designs** and side-by-side comparison (browser storage first, then Supabase).
5. **AI assistant** that emits the same edit operations the UI uses, shown as a reviewable, undoable list.
6. **Scan understanding**: automatic furniture, door and window detection (see ARCHITECTURE.md, "Hybrid approach"); non-rectangular rooms.
7. Style presets, moodboards, budget and shopping list, before / after slider, Design Battle.
8. Hosted reconstruction (GPU worker, storage, accounts).

## Known gaps to close along the way
- Test a real, normal-length phone video and iPhone HEIC photos.
- Try the GPU path of the pipeline (resolution choices for CUDA are untested).
- Run `setup.sh` on a clean machine.
- Measure frame rate on low-end phones.
- Lights you can add and move (the desk lamp is decoration only).
