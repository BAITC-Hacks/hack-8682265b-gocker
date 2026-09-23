import networkx as nx
import numpy as np


def test_graph_structure(built_graph):
    G = built_graph

    assert isinstance(G, nx.DiGraph)
    assert G.number_of_nodes() == 2248
    assert G.number_of_edges() == 3119

    # Verify edge attributes
    for u, v, data in G.edges(data=True):
        assert "sum_kzt" in data
        assert "n_tx" in data
        assert "depth" in data
        assert data["sum_kzt"] > 0


def test_weakly_connected_components(built_graph):
    G = built_graph
    components = list(nx.weakly_connected_components(G))

    # The spec highlights 16 weakly connected components (among connected nodes)
    # Total components with singletons
    non_trivial_components = [c for c in components if len(c) > 1]
    assert len(non_trivial_components) == 16, f"Expected 16 non-trivial components, got {len(non_trivial_components)}"


def test_graph_metrics_bounds(computed_metrics):
    df_metrics, cluster_map = computed_metrics

    assert len(df_metrics) == 2248

    # Betweenness centrality must be normalized [0, 1]
    assert (df_metrics["betweenness"] >= 0.0).all()
    assert (df_metrics["betweenness"] <= 1.0).all()

    # PageRank values must be strictly positive
    assert (df_metrics["pagerank"] > 0.0).all()
    np.testing.assert_allclose(df_metrics["pagerank"].sum(), 1.0, rtol=1e-2)

    # Louvain clusters
    n_clusters = df_metrics["cluster_id"].nunique()
    assert n_clusters > 16, f"Louvain should partition into multiple communities per component, got {n_clusters}"
    assert len(cluster_map) == 2248

    # Cross cluster identification
    assert "cross_cluster" in df_metrics.columns
    assert df_metrics["cross_cluster"].dtype == bool
    # There should be nodes connecting multiple clusters
    assert df_metrics["cross_cluster"].sum() > 0
