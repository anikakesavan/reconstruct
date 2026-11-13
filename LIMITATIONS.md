# Limitations

Honest state on 12 Nov 2026. "Tested" below means exercised by the scripts in `tests/` through the real interface.

## Scanning

**What you get** is a recognisable layout: straight walls at the estimated size, and a catalogue lookalike for each piece of
furniture that was found, roughly where it stands. It is not a copy of your furniture.

Tested on one real bedroom (8 photos taken from nearly one spot). Result: bed, desk, chair, wardrobe, a side table and a shelf
were placed, with confidences from 31% to 59%; two windows were placed on the correct wall; 17 kinds of clutter (bags, boxes,
pillows, a computer, curtains, posters) were listed as seen but not placed. Placement was checked by eye against the
overlaid scan and lined up for the bed, desk and wardrobe. **Nothing was checked against a tape measure.**

Known weaknesses:
- **Sizes are estimates and often too small.** An object seen from one side measures as only the part that was visible. The
  test bed measured 1.34 x 0.97 m and was raised to the smallest believable bed. Overall scale is a learned guess (views
  disagreed by 11% on the test room) until you calibrate with one real measurement.
- **Things are missed or mislabelled.** Detection depends on a general indoor segmentation model. Low-confidence items
  (under 50%) are flagged; the 31% "shelf" in the test was a poor match.
- **Lookalikes are chosen by size only**, then stretched within 72% to 135%. A metal bunk bed becomes an upholstered bed.
- **Colour** is the median of the object's pixels, so shadows and clutter pull it toward grey. Wall colour is taken from the
  brighter wall pixels. Flooring is the nearest of three materials.
- **Facing** is inferred (headboard height, nearest wall, nearest table) and can be wrong by 90 or 180 degrees.
- **Rooms are rectangles.** Alcoves, angled walls and open-plan spaces are flattened to the bounding rectangle.
- **Neighbouring pieces can start slightly overlapping.** They can be dragged apart, but are not separated automatically.
- No catalogue class exists for curtains, TVs, wall art, radiators or clutter, so those are never placed. Doors are placed
  only when they can be matched to a wall (the test room's door could not).
- At most 16 views are used. Mirrors, glass and bare walls confuse depth.
- The service needs about 4 GB of memory and runs one scan at a time (about 95 s for 8 photos on a 2-core CPU, with the
  models already loaded).
- **The live site cannot scan on its own.** The service must run on your computer, or be hosted (packaged but not yet
  deployed or tested; see `services/reconstruction/HOSTING.md`).

Supported input: `.jpg .jpeg .png .webp .heic .heif .bmp` photos and `.mp4 .mov .m4v .webm .avi .mkv` video, up to 80 files and 600 MB.

## Editor
- **Recolouring changes colour, not material.** Each part keeps its own texture detail, roughness and metalness, so "wood"
  colours on fabric give coloured fabric, not wood grain. Parts are found automatically from the texture and are sometimes
  split oddly (a frame merged with upholstery). Patterns cannot be changed, only swapped by choosing a different rug or pillow.
- **Resizing is by typing** width, height and depth; there are no drag handles. Stretching far from the real size distorts the model.
- Collisions use each piece's bounding box, so an L-shaped or round piece claims its whole rectangle. Chairs may tuck under desks and tables.
- Things placed on furniture snap to its top surface only (not to shelves inside a bookcase).
- Turning snaps to 15 degrees. No multi-select. A downloaded design file cannot be opened again yet.
- Saved designs live in this browser only.
- Lighting is fixed daylight; lamps do not emit light; no ambient occlusion pass. Bounced light is approximated.
- Product models are real retail items shown under generic names (credits in `ASSETS.md`).

## Not built
AI assistant, style presets, moodboards, budget and shopping list, sharing, Design Battle, accounts, cloud saving.

## Test record (12 Nov 2026)
Headless Chrome on a static build served under `/reconstruct/`, as on GitHub Pages.

`tests/editor.py`, passed at 1440 x 900 with a mouse **and** at 390 x 844 with real touch events:
select by drag; drag moves a piece as one undo step; lamp, plant and books follow the desk exactly; dropping a chair into the
dresser returns it with a message; walls stop a floor lamp at the wall; the rotate handle turns a piece; white fabric applies to
a grey armchair; typed resize works and an impossible size is refused with a message; swap; duplicate; add (a bench finds a free
spot, a lamp lands on the selected dresser at its top height); removing the dresser drops what stood on it; wall colour, floor
and moving a window to another wall; save by name, reload, reopen gives identical data; before-and-after shows two views;
measuring 1.00 m reads 1.01 m (0.99 m by touch). No console errors or failed requests.

`tests/upload.py`, desktop, live service, the bedroom photos: upload, progress, room opens with 6 found pieces and the quality
report; overlay toggles; a found piece is selected from the list, recoloured, put back as found; remove and add; autosave
survives reload; before-and-after against the as-found layout.

Found and fixed during testing: the save menu was hidden behind the room panel; on phones the header took three rows and the
editing sheet hid the room; the catalogue opened underneath the editing sheet; comparing redrew continuously.

Not tested: video upload and the scan flow at phone size in this version; a real phone or tablet; Safari and Firefox; screen
readers; frame rate (no graphics card on the test machine); the pipeline on a graphics card; `setup.sh` and the Dockerfile on a
clean machine; any second room.
