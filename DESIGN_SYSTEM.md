# Design system

## Idea

The scanned room is a **maquette sitting on a cutting mat**. Model makers work on a green self-healing
mat with a printed grid; the mat is both the surface and the ruler. Here the grid is real: each square
is 0.5 m. Interface panels are pieces of white foam board laid on the mat, with a hard "cut edge"
instead of a soft shadow. The one accent is tape-measure yellow, used only for what the user is
acting on: the active tool, the selected object, a measurement.

This was chosen over the first draft (cream paper, serif headlines, terracotta, hairline rules,
monospace labels), which is the look most generated interfaces converge on and says nothing about rooms.

## Colour

| Token | Hex | Use |
|---|---|---|
| `mat` | `#1e4d43` | Viewport ground |
| `mat-deep` | `#143830` | Page behind the canvas, browser theme colour |
| `mat-line` | `#7fb3a3` | Text set directly on the mat; grid uses `#4f8676` / `#8fc2b2` |
| `board` | `#f3f5f4` | Panels |
| `board-edge` | `#cfd6d3` | Dividers and hover inside panels |
| `ink` | `#12211d` | Text, borders, the cut-edge shadow |
| `ink-soft` | `#4d5f5a` | Secondary text |
| `tape` | `#f2c230` | Active tool, selection, measurements. Always with ink text. |

No gradients, no blur, no glow.

## Type

One family: **Bricolage Grotesque** (variable; weight, width and optical size axes), self-hosted
through Fontsource.

- Display (`.display`): optical size 60, width 82, weight 700 to 800, tracking -0.02em. Panel titles, the wordmark.
- Text: optical size 14, width 96. 13 to 15 px in panels.
- Numbers (`.figures`): tabular lining figures in the same family. No monospace.
- Sentence case everywhere. No all-caps labels.

## Shape

- Panels (`.board`): 1 px ink border, 3 px radius, shadow `3px 3px 0 rgb(18 33 29 / .55)` with no blur.
- Controls inside panels: 2 px radius, 1 px ink border, minimum 40 px tall (48 px in the tool rail).
- Focus: 2 px outline, tape yellow on the mat, ink on boards.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [Reconstruct  scan name][Room details]        [Orbit|Walk|Plan] │
│ ┌─────────────┐                                ┌────────────┐ │
│ │ Room sheet  │        the room                │ Inspector  │ │
│ │ (optional)  │   (canvas is the whole screen) │ (only when │ │
│ └─────────────┘                                │  relevant) │ │
│ status line          [Move Inspect Measure Block out]         │
└──────────────────────────────────────────────────────────────┘
```

Under 640 px: the room sheet starts closed, the inspector becomes a sheet above the tool rail, and the
status line is hidden. Portrait screens get a higher camera so the whole room fits.

## Confidence marks

`estimated` and `stated` use a dashed outline; `measured` uses a solid ink fill. Every dimension
shown in a panel carries one. Readings from the Measure and Inspect tools carry a sentence about
their error instead.

## Motion

Only in response to an action: panels fade and shift 8 to 12 px over 150 to 180 ms. Nothing animates on
its own. `prefers-reduced-motion` removes it.

## Reference interfaces

Notes from prior familiarity with these tools, not a fresh audit this session:
Figma (canvas first, tools in a bottom rail, properties appear on selection), Spline (3D viewport with a
contextual right panel), consumer room planners (plan / 3D toggle, catalogue drawer). Taken: canvas
first, contextual inspector, bottom tool rail reachable by thumb. Deliberately not taken: permanent
left and right sidebars, dark neutral chrome, icon-only toolbars.
