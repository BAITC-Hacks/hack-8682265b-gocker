"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Layers,
  Filter,
  Eye,
  AlertTriangle,
  X,
} from "lucide-react";

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
  isBridge?: boolean;
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
  onSetRoleFilter: (role: string | null) => void;
  activeClusterFilter: number | null;
  onClearClusterFilter: () => void;
  onOpenClusterExplorer: () => void;
}

export const ROLE_COLORS: Record<string, { bg: string; border: string; label: string; desc: string }> = {
  coordinator: {
    bg: "#7C5CFC",
    border: "#9D84FD",
    label: "Coordinator",
    desc: "Key bridge account routing funds across multiple clusters",
  },
  consolidator: {
    bg: "#E08A2E",
    border: "#F3A95B",
    label: "Consolidator",
    desc: "Collects from 8+ sources with low forward distribution",
  },
  distributor: {
    bg: "#2E8FE0",
    border: "#5DB0F7",
    label: "Distributor",
    desc: "Disburses funds outward to 15+ recipients",
  },
  transit: {
    bg: "#2CA678",
    border: "#4FD39E",
    label: "Transit",
    desc: "Pass-through intermediary (80–120% pass-through)",
  },
  terminal: {
    bg: "#D14D4D",
    border: "#E57777",
    label: "Terminal",
    desc: "Final endpoint account with 0 outgoing transfers",
  },
  peripheral: {
    bg: "#B8BCC2",
    border: "#D1D5DB",
    label: "Peripheral",
    desc: "Low-volume background flow nodes",
  },
};

export default function GraphView({
  nodes,
  edges,
  selectedGid,
  highlightedGids,
  onSelectNode,
  activeRoleFilter,
  onSetRoleFilter,
  activeClusterFilter,
  onClearClusterFilter,
  onOpenClusterExplorer,
}: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showFullWarning, setShowFullWarning] = useState(false);
  const [viewMode, setViewMode] = useState<"cluster_subgraph" | "key_actors" | "full">(
    activeClusterFilter !== null ? "cluster_subgraph" : "key_actors"
  );

  useEffect(() => {
    if (activeClusterFilter !== null) {
      setViewMode("cluster_subgraph");
    }
  }, [activeClusterFilter]);

  // Global node lookup map
  const allNodesMap = useMemo(() => {
    const map = new Map<number, GraphNode>();
    for (const n of nodes) {
      map.set(n.gid, n);
    }
    return map;
  }, [nodes]);

  // Adjacency graph for 1-hop lookups and bridge node discovery
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

  // Determine which nodes to display
  const displayNodes = useMemo(() => {
    if (nodes.length === 0) return [];

    if (activeClusterFilter !== null) {
      // Cluster Subgraph: cluster members + bridge neighbor nodes
      const clusterGids = new Set<number>();
      for (const n of nodes) {
        if (n.cluster_id === activeClusterFilter) {
          clusterGids.add(n.gid);
        }
      }

      const bridgeGids = new Set<number>();
      for (const gid of clusterGids) {
        const neighbors = adjacency.get(gid);
        if (neighbors) {
          for (const nbr of neighbors) {
            if (!clusterGids.has(nbr)) {
              bridgeGids.add(nbr);
            }
          }
        }
      }

      const result: GraphNode[] = [];
      for (const gid of clusterGids) {
        const n = allNodesMap.get(gid);
        if (n) result.push({ ...n, isBridge: false });
      }
      for (const gid of bridgeGids) {
        const n = allNodesMap.get(gid);
        if (n) result.push({ ...n, isBridge: true });
      }
      return result;
    }

    if (viewMode === "full") {
      return nodes;
    }

    // Key actors view: coordinators, consolidators, distributors, seeds, and high priority accounts
    return nodes.filter(
      (n) =>
        n.role === "coordinator" ||
        n.role === "consolidator" ||
        n.role === "distributor" ||
        n.is_seed ||
        n.priority_score >= 0.25
    );
  }, [nodes, activeClusterFilter, viewMode, adjacency, allNodesMap]);

  const displayGidSet = useMemo(() => {
    return new Set(displayNodes.map((n) => n.gid));
  }, [displayNodes]);

  // Position nodes
  const positionedNodes = useMemo(() => {
    if (displayNodes.length === 0) return [];

    if (activeClusterFilter !== null) {
      // Focused layout: core cluster members in inner circle, bridge neighbors in outer orbit
      const core = displayNodes.filter((n) => !n.isBridge);
      const bridge = displayNodes.filter((n) => n.isBridge);

      const result: GraphNode[] = [];
      const coreN = core.length;
      const coreRadius = Math.max(80, Math.min(260, 40 + Math.sqrt(coreN) * 32));

      core.forEach((node, i) => {
        // High priority nodes sit closer to center
        const r = coreRadius * (0.3 + (1 - node.priority_score) * 0.7);
        const angle = (i / Math.max(1, coreN)) * 2 * Math.PI;
        result.push({
          ...node,
          x: r * Math.cos(angle),
          y: r * Math.sin(angle),
        });
      });

      const bridgeN = bridge.length;
      const bridgeRadius = coreRadius + 140;
      bridge.forEach((node, i) => {
        const angle = (i / Math.max(1, bridgeN)) * 2 * Math.PI;
        result.push({
          ...node,
          x: bridgeRadius * Math.cos(angle),
          y: bridgeRadius * Math.sin(angle),
        });
      });

      return result;
    }

    // Grid-clustered layout for multi-cluster views
    const clusterMap = new Map<number, GraphNode[]>();
    for (const node of displayNodes) {
      const c = node.cluster_id;
      if (!clusterMap.has(c)) clusterMap.set(c, []);
      clusterMap.get(c)!.push({ ...node });
    }

    const clusters = Array.from(clusterMap.entries());
    const nClusters = clusters.length;
    const gridCols = Math.ceil(Math.sqrt(nClusters * 1.4)) || 1;
    const clusterSpacing = viewMode === "key_actors" ? 440 : 560;

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
        const radius = Math.min(220, 32 + Math.sqrt(n) * 26);
        cNodes.forEach((node, i) => {
          const r = radius * (1 - Math.min(0.65, node.priority_score * 0.7));
          const angle = (i / n) * 2 * Math.PI;
          node.x = cx + r * Math.cos(angle);
          node.y = cy + r * Math.sin(angle);
          result.push(node);
        });
      }
    });

    return result;
  }, [displayNodes, activeClusterFilter, viewMode]);

  const nodeMap = useMemo(() => {
    const map = new Map<number, GraphNode>();
    for (const n of positionedNodes) {
      map.set(n.gid, n);
    }
    return map;
  }, [positionedNodes]);

  // Edges connecting visible nodes
  const visibleEdges = useMemo(() => {
    const res: GraphEdge[] = [];
    for (const e of edges) {
      const u = Number(e.source);
      const v = Number(e.target);
      if (displayGidSet.has(u) && displayGidSet.has(v)) {
        res.push(e);
      }
    }
    return res;
  }, [edges, displayGidSet]);

  // Active neighborhood for focus + context
  const activeNeighborhood = useMemo(() => {
    const set = new Set<number>();
    const focalGid = selectedGid !== null ? selectedGid : hoveredNode ? hoveredNode.gid : null;

    if (focalGid !== null) {
      set.add(focalGid);
      const neighbors = adjacency.get(focalGid);
      if (neighbors) {
        neighbors.forEach((nbr) => set.add(nbr));
      }
    }
    for (const gid of highlightedGids) {
      set.add(gid);
    }
    return set;
  }, [selectedGid, hoveredNode, highlightedGids, adjacency]);

  // Center on selected node or initial center
  useEffect(() => {
    if (selectedGid !== null) {
      const target = nodeMap.get(selectedGid);
      if (target && target.x !== undefined && target.y !== undefined) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        setTransform({
          x: width / 2 - target.x * 1.2,
          y: height / 2 - target.y * 1.2,
          k: 1.2,
        });
        return;
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const initialK = activeClusterFilter !== null ? 1.0 : viewMode === "key_actors" ? 0.75 : 0.38;
    setTransform({ x: width / 2, y: height / 2, k: initialK });
  }, [selectedGid, activeClusterFilter, viewMode]);

  // Canvas Render
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

    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const hasHighlight = activeNeighborhood.size > 0;
    const focalGid = selectedGid !== null ? selectedGid : hoveredNode ? hoveredNode.gid : null;

    // 1. Draw Edges with Directional Arrows
    for (const edge of visibleEdges) {
      const uId = Number(edge.source);
      const vId = Number(edge.target);
      const u = nodeMap.get(uId);
      const v = nodeMap.get(vId);

      if (!u || !v || u.x === undefined || u.y === undefined || v.x === undefined || v.y === undefined) {
        continue;
      }

      if (activeRoleFilter && u.role !== activeRoleFilter && v.role !== activeRoleFilter) {
        continue;
      }

      const isConnectedToFocal = focalGid !== null && (u.gid === focalGid || v.gid === focalGid);
      const isNeighborEdge = hasHighlight && activeNeighborhood.has(u.gid) && activeNeighborhood.has(v.gid);
      
      // Logarithmic thickness: min 1px, max 5.5px
      const logVol = Math.max(1.0, Math.min(5.5, (Math.log10(Math.max(100, edge.sum_kzt)) - 3) * 0.9 + 1.2));

      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);

      if (isConnectedToFocal) {
        // High contrast for direct flows: green for outgoing from focal, blue for incoming to focal
        ctx.strokeStyle = u.gid === focalGid ? "#00A855" : "#2E8FE0";
        ctx.lineWidth = Math.max(2.0, logVol * 1.4) / transform.k;
        ctx.globalAlpha = 0.95;
      } else if (isNeighborEdge) {
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = Math.max(1.2, logVol) / transform.k;
        ctx.globalAlpha = 0.65;
      } else if (hasHighlight) {
        // Dimmed non-neighbor edges to opacity 0.12 - 0.15
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = 0.8 / transform.k;
        ctx.globalAlpha = 0.12;
      } else {
        // Default neutral semi-transparent edge
        ctx.strokeStyle = "#64748B";
        ctx.lineWidth = Math.max(0.9, logVol * 0.75) / transform.k;
        ctx.globalAlpha = 0.38;
      }

      ctx.stroke();

      // Render directional arrow (u -> v)
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only draw arrow if distance is sufficient
      if (dist > 18) {
        const uRadius = (4 + 12 * u.priority_score) / transform.k;
        const vRadius = (4 + 12 * v.priority_score) / transform.k;
        
        // Place arrow slightly before target node boundary
        const targetOffset = vRadius + 4 / transform.k;
        const arrowDist = Math.max(dist * 0.45, dist - targetOffset);
        const ax = u.x + (dx / dist) * arrowDist;
        const ay = u.y + (dy / dist) * arrowDist;
        const angle = Math.atan2(dy, dx);
        const arrowSize = (isConnectedToFocal ? 7 : 5) / transform.k;

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

    // 2. Draw Nodes
    for (const node of positionedNodes) {
      if (node.x === undefined || node.y === undefined) continue;

      const isFocal = focalGid === node.gid;
      const isNeighbor = activeNeighborhood.has(node.gid);
      const isFiltered = activeRoleFilter !== null && node.role !== activeRoleFilter;

      // Radius derived from priority_score (min 4px, max 16px)
      let radius = 4 + 12 * Math.max(0, Math.min(1, node.priority_score));
      if (node.role === "peripheral") {
        radius = 4;
      }

      const color = ROLE_COLORS[node.role] || ROLE_COLORS.peripheral;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius / transform.k, 0, 2 * Math.PI);

      if (isFiltered) {
        ctx.fillStyle = "#B8BCC2";
        ctx.globalAlpha = 0.08;
        ctx.fill();
        continue;
      }

      if (isFocal) {
        // Selected / Hovered focal node: solid high-contrast fill with clean border ring
        ctx.fillStyle = "#FFFFFF";
        ctx.globalAlpha = 1.0;
        ctx.fill();

        ctx.lineWidth = 3.5 / transform.k;
        ctx.strokeStyle = "#00D26A";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, (radius + 4) / transform.k, 0, 2 * Math.PI);
        ctx.strokeStyle = color.bg;
        ctx.lineWidth = 1.5 / transform.k;
        ctx.stroke();
      } else if (isNeighbor) {
        // 1-hop connections stay at full brightness
        ctx.fillStyle = color.bg;
        ctx.globalAlpha = 0.95;
        ctx.fill();

        ctx.lineWidth = 2 / transform.k;
        ctx.strokeStyle = color.border;
        ctx.stroke();
      } else if (hasHighlight) {
        // Dim all non-connected nodes to opacity: 0.12-0.18
        ctx.fillStyle = color.bg;
        ctx.globalAlpha = 0.14;
        ctx.fill();
      } else {
        // Default mode
        if (node.role === "peripheral") {
          // Peripheral nodes small, light gray, opacity: 0.4
          ctx.fillStyle = "#B8BCC2";
          ctx.globalAlpha = 0.4;
          ctx.fill();
        } else {
          // Fill saturation/brightness based on role_score
          const alpha = 0.5 + Math.min(0.5, node.role_score * 0.5);
          ctx.fillStyle = color.bg;
          ctx.globalAlpha = alpha;
          ctx.fill();

          if (node.priority_score > 0.35 || node.is_seed) {
            ctx.lineWidth = 1.5 / transform.k;
            ctx.strokeStyle = color.border;
            ctx.stroke();
          }
        }
      }

      // 3. Node Labels
      // Focus + context: direct connections (1-hop) labeled with neighbor GIDs
      const shouldLabel =
        isFocal ||
        isNeighbor ||
        (node.priority_score >= 0.5 && transform.k > 0.8) ||
        (node.isBridge && activeClusterFilter !== null);

      if (shouldLabel) {
        ctx.globalAlpha = isFocal || isNeighbor ? 1.0 : 0.75;
        ctx.font = `600 ${Math.max(10, 11 / transform.k)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = isFocal ? "#00D26A" : "#1E293B";
        const label = String(node.gid).slice(-6);
        ctx.fillText(label, node.x + (radius + 4) / transform.k, node.y + 4 / transform.k);
      }
    }

    ctx.restore();
  }, [
    transform,
    visibleEdges,
    positionedNodes,
    nodeMap,
    selectedGid,
    hoveredNode,
    activeNeighborhood,
    activeRoleFilter,
    activeClusterFilter,
  ]);

  useEffect(() => {
    let animationId: number;
    const tick = () => {
      render();
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [render]);

  // Handlers
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
      const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
      const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

      let found: GraphNode | null = null;
      for (let i = positionedNodes.length - 1; i >= 0; i--) {
        const n = positionedNodes[i];
        if (n.x === undefined || n.y === undefined) continue;
        const dx = n.x - mouseX;
        const dy = n.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = (4 + 12 * n.priority_score) / transform.k;
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

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false);
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
      const radius = (4 + 12 * n.priority_score) / transform.k;
      if (dist <= Math.max(radius, 12 / transform.k)) {
        onSelectNode(n.gid);
        return;
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-[var(--fb-bg)] overflow-hidden select-none">
      {/* Subgraph Banner / Controls */}
      <div className="absolute top-4 left-4 right-16 flex flex-wrap items-center justify-between gap-3 z-10 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {activeClusterFilter !== null ? (
            <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-sm text-xs font-medium">
              <span className="text-[var(--fb-text-secondary)]">Cluster View:</span>
              <strong className="text-[var(--fb-text-primary)]">
                Cluster #{activeClusterFilter} Subgraph ({displayNodes.length} nodes, {visibleEdges.length} edges)
              </strong>
              <button
                onClick={onClearClusterFilter}
                className="ml-2 p-1 rounded-md hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                title="Exit Cluster Subgraph"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center p-1 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-sm text-xs">
              <button
                onClick={() => setViewMode("key_actors")}
                className={`px-3 py-1.5 font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === "key_actors"
                    ? "bg-[var(--fb-accent)] text-black shadow-xs"
                    : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Key Actors ({nodes.filter((n) => n.role === "coordinator" || n.role === "consolidator" || n.role === "distributor" || n.is_seed).length})
              </button>
              <button
                onClick={() => setShowFullWarning(true)}
                className={`px-3 py-1.5 font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  viewMode === "full"
                    ? "bg-[var(--fb-accent)] text-black shadow-xs"
                    : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Show Entire Network ({nodes.length})
              </button>
            </div>
          )}

          <button
            onClick={onOpenClusterExplorer}
            className="pointer-events-auto px-3 py-1.5 text-xs font-semibold rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:border-[var(--fb-accent)] transition flex items-center gap-1.5 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
            Explore by Cluster Map
          </button>
        </div>

        {/* Role Quick Filters */}
        <div className="pointer-events-auto hidden lg:flex items-center gap-1.5 p-1 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-sm text-xs">
          <button
            onClick={() => onSetRoleFilter(null)}
            className={`px-2.5 py-1 rounded-lg transition font-medium ${
              activeRoleFilter === null
                ? "bg-[var(--fb-border)] text-[var(--fb-text-primary)] font-semibold"
                : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
            }`}
          >
            All Roles
          </button>
          {Object.entries(ROLE_COLORS).map(([r, c]) => (
            <button
              key={r}
              onClick={() => onSetRoleFilter(activeRoleFilter === r ? null : r)}
              className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                activeRoleFilter === r
                  ? "bg-[var(--fb-border)] text-[var(--fb-text-primary)] font-semibold"
                  : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.bg }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => setTransform((prev) => ({ ...prev, k: Math.min(5.0, prev.k * 1.25) }))}
          className="p-2 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition shadow-sm"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform((prev) => ({ ...prev, k: Math.max(0.15, prev.k * 0.8) }))}
          className="p-2 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition shadow-sm"
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
                k: activeClusterFilter !== null ? 1.0 : 0.75,
              });
            }
          }}
          className="p-2 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition shadow-sm"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Heavy Mode Warning Modal */}
      {showFullWarning && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-40 p-4">
          <div className="bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-[var(--fb-text-primary)]">
                Render Full Network (2,248 Nodes)?
              </h3>
            </div>
            <p className="text-xs text-[var(--fb-text-secondary)] leading-relaxed">
              Rendering all 2,248 nodes and 3,119 edges across 82 clusters simultaneously is a heavy mode. Analysts typically achieve better clarity by exploring individual cluster subgraphs or prioritizing top candidates.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFullWarning(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setViewMode("full");
                  setShowFullWarning(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[var(--fb-accent)] text-black hover:bg-[var(--fb-accent-dark)] transition"
              >
                Render Network Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />

      {/* Node Tooltip on Hover */}
      {hoveredNode && tooltipPos && (
        <div
          className="absolute pointer-events-none p-3 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-xs shadow-xl z-20 transform -translate-x-1/2 -translate-y-full mb-3 max-w-xs"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-mono font-bold text-[var(--fb-text-primary)]">
              GID: {hoveredNode.gid}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
              style={{
                backgroundColor: `${ROLE_COLORS[hoveredNode.role]?.bg || "#94A3B8"}20`,
                color: ROLE_COLORS[hoveredNode.role]?.bg || "#94A3B8",
              }}
            >
              {hoveredNode.role}
            </span>
          </div>

          <div className="space-y-0.5 text-[var(--fb-text-secondary)] text-[11px]">
            <div>
              Priority Score:{" "}
              <strong className="text-[var(--fb-text-primary)] font-mono">
                {hoveredNode.priority_score.toFixed(3)}
              </strong>
            </div>
            <div>
              Cluster: <strong>#{hoveredNode.cluster_id}</strong>
              {hoveredNode.isBridge && (
                <span className="ml-1 text-[var(--fb-accent-dark)] font-semibold">(Bridge Node)</span>
              )}
            </div>
            <div>
              Direct Connections: <strong>{hoveredNode.in_deg + hoveredNode.out_deg}</strong>
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-[var(--fb-border)] text-[10px] text-[var(--fb-text-secondary)] italic line-clamp-2">
            {hoveredNode.evidence}
          </div>
        </div>
      )}
    </div>
  );
}
