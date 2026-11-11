# Reconstruct

Scan a room, then rearrange it in 3D before you buy or move anything.

![The editor showing a real scanned bedroom](docs/editor-desktop.png)

**Status: Phases 1 and 2 of 8.** What exists today is a 3D viewer and a small editor running on one
prepared, real room scan. Uploading your own photos or video, the furniture catalogue, the AI assistant,
budgets and sharing are not built yet. `PLAN.md` has the roadmap and `LIMITATIONS.md` says exactly what
does and does not work.

## Run it

```bash
cd apps/web
npm install
npm run dev          # http://localhost:3000
```

Optional metadata service (Python 3.11+):

```bash
cd services/reconstruction
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## What you can do now

- Orbit, pan and zoom around a real scanned bedroom; walk through it in first person; view it in plan.
- Measure between any two points on the scan, and read the height of any point.
- Add furniture-sized block-out boxes, drag them on the floor (5 cm snap, stopped by the estimated walls),
  resize, turn and remove them.
- See which dimensions are estimated and which were stated by the data source.

Keys: `V` move, `I` inspect, `M` measure, `B` block out, `1` `2` `3` views, `R` turn, `Delete` remove, `Esc` clear.

## Documents

- `ARCHITECTURE.md`: how the code is organised and why
- `DESIGN_SYSTEM.md`: the visual language and its tokens
- `PLAN.md`: phases, what is done, what is next
- `LIMITATIONS.md`: known limits, supported inputs, test results

## Demo scan credit

The bedroom is the "Bedroom" scene from the Redwood Indoor Lidar-RGBD Scan Dataset
(Park, Zhou, Koltun, *Colored Point Cloud Registration Revisited*, ICCV 2017), which its authors
placed in the public domain with a request for attribution. http://redwood-data.org/indoor_lidar_rgbd/
