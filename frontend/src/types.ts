export interface PhotoItem {
  photo_id: string;
  s3_key: string;
  overlay_s3_key?: string;
  blur_score?: number;
  phash?: string;
  exif_data?: {
    has_exif?: boolean;
    capture_datetime?: string;
    has_gps?: boolean;
    gps_soft_signal?: boolean;
    suspicious_timestamp?: boolean;
    timestamp_reason?: string;
  };
}

export interface LineItem {
  line_id?: string;
  part_name: string;
  damage_type: string;
  severity_band: 'MINOR' | 'MODERATE' | 'SEVERE' | string;
  decision: 'REPAIR' | 'REPLACE' | string;
  base_cost: number;
  labor_hrs: number;
  labor_cost: number;
  line_total: number;
  part_confidence: number;
  damage_confidence: number;
  is_structural_part: boolean;
  rate_row_found: boolean;
  unattributed: boolean;
}

export interface OverrideRecord {
  override_id: string;
  surveyor_id: string;
  previous_assessment: any;
  override_data: any;
  reason: string;
  created_at?: string;
}

export interface Claim {
  claim_id: string;
  policy_id: string;
  incident_date_time?: string;
  incident_location_lat?: number;
  incident_location_lng?: number;
  incident_description?: string;
  vehicle_reg_no: string;
  vehicle_tier: string;
  status: 'SUBMITTED' | 'PROCESSING' | 'ASSESSED' | 'SURVEYOR_REVIEWED' | 'APPROVED' | 'REJECTED' | string;
  ai_assessment_jsonb?: any;
  subtotal: number;
  deductible: number;
  payable_amount: number;
  decision?: 'AUTO_APPROVED' | 'SURVEYOR_REVIEW' | 'APPROVED' | 'REJECTED' | string;
  decision_reasons?: string[];
  fraud_score: number;
  photo_validation_passed: boolean;
  created_at?: string;
  updated_at?: string;
  photos: PhotoItem[];
  line_items: LineItem[];
  overrides: OverrideRecord[];
}

export interface PartPricingOption {
  type: string;
  part_number: string;
  brand: string;
  part_cost: number;
  labor_cost: number;
  total_cost: number;
  savings?: number;
  warranty: string;
  availability: string;
  description: string;
}

export interface PartPricingResponse {
  part_code: string;
  part_label: string;
  vehicle_tier: string;
  is_structural: boolean;
  criticality: number;
  labor_hours: number;
  labor_rate_hr: number;
  labor_cost: number;
  options: {
    oem: PartPricingOption;
    aftermarket: PartPricingOption;
    recycled: PartPricingOption;
  };
}
