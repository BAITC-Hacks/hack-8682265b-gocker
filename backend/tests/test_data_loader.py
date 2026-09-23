import pandas as pd
import numpy as np


def test_parquet_row_counts(raw_data):
    edges, nodes, tx = raw_data

    # From HackAlem brief: 2,248 nodes, 3,119 edges, 4,840 transactions
    assert len(nodes) == 2248, f"Expected 2248 nodes, got {len(nodes)}"
    assert len(edges) == 3119, f"Expected 3119 edges, got {len(edges)}"
    assert len(tx) == 4840, f"Expected 4840 transactions, got {len(tx)}"


def test_nodes_schema_and_seed_count(raw_data):
    _, nodes, _ = raw_data

    assert "gid" in nodes.columns
    assert "depth" in nodes.columns
    assert "is_seed" in nodes.columns

    # Seed count must be exactly 81 according to the task brief
    seed_count = nodes["is_seed"].sum()
    assert seed_count == 81, f"Expected 81 seed clients, got {seed_count}"

    # Unique GIDs
    assert nodes["gid"].nunique() == 2248
    # Depth values between 0 and 4
    assert set(nodes["depth"].unique()).issubset({0, 1, 2, 3, 4})


def test_edges_schema_and_values(raw_data):
    edges, _, _ = raw_data

    expected_cols = {"src", "dst", "sum_kzt", "n_tx", "depth"}
    assert expected_cols.issubset(set(edges.columns))

    # All amounts and transactions positive
    assert (edges["sum_kzt"] > 0).all()
    assert (edges["n_tx"] > 0).all()

    # Minimum transaction cutoff threshold: transactions under 5,000 KZT were filtered
    assert (edges["sum_kzt"] >= 5000).all()


def test_base_aggregations_and_depth4_artifact(base_aggregations):
    df = base_aggregations

    assert len(df) == 2248
    assert (df["in_partners"] >= 0).all()
    assert (df["out_partners"] >= 0).all()
    assert (df["sum_in"] >= 0).all()
    assert (df["sum_out"] >= 0).all()

    # Verify pass_ratio logic
    has_in = df["sum_in"] > 0
    np.testing.assert_allclose(
        df.loc[has_in, "pass_ratio"],
        df.loc[has_in, "sum_out"] / df.loc[has_in, "sum_in"],
        rtol=1e-5
    )
    assert df.loc[~has_in, "pass_ratio"].isna().all()

    # HackAlem brief & spec quirk: exactly 444 nodes have depth=4 and out_partners=0
    # which is a traversal cutoff artifact, not a confirmed final recipient
    truncated_nodes = (df["depth"] == 4) & (df["out_partners"] == 0)
    assert truncated_nodes.sum() == 444, f"Expected 444 hop-4 cutoff nodes, got {truncated_nodes.sum()}"
    assert (df["truncated_by_depth"] == truncated_nodes).all()
