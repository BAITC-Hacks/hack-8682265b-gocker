import numpy as np
import pandas as pd


def min_max_norm(series: pd.Series) -> pd.Series:
    s_min = series.min()
    s_max = series.max()
    if s_max == s_min:
        return pd.Series(0.0, index=series.index)
    return (series - s_min) / (s_max - s_min)


def compute_priority_scores(df: pd.DataFrame) -> pd.DataFrame:
    norm_bw = min_max_norm(df["betweenness"])
    norm_pr = min_max_norm(df["pagerank"])
    norm_in = min_max_norm(df["in_partners"])
    norm_out = min_max_norm(df["out_partners"])
    seed_flag = df["is_seed"].astype(int)

    base_score = (
        0.35 * norm_bw +
        0.25 * norm_pr +
        0.20 * norm_in +
        0.10 * norm_out +
        0.10 * seed_flag
    )

    priority = base_score.copy()
    high_priority_mask = df["role"].isin(["coordinator", "consolidator"])
    priority.loc[high_priority_mask] = priority.loc[high_priority_mask] * 1.15

    df_out = df.copy()
    df_out["priority_score"] = np.clip(priority, 0.0, 1.0).round(4)

    return df_out
