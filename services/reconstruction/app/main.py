"""Reconstruction service. Phase 2 state: serves metadata for the prepared demo scan only.

The upload -> reconstruct pipeline is NOT implemented yet (Phase 5). The /reconstructions
endpoint says so explicitly instead of pretending. See LIMITATIONS.md.
"""
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Reconstruct: reconstruction service", version="0.1.0")
SCANS = Path(__file__).resolve().parents[3] / "apps" / "web" / "public" / "scans"


@app.get("/health")
def health():
    return {"ok": True, "pipeline": "not implemented", "prepared_scans": sorted(p.name for p in SCANS.iterdir() if p.is_dir())}


@app.get("/scans/{scan_id}")
def scan(scan_id: str):
    meta = SCANS / scan_id / "room.json"
    if not meta.is_file() or meta.resolve().parent.parent != SCANS:
        raise HTTPException(404, "Unknown scan")
    return json.loads(meta.read_text())


@app.post("/reconstructions", status_code=501)
def create_reconstruction():
    raise HTTPException(501, "Photo and video reconstruction is planned for Phase 5 and does not exist yet.")
