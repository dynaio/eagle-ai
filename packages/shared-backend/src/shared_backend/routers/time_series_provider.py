from fastapi import APIRouter

router = APIRouter(prefix="/time_series", tags=["TimeSeriesProvider"])

@router.get("/")
async def get_status():
    return {"status": "ready"}
