"use client";

import React, { useMemo } from "react";
import { X, ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { GraphNode, GraphEdge, ROLE_COLORS } from "./GraphView";

interface NodeCardProps {
  node: GraphNode | null;
  edges: GraphEdge[];
  onClose: () => void;
  onSelectNode: (gid: number) => void;
}

export default function NodeCard({
  node,
  edges,
  onClose,
  onSelectNode,
}: NodeCardProps) {
  if (!node) return null;

  const color = ROLE_COLORS[node.role] || ROLE_COLORS.peripheral;

  const gidStr = String(node.gid);
  const incoming = useMemo(() => edges.filter((e) => e.target === gidStr), [edges, gidStr]);
  const outgoing = useMemo(() => edges.filter((e) => e.source === gidStr), [edges, gidStr]);

  return (
    <div className="absolute top-4 left-4 w-96 max-h-[calc(100%-2rem)] flex flex-col rounded-2xl glass-panel shadow-2xl z-20 overflow-hidden text-slate-100">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider"
              style={{
                backgroundColor: `${color.bg}30`,
                color: color.border,
                border: `1px solid ${color.border}60`,
              }}
            >
              {node.role}
            </span>
            {node.is_seed && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                Seed Client
              </span>
            )}
            {node.truncated_by_depth && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Hop-4 Truncated
              </span>
            )}
          </div>
          <div className="text-lg font-bold font-mono text-slate-100">
            GID: {node.gid}
          </div>
          <div className="text-xs text-slate-400">
            Cluster #{node.cluster_id} • Depth {node.depth}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 overflow-y-auto space-y-4 text-xs">
        {/* Scores Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Priority Score</div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
              {node.priority_score.toFixed(3)}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full"
                style={{ width: `${Math.min(100, node.priority_score * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Role Confidence</div>
            <div className="text-xl font-bold font-mono text-purple-400 mt-0.5">
              {node.role_score.toFixed(3)}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-purple-400 h-full rounded-full"
                style={{ width: `${Math.min(100, node.role_score * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Evidence Box */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            AML Evidence / Flow Analysis
          </div>
          <p className="text-slate-200 text-xs leading-relaxed">
            {node.evidence}
          </p>
        </div>

        {/* Financial Flow Statistics */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Flow Metrics
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Total Received:
            </span>
            <span className="font-semibold text-emerald-400 font-mono">
              {node.in_kzt.toLocaleString()} KZT
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" /> Total Forwarded:
            </span>
            <span className="font-semibold text-cyan-400 font-mono">
              {node.out_kzt.toLocaleString()} KZT
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
            <span className="text-slate-400">Pass-Through Ratio:</span>
            <span className="font-mono font-medium text-slate-200">
              {node.pass_through !== null ? `${(node.pass_through * 100).toFixed(1)}%` : "N/A"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Betweenness Centrality:</span>
            <span className="font-mono font-medium text-slate-200">
              {node.pagerank.toFixed(5)} (PR) / {node.role_score > 0 ? "Active" : "Low"}
            </span>
          </div>
        </div>

        {/* Counterparty Connections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Direct Counterparties</span>
            <span>{incoming.length} In • {outgoing.length} Out</span>
          </div>

          {/* Incoming */}
          {incoming.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] text-emerald-400 font-medium">
                Incoming Payers ({incoming.length}):
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {incoming.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => onSelectNode(Number(e.source))}
                    className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-600 flex items-center justify-between text-[11px] cursor-pointer transition"
                  >
                    <span className="font-mono text-slate-300 hover:text-cyan-400">
                      GID {e.source}
                    </span>
                    <span className="font-mono text-emerald-400">
                      +{e.sum_kzt.toLocaleString()} KZT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing */}
          {outgoing.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="text-[11px] text-cyan-400 font-medium">
                Outgoing Recipients ({outgoing.length}):
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {outgoing.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => onSelectNode(Number(e.target))}
                    className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-600 flex items-center justify-between text-[11px] cursor-pointer transition"
                  >
                    <span className="font-mono text-slate-300 hover:text-cyan-400">
                      GID {e.target}
                    </span>
                    <span className="font-mono text-cyan-400">
                      -{e.sum_kzt.toLocaleString()} KZT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
