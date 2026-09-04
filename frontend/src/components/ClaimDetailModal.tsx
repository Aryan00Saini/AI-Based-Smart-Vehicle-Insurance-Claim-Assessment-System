import React, { useState } from 'react';
import { X, CheckCircle, XCircle, Edit3, ShieldAlert, History, UserCheck } from 'lucide-react';
import { Claim, LineItem } from '../types';
import { CanvasAnnotator } from './CanvasAnnotator';
import { CostBreakdownTable } from './CostBreakdownTable';
import { DecisionAuditCard } from './DecisionAuditCard';
import { FraudInspectionCard } from './FraudInspectionCard';
import { recordOverride, finalizeDecision } from '../services/api';

interface ClaimDetailModalProps {
  claim: Claim;
  onClose: () => void;
  onRefresh: () => void;
}

export const ClaimDetailModal: React.FC<ClaimDetailModalProps> = ({ claim, onClose, onRefresh }) => {
  const [editableLineItems, setEditableLineItems] = useState<LineItem[]>(claim.line_items || []);
  const [overrideReason, setOverrideReason] = useState('');
  const [surveyorId, setSurveyorId] = useState('surveyor1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleLineItemChange = (index: number, updatedItem: LineItem) => {
    const updated = [...editableLineItems];
    updated[index] = updatedItem;
    setEditableLineItems(updated);
  };

  const calculatedSubtotal = editableLineItems.reduce((acc, item) => acc + Number(item.line_total || 0), 0);
  const calculatedPayable = Math.max(0, calculatedSubtotal - Number(claim.deductible || 1000));

  const handleSaveOverride = async () => {
    if (!overrideReason.trim()) {
      alert('Please provide a justification for this override.');
      return;
    }
    setIsSubmitting(true);
    try {
      await recordOverride(
        claim.claim_id,
        surveyorId,
        overrideReason,
        editableLineItems,
        'SURVEYOR_REVIEWED'
      );
      setStatusMessage('Override recorded successfully with full audit trail.');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to record override');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalDecision = async (action: 'APPROVED' | 'REJECTED') => {
    const remarks = prompt(`Enter surveyor remarks for finalizing claim as ${action}:`);
    if (remarks === null) return;
    setIsSubmitting(true);
    try {
      await finalizeDecision(claim.claim_id, surveyorId, action, remarks);
      setStatusMessage(`Claim successfully finalized to ${action}.`);
      onRefresh();
      setTimeout(onClose, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to finalize decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-white tracking-tight">Claim Inspection & Audit</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-700 text-slate-200">
                {claim.claim_id.slice(0, 13)}...
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                claim.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                claim.status === 'REJECTED' ? 'bg-red-500/20 text-red-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {claim.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Policy: <span className="text-slate-300 font-semibold">{claim.policy_id}</span> | Vehicle: <span className="text-slate-300 font-semibold">{claim.vehicle_reg_no} ({claim.vehicle_tier})</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {statusMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Top Section: Photo Canvas & Decision Engine side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <CanvasAnnotator photos={claim.photos} />
              <FraudInspectionCard claim={claim} />
            </div>

            <div className="lg:col-span-6 space-y-4">
              <DecisionAuditCard claim={claim} />
              <CostBreakdownTable
                lineItems={editableLineItems}
                subtotal={calculatedSubtotal}
                deductible={claim.deductible}
                payableAmount={calculatedPayable}
                vehicleTier={claim.vehicle_tier}
                editable={claim.status !== 'APPROVED' && claim.status !== 'REJECTED'}
                onLineItemChange={handleLineItemChange}
                onApplyPricingNote={(note) => {
                  setOverrideReason((prev) => prev ? `${prev} | ${note}` : note);
                }}
              />
            </div>
          </div>

          {/* Surveyor Override Section */}
          {claim.status !== 'APPROVED' && claim.status !== 'REJECTED' && (
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 shadow-lg space-y-4">
              <div className="flex items-center space-x-2 text-white font-semibold text-sm">
                <Edit3 className="w-4 h-4 text-blue-400" />
                <span>Human-in-the-Loop Override Panel</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="text-xs text-slate-400 block mb-1">Surveyor ID</label>
                  <input
                    type="text"
                    value={surveyorId}
                    onChange={(e) => setSurveyorId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Audit Justification & Notes</label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Enter reason for price, part, or severity adjustment..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleSaveOverride}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Save Override & Recalculate</span>
                </button>
                <button
                  onClick={() => handleFinalDecision('APPROVED')}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Formally Approve Claim</span>
                </button>
                <button
                  onClick={() => handleFinalDecision('REJECTED')}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Claim</span>
                </button>
              </div>
            </div>
          )}

          {/* Audit Trail History */}
          {claim.overrides && claim.overrides.length > 0 && (
            <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 shadow-lg">
              <div className="flex items-center space-x-2 text-white font-semibold text-sm mb-3">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Auditable Override History</span>
              </div>
              <div className="space-y-2 text-xs">
                {claim.overrides.map((o, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold text-white">{o.surveyor_id}</span>
                        <span className="text-slate-500 text-[11px]">{o.created_at || 'Recently'}</span>
                      </div>
                      <p className="text-slate-300 mt-1">{o.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
