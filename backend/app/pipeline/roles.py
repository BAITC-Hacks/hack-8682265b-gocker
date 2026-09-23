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
    traces = []

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
        in_cycle = getattr(r, "in_cycle", False)
        rapid_transit = getattr(r, "rapid_transit", False)
        structuring = getattr(r, "structuring_risk", False)
        turnaround = getattr(r, "turnaround_hours", np.nan)

        node_trace = []

        # 1. coordinator
        coord_matched = bw >= bw_thresh and (is_seed or cross_cl) and tot_deg >= COORDINATOR_MIN_DEGREE
        if coord_matched:
            node_trace.append({
                "rule": "coordinator",
                "matched": True,
                "reason": f"betweenness {bw:.6f} >= threshold {bw_thresh:.6f} AND (is_seed={is_seed} OR cross_cluster={cross_cl}) AND total_degree={tot_deg} >= {COORDINATOR_MIN_DEGREE}"
            })
            role = "coordinator"
            score = min(1.0, 0.5 + 0.5 * (bw / max(bw_thresh, 1e-6)))
            cycle_note = "; return cycle detected" if in_cycle else ""
            evidence = (
                f"High betweenness ({bw:.4f}) bridging {tot_deg} counterparties across clusters. "
                f"Volume: {s_in + s_out:,.0f} KZT{cycle_note}."
            )
        else:
            coord_fail = []
            if bw < bw_thresh:
                coord_fail.append(f"betweenness {bw:.6f} < threshold {bw_thresh:.6f}")
            if not (is_seed or cross_cl):
                coord_fail.append("neither seed nor cross-cluster bridge")
            if tot_deg < COORDINATOR_MIN_DEGREE:
                coord_fail.append(f"total_degree={tot_deg} < {COORDINATOR_MIN_DEGREE}")
            node_trace.append({
                "rule": "coordinator",
                "matched": False,
                "reason": " AND ".join(coord_fail) if coord_fail else "criteria not met"
            })

            # 2. consolidator
            cons_matched = in_p >= CONSOLIDATOR_MIN_IN and (pd.isna(pass_r) or pass_r < CONSOLIDATOR_MAX_PASS)
            if cons_matched:
                pass_str = f"{pass_r:.2f}" if not pd.isna(pass_r) else "None"
                node_trace.append({
                    "rule": "consolidator",
                    "matched": True,
                    "reason": f"in_partners={in_p} >= {CONSOLIDATOR_MIN_IN} AND pass_ratio={pass_str} < {CONSOLIDATOR_MAX_PASS}"
                })
                role = "consolidator"
                score = min(1.0, in_p / (CONSOLIDATOR_MIN_IN * 2))
                pass_pct = f"{pass_r * 100:.0f}%" if not pd.isna(pass_r) else "0%"
                smurf_note = "; near-threshold structuring" if structuring else ""
                evidence = (
                    f"Consolidates from {in_p} payers ({s_in:,.0f} KZT), forwards only {pass_pct} "
                    f"outward to {out_p} recipients{smurf_note}."
                )
            else:
                cons_fail = []
                if in_p < CONSOLIDATOR_MIN_IN:
                    cons_fail.append(f"in_partners={in_p} < {CONSOLIDATOR_MIN_IN}")
                if not pd.isna(pass_r) and pass_r >= CONSOLIDATOR_MAX_PASS:
                    cons_fail.append(f"pass_ratio={pass_r:.2f} >= {CONSOLIDATOR_MAX_PASS}")
                node_trace.append({
                    "rule": "consolidator",
                    "matched": False,
                    "reason": " AND ".join(cons_fail) if cons_fail else "criteria not met"
                })

                # 3. distributor
                dist_matched = out_p >= DISTRIBUTOR_MIN_OUT
                if dist_matched:
                    node_trace.append({
                        "rule": "distributor",
                        "matched": True,
                        "reason": f"out_partners={out_p} >= {DISTRIBUTOR_MIN_OUT}"
                    })
                    role = "distributor"
                    score = min(1.0, out_p / (DISTRIBUTOR_MIN_OUT * 2))
                    evidence = (
                        f"Distributes {s_out:,.0f} KZT outward to {out_p} distinct recipient accounts "
                        f"across the network."
                    )
                else:
                    node_trace.append({
                        "rule": "distributor",
                        "matched": False,
                        "reason": f"out_partners={out_p} < {DISTRIBUTOR_MIN_OUT}"
                    })

                    # 4. transit
                    transit_matched = not pd.isna(pass_r) and (TRANSIT_MIN_PASS <= pass_r <= TRANSIT_MAX_PASS) and in_p >= 1 and out_p >= 1
                    if transit_matched:
                        node_trace.append({
                            "rule": "transit",
                            "matched": True,
                            "reason": f"pass_ratio={pass_r:.2f} in [{TRANSIT_MIN_PASS}, {TRANSIT_MAX_PASS}] AND in_partners={in_p} >= 1 AND out_partners={out_p} >= 1"
                        })
                        role = "transit"
                        deviation = abs(pass_r - 1.0)
                        score = max(0.5, 1.0 - (deviation / 0.2) * 0.5)
                        rapid_str = f" Rapid turnaround ({int(turnaround)}h)." if rapid_transit and not pd.isna(turnaround) else ""
                        evidence = (
                            f"Receives from {in_p} payers ({s_in:,.0f} KZT), passes through {pass_r * 100:.0f}% "
                            f"({s_out:,.0f} KZT) to {out_p} accounts.{rapid_str}"
                        )
                    else:
                        trans_fail = []
                        if pd.isna(pass_r):
                            trans_fail.append("pass_ratio is undefined")
                        elif pass_r < TRANSIT_MIN_PASS or pass_r > TRANSIT_MAX_PASS:
                            trans_fail.append(f"pass_ratio={pass_r:.2f} outside [{TRANSIT_MIN_PASS}, {TRANSIT_MAX_PASS}]")
                        if in_p < 1 or out_p < 1:
                            trans_fail.append(f"in_partners={in_p}, out_partners={out_p} (requires >= 1 each)")
                        node_trace.append({
                            "rule": "transit",
                            "matched": False,
                            "reason": " AND ".join(trans_fail) if trans_fail else "criteria not met"
                        })

                        # 5. terminal
                        term_matched = out_p == 0
                        if term_matched:
                            trunc_note = " (hop 4 truncated boundary)" if depth >= 4 else " (depth < 4 genuine endpoint)"
                            node_trace.append({
                                "rule": "terminal",
                                "matched": True,
                                "reason": f"out_partners=0{trunc_note}"
                            })
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
                        else:
                            node_trace.append({
                                "rule": "terminal",
                                "matched": False,
                                "reason": f"out_partners={out_p} > 0"
                            })

                            # 6. peripheral
                            role = "peripheral"
                            score = 0.3
                            node_trace.append({
                                "rule": "peripheral",
                                "matched": True,
                                "reason": f"fallback default role: in_partners={in_p}, out_partners={out_p}, degree={tot_deg}"
                            })
                            evidence = (
                                f"Peripheral flow node with {tot_deg} active links ({s_in:,.0f} KZT in, "
                                f"{s_out:,.0f} KZT out)."
                            )

        roles.append(role)
        role_scores.append(round(score, 3))
        evidences.append(evidence[:200])
        traces.append(node_trace)

    df_out = df.copy()
    df_out["role"] = roles
    df_out["role_score"] = role_scores
    df_out["evidence"] = evidences
    df_out["rule_trace"] = traces

    return df_out
