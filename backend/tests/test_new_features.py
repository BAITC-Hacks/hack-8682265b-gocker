import sys
import subprocess
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_case_reviews_crud():
    test_gid = 100000000343175100

    # 1. Update to escalated with note
    res = client.post(f"/reviews/{test_gid}", json={"status": "escalated", "note": "High priority bridge coordinator"})
    assert res.status_code == 200
    data = res.json()
    assert data["gid"] == test_gid
    assert data["status"] == "escalated"
    assert "High priority bridge" in data["note"]

    # 2. Verify in list
    list_res = client.get("/reviews")
    assert list_res.status_code == 200
    reviews = list_res.json()
    assert any(r["gid"] == test_gid and r["status"] == "escalated" for r in reviews)

    # 3. Update to cleared
    clear_res = client.post(f"/reviews/{test_gid}", json={"status": "cleared", "note": "Reviewed by compliance"})
    assert clear_res.status_code == 200
    assert clear_res.json()["status"] == "cleared"

    # 4. Invalid status should return 400
    bad_res = client.post(f"/reviews/{test_gid}", json={"status": "invalid_status"})
    assert bad_res.status_code == 400


def test_reviews_export_pdf():
    # Escalate at least one account first
    client.post("/reviews/100000000343175100", json={"status": "escalated", "note": "Escalated for law enforcement"})

    res = client.get("/reviews/export")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in res.headers.get("content-disposition", "")

    # Valid PDF magic bytes
    assert res.content.startswith(b"%PDF")
    assert len(res.content) > 1000


def test_explain_endpoint():
    test_gid = 100000000343175100
    res = client.get(f"/explain/{test_gid}")
    assert res.status_code == 200
    data = res.json()

    assert data["gid"] == test_gid
    assert "final_role" in data
    assert "rule_trace" in data
    assert isinstance(data["rule_trace"], list)
    assert len(data["rule_trace"]) >= 1

    # Final trace step must be matched
    matched_step = [s for s in data["rule_trace"] if s["matched"]]
    assert len(matched_step) == 1
    assert matched_step[0]["rule"] == data["final_role"]
    assert "reason" in matched_step[0]


def test_explain_cli():
    import os
    from pathlib import Path
    backend_dir = Path(__file__).resolve().parent.parent
    test_gid = "100000000343175100"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)

    proc = subprocess.run(
        [sys.executable, "-m", "app.explain_cli", test_gid],
        capture_output=True,
        text=True,
        env=env,
        cwd=str(backend_dir)
    )
    assert proc.returncode == 0
    stdout = proc.stdout

    assert "FREEDOM BANK AML — INSTANT RULE EXPLANATION" in stdout
    assert test_gid in stdout
    assert "Final Assigned Role" in stdout
    assert "Sequential Rule Evaluation Hierarchy" in stdout
    assert "Summary for Oral Jury Presentation" in stdout


def test_sensitivity_endpoint_and_schema():
    res = client.get("/sensitivity")
    assert res.status_code == 200
    data = res.json()

    for role in ["consolidator", "coordinator", "distributor", "transit"]:
        assert role in data, f"Role '{role}' missing from sensitivity.json"
        item = data[role]
        assert "threshold_field" in item
        assert "base" in item
        assert "variants" in item
        assert isinstance(item["variants"], list)
        assert len(item["variants"]) == 5
        assert "commentary" in item
        assert len(item["commentary"]) > 20


def test_data_gaps_endpoint_and_schema():
    res = client.get("/data-gaps")
    assert res.status_code == 200
    data = res.json()

    assert isinstance(data, list)
    assert len(data) == 4

    categories = [g["category"] for g in data]
    assert "Seed Account Lineage" in categories
    assert "Graph Traversal Boundary" in categories
    assert "Peripheral Component Isolation" in categories
    assert "Sub-Threshold Cutoff Masking" in categories

    for gap in data:
        assert gap["affected_count"] > 0
        assert len(gap["finding"]) > 10
        assert len(gap["recommended_request"]) > 20
