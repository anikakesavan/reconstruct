# Limitations

Honest state at the end of Phase 2.

## Not built
- Uploading photos or video. There is no reconstruction pipeline. `POST /reconstructions` returns 501.
- Detection of walls, doors, windows or furniture as separate objects. The scan is one mesh.
- Furniture catalogue, materials, wall and floor recolouring, lighting controls.
- Undo / redo, saved layouts, duplicate, design comparison.
- AI assistant, style presets, moodboards, budget, before / after, Design Battle, accounts, storage.

## Supported input
Exactly one prepared scan: `apps/web/public/scans/redwood-bedroom/` (`scan.glb` + `room.json`).
The preparation script accepts the Redwood dataset layout only (reconstruction PLY, coloured fragment
PLYs, pose graph JSON). Arbitrary GLB / PLY import is not wired into the UI.

## The demo scan
- Real capture: Redwood Indoor Lidar-RGBD "Bedroom", public domain. Captured in dim light, so it is
  dark; the brightness slider is display-only.
- Reduced from 10.2M to 450k triangles, then floating fragments smaller than 0.5% of faces were removed
  (about 60k triangles), leaving about 390k. Fine detail and thin objects are lost or ragged, which is
  very visible in Walk view.
- Colour was transferred from the dataset's coloured fragments by nearest neighbour
  (median distance 0.9 cm, 95th percentile 3.3 cm). Colours are per vertex, not textures.
- Holes exist wherever the sensor did not see (under furniture, behind objects, windows).

## Dimensions
- Scale comes from the depth sensor, so the scan is in metres. Sensor and reconstruction error of a few
  centimetres should be assumed; nothing was checked against a tape measure.
- Wall positions, room side lengths and ceiling height are **estimated** by plane fitting on the mesh.
  The ceiling in this room is sloped; the app reports only its highest point.
- The fitted bounding footprint (5.59 x 4.69 m) is larger than the dataset's stated floor area
  (21.0 m²) because the room is not a plain rectangle. Both numbers are shown for that reason.
- Measure and Inspect read the decimated surface. Inspect's "floor / wall" label is a guess from the
  surface direction only.

## Editing
- Block-out boxes stop at the estimated wall planes, not at the real walls, and do not collide with
  scanned furniture or with each other.
- Rotation is in 90 degree steps. Boxes sit on the floor plane only.
- Nothing persists. Reloading the page clears all edits.
- Walk view keeps you inside the estimated walls but walks through furniture.

## Test record (11 Nov 2026)
Automated run of `tests/smoke.py` in headless Chrome, production build, at 1440 x 900 (mouse) and
390 x 844 (touch emulation). Observed:
- Scan loads; no console errors or failed requests in either size.
- Orbit, Plan and Walk views render (screenshots reviewed by eye; two are in `docs/`).
- Measure returned a distance after two clicks / taps; Inspect returned a height and surface guess.
- Adding a Desk box opened its inspector; on desktop a mouse drag moved it and it stopped at the wall.
- Walk: W key and look-drag on desktop, on-screen forward key on mobile, produced a view inside the room.

Not tested:
- Any physical phone or tablet. Touch dragging of boxes was not exercised even in emulation.
- Safari and Firefox.
- Screen readers. Controls have roles and labels, but the 3D content itself is not accessible.
- **Frame rate on a GPU.** The test machine had no GPU: Chrome's software renderer drew the 390k
  triangles at 2 to 4 fps, which says nothing useful about real devices. Measure on real hardware
  with the on-screen fps readout (bottom left, desktop) before making any performance claim.

Size: scan 10 MB (uncompressed GLB; Draco or meshopt would cut this substantially, not yet done).
