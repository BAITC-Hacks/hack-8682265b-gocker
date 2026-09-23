import pandas as pd
import numpy as np


VALID_ROLES = {"coordinator", "consolidator", "distributor", "transit", "terminal", "peripheral"}
FORBIDDEN_GUILT_TERMS = ["guilty", "criminal", "is laundering", "convicted", "money launderer", "perpetrator"]


def test_role_assignment_coverage_and_dictionary(full_processed_nodes):
    df = full_processed_nodes

    assert len(df) == 2248
    assigned_roles = set(df["role"].unique())

    # Must only contain roles from the specified role dictionary
    assert assigned_roles.issubset(VALID_ROLES)
    # Ensure key operational roles are identified
    for expected_role in ["coordinator", "consolidator", "distributor", "transit", "terminal", "peripheral"]:
        assert expected_role in assigned_roles, f"Role '{expected_role}' had 0 assigned nodes"


def test_role_scores_and_evidence(full_processed_nodes):
    df = full_processed_nodes

    # Role scores must be bounded in [0.0, 1.0]
    assert (df["role_score"] >= 0.0).all()
    assert (df["role_score"] <= 1.0).all()

    # Evidence constraints: non-empty, string, maximum 200 characters
    assert df["evidence"].notna().all()
    evidence_lens = df["evidence"].str.len()
    assert (evidence_lens > 0).all()
    assert (evidence_lens <= 200).all(), f"Max evidence length exceeded: {evidence_lens.max()}"

    # Factual compliance: zero guilt assertions
    for ev in df["evidence"]:
        ev_lower = ev.lower()
        for term in FORBIDDEN_GUILT_TERMS:
            assert term not in ev_lower, f"Forbidden guilt assertion '{term}' found in evidence: {ev}"


def test_hop4_cutoff_terminal_handling(full_processed_nodes):
    df = full_processed_nodes

    # The 444 depth=4 cutoff artifact nodes
    hop4_sinks = df[(df["depth"] == 4) & (df["out_partners"] == 0)]
    assert len(hop4_sinks) == 444

    # All must have role 'terminal'
    assert (hop4_sinks["role"] == "terminal").all()
    assert (hop4_sinks["truncated_by_depth"] == True).all()

    # All must contain explicit hop 4 truncation cautionary text
    assert hop4_sinks["evidence"].str.contains("hop 4 truncated", case=False).all()

    # Genuine endpoints (depth < 4 and out_partners == 0 and in_partners < 8)
    # Note: nodes with in_partners >= 8 match Rule 2 (consolidator) higher in precedence
    genuine_sinks = df[(df["depth"] < 4) & (df["out_partners"] == 0) & (df["in_partners"] < 8)]
    assert (genuine_sinks["role"] == "terminal").all()
    assert (genuine_sinks["truncated_by_depth"] == False).all()
    assert genuine_sinks["evidence"].str.contains("Genuine endpoint", case=False).all()

    # Consolidators with 0 outgoing (depth < 4 and out_partners == 0 and in_partners >= 8)
    zero_out_consolidators = df[(df["depth"] < 4) & (df["out_partners"] == 0) & (df["in_partners"] >= 8)]
    if len(zero_out_consolidators) > 0:
        assert (zero_out_consolidators["role"] == "consolidator").all()


def test_priority_scores_and_multipliers(full_processed_nodes):
    df = full_processed_nodes

    assert "priority_score" in df.columns
    assert (df["priority_score"] >= 0.0).all()
    assert (df["priority_score"] <= 1.0).all()

    # Coordinators and Consolidators should rank high on average
    coord_mean = df[df["role"] == "coordinator"]["priority_score"].mean()
    periph_mean = df[df["role"] == "peripheral"]["priority_score"].mean()
    assert coord_mean > periph_mean, "Coordinators should have higher average priority than peripheral nodes"

    # Highest priority nodes should include coordinators
    top_5 = df.sort_values(by="priority_score", ascending=False).head(5)
    assert "coordinator" in top_5["role"].values
