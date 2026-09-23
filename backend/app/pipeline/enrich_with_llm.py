import os
import json
import logging
from typing import List, Dict, Any
import pandas as pd
from openai import OpenAI

logger = logging.getLogger(__name__)


def enrich_evidence_with_llm(
    df: pd.DataFrame,
    sample_top_n: int = 25,
    batch_size: int = 25
) -> pd.DataFrame:
    api_key = os.getenv("NVIDIA_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return df

    base_url = (
        "https://integrate.api.nvidia.com/v1"
        if os.getenv("NVIDIA_API_KEY")
        else None
    )
    model = (
        "meta/llama-3.1-70b-instruct"
        if os.getenv("NVIDIA_API_KEY")
        else "gpt-4o-mini"
    )

    try:
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=10.0)
    except Exception as e:
        logger.warning(f"Failed to initialize LLM client: {e}")
        return df

    top_indices = df.sort_values(by="priority_score", ascending=False).head(sample_top_n).index
    df_enriched = df.copy()

    records_to_enrich: List[Dict[str, Any]] = []
    for idx in top_indices:
        r = df.loc[idx]
        records_to_enrich.append({
            "gid": int(r["gid"]),
            "role": str(r["role"]),
            "in_partners": int(r["in_partners"]),
            "out_partners": int(r["out_partners"]),
            "sum_in": float(r["sum_in"]),
            "sum_out": float(r["sum_out"]),
            "pass_ratio": float(r["pass_ratio"]) if not pd.isna(r["pass_ratio"]) else None,
            "betweenness": float(r["betweenness"]),
            "is_seed": bool(r["is_seed"]),
            "original_evidence": str(r["evidence"])
        })

    system_prompt = (
        "You are an AML analyst's assistant. You are given a list of transaction-graph nodes "
        "with their metrics. Rewrite each evidence explanation as one short (under 200 characters), "
        "human-readable sentence in English. Do not add facts that aren't in the metrics. "
        "Never assert guilt — phrase things as observations about flow structure. "
        "Return strictly a JSON array of {\"gid\": int, \"evidence\": str} objects in the same order, "
        "with nothing outside the JSON."
    )

    for i in range(0, len(records_to_enrich), batch_size):
        batch = records_to_enrich[i : i + batch_size]
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(batch)}
                ],
                temperature=0.2,
                max_tokens=1000,
            )
            content = response.choices[0].message.content or ""
            content_clean = content.strip()
            if content_clean.startswith("```"):
                content_clean = content_clean.strip("`").replace("json\n", "", 1).strip()

            parsed = json.loads(content_clean)
            if isinstance(parsed, list):
                for item in parsed:
                    gid_val = item.get("gid")
                    ev_val = item.get("evidence")
                    if gid_val and ev_val:
                        match_idx = df_enriched[df_enriched["gid"] == gid_val].index
                        if len(match_idx) > 0:
                            df_enriched.loc[match_idx, "evidence"] = str(ev_val)[:200]
        except Exception as e:
            logger.warning(f"LLM evidence enrichment failed for batch: {e}. Keeping template fallback.")

    return df_enriched
