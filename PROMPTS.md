# Prompt for an AI Code-Generation Model: "Money Graph"

Copy everything below (from `## TASK` to the end) and hand it to a code-generation
model (Claude Code, GPT, etc.) as a single prompt/spec.

---

## TASK

Build a web application for a bank's AML analyst that takes a transaction export
(3 parquet files: `edges`, `nodes`, `transactions`), builds a graph of money flows,
assigns a role to each of the ~2248 nodes within the organized group, ranks nodes by
review priority, and gives the analyst a visual network map plus an explainable
priority list.

## STACK

- **Backend**: Python 3.11+, FastAPI, `pandas`, `pyarrow` (parquet reading), `networkx`
  (graph, degree, betweenness, pagerank, connected components), `python-louvain` (or
  `networkx.algorithms.community.louvain_communities`) for clustering.
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind — visualization only,
  all data fetched over HTTP from the backend. Graph rendering — `react-cytoscapejs`
  or `react-force-graph-2d`.
- **LLM**: OpenAI SDK (python `openai`) — interactive analyst assistant; NVIDIA NIM
  (OpenAI-compatible REST endpoint, `https://integrate.api.nvidia.com/v1/chat/completions`,
  can be called with the same `openai` client using a different `base_url`) — cheap
  batch polishing of `evidence` text. Both LLM calls are optional add-ons with a
  template-based fallback.
- **Deployment**: docker-compose with two services — `backend` (FastAPI, port 8000)
  and `frontend` (Next.js, port 3000), or Next.js `rewrites()` proxying `/api/*` to
  the backend so only one public URL is exposed.
- Intermediate data is stored as CSV files on disk, no database.

## REPOSITORY STRUCTURE

```
/data/raw/                       -- edges.parquet, nodes.parquet, transactions.parquet
/data/output/                    -- nodes_roles.csv, clusters.csv, top_nodes.csv
/backend/
  app/
    main.py                      -- FastAPI app, routes
    pipeline/
      load_data.py               -- parquet reading (pandas/pyarrow), base aggregations
      build_graph.py             -- build a networkx.DiGraph from edges
      metrics.py                 -- degree, betweenness, pagerank, components, Louvain
      roles.py                   -- rule-based role assignment + role_score + evidence (templated)
      priority.py                -- priority_score computation
      enrich_with_llm.py         -- batched NVIDIA NIM call to polish evidence text
      export_csv.py              -- write the 3 CSV files
      run.py                     -- entry point: python -m app.pipeline.run
    routers/
      graph.py                   -- GET /graph
      pipeline.py                -- POST /pipeline/run
      assistant.py                -- POST /assistant (OpenAI)
    llm_clients.py                -- wrappers around the OpenAI/NVIDIA clients
  requirements.txt
  Dockerfile
/frontend/
  app/page.tsx                    -- dashboard: graph + gid search + priority list + node card
  components/
    GraphView.tsx
    TopList.tsx
    NodeCard.tsx
    AssistantPanel.tsx
  next.config.js                   -- rewrites to the backend (optional)
  Dockerfile
docker-compose.yml
README.md                          -- how to run in one command, role criteria and thresholds, limitations, a section on scaling to ~1M nodes
```

## INPUT DATA SCHEMA

- `edges.parquet`: `src`, `dst`, `sum_kzt`, `n_tx`, `depth` — payer→recipient pair
  aggregated over the period.
- `nodes.parquet`: `gid`, `depth` (minimum hop from a seed node), `is_seed` (bool).
- `transactions.parquet`: `src`, `dst`, `date`, `sum_kzt` — individual transactions
  (only used for optional temporal-pattern features).

Important data quirks the pipeline must account for:

- 444 nodes with `depth=4` and zero out-degree are an **artifact of the traversal being
  cut off at hop 4**, not a confirmed final recipient. Such nodes must not be silently
  labeled `terminal` on the same footing as genuine terminal nodes (`depth<4` and
  out-degree=0) — see the role rules below.
- Only outgoing transfers are present: inflows into nodes outside the sample are not
  visible, and seed clients' inflows are understated (the graph was built outward from them).
- The 5,000 KZT cutoff threshold means structuring below that amount is invisible in
  the data — this must be stated explicitly as a limitation in the README.
- There are 16 weakly connected components — the graph is not monolithic; clustering
  should be done within each component.
- No client attributes at all (name, age, etc.) — do not invent or enrich the data.

## METRICS COMPUTATION (per node gid, in `metrics.py`)

From `edges` (aggregated src→dst), via pandas groupby:

- `in_partners` = count of distinct `src` where `dst = gid`
- `out_partners` = count of distinct `dst` where `src = gid`
- `sum_in` = sum of `sum_kzt` over edges where `dst = gid`
- `sum_out` = sum of `sum_kzt` over edges where `src = gid`
- `pass_ratio` = `sum_out / sum_in` if `sum_in > 0`, else `None`

From the graph (networkx):

- `betweenness` = `nx.betweenness_centrality(G, normalized=True)` (fast enough for
  2248 nodes without sampling; note in the README that ~1M nodes would need
  k-sampling or approximate algorithms)
- `pagerank` = `nx.pagerank(G)`
- `component_id` — `nx.weakly_connected_components(G)`
- `cluster_id` — Louvain run separately within each component

## ROLE ASSIGNMENT RULES (rule-based, thresholds as constants in `roles.py`, documented in the README)

Apply top to bottom, first match wins:

1. **`coordinator`** — `betweenness` in the top 5% of the whole graph AND
   (`is_seed = true` OR the node's edges connect ≥2 different clusters) AND
   `in_partners + out_partners >= 5`.
2. **`consolidator`** — `in_partners >= 8` AND (`pass_ratio` undefined OR `pass_ratio < 0.3`).
3. **`distributor`** — `out_partners >= 15`.
4. **`transit`** — `pass_ratio` defined AND `0.8 <= pass_ratio <= 1.2` AND
   `in_partners >= 1` AND `out_partners >= 1`.
5. **`terminal`** — `out_partners = 0` AND `depth < 4` (a genuine sink, not a
   traversal-cutoff artifact). If `out_partners = 0` AND `depth = 4`: still assign
   `terminal`, but with an explicit `truncated = true` flag in `evidence`
   ("possible final recipient — the chain was not traced past hop 4, needs follow-up"),
   and lower `role_score` accordingly (e.g. ×0.6).
6. **`peripheral`** — everything else.

`role_score` (0–1) — how confidently the node fits the rule: e.g. the ratio of the
actual metric value to the threshold, clipped to [0,1] (a node with `in_partners=20`
against a threshold of 8 gets a higher `role_score` than one with `in_partners=9`).

## PRIORITY_SCORE (`priority.py`)

```
priority_score = clip(
  0.35 * norm(betweenness) +
  0.25 * norm(pagerank) +
  0.20 * norm(in_partners) +
  0.10 * norm(out_partners) +
  0.10 * (1 if is_seed else 0),
  0, 1
)
```

where `norm(x)` is min-max normalization across the whole graph (numpy/pandas).
`coordinator` and `consolidator` roles get a `×1.15` multiplier (clipped to 1.0) —
they are priority candidates for review.

## EVIDENCE (role explanation, up to 200 characters)

Step 1 — template-based generation with no LLM (mandatory fallback, so the must-have
requirement doesn't depend on API availability):

```python
f"Receives from {in_partners} different payers, forwards {pass_ratio*100:.0f}% of what it receives"
```

Step 2 (optional) — run the templated evidence through NVIDIA NIM in batches of
20-30 nodes for a more natural phrasing. System prompt:

```
You are an AML analyst's assistant. You are given a list of transaction-graph nodes
with their metrics. Rewrite each evidence explanation as one short (under 200
characters), human-readable sentence in English. Do not add facts that aren't in the
metrics. Never assert guilt — phrase things as observations about flow structure
("signs of consolidation", not "is laundering money"). Return strictly a JSON array
of {gid, evidence} objects in the same order, with nothing outside the JSON.

Node data:
{JSON with gid, role, in_partners, out_partners, sum_in, sum_out, pass_ratio, betweenness, is_seed}
```

If the LLM call fails or exceeds the time budget, fall back to the templated
evidence without blocking the pipeline (try/except with a template fallback).

## CLUSTERS (`clusters.csv`)

For each `cluster_id`: `n_nodes`, `n_seed` (number of seed nodes in the cluster),
`sum_kzt_internal` (sum of all intra-cluster edges), `top_gids` (top 5 by
priority_score, `;`-separated), `hypothesis` — one line of text (generated the same
way, with a templated fallback like "Cluster of {n_nodes} nodes, {n_seed} of them
known seed clients, internal turnover {sum} KZT").

## TOP_NODES.CSV

`rank, gid, role, priority_score, why` — at least 20 rows, sorted descending by
`priority_score`. `why` — 1-2 sentences, can reuse `evidence` plus a mention of the cluster.

## API (FastAPI, `backend/app/routers/`)

- `GET /graph` → `{ nodes: [...], edges: [...], clusters: [...] }` — reads the CSVs
  from `data/output`, returns JSON for the graph renderer. Cache in process memory
  (re-read only after `/pipeline/run`).
- `POST /pipeline/run` → runs `app.pipeline.run.main()` (via `BackgroundTasks` or a
  subprocess), returns status/log — for a "recompute" demo button.
- `POST /assistant` body `{ "question": str }` →
  1. Detect any gids mentioned in the question (regex over numbers) and/or interpret
     intent (top nodes by role, a node's neighborhood, etc.).
  2. Gather relevant context: the nodes themselves plus their direct edge neighbors
     (not the whole graph).
  3. Send to OpenAI with the system prompt:

     ```
     You are an AML assistant. Answer ONLY based on the graph data provided. If data
     is missing, say plainly what's missing. Never assert guilt — phrase things as
     hypotheses to verify. Reference the gids of any nodes you mention.
     ```

  4. Return `{ answer: str, mentioned_gids: number[] }` (for highlighting on the graph).

Next.js either calls `http://backend:8000` directly (inside the docker network) via
`fetch` in server components, or proxies through `next.config.js` `rewrites()` so the
browser only sees one origin.

## FRONTEND (`frontend/app/page.tsx`)

- Full-width network map: node color = role (with a legend), node outline/fill =
  cluster, edge thickness = `sum_kzt` (log scale), arrows for direction.
- Search by `gid` — highlights the node and centers the graph on it.
- Right-hand panel: priority list (table from `GET /graph`, clickable rows).
- Clicking a node → a card: role, `role_score`, `priority_score`, `evidence`, list of
  incoming/outgoing connections.
- Bottom panel (optional): chat with the AI assistant (`POST /assistant`).

## README.md (required)

- A single run command: `docker compose up --build` (the pipeline can run
  automatically on `backend` startup, or as a separate command
  `docker compose run backend python -m app.pipeline.run`) plus its running time.
- A table of thresholds for each role (copy from this spec) — the judges should be
  able to understand in under a minute why a node got its role.
- An explicit list of data limitations (hop-4 truncation artifact, outgoing transfers
  only, the 5,000 KZT threshold, understated seed inflows, 16 components).
- A "Scaling to ~1M nodes" section: written in prose — moving from in-memory
  networkx to streaming aggregation in a database (e.g. DuckDB/Postgres) for
  first-order metrics, approximate/sampled centrality algorithms, incremental
  recomputation instead of a full batch, persistent graph storage instead of CSV.

## HARD CONSTRAINTS

- Do not hardcode gids or "correct" roles — everything must be computed from metrics.
- Do not assign a role without a documented rule/threshold explaining the decision.
- Do not add invented client attributes (name, age, income, etc.).
- The pipeline must not require a GPU, the cloud, or paid services, except for the
  optional LLM API calls (which must have a template-based fallback without them).
- Final evidence/hypothesis wording must stay hypothesis-level, never an assertion of guilt.

## RECOMMENDED BUILD ORDER (for the code-generation model)

1. Scaffold `backend/` (FastAPI + requirements) and `frontend/` (Next.js + Tailwind), docker-compose.
2. `pipeline/load_data.py` + `build_graph.py` — verify the graph builds correctly and
   the counts (2248 nodes, 3119 edges) match.
3. `metrics.py` + `roles.py` + `priority.py` — no LLM, purely rule-based, with
   templated evidence. Run through to the three CSV files.
4. `export_csv.py` + `run.py` — single command, measure timing (<5 minutes).
5. `GET /graph` + a basic `GraphView.tsx` — verify the graph renders and doesn't
   stall on 2248 nodes.
6. `TopList.tsx` + `NodeCard.tsx` + gid search.
7. Only once the must-have requirements work end to end: `enrich_with_llm.py`
   (NVIDIA NIM) and `POST /assistant` (OpenAI) as optional add-ons, with a fallback
   when they're unavailable.
8. README.md.
