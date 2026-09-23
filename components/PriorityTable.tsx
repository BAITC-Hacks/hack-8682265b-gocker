"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  ArrowUpDown,
  Filter,
  Eye,
  Bot,
  Copy,
  Check,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Network,
  Download,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { GraphNode, ROLE_COLORS } from "./GraphView";
import { useT } from "@/lib/i18n";

export interface ReviewRecord {
  gid: number;
  status: "unreviewed" | "escalated" | "cleared";
  note?: string;
  reviewed_by?: string;
  updated_at?: string;
}

interface PriorityTableProps {
  nodes: GraphNode[];
  onSelectNode: (gid: number) => void;
  onAskAboutNode: (gid: number) => void;
  onSwitchToGraph: () => void;
  onExplainNode?: (gid: number) => void;
}

interface RiskFlag {
  key: string;
  label: string;
  color: string;
  desc: string;
}

export default function PriorityTable({
  nodes,
  onSelectNode,
  onAskAboutNode,
  onSwitchToGraph,
  onExplainNode,
}: PriorityTableProps) {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [reviews, setReviews] = useState<Record<number, ReviewRecord>>({});
  const [exportingPdf, setExportingPdf] = useState(false);
  const [copiedGid, setCopiedGid] = useState<number | null>(null);
  const [expandedGids, setExpandedGids] = useState<Set<number>>(new Set());
  const [openMenuGid, setOpenMenuGid] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/reviews")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ReviewRecord[]) => {
        const map: Record<number, ReviewRecord> = {};
        for (const item of data) {
          map[item.gid] = item;
        }
        setReviews(map);
      })
      .catch(() => { });
  }, []);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuGid(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUpdateStatus = async (gid: number, newStatus: "escalated" | "cleared" | "unreviewed") => {
    const previous = reviews[gid];
    setReviews((prev) => ({
      ...prev,
      [gid]: {
        gid,
        status: newStatus,
        note: prev[gid]?.note,
        updated_at: new Date().toISOString(),
      },
    }));

    try {
      const res = await fetch(`/api/reviews/${gid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Status update failed");
      const updated = await res.json();
      setReviews((prev) => ({ ...prev, [gid]: updated }));
    } catch {
      if (previous) {
        setReviews((prev) => ({ ...prev, [gid]: previous }));
      } else {
        setReviews((prev) => {
          const next = { ...prev };
          delete next[gid];
          return next;
        });
      }
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await fetch("/api/reviews/export");
      if (!res.ok) throw new Error("Failed to export PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aml_escalated_request_list.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PDF Export error: ${err.message}`);
    } finally {
      setExportingPdf(false);
    }
  };

  const escalatedCount = useMemo(() => {
    return Object.values(reviews).filter((r) => r.status === "escalated").length;
  }, [reviews]);

  const copyToClipboard = (gid: number) => {
    navigator.clipboard.writeText(String(gid));
    setCopiedGid(gid);
    setTimeout(() => setCopiedGid(null), 1500);
  };

  const toggleExpand = (gid: number) => {
    setExpandedGids((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  const getRiskFlags = (node: GraphNode): RiskFlag[] => {
    const flags: RiskFlag[] = [];
    if (node.is_seed) {
      flags.push({
        key: "SEED",
        label: "SEED",
        color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        desc: "Confirmed seed account",
      });
    }
    if (node.structuring_risk) {
      flags.push({
        key: "STRUCT",
        label: "STRUCT",
        color: "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
        desc: "Structuring pattern near 5,000 KZT cutoff",
      });
    }
    if (node.rapid_transit) {
      flags.push({
        key: "RAPID",
        label: "RAPID",
        color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        desc: `Rapid pass-through turnaround (${node.turnaround_hours ?? 48}h)`,
      });
    }
    if (node.in_cycle) {
      flags.push({
        key: "CYCLE",
        label: "CYCLE",
        color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
        desc: "Circular money flow loop / return cycle",
      });
    }
    return flags;
  };

  const filteredNodes = useMemo(() => {
    return nodes
      .filter((n) => {
        if (roleFilter !== "all" && n.role !== roleFilter) return false;
        if (riskFilter === "critical" && n.priority_score < 0.5) return false;
        if (riskFilter === "elevated" && (n.priority_score < 0.25 || n.priority_score >= 0.5)) return false;
        if (riskFilter === "moderate" && n.priority_score >= 0.25) return false;
        if (escalatedOnly && reviews[n.gid]?.status !== "escalated") return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            String(n.gid).includes(q) ||
            n.role.toLowerCase().includes(q) ||
            n.evidence.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.priority_score - a.priority_score);
  }, [nodes, roleFilter, riskFilter, escalatedOnly, search, reviews]);

  const totalPages = Math.ceil(filteredNodes.length / pageSize) || 1;
  const paginatedNodes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredNodes.slice(start, start + pageSize);
  }, [filteredNodes, page, pageSize]);

  const handleExportReferralList = () => {
    const headers = [
      "Rank",
      "Client_GID",
      "Assigned_Role",
      "Priority_Score",
      "AML_Role_Evidence_Rationale",
      "Total_Incoming_KZT",
      "Total_Outgoing_KZT",
      "Pass_Through_Ratio",
      "Is_Law_Enforcement_Seed",
      "Circular_Flow_Flag",
      "Rapid_Transit_Flag",
      "Structuring_Risk_Flag",
    ];

    const rows = filteredNodes.map((n, idx) => [
      idx + 1,
      n.gid,
      `"${n.role}"`,
      n.priority_score.toFixed(4),
      `"${n.evidence.replace(/"/g, '""')}"`,
      n.in_kzt,
      n.out_kzt,
      n.pass_through !== null ? (n.pass_through * 100).toFixed(1) + "%" : "N/A",
      n.is_seed ? "YES" : "NO",
      n.in_cycle ? "YES" : "NO",
      n.rapid_transit ? "YES" : "NO",
      n.structuring_risk ? "YES" : "NO",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `law_enforcement_inquiry_referral_list_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--fb-bg)] p-4 sm:p-6 overflow-hidden">
      {/* Table Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-[var(--fb-text-primary)] flex items-center gap-2">
            <span>Investigation Queue</span>
            <span className="text-xs font-normal text-[var(--fb-text-secondary)]">
              ({filteredNodes.length} accounts prioritized by topological risk)
            </span>
          </h2>
          <p className="text-[11px] text-[var(--fb-text-secondary)] mt-0.5">
            Click row to expand full counterparty details and evidence • Multipliers applied for bridge coordinators
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--fb-text-secondary)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search in queue..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 text-xs bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-lg text-[var(--fb-text-primary)] placeholder-[var(--fb-text-secondary)] focus:outline-none focus:border-[var(--fb-accent-dark)] w-40 sm:w-48"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-lg text-[var(--fb-text-primary)] focus:outline-none focus:border-[var(--fb-accent-dark)] cursor-pointer"
          >
            <option value="all">{t.table_filter_role}</option>
            <option value="coordinator">Coordinators</option>
            <option value="consolidator">Consolidators</option>
            <option value="distributor">Distributors</option>
            <option value="transit">Transit Accounts</option>
            <option value="terminal">Terminal Accounts</option>
            <option value="peripheral">Peripheral</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-lg text-[var(--fb-text-primary)] focus:outline-none focus:border-[var(--fb-accent-dark)] cursor-pointer"
          >
            <option value="all">{t.table_filter_risk}</option>
            <option value="critical">Critical Risk (Score ≥ 0.50)</option>
            <option value="elevated">Elevated Risk (Score 0.25 - 0.50)</option>
            <option value="moderate">Moderate / Low (Score &lt; 0.25)</option>
          </select>

          {/* Escalated Only Filter Chip */}
          <button
            onClick={() => {
              setEscalatedOnly(!escalatedOnly);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${escalatedOnly
                ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                : "bg-[var(--fb-surface)] border-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>{t.table_escalated_only}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-mono">
              {escalatedCount}
            </span>
          </button>

          {/* Export Referral Dossier Button (CSV) */}
          <button
            onClick={handleExportReferralList}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--fb-border)] bg-[var(--fb-surface)] hover:bg-[var(--fb-border)] text-[var(--fb-text-primary)] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Download Law Enforcement Referral List (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Referral List</span>
          </button>

          {/* Generate Request List PDF Export Button */}
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Download PDF Request List for Law Enforcement with all escalated accounts"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>
              {exportingPdf ? "Generating PDF..." : `Generate request list (${escalatedCount} escalated)`}
            </span>
          </button>

          {/* Open Network Button */}
          <button
            onClick={onSwitchToGraph}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--fb-accent)] text-black hover:bg-[var(--fb-accent-dark)] transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Open Network</span>
          </button>
        </div>
      </div>

      {/* Redesigned Clean 6-Column Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-[var(--fb-border)] bg-[var(--fb-surface)] shadow-xs">
        <table className="w-full text-left text-xs text-[var(--fb-text-primary)] border-collapse">
          <thead className="bg-[var(--fb-surface)] text-[var(--fb-text-secondary)] uppercase text-[10px] tracking-wider sticky top-0 z-20 border-b border-[var(--fb-border)] shadow-xs">
            <tr>
              <th className="py-3 px-3 font-semibold sticky left-0 bg-[var(--fb-surface)] z-20 w-16 text-center">
              {t.table_col_rank}
              </th>
              <th className="py-3 px-4 font-semibold sticky left-16 bg-[var(--fb-surface)] z-20 min-w-[200px]">
              {t.table_col_gid}
              </th>
              <th className="py-3 px-4 font-semibold w-28">{t.table_col_role}</th>
              <th className="py-3 px-4 font-semibold min-w-[170px]">{t.table_col_priority}</th>
              <th className="py-3 px-4 font-semibold min-w-[140px]">{t.table_col_risk}</th>
              <th className="py-3 px-4 font-semibold text-right w-44">{t.table_col_actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fb-border)]">
            {paginatedNodes.map((n, i) => {
              const rank = (page - 1) * pageSize + i + 1;
              const color = ROLE_COLORS[n.role] || ROLE_COLORS.peripheral;
              const isCritical = n.priority_score >= 0.5;
              const isElevated = n.priority_score >= 0.25 && n.priority_score < 0.5;
              const review = reviews[n.gid];
              const reviewStatus = review?.status || "unreviewed";
              const isExpanded = expandedGids.has(n.gid);
              const flags = getRiskFlags(n);
              const primaryFlag = flags[0];
              const remainingFlags = flags.slice(1);
              const isMenuOpen = openMenuGid === n.gid;

              return (
                <React.Fragment key={n.gid}>
                  {/* Default Compact Row (≤ 6 columns) */}
                  <tr
                    className={`hover:bg-[var(--fb-border)]/40 transition cursor-pointer ${isExpanded ? "bg-[var(--fb-border)]/20" : ""
                      }`}
                    onClick={() => toggleExpand(n.gid)}
                  >
                    {/* 1. Rank (Sticky left-0) */}
                    <td className="py-3 px-3 font-mono text-[var(--fb-text-secondary)] text-[11px] text-center sticky left-0 bg-[var(--fb-surface)] z-10 border-r border-[var(--fb-border)]/60">
                      <div className="flex items-center justify-center gap-1">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--fb-text-secondary)]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--fb-text-secondary)]" />
                        )}
                        <span>#{rank}</span>
                      </div>
                    </td>

                    {/* 2. Account GID (Sticky left-16) */}
                    <td className="py-3 px-4 sticky left-16 bg-[var(--fb-surface)] z-10 border-r border-[var(--fb-border)]/60 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--fb-text-primary)] text-xs">
                          {n.gid}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(n.gid);
                          }}
                          className="text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] p-0.5 rounded cursor-pointer"
                          title="Copy GID"
                        >
                          {copiedGid === n.gid ? (
                            <Check className="w-3 h-3 text-[var(--fb-accent-dark)]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 3. Role */}
                    <td className="py-3 px-4">
                      <span
                        className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider whitespace-nowrap"
                        style={{
                          backgroundColor: `${color.bg}18`,
                          color: color.bg,
                          border: `1px solid ${color.border}`,
                        }}
                      >
                        {n.role}
                      </span>
                    </td>

                    {/* 4. Priority Score Bar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`font-mono font-bold text-xs ${isCritical
                              ? "text-rose-600"
                              : isElevated
                                ? "text-amber-600"
                                : "text-[var(--fb-text-secondary)]"
                            }`}
                        >
                          {n.priority_score.toFixed(3)}
                        </span>
                        <div className="w-20 bg-[var(--fb-border)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isCritical
                                ? "bg-rose-500"
                                : isElevated
                                  ? "bg-amber-500"
                                  : "bg-[var(--fb-text-secondary)]"
                              }`}
                            style={{
                              width: `${Math.min(100, n.priority_score * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 5. Consolidated Risk Flags (1 Primary Pill + small +N chip) */}
                    <td className="py-3 px-4">
                      {primaryFlag ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${primaryFlag.color}`}
                            title={primaryFlag.desc}
                          >
                            {primaryFlag.label}
                          </span>
                          {remainingFlags.length > 0 && (
                            <span
                              className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] cursor-help"
                              title={`Additional flags: ${remainingFlags.map((f) => f.label).join(", ")}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              +{remainingFlags.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--fb-text-secondary)] text-[11px]">—</span>
                      )}
                    </td>

                    {/* 6. Consolidated Actions: 1 Primary Button + 1 Overflow Menu */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Primary Action Button reflecting state */}
                        {reviewStatus === "escalated" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(n.gid, "cleared");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-xs"
                            title="Mark account cleared or resolve escalation"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                            <span>Escalated ✓</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(n.gid, "escalated");
                            }}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition cursor-pointer"
                            title="Escalate account to law enforcement review"
                          >
                            Escalate
                          </button>
                        )}

                        {/* Overflow ⋯ Menu */}
                        <div className="relative" ref={isMenuOpen ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuGid(isMenuOpen ? null : n.gid);
                            }}
                            className="p-1.5 rounded-md hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition cursor-pointer"
                            title="More options"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-xl z-50 py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                              {onExplainNode && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuGid(null);
                                    onExplainNode(n.gid);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] flex items-center gap-2 cursor-pointer"
                                >
                                  <HelpCircle className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
                                  <span>Explain AML Rule</span>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuGid(null);
                                  onSelectNode(n.gid);
                                  onSwitchToGraph();
                                }}
                                className="w-full px-3 py-1.5 text-xs text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] flex items-center gap-2 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-500" />
                                <span>{t.table_view_graph}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuGid(null);
                                  onAskAboutNode(n.gid);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] flex items-center gap-2 cursor-pointer"
                              >
                                <Bot className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
                                <span>{t.table_ask_ai}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuGid(null);
                                  copyToClipboard(n.gid);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] flex items-center gap-2 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                                <span>{t.table_copy_gid}</span>
                              </button>
                              <div className="border-t border-[var(--fb-border)] my-1" />
                              {reviewStatus !== "unreviewed" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuGid(null);
                                    handleUpdateStatus(n.gid, "unreviewed");
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-neutral-500 hover:bg-[var(--fb-border)] flex items-center gap-2 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                                  <span>{t.nodecard_reset_btn}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Inline Expandable Detail Row */}
                  {isExpanded && (
                    <tr className="bg-[var(--fb-bg)]/80 border-b border-[var(--fb-border)]">
                      <td colSpan={6} className="py-3 px-4 sm:pl-14">
                        <div className="p-3.5 rounded-xl bg-[var(--fb-surface)] border border-[var(--fb-border)] space-y-3 shadow-inner">
                          {/* Top Metric Strip */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-[var(--fb-border)] pb-3">
                            <div>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold block">
                                Money In
                              </span>
                              <span className="font-mono font-bold text-[var(--fb-text-primary)]">
                                {n.in_kzt.toLocaleString()} KZT
                              </span>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] block">
                                ({n.in_deg} counterparties)
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold block">
                                Money Out
                              </span>
                              <span className="font-mono font-bold text-[var(--fb-text-primary)]">
                                {n.out_kzt.toLocaleString()} KZT
                              </span>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] block">
                                ({n.out_deg} counterparties)
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold block">
                                Pass-Through Ratio
                              </span>
                              <span className="font-mono font-bold text-[var(--fb-text-primary)]">
                                {n.pass_through !== null ? `${(n.pass_through * 100).toFixed(1)}%` : "—"}
                              </span>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] block">
                                {n.rapid_transit ? `Turnaround: ${n.turnaround_hours ?? 48}h` : "Turnaround: N/A"}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold block">
                                Topology & Position
                              </span>
                              <span className="text-[11px] font-semibold text-[var(--fb-text-primary)] block">
                                Cluster #{n.cluster_id} • Hop Depth {n.depth}
                              </span>
                              <span className="text-[10px] text-[var(--fb-text-secondary)] block font-mono">
                                PageRank: {n.pagerank?.toFixed(6) ?? "—"}
                              </span>
                            </div>
                          </div>

                          {/* Full Evidence Text (Never truncated) */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-bold tracking-wider">
                              Full AML Role Evidence
                            </span>
                            <p className="text-xs text-[var(--fb-text-primary)] leading-relaxed bg-[var(--fb-bg)] p-2.5 rounded-lg border border-[var(--fb-border)]">
                              {n.evidence}
                            </p>
                          </div>

                          {/* Case Note if present */}
                          {review?.note && (
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs">
                              <span className="font-bold text-amber-800 dark:text-amber-300">Case Review Note: </span>
                              <span className="text-amber-900 dark:text-amber-200">{review.note}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {paginatedNodes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[var(--fb-text-secondary)]">
                  {t.table_no_results}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-4 text-xs text-[var(--fb-text-secondary)] border-t border-[var(--fb-border)] mt-2 shrink-0">
        <div>
          Showing {(page - 1) * pageSize + 1} to{" "}
          {Math.min(page * pageSize, filteredNodes.length)} {t.table_page_of}{" "}
          <strong>{filteredNodes.length}</strong> accounts
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded-lg border border-[var(--fb-border)] bg-[var(--fb-surface)] disabled:opacity-40 hover:bg-[var(--fb-border)] transition cursor-pointer"
          >
            {t.table_prev}
          </button>
          <span>
            Page <strong>{page}</strong> {t.table_page_of} <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded-lg border border-[var(--fb-border)] bg-[var(--fb-surface)] disabled:opacity-40 hover:bg-[var(--fb-border)] transition cursor-pointer"
          >
            {t.table_next}
          </button>
        </div>
      </div>
    </div>
  );
}
