"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Filter, Eye, Layers } from "lucide-react";

export interface GraphNode {
  id: string;
  gid: number;
  role: string;
  role_score: number;
  cluster_id: number;
  priority_score: number;
  evidence: string;
  in_deg: number;
  out_deg: number;
  in_kzt: number;
  out_kzt: number;
  pagerank: number;
  pass_through: number | null;
  depth: number;
  is_seed: boolean;
  truncated_by_depth: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sum_kzt: number;
  n_tx: number;
  depth: number;
}

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedGid: number | null;
  highlightedGids: number[];
  onSelectNode: (gid: number) => void;
  activeRoleFilter: string | null;
}

export const ROLE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  coordinator: { bg: "#9333ea", border: "#c084fc", label: "Coordinator" },
  consolidator: { bg: "#f59e0b", border: "#fde68a", label: "Consolidator" },
  distributor: { bg: "#06b6d4", border: "#67e8f9", label: "Distributor" },
  transit: { bg: "#10b981", border: "#6ee7b7", label: "Transit" },
  terminal: { bg: "#ef4444", border: "#fca5a5", label: "Terminal" },
  peripheral: { bg: "#64748b", border: "#94a3b8", label: "Peripheral" },
};

export default function GraphView({
  nodes,
  edges,
  selectedGid,
  highlightedGids,
  onSelectNode,
  activeRoleFilter,
}: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Adjacency lookup for fast neighborhood calculation
  const adjacency = useMemo(() => {
    const adj = new Map<number, Set<number>>();
    for (const e of edges) {
      const u = Number(e.source);
      const v = Number(e.target);
      if (!adj.has(u)) adj.set(u, new Set());
      if (!adj.has(v)) adj.set(v, new Set());
      adj.get(u)!.add(v);
      adj.get(v)!.add(u);
    }
    return adj;
  }, [edges]);

  // Compute 2D positions for nodes grouped by cluster and component
  const positionedNodes = useMemo(() => {
    if (nodes.length === 0) return [];

    // Group nodes by cluster
    const clusterMap = new Map<number, GraphNode[]>();
    for (const node of nodes) {
      const c = node.cluster_id;
      if (!clusterMap.has(c)) clusterMap.set(c, []);
      clusterMap.get(c)!.push({ ...node });
    }

    const clusters = Array.from(clusterMap.entries());
    const nClusters = clusters.length;
    const gridCols = Math.ceil(Math.sqrt(nClusters * 1.5));
    const clusterSpacing = 550;

    const result: GraphNode[] = [];

    clusters.forEach(([_, cNodes], cIdx) => {
      const col = cIdx % gridCols;
      const row = Math.floor(cIdx / gridCols);
      const cx = (col - gridCols / 2) * clusterSpacing;
      const cy = (row - Math.ceil(nClusters / gridCols) / 2) * clusterSpacing;

      const n = cNodes.length;
      if (n === 1) {
        cNodes[0].x = cx;
        cNodes[0].y = cy;
        result.push(cNodes[0]);
      } else {
        const radius = Math.min(220, 25 + Math.sqrt(n) * 22);
        cNodes.forEach((node, i) => {
          // Put high priority nodes closer to cluster center
          const r = radius * (1 - Math.min(0.6, node.priority_score * 0.8));
          const angle = (i / n) * 2 * Math.PI;
          node.x = cx + r * Math.cos(angle);
          node.y = cy + r * Math.sin(angle);
          result.push(node);
        });
      }
    });

    return result;
  }, [nodes]);

  // Fast map from GID to node
  const nodeMap = useMemo(() => {
    const map = new Map<number, GraphNode>();
    for (const n of positionedNodes) {
      map.set(n.gid, n);
    }
    return map;
  }, [positionedNodes]);

  // Active neighborhood when a node is selected
  const activeNeighborhood = useMemo(() => {
    const set = new Set<number>();
    if (selectedGid !== null) {
      set.add(selectedGid);
      const neighbors = adjacency.get(selectedGid);
      if (neighbors) {
        neighbors.forEach((nbr) => set.add(nbr));
      }
    }
    for (const gid of highlightedGids) {
      set.add(gid);
    }
    return set;
  }, [selectedGid, highlightedGids, adjacency]);

  // Center on selected node if selected externally
  useEffect(() => {
    if (selectedGid !== null) {
      const target = nodeMap.get(selectedGid);
      if (target && target.x !== undefined && target.y !== undefined) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        setTransform({
          x: width / 2 - target.x * 1.4,
          y: height / 2 - target.y * 1.4,
          k: 1.4,
        });
      }
    }
  }, [selectedGid, nodeMap]);

  // Initial center of canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    setTransform({ x: width / 2, y: height / 2, k: 0.45 });
  }, []);

  // Main Canvas Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Apply viewport transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const hasHighlight = activeNeighborhood.size > 0;

    // Draw Edges
    for (const edge of edges) {
      const u = nodeMap.get(Number(edge.source));
      const v = nodeMap.get(Number(edge.target));
      if (!u || !v || u.x === undefined || u.y === undefined || v.x === undefined || v.y === undefined) {
        continue;
      }

      // Check role filter
      if (activeRoleFilter && u.role !== activeRoleFilter && v.role !== activeRoleFilter) {
        continue;
      }

      const isConnectedToSelected =
        selectedGid !== null && (u.gid === selectedGid || v.gid === selectedGid);
      const isNeighborEdge =
        hasHighlight && activeNeighborhood.has(u.gid) && activeNeighborhood.has(v.gid);

      const logVol = Math.max(1, Math.min(5, Math.log10(Math.max(1000, edge.sum_kzt)) - 3));

      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);

      if (isConnectedToSelected) {
        ctx.strokeStyle = u.gid === selectedGid ? "#f59e0b" : "#38bdf8";
        ctx.lineWidth = Math.max(2, logVol * 1.5) / transform.k;
        ctx.globalAlpha = 0.95;
      } else if (isNeighborEdge) {
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = Math.max(1.2, logVol) / transform.k;
        ctx.globalAlpha = 0.65;
      } else if (hasHighlight) {
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 0.6 / transform.k;
        ctx.globalAlpha = 0.08;
      } else {
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = Math.max(0.6, logVol * 0.7) / transform.k;
        ctx.globalAlpha = 0.22;
      }

      ctx.stroke();

      // Draw directional arrow on important edges
      if (isConnectedToSelected || (!hasHighlight && transform.k > 0.8)) {
        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 25) {
          const arrowDist = dist * 0.6;
          const ax = u.x + (dx / dist) * arrowDist;
          const ay = u.y + (dy / dist) * arrowDist;
          const angle = Math.atan2(dy, dx);
          const arrowSize = 6 / transform.k;

          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(
            ax - arrowSize * Math.cos(angle - Math.PI / 6),
            ay - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            ax - arrowSize * Math.cos(angle + Math.PI / 6),
            ay - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }
      }
    }

    // Draw Nodes
    for (const node of positionedNodes) {
      if (node.x === undefined || node.y === undefined) continue;

      const isSelected = node.gid === selectedGid;
      const isNeighbor = activeNeighborhood.has(node.gid);
      const isFiltered = activeRoleFilter !== null && node.role !== activeRoleFilter;

      let radius = 3 + node.priority_score * 8;
      if (node.is_seed) radius += 2;
      if (isSelected) radius += 4;

      const color = ROLE_COLORS[node.role] || ROLE_COLORS.peripheral;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius / transform.k, 0, 2 * Math.PI);

      if (isFiltered) {
        ctx.fillStyle = "#1e293b";
        ctx.globalAlpha = 0.08;
        ctx.fill();
        continue;
      }

      if (isSelected) {
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 1.0;
        ctx.fill();

        ctx.lineWidth = 4 / transform.k;
        ctx.strokeStyle = color.bg;
        ctx.stroke();

        // Pulsing outer halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, (radius + 6) / transform.k, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2 / transform.k;
        ctx.stroke();
      } else if (isNeighbor) {
        ctx.fillStyle = color.bg;
        ctx.globalAlpha = 1.0;
        ctx.fill();

        ctx.lineWidth = 2 / transform.k;
        ctx.strokeStyle = color.border;
        ctx.stroke();
      } else if (hasHighlight) {
        ctx.fillStyle = color.bg;
        ctx.globalAlpha = 0.12;
        ctx.fill();
      } else {
        ctx.fillStyle = color.bg;
        ctx.globalAlpha = 0.85;
        ctx.fill();

        if (node.priority_score > 0.4 || node.is_seed) {
          ctx.lineWidth = 1.5 / transform.k;
          ctx.strokeStyle = node.is_seed ? "#38bdf8" : color.border;
          ctx.stroke();
        }
      }

      // Draw label for high priority or selected nodes when zoomed in
      if ((isSelected || isNeighbor || (transform.k > 1.2 && node.priority_score > 0.45))) {
        ctx.globalAlpha = isSelected ? 1.0 : 0.85;
        ctx.font = `${Math.max(10, 11 / transform.k)}px sans-serif`;
        ctx.fillStyle = isSelected ? "#f8fafc" : "#cbd5e1";
        const label = String(node.gid).slice(-6);
        ctx.fillText(label, node.x + (radius + 4) / transform.k, node.y + 4 / transform.k);
      }
    }

    ctx.restore();
  }, [
    transform,
    edges,
    positionedNodes,
    nodeMap,
    selectedGid,
    activeNeighborhood,
    activeRoleFilter,
  ]);

  useEffect(() => {
    let animationId: number;
    const tick = () => {
      render();
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [render]);

  // Mouse Handlers for Pan, Zoom & Click
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newK = Math.max(0.15, Math.min(5.0, transform.k * zoomFactor));

    setTransform((prev) => ({
      x: mouseX - (mouseX - prev.x) * (newK / prev.k),
      y: mouseY - (mouseY - prev.y) * (newK / prev.k),
      k: newK,
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    } else {
      // Find hovered node
      const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
      const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

      let found: GraphNode | null = null;
      for (let i = positionedNodes.length - 1; i >= 0; i--) {
        const n = positionedNodes[i];
        if (n.x === undefined || n.y === undefined) continue;
        const dx = n.x - mouseX;
        const dy = n.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = (6 + n.priority_score * 8) / transform.k;
        if (dist <= Math.max(radius, 12 / transform.k)) {
          found = n;
          break;
        }
      }

      setHoveredNode(found);
      if (found) {
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        setTooltipPos(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

    for (let i = positionedNodes.length - 1; i >= 0; i--) {
      const n = positionedNodes[i];
      if (n.x === undefined || n.y === undefined) continue;
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = (6 + n.priority_score * 8) / transform.k;
      if (dist <= Math.max(radius, 14 / transform.k)) {
        onSelectNode(n.gid);
        return;
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-[#080d19] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              k: Math.min(5.0, prev.k * 1.25),
            }))
          }
          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              k: Math.max(0.15, prev.k * 0.8),
            }))
          }
          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas) {
              setTransform({
                x: canvas.clientWidth / 2,
                y: canvas.clientHeight / 2,
                k: 0.45,
              });
            }
          }}
          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Legend & Stats Overlay */}
      <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-800 text-xs shadow-xl z-10 max-w-sm">
        <div className="flex items-center justify-between mb-2 text-slate-400 font-medium">
          <span>ROLE LEGEND ({nodes.length} nodes)</span>
          <span className="text-[10px] text-slate-500">Scroll to zoom • Click node</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {Object.entries(ROLE_COLORS).map(([role, c]) => (
            <div key={role} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
              />
              <span className="text-slate-300 capitalize">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredNode && tooltipPos && (
        <div
          className="absolute pointer-events-none p-3 rounded-lg bg-slate-950/95 border border-slate-700/80 text-xs shadow-2xl z-30 transform -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: ROLE_COLORS[hoveredNode.role]?.bg || "#64748b",
              }}
            />
            <span className="font-semibold text-slate-100">
              GID: {hoveredNode.gid}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
              {hoveredNode.role}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5">
            <div>Priority Score: <span className="text-amber-400 font-semibold">{hoveredNode.priority_score.toFixed(3)}</span></div>
            <div>Inflow: <span className="text-emerald-400 font-medium">{hoveredNode.in_kzt.toLocaleString()} KZT</span> ({hoveredNode.in_deg} payers)</div>
            <div>Outflow: <span className="text-cyan-400 font-medium">{hoveredNode.out_kzt.toLocaleString()} KZT</span> ({hoveredNode.out_deg} recipients)</div>
            <div>Cluster: #{hoveredNode.cluster_id} {hoveredNode.is_seed ? "• (Seed Client)" : ""}</div>
          </div>
        </div>
      )}
    </div>
  );
}
