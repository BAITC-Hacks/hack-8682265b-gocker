from pathlib import Path
from typing import Tuple, Optional
import pandas as pd
import numpy as np


def load_parquet_data(data_dir: Path) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    edges_path = data_dir / "edges.parquet"
    nodes_path = data_dir / "nodes.parquet"
    tx_path = data_dir / "transactions.parquet"

    if not edges_path.exists() or not nodes_path.exists():
        alt_data_dir = data_dir / "raw"
        if (alt_data_dir / "edges.parquet").exists():
            data_dir = alt_data_dir
            edges_path = data_dir / "edges.parquet"
            nodes_path = data_dir / "nodes.parquet"
            tx_path = data_dir / "transactions.parquet"

    edges = pd.read_parquet(edges_path)
    nodes = pd.read_parquet(nodes_path)
    tx = pd.read_parquet(tx_path) if tx_path.exists() else pd.DataFrame()
    if not tx.empty and "date" in tx.columns:
        tx["date"] = pd.to_datetime(tx["date"])

    return edges, nodes, tx


def compute_base_aggregations(
    edges: pd.DataFrame,
    nodes: pd.DataFrame,
    tx: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    in_agg = edges.groupby("dst").agg(
        in_partners=("src", "nunique"),
        sum_in=("sum_kzt", "sum"),
        in_tx=("n_tx", "sum")
    ).reset_index().rename(columns={"dst": "gid"})

    out_agg = edges.groupby("src").agg(
        out_partners=("dst", "nunique"),
        sum_out=("sum_kzt", "sum"),
        out_tx=("n_tx", "sum")
    ).reset_index().rename(columns={"src": "gid"})

    df = nodes[["gid", "depth", "is_seed"]].copy()
    df = df.merge(in_agg, on="gid", how="left")
    df = df.merge(out_agg, on="gid", how="left")

    df["in_partners"] = df["in_partners"].fillna(0).astype(int)
    df["out_partners"] = df["out_partners"].fillna(0).astype(int)
    df["sum_in"] = df["sum_in"].fillna(0.0)
    df["sum_out"] = df["sum_out"].fillna(0.0)
    df["in_tx"] = df["in_tx"].fillna(0).astype(int)
    df["out_tx"] = df["out_tx"].fillna(0).astype(int)

    df["pass_ratio"] = np.where(df["sum_in"] > 0, df["sum_out"] / df["sum_in"], np.nan)
    df["truncated_by_depth"] = (df["depth"] == 4) & (df["out_partners"] == 0)

    # Temporal & structuring metrics from individual transactions
    df["turnaround_hours"] = np.nan
    df["rapid_transit"] = False
    df["structuring_risk"] = False

    if tx is not None and not tx.empty and "date" in tx.columns:
        # 1. Temporal turnaround intervals
        in_times = tx.groupby("dst")["date"].agg(["min", "max"]).rename(
            columns={"min": "first_in", "max": "last_in"}
        )
        out_times = tx.groupby("src")["date"].agg(["min", "max"]).rename(
            columns={"min": "first_out", "max": "last_out"}
        )

        time_df = in_times.join(out_times, how="inner")
        if not time_df.empty:
            delta = (time_df["first_out"] - time_df["first_in"]).dt.total_seconds() / 3600.0
            time_df["turnaround_hours"] = delta
            time_df["rapid_transit"] = (delta >= 0) & (delta <= 48.0)

            df = df.merge(
                time_df[["turnaround_hours", "rapid_transit"]],
                left_on="gid",
                right_index=True,
                how="left"
            )
            df["turnaround_hours"] = df["turnaround_hours_y"].combine_first(df["turnaround_hours_x"])
            df["rapid_transit"] = df["rapid_transit_y"].fillna(False)
            df.drop(columns=["turnaround_hours_x", "turnaround_hours_y", "rapid_transit_x", "rapid_transit_y"], inplace=True)

        # 2. Structuring / smurfing analysis near 5,000 KZT cutoff
        tx_all = pd.concat([
            tx[["src", "sum_kzt"]].rename(columns={"src": "gid"}),
            tx[["dst", "sum_kzt"]].rename(columns={"dst": "gid"})
        ])
        tx_stats = tx_all.groupby("gid")["sum_kzt"].agg(
            total_count="count",
            smurf_count=lambda s: (s <= 15000).sum()
        )
        tx_stats["smurf_ratio"] = tx_stats["smurf_count"] / tx_stats["total_count"]
        structuring_gids = set(tx_stats[(tx_stats["smurf_ratio"] >= 0.6) & (tx_stats["total_count"] >= 3)].index)
        df["structuring_risk"] = df["gid"].isin(structuring_gids)

    return df
