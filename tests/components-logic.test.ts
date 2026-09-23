import { describe, it, expect } from "bun:test";
import { GraphNode, GraphEdge } from "@/components/GraphView";

describe("Component Logic and State Transformations", () => {
  const mockNodes: GraphNode[] = [
    {
      id: "100000003016635100",
      gid: 100000003016635100,
      role: "coordinator",
      role_score: 1.0,
      cluster_id: 2,
      priority_score: 0.6329,
      evidence: "High betweenness (0.0072) bridging 81 counterparties across clusters.",
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
      id: "100000006866783100",
      gid: 100000006866783100,
      role: "coordinator",
      role_score: 1.0,
      cluster_id: 0,
      priority_score: 0.6064,
      evidence: "High betweenness (0.0060) bridging 80 counterparties across clusters.",
      in_deg: 13,
      out_deg: 67,
      in_kzt: 838812,
      out_kzt: 3948037,
      pagerank: 0.006,
      pass_through: 4.71,
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
      priority_score: 0.385,
      evidence: "Consolidates from 8 payers, forwards only 0% outward to 0 recipients.",
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
      id: "100000004444444100",
      gid: 100000004444444100,
      role: "terminal",
      role_score: 0.36,
      cluster_id: 2,
      priority_score: 0.12,
      evidence: "Possible final recipient (hop 4 truncated): received 50,000 KZT",
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

  const mockEdges: GraphEdge[] = [
    { id: "e1", source: "100000003016635100", target: "100000004962193100", sum_kzt: 500000, n_tx: 5, depth: 1 },
    { id: "e2", source: "100000006866783100", target: "100000004962193100", sum_kzt: 400468, n_tx: 3, depth: 1 },
    { id: "e3", source: "100000003016635100", target: "100000004444444100", sum_kzt: 50000, n_tx: 1, depth: 4 },
  ];

  describe("PriorityTable Logic", () => {
    it("sorts nodes descending by priority score", () => {
      const sorted = [...mockNodes].sort((a, b) => b.priority_score - a.priority_score);
      expect(sorted[0].gid).toBe(100000003016635100);
      expect(sorted[1].gid).toBe(100000006866783100);
      expect(sorted[sorted.length - 1].gid).toBe(100000004444444100);
    });

    it("filters nodes by role correctly", () => {
      const coordinators = mockNodes.filter((n) => n.role === "coordinator");
      expect(coordinators.length).toBe(2);

      const consolidators = mockNodes.filter((n) => n.role === "consolidator");
      expect(consolidators.length).toBe(1);
    });

    it("identifies high-risk topology flags", () => {
      const cycleNodes = mockNodes.filter((n) => n.in_cycle);
      expect(cycleNodes.length).toBe(2);

      const structuringNodes = mockNodes.filter((n) => n.structuring_risk);
      expect(structuringNodes.length).toBe(1);
      expect(structuringNodes[0].role).toBe("consolidator");
    });
  });

  describe("NodeCard & Counterparty Neighbors", () => {
    it("extracts incoming and outgoing counterparties for a selected node", () => {
      const targetGid = "100000004962193100";
      const incoming = mockEdges.filter((e) => e.target === targetGid);
      const outgoing = mockEdges.filter((e) => e.source === targetGid);

      expect(incoming.length).toBe(2);
      expect(outgoing.length).toBe(0);

      const totalInflow = incoming.reduce((acc, e) => acc + e.sum_kzt, 0);
      expect(totalInflow).toBe(900468);
    });

    it("detects hop-4 boundary cutoff badge condition", () => {
      const node = mockNodes.find((n) => n.gid === 100000004444444100)!;
      const isHop4Cutoff = node.depth === 4 && node.out_deg === 0 && node.truncated_by_depth;
      expect(isHop4Cutoff).toBe(true);

      const genuineNode = mockNodes.find((n) => n.gid === 100000003016635100)!;
      expect(genuineNode.truncated_by_depth).toBe(false);
    });
  });

  describe("Cluster Parsing", () => {
    it("parses top_gids semicolon string correctly into numeric array", () => {
      const rawTopGids = "100000003016635100;100000006866783100;100000004962193100";
      const parsedGids = rawTopGids.split(";").map((s) => Number(s.trim()));

      expect(parsedGids).toEqual([100000003016635100, 100000006866783100, 100000004962193100]);
      expect(parsedGids.length).toBe(3);
    });
  });

  describe("Assistant Panel Query Parsing", () => {
    it("extracts 18-digit GIDs from natural language questions", () => {
      const text = "Can you analyze flow for account 100000003016635100 and its neighbor 100000004962193100?";
      const matches = text.match(/\b\d{10,20}\b/g);

      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
      expect(matches).toContain("100000003016635100");
      expect(matches).toContain("100000004962193100");
    });
  });

  describe("Escalation and Case Reviews Logic", () => {
    it("filters nodes correctly when escalatedOnly is active", () => {
      const mockReviews: Record<number, { status: string; note?: string }> = {
        100000003016635100: { status: "escalated", note: "Bridge node" },
        100000006866783100: { status: "cleared" },
      };

      const filterNodes = (nodes: GraphNode[], escalatedOnly: boolean) => {
        return nodes.filter((n) => !escalatedOnly || mockReviews[n.gid]?.status === "escalated");
      };

      const all = filterNodes(mockNodes, false);
      expect(all.length).toBe(4);

      const escalated = filterNodes(mockNodes, true);
      expect(escalated.length).toBe(1);
      expect(escalated[0].gid).toBe(100000003016635100);
    });
  });

  describe("Explain GID Oral Script Formatting", () => {
    it("formats 30-second oral script concisely with substituted values", () => {
      const explainData = {
        gid: 100000004071080100,
        final_role: "consolidator",
        rule_trace: [
          { rule: "coordinator", matched: false, reason: "betweenness 0.000028 < threshold 0.000155" },
          { rule: "consolidator", matched: true, reason: "in_partners=9 >= 8 AND pass_ratio=0.19 < 0.30" },
        ],
      };

      const matched = explainData.rule_trace.find((r) => r.matched);
      expect(matched).toBeDefined();

      const script = `Account ${explainData.gid} is classified as ${explainData.final_role.toUpperCase()} because ${matched?.reason}.`;
      expect(script).toContain("CONSOLIDATOR");
      expect(script).toContain("in_partners=9 >= 8");
      expect(script.length).toBeLessThan(200);
    });
  });
});
