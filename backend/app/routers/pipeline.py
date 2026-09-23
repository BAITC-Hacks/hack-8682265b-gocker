from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, BackgroundTasks
from app.pipeline.run import run_pipeline
from app.routers.graph import get_data_dirs, invalidate_cache

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


class PipelineRunRequest(BaseModel):
    enable_llm: bool = False
    run_async: bool = False


@router.post("/run")
def trigger_pipeline(req: PipelineRunRequest, background_tasks: BackgroundTasks):
    raw_dir, out_dir = get_data_dirs()

    if req.run_async:
        def task():
            run_pipeline(raw_dir, out_dir, enable_llm=req.enable_llm)
            invalidate_cache()
        background_tasks.add_task(task)
        return {"status": "started_async", "message": "Pipeline execution started in background"}

    result = run_pipeline(raw_dir, out_dir, enable_llm=req.enable_llm)
    invalidate_cache()
    return result
