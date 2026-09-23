"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Network,
  RefreshCw,
  Search,
  Shield,
  Layers,
  ArrowRightLeft,
  Users,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import GraphView, { GraphNode, GraphEdge } from "@/components/GraphView";
import TopList from "@/components/TopList";
import NodeCard from "@/components/NodeCard";
import AssistantPanel from "@/components/AssistantPanel";

export default function Dashboard() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [selectedGid, setSelectedGid] = useState<number | null>(null);
  const [highlightedGids, setHighlightedGids] = useState<number[]>([]);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [searchGidInput, setSearchGidInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchGraphData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setClusters(data.clusters || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setErrorMsg(
        "Could not load graph data. Make sure the backend server is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable_llm: false }),
      });
      if (!res.ok) throw new Error(`Pipeline run error: ${res.status}`);
      await fetchGraphData();
    } catch (err: any) {
      alert(`Pipeline error: ${err.message}`);
    } finally {
      setRecomputing(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGid = searchGidInput.trim();
    if (!cleanGid) return;
    const numGid = Number(cleanGid);
    const target = nodes.find((n) => n.gid === numGid || String(n.gid).includes(cleanGid));
    if (target) {
      setSelectedGid(target.gid);
      setHighlightedGids([target.gid]);
    } else {
      alert(`No node found matching GID "${cleanGid}"`);
    }
  };

  const selectedNode = useMemo(() => {
    if (!selectedGid) return null;
    return nodes.find((n) => n.gid === selectedGid) || null;
  }, [nodes, selectedGid]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 px-4 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">
                MONEY GRAPH
              </h1>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                AML INTELLIGENCE
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Financial flow reconstruction & role attribution
            </div>
          </div>
        </div>

        {/* Global Key Metrics Badges */}
        {summary && (
          <div className="hidden lg:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Nodes:</span>
              <span className="font-semibold font-mono text-slate-200">
                {summary.total_nodes}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
              <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Edges:</span>
              <span className="font-semibold font-mono text-slate-200">
                {summary.total_edges}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Turnover:</span>
              <span className="font-semibold font-mono text-emerald-400">
                {summary.total_volume_kzt.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                KZT
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">Coordinators:</span>
              <span className="font-semibold font-mono text-purple-300">
                {summary.roles?.coordinator || 0}
              </span>
            </div>
          </div>
        )}

        {/* Actions & Search */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Jump to GID..."
              value={searchGidInput}
              onChange={(e) => setSearchGidInput(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </form>

          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition disabled:opacity-50"
            title="Recompute all graph metrics & roles"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${recomputing ? "animate-spin text-cyan-400" : ""}`}
            />
            <span className="hidden sm:inline">
              {recomputing ? "Computing..." : "Recompute"}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-3" />
            <div className="text-sm font-semibold text-slate-200">
              Loading AML Transaction Graph...
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Constructing 2,248 nodes and 3,119 money flows
            </div>
          </div>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 p-4 rounded-xl bg-rose-950/90 border border-rose-800 text-rose-200 text-xs shadow-2xl z-50 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>{errorMsg}</div>
            <button
              onClick={fetchGraphData}
              className="px-2 py-1 bg-rose-800 hover:bg-rose-700 rounded text-white font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Graph Canvas Visualizer */}
        <div className="flex-1 h-full relative">
          <GraphView
            nodes={nodes}
            edges={edges}
            selectedGid={selectedGid}
            highlightedGids={highlightedGids}
            onSelectNode={(gid) => {
              setSelectedGid(gid);
              setHighlightedGids([gid]);
            }}
            activeRoleFilter={activeRoleFilter}
          />

          {/* Node Inspector Card */}
          {selectedNode && (
            <NodeCard
              node={selectedNode}
              edges={edges}
              onClose={() => setSelectedGid(null)}
              onSelectNode={(gid) => {
                setSelectedGid(gid);
                setHighlightedGids([gid]);
              }}
            />
          )}

          {/* Assistant Chat Panel */}
          <AssistantPanel
            onSelectNode={(gid) => {
              setSelectedGid(gid);
              setHighlightedGids([gid]);
            }}
            onHighlightGids={(gids) => setHighlightedGids(gids)}
            selectedGid={selectedGid}
          />
        </div>

        {/* Right Sidebar: Ranked Priority Table */}
        <div className="w-80 shrink-0 h-full">
          <TopList
            nodes={nodes}
            selectedGid={selectedGid}
            onSelectNode={(gid) => {
              setSelectedGid(gid);
              setHighlightedGids([gid]);
            }}
            activeRoleFilter={activeRoleFilter}
            onSetRoleFilter={(role) => setActiveRoleFilter(role)}
          />
        </div>
      </div>
    </div>
  );
}
