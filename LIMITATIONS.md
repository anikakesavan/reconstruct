# Limitations

Honest state after the first slice of Phase 5.

## Not built
- Detection of walls, doors, windows or furniture as separate objects. Every scan is one mesh, so
  scanned furniture cannot be selected, moved or removed.
- Furniture catalogue, materials, wall and floor recolouring, lighting controls.
- Undo / redo, saved layouts, duplicate, design comparison.
- AI assistant, style presets, moodboards, budget, before / after, Design Battle, accounts.
- Hosting. The reconstruction service runs on your own computer; there is no cloud version.

## Uploading a room
Supported input: photos (`.jpg .jpeg .png .webp .heic .heif .bmp`) and videos
(`.mp4 .mov .m4v .webm .avi .mkv`), up to 80 files and 600 MB per scan. At least two photos or one video.

What to expect:
- **At most 16 views are used.** Extra photos are thinned evenly; a video is cut into 16 windows and
  the sharpest sampled frame of each is kept. Long walkthroughs of several rooms will not work well.
- **Quality is "rough model", not "photo".** Depth is predicted at about 504 px per view and fused
  into 2 cm voxels with one colour per vertex. Edges are soft, thin objects vanish, mirrors, windows
  and glossy surfaces come out wrong.
- **Holes are normal.** Only surfaces a camera saw are built. Eight photos typically give separate
  patches of wall and furniture rather than a closed room. From outside, walls are see-through by
  design (you look in through their backs).
- **Size is a guess until you calibrate.** The automatic scale comes from a learned depth model. In
  the two test scans its per-view estimates disagreed by 12% and 13%; on a tabletop scene, 30%.
  Calibrating against one taped measurement fixes overall size but not local distortion.
- **Depth and camera positions are predictions, not measurements.** Nothing checks them against
  ground truth. Straight walls can come out slightly bent and separate patches can be misplaced
  relative to each other, more so when photos barely overlap.
- **Floor and walls are fitted, sometimes not found.** If the floor is not in frame, heights are
  measured from the lowest captured point. Walls that were not seen fall back to the edge of the data.
  The room details panel says when either happened.
- Gravity is taken from how the camera was held. Photos shot at odd angles can tilt the room.
- One scan is processed at a time. Calibration is stored in the browser, not with the scan.

Measured on the development machine (2 CPU cores, no graphics card), models already loaded:
8 views took 42 to 45 s, 16 views took 52 s. The first scan also downloads about 1.8 GB of weights.
GPU speed is untested.

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

## Test record (12 Nov 2026)
Automated, headless Chrome against the production build and the live service.

`tests/upload.py` (the real upload flow, driven through the UI):
- 8 phone photos of a bedroom with almost no overlap: built in 100 s including model load; opened
  automatically; room details showed 5.35 x 3.59 m marked estimated.
- An 8-frame video of the same room: built; 5.06 x 3.54 m, consistent with the photo run.
- Measure then "Set scale" rescaled the room and switched scale to measured, at 1440 x 900 (mouse)
  and 390 x 844 (touch emulation). No console errors.
- A non-media file was rejected with a clear 415 message. 25 photos were thinned to 16 and built.
- Found and fixed during testing: on phones the room details panel covered the view switch.

`tests/smoke.py` (sample scan: views, measure, inspect, block-out box, walk) still passes at both sizes.

Not tested:
- A real phone video of normal length, HEIC photos from an iPhone, portrait-orientation video.
- Accuracy against a tape measure. No ground truth was available for the test room.
- Any physical phone or tablet; Safari and Firefox; screen readers.
- A graphics card, for either reconstruction or rendering. Rendering frame rate is still unmeasured:
  the test machine's software renderer drew scans at 2 to 4 fps, which says nothing about real devices.
- Running `scripts/setup.sh` on a clean machine (the development machine was set up by hand with the
  same packages and the same pinned model commit).
