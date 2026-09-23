from pathlib import Path
from typing import Tuple
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


def compute_base_aggregations(edges: pd.DataFrame, nodes: pd.DataFrame) -> pd.DataFrame:
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

    return df
