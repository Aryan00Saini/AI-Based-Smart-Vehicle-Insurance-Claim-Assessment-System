"""
Admin dashboard views, powered by sqladmin (https://aminalaee.dev/sqladmin/).

Mounted at /admin on the main FastAPI app — gives a full browse/search/edit/
delete UI over every table, generated directly from the existing SQLAlchemy
models in db/models.py. No ORM change, no schema duplication.

NOTE: This panel has no authentication in front of it yet. Do not expose
/admin publicly until it's wired to the existing auth system (see
backend/app/api/auth.py) — for local dev and viva demos on localhost this
is fine, but for a real deployment, gate this behind login first.
"""
from sqladmin import ModelView
from backend.app.db.models import (
    VehicleTier, PartCatalog, RateMatrix, Policy,
    Claim, ClaimPhoto, ClaimLineItem, ClaimOverride,
    PhotoHashStore, User
)


class VehicleTierAdmin(ModelView, model=VehicleTier):
    column_list = [VehicleTier.tier_id, VehicleTier.tier_name, VehicleTier.labor_rate_hr]
    name_plural = "Vehicle Tiers"
    icon = "fa-solid fa-car"


class PartCatalogAdmin(ModelView, model=PartCatalog):
    column_list = [
        PartCatalog.part_id, PartCatalog.part_code, PartCatalog.part_label,
        PartCatalog.is_structural, PartCatalog.criticality
    ]
    column_searchable_list = [PartCatalog.part_code, PartCatalog.part_label]
    name_plural = "Part Catalog"
    icon = "fa-solid fa-car-side"


class RateMatrixAdmin(ModelView, model=RateMatrix):
    column_list = [
        RateMatrix.rate_id, RateMatrix.tier_id, RateMatrix.part_id,
        RateMatrix.damage_type, RateMatrix.severity_band,
        RateMatrix.repair_cost_base, RateMatrix.replace_cost_base
    ]
    column_searchable_list = [RateMatrix.damage_type, RateMatrix.severity_band]
    name_plural = "Rate Matrix"
    icon = "fa-solid fa-table"


class PolicyAdmin(ModelView, model=Policy):
    column_list = [
        Policy.policy_id, Policy.policyholder_name, Policy.vehicle_reg_no,
        Policy.vehicle_tier, Policy.deductible, Policy.active
    ]
    column_searchable_list = [Policy.policy_id, Policy.policyholder_name, Policy.vehicle_reg_no]
    name_plural = "Policies"
    icon = "fa-solid fa-file-contract"


class ClaimAdmin(ModelView, model=Claim):
    column_list = [
        Claim.claim_id, Claim.policy_id, Claim.vehicle_reg_no, Claim.status,
        Claim.decision, Claim.payable_amount, Claim.fraud_score, Claim.created_at
    ]
    column_searchable_list = [Claim.claim_id, Claim.policy_id, Claim.vehicle_reg_no]
    column_sortable_list = [Claim.created_at, Claim.payable_amount, Claim.status]
    column_default_sort = [(Claim.created_at, True)]
    name_plural = "Claims"
    icon = "fa-solid fa-clipboard-list"


class ClaimPhotoAdmin(ModelView, model=ClaimPhoto):
    column_list = [
        ClaimPhoto.photo_id, ClaimPhoto.claim_id, ClaimPhoto.blur_score,
        ClaimPhoto.phash, ClaimPhoto.created_at
    ]
    column_searchable_list = [ClaimPhoto.claim_id]
    name_plural = "Claim Photos"
    icon = "fa-solid fa-image"


class ClaimLineItemAdmin(ModelView, model=ClaimLineItem):
    column_list = [
        ClaimLineItem.line_id, ClaimLineItem.claim_id, ClaimLineItem.part_name,
        ClaimLineItem.damage_type, ClaimLineItem.severity_band,
        ClaimLineItem.decision, ClaimLineItem.line_total
    ]
    column_searchable_list = [ClaimLineItem.claim_id, ClaimLineItem.part_name]
    name_plural = "Claim Line Items"
    icon = "fa-solid fa-list"


class ClaimOverrideAdmin(ModelView, model=ClaimOverride):
    column_list = [
        ClaimOverride.override_id, ClaimOverride.claim_id,
        ClaimOverride.surveyor_id, ClaimOverride.reason, ClaimOverride.created_at
    ]
    column_searchable_list = [ClaimOverride.claim_id, ClaimOverride.surveyor_id]
    name_plural = "Surveyor Overrides"
    icon = "fa-solid fa-user-check"


class PhotoHashStoreAdmin(ModelView, model=PhotoHashStore):
    column_list = [
        PhotoHashStore.hash_id, PhotoHashStore.phash,
        PhotoHashStore.claim_id, PhotoHashStore.policy_id
    ]
    name_plural = "Photo Hash Store"
    icon = "fa-solid fa-fingerprint"


class UserAdmin(ModelView, model=User):
    column_list = [User.user_id, User.username, User.role, User.full_name]
    column_searchable_list = [User.username]
    # Never expose the hashed password column in list/detail views
    form_excluded_columns = [User.hashed_password]
    name_plural = "Users"
    icon = "fa-solid fa-users"


ALL_ADMIN_VIEWS = [
    ClaimAdmin, ClaimLineItemAdmin, ClaimPhotoAdmin, ClaimOverrideAdmin,
    PolicyAdmin, VehicleTierAdmin, PartCatalogAdmin, RateMatrixAdmin,
    PhotoHashStoreAdmin, UserAdmin,
]
