import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.routers.graph import get_data_dirs, load_graph_data_from_disk

router = APIRouter(prefix="", tags=["sensitivity"])


@router.get("/sensitivity")
def get_sensitivity():
    raw_dir, out_dir = get_data_dirs()
    sens_file = out_dir / "sensitivity.json"

    if not sens_file.exists():
        # Trigger graph load or pipeline to ensure files exist
        load_graph_data_from_disk()

    if not sens_file.exists():
        raise HTTPException(status_code=404, detail="Sensitivity data not found")

    with open(sens_file) as f:
        return json.load(f)
