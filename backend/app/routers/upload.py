import io
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd

from app.pipeline.dataset_manager import (
    get_dataset_status,
    reset_to_sample_dataset,
    ingest_custom_data,
    get_active_data_dirs,
    get_custom_dirs,
)
from app.pipeline.run import run_pipeline
from app.routers.graph import invalidate_cache, load_graph_data_from_disk

router = APIRouter(prefix="/dataset", tags=["dataset"])


@router.get("/status")
def status_endpoint():
    return get_dataset_status()


@router.post("/reset")
def reset_endpoint():
    status = reset_to_sample_dataset()
    invalidate_cache()
    try:
        load_graph_data_from_disk()
    except Exception as e:
        print(f"Warning: Failed to reload sample graph cache: {e}")
    return {"status": "success", "message": "Restored baseline case data", "dataset": status}


@router.post("/upload")
async def upload_dataset_endpoint(
    edges_file: Optional[UploadFile] = File(None),
    nodes_file: Optional[UploadFile] = File(None),
    tx_file: Optional[UploadFile] = File(None),
    zip_file: Optional[UploadFile] = File(None),
    seed_gids: Optional[str] = Form(None),
    dataset_name: Optional[str] = Form(None),
    enable_llm: bool = Form(False),
):
    edges_bytes = await edges_file.read() if edges_file else None
    edges_name = edges_file.filename if edges_file else None

    nodes_bytes = await nodes_file.read() if nodes_file else None
    nodes_name = nodes_file.filename if nodes_file else None

    tx_bytes = await tx_file.read() if tx_file else None
    tx_name = tx_file.filename if tx_file else None

    zip_bytes = await zip_file.read() if zip_file else None

    if not edges_bytes and not zip_bytes:
        raise HTTPException(
            status_code=400,
            detail="Please provide at least an edges/transfers file (.parquet or .csv) or a .zip archive."
        )

    try:
        ingest_res = ingest_custom_data(
            edges_content=edges_bytes,
            edges_filename=edges_name,
            nodes_content=nodes_bytes,
            nodes_filename=nodes_name,
            tx_content=tx_bytes,
            tx_filename=tx_name,
            zip_content=zip_bytes,
            seed_gids_text=seed_gids,
            dataset_name=dataset_name,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data ingestion error: {str(e)}")

    # Execute full pipeline on custom data
    custom_raw, custom_out = get_custom_dirs()
    try:
        pipeline_summary = run_pipeline(custom_raw, custom_out, enable_llm=enable_llm)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline computation failed: {str(e)}")

    invalidate_cache()
    try:
        load_graph_data_from_disk()
    except Exception as e:
        print(f"Warning: Failed to reload graph cache after upload: {e}")

    return {
        "status": "success",
        "ingest": ingest_res,
        "pipeline": pipeline_summary,
        "dataset": get_dataset_status(),
    }


@router.get("/export/referral")
def export_referral_dossier(min_priority: float = 0.0, role_filter: Optional[str] = None):
    _, out_dir = get_active_data_dirs()
    nodes_csv = out_dir / "nodes_roles.csv"
    if not nodes_csv.exists():
        raise HTTPException(status_code=404, detail="Pipeline outputs not found. Please run the pipeline first.")

    df = pd.read_csv(nodes_csv)

    # Sort descending by priority_score
    df = df.sort_values(by="priority_score", ascending=False).reset_index(drop=True)

    if min_priority > 0.0:
        df = df[df["priority_score"] >= min_priority]

    if role_filter and role_filter != "all":
        df = df[df["role"] == role_filter]

    # Prepare formal inquiry dossier columns
    df["rank"] = range(1, len(df) + 1)

    export_cols = [
        "rank",
        "gid",
        "role",
        "priority_score",
        "evidence",
        "in_kzt",
        "out_kzt",
        "pass_through",
        "in_deg",
        "out_deg",
        "is_seed",
        "cluster_id",
    ]
    # Include advanced flags if present
    for opt_col in ["in_cycle", "rapid_transit", "structuring_risk", "turnaround_hours"]:
        if opt_col in df.columns:
            export_cols.append(opt_col)

    final_df = df[[c for c in export_cols if c in df.columns]].copy()
    final_df.rename(columns={
        "rank": "Rank",
        "gid": "Client_GID",
        "role": "Assigned_Role",
        "priority_score": "Priority_Score",
        "evidence": "AML_Role_Evidence_Rationale",
        "in_kzt": "Total_Incoming_KZT",
        "out_kzt": "Total_Outgoing_KZT",
        "pass_through": "Pass_Through_Ratio",
        "in_deg": "Incoming_Counterparties",
        "out_deg": "Outgoing_Counterparties",
        "is_seed": "Is_Law_Enforcement_Seed",
        "cluster_id": "Cluster_ID",
        "in_cycle": "Circular_Loop_Flag",
        "rapid_transit": "Rapid_Transit_Flag",
        "structuring_risk": "Structuring_Risk_Flag",
        "turnaround_hours": "Turnaround_Hours",
    }, inplace=True)

    stream = io.StringIO()
    final_df.to_csv(stream, index=False)
    stream.seek(0)

    filename = "law_enforcement_inquiry_referral_list.csv"
    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
