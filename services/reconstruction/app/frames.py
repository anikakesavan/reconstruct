"""Collect model-ready frames from uploaded photos and videos."""
from __future__ import annotations
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageOps

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp"}
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}
MAX_SIDE = 1280

try:  # HEIC from iPhones
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover
    pass


def _save(img: Image.Image, path: Path):
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    img.save(path, "JPEG", quality=92)


def _sharpness(bgr) -> float:
    g = cv2.cvtColor(cv2.resize(bgr, (320, 240)), cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def _video_frames(path: Path, want: int):
    """Split the video into `want` equal windows and keep the sharpest sampled frame of each."""
    cap = cv2.VideoCapture(str(path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release(); return []
    want = min(want, total)
    per_window = 4 if total >= want * 4 else 1
    picks = []
    for w in range(want):
        a, b = total * w // want, total * (w + 1) // want
        best = None
        for idx in np.linspace(a, max(a, b - 1), per_window).astype(int):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, frame = cap.read()
            if not ok:
                continue
            s = _sharpness(frame)
            if best is None or s > best[0]:
                best = (s, frame)
        if best is not None:
            picks.append(best[1])
    cap.release()
    return picks


def collect(upload_dir: Path, out_dir: Path, max_views: int) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in upload_dir.iterdir() if p.is_file())
    photos = [p for p in files if p.suffix.lower() in IMAGE_EXT]
    videos = [p for p in files if p.suffix.lower() in VIDEO_EXT]
    skipped = [p.name for p in files if p not in photos and p not in videos]
    frames: list[Path] = []
    if len(photos) > max_views:  # keep an even spread, in upload order
        keep = np.linspace(0, len(photos) - 1, max_views).round().astype(int)
        photos = [photos[i] for i in keep]
    for p in photos:
        try:
            img = ImageOps.exif_transpose(Image.open(p))
        except Exception:
            skipped.append(p.name); continue
        dst = out_dir / f"{len(frames):04d}.jpg"; _save(img, dst); frames.append(dst)
    remaining = max_views - len(frames)
    for i, v in enumerate(videos):
        share = remaining // (len(videos) - i) if remaining > 0 else 0
        got = _video_frames(v, share) if share > 0 else []
        if not got and share > 0:
            skipped.append(v.name)
        for bgr in got:
            dst = out_dir / f"{len(frames):04d}.jpg"
            _save(Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)), dst); frames.append(dst)
        remaining -= len(got)
    return {"frames": frames, "photos": len(photos), "videos": len(videos), "skipped": skipped}
