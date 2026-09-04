import os
from fastapi import APIRouter, HTTPException, Response
from backend.app.api.auth import router as auth_router
from backend.app.api.claims import router as claims_router
from backend.app.api.rates import router as rates_router
from backend.app.services.storage import storage_service

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(claims_router)
api_router.include_router(rates_router)

@api_router.get("/files/{file_path:path}")
def serve_storage_file(file_path: str):
    """Serves raw uploaded photos or rendered overlays for UI inspection."""
    if not storage_service.file_exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    file_bytes = storage_service.get_file(file_path)
    
    # Infer content type
    ext = os.path.splitext(file_path)[1].lower()
    content_type = "image/jpeg"
    if ext == ".png":
        content_type = "image/png"
    elif ext == ".json":
        content_type = "application/json"
        
    return Response(content=file_bytes, media_type=content_type)
