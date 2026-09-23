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
  ExternalLink,
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

  return (
    <div className="flex flex-col h-full bg-[#080d19] text-slate-100 p-6 overflow-hidden">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            AML Investigation Queue
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked risk candidates across all 2,248 accounts based on network topology and money flow volume.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search GID, role, or evidence..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
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
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical Risk (Score ≥ 0.50)</option>
            <option value="elevated">Elevated Risk (Score 0.25 - 0.50)</option>
            <option value="moderate">Moderate / Low (Score &lt; 0.25)</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto mt-4 rounded-xl border border-slate-800 bg-slate-950/60 shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800 backdrop-blur-md">
            <tr>
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Account GID</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Priority Score</th>
              <th className="py-3 px-4">Money In</th>
              <th className="py-3 px-4">Money Out</th>
              <th className="py-3 px-4">Pass-Through</th>
              <th className="py-3 px-4">AML Hypothesis / Evidence</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {paginatedNodes.map((n, i) => {
              const rank = (page - 1) * pageSize + i + 1;
              const color = ROLE_COLORS[n.role] || ROLE_COLORS.peripheral;
              const isCritical = n.priority_score >= 0.5;
              const isElevated = n.priority_score >= 0.25 && n.priority_score < 0.5;

              return (
                <tr
                  key={n.gid}
                  className="hover:bg-slate-900/60 transition group cursor-pointer"
                  onClick={() => onSelectNode(n.gid)}
                >
                  {/* Rank */}
                  <td className="py-3 px-4 font-mono text-slate-400 font-semibold">
                    #{rank}
                  </td>

                  {/* GID */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 font-mono text-slate-100 font-medium">
                      <span>{n.gid}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(n.gid);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-200 transition rounded"
                        title="Copy GID"
                      >
                        {copiedGid === n.gid ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                        )}
                      </button>
                    </div>
                    {n.is_seed && (
                      <span className="text-[10px] text-cyan-400 font-semibold">
                        Seed Client
                      </span>
                    )}
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] uppercase font-bold inline-block"
                      style={{
                        backgroundColor: `${color.bg}25`,
                        color: color.border,
                        border: `1px solid ${color.border}40`,
                      }}
                    >
                      {n.role}
                    </span>
                  </td>

                  {/* Priority Score */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-bold text-xs ${
                          isCritical
                            ? "text-rose-400"
                            : isElevated
                            ? "text-amber-400"
                            : "text-slate-300"
                        }`}
                      >
                        {n.priority_score.toFixed(3)}
                      </span>
                      <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isCritical
                              ? "bg-rose-500"
                              : isElevated
                              ? "bg-amber-400"
                              : "bg-slate-400"
                          }`}
                          style={{
                            width: `${Math.min(100, n.priority_score * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Money In */}
                  <td className="py-3 px-4 font-mono">
                    <div className="text-emerald-400 font-medium">
                      +{n.in_kzt.toLocaleString()} KZT
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {n.in_deg} payers
                    </div>
                  </td>

                  {/* Money Out */}
                  <td className="py-3 px-4 font-mono">
                    <div className="text-cyan-400 font-medium">
                      -{n.out_kzt.toLocaleString()} KZT
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {n.out_deg} recipients
                    </div>
                  </td>

                  {/* Pass-Through */}
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {n.pass_through !== null ? (
                      <span
                        className={
                          n.pass_through >= 0.8 && n.pass_through <= 1.2
                            ? "text-emerald-400 font-semibold"
                            : "text-slate-400"
                        }
                      >
                        {(n.pass_through * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Evidence */}
                  <td className="py-3 px-4 max-w-md">
                    <div className="text-slate-300 line-clamp-2 text-xs">
                      {n.evidence}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectNode(n.gid);
                          onSwitchToGraph();
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition flex items-center gap-1"
                        title="View on network graph"
                      >
                        <Eye className="w-3 h-3 text-cyan-400" />
                        Graph
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskAboutNode(n.gid);
                        }}
                        className="p-1 rounded bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-800 transition"
                        title="Analyze with AI Assistant"
                      >
                        <Bot className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredNodes.length === 0 && (
          <div className="p-12 text-center text-slate-500 text-xs">
            No accounts match your current filter criteria.
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
        <div>
          Showing {paginatedNodes.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(page * pageSize, filteredNodes.length)} of {filteredNodes.length} accounts
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-md text-slate-300 hover:text-white disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 py-1 font-mono text-slate-300">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-md text-slate-300 hover:text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
