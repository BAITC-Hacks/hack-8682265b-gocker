from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "money-graph-backend" in data["service"]


def test_get_graph_endpoint():
    res = client.get("/graph")
    assert res.status_code == 200
    data = res.json()

    assert "nodes" in data
    assert "edges" in data
    assert "clusters" in data
    assert "summary" in data

    assert len(data["nodes"]) == 2248
    assert len(data["edges"]) == 3119
    assert len(data["clusters"]) > 0

    # Summary validation
    summary = data["summary"]
    assert summary["total_nodes"] == 2248
    assert summary["total_edges"] == 3119
    assert summary["total_seed"] == 81


def test_get_single_node_endpoint():
    # Fetch graph first to get a valid GID
    graph_res = client.get("/graph")
    first_node = graph_res.json()["nodes"][0]
    valid_gid = first_node["gid"]

    # Existing node
    res = client.get(f"/graph/node/{valid_gid}")
    assert res.status_code == 200
    data = res.json()
    assert "node" in data
    assert data["node"]["gid"] == valid_gid
    assert "incoming_edges" in data
    assert "outgoing_edges" in data
    assert "neighbors_count" in data

    # Non-existing node should 404
    bad_res = client.get("/graph/node/999999999999999999")
    assert bad_res.status_code == 404


def test_get_top_nodes_endpoint():
    res = client.get("/graph/top")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 20
    assert "rank" in data[0]
    assert "role" in data[0]


def test_assistant_endpoint_query():
    # Test query asking about coordinators
    payload = {"question": "who are the top coordinators and bridge nodes?"}
    res = client.post("/assistant", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "answer" in data
    assert "mentioned_gids" in data
    assert isinstance(data["mentioned_gids"], list)
    assert len(data["mentioned_gids"]) > 0
    assert len(data["answer"]) > 20

    # Test query for a specific GID
    gid = data["mentioned_gids"][0]
    res_gid = client.post("/assistant", json={"question": f"Analyze node {gid} and counterparties"})
    assert res_gid.status_code == 200
    data_gid = res_gid.json()
    assert gid in data_gid["mentioned_gids"]
    assert str(gid) in data_gid["answer"]


def test_pipeline_run_endpoint():
    res = client.post("/pipeline/run", json={"enable_llm": False})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["nodes_count"] == 2248
    assert data["edges_count"] == 3119
    assert data["elapsed_seconds"] < 300.0  # Must be well under 5 minutes
