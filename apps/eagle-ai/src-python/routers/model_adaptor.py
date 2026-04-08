from fastapi import APIRouter

router = APIRouter(prefix="/model_adaptor", tags=["ModelAdaptor"])

@router.get("/")
async def get_status():
    return {"status": "ready"}
