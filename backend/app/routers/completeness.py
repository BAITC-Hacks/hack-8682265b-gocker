import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.routers.graph import get_data_dirs, load_graph_data_from_disk

router = APIRouter(prefix="", tags=["completeness"])


@router.get("/data-gaps")
def get_data_gaps():
    raw_dir, out_dir = get_data_dirs()
    gaps_file = out_dir / "data_gaps.json"

    if not gaps_file.exists():
        # Ensure graph data is loaded / pipeline executed
        load_graph_data_from_disk()

    if not gaps_file.exists():
        raise HTTPException(status_code=404, detail="Data completeness gaps report not found")

    with open(gaps_file) as f:
        return json.load(f)
