"use client";

import React, { useState, useMemo } from "react";
import { Search, ArrowUpDown, ShieldAlert, ChevronRight } from "lucide-react";
import { GraphNode, ROLE_COLORS } from "./GraphView";

interface TopListProps {
  nodes: GraphNode[];
  selectedGid: number | null;
  onSelectNode: (gid: number) => void;
  activeRoleFilter: string | null;
  onSetRoleFilter: (role: string | null) => void;
}

export default function TopList({
  nodes,
  selectedGid,
  onSelectNode,
  activeRoleFilter,
  onSetRoleFilter,
}: TopListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => b.priority_score - a.priority_score);
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    return sortedNodes.filter((n) => {
      const matchesSearch =
        searchTerm === "" ||
        String(n.gid).includes(searchTerm) ||
        n.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = activeRoleFilter === null || n.role === activeRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [sortedNodes, searchTerm, activeRoleFilter]);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border-l border-slate-800 text-slate-100">
      {/* Header & Search */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-sm tracking-wide uppercase text-slate-200">
              Review Priority
            </h2>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {filteredNodes.length} / {nodes.length}
          </span>
        </div>

        {/* GID Search Box */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by GID or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/70 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Role Pills Filter */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            onClick={() => onSetRoleFilter(null)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
              activeRoleFilter === null
                ? "bg-slate-100 text-slate-900 font-semibold"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            All
          </button>
          {Object.entries(ROLE_COLORS).map(([r, c]) => (
            <button
              key={r}
              onClick={() => onSetRoleFilter(activeRoleFilter === r ? null : r)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 ${
                activeRoleFilter === r
                  ? "bg-slate-700 text-white font-semibold ring-1 ring-slate-500"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: c.bg }}
              />
              <span className="capitalize">{r}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Node Rows List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {filteredNodes.slice(0, 100).map((node, index) => {
          const isSelected = node.gid === selectedGid;
          const color = ROLE_COLORS[node.role] || ROLE_COLORS.peripheral;

          return (
            <div
              key={node.gid}
              onClick={() => onSelectNode(node.gid)}
              className={`p-3 cursor-pointer transition flex items-center justify-between text-xs group ${
                isSelected
                  ? "bg-cyan-950/40 border-l-4 border-cyan-400"
                  : "hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="text-[10px] text-slate-500 font-mono w-5 shrink-0">
                  #{index + 1}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 font-mono truncate">
                      {node.gid}
                    </span>
                    <span
                      className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0"
                      style={{
                        backgroundColor: `${color.bg}25`,
                        color: color.border,
                        border: `1px solid ${color.border}40`,
                      }}
                    >
                      {node.role}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {node.evidence}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="font-bold text-amber-400 font-mono text-[11px]">
                    {node.priority_score.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-slate-500">priority</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
              </div>
            </div>
          );
        })}

        {filteredNodes.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No nodes found matching current filters.
          </div>
        )}
      </div>
    </div>
  );
}
