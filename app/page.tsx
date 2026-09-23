"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Layers,
  Table,
  Sparkles,
  Users,
  ArrowRightLeft,
  TrendingUp,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import GraphView, { GraphNode, GraphEdge } from "@/components/GraphView";
import PriorityTable from "@/components/PriorityTable";
import ClusterExplorer from "@/components/ClusterExplorer";
import NodeCard from "@/components/NodeCard";
import AssistantPanel from "@/components/AssistantPanel";

type ActiveTab = "graph" | "table" | "clusters";

export default function AnalystWorkspace() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("graph");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [selectedGid, setSelectedGid] = useState<number | null>(null);
  const [highlightedGids, setHighlightedGids] = useState<number[]>([]);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string | null>(null);
  const [activeClusterFilter, setActiveClusterFilter] = useState<number | null>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
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
        "Could not load graph data. Make sure the backend service is running."
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
    const clean = searchGidInput.trim();
    if (!clean) return;
    const numGid = Number(clean);
    const target = nodes.find(
      (n) => n.gid === numGid || String(n.gid).includes(clean)
    );
    if (target) {
      setSelectedGid(target.gid);
      setHighlightedGids([target.gid]);
      setActiveTab("graph");
    } else {
      alert(`No account found matching GID "${clean}"`);
    }
  };

  const selectedNode = useMemo(() => {
    if (!selectedGid) return null;
    return nodes.find((n) => n.gid === selectedGid) || null;
  }, [nodes, selectedGid]);

  const highPriorityCount = useMemo(() => {
    return nodes.filter(
      (n) =>
        n.role === "coordinator" ||
        n.role === "consolidator" ||
        n.role === "distributor"
    ).length;
  }, [nodes]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      {/* Top Header & Navigation */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 px-5 flex items-center justify-between shrink-0 z-30 backdrop-blur-md">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight text-white">
                MONEY GRAPH
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-950/90 text-purple-300 border border-purple-800">
                AML ANALYST WORKSPACE
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Financial transaction graph & role attribution
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <nav className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
              activeTab === "graph"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Network Graph</span>
          </button>

          <button
            onClick={() => setActiveTab("table")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
              activeTab === "table"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Investigation Queue</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-amber-300">
              {highPriorityCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("clusters")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
              activeTab === "clusters"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Cluster Explorer</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-cyan-300">
              82
            </span>
          </button>
        </nav>

        {/* Search & Actions */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Jump to GID..."
              value={searchGidInput}
              onChange={(e) => setSearchGidInput(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition"
            />
          </form>

          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition disabled:opacity-50"
            title="Recompute all graph metrics and roles"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                recomputing ? "animate-spin text-cyan-400" : ""
              }`}
            />
            <span className="hidden md:inline">
              {recomputing ? "Computing..." : "Recompute"}
            </span>
          </button>
        </div>
      </header>

      {/* Global Metrics Strip */}
      {summary && (
        <div className="h-9 border-b border-slate-800/80 bg-slate-950/60 px-5 flex items-center justify-between text-xs text-slate-400 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Total Accounts:</span>
              <span className="font-mono font-bold text-slate-200">
                {summary.total_nodes}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Money Flows:</span>
              <span className="font-mono font-bold text-slate-200">
                {summary.total_edges}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Total Turnover:</span>
              <span className="font-mono font-bold text-emerald-400">
                {summary.total_volume_kzt.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                KZT
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Seed Clients:</span>
              <span className="font-mono font-bold text-cyan-400">
                {summary.total_seed}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-500">Key Bridge Coordinators:</span>
              <span className="font-mono font-bold text-purple-400">
                {summary.roles?.coordinator || 0}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-500">Consolidators:</span>
              <span className="font-mono font-bold text-amber-400">
                {summary.roles?.consolidator || 0}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 hidden lg:block">
            Tip: Click any account on the graph or table to open counterparty analysis.
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 overflow-hidden relative">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-[#070b14]/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-3" />
            <div className="text-sm font-semibold text-slate-200">
              Loading AML Transaction Graph...
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Constructing 2,248 accounts and 3,119 money flows
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {errorMsg && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 p-4 rounded-xl bg-rose-950/90 border border-rose-800 text-rose-200 text-xs shadow-2xl z-50 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>{errorMsg}</div>
            <button
              onClick={fetchGraphData}
              className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 rounded text-white font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tab 1: Network Graph */}
        {activeTab === "graph" && (
          <div className="w-full h-full relative">
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
              onSetRoleFilter={setActiveRoleFilter}
              activeClusterFilter={activeClusterFilter}
              onClearClusterFilter={() => setActiveClusterFilter(null)}
            />

            {/* Right-Docked Node Inspector */}
            {selectedNode && (
              <NodeCard
                node={selectedNode}
                edges={edges}
                onClose={() => setSelectedGid(null)}
                onSelectNode={(gid) => {
                  setSelectedGid(gid);
                  setHighlightedGids([gid]);
                }}
                onAskAboutNode={(gid) => {
                  setIsAssistantOpen(true);
                }}
              />
            )}
          </div>
        )}

        {/* Tab 2: Investigation Queue */}
        {activeTab === "table" && (
          <PriorityTable
            nodes={nodes}
            onSelectNode={(gid) => {
              setSelectedGid(gid);
              setHighlightedGids([gid]);
            }}
            onAskAboutNode={(gid) => {
              setSelectedGid(gid);
              setIsAssistantOpen(true);
            }}
            onSwitchToGraph={() => setActiveTab("graph")}
          />
        )}

        {/* Tab 3: Cluster Explorer */}
        {activeTab === "clusters" && (
          <ClusterExplorer
            clusters={clusters}
            onSelectNode={(gid) => {
              setSelectedGid(gid);
              setHighlightedGids([gid]);
            }}
            onFilterClusterOnGraph={(clusterId) => {
              setActiveClusterFilter(clusterId);
              setActiveTab("graph");
            }}
            onSwitchToGraph={() => setActiveTab("graph")}
          />
        )}

        {/* Global AI Assistant Floating Drawer */}
        <AssistantPanel
          onSelectNode={(gid) => {
            setSelectedGid(gid);
            setHighlightedGids([gid]);
            setActiveTab("graph");
          }}
          onHighlightGids={(gids) => {
            setHighlightedGids(gids);
            setActiveTab("graph");
          }}
          selectedGid={selectedGid}
          isOpen={isAssistantOpen}
          onToggle={() => setIsAssistantOpen(!isAssistantOpen)}
        />
      </main>
    </div>
  );
}
