import { Claim, PartPricingResponse } from '../types';

// In dev, Vite's proxy (see vite.config.ts) forwards '/api' to localhost:8000, so
// the relative path works with no env var needed. In production (frontend and
// backend deployed separately), set VITE_API_BASE_URL to the backend's full URL,
// e.g. VITE_API_BASE_URL=https://your-api.onrender.com
const API_BASE = `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1`;

export async function fetchClaims(statusFilter?: string): Promise<Claim[]> {
  const url = statusFilter ? `${API_BASE}/claims/?status_filter=${statusFilter}` : `${API_BASE}/claims/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch claims');
  return res.json();
}

export async function fetchClaimDetail(claimId: string): Promise<Claim> {
  const res = await fetch(`${API_BASE}/claims/${claimId}`);
  if (!res.ok) throw new Error('Failed to fetch claim detail');
  return res.json();
}

export async function submitClaimMultipart(formData: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/submit-multipart`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Submission failed' }));
    throw new Error(err.detail || 'Submission failed');
  }
  return res.json();
}

export async function submitClaimJson(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to submit claim');
  return res.json();
}

export async function recordOverride(
  claimId: string,
  surveyorId: string,
  reason: string,
  updatedLineItems: any[],
  decision?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surveyor_id: surveyorId,
      reason,
      updated_line_items: updatedLineItems,
      decision,
    }),
  });
  if (!res.ok) throw new Error('Failed to save override');
  return res.json();
}

export async function finalizeDecision(
  claimId: string,
  surveyorId: string,
  action: 'APPROVED' | 'REJECTED',
  remarks: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surveyor_id: surveyorId,
      action,
      remarks,
    }),
  });
  if (!res.ok) throw new Error('Failed to finalize decision');
  return res.json();
}

export function getStorageFileUrl(key?: string): string {
  if (!key) return '';
  return `${API_BASE}/files/${key}`;
}

export async function fetchPartPricing(partCode: string, tierName: string): Promise<PartPricingResponse> {
  const url = `${API_BASE}/rates/part-pricing?part_code=${encodeURIComponent(partCode)}&tier_name=${encodeURIComponent(tierName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch part pricing' }));
    throw new Error(err.detail || 'Failed to fetch part pricing');
  }
  return res.json();
}
