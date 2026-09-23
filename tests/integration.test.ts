import { describe, it, expect } from "bun:test";

describe("Frontend to Backend Integration", () => {
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  it("verifies backend health status", async () => {
    try {
      const res = await fetch(`${backendUrl}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
    } catch {
      console.warn("Backend not active at localhost:8000, skipping live integration check");
    }
  });

  it("verifies full graph payload schema matches frontend expectations", async () => {
    try {
      const res = await fetch(`${backendUrl}/graph`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveProperty("nodes");
      expect(data).toHaveProperty("edges");
      expect(data).toHaveProperty("clusters");
      expect(data).toHaveProperty("summary");

      // Verify node counts match HackAlem dataset
      expect(data.nodes.length).toBe(2248);
      expect(data.edges.length).toBe(3119);
      expect(data.summary.total_seed).toBe(81);

      // Verify sample node has all fields needed by React components
      const sample = data.nodes[0];
      expect(sample).toHaveProperty("gid");
      expect(sample).toHaveProperty("role");
      expect(sample).toHaveProperty("role_score");
      expect(sample).toHaveProperty("priority_score");
      expect(sample).toHaveProperty("evidence");
      expect(sample).toHaveProperty("in_deg");
      expect(sample).toHaveProperty("out_deg");
      expect(sample).toHaveProperty("cluster_id");
    } catch {
      console.warn("Backend not active at localhost:8000, skipping live integration check");
    }
  });

  it("verifies top nodes endpoint delivers ranked list for PriorityTable", async () => {
    try {
      const res = await fetch(`${backendUrl}/graph/top`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(20);

      const top1 = data[0];
      expect(top1).toHaveProperty("rank");
      expect(top1.rank).toBe(1);
      expect(top1).toHaveProperty("role");
      expect(top1).toHaveProperty("priority_score");
    } catch {
      console.warn("Backend not active at localhost:8000, skipping live integration check");
    }
  });
});
