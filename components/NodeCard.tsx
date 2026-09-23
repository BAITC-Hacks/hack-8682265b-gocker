"use client";

import React, { useState } from "react";
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Bot,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
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
    <div className="w-[380px] max-w-full bg-[var(--fb-surface)] border-l border-[var(--fb-border)] shadow-xl z-20 flex flex-col text-[var(--fb-text-primary)] shrink-0 h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--fb-border)] bg-[var(--fb-bg)] shrink-0 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider"
                style={{
                  backgroundColor: `${color.bg}20`,
                  color: color.bg,
                  border: `1px solid ${color.border}`,
                }}
              >
                {node.role}
              </span>

              {isCritical ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  Critical Priority
                </span>
              ) : isElevated ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Elevated Priority
                </span>
              ) : null}

              {node.is_seed && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Seed Account
                </span>
              )}

              {node.in_cycle && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300" title="Account participates in circular money flow or return path">
                  Circular Flow
                </span>
              )}

              {node.rapid_transit && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300" title={`Forwards funds within ${node.turnaround_hours ?? 48} hours`}>
                  Rapid Transit {node.turnaround_hours !== null && node.turnaround_hours !== undefined ? `(${node.turnaround_hours}h)` : "(<48h)"}
                </span>
              )}

              {node.structuring_risk && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-400" title="Frequent transactions clustered near 5,000 KZT cutoff">
                  Structuring Pattern
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-base font-bold font-mono text-[var(--fb-text-primary)]">
                GID: {node.gid}
              </span>
              <button
                onClick={copyGid}
                className="p-1 text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition"
                title="Copy GID"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="text-[11px] text-[var(--fb-text-secondary)]">
              Cluster #{node.cluster_id} • Hop Depth {node.depth}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contextual Ask AI Button */}
        <button
          onClick={() => onAskAboutNode(node.gid)}
          className="w-full py-2 px-3 rounded-xl bg-[var(--fb-accent)] hover:bg-[var(--fb-accent-dark)] text-black font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Bot className="w-4 h-4" />
          <span>Ask AI about this node</span>
        </button>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              activeTab === "overview"
                ? "bg-[var(--fb-border)] text-[var(--fb-text-primary)] font-semibold"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("flows")}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              activeTab === "flows"
                ? "bg-[var(--fb-border)] text-[var(--fb-text-primary)] font-semibold"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            Flows ({incoming.length + outgoing.length})
          </button>
          <button
            onClick={() => setActiveTab("counterparties")}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              activeTab === "counterparties"
                ? "bg-[var(--fb-border)] text-[var(--fb-text-primary)] font-semibold"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
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
            {/* Priority & Confidence Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">
                  Priority Score
                </span>
                <div className="text-xl font-bold font-mono text-[var(--role-consolidator)] mt-1">
                  {node.priority_score.toFixed(3)}
                </div>
                <div className="w-full bg-[var(--fb-border)] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[var(--role-consolidator)] h-full rounded-full"
                    style={{ width: `${Math.min(100, node.priority_score * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)]">
                <span className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold">
                  Role Confidence
                </span>
                <div className="text-xl font-bold font-mono text-[var(--role-coordinator)] mt-1">
                  {node.role_score.toFixed(3)}
                </div>
                <div className="w-full bg-[var(--fb-border)] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[var(--role-coordinator)] h-full rounded-full"
                    style={{ width: `${Math.min(100, node.role_score * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* AML Evidence */}
            <div className="p-3.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--fb-text-primary)] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  Role Evidence
                </span>
              </div>
              <p className="text-[var(--fb-text-secondary)] text-xs leading-relaxed">
                {node.evidence}
              </p>
            </div>

            {/* Metrics Breakdown */}
            <div className="p-3.5 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-2">
              <span className="text-[10px] text-[var(--fb-text-secondary)] font-bold uppercase tracking-wider">
                Graph Centrality & Degree
              </span>

              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div>
                  <span className="text-[var(--fb-text-secondary)]">In-degree:</span>{" "}
                  <strong className="text-[var(--fb-text-primary)] font-mono">{node.in_deg}</strong>
                </div>
                <div>
                  <span className="text-[var(--fb-text-secondary)]">Out-degree:</span>{" "}
                  <strong className="text-[var(--fb-text-primary)] font-mono">{node.out_deg}</strong>
                </div>
                <div>
                  <span className="text-[var(--fb-text-secondary)]">PageRank:</span>{" "}
                  <strong className="text-[var(--fb-text-primary)] font-mono">
                    {node.pagerank.toExponential(2)}
                  </strong>
                </div>
                <div>
                  <span className="text-[var(--fb-text-secondary)]">Pass-Through:</span>{" "}
                  <strong className="text-[var(--fb-text-primary)] font-mono">
                    {node.pass_through !== null ? `${(node.pass_through * 100).toFixed(1)}%` : "N/A"}
                  </strong>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "flows" && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-1">
              <div className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> Total Inflow
              </div>
              <div className="text-sm font-bold font-mono text-[var(--fb-text-primary)]">
                {node.in_kzt.toLocaleString()} KZT
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--fb-bg)] border border-[var(--fb-border)] space-y-1">
              <div className="text-[10px] text-[var(--fb-text-secondary)] uppercase font-semibold flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-cyan-600" /> Total Outflow
              </div>
              <div className="text-sm font-bold font-mono text-[var(--fb-text-primary)]">
                {node.out_kzt.toLocaleString()} KZT
              </div>
            </div>
          </div>
        )}

        {activeTab === "counterparties" && (
          <div className="space-y-4">
            {/* Incoming */}
            <div>
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Incoming Payers ({incoming.length})</span>
                <span className="text-[10px] text-[var(--fb-text-secondary)] font-normal">Click to focus</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {incoming.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => onSelectNode(Number(e.source))}
                    className="p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)] hover:border-emerald-500 flex items-center justify-between text-xs cursor-pointer transition"
                  >
                    <div className="font-mono text-[var(--fb-text-primary)] font-medium">
                      GID {e.source}
                    </div>
                    <div className="font-mono text-emerald-700 font-medium">
                      +{e.sum_kzt.toLocaleString()} KZT
                    </div>
                  </div>
                ))}
                {incoming.length === 0 && (
                  <div className="text-[var(--fb-text-secondary)] text-xs py-2 text-center">
                    No incoming transfers
                  </div>
                )}
              </div>
            </div>

            {/* Outgoing */}
            <div className="pt-2 border-t border-[var(--fb-border)]">
              <div className="text-[11px] font-bold text-cyan-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Outgoing Recipients ({outgoing.length})</span>
                <span className="text-[10px] text-[var(--fb-text-secondary)] font-normal">Click to focus</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {outgoing.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => onSelectNode(Number(e.target))}
                    className="p-2 rounded-lg bg-[var(--fb-bg)] border border-[var(--fb-border)] hover:border-cyan-500 flex items-center justify-between text-xs cursor-pointer transition"
                  >
                    <div className="font-mono text-[var(--fb-text-primary)] font-medium">
                      GID {e.target}
                    </div>
                    <div className="font-mono text-cyan-700 font-medium">
                      -{e.sum_kzt.toLocaleString()} KZT
                    </div>
                  </div>
                ))}
                {outgoing.length === 0 && (
                  <div className="text-[var(--fb-text-secondary)] text-xs py-2 text-center">
                    No outgoing transfers
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
