import pandas as pd


def test_nodes_roles_csv(data_paths):
    csv_path = data_paths["out"] / "nodes_roles.csv"
    assert csv_path.exists(), f"nodes_roles.csv not found at {csv_path}"

    df = pd.read_csv(csv_path)

    # Must have exactly 2248 rows
    assert len(df) == 2248, f"Expected 2248 rows, got {len(df)}"

    # Required columns from HackAlem Case Study Brief:
    # id, role, role_score, cluster_id, priority_score, evidence
    required_cols = ["id", "role", "role_score", "cluster_id", "priority_score", "evidence"]
    for col in required_cols:
        assert col in df.columns, f"Required column '{col}' missing from nodes_roles.csv"
        assert df[col].notna().all(), f"Found NaN values in required column '{col}'"

    # Also verify backward-compatible gid column exists
    assert "gid" in df.columns
    assert (df["id"] == df["gid"]).all()


def test_clusters_csv(data_paths):
    csv_path = data_paths["out"] / "clusters.csv"
    assert csv_path.exists(), f"clusters.csv not found at {csv_path}"

    df = pd.read_csv(csv_path)
    assert len(df) > 0

    required_cols = ["cluster_id", "n_nodes", "n_seed", "sum_kzt_internal", "top_gids", "hypothesis"]
    for col in required_cols:
        assert col in df.columns, f"Required column '{col}' missing from clusters.csv"

    # Sum of n_nodes across all clusters must equal 2248
    assert df["n_nodes"].sum() == 2248, f"Expected total 2248 nodes across clusters, got {df['n_nodes'].sum()}"

    # Sum of n_seed across all clusters must equal 81
    assert df["n_seed"].sum() == 81, f"Expected total 81 seeds across clusters, got {df['n_seed'].sum()}"

    # Internal turnover must be non-negative
    assert (df["sum_kzt_internal"] >= 0).all()

    # Top GIDs must be semicolon separated
    for top_gids_str in df["top_gids"]:
        gids = [g.strip() for g in str(top_gids_str).split(";") if g.strip()]
        assert 1 <= len(gids) <= 5


def test_top_nodes_csv(data_paths):
    csv_path = data_paths["out"] / "top_nodes.csv"
    assert csv_path.exists(), f"top_nodes.csv not found at {csv_path}"

    df = pd.read_csv(csv_path)

    # Must contain at least 20 rows
    assert len(df) >= 20, f"Expected at least 20 top nodes, got {len(df)}"

    # Required columns from HackAlem Brief (rank, GID, role, evaluation_priority, reason)
    # and PROMPTS.md (rank, gid, role, priority_score, why)
    assert "rank" in df.columns
    assert "role" in df.columns
    assert "GID" in df.columns or "gid" in df.columns or "id" in df.columns
    assert "evaluation_priority" in df.columns or "priority_score" in df.columns
    assert "reason" in df.columns or "why" in df.columns

    # Ranks should be 1, 2, ..., N
    assert list(df["rank"]) == list(range(1, len(df) + 1))

    # Must be sorted descending by priority score
    priority_col = "evaluation_priority" if "evaluation_priority" in df.columns else "priority_score"
    priorities = df[priority_col].tolist()
    assert priorities == sorted(priorities, reverse=True), "Top nodes must be sorted descending by priority"
