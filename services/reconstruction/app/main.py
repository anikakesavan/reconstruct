"""Reconstruction service: upload photos or video of a room, get back a 3D scan.

POST   /reconstructions            multipart `files` (+ optional `title`) -> {id}
GET    /reconstructions            list
GET    /reconstructions/{id}       status and progress
GET    /reconstructions/{id}/scan.glb | room.json
DELETE /reconstructions/{id}       remove the scan and everything derived from it
"""
import os, re
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import jobs
from .frames import IMAGE_EXT, VIDEO_EXT

MAX_FILES = 80
MAX_BYTES = int(os.environ.get("RECONSTRUCT_MAX_UPLOAD_MB", "600")) * 1024 * 1024
ORIGINS = os.environ.get("RECONSTRUCT_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://anikakesavan.github.io").split(",")


@asynccontextmanager
async def lifespan(_: FastAPI):
    jobs.start_worker()
    yield


app = FastAPI(title="Reconstruct: reconstruction service", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST", "DELETE"], allow_headers=["*"])


def _public(job: dict) -> dict:
    return {k: job.get(k) for k in ("id", "title", "status", "stage", "progress", "message", "error", "created")}


def _job(job_id: str) -> dict:
    try:
        return jobs.read(job_id)
    except KeyError:
        raise HTTPException(404, "No such scan")


@app.get("/health")
def health():
    from . import pipeline
    return {"ok": True, "device": pipeline._device(), "geometry_model": pipeline.GEOMETRY_MODEL,
            "metric_model": pipeline.METRIC_MODEL or None, "max_views": pipeline.MAX_VIEWS}


@app.post("/reconstructions", status_code=202)
async def create(files: list[UploadFile] = File(...), title: str = Form("My room")):
    if not files or len(files) > MAX_FILES:
        raise HTTPException(400, f"Send between 1 and {MAX_FILES} files.")
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in IMAGE_EXT | VIDEO_EXT:
            raise HTTPException(415, f"{f.filename}: only photos ({', '.join(sorted(IMAGE_EXT))}) and videos ({', '.join(sorted(VIDEO_EXT))}) are supported.")
    job_id, up = jobs.create(title.strip()[:80] or "My room")
    total = 0
    try:
        for i, f in enumerate(files):
            ext = Path(f.filename or "").suffix.lower()
            stem = re.sub(r"[^A-Za-z0-9_-]", "_", Path(f.filename or "file").stem)[:40]
            with open(up / f"{i:03d}_{stem}{ext}", "wb") as out:
                while chunk := await f.read(1 << 20):
                    total += len(chunk)
                    if total > MAX_BYTES:
                        raise HTTPException(413, f"Upload is larger than {MAX_BYTES >> 20} MB. Use a shorter video or fewer photos.")
                    out.write(chunk)
    except Exception:
        jobs.delete(job_id)
        raise
    jobs.submit(job_id)
    return _public(jobs.read(job_id))


@app.get("/reconstructions")
def list_jobs():
    return [_public(j) for j in jobs.list_all()]


@app.get("/reconstructions/{job_id}")
def status(job_id: str):
    return _public(_job(job_id))


@app.get("/reconstructions/{job_id}/{name}")
def asset(job_id: str, name: str):
    if name not in ("scan.glb", "room.json"):
        raise HTTPException(404, "Not found")
    if _job(job_id)["status"] != "done":
        raise HTTPException(409, "This scan is not ready yet.")
    return FileResponse(jobs.job_dir(job_id) / name, media_type="model/gltf-binary" if name.endswith(".glb") else "application/json")


@app.delete("/reconstructions/{job_id}", status_code=204)
def remove(job_id: str):
    if _job(job_id)["status"] in ("queued", "running"):
        raise HTTPException(409, "Wait for this scan to finish before deleting it.")
    jobs.delete(job_id)
