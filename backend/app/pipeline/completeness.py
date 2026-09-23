import json
from pathlib import Path
from typing import List, Dict, Any
import pandas as pd


def generate_completeness_report(
    df_nodes: pd.DataFrame,
    edges: pd.DataFrame,
    out_dir: Path
) -> List[Dict[str, Any]]:
    """
    Evaluates data completeness gaps from existing graph and edge metrics:
    1. Seed accounts missing activity or inbound-only.
    2. Hop-4 boundary cutoff nodes.
    3. Isolated sub-networks outside the giant weakly-connected component.
    4. Structuring pattern accounts near the 5,000 KZT cutoff threshold.
    """
    # 1. Seed accounts audit
    seed_gids = set(df_nodes[df_nodes["is_seed"] == True]["gid"].astype(int))
    src_set = set(edges["src"].astype(int))
    dst_set = set(edges["dst"].astype(int))
    all_edge_nodes = src_set.union(dst_set)

    seeds_absent = seed_gids - all_edge_nodes
    seeds_recipient_only = {g for g in seed_gids if (g in dst_set and g not in src_set)}
    seed_gap_count = int(len(seeds_absent) + len(seeds_recipient_only))

    # 2. Hop-4 truncation boundary
    truncated_sinks = df_nodes[
        (df_nodes["depth"] == 4) & (df_nodes["out_partners"] == 0)
    ]
    truncated_count = int(len(truncated_sinks))

    # 3. Nodes outside the giant component
    cluster_counts = df_nodes["cluster_id"].value_counts()
    if len(cluster_counts) > 0:
        giant_cluster_size = int(cluster_counts.iloc[0])
        isolated_count = int(len(df_nodes) - giant_cluster_size)
    else:
        isolated_count = 0

    # 4. Structuring risk accounts near the 5,000 KZT cutoff
    structuring_count = int(df_nodes["structuring_risk"].sum()) if "structuring_risk" in df_nodes.columns else 0

    findings = [
        {
            "category": "Seed Account Lineage",
            "finding": f"{seed_gap_count} seed accounts lack outward flow lineage ({len(seeds_absent)} absent entirely from transaction graph, {len(seeds_recipient_only)} appear only as inward recipients).",
            "affected_count": seed_gap_count,
            "recommended_request": f"Request full historical statement and interbank payment logs for these {seed_gap_count} target seed accounts (e.g. prior 6-12 months) to capture origin of funds prior to this extract window."
        },
        {
            "category": "Graph Traversal Boundary",
            "finding": f"{truncated_count} accounts sit at depth=4 with 0 outgoing transactions due to extraction depth limit, artificially masking downstream sinks.",
            "affected_count": truncated_count,
            "recommended_request": f"Extend graph traversal depth by 1-2 additional hops for these {truncated_count} hop-4 accounts to confirm whether funds terminate or disperse into secondary mules."
        },
        {
            "category": "Peripheral Component Isolation",
            "finding": f"{isolated_count} accounts reside outside the central weakly-connected core, forming disjointed cluster fragments with seed links.",
            "affected_count": isolated_count,
            "recommended_request": f"Query cross-institution payment rails (NSPK / national clearing) to investigate if isolated sub-networks connect to seed clients through external banking entities."
        },
        {
            "category": "Sub-Threshold Cutoff Masking",
            "finding": f"{structuring_count} accounts exhibit micro-structuring activity clustered directly above the 5,000 KZT extraction floor.",
            "affected_count": structuring_count,
            "recommended_request": f"Request the unmasked sub-5,000 KZT transaction log from core banking to identify micro-smurfing batches split intentionally below reporting thresholds."
        }
    ]

    out_dir.mkdir(parents=True, exist_ok=True)
    with open(out_dir / "data_gaps.json", "w") as f:
        json.dump(findings, f, indent=2)

    return findings
