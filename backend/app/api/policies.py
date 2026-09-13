from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import Policy

router = APIRouter(prefix="/policies", tags=["Policies"])

class ActivePolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    policy_id: str
    policyholder_name: str
    vehicle_reg_no: str
    vehicle_tier: str

@router.get("", response_model=List[ActivePolicyResponse])
def get_active_policies(db: Session = Depends(get_db)):
    """
    Returns active policies only (active == True) as a JSON list of objects:
    policy_id, policyholder_name, vehicle_reg_no, vehicle_tier.
    """
    policies = db.query(Policy).filter(Policy.active == True).all()
    return [
        {
            "policy_id": p.policy_id,
            "policyholder_name": p.policyholder_name,
            "vehicle_reg_no": p.vehicle_reg_no,
            "vehicle_tier": p.vehicle_tier,
        }
        for p in policies
    ]
