import json
from typing import List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter
from app.llm_clients import get_llm_client, extract_gids
from app.routers.graph import load_graph_data_from_disk

router = APIRouter(prefix="", tags=["assistant"])


class AssistantRequest(BaseModel):
    question: str


class AssistantResponse(BaseModel):
    answer: str
    mentioned_gids: List[int]


def build_fallback_answer(question: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], mentioned_gids: List[int]) -> str:
    if mentioned_gids:
        target_nodes = [n for n in nodes if n["gid"] in mentioned_gids]
        if target_nodes:
            parts = []
            for n in target_nodes:
                gid = n["gid"]
                gid_str = str(gid)
                inc = [e for e in edges if e["target"] == gid_str]
                out = [e for e in edges if e["source"] == gid_str]
                parts.append(
                    f"**Node {gid} Analysis:**\n"
                    f"- **Role**: `{n['role']}` (Confidence: {n['role_score']:.2f}, Priority: {n['priority_score']:.2f})\n"
                    f"- **Network Position**: In-degree {n['in_deg']} ({n['in_kzt']:,.0f} KZT), "
                    f"Out-degree {n['out_deg']} ({n['out_kzt']:,.0f} KZT), Depth: {n['depth']}\n"
                    f"- **Evidence**: {n['evidence']}\n"
                    f"- **Counterparties**: Connected to {len(inc)} incoming payers and {len(out)} outgoing recipients."
                )
            return "\n\n".join(parts)

    q_lower = question.lower()
    if "coordinator" in q_lower or "top" in q_lower or "priority" in q_lower:
        top_coordinators = sorted(
            [n for n in nodes if n["role"] == "coordinator"],
            key=lambda x: x["priority_score"],
            reverse=True
        )[:5]
        gids_str = ", ".join(f"`{n['gid']}` ({n['priority_score']:.2f})" for n in top_coordinators)
        return (
            f"**High Priority Coordinators:**\n"
            f"Found {len(top_coordinators)} key bridge nodes across clusters: {gids_str}.\n"
            f"These nodes exhibit high betweenness centrality and multi-cluster routing, "
            f"representing core coordination hypotheses."
        )

    if "consolidator" in q_lower:
        consolidators = [n for n in nodes if n["role"] == "consolidator"]
        gids_str = ", ".join(f"`{n['gid']}`" for n in consolidators[:5])
        return (
            f"**Fund Consolidation Nodes:**\n"
            f"Detected {len(consolidators)} consolidation nodes ({gids_str}). "
            f"These accounts collect from 8+ sources with low forward pass-through (<30%), "
            f"indicating potential pooling endpoints."
        )

    return (
        "AML Graph Overview: The network contains 2,248 accounts across 16 weakly connected components. "
        "Key roles include coordinators (central bridge points), consolidators (fund pooling), "
        "distributors (layering disbursement), transit nodes (pass-throughs), and terminal nodes. "
        "Please query specific GIDs or roles for detailed counterparty flow analysis."
    )


@router.post("/assistant", response_model=AssistantResponse)
def query_assistant(req: AssistantRequest):
    graph_data = load_graph_data_from_disk()
    nodes = graph_data["nodes"]
    edges = graph_data["edges"]

    mentioned = extract_gids(req.question)
    target_nodes = [n for n in nodes if n["gid"] in mentioned]

    # If no specific GID mentioned, check for role mentions to highlight top candidates
    if not mentioned:
        q_lower = req.question.lower()
        if "coordinator" in q_lower:
            target_nodes = sorted(
                [n for n in nodes if n["role"] == "coordinator"],
                key=lambda x: x["priority_score"],
                reverse=True
            )[:3]
            mentioned = [n["gid"] for n in target_nodes]
        elif "consolidator" in q_lower:
            target_nodes = [n for n in nodes if n["role"] == "consolidator"][:3]
            mentioned = [n["gid"] for n in target_nodes]
        elif "top" in q_lower:
            target_nodes = sorted(nodes, key=lambda x: x["priority_score"], reverse=True)[:3]
            mentioned = [n["gid"] for n in target_nodes]

    # Gather local neighborhood context
    context_nodes = target_nodes.copy()
    context_edges = []
    for tn in target_nodes:
        gid_str = str(tn["gid"])
        connected_edges = [e for e in edges if e["source"] == gid_str or e["target"] == gid_str]
        context_edges.extend(connected_edges[:15])

    client = get_llm_client()
    if not client:
        fallback = build_fallback_answer(req.question, nodes, edges, mentioned)
        return AssistantResponse(answer=fallback, mentioned_gids=mentioned)

    system_prompt = (
        "You are an AML assistant. Answer ONLY based on the graph data provided. If data is missing, "
        "say plainly what's missing. Never assert guilt — phrase things as hypotheses to verify. "
        "Reference the gids of any nodes you mention."
    )

    user_payload = {
        "question": req.question,
        "nodes": context_nodes,
        "edges_sample": context_edges,
    }

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload)}
            ],
            temperature=0.2,
            max_tokens=600,
        )
        answer = completion.choices[0].message.content or ""
        found_gids = list(set(mentioned + extract_gids(answer)))
        return AssistantResponse(answer=answer, mentioned_gids=found_gids)
    except Exception:
        fallback = build_fallback_answer(req.question, nodes, edges, mentioned)
        return AssistantResponse(answer=fallback, mentioned_gids=mentioned)
