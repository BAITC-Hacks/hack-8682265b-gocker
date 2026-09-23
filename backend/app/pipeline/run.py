import time
import json
import argparse
from pathlib import Path
from app.pipeline.load_data import load_parquet_data, compute_base_aggregations
from app.pipeline.build_graph import build_graph
from app.pipeline.metrics import compute_graph_metrics
from app.pipeline.roles import assign_roles
from app.pipeline.priority import compute_priority_scores
from app.pipeline.enrich_with_llm import enrich_evidence_with_llm
from app.pipeline.export_csv import export_pipeline_csvs
from app.pipeline.sensitivity import compute_threshold_sensitivity
from app.pipeline.completeness import generate_completeness_report


def run_pipeline(data_dir: Path, out_dir: Path, enable_llm: bool = False) -> dict:
    start_time = time.time()
    print("=" * 60)
    print("RUNNING MONEY GRAPH AML PIPELINE")
    print("=" * 60)

    # 1. Load Data
    t0 = time.time()
    edges, nodes, tx = load_parquet_data(data_dir)
    print(f"[1/6] Loaded {len(nodes)} nodes, {len(edges)} edges, {len(tx)} txs in {time.time() - t0:.2f}s")

    # 2. Base aggregations & Graph build (with temporal and structuring stats)
    t0 = time.time()
    df_base = compute_base_aggregations(edges, nodes, tx)
    G = build_graph(edges, nodes)
    print(f"[2/6] Built graph ({G.number_of_nodes()} nodes, {G.number_of_edges()} edges) in {time.time() - t0:.2f}s")

    # 3. Graph metrics, cycles, & resilience simulation
    t0 = time.time()
    df_metrics, cluster_map, resilience_report = compute_graph_metrics(G, df_base)
    print(f"[3/6] Computed betweenness, pagerank, cycles & resilience in {time.time() - t0:.2f}s")

    # 4. Roles (with temporal & cycle evidence)
    t0 = time.time()
    df_roles = assign_roles(df_metrics)
    print(f"[4/6] Assigned roles in {time.time() - t0:.2f}s")
    for role, count in df_roles["role"].value_counts().items():
        print(f"      - {role:<14}: {count:>5}")

    # 5. Priority scores & optional LLM enrichment
    t0 = time.time()
    df_prioritized = compute_priority_scores(df_roles)
    if enable_llm:
        df_prioritized = enrich_evidence_with_llm(df_prioritized)
    print(f"[5/6] Computed priority scores in {time.time() - t0:.2f}s")

    # 6. Export CSV files & resilience summary
    t0 = time.time()
    export_pipeline_csvs(df_prioritized, edges, out_dir, resilience_report=resilience_report)
    compute_threshold_sensitivity(df_prioritized, out_dir)
    generate_completeness_report(df_prioritized, edges, out_dir)
    print(f"[6/6] Exported CSVs, role traces, sensitivity & data gaps to {out_dir} in {time.time() - t0:.2f}s")

    elapsed = time.time() - start_time

    summary = {
        "status": "success",
        "elapsed_seconds": round(elapsed, 2),
        "nodes_count": len(df_prioritized),
        "edges_count": len(edges),
        "clusters_count": int(df_prioritized["cluster_id"].nunique()),
        "output_directory": str(out_dir),
        "resilience": resilience_report,
        "cycle_nodes_count": int(df_prioritized["in_cycle"].sum()) if "in_cycle" in df_prioritized.columns else 0,
        "rapid_transit_count": int(df_prioritized["rapid_transit"].sum()) if "rapid_transit" in df_prioritized.columns else 0,
        "structuring_risk_count": int(df_prioritized["structuring_risk"].sum()) if "structuring_risk" in df_prioritized.columns else 0,
    }

    with open(out_dir / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("=" * 60)
    print(f"PIPELINE COMPLETED SUCCESSFULLY IN {elapsed:.2f} SECONDS")
    print(f"Giant component: {resilience_report['initial_giant_component_nodes']} nodes")
    print(f"Post top-5 coordinator removal: {resilience_report['post_top5_removal']['giant_component_nodes']} nodes "
          f"(-{resilience_report['post_top5_removal']['giant_reduction_pct']}%)")
    print("=" * 60)

    return summary


def main():
    parser = argparse.ArgumentParser(description="Run Money Graph AML pipeline")
    parser.add_argument("--data", default="data/raw", help="Path to input parquet directory")
    parser.add_argument("--out", default="data/output", help="Path to output CSV directory")
    parser.add_argument("--llm", action="store_true", help="Enable LLM evidence enrichment")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent.parent.parent
    if args.data == "data/raw" and Path("/data/raw").exists():
        data_path = Path("/data/raw")
    else:
        data_path = Path(args.data)
        if not data_path.is_absolute():
            data_path = project_root / args.data

    if args.out == "data/output" and Path("/data").exists():
        out_path = Path("/data/output")
    else:
        out_path = Path(args.out)
        if not out_path.is_absolute():
            out_path = project_root / args.out

    run_pipeline(data_path, out_path, enable_llm=args.llm)


if __name__ == "__main__":
    main()
