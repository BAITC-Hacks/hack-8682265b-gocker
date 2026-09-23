import sys
from pathlib import Path
import pytest

# Ensure backend package is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
project_root = backend_dir.parent
sys.path.insert(0, str(backend_dir))

from app.pipeline.load_data import load_parquet_data, compute_base_aggregations
from app.pipeline.build_graph import build_graph
from app.pipeline.metrics import compute_graph_metrics
from app.pipeline.roles import assign_roles
from app.pipeline.priority import compute_priority_scores


@pytest.fixture(scope="session")
def data_paths():
    raw_dir = project_root / "data" / "raw"
    out_dir = project_root / "data" / "output"
    assert raw_dir.exists(), f"Raw data directory not found: {raw_dir}"
    return {"raw": raw_dir, "out": out_dir}


@pytest.fixture(scope="session")
def raw_data(data_paths):
    edges, nodes, tx = load_parquet_data(data_paths["raw"])
    return edges, nodes, tx


@pytest.fixture(scope="session")
def base_aggregations(raw_data):
    edges, nodes, _ = raw_data
    return compute_base_aggregations(edges, nodes)


@pytest.fixture(scope="session")
def built_graph(raw_data):
    edges, nodes, _ = raw_data
    return build_graph(edges, nodes)


@pytest.fixture(scope="session")
def computed_metrics(built_graph, base_aggregations):
    res = compute_graph_metrics(built_graph, base_aggregations)
    df_metrics = res[0]
    cluster_map = res[1]
    return df_metrics, cluster_map


@pytest.fixture(scope="session")
def full_processed_nodes(computed_metrics):
    df_metrics, _ = computed_metrics
    df_roles = assign_roles(df_metrics)
    df_prioritized = compute_priority_scores(df_roles)
    return df_prioritized
