import { describe, it, expect, mock } from "bun:test";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/[...path]/route";

describe("Next.js API Proxy Route (/api/[...path])", () => {
  it("proxies GET request with path and query parameters", async () => {
    const mockData = { status: "ok", service: "money-graph-backend" };
    const originalFetch = globalThis.fetch;

    globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      expect(urlStr).toContain("127.0.0.1:8000/graph?cluster_id=2");
      return Promise.resolve(
        new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as any;

    try {
      const request = new NextRequest("http://localhost:3000/api/graph?cluster_id=2");
      const params = Promise.resolve({ path: ["graph"] });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json).toEqual(mockData);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("proxies POST request with json payload and headers", async () => {
    const mockResponse = { answer: "Analyzed node 100000003016635100", mentioned_gids: [100000003016635100] };
    const requestBody = JSON.stringify({ question: "who are top coordinators?" });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      expect(urlStr).toContain("127.0.0.1:8000/assistant");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(requestBody);
      return Promise.resolve(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as any;

    try {
      const request = new NextRequest("http://localhost:3000/api/assistant", {
        method: "POST",
        body: requestBody,
        headers: { "Content-Type": "application/json" },
      });
      const params = Promise.resolve({ path: ["assistant"] });

      const response = await POST(request, { params });
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.mentioned_gids).toEqual([100000003016635100]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles backend unreachable error with HTTP 502", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() => Promise.reject(new Error("Connection refused"))) as any;

    try {
      const request = new NextRequest("http://localhost:3000/api/health");
      const params = Promise.resolve({ path: ["health"] });

      const response = await GET(request, { params });
      expect(response.status).toBe(502);

      const json = await response.json();
      expect(json.error).toBe("Backend proxy error");
      expect(json.details).toContain("Connection refused");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
