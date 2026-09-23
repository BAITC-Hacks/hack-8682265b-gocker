import io
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.pipeline.dataset_manager import (
    derive_nodes_from_edges_and_seeds,
    parse_seed_gids_string,
    reset_to_sample_dataset,
    get_dataset_status,
)

client = TestClient(app)


def setup_function():
    # Always ensure baseline dataset before each test
    reset_to_sample_dataset()


def teardown_function():
    # Always restore baseline dataset after each test
    reset_to_sample_dataset()


def test_status_endpoint():
    res = client.get("/dataset/status")
    assert res.status_code == 200
    data = res.json()
    assert data["active_dataset"] == "sample"
    assert data["is_custom"] is False
    assert data["nodes_count"] == 2248
    assert data["seeds_count"] == 81


def test_reset_endpoint():
    res = client.post("/dataset/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["dataset"]["active_dataset"] == "sample"
    assert data["dataset"]["is_custom"] is False


def test_parse_seed_gids_string():
    raw = "1000000001, 1000000002; 1000000003\n1000000004"
    gids = parse_seed_gids_string(raw)
    assert gids == [1000000001, 1000000002, 1000000003, 1000000004]


def test_derive_nodes_from_edges_and_seeds():
    # Construct a simple linear chain: 100 (seed) -> 101 -> 102 -> 103 -> 104
    edges_df = pd.DataFrame([
        {"src": 100, "dst": 101, "sum_kzt": 50000.0, "n_tx": 1, "depth": 1},
        {"src": 101, "dst": 102, "sum_kzt": 49000.0, "n_tx": 1, "depth": 2},
        {"src": 102, "dst": 103, "sum_kzt": 48000.0, "n_tx": 1, "depth": 3},
        {"src": 103, "dst": 104, "sum_kzt": 47000.0, "n_tx": 1, "depth": 4},
    ])
    seeds = {100}

    nodes_df = derive_nodes_from_edges_and_seeds(edges_df, seeds)
    assert len(nodes_df) == 5
    row_map = {r["gid"]: r for _, r in nodes_df.iterrows()}

    # Check seed
    assert row_map[100]["is_seed"] is True or row_map[100]["is_seed"] == 1
    assert row_map[100]["depth"] == 0

    # Check hops
    assert row_map[101]["depth"] == 1
    assert row_map[101]["is_seed"] is False or row_map[101]["is_seed"] == 0
    assert row_map[102]["depth"] == 2
    assert row_map[103]["depth"] == 3
    assert row_map[104]["depth"] == 4


def test_custom_upload_csv_pipeline_and_export():
    # Create test CSV edges representing a small network:
    # 200 (seed 1) -> 202 (consolidator/transit)
    # 201 (seed 2) -> 202
    # 202 -> 203, 204
    edges_data = (
        "src,dst,sum_kzt,n_tx\n"
        "200,202,100000,2\n"
        "201,202,150000,3\n"
        "202,203,120000,2\n"
        "202,204,110000,2\n"
    )

    files = {
        "edges_file": ("custom_edges.csv", io.BytesIO(edges_data.encode("utf-8")), "text/csv"),
    }
    data = {
        "seed_gids": "200, 201",
        "dataset_name": "Test Custom Law Enforcement Export",
        "enable_llm": "false",
    }

    res = client.post("/dataset/upload", files=files, data=data)
    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["status"] == "success"
    assert payload["dataset"]["is_custom"] is True
    assert payload["dataset"]["nodes_count"] == 5
    assert payload["dataset"]["edges_count"] == 4
    assert payload["dataset"]["seeds_count"] == 2

    # Check that /graph now reflects custom dataset
    graph_res = client.get("/graph")
    assert graph_res.status_code == 200
    graph_data = graph_res.json()
    assert len(graph_data["nodes"]) == 5
    assert len(graph_data["edges"]) == 4

    # Check referral export endpoint
    export_res = client.get("/dataset/export/referral")
    assert export_res.status_code == 200
    assert export_res.headers["content-type"] == "text/csv; charset=utf-8"
    csv_content = export_res.text
    assert "Rank" in csv_content
    assert "Client_GID" in csv_content
    assert "Assigned_Role" in csv_content
    assert "Priority_Score" in csv_content
    assert "AML_Role_Evidence_Rationale" in csv_content

    # Finally, reset and verify return to baseline
    reset_res = client.post("/dataset/reset")
    assert reset_res.status_code == 200
    base_res = client.get("/graph")
    assert len(base_res.json()["nodes"]) == 2248
