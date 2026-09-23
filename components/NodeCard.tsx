"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Check,
  Copy,
  ShieldAlert,
  Bot,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { GraphNode, GraphEdge, ROLE_COLORS } from "./GraphView";

interface NodeCardProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  onClose: () => void;
  onSelectNode: (gid: number) => void;
  onAskAboutNode: (gid: number) => void;
}

export default function NodeCard({
  node,
  edges,
  onClose,
  onSelectNode,
  onAskAboutNode,
}: NodeCardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "flows" | "counterparties">("overview");
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const color = ROLE_COLORS[node.role] || ROLE_COLORS.peripheral;
  const isCritical = node.priority_score >= 0.5;
  const isElevated = node.priority_score >= 0.25 && node.priority_score < 0.5;

  const gidStr = String(node.gid);
  const incoming = edges.filter((e) => e.target === gidStr);
  const outgoing = edges.filter((e) => e.source === gidStr);

  const copyGid = () => {
    navigator.clipboard.writeText(String(node.gid));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[420px] max-w-full bg-[#0a0f1d]/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-30 flex flex-col text-slate-100 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/70 shrink-0">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider"
                style={{
                  backgroundColor: `${color.bg}25`,
                  color: color.border,
                  border: `1px solid ${color.border}50`,
                }}
              >
                {node.role}
              </span>

              {isCritical ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/90 text-rose-300 border border-rose-800 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-400" /> Critical Priority
                </span>
              ) : isElevated ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800">
                  Elevated Priority
                </span>
              ) : null}

              {node.is_seed && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-800">
                  Seed Account
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-base font-bold font-mono text-white">
                GID: {node.gid}
              </span>
              <button
                onClick={copyGid}
                className="p-1 text-slate-400 hover:text-slate-200 transition"
                title="Copy GID"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="text-[11px] text-slate-400">
              Cluster #{node.cluster_id} • Hop Depth {node.depth}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 pt-3">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              activeTab === "overview"
                ? "bg-slate-800 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("flows")}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              activeTab === "flows"
                ? "bg-slate-800 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Flows ({incoming.length + outgoing.length})
          </button>
          <button
            onClick={() => setActiveTab("counterparties")}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              activeTab === "counterparties"
                ? "bg-slate-800 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Counterparties
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {activeTab === "overview" && (
          <>
            {/* Quick Priority & Confidence Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Priority Score
                </span>
                <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                  {node.priority_score.toFixed(3)}
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full"
                    style={{ width: `${Math.min(100, node.priority_score * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Role Confidence
                </span>
                <div className="text-xl font-bold font-mono text-purple-400 mt-1">
                  {node.role_score.toFixed(3)}
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-purple-400 h-full rounded-full"
                    style={{ width: `${Math.min(100, node.role_score * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* AML Evidence Box */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Why is this flagged?
                </span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed">
                {node.evidence}
              </p>

              {node.truncated_by_depth && (
                <div className="p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] flex items-start gap-1.5 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <strong>Traversal Cutoff Notice:</strong> This node lies at hop 4 with 0 recorded outgoing transfers. It may have further outflows that were outside the extraction scope.
                  </div>
                </div>
              )}
            </div>

            {/* Quick Turnover summary */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Turnover Summary
              </span>

              <div className="flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                  Received Inflow:
                </span>
                <span className="font-mono font-semibold text-emerald-400">
                  {node.in_kzt.toLocaleString()} KZT
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                  Forwarded Outflow:
                </span>
                <span className="font-mono font-semibold text-cyan-400">
                  {node.out_kzt.toLocaleString()} KZT
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-400">Pass-Through Ratio:</span>
                <span className="font-mono font-medium text-slate-200">
                  {node.pass_through !== null ? `${(node.pass_through * 100).toFixed(1)}%` : "N/A"}
                </span>
              </div>
            </div>

            {/* AI Assistant Button */}
            <button
              onClick={() => onAskAboutNode(node.gid)}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-700/80 to-indigo-700/80 hover:from-purple-600 hover:to-indigo-600 border border-purple-500/30 text-white font-medium text-xs flex items-center justify-center gap-2 transition shadow-lg"
            >
              <Bot className="w-4 h-4 text-purple-200" />
              Ask AI Assistant About This Account
            </button>
          </>
        )}

        {activeTab === "flows" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Network Centrality & Connectivity
              </span>
              <div className="flex justify-between">
                <span className="text-slate-400">Inbound Connections:</span>
                <span className="font-mono font-semibold text-slate-200">{node.in_deg} payers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Outbound Connections:</span>
                <span className="font-mono font-semibold text-slate-200">{node.out_deg} recipients</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PageRank:</span>
                <span className="font-mono text-slate-200">{node.pagerank.toFixed(5)}</span>
              </div>
            </div>

            {/* Pass-through visual bar */}
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Fund Retention vs Pass-Through</span>
                <span className="font-mono text-cyan-400 font-semibold">
                  {node.pass_through !== null ? `${(node.pass_through * 100).toFixed(0)}% forwarded` : "0%"}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${Math.min(100, Math.max(0, 100 - (node.pass_through || 0) * 100))}%` }}
                  title="Retained Funds"
                />
                <div
                  className="bg-cyan-500 h-full"
                  style={{ width: `${Math.min(100, (node.pass_through || 0) * 100)}%` }}
                  title="Forwarded Funds"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Green: Retained</span>
                <span>Cyan: Forwarded</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "counterparties" && (
          <div className="space-y-4">
            {/* Incoming */}
            <div>
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Incoming Payers ({incoming.length})</span>
                <span className="text-[10px] text-slate-500 font-normal">Click to focus</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {incoming.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => onSelectNode(Number(e.source))}
                    className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-emerald-500/60 flex items-center justify-between text-xs cursor-pointer transition group"
                  >
                    <div className="font-mono text-slate-200 group-hover:text-emerald-300 font-medium">
                      GID {e.source}
                    </div>
                    <div className="font-mono text-emerald-400 font-medium">
                      +{e.sum_kzt.toLocaleString()} KZT
                    </div>
                  </div>
                ))}
                {incoming.length === 0 && (
                  <div className="text-slate-500 text-xs py-2 text-center">No incoming transfers</div>
                )}
              </div>
            </div>

            {/* Outgoing */}
            <div className="pt-2 border-t border-slate-800">
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Outgoing Recipients ({outgoing.length})</span>
                <span className="text-[10px] text-slate-500 font-normal">Click to focus</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {outgoing.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => onSelectNode(Number(e.target))}
                    className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/60 flex items-center justify-between text-xs cursor-pointer transition group"
                  >
                    <div className="font-mono text-slate-200 group-hover:text-cyan-300 font-medium">
                      GID {e.target}
                    </div>
                    <div className="font-mono text-cyan-400 font-medium">
                      -{e.sum_kzt.toLocaleString()} KZT
                    </div>
                  </div>
                ))}
                {outgoing.length === 0 && (
                  <div className="text-slate-500 text-xs py-2 text-center">No outgoing transfers</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
