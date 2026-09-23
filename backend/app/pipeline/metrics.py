from typing import Dict, Tuple, Any
import networkx as nx
import pandas as pd


def compute_graph_metrics(
    G: nx.DiGraph,
    df: pd.DataFrame
) -> Tuple[pd.DataFrame, Dict[int, int], Dict[str, Any]]:
    betweenness = nx.betweenness_centrality(G, normalized=True)
    pagerank = nx.pagerank(G, weight="sum_kzt")

    cluster_map: Dict[int, int] = {}
    component_map: Dict[int, int] = {}
    cluster_counter = 0

    for comp_idx, comp_nodes in enumerate(nx.weakly_connected_components(G)):
        for node in comp_nodes:
            component_map[node] = comp_idx

        if len(comp_nodes) > 1:
            subgraph = G.subgraph(comp_nodes).to_undirected()
            communities = nx.community.louvain_communities(subgraph, seed=42)
            for comm in communities:
                for node in comm:
                    cluster_map[node] = cluster_counter
                cluster_counter += 1
        else:
            for node in comp_nodes:
                cluster_map[node] = cluster_counter
            cluster_counter += 1

    cross_cluster: Dict[int, bool] = {}
    for node in G.nodes():
        node_cluster = cluster_map.get(node, -1)
        neighbor_clusters = set()
        for neighbor in G.neighbors(node):
            c = cluster_map.get(neighbor, -1)
            if c != -1 and c != node_cluster:
                neighbor_clusters.add(c)
        for pred in G.predecessors(node):
            c = cluster_map.get(pred, -1)
            if c != -1 and c != node_cluster:
                neighbor_clusters.add(c)
        cross_cluster[node] = len(neighbor_clusters) >= 1

    # Cycle & return flow detection (Strongly Connected Components of size > 1)
    sccs = [scc for scc in nx.strongly_connected_components(G) if len(scc) > 1]
    in_cycle_nodes = set()
    for scc in sccs:
        in_cycle_nodes.update(scc)

    # Network resilience & fragmentation simulation
    initial_wccs = list(nx.weakly_connected_components(G))
    initial_wcc_count = len(initial_wccs)
    initial_giant_size = max(len(c) for c in initial_wccs) if initial_wccs else 0

    # Simulate removal of top 5 coordinator bridge nodes
    sorted_by_bw = sorted(betweenness.items(), key=lambda x: x[1], reverse=True)
    top_5_bridges = [node for node, _ in sorted_by_bw[:5]]
    top_10_bridges = [node for node, _ in sorted_by_bw[:10]]

    G_sim = G.copy()
    G_sim.remove_nodes_from(top_5_bridges)
    sim_5_wccs = list(nx.weakly_connected_components(G_sim))
    sim_5_giant_size = max(len(c) for c in sim_5_wccs) if sim_5_wccs else 0

    G_sim_10 = G.copy()
    G_sim_10.remove_nodes_from(top_10_bridges)
    sim_10_wccs = list(nx.weakly_connected_components(G_sim_10))
    sim_10_giant_size = max(len(c) for c in sim_10_wccs) if sim_10_wccs else 0

    resilience_report = {
        "initial_components": initial_wcc_count,
        "initial_giant_component_nodes": initial_giant_size,
        "cycle_participating_nodes_count": len(in_cycle_nodes),
        "cycle_clusters_count": len(sccs),
        "post_top5_removal": {
            "top_5_removed_gids": top_5_bridges,
            "components_count": len(sim_5_wccs),
            "giant_component_nodes": sim_5_giant_size,
            "giant_reduction_pct": round(
                ((initial_giant_size - sim_5_giant_size) / max(1, initial_giant_size)) * 100, 1
            ),
        },
        "post_top10_removal": {
            "top_10_removed_gids": top_10_bridges,
            "components_count": len(sim_10_wccs),
            "giant_component_nodes": sim_10_giant_size,
            "giant_reduction_pct": round(
                ((initial_giant_size - sim_10_giant_size) / max(1, initial_giant_size)) * 100, 1
            ),
        },
    }

    df_out = df.copy()
    df_out["betweenness"] = df_out["gid"].map(betweenness).fillna(0.0)
    df_out["pagerank"] = df_out["gid"].map(pagerank).fillna(0.0)
    df_out["component_id"] = df_out["gid"].map(component_map).fillna(0).astype(int)
    df_out["cluster_id"] = df_out["gid"].map(cluster_map).fillna(0).astype(int)
    df_out["cross_cluster"] = df_out["gid"].map(cross_cluster).fillna(False)
    df_out["in_cycle"] = df_out["gid"].isin(in_cycle_nodes)

    return df_out, cluster_map, resilience_report
