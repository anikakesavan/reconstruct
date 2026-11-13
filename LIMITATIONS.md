# Limitations

Honest state after the editor rebuild (12 Nov 2026).

## Not built
- AI assistant, style presets, moodboards, budget and shopping list, before / after, Design Battle, accounts, cloud saving.
- Automatic recognition of furniture, doors or windows in a scan.
- Hosted scanning: the reconstruction service runs only on your own computer, so "Scan your room" on the live site reports
  the service as not running unless you start it locally.

## Editor
- **No collisions.** Pieces can overlap each other. They stop at walls using a rotated bounding box, so a turned piece stops slightly early.
- **Things on tables do not follow the table.** A lamp keeps its own position and height if you move the desk under it.
- **Height is typed, not dragged.** New tabletop pieces start at 0.74 m and wall pieces at 1.4 m, in the middle of the room; you move them into place.
- **Recolouring models is a tint** multiplied over their own textures, so dark leather stays dark. Built pieces (beds, desk, chair, rug, print) change fabric colour and wood properly.
- Turning is in 15 degree steps. No resizing of pieces. No multi-select.
- Rooms are rectangles with two windows on one wall. No doors, no window editing.
- The catalogue is small (25 pieces), with no wardrobe, sofa or curtains. There are no prices.
- One design per browser; clearing site data loses it.
- Lighting is fixed daylight. Bounced light is approximated, not simulated; lamps do not emit light.
- The view through the windows is a plain bright panel.

## Scanning
Supported input: photos (`.jpg .jpeg .png .webp .heic .heif .bmp`) and videos (`.mp4 .mov .m4v .webm .avi .mkv`), up to 80
files and 600 MB. At least two photos or one video.

- **A scan is a rough fused surface**, not clean geometry: soft edges, one colour per vertex, holes wherever no camera looked,
  wrong results on mirrors, windows and glossy surfaces. It will not look like the sample room.
- **At most 16 views are used.** Extra photos are thinned; video is sampled.
- **Size is a model's guess** until you calibrate. In tests its per-view estimates disagreed by 11 to 13% on a bedroom and 30% on a tabletop scene.
- **Depth and camera positions are predictions** and are not verified against anything.
- The clean room made from a scan is the scan's bounding rectangle, clamped to 2.2 to 3.6 m high. Alcoves and angled walls are lost.
- The capture-quality thresholds (blur, darkness, camera travel) are sensible starting values, not tuned on labelled data.
- Calibration is stored in the browser, per scan.

## Test record (12 Nov 2026)
Headless Chrome, static build served under `/reconstruct/` exactly as on GitHub Pages.

`tests/editor.py`, at 1440 x 900 with a mouse and 390 x 844 with touch:
- Select a bed by clicking / tapping it; inspector opens with the right piece.
- Mouse drag moved it by the expected amount as one undo step; dragging past the wall stopped it at the wall (desktop only).
- Turn, fabric colour, wood finish, swap for another bed, duplicate, remove, add a plant from the catalogue: all changed the scene data as expected.
- Undo walked every step back to the exact sample layout; redo was available.
- Wall colour and floor changed and survived a page reload.
- Measuring two points 2.00 m apart on the floor read 2.00 m (2.01 m by touch).
- No console errors and no failed asset requests.

`tests/upload.py`, desktop, against the live service with 8 real bedroom photos:
- Built in 67 s; the scan opened; furniture was hidden and "Add furniture" disabled while only the raw scan was shown.
- Quality report correctly said the camera had barely moved (0.69 m of travel).
- Calibrating a measured line rescaled the scan. "Make a clean room this size" produced a 5.75 x 3.40 m room; a bed was added into it.

Screenshots were reviewed by eye at both sizes.

Not tested:
- Touch dragging of furniture (tap-select and every button were tested; the drag gesture was not).
- The scan flow on a phone-sized screen in this version, and a video upload in this version (video worked in the previous one).
- A real phone or tablet, Safari, Firefox, screen readers.
- Frame rate. The test machine has no graphics card. The previous version ran at 60 fps on the owner's laptop with a heavier scene; this one has not been measured.
- The pipeline on a graphics card; `setup.sh` on a clean machine; accuracy against a tape measure.
