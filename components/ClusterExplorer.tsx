"use client";

import React, { useState, useMemo } from "react";
import { Layers, Search, ArrowRight, Eye, Users, TrendingUp, Sparkles } from "lucide-react";

interface ClusterItem {
  cluster_id: number;
  n_nodes: number;
  n_seed: number;
  sum_kzt_internal: number;
  top_gids: number[];
  hypothesis: string;
}

interface ClusterExplorerProps {
  clusters: ClusterItem[];
  onSelectNode: (gid: number) => void;
  onFilterClusterOnGraph: (clusterId: number) => void;
  onSwitchToGraph: () => void;
}

export default function ClusterExplorer({
  clusters,
  onSelectNode,
  onFilterClusterOnGraph,
  onSwitchToGraph,
}: ClusterExplorerProps) {
  const [search, setSearch] = useState("");
  const [minTurnover, setMinTurnover] = useState(false);

  const filteredClusters = useMemo(() => {
    return clusters
      .filter((c) => {
        const matchesSearch =
          search === "" ||
          String(c.cluster_id).includes(search) ||
          c.hypothesis.toLowerCase().includes(search.toLowerCase()) ||
          c.top_gids.some((g) => String(g).includes(search));

        const matchesTurnover = !minTurnover || c.sum_kzt_internal > 1000000;

        return matchesSearch && matchesTurnover;
      })
      .sort((a, b) => b.sum_kzt_internal - a.sum_kzt_internal);
  }, [clusters, search, minTurnover]);

  return (
    <div className="flex flex-col h-full bg-[#080d19] text-slate-100 p-6 overflow-hidden">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Cluster & Subnetwork Explorer
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Louvain community detection separated across the 16 weakly connected network components ({clusters.length} total clusters).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search cluster # or actors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={() => setMinTurnover(!minTurnover)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition ${
              minTurnover
                ? "bg-indigo-950 text-indigo-300 border-indigo-700 font-semibold"
                : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
          >
            Turnover &gt; 1M KZT
          </button>
        </div>
      </div>

      {/* Grid of Cluster Cards */}
      <div className="flex-1 overflow-y-auto mt-4 pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClusters.map((c) => (
            <div
              key={c.cluster_id}
              className="p-4 rounded-xl glass-panel bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/50 transition flex flex-col justify-between shadow-lg group"
            >
              <div>
                {/* Top Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center justify-center font-bold text-xs font-mono">
                      #{c.cluster_id}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      Cluster {c.cluster_id}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onFilterClusterOnGraph(c.cluster_id);
                      onSwitchToGraph();
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px]"
                    title="Focus on network graph"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    Focus Graph
                  </button>
                </div>

                {/* Metrics Badges */}
                <div className="grid grid-cols-3 gap-2 my-3">
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Accounts</div>
                    <div className="font-mono font-semibold text-slate-200 text-xs">
                      {c.n_nodes}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Seeds</div>
                    <div className="font-mono font-semibold text-cyan-400 text-xs">
                      {c.n_seed}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Turnover</div>
                    <div className="font-mono font-semibold text-emerald-400 text-xs truncate">
                      {c.sum_kzt_internal.toLocaleString(undefined, { maximumFractionDigits: 0 })} KZT
                    </div>
                  </div>
                </div>

                {/* Hypothesis */}
                <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs text-slate-300 mb-3 leading-relaxed">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Structure Hypothesis
                  </span>
                  {c.hypothesis}
                </div>
              </div>

              {/* Top GIDs */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-medium block mb-1.5">
                  Key Priority Actors:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {c.top_gids.map((gid) => (
                    <button
                      key={gid}
                      onClick={() => {
                        onSelectNode(gid);
                        onSwitchToGraph();
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 font-mono text-[10px] border border-slate-700 transition"
                    >
                      GID {String(gid).slice(-6)}
                    </button>
                  ))}
                  {c.top_gids.length === 0 && (
                    <span className="text-slate-600 text-[10px]">—</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredClusters.length === 0 && (
          <div className="p-16 text-center text-slate-500 text-xs">
            No clusters found matching your query.
          </div>
        )}
      </div>
    </div>
  );
}
