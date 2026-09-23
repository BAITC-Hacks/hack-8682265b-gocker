"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  Layers,
  Table,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import GraphView, { GraphNode, GraphEdge } from "@/components/GraphView";
import PriorityTable from "@/components/PriorityTable";
import ClusterBubbleMap from "@/components/ClusterBubbleMap";
import NodeCard from "@/components/NodeCard";
import AssistantPanel from "@/components/AssistantPanel";
import OnboardingModal from "@/components/OnboardingModal";

type ActiveTab = "table" | "clusters" | "graph";

export default function AnalystWorkspace() {
  // Landing default is Investigation Queue (table)
  const [activeTab, setActiveTab] = useState<ActiveTab>("table");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [selectedGid, setSelectedGid] = useState<number | null>(null);
  const [highlightedGids, setHighlightedGids] = useState<number[]>([]);
  const [activeRoleFilter, setActiveRoleFilter] = useState<string | null>(null);
  const [activeClusterFilter, setActiveClusterFilter] = useState<number | null>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);

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
    } catch {
      setErrorMsg("Could not load graph data. Make sure backend service is running.");
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

  // Priority count: nodes with priority_score > 0.7 (or >= 0.5)
  const priorityNodeCount = useMemo(() => {
    return nodes.filter((n) => n.priority_score > 0.7).length;
  }, [nodes]);

  const totalTurnover = useMemo(() => {
    if (summary?.total_turnover_kzt) return summary.total_turnover_kzt;
    return edges.reduce((acc, e) => acc + (e.sum_kzt || 0), 0);
  }, [summary, edges]);

  const handleAskAboutNode = (gid: number) => {
    const target = nodes.find((n) => n.gid === gid);
    const roleInfo = target ? ` (role: ${target.role}, priority: ${target.priority_score.toFixed(3)})` : "";
    setAssistantPrompt(`Analyze account GID ${gid}${roleInfo}. What are the primary counterparty money flows and risk indicators?`);
    setIsAssistantOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--fb-bg)] text-[var(--fb-text-primary)] overflow-hidden font-sans">
      {/* 3-Step First-Time Onboarding Overlay */}
      <OnboardingModal />

      {/* Top Header - Compact */}
      <header className="h-14 border-b border-[var(--fb-border)] bg-[var(--fb-surface)] px-4 flex items-center justify-between shrink-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--fb-accent)] flex items-center justify-center text-black font-extrabold">
            <Network className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold tracking-tight text-[var(--fb-text-primary)]">
                FREEDOM BANK
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-neutral-200 dark:bg-neutral-800 text-[var(--fb-text-secondary)]">
                MONEY GRAPH
              </span>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <nav className="flex items-center p-0.5 rounded-lg bg-[var(--fb-border)]/50 border border-[var(--fb-border)]">
          <button
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
              activeTab === "table"
                ? "bg-[var(--fb-bg)] text-[var(--fb-text-primary)] shadow-xs"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Investigation Queue</span>
          </button>

          <button
            onClick={() => setActiveTab("clusters")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
              activeTab === "clusters"
                ? "bg-[var(--fb-bg)] text-[var(--fb-text-primary)] shadow-xs"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
            <span>Cluster Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab("graph")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
              activeTab === "graph"
                ? "bg-[var(--fb-bg)] text-[var(--fb-text-primary)] shadow-xs"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Network Graph</span>
          </button>
        </nav>

        {/* Compact Metrics & Controls */}
        <div className="flex items-center gap-3">
          {/* Node Count */}
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">Nodes</span>
            <span className="font-mono text-xs font-bold text-[var(--fb-text-primary)]">
              {nodes.length ? nodes.length.toLocaleString() : "—"}
            </span>
          </div>

          <div className="hidden sm:block h-6 w-px bg-[var(--fb-border)]" />

          {/* Priority Node Count */}
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">Priority (&gt;0.7)</span>
            <span className="font-mono text-xs font-bold text-rose-600">
              {priorityNodeCount}
            </span>
          </div>

          <div className="hidden md:block h-6 w-px bg-[var(--fb-border)]" />

          {/* Total Turnover */}
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">Total Turnover</span>
            <span className="font-mono text-xs font-bold text-[var(--fb-text-primary)]">
              {(totalTurnover / 1_000_000).toFixed(1)}M KZT
            </span>
          </div>

          <div className="h-6 w-px bg-[var(--fb-border)]" />

          {/* GID Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--fb-text-secondary)]" />
            <input
              type="text"
              placeholder="Search GID..."
              value={searchGidInput}
              onChange={(e) => setSearchGidInput(e.target.value)}
              className="w-32 lg:w-44 pl-8 pr-2 py-1 text-xs rounded-md bg-[var(--fb-bg)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] placeholder-[var(--fb-text-secondary)] focus:outline-none focus:border-[var(--fb-accent-dark)]"
            />
          </form>

          {/* Recompute Button */}
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="px-3 py-1.5 rounded-md bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:border-[var(--fb-accent)] text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Recalculate network metrics and roles"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? "animate-spin text-[var(--fb-accent-dark)]" : ""}`} />
            <span className="hidden sm:inline">
              {recomputing ? "Recalculating..." : "Recompute"}
            </span>
          </button>

          {/* Network Overview Drawer Toggle */}
          <button
            onClick={() => setIsOverviewOpen(!isOverviewOpen)}
            className={`p-1.5 rounded-md border text-xs font-medium transition flex items-center gap-1 ${
              isOverviewOpen
                ? "bg-[var(--fb-accent)] text-black border-[var(--fb-accent)]"
                : "bg-[var(--fb-surface)] border-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
            title="Toggle Network Overview"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Area with Optional Sidebars */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Loading Spinner with Status Text */}
        {(loading || recomputing) && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-50">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--fb-accent-dark)]" />
            <span className="text-xs font-bold text-[var(--fb-text-primary)]">
              {recomputing ? "Recalculating graph & role metrics…" : "Loading financial network…"}
            </span>
          </div>
        )}

        {/* Collapsible Network Overview Sidebar */}
        {isOverviewOpen && (
          <aside className="w-72 border-r border-[var(--fb-border)] bg-[var(--fb-surface)] flex flex-col shrink-0 z-20 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="p-3.5 border-b border-[var(--fb-border)] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--fb-text-primary)]">
                Network Overview
              </span>
              <button
                onClick={() => setIsOverviewOpen(false)}
                className="text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] p-0.5"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <div className="space-y-2">
                <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold">
                  Role Distribution
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-coordinator)] font-semibold">Coordinators</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "coordinator").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-consolidator)] font-semibold">Consolidators</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "consolidator").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-distributor)] font-semibold">Distributors</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "distributor").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-transit)] font-semibold">Transit Intermediaries</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "transit").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-terminal)] font-semibold">Terminal Sinks</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "terminal").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-peripheral)] font-semibold">Peripheral</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "peripheral").length}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--fb-border)]">
                <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold">
                  Network Properties
                </span>
                <div className="space-y-1 text-xs text-[var(--fb-text-secondary)]">
                  <div className="flex justify-between">
                    <span>Seed Accounts:</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">
                      {nodes.filter((n) => n.is_seed).length}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Louvain Clusters:</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">{clusters.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Transaction Edges:</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">{edges.length.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Hop-4 Truncated Sinks:</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">
                      {nodes.filter((n) => n.truncated_by_depth).length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Advanced Patterns */}
              <div className="space-y-2 pt-2 border-t border-[var(--fb-border)]">
                <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold">
                  Advanced Flow Patterns
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-purple-700 dark:text-purple-400 font-semibold">Circular Flow Loops</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.in_cycle).length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-blue-700 dark:text-blue-400 font-semibold">Rapid Transit (&lt;48h)</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.rapid_transit).length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">Structuring Risk</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.structuring_risk).length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Network Resilience Simulation */}
              <div className="space-y-2 pt-2 border-t border-[var(--fb-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold">
                    Resilience Simulation
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                    Attack Test
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-2 text-[11px]">
                  <div>
                    <span className="text-[var(--fb-text-secondary)]">Baseline Giant:</span>{" "}
                    <strong className="text-[var(--fb-text-primary)] font-mono">1,877 nodes</strong> (35 components)
                  </div>
                  <div className="pt-1.5 border-t border-[var(--fb-border)]">
                    <div className="text-[var(--fb-text-secondary)]">Remove Top 5 Coordinators:</div>
                    <div className="flex justify-between font-semibold text-[var(--fb-text-primary)] mt-0.5">
                      <span>Fragments into:</span>
                      <span className="font-mono text-rose-600">129 components</span>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-[var(--fb-border)]">
                    <div className="text-[var(--fb-text-secondary)]">Remove Top 10 Coordinators:</div>
                    <div className="flex justify-between font-semibold text-[var(--fb-text-primary)] mt-0.5">
                      <span>Fragments into:</span>
                      <span className="font-mono text-rose-700">228 components</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Center Canvas / Table / Cluster Explorer View */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {activeTab === "table" && (
            <PriorityTable
              nodes={nodes}
              onSelectNode={(gid) => setSelectedGid(gid)}
              onAskAboutNode={handleAskAboutNode}
              onSwitchToGraph={() => setActiveTab("graph")}
            />
          )}

          {activeTab === "clusters" && (
            <ClusterBubbleMap
              clusters={clusters}
              onSelectCluster={(cId) => {
                setActiveClusterFilter(cId);
                setActiveTab("graph");
              }}
            />
          )}

          {activeTab === "graph" && (
            <GraphView
              nodes={nodes}
              edges={edges}
              selectedGid={selectedGid}
              highlightedGids={highlightedGids}
              onSelectNode={(gid) => setSelectedGid(gid)}
              activeRoleFilter={activeRoleFilter}
              onSetRoleFilter={setActiveRoleFilter}
              activeClusterFilter={activeClusterFilter}
              onClearClusterFilter={() => setActiveClusterFilter(null)}
              onOpenClusterExplorer={() => setActiveTab("clusters")}
            />
          )}
        </div>

        {/* Right Persistent Node Card (when node selected) */}
        {selectedNode && (
          <NodeCard
            node={selectedNode}
            edges={edges}
            onClose={() => setSelectedGid(null)}
            onSelectNode={(gid) => setSelectedGid(gid)}
            onAskAboutNode={handleAskAboutNode}
          />
        )}
      </div>

      {/* AI Assistant Chat Drawer */}
      <AssistantPanel
        onSelectNode={(gid) => {
          setSelectedGid(gid);
          setActiveTab("graph");
        }}
        onHighlightGids={setHighlightedGids}
        selectedGid={selectedGid}
        isOpen={isAssistantOpen}
        onToggle={() => setIsAssistantOpen(!isAssistantOpen)}
        externalPrompt={assistantPrompt}
        onClearExternalPrompt={() => setAssistantPrompt(null)}
      />
    </div>
  );
}
