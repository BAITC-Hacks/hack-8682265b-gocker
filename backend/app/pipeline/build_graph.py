import networkx as nx
import pandas as pd


def build_graph(edges: pd.DataFrame, nodes: pd.DataFrame) -> nx.DiGraph:
    G = nx.DiGraph()

    for row in edges.itertuples(index=False):
        G.add_edge(
            int(row.src),
            int(row.dst),
            sum_kzt=float(row.sum_kzt),
            n_tx=int(row.n_tx),
            depth=int(row.depth)
        )

    for gid in nodes["gid"]:
        gid_int = int(gid)
        if gid_int not in G:
            G.add_node(gid_int)

    return G
