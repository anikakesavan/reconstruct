# Design system

## Idea

A **daylight studio**. The room is the only colourful thing on screen; everything around it is quiet, pale and out of the way,
the way a photographer's backdrop is. Controls are white cards that float over the scene and appear only when they are useful.

(The first version used a dark green cutting-mat grid with yellow accents and hard-edged panels. It suited a raw scan
viewer and fought with a furnished interior, so it was replaced.)

## Colour

| Token | Hex | Use |
|---|---|---|
| `studio` | `#e2e5e1` | Backdrop behind the room (also the 3D clear colour) |
| `panel` | `#ffffff` | Cards |
| `wash` | `#f3f5f2` | Hover, wells, thumbnails |
| `line` | `#dde0db` | Borders and dividers |
| `ink` | `#17211e` | Text, active view |
| `ink-soft` | `#5c6965` | Secondary text, labels |
| `accent` | `#1f6f5c` | Primary action, active tool, selection frame, measurements |
| `accent-wash` | `#e2efea` | Active tool background |

One accent. No gradients, glows or blur. Warning notes use a pale amber (`#fdf1dc`) only for capture-quality feedback.

## Type

**Bricolage Grotesque** (variable), self-hosted. Display: optical size 60, width 84, weight 700 to 800, tracking -0.02em.
Text: optical size 14, width 96, 12.5 to 15 px. Numbers use tabular figures of the same family. Sentence case throughout.

## Shape

- Cards (`.panel`): 10 px radius, 1 px `line` border, one soft shadow.
- Buttons (`.btn`): 7 px radius, 40 px minimum height; `.btn-primary` is solid accent.
- Swatches are circles; material choices are small image tiles; the selected one gets an accent ring.
- Selected furniture gets a thin accent wireframe box drawn over everything.

## Layout

```
[Reconstruct | name] [Room] [undo redo] [Scan your room]            [Orbit Walk Plan]
┌───────────┐                                                       ┌────────────┐
│ Room      │                    the room                           │ Selected    │
│ (toggle)  │              (canvas is the whole screen)             │ piece       │
└───────────┘                                                       └────────────┘
                         [catalogue drawer, when adding]
                         [ Move | Measure | Add furniture ]
```

Phones: the view switch wraps under the top row, the Room card starts closed, the selected-piece card becomes a sheet above the toolbar.

## 3D lighting and materials

- Output sRGB, ACES filmic tone mapping, exposure 1.
- An HDR studio environment (intensity 0.75) for soft ambient light and reflections, a hemisphere fill, and one warm
  directional light from the window side casting soft (variance) shadows.
- Physically based materials with colour, normal and roughness maps. Walls are matte paint with a small self-lit term standing
  in for bounced light, which is not simulated.
- Walls are single-sided so the ones nearest the camera vanish and the room reads as a cut-away model.
- Scans are drawn unlit with their captured colours, because those already contain the real room's lighting.
- The scene redraws only when something changes (continuous only in Walk).

## Motion

Only in response to an action: cards fade and shift 8 to 12 px over 140 to 180 ms. `prefers-reduced-motion` removes it.

## Confidence marks

Dimensions that come from a scan carry `estimated` (dashed), `uncalibrated` (amber) or `measured` (solid). Dimensions the user typed carry none.
