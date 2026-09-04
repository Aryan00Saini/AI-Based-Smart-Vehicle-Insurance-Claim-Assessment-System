import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.db.database import init_db
from backend.app.db.seed import seed_database
from backend.app.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is initialized and seeded
    print("[Main] Initializing database schema...")
    init_db()
    try:
        seed_database()
    except Exception as e:
        print(f"[Main] Seed database notice: {e}")
    yield
    # Shutdown
    print("[Main] Server shutting down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-Based Smart Vehicle Insurance Claim Assessment System API",
    lifespan=lifespan
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
