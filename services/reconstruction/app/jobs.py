"""One-at-a-time reconstruction jobs, stored as plain folders so they survive a restart."""
from __future__ import annotations
import json, os, queue, shutil, threading, time, traceback, uuid
from pathlib import Path

DATA = Path(os.environ.get("RECONSTRUCT_DATA_DIR", Path(__file__).resolve().parents[1] / "data")) / "jobs"
KEEP_UPLOADS = os.environ.get("RECONSTRUCT_KEEP_UPLOADS", "") == "1"
_queue: "queue.Queue[str]" = queue.Queue()
_lock = threading.Lock()


def job_dir(job_id: str) -> Path:
    if not job_id.isalnum():
        raise KeyError(job_id)
    return DATA / job_id


def read(job_id: str) -> dict:
    f = job_dir(job_id) / "job.json"
    if not f.is_file():
        raise KeyError(job_id)
    return json.loads(f.read_text())


def _write(job_id: str, **patch) -> dict:
    with _lock:
        f = job_dir(job_id) / "job.json"
        job = json.loads(f.read_text()) if f.is_file() else {}
        job.update(patch, updated=time.time())
        tmp = f.with_suffix(".tmp"); tmp.write_text(json.dumps(job)); tmp.replace(f)
        return job


def create(title: str) -> tuple[str, Path]:
    job_id = uuid.uuid4().hex[:12]
    up = job_dir(job_id) / "uploads"; up.mkdir(parents=True)
    _write(job_id, id=job_id, title=title, status="queued", stage="queued", progress=0.0,
           message="Waiting to start", error=None, created=time.time())
    return job_id, up


def submit(job_id: str):
    _queue.put(job_id)


def list_all() -> list[dict]:
    if not DATA.is_dir():
        return []
    jobs = []
    for d in DATA.iterdir():
        try:
            jobs.append(read(d.name))
        except Exception:
            continue
    return sorted(jobs, key=lambda j: -j.get("created", 0))


def delete(job_id: str):
    d = job_dir(job_id)
    if not d.is_dir():
        raise KeyError(job_id)
    shutil.rmtree(d)


def _worker():
    from .pipeline import reconstruct, ReconstructionError
    while True:
        job_id = _queue.get()
        d = job_dir(job_id)
        try:
            if not d.is_dir():
                continue
            title = read(job_id).get("title", "Uploaded room")
            _write(job_id, status="running", stage="frames", message="Starting")
            reconstruct(d / "uploads", d, lambda st, p, msg: _write(job_id, stage=st, progress=p, message=msg), title)
            _write(job_id, status="done", stage="done", progress=1.0, message="Ready")
        except ReconstructionError as e:
            _write(job_id, status="failed", error=str(e), message="Could not reconstruct")
        except Exception as e:
            traceback.print_exc()
            _write(job_id, status="failed", message="Could not reconstruct",
                   error=f"Unexpected error in the reconstruction service ({type(e).__name__}). See the service log.")
        finally:
            if not KEEP_UPLOADS and d.is_dir():  # originals are not kept once processed
                shutil.rmtree(d / "uploads", ignore_errors=True); shutil.rmtree(d / "frames", ignore_errors=True)


def start_worker():
    # jobs interrupted by a restart cannot resume: their uploads may be half-processed
    for j in list_all():
        if j.get("status") in ("queued", "running"):
            _write(j["id"], status="failed", message="Could not reconstruct", error="The service restarted before this finished. Upload again.")
    threading.Thread(target=_worker, daemon=True, name="reconstruct-worker").start()
