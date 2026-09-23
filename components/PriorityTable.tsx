"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { GraphNode, ROLE_COLORS } from "./GraphView";

interface PriorityTableProps {
  nodes: GraphNode[];
  onSelectNode: (gid: number) => void;
  onAskAboutNode: (gid: number) => void;
  onSwitchToGraph: () => void;
}

export default function PriorityTable({
  nodes,
  onSelectNode,
  onAskAboutNode,
  onSwitchToGraph,
}: PriorityTableProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [copiedGid, setCopiedGid] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

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

        return matchesSearch && matchesRole && matchesRisk;
      })
      .sort((a, b) => b.priority_score - a.priority_score);
  }, [nodes, search, roleFilter, riskFilter]);

  const totalPages = Math.ceil(filteredNodes.length / pageSize) || 1;
  const paginatedNodes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredNodes.slice(start, start + pageSize);
  }, [filteredNodes, page]);

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
    <div className="flex flex-col h-full bg-[var(--fb-bg)] text-[var(--fb-text-primary)] p-6 overflow-hidden">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--fb-border)]">
        <div>
          <h2 className="text-base font-bold text-[var(--fb-text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Investigation Queue (Priority Nodes)
          </h2>
          <p className="text-xs text-[var(--fb-text-secondary)] mt-0.5">
            Ranked risk candidates across all {nodes.length.toLocaleString()} accounts. Select any account to inspect details or open its network connections.
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

          {/* Export Referral Dossier Button */}
          <button
            onClick={handleExportReferralList}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--fb-border)] bg-[var(--fb-surface)] hover:bg-[var(--fb-border)] text-[var(--fb-text-primary)] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Download Law Enforcement Referral List (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Referral List</span>
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
                        className="px-2 py-1 rounded-md bg-[var(--fb-border)] hover:bg-[var(--fb-accent)] hover:text-black text-[var(--fb-text-primary)] text-[11px] font-semibold transition flex items-center gap-1"
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
                <td colSpan={9} className="py-12 text-center text-[var(--fb-text-secondary)]">
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
