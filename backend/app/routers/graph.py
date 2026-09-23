import os
import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
import pandas as pd

router = APIRouter(prefix="", tags=["graph"])

_GRAPH_CACHE: Optional[Dict[str, Any]] = None


def get_data_dirs() -> tuple[Path, Path]:
    if Path("/data/raw").exists():
        return Path("/data/raw"), Path("/data/output")
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    raw_dir = project_root / "data" / "raw"
    out_dir = project_root / "data" / "output"
    return raw_dir, out_dir


def invalidate_cache() -> None:
    global _GRAPH_CACHE
    _GRAPH_CACHE = None


def load_graph_data_from_disk() -> Dict[str, Any]:
    global _GRAPH_CACHE
    if _GRAPH_CACHE is not None:
        return _GRAPH_CACHE

    raw_dir, out_dir = get_data_dirs()
    nodes_csv = out_dir / "nodes_roles.csv"
    clusters_csv = out_dir / "clusters.csv"
    edges_parquet = raw_dir / "edges.parquet"
    resilience_json = out_dir / "resilience.json"

    if not nodes_csv.exists() or not edges_parquet.exists():
        from app.pipeline.run import run_pipeline
        run_pipeline(raw_dir, out_dir, enable_llm=False)

    df_nodes = pd.read_csv(nodes_csv)
    df_clusters = pd.read_csv(clusters_csv) if clusters_csv.exists() else pd.DataFrame()
    df_edges = pd.read_parquet(edges_parquet)

    resilience_data = None
    if resilience_json.exists():
        try:
            with open(resilience_json) as f:
                resilience_data = json.load(f)
        except Exception:
            pass

    # Format nodes
    nodes: List[Dict[str, Any]] = []
    for r in df_nodes.itertuples(index=False):
        pass_through_val = None if pd.isna(r.pass_through) else float(r.pass_through)
        gid_val = int(getattr(r, "gid", getattr(r, "id", 0)))
        turnaround_val = None
        if hasattr(r, "turnaround_hours") and not pd.isna(r.turnaround_hours):
            turnaround_val = round(float(r.turnaround_hours), 1)
        nodes.append({
            "id": str(gid_val),
            "gid": gid_val,
            "role": str(r.role),
            "role_score": float(r.role_score),
            "cluster_id": int(r.cluster_id),
            "priority_score": float(r.priority_score),
            "evidence": str(r.evidence),
            "in_deg": int(r.in_deg),
            "out_deg": int(r.out_deg),
            "in_kzt": float(r.in_kzt),
            "out_kzt": float(r.out_kzt),
            "pagerank": float(r.pagerank),
            "pass_through": pass_through_val,
            "depth": int(r.depth),
            "is_seed": bool(r.is_seed),
            "truncated_by_depth": bool(r.truncated_by_depth),
            "in_cycle": bool(getattr(r, "in_cycle", False)),
            "rapid_transit": bool(getattr(r, "rapid_transit", False)),
            "structuring_risk": bool(getattr(r, "structuring_risk", False)),
            "turnaround_hours": turnaround_val,
        })

    # Format edges
    edges: List[Dict[str, Any]] = []
    for r in df_edges.itertuples(index=False):
        edges.append({
            "id": f"{r.src}->{r.dst}",
            "source": str(r.src),
            "target": str(r.dst),
            "sum_kzt": float(r.sum_kzt),
            "n_tx": int(r.n_tx),
            "depth": int(r.depth),
        })

    # Format clusters
    clusters: List[Dict[str, Any]] = []
    if not df_clusters.empty:
        for r in df_clusters.itertuples(index=False):
            top_gids = [int(g) for g in str(r.top_gids).split(";") if g.strip()]
            clusters.append({
                "cluster_id": int(r.cluster_id),
                "n_nodes": int(r.n_nodes),
                "n_seed": int(r.n_seed),
                "sum_kzt_internal": float(r.sum_kzt_internal),
                "top_gids": top_gids,
                "hypothesis": str(r.hypothesis),
            })

    # Summary
    role_counts = df_nodes["role"].value_counts().to_dict()
    total_volume = float(df_edges["sum_kzt"].sum())

    payload = {
        "nodes": nodes,
        "edges": edges,
        "clusters": clusters,
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "total_seed": int(df_nodes["is_seed"].sum()),
            "total_volume_kzt": total_volume,
            "roles": role_counts,
            "clusters_count": len(clusters),
            "resilience": resilience_data,
        }
    }

    _GRAPH_CACHE = payload
    return payload


@router.get("/graph")
def get_graph():
    return load_graph_data_from_disk()


@router.get("/graph/node/{gid}")
def get_node(gid: int):
    data = load_graph_data_from_disk()
    target_node = next((n for n in data["nodes"] if n["gid"] == gid), None)
    if not target_node:
        raise HTTPException(status_code=404, detail=f"Node {gid} not found in graph")

    gid_str = str(gid)
    incoming = [e for e in data["edges"] if e["target"] == gid_str]
    outgoing = [e for e in data["edges"] if e["source"] == gid_str]

    return {
        "node": target_node,
        "incoming_edges": incoming,
        "outgoing_edges": outgoing,
        "neighbors_count": len(incoming) + len(outgoing),
    }


@router.get("/graph/top")
def get_top_nodes():
    _, out_dir = get_data_dirs()
    top_csv = out_dir / "top_nodes.csv"
    if not top_csv.exists():
        load_graph_data_from_disk()

    df_top = pd.read_csv(top_csv)
    return df_top.to_dict(orient="records")
