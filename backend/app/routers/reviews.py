from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import pandas as pd
from app.db import upsert_review, get_all_reviews, get_escalated_reviews
from app.routers.graph import get_data_dirs, load_graph_data_from_disk
from app.pipeline.export_pdf import generate_request_list_pdf

router = APIRouter(prefix="", tags=["reviews"])


class ReviewRequest(BaseModel):
    status: str  # escalated | cleared | unreviewed
    note: Optional[str] = None
    reviewed_by: Optional[str] = "analyst"


@router.post("/reviews/{gid}")
def update_review(gid: int, req: ReviewRequest):
    valid_statuses = {"unreviewed", "escalated", "cleared"}
    if req.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{req.status}'. Must be one of: {', '.join(valid_statuses)}"
        )
    result = upsert_review(
        gid=gid,
        status=req.status,
        note=req.note,
        reviewed_by=req.reviewed_by or "analyst"
    )
    return result


@router.get("/reviews")
def list_reviews():
    return get_all_reviews()


@router.get("/reviews/export")
def export_reviews_pdf():
    escalated = get_escalated_reviews()
    if not escalated:
        # If none escalated yet, pick the top 5 candidates as draft sample or return empty template
        pass

    # Load graph nodes & clusters to enrich the PDF export
    graph_data = load_graph_data_from_disk()
    nodes_map = {n["gid"]: n for n in graph_data.get("nodes", [])}
    clusters_map = {c["cluster_id"]: c.get("hypothesis", "") for c in graph_data.get("clusters", [])}

    records_to_export = []
    total_export_turnover = 0.0

    # If no reviews are escalated, export top 5 priority nodes marked as pending escalation review
    items_to_process = escalated
    if not items_to_process:
        top_nodes = sorted(graph_data.get("nodes", []), key=lambda x: x.get("priority_score", 0), reverse=True)[:5]
        items_to_process = [{"gid": n["gid"], "status": "draft_priority", "note": "Auto-selected top priority node for review"} for n in top_nodes]

    for item in items_to_process:
        gid = item["gid"]
        node_info = nodes_map.get(gid, {})
        c_id = node_info.get("cluster_id")
        hypothesis = clusters_map.get(c_id, f"Cluster {c_id}")
        turnover = float(node_info.get("in_kzt", 0.0)) + float(node_info.get("out_kzt", 0.0))
        total_export_turnover += turnover

        records_to_export.append({
            "gid": gid,
            "role": node_info.get("role", "unknown"),
            "priority_score": node_info.get("priority_score", 0.0),
            "cluster_id": c_id,
            "evidence": node_info.get("evidence", ""),
            "cluster_hypothesis": hypothesis,
            "note": item.get("note", "")
        })

    pdf_bytes = generate_request_list_pdf(records_to_export, total_export_turnover)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=aml_escalated_request_list.pdf",
            "Content-Type": "application/pdf"
        }
    )
