import os
import io
import re
import json
import zipfile
import shutil
from pathlib import Path
from typing import Tuple, Dict, Any, Optional, Set, List
import pandas as pd
import numpy as np
import networkx as nx

# Paths
def get_project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent.parent


def get_base_dirs() -> Tuple[Path, Path]:
    if Path("/data/raw").exists():
        return Path("/data/raw"), Path("/data/output")
    root = get_project_root()
    return root / "data" / "raw", root / "data" / "output"


def get_custom_dirs() -> Tuple[Path, Path]:
    if Path("/data").exists():
        custom_base = Path("/data/custom")
    else:
        custom_base = get_project_root() / "data" / "custom"
    raw_dir = custom_base / "raw"
    out_dir = custom_base / "output"
    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    return raw_dir, out_dir


# Global dataset state
class DatasetState:
    active_dataset: str = "sample"  # "sample" or "custom"
    dataset_name: str = "HackAlem Baseline Case (81 Seeds, 2,248 Nodes)"
    custom_metadata: Dict[str, Any] = {}


def get_active_data_dirs() -> Tuple[Path, Path]:
    if DatasetState.active_dataset == "custom":
        custom_raw, custom_out = get_custom_dirs()
        # Verify custom files exist, otherwise fallback to sample
        if (custom_raw / "edges.parquet").exists() and (custom_raw / "nodes.parquet").exists():
            return custom_raw, custom_out
    return get_base_dirs()


def get_dataset_status() -> Dict[str, Any]:
    raw_dir, out_dir = get_active_data_dirs()
    is_custom = DatasetState.active_dataset == "custom"
    nodes_csv = out_dir / "nodes_roles.csv"
    edges_parquet = raw_dir / "edges.parquet"

    total_nodes = 0
    total_edges = 0
    total_seeds = 0

    if nodes_csv.exists():
        try:
            df_n = pd.read_csv(nodes_csv)
            total_nodes = len(df_n)
            total_seeds = int(df_n["is_seed"].sum()) if "is_seed" in df_n.columns else 0
        except Exception:
            pass

    if edges_parquet.exists():
        try:
            df_e = pd.read_parquet(edges_parquet)
            total_edges = len(df_e)
        except Exception:
            pass

    return {
        "active_dataset": DatasetState.active_dataset,
        "dataset_name": DatasetState.dataset_name if is_custom else "HackAlem Baseline Case (81 Seeds, 2,248 Nodes)",
        "is_custom": is_custom,
        "nodes_count": total_nodes,
        "edges_count": total_edges,
        "seeds_count": total_seeds,
        "raw_dir": str(raw_dir),
        "out_dir": str(out_dir),
    }


def reset_to_sample_dataset() -> Dict[str, Any]:
    DatasetState.active_dataset = "sample"
    DatasetState.dataset_name = "HackAlem Baseline Case (81 Seeds, 2,248 Nodes)"
    DatasetState.custom_metadata = {}
    return get_dataset_status()


def parse_seed_gids_string(raw_text: str) -> List[int]:
    """Extract numeric 10-19 digit GIDs or integer IDs from text."""
    if not raw_text:
        return []
    # Match integer tokens separated by commas, newlines, semicolons, or spaces
    tokens = re.findall(r"\b\d+\b", raw_text)
    gids = []
    for t in tokens:
        try:
            val = int(t)
            if val > 0:
                gids.append(val)
        except ValueError:
            pass
    return list(dict.fromkeys(gids))  # preserve order, unique


def derive_nodes_from_edges_and_seeds(edges_df: pd.DataFrame, seed_gids: Set[int]) -> pd.DataFrame:
    """
    Constructs a nodes DataFrame from edges and seed client GIDs.
    Uses multi-source BFS from seeds to assign hop depths (0, 1, 2, 3, 4).
    """
    G = nx.DiGraph()
    for r in edges_df.itertuples(index=False):
        G.add_edge(int(r.src), int(r.dst))

    all_nodes = set(G.nodes()) | set(seed_gids)

    # Multi-source BFS
    depths: Dict[int, int] = {}
    queue = [s for s in seed_gids if s in G]
    for s in seed_gids:
        depths[s] = 0

    visited = set(queue)
    curr_depth = 0
    max_hop = 4

    while queue and curr_depth < max_hop:
        next_queue = []
        for u in queue:
            for v in G.successors(u):
                if v not in visited:
                    visited.add(v)
                    depths[v] = curr_depth + 1
                    next_queue.append(v)
        queue = next_queue
        curr_depth += 1

    nodes_records = []
    for node in sorted(all_nodes):
        is_seed = node in seed_gids
        # If node was unreachable from seeds, cap at max_hop (4)
        node_depth = depths.get(node, max_hop)
        nodes_records.append({
            "gid": int(node),
            "depth": int(node_depth),
            "is_seed": bool(is_seed)
        })

    return pd.DataFrame(nodes_records)


def normalize_edges_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure standard column names: src, dst, sum_kzt, n_tx, depth."""
    df = df.copy()
    col_map = {
        "source": "src",
        "sender": "src",
        "from": "src",
        "target": "dst",
        "recipient": "dst",
        "to": "dst",
        "amount": "sum_kzt",
        "sum": "sum_kzt",
        "volume": "sum_kzt",
        "count": "n_tx",
        "transactions": "n_tx",
        "tx_count": "n_tx",
    }
    for col in df.columns:
        low = col.strip().lower()
        if low in col_map and col_map[low] not in df.columns:
            df.rename(columns={col: col_map[low]}, inplace=True)

    if "src" not in df.columns or "dst" not in df.columns:
        raise ValueError("Edges data must contain source and destination columns ('src', 'dst').")

    df["src"] = df["src"].astype(int)
    df["dst"] = df["dst"].astype(int)

    if "sum_kzt" not in df.columns:
        df["sum_kzt"] = 10000.0  # fallback default amount
    else:
        df["sum_kzt"] = df["sum_kzt"].fillna(0.0).astype(float)

    if "n_tx" not in df.columns:
        df["n_tx"] = 1
    else:
        df["n_tx"] = df["n_tx"].fillna(1).astype(int)

    if "depth" not in df.columns:
        df["depth"] = 1

    return df[["src", "dst", "sum_kzt", "n_tx", "depth"]]


def normalize_nodes_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure standard column names: gid, depth, is_seed."""
    df = df.copy()
    col_map = {
        "id": "gid",
        "account": "gid",
        "client_id": "gid",
        "client": "gid",
        "seed": "is_seed",
        "hop": "depth",
    }
    for col in df.columns:
        low = col.strip().lower()
        if low in col_map and col_map[low] not in df.columns:
            df.rename(columns={col: col_map[low]}, inplace=True)

    if "gid" not in df.columns:
        raise ValueError("Nodes data must contain client identifier column ('gid' or 'id').")

    df["gid"] = df["gid"].astype(int)

    if "depth" not in df.columns:
        df["depth"] = 1
    else:
        df["depth"] = df["depth"].fillna(1).astype(int)

    if "is_seed" not in df.columns:
        df["is_seed"] = df["depth"] == 0
    else:
        df["is_seed"] = df["is_seed"].astype(bool)

    return df[["gid", "depth", "is_seed"]]


def normalize_transactions_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure standard column names: src, dst, date, sum_kzt."""
    df = df.copy()
    col_map = {
        "source": "src",
        "sender": "src",
        "target": "dst",
        "recipient": "dst",
        "amount": "sum_kzt",
        "timestamp": "date",
        "time": "date",
        "datetime": "date",
    }
    for col in df.columns:
        low = col.strip().lower()
        if low in col_map and col_map[low] not in df.columns:
            df.rename(columns={col: col_map[low]}, inplace=True)

    if "src" in df.columns and "dst" in df.columns and "sum_kzt" in df.columns:
        df["src"] = df["src"].astype(int)
        df["dst"] = df["dst"].astype(int)
        df["sum_kzt"] = df["sum_kzt"].astype(float)
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
        else:
            df["date"] = pd.Timestamp.now()
        return df[["src", "dst", "date", "sum_kzt"]]
    return pd.DataFrame()


def ingest_custom_data(
    edges_content: Optional[bytes] = None,
    edges_filename: Optional[str] = None,
    nodes_content: Optional[bytes] = None,
    nodes_filename: Optional[str] = None,
    tx_content: Optional[bytes] = None,
    tx_filename: Optional[str] = None,
    zip_content: Optional[bytes] = None,
    seed_gids_text: Optional[str] = None,
    dataset_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ingests files or data streams, saves Parquet files to custom raw directory,
    derives nodes and hop depths if needed, and prepares custom dataset for pipeline execution.
    """
    custom_raw, custom_out = get_custom_dirs()

    # Clear previous custom raw/output files
    for p in custom_raw.glob("*"):
        if p.is_file():
            p.unlink()
    for p in custom_out.glob("*"):
        if p.is_file():
            p.unlink()

    extracted_files: Dict[str, bytes] = {}

    # Handle ZIP archive if provided
    if zip_content:
        with zipfile.ZipFile(io.BytesIO(zip_content)) as zf:
            for fname in zf.namelist():
                if fname.startswith("__MACOSX") or fname.endswith("/"):
                    continue
                extracted_files[Path(fname).name.lower()] = zf.read(fname)

    # Helper to load a DataFrame from bytes based on extension
    def bytes_to_df(content: bytes, name: str) -> pd.DataFrame:
        if name.endswith(".parquet"):
            return pd.read_parquet(io.BytesIO(content))
        elif name.endswith(".csv"):
            return pd.read_csv(io.BytesIO(content))
        elif name.endswith(".json"):
            return pd.read_json(io.BytesIO(content))
        else:
            try:
                return pd.read_parquet(io.BytesIO(content))
            except Exception:
                return pd.read_csv(io.BytesIO(content))

    df_edges: Optional[pd.DataFrame] = None
    df_nodes: Optional[pd.DataFrame] = None
    df_tx: Optional[pd.DataFrame] = None

    # 1. Edges
    if edges_content and edges_filename:
        df_edges = bytes_to_df(edges_content, edges_filename.lower())
    else:
        for fname, bdata in extracted_files.items():
            if "edge" in fname or "transfer" in fname:
                df_edges = bytes_to_df(bdata, fname)
                break

    if df_edges is None:
        raise ValueError("Missing edges/transfers data. Please provide edges file.")

    df_edges = normalize_edges_dataframe(df_edges)

    # 2. Seed GIDs
    seed_gids: Set[int] = set()
    if seed_gids_text:
        seed_gids.update(parse_seed_gids_string(seed_gids_text))

    # 3. Nodes
    if nodes_content and nodes_filename:
        # Check if nodes file is actually a simple seeds list
        try:
            parsed_nodes = bytes_to_df(nodes_content, nodes_filename.lower())
            if "src" not in parsed_nodes.columns:
                if len(parsed_nodes.columns) == 1 or "seed" in nodes_filename.lower():
                    # Single column of seeds
                    col = parsed_nodes.columns[0]
                    seed_gids.update(parsed_nodes[col].dropna().astype(int).tolist())
                else:
                    df_nodes = normalize_nodes_dataframe(parsed_nodes)
        except Exception:
            pass
    else:
        for fname, bdata in extracted_files.items():
            if "node" in fname:
                df_nodes = normalize_nodes_dataframe(bytes_to_df(bdata, fname))
                break
            elif "seed" in fname:
                try:
                    s_df = bytes_to_df(bdata, fname)
                    col = s_df.columns[0]
                    seed_gids.update(s_df[col].dropna().astype(int).tolist())
                except Exception:
                    pass

    # If nodes dataframe is missing or incomplete, derive it from edges + seed_gids!
    if df_nodes is None or df_nodes.empty:
        if not seed_gids:
            # If no seed list provided, treat 0-in-degree nodes or top volume nodes as seeds
            in_degrees = set(df_edges["dst"])
            candidate_seeds = set(df_edges["src"]) - in_degrees
            seed_gids = set(list(candidate_seeds)[:81]) if candidate_seeds else set(df_edges["src"].head(10))
        df_nodes = derive_nodes_from_edges_and_seeds(df_edges, seed_gids)
    else:
        # If seed_gids was explicitly given, make sure is_seed reflects it
        if seed_gids:
            df_nodes["is_seed"] = df_nodes["gid"].isin(seed_gids)

    # 4. Optional Transactions
    if tx_content and tx_filename:
        try:
            df_tx = normalize_transactions_dataframe(bytes_to_df(tx_content, tx_filename.lower()))
        except Exception:
            df_tx = pd.DataFrame()
    else:
        for fname, bdata in extracted_files.items():
            if "transaction" in fname or "tx" in fname:
                try:
                    df_tx = normalize_transactions_dataframe(bytes_to_df(bdata, fname))
                    break
                except Exception:
                    pass

    # Save to custom raw directory as Parquet
    df_edges.to_parquet(custom_raw / "edges.parquet", index=False)
    df_nodes.to_parquet(custom_raw / "nodes.parquet", index=False)
    if df_tx is not None and not df_tx.empty:
        df_tx.to_parquet(custom_raw / "transactions.parquet", index=False)

    DatasetState.active_dataset = "custom"
    DatasetState.dataset_name = dataset_name or f"Custom Case ({len(df_nodes):,} Nodes, {len(df_edges):,} Edges)"
    DatasetState.custom_metadata = {
        "nodes_count": len(df_nodes),
        "edges_count": len(df_edges),
        "seeds_count": int(df_nodes["is_seed"].sum()),
    }

    return {
        "status": "ready_to_run",
        "nodes_count": len(df_nodes),
        "edges_count": len(df_edges),
        "seeds_count": int(df_nodes["is_seed"].sum()),
        "dataset_name": DatasetState.dataset_name,
    }
