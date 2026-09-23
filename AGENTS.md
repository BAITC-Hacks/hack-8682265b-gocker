<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent Development & Testing Guide

This project is the **Money Graph** AML platform for HackAlem AI. All agents working on this codebase must follow these testing instructions and operational constraints.

---

## 1. Running the Automated Test Suite

The test suite validates compliance with the HackAlem AI Case Study Brief and the PROMPTS.md specification. It consists of 21 tests covering data ingestion, graph metrics, role attribution, scoring, CSV schemas, REST endpoints, and latency constraints.

### Run All Tests
Always run tests using the dedicated Python virtual environment located at `backend/.venv`:

```bash
# From repository root:
backend/.venv/bin/python -m pytest backend/tests -v

# Or from the backend/ directory:
cd backend
.venv/bin/python -m pytest tests -v
```

### Run Specific Test Modules

```bash
# 1. Test FastAPI endpoints (/health, /graph, /graph/node/{gid}, /graph/top, /assistant, /pipeline/run)
backend/.venv/bin/python -m pytest backend/tests/test_api_endpoints.py -v

# 2. Test output CSV schemas (nodes_roles.csv, clusters.csv, top_nodes.csv)
backend/.venv/bin/python -m pytest backend/tests/test_csv_exports.py -v

# 3. Test raw parquet loading, seed counts, and depth-4 cutoff artifacts
backend/.venv/bin/python -m pytest backend/tests/test_data_loader.py -v

# 4. Test DiGraph building, 16 connected components, Louvain clusters, and centralities
backend/.venv/bin/python -m pytest backend/tests/test_graph_and_metrics.py -v

# 5. Test deterministic role rules, evidence strings, and priority scores
backend/.venv/bin/python -m pytest backend/tests/test_roles_and_priority.py -v

# 6. Test latency constraint (< 5 minutes allowed, benchmark is ~1.5s)
backend/.venv/bin/python -m pytest backend/tests/test_performance.py -v
```

---

## 2. Test Suite Architecture & Verification Map

| Test File | Target Module | What It Verifies |
|---|---|---|
| `test_data_loader.py` | `app.pipeline.load_data` | • 2,248 nodes, 3,119 edges, 4,840 txs<br>• Exactly 81 seed accounts (`is_seed=True`)<br>• Minimum 5,000 KZT transaction cutoff<br>• Identifies exactly 444 depth-4 cutoff artifact nodes |
| `test_graph_and_metrics.py` | `app.pipeline.build_graph`<br>`app.pipeline.metrics` | • NetworkX `DiGraph` construction<br>• Decomposes into **16 weakly connected components**<br>• Louvain community partitioning per component<br>• Betweenness centrality ($[0, 1]$) & PageRank |
| `test_roles_and_priority.py` | `app.pipeline.roles`<br>`app.pipeline.priority` | • All nodes get 1 of 6 valid roles: `coordinator`, `consolidator`, `distributor`, `transit`, `terminal`, `peripheral`<br>• Rule precedence order (Rule 1 $\to$ Rule 6)<br>• Hop-4 terminal nodes flagged with `truncated_by_depth=True` and discount factor ($\times 0.6$)<br>• Evidence length $\le 200$ chars<br>• **Zero guilt assertions** (no forbidden terms)<br>• Priority score multipliers ($1.15\times$ for coordinators & consolidators) |
| `test_csv_exports.py` | `app.pipeline.export_csv` | • `nodes_roles.csv`: 2,248 rows, dual columns `id` and `gid`<br>• `clusters.csv`: cluster sums match 2,248 nodes & 81 seeds<br>• `top_nodes.csv`: $\ge 20$ rows sorted descending by priority score |
| `test_api_endpoints.py` | `app.routers.*`<br>`app.main` | • FastAPI `TestClient` verification of all REST endpoints<br>• Pre-warmed cache behavior<br>• GID extraction and response structure for `/assistant` |
| `test_performance.py` | `app.pipeline.run` | • End-to-end execution latency is well under the 5-minute limit (benchmark ~1.5s) |

---

## 3. Strict Rules & Constraints for AI Agents

When modifying backend code, you **MUST** ensure all 21 tests continue to pass. Pay close attention to these domain constraints:

1. **Dual Column Compatibility in CSV Exports**:
   - `nodes_roles.csv` must provide **both** `id` (required by HackAlem brief) and `gid` (required by frontend / PROMPTS.md).
   - `top_nodes.csv` must provide `rank`, `id`, `gid`, `GID`, `role`, `evaluation_priority`, `priority_score`, `reason`, `why`.
2. **Deterministic Role Hierarchy**:
   - Roles are evaluated **first-match-wins** in this order:
     1. `coordinator`
     2. `consolidator`
     3. `distributor`
     4. `transit`
     5. `terminal`
     6. `peripheral`
   - Do NOT alter this order without updating both `roles.py` and `test_roles_and_priority.py`.
3. **Hop-4 Traversal Boundary**:
   - 444 accounts have `depth=4` and `out_partners=0`. These are artifacts of the 4-hop collection boundary, NOT confirmed endpoints. They must retain `truncated_by_depth=True` and receive lower confidence.
4. **Zero Guilt Assertions**:
   - Evidence and hypotheses must strictly be objective observations of money flow topology (e.g., *"High betweenness... bridging 81 counterparties"*). Never use words like *"criminal"*, *"laundering"*, *"guilty"*, or *"convicted"*.
5. **No External Database Required**:
   - All persistence is disk/Parquet/CSV based; do not introduce Postgres/Redis dependencies for the core pipeline.

---

## 4. Helpful Commands for Agents

```bash
# Recompute pipeline standalone:
backend/.venv/bin/python -m app.pipeline.run

# Start backend locally (port 8000):
backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Start frontend locally (port 3000):
nix-shell -p bun --run "bun dev"
# or
bun dev
```
