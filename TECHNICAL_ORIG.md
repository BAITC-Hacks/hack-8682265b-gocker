# Case Technical Specification for HackAlem AI

**Track:** Analytics & Decision Making / Cybersecurity & Compliance  
**Format:** Team development, 5 hours  
**Data:** Provided at the beginning of the hackathon, anonymized  

---

### 1. Title

**Money Graph: Reconstructing the Financial Structure of an Organized Group from a Transaction Network**

---

### 2. Problem

Currently, an AML analyst at a second-tier bank faces a challenge: based on operational intelligence, only the lowest tier of a criminal chain is known — specific clients who received funds associated with illicit drug trafficking. Identifying who stands higher up — who aggregates these funds, who they are routed through, and who ultimately controls them — must be reconstructed manually.

| Cause | Consequence | Scale |
| :--- | :--- | :--- |
| Manual chain tracing from a single client across 4 hops | Hours of analyst labor per node | Known: 81 clients; actual network: 2,248 nodes |
| The primary portion of the network remains invisible | Only the bottom tier is blocked | Organizers retain infrastructure and restore it within days |
| Investigation priority decisions are made intuitively | No ranking of who to inspect first | — |

**Solution Impact:** Within minutes, an analyst receives a ranked list of nodes with role justifications for each, instead of spending weeks on manual tracing; the investigative focus shifts from 81 "couriers" to actual consolidation points.

---

### 3. User

**Primary user:** AML analyst / Financial Monitoring Department specialist at a second-tier bank.

**Key scenario (from entry to outcome):**

1. The analyst receives a list of clients involved in an ongoing case from law enforcement (81 gids).
2. Uploads an export of outbound transfers for these clients across 4 hops into the team's tool.
3. The tool constructs a graph, calculates metrics, and assigns a role to each node: consolidation point, transit, distributor, terminal recipient, peripheral.
4. The analyst views the network diagram displaying flow directions, highlighted roles, and clusters.
5. The analyst opens the top priority list, reads the evidence for each node (*"receives from 11 distinct payers, forwards 3% of incoming funds"*), and generates a list of clients for in-depth verification and law enforcement referral.

---

### 4. Task

Develop an analytical tool (pipeline + visualization interface) that determines the roles of participants in a financial network based on a transaction graph, ranks them by significance, and provides the analyst with a production-ready model of the group structure: participants, connections, money flow directions, transit nodes, consolidation points, clusters, and key nodes.

The tool must answer the analyst's question: **"Which of these 2,248 clients should be examined first, and why?"**

---

### 5. Input → Output

#### Input

| Parameter | Value |
| :--- | :--- |
| **Format** | 3 `.parquet` files (`edges`, `nodes`, `transactions`) |
| **Volume** | 2,248 nodes, 3,119 edges, 4,840 transactions |
| **Period** | 2026-07-01 — 2026-07-31 |
| **Frequency** | One-off batch export; real-time streaming is not required |
| **Example** | Full dataset provided; schema definitions available in dataset `README.md` |

#### Output

Three CSV exports with fixed schemas + inspection interface.

**`nodes_roles.csv` — one row for each of the 2,248 nodes:**

| Column | Type | Description |
| :--- | :--- | :--- |
| `gid` | `int64` | Client identifier |
| `role` | `str` | Primary role from vocabulary (see below) |
| `role_score` | `float` | Confidence in role, `0–1` |
| `cluster_id` | `int` | Cluster ID |
| `priority_score` | `float` | Priority for analyst, `0–1` |
| `evidence` | `str` | Reason for role assignment — up to 200 characters, human-readable |

**Role Vocabulary (mandatory baseline; the team may extend it if documented):**

| Role | Description |
| :--- | :--- |
| `consolidator` | Consolidation point — aggregates funds from multiple participants |
| `transit` | Transit account — routes funds through without retaining them |
| `distributor` | Fan-out distribution of funds across numerous recipients |
| `terminal` | Terminal recipient — money arrives and remains |
| `coordinator` | Coordinating node, candidate network organizer |
| `peripheral` | Peripheral, no distinctive role patterns identified |

* **`clusters.csv`** — one row per cluster: `cluster_id`, `n_nodes`, `n_seed`, `sum_kzt_internal`, `top_gids`, `hypothesis` (hypothesis on cluster purpose).
* **`top_nodes.csv`** — ranked list of at least 20 nodes: `rank`, `gid`, `role`, `priority_score`, `why` (text justification).
* **Inspection interface:** Network diagram displaying flow directions, role/cluster highlighting, and `gid` search. Web page, notebook, or desktop app — at team discretion.
* **Allowed latency:** Full recomputation from raw `.parquet` files to exports — no more than 5 minutes on the provided data volume.

---

### 6. Data

**Access method:** An archive containing the `data/` folder is distributed to all teams at the start of the hackathon. External sources are neither required nor expected.

#### Composition

| File | Rows | Contents |
| :--- | :--- | :--- |
| `edges.parquet` | 3,119 | Payer→recipient pair aggregated over the period: `src`, `dst`, `sum_kzt`, `n_tx`, `depth` |
| `nodes.parquet` | 2,248 | Unique client: `gid`, `depth` (minimum hop), `is_seed` |
| `transactions.parquet` | 4,840 | Individual transaction: `src`, `dst`, `date`, `sum_kzt` |

*Full field descriptions are located in the dataset `README.md`.*

#### How the graph was collected

* Seed nodes: 81 clients previously identified as illicit drug trafficking participants;
* Only outgoing transfers are traced; traversal depth is 4 hops;
* Threshold: transactions < 5,000 KZT were excluded from the export;
* Internal bank transfers only, July 2026.
* Hop distribution: seed — 81, 1st — 472, 2nd — 462, 3rd — 789, 4th — 444.
* Total network turnover: 365,890,012 KZT.

#### Data Quality and Constraints (announced upfront — handling them is evaluated)

| Characteristic | Implication for the Solution |
| :--- | :--- |
| **Cutoff at the 4th hop.** 444 nodes have `depth=4` and zero outgoing transfers — this is an artifact of the traversal limit, not evidence that funds settled | A naive rule of `out_degree = 0 ⇒ terminal recipient` will produce 444 false sinks |
| **Outbound transfers only.** Inbound flows to nodes outside the extracted subgraph are invisible | Full account balances cannot be reliably computed |
| **Seed clients have understated inbound sums** — the graph was collected starting from them; money received from outside the sample is absent | The "outbound / inbound" ratio for seeds is skewed; 354 graph nodes send out more than they received in the dataset |
| **5,000 KZT threshold** | Smurfing/structuring below this threshold is invisible in the data |
| **19 of 81 seeds are missing from edges; an additional 12 appear solely as recipients** | 31 seeds have no outgoing transfers — must be accounted for during traversal |
| **16 weakly connected components:** 1,877 nodes (46 seeds), 270 (1 seed), remaining 14 range from 2 to 17 nodes | The network is fragmented; 352 nodes lie outside the largest component |
| **No client attributes** — no full name, age, transaction categories, or account balances | Graph structure and transaction amounts only |
| **No labeled ground-truth roles** | Evaluation is based on criterion soundness, not classification accuracy |

**Licensing and Privacy:** The data is anonymized (`gid` is a synthetic identifier with no link to real identity), provided exclusively for use within the hackathon.

---

### 7. Must-Haves

Without these five items, the solution will not be considered complete. Verification methods are specified for each.

| No. | Mandatory Feature | Verification Method |
| :---: | :--- | :--- |
| **1** | **Reproducible pipeline.** Single execution from raw `.parquet` files to all three exports, without manual steps | Judges run the command specified in the `README` on a clean environment; pipeline finishes in < 5 minutes and outputs 3 files |
| **2** | **Role and score for every node.** All 2,248 nodes are assigned a vocabulary role, `role_score`, and `evidence` | `nodes_roles.csv` contains 2,248 rows, all mandatory columns are populated, `evidence` is non-empty |
| **3** | **Role criteria are documented and explainable.** Formal rule or metric with a threshold for each role | Judges select 3 arbitrary `gid`s; the team explains within 1 minute why the role was assigned using their underlying metrics |
| **4** | **Network clustering.** Nodes are partitioned into groups; each cluster includes size, seed count, turnover, and hypothesis | `clusters.csv` is populated; each node in `nodes_roles.csv` has a `cluster_id` |
| **5** | **Top priority list + visualization.** Ranked list of ≥ 20 nodes with justifications and an interface showing the network graph with flow directions and roles | `top_nodes.csv` is populated; during the demo, judges name a `gid` — the team locates it on the graph and shows its connections |

---

### 8. Optional

Award bonus points; do not block submission:

* **Handling the graph boundary artifact** — differentiating actual terminal recipients from nodes truncated by the 4th hop, backed by methodological justification.
* **Temporal patterns** — pass-through transit (inbound and outbound within 1–2 days), activity bursts, synchronized transfers from multiple payers on the same day.
* **Detecting recurring routes and return flows** — persistent A→B→C paths and cycles where funds cycle back to the originator.
* **Anomaly detection** — smurfing/structuring, anomalous node profiles relative to their hop depth (rule-based or ML models).
* **Network resilience assessment** — evaluating network degradation if top-N nodes are removed; whether it splits into isolated components.
* **Analyst AI assistant** — natural language querying (*"who aggregates funds from these five accounts?"*) → graph-backed answer referencing node `gid`s.
* **Automated node summary cards** — concise dossier per client: role, transaction flows, connections, risk flags.
* **Completeness evaluation** — highlighting missing data gaps and recommending the next targeted inquiry for the analyst.

---

### 9. Constraints

#### Prohibited

* Hardcoding outputs — baking fixed lists of `gid`s into code as "correct answers" instead of algorithmic computation.
* Submitting a "black box" — roles lacking an explainable rule or interpretable features will not be accepted (see must-have 3).
* External enrichment and inventing missing client attributes (gender, age, income, employer) — any such fields will be deemed fabricated.
* Requiring cloud clusters, GPU training, or paid external services to reproduce results.

#### Mandatory Requirements

| Requirement | Description |
| :--- | :--- |
| **Explainability** | Every role assignment and top-list entry must include an explanation understandable to an analyst without an ML background |
| **Privacy** | Data is anonymized; the solution must not assume processing of full names, national IDs, or other personal data |
| **Cautious terminology** | Findings must be phrased as investigative hypotheses (*"exhibits consolidation patterns"*) rather than assertions of guilt |
| **Performance** | Full recomputation ≤ 5 minutes on the provided dataset, locally on a standard laptop |
| **Infrastructure** | Entirely local execution; internet access is permitted only for external LLM APIs if utilized by the team |
| **Tech stack** | Any programming language and libraries; Python (`pandas`, `networkx`/`igraph`) is recommended — starter code is provided |
| **Scalability** | The `README` must outline architectural modifications required if scaling the graph to ~1M nodes (written section, implementation not required) |

---

### 10. Artifacts

| Artifact | Required | Contents |
| :--- | :---: | :--- |
| **Repository** | Yes | Source code for pipeline and interface |
| **README** | Yes | Setup instructions (single command), role criteria and thresholds, output descriptions, solution limitations, scalability section |
| **Exports** | Yes | `nodes_roles.csv`, `clusters.csv`, `top_nodes.csv` |
| **Architecture diagram** | Yes | Single slide/diagram: data → metrics → roles → interface |
| **Demo** | Yes | 5 minutes: live execution and deep-dive walkthrough of 2–3 sample nodes |

*Starter code (data ingestion, graph construction, basic metric computation, export boilerplate) is provided by the organizers in the `starter/` directory so teams do not spend the first hour on boilerplate.*

---

### Note for Organizers

The case has been validated against the dataset: the declared must-haves can be completed within 5 hours by a team of 3–4 members. The data features prominent candidates across all dictionary roles — nodes receiving transfers from 8–24 distinct payers, nodes fanning out to 60–116 recipients, 72 nodes with a pass-through ratio of 0.8–1.2, and standard community detection (Louvain) yields 8 stable communities containing more than one seed client. The task is solvable but intentionally does not possess a single unique solution; evaluation centers on the soundness and defensibility of criteria.

---

### Evaluation Criteria

| Criterion | Evaluation Scope | Points |
| :--- | :--- | :---: |
| **Task Alignment & Operational Validity** | Evaluates whether the solution satisfies the problem statement and supports the primary workflow scenario. | 25 |
| **Technical Implementation** | Evaluates code and architectural quality: methodology, interaction of components, utilization of AI/agentic patterns, and fidelity to project design. | 25 |
| **README & Reproducibility** | Evaluates clarity of documentation, architecture visibility, execution instructions, and independent reproduction of results from repository assets. | 25 |
| **Value & Practical Usability** | Evaluates how directly the tool addresses the business problem and its operational viability for real-world analyst workflows. | 15 |
| **Growth Potential & Novelty** | Evaluates scalability, future development runway, and well-reasoned, non-standard algorithmic or architectural innovations. | 10 |
| **Total** | — | **100** |
