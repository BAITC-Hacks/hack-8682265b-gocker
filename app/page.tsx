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
  UploadCloud,
  HelpCircle,
  BarChart3,
  ClipboardList,
  Check,
  Copy,
  X,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Languages,
} from "lucide-react";
import GraphView, { GraphNode, GraphEdge, ROLE_COLORS } from "@/components/GraphView";
import PriorityTable from "@/components/PriorityTable";
import ClusterBubbleMap from "@/components/ClusterBubbleMap";
import NodeCard from "@/components/NodeCard";
import AssistantPanel from "@/components/AssistantPanel";
import OnboardingModal from "@/components/OnboardingModal";
import UploadModal from "@/components/UploadModal";
import { useT } from "@/lib/i18n";

type ActiveTab = "table" | "clusters" | "graph";

export default function AnalystWorkspace() {
  const { t, toggleLocale } = useT();
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
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [searchGidInput, setSearchGidInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDatasetStatus = async () => {
    try {
      const res = await fetch("/api/dataset/status");
      if (res.ok) {
        const data = await res.json();
        setDatasetStatus(data);
      }
    } catch {}
  };

  // Feature 2: Explain GID State
  const [explainGidInput, setExplainGidInput] = useState("");
  const [explainResult, setExplainResult] = useState<any | null>(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [isExplainPopoverOpen, setIsExplainPopoverOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Feature 3: Threshold Sensitivity State
  const [sensitivityData, setSensitivityData] = useState<any | null>(null);
  const [activeSensitivityRole, setActiveSensitivityRole] = useState<"consolidator" | "coordinator" | "distributor" | "transit">("consolidator");

  // Feature 4: Data Completeness & Next-Request State
  const [dataGaps, setDataGaps] = useState<any[] | null>(null);
  const [copiedGaps, setCopiedGaps] = useState<Record<number, boolean>>({});

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
      await fetchDatasetStatus();
    } catch {
      setErrorMsg(t.error_load_graph);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
    fetch("/api/sensitivity")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSensitivityData(d))
      .catch(() => {});
    fetch("/api/data-gaps")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDataGaps(d))
      .catch(() => {});
  }, []);

  const handleExplain = async (targetGid: number | string) => {
    const clean = String(targetGid).trim();
    if (!clean) return;
    setExplainLoading(true);
    setIsExplainOpen(true);
    setCopiedScript(false);
    try {
      const res = await fetch(`/api/explain/${clean}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setExplainResult(data);
    } catch (err: any) {
      setExplainResult({ error: `Could not explain GID ${clean}: ${err.message}` });
    } finally {
      setExplainLoading(false);
    }
  };

  const handleExplainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!explainGidInput.trim()) return;
    handleExplain(explainGidInput.trim());
  };

  const copyExplainScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const copyGapRequest = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedGaps((prev) => ({ ...prev, [idx]: true }));
    setTimeout(() => setCopiedGaps((prev) => ({ ...prev, [idx]: false })), 2000);
  };

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
      alert(`${t.error_no_account} "${clean}"`);
    }
  };

  const selectedNode = useMemo(() => {
    if (!selectedGid) return null;
    return nodes.find((n) => n.gid === selectedGid) || null;
  }, [nodes, selectedGid]);

  // Priority count: nodes with priority_score > 0.7 (or >= 0.5)
  // High priority count: nodes with priority_score >= 0.5 (or from summary self-check)
  const priorityNodeCount = useMemo(() => {
    if (summary?.top_priority_count !== undefined) {
      return summary.top_priority_count;
    }
    return nodes.filter((n) => n.priority_score >= 0.5).length;
  }, [nodes, summary]);

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

      {/* Top Header - Structured Left-to-Right without wrapping */}
      <header className="h-14 border-b border-[var(--fb-border)] bg-[var(--fb-surface)] px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 flex-nowrap gap-4 xl:gap-6 min-w-0">
        {/* 1. Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--fb-accent)] flex items-center justify-center text-black font-extrabold">
            <Network className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold tracking-tight text-[var(--fb-text-primary)]">
                {t.brand}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-neutral-200 dark:bg-neutral-800 text-[var(--fb-text-secondary)]">
                {t.brand_product}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Nav Tabs */}
        <nav className="flex items-center p-0.5 rounded-lg bg-[var(--fb-border)]/50 border border-[var(--fb-border)] shrink-0">
          <button
            onClick={() => setActiveTab("table")}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "table"
                ? "bg-[var(--fb-bg)] text-[var(--fb-text-primary)] shadow-xs"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <Table className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">{t.tab_queue}</span>
          </button>

          <button
            onClick={() => setActiveTab("clusters")}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "clusters"
                ? "bg-[var(--fb-bg)] text-[var(--fb-text-primary)] shadow-xs"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[var(--fb-accent-dark)] shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">{t.tab_clusters}</span>
          </button>

          <button
            onClick={() => setActiveTab("graph")}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "graph"
                ? "bg-[var(--fb-bg)] text-[var(--fb-text-primary)] shadow-xs"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <Network className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline whitespace-nowrap">{t.tab_graph}</span>
          </button>
        </nav>

        {/* 3. KPI Cluster — only at xl to leave room for Russian labels */}
        <div className="hidden xl:flex items-center gap-3 shrink-0">
          {/* Node Count */}
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold max-w-[90px] truncate">{t.kpi_nodes}</span>
            <span className="font-mono text-xs font-bold text-[var(--fb-text-primary)]">
              {nodes.length ? nodes.length.toLocaleString() : "—"}
            </span>
          </div>

          <div className="h-6 w-px bg-[var(--fb-border)]" />

          {/* High Priority (≥0.5) Node Count */}
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold max-w-[100px] truncate" title={t.kpi_high_priority}>{t.kpi_high_priority}</span>
            <span className="font-mono text-xs font-bold text-rose-600">
              {priorityNodeCount}
            </span>
          </div>

          <div className="h-6 w-px bg-[var(--fb-border)]" />

          {/* Total Turnover */}
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold max-w-[90px] truncate">{t.kpi_total_turnover}</span>
            <span className="font-mono text-xs font-bold text-[var(--fb-text-primary)]">
              {(totalTurnover / 1_000_000).toFixed(1)}M KZT
            </span>
          </div>
        </div>

        {/* 4. GID Search Box */}
        <form onSubmit={handleSearchSubmit} className="relative shrink min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--fb-text-secondary)] pointer-events-none" />
          <input
            type="text"
            placeholder={t.search_placeholder}
            value={searchGidInput}
            onChange={(e) => setSearchGidInput(e.target.value)}
            className="w-28 lg:w-36 xl:w-44 pl-8 pr-2.5 py-1 text-xs rounded-md bg-[var(--fb-bg)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] placeholder-[var(--fb-text-secondary)] focus:outline-none focus:border-[var(--fb-accent-dark)] font-mono"
          />
        </form>

        {/* 5. Primary Actions */}
        <div className="flex items-center gap-2 shrink-0 relative">
          {/* Explain GID Popover Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setIsExplainPopoverOpen(!isExplainPopoverOpen)}
              className={`p-1.5 rounded-md border text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                isExplainPopoverOpen
                  ? "bg-[var(--fb-accent)] text-black border-[var(--fb-accent)]"
                  : "bg-[var(--fb-surface)] border-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
              }`}
              title={t.explain_gid_title}
            >
              <HelpCircle className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
              <span className="hidden xl:inline text-xs font-semibold">{t.explain_gid_btn}</span>
            </button>

            {/* Explain GID Lightweight Popover */}
            {isExplainPopoverOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-3 rounded-xl bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--fb-border)]">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
                    {t.explain_gid_title}
                  </span>
                  <button
                    onClick={() => setIsExplainPopoverOpen(false)}
                    className="p-1 text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] rounded cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    handleExplainSubmit(e);
                    setIsExplainPopoverOpen(false);
                  }}
                  className="space-y-2.5"
                >
                  <div className="min-w-[220px] overflow-hidden">
                    <input
                      type="text"
                      placeholder={t.explain_gid_placeholder}
                      value={explainGidInput}
                      onChange={(e) => setExplainGidInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)] focus:border-[var(--fb-accent)] text-[var(--fb-text-primary)] placeholder-[var(--fb-text-secondary)] focus:outline-none font-mono truncate"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 rounded-lg bg-[var(--fb-accent)] hover:bg-[var(--fb-accent-dark)] text-black font-semibold text-xs transition cursor-pointer shadow-xs"
                  >
                    {t.explain_gid_submit}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Recompute Button */}
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="px-2.5 py-1.5 rounded-md bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:border-[var(--fb-accent)] text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
            title="Recalculate network metrics and roles"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${recomputing ? "animate-spin text-[var(--fb-accent-dark)]" : ""}`} />
            <span className="hidden lg:inline whitespace-nowrap">
              {recomputing ? t.recomputing_btn : t.recompute_btn}
            </span>
          </button>

          {/* Active Case Badge */}
          <div
            onClick={() => setIsUploadModalOpen(true)}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--fb-border)] bg-[var(--fb-bg)] cursor-pointer hover:border-[var(--fb-accent-dark)] transition text-[11px]"
            title="Click to manage or upload case data"
          >
            <span className={`w-2 h-2 rounded-full ${datasetStatus?.is_custom ? "bg-amber-500" : "bg-emerald-500"} animate-pulse`} />
            <span className="text-[var(--fb-text-secondary)]">{t.case_label}</span>
            <span className="font-semibold text-[var(--fb-text-primary)] max-w-[130px] truncate">
              {datasetStatus?.is_custom ? datasetStatus.dataset_name : t.case_baseline}
            </span>
          </div>

          {/* Upload Custom Data Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3 py-1.5 rounded-md bg-[var(--fb-accent)] text-black hover:bg-[var(--fb-accent-dark)] text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            title="Upload Custom Transfer Data or Case Seeds"
          >
            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:inline whitespace-nowrap">{t.upload_data_btn}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLocale}
            className="px-2.5 py-1.5 rounded-md bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
            title="Toggle language"
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.lang_toggle}</span>
          </button>

          {/* Network Overview Drawer Toggle */}
          <button
            onClick={() => setIsOverviewOpen(!isOverviewOpen)}
            className={`p-1.5 rounded-md border text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
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
              {recomputing ? t.loading_recomputing : t.loading_network}
            </span>
          </div>
        )}

        {/* Collapsible Network Overview Sidebar */}
        {isOverviewOpen && (
          <aside className="w-72 border-r border-[var(--fb-border)] bg-[var(--fb-surface)] flex flex-col shrink-0 z-20 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="p-3.5 border-b border-[var(--fb-border)] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--fb-text-primary)]">
                {t.overview_title}
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
                  {t.overview_role_distribution}
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-coordinator)] font-semibold">{t.overview_coordinators}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "coordinator").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-consolidator)] font-semibold">{t.overview_consolidators}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "consolidator").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-distributor)] font-semibold">{t.overview_distributors}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "distributor").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-transit)] font-semibold">{t.overview_transit}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "transit").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-terminal)] font-semibold">{t.overview_terminal}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "terminal").length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-[var(--role-peripheral)] font-semibold">{t.overview_peripheral}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.role === "peripheral").length}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--fb-border)]">
                <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold">
                  {t.overview_network_props}
                </span>
                <div className="space-y-1 text-xs text-[var(--fb-text-secondary)]">
                  <div className="flex justify-between">
                    <span>{t.overview_seed_accounts}</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">
                      {nodes.filter((n) => n.is_seed).length}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.overview_louvain_clusters}</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">{clusters.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.overview_tx_edges}</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">{edges.length.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.overview_hop4_sinks}</span>
                    <strong className="text-[var(--fb-text-primary)] font-mono">
                      {nodes.filter((n) => n.truncated_by_depth).length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Advanced Patterns */}
              <div className="space-y-2 pt-2 border-t border-[var(--fb-border)]">
                <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold">
                  {t.overview_advanced_patterns}
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-purple-700 dark:text-purple-400 font-semibold">{t.overview_circular_loops}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.in_cycle).length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-blue-700 dark:text-blue-400 font-semibold">{t.overview_rapid_transit}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.rapid_transit).length}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">{t.overview_structuring_risk}</span>
                    <strong className="font-mono text-[var(--fb-text-primary)]">
                      {nodes.filter((n) => n.structuring_risk).length}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Network Disruption Simulation */}
              <div className="space-y-2 pt-2 border-t border-[var(--fb-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold">
                    {t.overview_disruption_title}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {t.overview_disruption_badge}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--fb-text-secondary)] leading-tight">
                  {t.overview_disruption_desc}
                </p>
                <div className="p-2.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-2 text-[11px]">
                  <div>
                    <span className="text-[var(--fb-text-secondary)]">{t.overview_intact_network}</span>{" "}
                    <strong className="text-[var(--fb-text-primary)] font-mono">{t.overview_intact_detail}</strong>
                  </div>
                  <div className="pt-1.5 border-t border-[var(--fb-border)]">
                    <div className="text-[var(--fb-text-secondary)]">{t.overview_freeze_top5}</div>
                    <div className="flex justify-between font-semibold text-[var(--fb-text-primary)] mt-0.5">
                      <span>{t.overview_splits_into}</span>
                      <span className="font-mono text-emerald-700 font-bold">{t.overview_fragments_5}</span>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-[var(--fb-border)]">
                    <div className="text-[var(--fb-text-secondary)]">{t.overview_freeze_top10}</div>
                    <div className="flex justify-between font-semibold text-[var(--fb-text-primary)] mt-0.5">
                      <span>{t.overview_splits_into}</span>
                      <span className="font-mono text-emerald-700 font-bold">{t.overview_fragments_10}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 3: Threshold Sensitivity Panel */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--fb-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold flex items-center gap-1.5">
                    <BarChart3 className="w-3 h-3 text-[var(--fb-accent-dark)]" />
                    {t.overview_sensitivity_title}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                    {t.overview_sensitivity_badge}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--fb-text-secondary)] leading-tight">
                  {t.overview_sensitivity_desc}
                </p>

                {/* Role Tabs */}
                <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)] text-[10px]">
                  {(["consolidator", "coordinator", "distributor", "transit"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setActiveSensitivityRole(r)}
                      className={`py-1 rounded capitalize font-medium transition cursor-pointer ${
                        activeSensitivityRole === r
                          ? "bg-[var(--fb-surface)] text-[var(--fb-text-primary)] font-bold shadow-xs border border-[var(--fb-border)]"
                          : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                      }`}
                    >
                      {r.slice(0, 4)}.
                    </button>
                  ))}
                </div>

                {/* Mini Bar Chart */}
                {sensitivityData && sensitivityData[activeSensitivityRole] ? (
                  <div className="p-2.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-2">
                    <div className="flex justify-between text-[10px] text-[var(--fb-text-secondary)]">
                      <span>{t.overview_sensitivity_threshold} ({sensitivityData[activeSensitivityRole].threshold_field})</span>
                      <span>{t.overview_sensitivity_flagged}</span>
                    </div>

                    <div className="space-y-1.5">
                      {sensitivityData[activeSensitivityRole].variants.map((v: any, idx: number) => {
                        const isBase = v.value === sensitivityData[activeSensitivityRole].base;
                        const maxVal = Math.max(...sensitivityData[activeSensitivityRole].variants.map((item: any) => item.n_nodes), 1);
                        const pct = Math.max(8, (v.n_nodes / maxVal) * 100);

                        return (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span className={isBase ? "font-bold text-[var(--fb-accent-dark)]" : "text-[var(--fb-text-secondary)]"}>
                                {v.label || v.value} {isBase && "(Base)"}
                              </span>
                              <strong className={isBase ? "text-[var(--fb-accent-dark)] font-bold" : "text-[var(--fb-text-primary)]"}>
                                {v.n_nodes}
                              </strong>
                            </div>
                            <div className="w-full bg-[var(--fb-surface)] h-2 rounded-full overflow-hidden border border-[var(--fb-border)]">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isBase ? "bg-[var(--fb-accent)]" : "bg-neutral-400 dark:bg-neutral-600"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Auto-Generated Commentary Paragraph */}
                    <div className="pt-2 border-t border-[var(--fb-border)]">
                      <p className="text-[10px] text-[var(--fb-text-secondary)] leading-relaxed italic">
                        "{sensitivityData[activeSensitivityRole].commentary}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-[var(--fb-text-secondary)] p-3 text-center">
                    {t.loading_sensitivity}
                  </div>
                )}
              </div>

              {/* Feature 4: Data Completeness / Next-Request Report */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--fb-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold flex items-center gap-1.5">
                    <ClipboardList className="w-3 h-3 text-emerald-600" />
                    {t.overview_data_gaps_title}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                    {t.overview_data_gaps_badge}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--fb-text-secondary)] leading-tight">
                  {t.overview_data_gaps_desc}
                </p>

                <div className="space-y-2">
                  {dataGaps && dataGaps.length > 0 ? (
                    dataGaps.map((gap: any, idx: number) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-1.5">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[11px] font-bold text-[var(--fb-text-primary)]">
                            {gap.category}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                            {gap.affected_count} {t.overview_affected}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--fb-text-secondary)] leading-tight">
                          {gap.finding}
                        </p>
                        <div className="p-2 rounded-lg bg-[var(--fb-surface)] border border-[var(--fb-border)] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--fb-accent-dark)]">
                              {t.overview_recommended_inquiry}
                            </span>
                            <button
                              onClick={() => copyGapRequest(idx, gap.recommended_request)}
                              className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--fb-border)] hover:bg-[var(--fb-accent)] hover:text-black transition flex items-center gap-1 cursor-pointer"
                              title="Copy inquiry text to clipboard"
                            >
                              {copiedGaps[idx] ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                              <span>{copiedGaps[idx] ? t.copied_btn : t.copy_btn}</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-[var(--fb-text-primary)] font-mono leading-tight">
                            {gap.recommended_request}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[10px] text-[var(--fb-text-secondary)] p-3 text-center">
                      {t.loading_data_gaps}
                    </div>
                  )}
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
              onExplainNode={handleExplain}
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
            onExplainNode={handleExplain}
          />
        )}
      </div>

      {/* Feature 2: Explain GID Fast Live Jury Lookup Modal */}
      {isExplainOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[var(--fb-text-primary)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--fb-border)] flex items-center justify-between bg-[var(--fb-bg)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--fb-accent)]/20 text-[var(--fb-accent-dark)] flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{t.explain_modal_title}</h3>
                  <p className="text-[11px] text-[var(--fb-text-secondary)]">
                    {t.explain_modal_subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExplainOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4 text-xs">
              {explainLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--fb-accent-dark)]" />
                  <span className="text-xs font-semibold text-[var(--fb-text-secondary)]">
                    Evaluating rule chain for account...
                  </span>
                </div>
              ) : explainResult?.error ? (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                  {explainResult.error}
                </div>
              ) : explainResult ? (
                <>
                  {/* Account Badge Card */}
                  <div className="p-3 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">{t.explain_account_gid}</div>
                      <div className="font-mono text-sm font-bold text-[var(--fb-text-primary)]">{explainResult.gid}</div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">{t.explain_assigned_role}</div>
                        <span
                          className="px-2.5 py-0.5 rounded text-xs uppercase font-extrabold"
                          style={{
                            backgroundColor: `${ROLE_COLORS[explainResult.final_role]?.bg || '#f1f5f9'}25`,
                            color: ROLE_COLORS[explainResult.final_role]?.bg || '#0f172a',
                            border: `1px solid ${ROLE_COLORS[explainResult.final_role]?.border || '#cbd5e1'}`
                          }}
                        >
                          {explainResult.final_role}
                        </span>
                      </div>
                      <div className="pl-3 border-l border-[var(--fb-border)]">
                        <div className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">{t.explain_priority_score}</div>
                        <div className="font-mono font-bold text-xs text-rose-600">
                          {Number(explainResult.priority_score).toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sequential Rule Evaluation Steps */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[var(--fb-text-secondary)] uppercase tracking-wide">
                      {t.explain_rule_chain}
                    </span>
                    <div className="space-y-2">
                      {explainResult.rule_trace?.map((step: any, idx: number) => {
                        const matched = step.matched;
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs transition ${
                              matched
                                ? "bg-emerald-500/10 border-emerald-500/40 text-[var(--fb-text-primary)]"
                                : "bg-[var(--fb-bg)]/50 border-[var(--fb-border)] opacity-70"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-[var(--fb-text-secondary)]">
                                  #{idx + 1}
                                </span>
                                <span className="uppercase text-[11px] tracking-wider">
                                  {t.explain_rule_label} {step.rule}
                                </span>
                              </span>
                              {matched ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> {t.explain_matched}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] text-[var(--fb-text-secondary)] bg-neutral-200 dark:bg-neutral-800">
                                  {t.explain_not_met}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-[var(--fb-text-secondary)] leading-relaxed pl-4 border-l-2 border-[var(--fb-border)] mt-1">
                              {step.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 30-Second Oral Jury Presentation Script */}
                  {(() => {
                    const matchedStep = explainResult.rule_trace?.find((s: any) => s.matched);
                    const oralSpeech = `Account ${explainResult.gid} is classified as ${explainResult.final_role.toUpperCase()} because ${matchedStep?.reason || "criteria matched"}.`;
                    return (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            {t.explain_oral_script}
                          </span>
                          <button
                            onClick={() => copyExplainScript(oralSpeech)}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 transition flex items-center gap-1 cursor-pointer"
                          >
                            {copiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedScript ? t.copied_oral_script : t.copy_oral_script}</span>
                          </button>
                        </div>
                        <p className="text-xs italic text-[var(--fb-text-primary)] font-medium leading-relaxed">
                          "{oralSpeech}"
                        </p>
                      </div>
                    );
                  })()}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[var(--fb-border)] bg-[var(--fb-bg)] flex items-center justify-between">
              <span className="text-[10px] text-[var(--fb-text-secondary)] font-mono">
                {t.explain_cli_fallback} python -m app.explain_cli {explainResult?.gid || "<gid>"}
              </span>
              <div className="flex gap-2">
                {explainResult && (
                  <button
                    onClick={() => {
                      setSelectedGid(explainResult.gid);
                      setHighlightedGids([explainResult.gid]);
                      setActiveTab("graph");
                      setIsExplainOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--fb-accent)] text-black font-semibold text-xs transition cursor-pointer"
                  >
                    {t.explain_focus_graph}
                  </button>
                )}
                <button
                  onClick={() => setIsExplainOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--fb-border)] text-xs font-semibold hover:bg-[var(--fb-border)] transition cursor-pointer"
                >
                  {t.explain_close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Custom Case Data Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={fetchGraphData}
        currentDataset={datasetStatus}
      />
    </div>
  );
}
