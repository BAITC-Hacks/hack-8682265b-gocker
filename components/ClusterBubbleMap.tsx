"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Layers, ZoomIn, ZoomOut, RotateCcw, ShieldCheck, ArrowRight } from "lucide-react";

interface ClusterItem {
  cluster_id: number;
  n_nodes: number;
  n_seed: number;
  sum_kzt_internal: number;
  top_gids: number[];
  hypothesis: string;
}

interface ClusterBubbleMapProps {
  clusters: ClusterItem[];
  onSelectCluster: (clusterId: number) => void;
}

interface BubbleNode extends ClusterItem {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
}

export default function ClusterBubbleMap({
  clusters,
  onSelectCluster,
}: ClusterBubbleMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.85 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredBubble, setHoveredBubble] = useState<BubbleNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Compute bubble sizes and initial pack layout
  const bubbles = useMemo<BubbleNode[]>(() => {
    if (clusters.length === 0) return [];

    const maxTurnover = Math.max(1, ...clusters.map((c) => c.sum_kzt_internal));

    const items: BubbleNode[] = clusters.map((c) => {
      // Radius scaled by sqrt(turnover) between 20px and 65px
      const norm = Math.sqrt(c.sum_kzt_internal / maxTurnover);
      const radius = 20 + norm * 45;
      return {
        ...c,
        x: 0,
        y: 0,
        radius,
        vx: 0,
        vy: 0,
      };
    });

    // Arrange in a spiral / packed circular layout
    const cols = Math.ceil(Math.sqrt(items.length * 1.3));
    const spacing = 140;

    items.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      b.x = (col - cols / 2) * spacing + (row % 2) * (spacing * 0.4);
      b.y = (row - Math.ceil(items.length / cols) / 2) * spacing;
    });

    return items;
  }, [clusters]);

  // Initial centering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTransform({
      x: canvas.clientWidth / 2,
      y: canvas.clientHeight / 2,
      k: 0.85,
    });
  }, []);

  // Canvas Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Draw each bubble
      for (const b of bubbles) {
        const isHovered = hoveredBubble?.cluster_id === b.cluster_id;
        const hasSeeds = b.n_seed > 0;

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, 2 * Math.PI);

        // Fill color based on seed presence
        if (hasSeeds) {
          ctx.fillStyle = isHovered ? "rgba(0, 210, 106, 0.28)" : "rgba(0, 210, 106, 0.16)";
        } else {
          ctx.fillStyle = isHovered ? "rgba(100, 116, 139, 0.24)" : "rgba(100, 116, 139, 0.10)";
        }
        ctx.fill();

        // Stroke
        ctx.lineWidth = isHovered ? 2.5 / transform.k : 1.5 / transform.k;
        ctx.strokeStyle = hasSeeds
          ? (isHovered ? "#00D26A" : "rgba(0, 210, 106, 0.7)")
          : (isHovered ? "#94A3B8" : "rgba(148, 163, 184, 0.45)");
        ctx.stroke();

        // Center label: Cluster ID
        ctx.fillStyle = hasSeeds ? "#00A855" : "#475569";
        ctx.font = `bold ${Math.max(11, Math.min(15, b.radius * 0.45))}px -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`C#${b.cluster_id}`, b.x, b.y - (b.radius > 30 ? 6 : 0));

        // Sub-label for large bubbles: Turnover
        if (b.radius > 32) {
          ctx.fillStyle = "#64748B";
          ctx.font = `500 10px -apple-system, sans-serif`;
          const volStr = `${(b.sum_kzt_internal / 1_000_000).toFixed(1)}M`;
          ctx.fillText(`${volStr} KZT`, b.x, b.y + 10);
        }

        // Seed Badge on bubble top-right
        if (hasSeeds) {
          const badgeX = b.x + b.radius * 0.65;
          const badgeY = b.y - b.radius * 0.65;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 8, 0, 2 * Math.PI);
          ctx.fillStyle = "#00D26A";
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(b.n_seed), badgeX, badgeY);
        }
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bubbles, transform, hoveredBubble]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newK = Math.max(0.2, Math.min(4.0, transform.k * zoomFactor));

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

      let found: BubbleNode | null = null;
      for (const b of bubbles) {
        const dx = b.x - mouseX;
        const dy = b.y - mouseY;
        if (Math.sqrt(dx * dx + dy * dy) <= b.radius) {
          found = b;
          break;
        }
      }

      setHoveredBubble(found);
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

    for (const b of bubbles) {
      const dx = b.x - mouseX;
      const dy = b.y - mouseY;
      if (Math.sqrt(dx * dx + dy * dy) <= b.radius) {
        onSelectCluster(b.cluster_id);
        return;
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-[var(--fb-bg)] overflow-hidden select-none">
      {/* Header Banner */}
      <div className="absolute top-4 left-6 z-10 pointer-events-none">
        <h2 className="text-sm font-bold text-[var(--fb-text-primary)] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--fb-accent-dark)]" />
          Cluster Community Map ({clusters.length} clusters)
        </h2>
        <p className="text-xs text-[var(--fb-text-secondary)] mt-0.5">
          Bubble size = internal turnover. Green badge = contains seed clients. Click any cluster to open its focused subgraph.
        </p>
      </div>

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={() =>
            setTransform((prev) => ({ ...prev, k: Math.min(4.0, prev.k * 1.25) }))
          }
          className="p-2 rounded-lg bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            setTransform((prev) => ({ ...prev, k: Math.max(0.2, prev.k * 0.8) }))
          }
          className="p-2 rounded-lg bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition"
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
                k: 0.85,
              });
            }
          }}
          className="p-2 rounded-lg bg-[var(--fb-surface)] border border-[var(--fb-border)] text-[var(--fb-text-primary)] hover:bg-[var(--fb-border)] transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />

      {/* Tooltip on Hover */}
      {hoveredBubble && tooltipPos && (
        <div
          className="absolute pointer-events-none p-3.5 rounded-xl fb-card bg-[var(--fb-surface)] border border-[var(--fb-border)] text-xs shadow-xl z-30 transform -translate-x-1/2 -translate-y-full mb-3 max-w-xs"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-[var(--fb-text-primary)] text-sm">
              Cluster #{hoveredBubble.cluster_id}
            </span>
            {hoveredBubble.n_seed > 0 ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {hoveredBubble.n_seed} Seed Client{hoveredBubble.n_seed > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[10px] text-[var(--fb-text-secondary)]">0 Seeds</span>
            )}
          </div>

          <div className="space-y-1 text-[var(--fb-text-secondary)] text-xs mb-2">
            <div>
              Total Accounts: <strong className="text-[var(--fb-text-primary)]">{hoveredBubble.n_nodes}</strong>
            </div>
            <div>
              Internal Turnover:{" "}
              <strong className="text-[var(--fb-text-primary)] font-mono">
                {hoveredBubble.sum_kzt_internal.toLocaleString()} KZT
              </strong>
            </div>
            <div className="text-[11px] pt-1 border-t border-[var(--fb-border)] text-[var(--fb-text-primary)] leading-tight">
              {hoveredBubble.hypothesis}
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-[var(--fb-accent-dark)] font-semibold">
            <span>Click to explore subgraph</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      )}
    </div>
  );
}
