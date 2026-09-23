import { describe, it, expect } from "bun:test";
import { ROLE_COLORS, GraphNode, GraphEdge } from "@/components/GraphView";

describe("Graph Configuration and Utilities", () => {
  const sampleNodes: GraphNode[] = [
    {
      id: "100000003016635100",
      gid: 100000003016635100,
      role: "coordinator",
      role_score: 1.0,
      cluster_id: 2,
      priority_score: 0.63,
      evidence: "High betweenness bridging 81 counterparties",
      in_deg: 8,
      out_deg: 73,
      in_kzt: 586981,
      out_kzt: 9414081,
      pagerank: 0.007,
      pass_through: 16.03,
      depth: 0,
      is_seed: true,
      truncated_by_depth: false,
      in_cycle: true,
      rapid_transit: false,
      structuring_risk: false,
    },
    {
      id: "100000004962193100",
      gid: 100000004962193100,
      role: "consolidator",
      role_score: 0.5,
      cluster_id: 14,
      priority_score: 0.38,
      evidence: "Consolidates from 8 payers, forwards only 0%",
      in_deg: 8,
      out_deg: 0,
      in_kzt: 900468,
      out_kzt: 0,
      pagerank: 0.001,
      pass_through: null,
      depth: 1,
      is_seed: false,
      truncated_by_depth: false,
      in_cycle: false,
      rapid_transit: false,
      structuring_risk: true,
    },
    {
      id: "100000008888888100",
      gid: 100000008888888100,
      role: "terminal",
      role_score: 0.36,
      cluster_id: 2,
      priority_score: 0.12,
      evidence: "Possible final recipient (hop 4 truncated): received 50000 KZT",
      in_deg: 1,
      out_deg: 0,
      in_kzt: 50000,
      out_kzt: 0,
      pagerank: 0.0003,
      pass_through: null,
      depth: 4,
      is_seed: false,
      truncated_by_depth: true,
    },
  ];

  it("exports valid ROLE_COLORS dictionary with all 6 dictionary roles", () => {
    const expectedRoles = ["coordinator", "consolidator", "distributor", "transit", "terminal", "peripheral"];

    for (const role of expectedRoles) {
      expect(ROLE_COLORS).toHaveProperty(role);
      const conf = ROLE_COLORS[role];
      expect(conf.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(conf.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(conf.label.length).toBeGreaterThan(0);
      expect(conf.desc.length).toBeGreaterThan(0);
    }
  });

  it("filters nodes correctly by search query (GID, role, and evidence)", () => {
    // Search by full GID
    const searchGid = "100000003016635100";
    const matchGid = sampleNodes.filter(
      (n) => String(n.gid).includes(searchGid) || n.role.includes(searchGid) || n.evidence.includes(searchGid)
    );
    expect(matchGid.length).toBe(1);
    expect(matchGid[0].role).toBe("coordinator");

    // Search by partial text in evidence
    const searchEv = "hop 4 truncated";
    const matchEv = sampleNodes.filter((n) => n.evidence.toLowerCase().includes(searchEv.toLowerCase()));
    expect(matchEv.length).toBe(1);
    expect(matchEv[0].truncated_by_depth).toBe(true);

    // Search by role
    const searchRole = "consolidator";
    const matchRole = sampleNodes.filter((n) => n.role.toLowerCase() === searchRole.toLowerCase());
    expect(matchRole.length).toBe(1);
    expect(matchRole[0].gid).toBe(100000004962193100);
  });

  it("classifies risk priority tiers accurately", () => {
    const getRiskCategory = (score: number) => {
      if (score >= 0.5) return "critical";
      if (score >= 0.25) return "elevated";
      return "moderate";
    };

    expect(getRiskCategory(sampleNodes[0].priority_score)).toBe("critical");
    expect(getRiskCategory(sampleNodes[1].priority_score)).toBe("elevated");
    expect(getRiskCategory(sampleNodes[2].priority_score)).toBe("moderate");
  });

  it("calculates log-scale edge thickness correctly", () => {
    const calcEdgeWidth = (sumKzt: number) => {
      return Math.max(1, Math.min(8, Math.log10(Math.max(1, sumKzt)) - 3));
    };

    // 5,000 KZT minimum
    const minWidth = calcEdgeWidth(5000);
    expect(minWidth).toBeGreaterThanOrEqual(1);

    // 10,000,000 KZT large transfer
    const maxWidth = calcEdgeWidth(10000000);
    expect(maxWidth).toBeGreaterThan(minWidth);
    expect(maxWidth).toBeLessThanOrEqual(8);
  });

  it("handles formatting for turnaround time, pass ratio and counterparties", () => {
    const formatTurnaround = (hours?: number | null) => {
      if (hours === undefined || hours === null) return "N/A";
      return hours < 24 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`;
    };

    expect(formatTurnaround(12.4)).toBe("12.4h");
    expect(formatTurnaround(48.0)).toBe("2.0d");
    expect(formatTurnaround(null)).toBe("N/A");

    const formatPassRatio = (ratio?: number | null) => {
      if (ratio === undefined || ratio === null) return "N/A";
      return `${(ratio * 100).toFixed(0)}%`;
    };

    expect(formatPassRatio(1.05)).toBe("105%");
    expect(formatPassRatio(null)).toBe("N/A");
  });
});
