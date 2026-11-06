from fastapi import APIRouter

from app.modules.visualizer import service
from app.modules.visualizer.schemas import AlgorithmListOut, TraceIn, TraceOut

router = APIRouter(prefix="/visualizer", tags=["visualizer"])


@router.get("/algorithms", response_model=AlgorithmListOut, summary="Algorithms you can visualize")
async def list_algorithms() -> AlgorithmListOut:
    return AlgorithmListOut(items=service.list_algorithms())


@router.post("/{algorithm}/trace", response_model=TraceOut, summary="Run an algorithm step by step")
def trace(algorithm: str, body: TraceIn) -> TraceOut:
    # Plain `def`: FastAPI runs it in a worker thread, so CPU work never blocks the event loop.
    return service.trace(algorithm, body.input)
