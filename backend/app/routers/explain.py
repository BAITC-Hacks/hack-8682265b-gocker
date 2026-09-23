import json
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from app.routers.graph import get_data_dirs, load_graph_data_from_disk

router = APIRouter(prefix="", tags=["explain"])

_TRACE_CACHE: Optional[Dict[str, Any]] = None


def get_explain_trace(gid: int) -> Dict[str, Any]:
    global _TRACE_CACHE
    raw_dir, out_dir = get_data_dirs()
    trace_path = out_dir / "nodes_role_trace.json"

    if _TRACE_CACHE is None or str(gid) not in _TRACE_CACHE:
        if trace_path.exists():
            try:
                with open(trace_path) as f:
                    _TRACE_CACHE = json.load(f)
            except Exception:
                _TRACE_CACHE = None

        if not _TRACE_CACHE or str(gid) not in _TRACE_CACHE:
            # Recompute or build graph data
            load_graph_data_from_disk()
            if trace_path.exists():
                try:
                    with open(trace_path) as f:
                        _TRACE_CACHE = json.load(f)
                except Exception:
                    pass

    if _TRACE_CACHE and str(gid) in _TRACE_CACHE:
        return _TRACE_CACHE[str(gid)]

    # Fallback lookup from nodes data
    graph = load_graph_data_from_disk()
    node = next((n for n in graph.get("nodes", []) if n["gid"] == gid), None)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node GID {gid} not found")

    # Generate synthetic trace if sidefile missing
    role = node["role"]
    trace = [
        {"rule": "coordinator", "matched": role == "coordinator", "reason": f"Evaluated based on betweenness centrality ({node.get('pagerank', 0):.4f})"},
    ]
    if role != "coordinator":
        trace.append({
            "rule": role,
            "matched": True,
            "reason": node.get("evidence", "Criteria matched for role")
        })

    return {
        "gid": gid,
        "final_role": role,
        "rule_trace": trace,
        "role_score": node.get("role_score", 0.5),
        "priority_score": node.get("priority_score", 0.5)
    }


@router.get("/explain/{gid}")
def explain_node(gid: int):
    return get_explain_trace(gid)
