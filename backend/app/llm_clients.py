import os
import re
from typing import Optional, List, Dict, Any
from openai import OpenAI


def get_llm_client() -> Optional[OpenAI]:
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("NVIDIA_API_KEY")
    if not api_key:
        return None

    base_url = (
        "https://integrate.api.nvidia.com/v1"
        if os.getenv("NVIDIA_API_KEY") and not os.getenv("OPENAI_API_KEY")
        else None
    )
    return OpenAI(api_key=api_key, base_url=base_url, timeout=12.0)


def extract_gids(text: str) -> List[int]:
    matches = re.findall(r"\b\d{6,20}\b", text)
    return [int(m) for m in matches]
