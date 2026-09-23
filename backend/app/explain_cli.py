import sys
import json
from pathlib import Path


def explain_gid(gid: int) -> None:
    # Resolve data path without network/server
    possible_paths = [
        Path("/data/output/nodes_role_trace.json"),
        Path(__file__).resolve().parent.parent.parent / "data" / "output" / "nodes_role_trace.json",
        Path("data/output/nodes_role_trace.json"),
    ]

    trace_file = None
    for p in possible_paths:
        if p.exists():
            trace_file = p
            break

    if not trace_file:
        print(f"Error: Trace dataset 'nodes_role_trace.json' not found. Please run pipeline first.")
        sys.exit(1)

    with open(trace_file) as f:
        traces = json.load(f)

    gid_str = str(gid)
    if gid_str not in traces:
        print(f"Error: GID {gid} not found in evaluated accounts dataset.")
        sys.exit(1)

    data = traces[gid_str]
    final_role = data.get("final_role", "unknown")
    role_score = data.get("role_score", 0.0)
    priority_score = data.get("priority_score", 0.0)
    rule_trace = data.get("rule_trace", [])

    print("=" * 68)
    print(f"  FREEDOM BANK AML — INSTANT RULE EXPLANATION FOR GID {gid}")
    print("=" * 68)
    print(f"Final Assigned Role : {final_role.upper()}")
    print(f"Role Confidence     : {role_score:.3f}")
    print(f"Priority Risk Score : {priority_score:.4f}")
    print("-" * 68)
    print("Sequential Rule Evaluation Hierarchy (First Match Wins):")

    for idx, step in enumerate(rule_trace, 1):
        rule_name = step.get("rule", "").upper()
        matched = step.get("matched", False)
        reason = step.get("reason", "")
        status_tag = "[MATCHED - ASSIGNED]" if matched else "[NO MATCH]"
        print(f" {idx}. {status_tag:<21} Rule: {rule_name}")
        print(f"    Reason: {reason}")

    print("=" * 68)
    print("Summary for Oral Jury Presentation (< 30 seconds):")
    matched_step = next((s for s in rule_trace if s.get("matched")), None)
    if matched_step:
        print(f"\"Account {gid} is classified as {final_role.upper()} because {matched_step.get('reason')}.\"")
    print("=" * 68)


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.explain_cli <GID>")
        sys.exit(1)

    try:
        gid = int(sys.argv[1].strip())
    except ValueError:
        print(f"Error: Invalid GID '{sys.argv[1]}'. Must be an integer.")
        sys.exit(1)

    explain_gid(gid)


if __name__ == "__main__":
    main()
