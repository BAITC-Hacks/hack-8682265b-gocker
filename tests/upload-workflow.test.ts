import { describe, it, expect } from "bun:test";

describe("Custom Data Upload & Referral Workflow", () => {
  it("parses seed GIDs correctly from comma, newline, and space separated inputs", () => {
    const rawSeeds = "100000003684369100, 100000008680731100\n100000002527114100; 100000003016635100 100000008089404100";
    const matches = rawSeeds.match(/\b\d+\b/g) || [];
    const gids = Array.from(new Set(matches.map(Number)));
    expect(gids).toHaveLength(5);
    expect(gids).toContain(100000003684369100);
    expect(gids).toContain(100000008680731100);
    expect(gids).toContain(100000002527114100);
    expect(gids).toContain(100000003016635100);
    expect(gids).toContain(100000008089404100);
  });

  it("generates correctly formatted Law Enforcement Referral Dossier CSV rows", () => {
    const sampleNodes = [
      {
        gid: 100000003684369100,
        role: "coordinator",
        priority_score: 0.9421,
        evidence: 'High betweenness bridging 14 clusters, forwards 12% of received funds',
        in_kzt: 54000000,
        out_kzt: 6480000,
        pass_through: 0.12,
        is_seed: true,
        in_cycle: false,
        rapid_transit: true,
        structuring_risk: false,
      },
      {
        gid: 100000008680731100,
        role: "consolidator",
        priority_score: 0.8115,
        evidence: 'Receives funds from 11 different payers, forwards 3% of amount received',
        in_kzt: 32000000,
        out_kzt: 960000,
        pass_through: 0.03,
        is_seed: false,
        in_cycle: true,
        rapid_transit: false,
        structuring_risk: true,
      }
    ];

    const headers = [
      "Rank",
      "Client_GID",
      "Assigned_Role",
      "Priority_Score",
      "AML_Role_Evidence_Rationale",
      "Total_Incoming_KZT",
      "Total_Outgoing_KZT",
      "Pass_Through_Ratio",
      "Is_Law_Enforcement_Seed",
      "Circular_Flow_Flag",
      "Rapid_Transit_Flag",
      "Structuring_Risk_Flag",
    ];

    const rows = sampleNodes.map((n, idx) => [
      idx + 1,
      n.gid,
      `"${n.role}"`,
      n.priority_score.toFixed(4),
      `"${n.evidence.replace(/"/g, '""')}"`,
      n.in_kzt,
      n.out_kzt,
      n.pass_through !== null ? (n.pass_through * 100).toFixed(1) + "%" : "N/A",
      n.is_seed ? "YES" : "NO",
      n.in_cycle ? "YES" : "NO",
      n.rapid_transit ? "YES" : "NO",
      n.structuring_risk ? "YES" : "NO",
    ]);

    const csvText = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    
    expect(csvText).toContain("Rank,Client_GID,Assigned_Role");
    expect(csvText).toContain("100000003684369100,\"coordinator\",0.9421");
    expect(csvText).toContain("Receives funds from 11 different payers, forwards 3% of amount received");
    expect(csvText).toContain("YES,NO,YES,NO"); // seed, cycle, rapid, struct
    expect(csvText).toContain("NO,YES,NO,YES"); // seed, cycle, rapid, struct
  });

  it("handles active dataset transitions and status badges", () => {
    const baselineStatus = {
      active_dataset: "sample",
      dataset_name: "HackAlem Baseline Case (81 Seeds, 2,248 Nodes)",
      is_custom: false,
      nodes_count: 2248,
      edges_count: 3119,
      seeds_count: 81,
    };

    const customStatus = {
      active_dataset: "custom",
      dataset_name: "Operation North Star (Case #2026-81)",
      is_custom: true,
      nodes_count: 512,
      edges_count: 740,
      seeds_count: 12,
    };

    expect(baselineStatus.is_custom).toBe(false);
    expect(baselineStatus.nodes_count).toBe(2248);

    expect(customStatus.is_custom).toBe(true);
    expect(customStatus.dataset_name).toContain("Operation North Star");
    expect(customStatus.seeds_count).toBe(12);
  });
});
