from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import User
from backend.app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from backend.app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "policyholder" # policyholder, surveyor, admin
    full_name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str
    full_name: str

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    username: str = payload.get("sub")
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    token = create_access_token(subject=user.username, role=user.role)
    return TokenResponse(
        access_token=token,
        username=user.username,
        role=user.role,
        full_name=user.full_name
    )

@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter_by(username=request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed = get_password_hash(request.password)
    new_user = User(
        username=request.username,
        hashed_password=hashed,
        role=request.role,
        full_name=request.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token(subject=new_user.username, role=new_user.role)
    return TokenResponse(
        access_token=token,
        username=new_user.username,
        role=new_user.role,
        full_name=new_user.full_name
    )

@router.get("/me")
def me(user: Optional[User] = Depends(get_current_user)):
    if not user:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name
    }
