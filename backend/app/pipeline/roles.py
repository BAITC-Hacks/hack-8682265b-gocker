import numpy as np
import pandas as pd

COORDINATOR_MIN_DEGREE = 5
CONSOLIDATOR_MIN_IN = 8
CONSOLIDATOR_MAX_PASS = 0.3
DISTRIBUTOR_MIN_OUT = 15
TRANSIT_MIN_PASS = 0.8
TRANSIT_MAX_PASS = 1.2


def assign_roles(df: pd.DataFrame) -> pd.DataFrame:
    bw_thresh = float(np.percentile(df["betweenness"], 95))

    roles = []
    role_scores = []
    evidences = []

    for r in df.itertuples():
        in_p = int(r.in_partners)
        out_p = int(r.out_partners)
        tot_deg = in_p + out_p
        pass_r = r.pass_ratio
        bw = float(r.betweenness)
        depth = int(r.depth)
        is_seed = bool(r.is_seed)
        cross_cl = bool(r.cross_cluster)
        s_in = float(r.sum_in)
        s_out = float(r.sum_out)

        # 1. coordinator
        if bw >= bw_thresh and (is_seed or cross_cl) and tot_deg >= COORDINATOR_MIN_DEGREE:
            role = "coordinator"
            score = min(1.0, 0.5 + 0.5 * (bw / max(bw_thresh, 1e-6)))
            evidence = (
                f"High betweenness ({bw:.4f}) bridging {tot_deg} counterparties across clusters. "
                f"Volume: {s_in + s_out:,.0f} KZT."
            )

        # 2. consolidator
        elif in_p >= CONSOLIDATOR_MIN_IN and (pd.isna(pass_r) or pass_r < CONSOLIDATOR_MAX_PASS):
            role = "consolidator"
            score = min(1.0, in_p / (CONSOLIDATOR_MIN_IN * 2))
            pass_pct = f"{pass_r * 100:.0f}%" if not pd.isna(pass_r) else "0%"
            evidence = (
                f"Consolidates from {in_p} payers ({s_in:,.0f} KZT), forwards only {pass_pct} "
                f"outward to {out_p} recipients."
            )

        # 3. distributor
        elif out_p >= DISTRIBUTOR_MIN_OUT:
            role = "distributor"
            score = min(1.0, out_p / (DISTRIBUTOR_MIN_OUT * 2))
            evidence = (
                f"Distributes {s_out:,.0f} KZT outward to {out_p} distinct recipient accounts "
                f"across the network."
            )

        # 4. transit
        elif not pd.isna(pass_r) and (TRANSIT_MIN_PASS <= pass_r <= TRANSIT_MAX_PASS) and in_p >= 1 and out_p >= 1:
            role = "transit"
            deviation = abs(pass_r - 1.0)
            score = max(0.5, 1.0 - (deviation / 0.2) * 0.5)
            evidence = (
                f"Receives from {in_p} payers ({s_in:,.0f} KZT), passes through {pass_r * 100:.0f}% "
                f"({s_out:,.0f} KZT) to {out_p} accounts."
            )

        # 5. terminal
        elif out_p == 0:
            role = "terminal"
            if depth < 4:
                score = min(1.0, max(0.5, in_p / 3.0))
                evidence = (
                    f"Genuine endpoint (depth {depth}): received {s_in:,.0f} KZT from {in_p} payers "
                    f"with 0 outgoing transfers."
                )
            else:
                score = min(1.0, max(0.3, (in_p / 3.0) * 0.6))
                evidence = (
                    f"Possible final recipient (hop 4 truncated): received {s_in:,.0f} KZT from {in_p} "
                    f"payers; chain stopped, needs follow-up."
                )

        # 6. peripheral
        else:
            role = "peripheral"
            score = 0.3
            evidence = (
                f"Peripheral flow node with {tot_deg} active links ({s_in:,.0f} KZT in, "
                f"{s_out:,.0f} KZT out)."
            )

        roles.append(role)
        role_scores.append(round(score, 3))
        evidences.append(evidence[:200])

    df_out = df.copy()
    df_out["role"] = roles
    df_out["role_score"] = role_scores
    df_out["evidence"] = evidences

    return df_out
