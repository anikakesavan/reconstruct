"""Turn numbers from a reconstruction into plain-language feedback about the capture.

Thresholds are deliberately conservative starting points, not validated against a labelled set.
"""
from __future__ import annotations
import numpy as np

BLUR_BELOW = 45.0      # variance of the Laplacian at 320x240
DARK_BELOW = 70.0      # mean grey level, 0 to 255


def assess(frame_stats, n_views, coverage, cam_centres_m, scale, envelope) -> dict:
    issues = []
    add = lambda severity, text: issues.append({"severity": severity, "text": text})

    if n_views < 4:
        add("problem", f"Only {n_views} views. Large parts of the room were never seen, so they are missing. Aim for 8 to 16.")
    elif n_views < 8:
        add("warning", f"Only {n_views} views. Expect gaps; 8 to 16 gives a fuller room.")

    blurry = sum(1 for s in frame_stats if s["sharpness"] < BLUR_BELOW)
    if blurry >= max(2, n_views // 3):
        add("problem", f"{blurry} of {n_views} views are blurred. Move more slowly, or use photos instead of video.")
    elif blurry:
        add("warning", f"{blurry} of {n_views} views are blurred, which softens the surfaces they cover.")

    brightness = float(np.median([s["brightness"] for s in frame_stats]))
    if brightness < DARK_BELOW:
        add("problem" if brightness < 45 else "warning",
            "The footage is dark, so colours come out muddy and depth is less reliable. Turn the lights on and open the curtains.")

    span = float(np.linalg.norm(np.ptp(np.asarray(cam_centres_m), axis=0)))
    if span < 0.4:
        add("problem", "All views were taken from nearly the same spot, so depth is poorly constrained. Move around the room.")
    elif span < 1.0:
        add("warning", "The camera barely moved. Shooting from each corner gives much better coverage.")

    if coverage < 0.5:
        add("warning", "Much of each view was too uncertain to use (often glass, mirrors, glare or bare walls), leaving holes.")

    d = scale.get("disagreement_between_views")
    if scale["confidence"] == "uncalibrated":
        add("warning", "Real-world size could not be estimated. Calibrate with one tape measurement.")
    elif d is not None and d > 0.2:
        add("warning", f"Size estimates from different views disagree by {round(d * 100)}%. Calibrate with one tape measurement before trusting any dimension.")

    if not envelope.get("floor_found", True):
        add("warning", "The floor was not visible, so the room could not be levelled against it. Keep the floor in frame.")
    walls = sum(1 for f in envelope.get("walls_found", {}).values() if f)
    if walls < 2:
        add("warning", f"Only {walls} of 4 walls were clearly seen, so the room size is taken from the edge of what was captured.")

    order = {"problem": 0, "warning": 1}
    issues.sort(key=lambda i: order[i["severity"]])
    level = "poor" if any(i["severity"] == "problem" for i in issues) else "fair" if issues else "good"
    return {"level": level, "issues": issues,
            "numbers": {"views": n_views, "blurred_views": blurry, "median_brightness": round(brightness, 1),
                        "camera_travel_m": round(span, 2), "pixels_kept": round(coverage, 3)}}
