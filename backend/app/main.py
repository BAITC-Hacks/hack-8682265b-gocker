from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.graph import router as graph_router, load_graph_data_from_disk
from app.routers.pipeline import router as pipeline_router
from app.routers.assistant import router as assistant_router
from app.routers.upload import router as upload_router
from app.routers.reviews import router as reviews_router
from app.routers.explain import router as explain_router
from app.routers.sensitivity import router as sensitivity_router
from app.routers.completeness import router as completeness_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm graph cache on startup
    try:
        load_graph_data_from_disk()
    except Exception as e:
        print(f"Warning: Failed to pre-warm graph cache: {e}")
    yield


app = FastAPI(
    title="Money Graph AML Backend",
    version="1.0.0",
    description="Backend service for AML financial transaction graph analysis",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(graph_router)
app.include_router(pipeline_router)
app.include_router(assistant_router)
app.include_router(upload_router)
app.include_router(reviews_router)
app.include_router(explain_router)
app.include_router(sensitivity_router)
app.include_router(completeness_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "money-graph-backend"}
