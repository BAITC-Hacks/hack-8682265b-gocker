import json
from pathlib import Path
from typing import Optional, Dict, Any
import pandas as pd


def export_pipeline_csvs(
    df: pd.DataFrame,
    edges: pd.DataFrame,
    out_dir: Path,
    resilience_report: Optional[Dict[str, Any]] = None,
    top_n: int = 50
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. nodes_roles.csv (HackAlem brief: id, role, role_score, cluster_id, priority_score, evidence)
    nodes_roles = pd.DataFrame({
        "id": df["gid"].astype(int),
        "gid": df["gid"].astype(int),
        "role": df["role"].astype(str),
        "role_score": df["role_score"].astype(float),
        "cluster_id": df["cluster_id"].astype(int),
        "priority_score": df["priority_score"].astype(float),
        "evidence": df["evidence"].astype(str),
        "in_deg": df["in_partners"].astype(int),
        "out_deg": df["out_partners"].astype(int),
        "in_kzt": df["sum_in"].astype(float),
        "out_kzt": df["sum_out"].astype(float),
        "pagerank": df["pagerank"].astype(float),
        "pass_through": df["pass_ratio"],
        "depth": df["depth"].astype(int),
        "is_seed": df["is_seed"].astype(bool),
        "truncated_by_depth": df["truncated_by_depth"].astype(bool),
        "in_cycle": df["in_cycle"].astype(bool) if "in_cycle" in df.columns else False,
        "rapid_transit": df["rapid_transit"].astype(bool) if "rapid_transit" in df.columns else False,
        "structuring_risk": df["structuring_risk"].astype(bool) if "structuring_risk" in df.columns else False,
        "turnaround_hours": df["turnaround_hours"] if "turnaround_hours" in df.columns else None,
    })
    nodes_roles.to_csv(out_dir / "nodes_roles.csv", index=False)

    # 2. clusters.csv
    cluster_node_map = dict(zip(df["gid"].astype(int), df["cluster_id"].astype(int)))
    edges_with_cluster = edges.copy()
    edges_with_cluster["src_c"] = edges_with_cluster["src"].astype(int).map(cluster_node_map)
    edges_with_cluster["dst_c"] = edges_with_cluster["dst"].astype(int).map(cluster_node_map)

    internal_edges = edges_with_cluster[edges_with_cluster["src_c"] == edges_with_cluster["dst_c"]]
    internal_sum = internal_edges.groupby("src_c")["sum_kzt"].sum().to_dict()

    cluster_rows = []
    for c_id, grp in df.groupby("cluster_id"):
        n_nodes = len(grp)
        n_seed = int(grp["is_seed"].sum())
        sum_internal = float(internal_sum.get(c_id, 0.0))
        top_5 = grp.sort_values(by="priority_score", ascending=False).head(5)["gid"].astype(str).tolist()
        top_gids_str = ";".join(top_5)

        hypothesis = (
            f"Cluster of {n_nodes} nodes ({n_seed} seed clients), internal turnover "
            f"{sum_internal:,.0f} KZT. Top priority actors: {top_gids_str}."
        )

        cluster_rows.append({
            "cluster_id": int(c_id),
            "Cluster_id": int(c_id),
            "n_nodes": n_nodes,
            "n_seed": n_seed,
            "sum_kzt_internal": round(sum_internal, 2),
            "top_gids": top_gids_str,
            "hypothesis": hypothesis,
        })

    pd.DataFrame(cluster_rows).to_csv(out_dir / "clusters.csv", index=False)

    # 3. top_nodes.csv (HackAlem brief: rank, GID, role, evaluation_priority, reason)
    top_df = df.sort_values(by="priority_score", ascending=False).head(max(top_n, 25)).copy()
    top_rows = []
    for rank, (_, row) in enumerate(top_df.iterrows(), start=1):
        why = (
            f"Rank #{rank} {row['role'].upper()}: {row['evidence']} "
            f"(Part of cluster {int(row['cluster_id'])})."
        )
        top_rows.append({
            "rank": rank,
            "id": int(row["gid"]),
            "gid": int(row["gid"]),
            "GID": int(row["gid"]),
            "role": str(row["role"]),
            "evaluation_priority": float(row["priority_score"]),
            "priority_score": float(row["priority_score"]),
            "reason": why,
            "why": why,
        })

    pd.DataFrame(top_rows).to_csv(out_dir / "top_nodes.csv", index=False)

    # 4. Export resilience report
    if resilience_report:
        with open(out_dir / "resilience.json", "w") as f:
            json.dump(resilience_report, f, indent=2)

    # 5. Export nodes_role_trace.json
    if "rule_trace" in df.columns:
        trace_map = {}
        for r in df.itertuples():
            gid_val = int(r.gid)
            raw_trace = getattr(r, "rule_trace", [])
            trace_list = raw_trace if isinstance(raw_trace, list) else json.loads(str(raw_trace))
            trace_map[str(gid_val)] = {
                "gid": gid_val,
                "final_role": str(r.role),
                "rule_trace": trace_list,
                "role_score": float(r.role_score),
                "priority_score": float(r.priority_score),
            }
        with open(out_dir / "nodes_role_trace.json", "w") as f:
            json.dump(trace_map, f, indent=2)
