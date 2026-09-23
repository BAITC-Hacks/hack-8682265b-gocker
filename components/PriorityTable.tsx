"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  FileDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
} from "lucide-react";
import { GraphNode, ROLE_COLORS } from "./GraphView";

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

export default function PriorityTable({
  nodes,
  onSelectNode,
  onAskAboutNode,
  onSwitchToGraph,
  onExplainNode,
}: PriorityTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [reviews, setReviews] = useState<Record<number, ReviewRecord>>({});
  const [exportingPdf, setExportingPdf] = useState(false);
  const [copiedGid, setCopiedGid] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

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
      .catch(() => {});
  }, []);

  const handleUpdateStatus = async (gid: number, newStatus: "escalated" | "cleared" | "unreviewed") => {
    // Optimistic update
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
      // Revert if failed
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

  const filteredNodes = useMemo(() => {
    return nodes
      .filter((n) => {
        const matchesSearch =
          search === "" ||
          String(n.gid).includes(search) ||
          n.role.toLowerCase().includes(search.toLowerCase()) ||
          n.evidence.toLowerCase().includes(search.toLowerCase());

        const matchesRole = roleFilter === "all" || n.role === roleFilter;

        let matchesRisk = true;
        if (riskFilter === "critical") matchesRisk = n.priority_score >= 0.5;
        else if (riskFilter === "elevated")
          matchesRisk = n.priority_score >= 0.25 && n.priority_score < 0.5;
        else if (riskFilter === "moderate") matchesRisk = n.priority_score < 0.25;

        const isEscalated = reviews[n.gid]?.status === "escalated";
        const matchesEscalated = !escalatedOnly || isEscalated;

        return matchesSearch && matchesRole && matchesRisk && matchesEscalated;
      })
      .sort((a, b) => b.priority_score - a.priority_score);
  }, [nodes, search, roleFilter, riskFilter, escalatedOnly, reviews]);

  const totalPages = Math.ceil(filteredNodes.length / pageSize) || 1;
  const paginatedNodes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredNodes.slice(start, start + pageSize);
  }, [filteredNodes, page]);

  return (
    <div className="flex flex-col h-full bg-[var(--fb-bg)] text-[var(--fb-text-primary)] p-6 overflow-hidden">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--fb-border)]">
        <div>
          <h2 className="text-base font-bold text-[var(--fb-text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Investigation Queue (Priority Nodes)
          </h2>
          <p className="text-xs text-[var(--fb-text-secondary)] mt-0.5">
            Ranked risk candidates across all 2,248 accounts. Select any account to inspect details or open its network connections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--fb-text-secondary)]" />
            <input
              type="text"
              placeholder="Search GID, role, or evidence..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-lg text-[var(--fb-text-primary)] placeholder-[var(--fb-text-secondary)] focus:outline-none focus:border-[var(--fb-accent-dark)]"
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
            <option value="all">All Roles</option>
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
            <option value="all">All Risk Levels</option>
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
              escalatedOnly
                ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                : "bg-[var(--fb-surface)] border-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Escalated only</span>
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-mono">
              {escalatedCount}
            </span>
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

      {/* Table Container */}
      <div className="flex-1 overflow-auto mt-4 rounded-xl border border-[var(--fb-border)] bg-[var(--fb-surface)] shadow-xs">
        <table className="w-full text-left text-xs text-[var(--fb-text-primary)]">
          <thead className="bg-[var(--fb-surface)] text-[var(--fb-text-secondary)] uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-[var(--fb-border)]">
            <tr>
              <th className="py-3 px-4 font-semibold">Rank</th>
              <th className="py-3 px-4 font-semibold">Account GID</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Role</th>
              <th className="py-3 px-4 font-semibold">Priority Score</th>
              <th className="py-3 px-4 font-semibold">Money In</th>
              <th className="py-3 px-4 font-semibold">Money Out</th>
              <th className="py-3 px-4 font-semibold">Pass-Through</th>
              <th className="py-3 px-4 font-semibold">AML Role Evidence</th>
              <th className="py-3 px-4 text-right font-semibold">Actions</th>
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

              return (
                <tr
                  key={n.gid}
                  className="hover:bg-[var(--fb-border)]/40 transition cursor-pointer"
                  onClick={() => {
                    onSelectNode(n.gid);
                    onSwitchToGraph();
                  }}
                >
                  <td className="py-3 px-4 font-mono text-[var(--fb-text-secondary)] text-[11px]">
                    #{rank}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[var(--fb-text-primary)] text-xs">
                        {n.gid}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(n.gid);
                        }}
                        className="text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] p-0.5"
                        title="Copy GID"
                      >
                        {copiedGid === n.gid ? (
                          <Check className="w-3 h-3 text-[var(--fb-accent-dark)]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      {n.is_seed && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          SEED
                        </span>
                      )}
                      {n.in_cycle && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-300" title="Circular flow / return cycle">
                          CYCLE
                        </span>
                      )}
                      {n.rapid_transit && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800 border border-blue-300" title="Rapid pass-through turnaround (<48h)">
                          RAPID
                        </span>
                      )}
                      {n.structuring_risk && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-900 border border-amber-400" title="Structuring pattern near 5,000 KZT cutoff">
                          STRUCT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {reviewStatus === "escalated" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                        Escalated
                      </span>
                    ) : reviewStatus === "cleared" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        Cleared
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        Unreviewed
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider"
                      style={{
                        backgroundColor: `${color.bg}18`,
                        color: color.bg,
                        border: `1px solid ${color.border}`,
                      }}
                    >
                      {n.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isCritical
                            ? "text-rose-600"
                            : isElevated
                            ? "text-amber-600"
                            : "text-[var(--fb-text-secondary)]"
                        }`}
                      >
                        {n.priority_score.toFixed(3)}
                      </span>
                      <div className="w-16 bg-[var(--fb-border)] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isCritical
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
                  <td className="py-3 px-4 font-mono text-[var(--fb-text-secondary)] text-xs">
                    {n.in_kzt.toLocaleString()} KZT
                  </td>
                  <td className="py-3 px-4 font-mono text-[var(--fb-text-secondary)] text-xs">
                    {n.out_kzt.toLocaleString()} KZT
                  </td>
                  <td className="py-3 px-4 font-mono text-[var(--fb-text-secondary)] text-xs">
                    {n.pass_through !== null
                      ? `${(n.pass_through * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="py-3 px-4 max-w-sm text-[var(--fb-text-secondary)] text-xs truncate">
                    {n.evidence}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {reviewStatus !== "escalated" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(n.gid, "escalated");
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition cursor-pointer"
                          title="Escalate account to law enforcement review"
                        >
                          Escalate
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(n.gid, "cleared");
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition cursor-pointer"
                          title="Mark account cleared after review"
                        >
                          Clear
                        </button>
                      )}
                      {onExplainNode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onExplainNode(n.gid);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--fb-border)] hover:bg-[var(--fb-accent)] hover:text-black text-[var(--fb-text-primary)] transition cursor-pointer"
                          title="Explain AML rule match"
                        >
                          Explain
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskAboutNode(n.gid);
                        }}
                        className="p-1.5 rounded-md hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition"
                        title="Ask AI about this node"
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(n.gid);
                          onSwitchToGraph();
                        }}
                        className="px-2 py-1 rounded-md bg-[var(--fb-border)] hover:bg-[var(--fb-accent)] hover:text-black text-[var(--fb-text-primary)] text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedNodes.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[var(--fb-text-secondary)]">
                  No accounts found matching your filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-4 text-xs text-[var(--fb-text-secondary)] border-t border-[var(--fb-border)] mt-2">
        <div>
          Showing {(page - 1) * pageSize + 1} to{" "}
          {Math.min(page * pageSize, filteredNodes.length)} of{" "}
          <strong>{filteredNodes.length}</strong> accounts
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded-lg border border-[var(--fb-border)] bg-[var(--fb-surface)] disabled:opacity-40 hover:bg-[var(--fb-border)] transition"
          >
            Previous
          </button>
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded-lg border border-[var(--fb-border)] bg-[var(--fb-surface)] disabled:opacity-40 hover:bg-[var(--fb-border)] transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
