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
  Compass,
  Maximize2,
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
  in_cycle?: boolean;
  rapid_transit?: boolean;
  structuring_risk?: boolean;
  turnaround_hours?: number | null;
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
  const [showAllConnections, setShowAllConnections] = useState(false);
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

    // Key actors view: coordinators, consolidators, distributors, seeds, and elevated priority
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

  // Cluster-aware layout with minimum node spacing
  const { positionedNodes, clusterCentroids } = useMemo(() => {
    if (displayNodes.length === 0) {
      return { positionedNodes: [], clusterCentroids: new Map<number, { x: number; y: number; count: number }>() };
    }

    const centroids = new Map<number, { x: number; y: number; count: number }>();

    if (activeClusterFilter !== null) {
      const core = displayNodes.filter((n) => !n.isBridge);
      const bridge = displayNodes.filter((n) => n.isBridge);
      const result: GraphNode[] = [];
      const coreN = core.length;
      const coreRadius = Math.max(90, Math.min(280, 50 + Math.sqrt(coreN) * 36));

      core.forEach((node, i) => {
        const r = coreRadius * (0.35 + (1 - node.priority_score) * 0.65);
        const angle = (i / Math.max(1, coreN)) * 2 * Math.PI;
        result.push({
          ...node,
          x: r * Math.cos(angle),
          y: r * Math.sin(angle),
        });
      });

      centroids.set(activeClusterFilter, { x: 0, y: 0, count: coreN });

      const bridgeN = bridge.length;
      const bridgeRadius = coreRadius + 150;
      bridge.forEach((node, i) => {
        const angle = (i / Math.max(1, bridgeN)) * 2 * Math.PI;
        result.push({
          ...node,
          x: bridgeRadius * Math.cos(angle),
          y: bridgeRadius * Math.sin(angle),
        });
      });

      return { positionedNodes: result, clusterCentroids: centroids };
    }

    // Multi-cluster views: group by cluster_id, layout clusters cohesively
    const clusterMap = new Map<number, GraphNode[]>();
    for (const node of displayNodes) {
      const c = node.cluster_id;
      if (!clusterMap.has(c)) clusterMap.set(c, []);
      clusterMap.get(c)!.push({ ...node });
    }

    // Sort clusters by size descending (largest clusters in central rings)
    const sortedClusters = Array.from(clusterMap.entries()).sort(
      (a, b) => b[1].length - a[1].length
    );

    const result: GraphNode[] = [];
    const nClusters = sortedClusters.length;

    // Arrange cluster centers in tight concentric rings
    let clusterIdx = 0;
    let ring = 0;
    let ringRadius = 0;
    let clustersInCurrentRing = 1;
    let ringClusterCount = 0;

    const ringStep = viewMode === "key_actors" ? 340 : 420;

    sortedClusters.forEach(([cId, cNodes]) => {
      let cx = 0;
      let cy = 0;

      if (clusterIdx > 0) {
        if (ringClusterCount >= clustersInCurrentRing) {
          ring += 1;
          ringRadius = ring * ringStep;
          clustersInCurrentRing = Math.max(6, Math.round(ring * 5.5));
          ringClusterCount = 0;
        }
        const angle = (ringClusterCount / clustersInCurrentRing) * 2 * Math.PI + (ring % 2 === 1 ? 0.3 : 0);
        cx = ringRadius * Math.cos(angle);
        cy = ringRadius * Math.sin(angle);
        ringClusterCount += 1;
      }

      clusterIdx += 1;
      centroids.set(cId, { x: cx, y: cy, count: cNodes.length });

      const n = cNodes.length;
      if (n === 1) {
        cNodes[0].x = cx;
        cNodes[0].y = cy;
        result.push(cNodes[0]);
      } else {
        // Enforce minimum node distance in cluster circle >= 45px
        const radius = Math.max(48, Math.min(220, 28 + Math.sqrt(n) * 32));
        cNodes.forEach((node, i) => {
          const r = radius * (1 - Math.min(0.55, node.priority_score * 0.6));
          const angle = (i / n) * 2 * Math.PI;
          node.x = cx + r * Math.cos(angle);
          node.y = cy + r * Math.sin(angle);
          result.push(node);
        });
      }
    });

    return { positionedNodes: result, clusterCentroids: centroids };
  }, [displayNodes, activeClusterFilter, viewMode]);

  const nodeMap = useMemo(() => {
    const map = new Map<number, GraphNode>();
    for (const n of positionedNodes) {
      map.set(n.gid, n);
    }
    return map;
  }, [positionedNodes]);

  // Top 10 nodes by priority score for selective label rendering
  const top10Gids = useMemo(() => {
    const sorted = [...positionedNodes].sort((a, b) => b.priority_score - a.priority_score);
    return new Set(sorted.slice(0, 10).map((n) => n.gid));
  }, [positionedNodes]);

  // Filtered & Directed Edges
  const visibleEdges = useMemo(() => {
    const rawEdges: GraphEdge[] = [];
    for (const e of edges) {
      const u = Number(e.source);
      const v = Number(e.target);
      if (displayGidSet.has(u) && displayGidSet.has(v)) {
        rawEdges.push(e);
      }
    }

    // If density > 50 nodes and not opted in, show top 60% turnover edges + focal connections
    if (displayNodes.length > 50 && !showAllConnections && rawEdges.length > 10) {
      const sortedByVolume = [...rawEdges].sort((a, b) => (b.sum_kzt || 0) - (a.sum_kzt || 0));
      const cutoffIdx = Math.max(1, Math.ceil(sortedByVolume.length * 0.6));
      const cutoffVol = sortedByVolume[cutoffIdx - 1]?.sum_kzt || 0;

      const focalGid = selectedGid !== null ? selectedGid : hoveredNode ? hoveredNode.gid : null;

      return rawEdges.filter((e) => {
        const u = Number(e.source);
        const v = Number(e.target);
        if (focalGid !== null && (u === focalGid || v === focalGid)) return true;
        return (e.sum_kzt || 0) >= cutoffVol;
      });
    }

    return rawEdges;
  }, [edges, displayGidSet, displayNodes.length, showAllConnections, selectedGid, hoveredNode]);

  // Set of bidirectional pairs to curve in opposite directions
  const bidirectionalSet = useMemo(() => {
    const edgeKeys = new Set<string>();
    const bidi = new Set<string>();
    for (const e of visibleEdges) {
      edgeKeys.add(`${e.source}->${e.target}`);
      if (edgeKeys.has(`${e.target}->${e.source}`)) {
        bidi.add(`${e.source}->${e.target}`);
        bidi.add(`${e.target}->${e.source}`);
      }
    }
    return bidi;
  }, [visibleEdges]);

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

  // Fit camera to bounds
  const fitToBounds = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || positionedNodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of positionedNodes) {
      if (n.x === undefined || n.y === undefined) continue;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    if (!isFinite(minX) || !isFinite(maxX)) return;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    const padding = 70;

    const spanX = Math.max(120, maxX - minX + padding * 2);
    const spanY = Math.max(120, maxY - minY + padding * 2);

    const scale = Math.min(2.0, Math.max(0.2, Math.min((width - padding) / spanX, (height - padding) / spanY)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTransform({
      x: width / 2 - centerX * scale,
      y: height / 2 - centerY * scale,
      k: scale,
    });
  }, [positionedNodes]);

  // Auto fit on layout changes or center on selected node
  useEffect(() => {
    if (selectedGid !== null) {
      const target = nodeMap.get(selectedGid);
      if (target && target.x !== undefined && target.y !== undefined) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        setTransform({
          x: width / 2 - target.x * 1.25,
          y: height / 2 - target.y * 1.25,
          k: 1.25,
        });
        return;
      }
    }

    fitToBounds();
  }, [selectedGid, activeClusterFilter, viewMode, fitToBounds, nodeMap]);

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

    // Draw Subtle Cluster Grouping Rings & Labels in Multi-Cluster View
    if (activeClusterFilter === null && clusterCentroids.size > 1 && transform.k > 0.3) {
      ctx.save();
      for (const [cId, centroid] of clusterCentroids.entries()) {
        if (centroid.count > 1) {
          ctx.beginPath();
          const r = Math.max(50, Math.min(230, 30 + Math.sqrt(centroid.count) * 34));
          ctx.arc(centroid.x, centroid.y, r, 0, 2 * Math.PI);
          ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
          ctx.lineWidth = 1.2 / transform.k;
          ctx.setLineDash([4 / transform.k, 4 / transform.k]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = `600 ${Math.max(9, 10 / transform.k)}px -apple-system, BlinkMacSystemFont, sans-serif`;
          ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
          ctx.fillText(`Cluster #${cId}`, centroid.x - 24 / transform.k, centroid.y - r - 4 / transform.k);
        }
      }
      ctx.restore();
    }

    // 1. Draw Curved Edges with Visible Directional Arrows
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
      const isBidi = bidirectionalSet.has(`${edge.source}->${edge.target}`);

      // Quadratic Curve Control Point: calculate offset normal to the chord
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const nx = -dy / dist;
      const ny = dx / dist;
      const midX = (u.x + v.x) / 2;
      const midY = (u.y + v.y) / 2;

      // Curve offset: bidirectional flows curve strongly away, others have subtle organic curvature
      const curvature = isBidi ? 0.22 : 0.08;
      const cpX = midX + nx * (dist * curvature);
      const cpY = midY + ny * (dist * curvature);

      // Logarithmic thickness: min 1px, max 5.5px
      const logVol = Math.max(1.0, Math.min(5.5, (Math.log10(Math.max(100, edge.sum_kzt)) - 3) * 0.9 + 1.2));

      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.quadraticCurveTo(cpX, cpY, v.x, v.y);

      if (isConnectedToFocal) {
        ctx.strokeStyle = u.gid === focalGid ? "#00A855" : "#2E8FE0";
        ctx.lineWidth = Math.max(2.0, logVol * 1.4) / transform.k;
        ctx.globalAlpha = 0.95;
      } else if (isNeighborEdge) {
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = Math.max(1.2, logVol) / transform.k;
        ctx.globalAlpha = 0.65;
      } else if (hasHighlight) {
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = 0.8 / transform.k;
        ctx.globalAlpha = 0.12;
      } else {
        ctx.strokeStyle = "#64748B";
        ctx.lineWidth = Math.max(0.9, logVol * 0.75) / transform.k;
        ctx.globalAlpha = 0.38;
      }

      ctx.stroke();

      // Render Directional Arrowhead pointing at target v
      const vRadius = (4 + 12 * Math.max(0, Math.min(1, v.priority_score))) / transform.k;

      // Tangent vector at target from control point (cpX, cpY) to v
      const tax = v.x - cpX;
      const tay = v.y - cpY;
      const tLen = Math.sqrt(tax * tax + tay * tay) || 1;
      const angle = Math.atan2(tay, tax);

      // Position arrowhead just outside target node boundary
      const targetOffset = vRadius + 3 / transform.k;
      const ax = v.x - (tax / tLen) * targetOffset;
      const ay = v.y - (tay / tLen) * targetOffset;

      // Minimum visible size regardless of zoom
      const arrowSize = Math.max(5.5 / transform.k, Math.min(13 / transform.k, (isConnectedToFocal ? 9 : 7) / transform.k));

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

    // 2. Draw Nodes
    for (const node of positionedNodes) {
      if (node.x === undefined || node.y === undefined) continue;

      const isFocal = focalGid === node.gid;
      const isNeighbor = activeNeighborhood.has(node.gid);
      const isFiltered = activeRoleFilter !== null && node.role !== activeRoleFilter;

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
        ctx.fillStyle = color.bg;
        ctx.globalAlpha = 0.95;
        ctx.fill();

        ctx.lineWidth = 2 / transform.k;
        ctx.strokeStyle = color.border;
        ctx.stroke();
      } else if (hasHighlight) {
        ctx.fillStyle = color.bg;
        ctx.globalAlpha = 0.14;
        ctx.fill();
      } else {
        if (node.role === "peripheral") {
          ctx.fillStyle = "#B8BCC2";
          ctx.globalAlpha = 0.4;
          ctx.fill();
        } else {
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

      // 3. Selective Label Rendering (Focal, 1-Hop Neighbors, or Top 10 in Viewport)
      const shouldLabel =
        isFocal ||
        isNeighbor ||
        top10Gids.has(node.gid) ||
        (node.isBridge && activeClusterFilter !== null);

      if (shouldLabel) {
        ctx.globalAlpha = isFocal || isNeighbor ? 1.0 : 0.8;
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
    bidirectionalSet,
    top10Gids,
    clusterCentroids,
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
                className="ml-2 p-1 rounded-md hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)] cursor-pointer"
                title="Exit Cluster Subgraph"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center p-1 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-sm text-xs">
              <button
                onClick={() => setViewMode("key_actors")}
                className={`px-3 py-1.5 font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "key_actors"
                    ? "bg-[var(--fb-accent)] text-black shadow-xs"
                    : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Key Actors ({nodes.filter((n) => n.role === "coordinator" || n.role === "consolidator" || n.role === "distributor" || n.is_seed || n.priority_score >= 0.25).length})
              </button>
              <button
                onClick={() => setShowFullWarning(true)}
                className={`px-3 py-1.5 font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "full"
                    ? "bg-[var(--fb-accent)] text-black shadow-xs"
                    : "text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Entire Network ({nodes.length})
              </button>
            </div>
          )}

          {/* Density / Turnover Edge Filter Toggle (when > 50 nodes) */}
          {displayNodes.length > 50 && (
            <button
              onClick={() => setShowAllConnections(!showAllConnections)}
              className={`pointer-events-auto px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                showAllConnections
                  ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300"
                  : "bg-[var(--fb-surface)] border-[var(--fb-border)] text-[var(--fb-text-secondary)] hover:text-[var(--fb-text-primary)]"
              }`}
              title="Toggle between top 60% turnover flows and all connections"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>
                {showAllConnections ? "All Connections (dense)" : "Top 60% Volume Flows"}
              </span>
            </button>
          )}

          <button
            onClick={onOpenClusterExplorer}
            className="pointer-events-auto px-3 py-1.5 text-xs font-semibold rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:border-[var(--fb-accent)] transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--fb-accent-dark)]" />
            Explore by Cluster Map
          </button>
        </div>

        {/* Role Quick Filters */}
        <div className="pointer-events-auto hidden xl:flex items-center gap-1.5 p-1 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] shadow-sm text-xs">
          <button
            onClick={() => onSetRoleFilter(null)}
            className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
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
          className="p-2 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition shadow-sm cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform((prev) => ({ ...prev, k: Math.max(0.15, prev.k * 0.8) }))}
          className="p-2 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition shadow-sm cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={fitToBounds}
          className="p-2 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition shadow-sm cursor-pointer"
          title="Fit Network to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={fitToBounds}
          className="p-2 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition shadow-sm cursor-pointer"
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
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-[var(--fb-border)] text-[var(--fb-text-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setViewMode("full");
                  setShowFullWarning(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[var(--fb-accent)] text-black hover:bg-[var(--fb-accent-dark)] transition cursor-pointer"
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
