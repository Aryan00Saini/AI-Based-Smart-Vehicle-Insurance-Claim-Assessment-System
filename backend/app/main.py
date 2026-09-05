import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin
from backend.app.core.config import settings
from backend.app.db.database import init_db, engine
from backend.app.db.seed import seed_database
from backend.app.api.router import api_router
from backend.app.admin import ALL_ADMIN_VIEWS

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
# Local dev defaults to "*" (all origins). In production, set CORS_ALLOWED_ORIGINS
# in .env to your deployed frontend's exact URL for security.
_cors_origins = (
    ["*"] if settings.CORS_ALLOWED_ORIGINS == "*"
    else [o.strip() for o in settings.CORS_ALLOWED_ORIGINS.split(",")]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=settings.CORS_ALLOWED_ORIGINS != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Admin dashboard (browse/search/edit all tables) — mounted at /admin
# See backend/app/admin.py for the auth-before-public-deploy note.
admin = Admin(app, engine, title=f"{settings.PROJECT_NAME} — Admin")
for view in ALL_ADMIN_VIEWS:
    admin.add_view(view)

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
