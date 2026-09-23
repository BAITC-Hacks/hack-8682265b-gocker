from typing import Dict, Tuple
import networkx as nx
import pandas as pd


def compute_graph_metrics(G: nx.DiGraph, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[int, int]]:
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

    df_out = df.copy()
    df_out["betweenness"] = df_out["gid"].map(betweenness).fillna(0.0)
    df_out["pagerank"] = df_out["gid"].map(pagerank).fillna(0.0)
    df_out["component_id"] = df_out["gid"].map(component_map).fillna(0).astype(int)
    df_out["cluster_id"] = df_out["gid"].map(cluster_map).fillna(0).astype(int)
    df_out["cross_cluster"] = df_out["gid"].map(cross_cluster).fillna(False)

    return df_out, cluster_map
