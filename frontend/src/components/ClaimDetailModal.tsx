import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  Edit3,
  History,
  UserCheck,
  Check,
  AlertTriangle,
  Shield,
  Camera,
  Cpu,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { Claim, LineItem } from '../types';
import { CanvasAnnotator } from './CanvasAnnotator';
import { CostBreakdownTable } from './CostBreakdownTable';
import { DecisionAuditCard } from './DecisionAuditCard';
import { FraudInspectionCard } from './FraudInspectionCard';
import { ConfirmModal, ConfirmModalProps } from './ConfirmModal';
import { recordOverride, finalizeDecision } from '../services/api';

interface ClaimDetailModalProps {
  claim: Claim;
  onClose: () => void;
  onRefresh: () => void;
}

type ModalTab = 'photos' | 'decision' | 'cost' | 'fraud' | 'history';

export const ClaimDetailModal: React.FC<ClaimDetailModalProps> = ({ claim, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('photos');
  const [editableLineItems, setEditableLineItems] = useState<LineItem[]>(claim.line_items || []);
  const [overrideReason, setOverrideReason] = useState('');
  const [surveyorId, setSurveyorId] = useState('SURVEYOR-IN-409');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // In-app modal state for replacing alert() and prompt()
  const [modalConfig, setModalConfig] = useState<ConfirmModalProps | null>(null);

  const handleLineItemChange = (index: number, updatedItem: LineItem) => {
    const updated = [...editableLineItems];
    updated[index] = updatedItem;
    setEditableLineItems(updated);
  };

  const calculatedSubtotal = editableLineItems.reduce((acc, item) => acc + Number(item.line_total || 0), 0);
  const calculatedPayable = Math.max(0, calculatedSubtotal - Number(claim.deductible || 1000));

  const handleSaveOverride = async () => {
    if (!overrideReason.trim()) {
      setModalConfig({
        isOpen: true,
        title: 'Justification Required',
        message: 'Please provide a justification note explaining this price, part, or severity adjustment before saving.',
        type: 'alert',
        confirmLabel: 'Understood',
        confirmVariant: 'blue',
        onConfirm: () => setModalConfig(null),
        onClose: () => setModalConfig(null),
      });
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
      setModalConfig({
        isOpen: true,
        title: 'Override Failed',
        message: err.message || 'Failed to record override in database.',
        type: 'alert',
        confirmVariant: 'red',
        onConfirm: () => setModalConfig(null),
        onClose: () => setModalConfig(null),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openFinalDecisionPrompt = (action: 'APPROVED' | 'REJECTED') => {
    setModalConfig({
      isOpen: true,
      title: action === 'APPROVED' ? 'Sign & Authorize Claim Payout' : 'Reject Claim Escalation',
      message: `Enter surveyor notes and rationale for finalizing this claim as ${action}:`,
      type: 'prompt',
      confirmLabel: action === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection',
      cancelLabel: 'Cancel',
      confirmVariant: action === 'APPROVED' ? 'emerald' : 'red',
      promptPlaceholder: action === 'APPROVED' ? 'e.g. Damage inspected and estimate verified.' : 'e.g. Inconsistent damage pattern.',
      initialPromptValue: action === 'APPROVED' ? 'Claim inspected and repair cost approved.' : '',
      onClose: () => setModalConfig(null),
      onConfirm: async (remarks) => {
        setModalConfig(null);
        setIsSubmitting(true);
        try {
          await finalizeDecision(claim.claim_id, surveyorId, action, remarks || 'Final decision recorded.');
          setStatusMessage(`Claim successfully finalized to ${action}.`);
          onRefresh();
          setTimeout(onClose, 1200);
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            title: 'Action Failed',
            message: err.message || 'Failed to finalize decision.',
            type: 'alert',
            confirmVariant: 'red',
            onConfirm: () => setModalConfig(null),
            onClose: () => setModalConfig(null),
          });
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  const isFraud = (claim.fraud_score || 0) > 0;
  const isApproved = claim.status === 'APPROVED' || claim.decision === 'AUTO_APPROVED';
  const isRejected = claim.status === 'REJECTED';

  const tabs: { id: ModalTab; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'photos', label: 'Photos & Masks', icon: <Camera className="w-3.5 h-3.5" />, badge: claim.photos?.length },
    { id: 'decision', label: 'Decision & Rules', icon: <Cpu className="w-3.5 h-3.5" />, badge: claim.decision_reasons?.length ? `${claim.decision_reasons.length} triggers` : undefined },
    { id: 'cost', label: 'Cost Breakdown', icon: <Sparkles className="w-3.5 h-3.5" />, badge: editableLineItems.length },
    { id: 'fraud', label: 'Forensic & Fraud', icon: <ShieldAlert className="w-3.5 h-3.5" />, badge: isFraud ? 'Flagged' : undefined },
    { id: 'history', label: 'Overrides & Audit', icon: <History className="w-3.5 h-3.5" />, badge: claim.overrides?.length },
  ];

  return (
    <div
      id="claimDetailModal"
      className="fixed inset-0 z-50 bg-[#070A12]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modalContainer"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#131929] border border-white/[0.12] w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col my-auto max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#070A12] border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                Claim Inspection #{claim.claim_id.slice(0, 8)}
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold">
                {claim.policy_id}
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              {claim.decision === 'AUTO_APPROVED' ? (
                <span className="px-2.5 py-0.5 rounded-full uppercase font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  AUTO_APPROVED
                </span>
              ) : isFraud ? (
                <span className="px-2.5 py-0.5 rounded-full uppercase font-bold bg-red-500/20 border border-red-500/40 text-red-400 animate-fraud-pulse flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  FRAUD_FLAGGED
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full uppercase font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                  <Shield className="w-3 h-3 fill-amber-400/30 text-amber-300" />
                  SURVEYOR_REVIEW
                </span>
              )}

              <span
                className={`px-2.5 py-0.5 rounded-full uppercase font-bold border ${
                  isApproved
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : isRejected
                    ? 'bg-red-500/20 border-red-500/30 text-red-300'
                    : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                }`}
              >
                {claim.status}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#161f36] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Bar (Density Fix) */}
        <div className="px-6 py-2.5 bg-[#070A12] border-b border-white/[0.08] flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-[#131929] border border-white/[0.08]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.45)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                        tab.id === 'fraud' && isFraud
                          ? 'bg-red-500/30 text-red-300 border border-red-500/40 animate-pulse'
                          : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#1E293B] text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Reg: <strong className="text-white">{claim.vehicle_reg_no}</strong></span>
            <span>•</span>
            <span>Tier: <strong className="text-white">{claim.vehicle_tier}</strong></span>
          </div>
        </div>

        {/* Modal Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {statusMessage && (
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in font-mono">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* TAB 1: Photos & AI Masks */}
          {activeTab === 'photos' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <CanvasAnnotator photos={claim.photos} />
            </div>
          )}

          {/* TAB 2: Decision & Rules */}
          {activeTab === 'decision' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <DecisionAuditCard claim={claim} />
            </div>
          )}

          {/* TAB 3: Cost Breakdown */}
          {activeTab === 'cost' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <CostBreakdownTable
                lineItems={editableLineItems}
                subtotal={calculatedSubtotal}
                deductible={claim.deductible}
                payableAmount={calculatedPayable}
                vehicleTier={claim.vehicle_tier}
                editable={claim.status !== 'APPROVED' && claim.status !== 'REJECTED'}
                onLineItemChange={handleLineItemChange}
                onApplyPricingNote={(note) => {
                  setOverrideReason((prev) => (prev ? `${prev} | ${note}` : note));
                }}
              />
            </div>
          )}

          {/* TAB 4: Forensic & Fraud */}
          {activeTab === 'fraud' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <FraudInspectionCard claim={claim} />
            </div>
          )}

          {/* TAB 5: Overrides & Audit */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {claim.status !== 'APPROVED' && claim.status !== 'REJECTED' && (
                <div className="bg-[#161f36] rounded-xl border border-white/[0.08] p-5 shadow-lg space-y-4">
                  <div className="flex items-center space-x-2 text-white font-semibold text-sm font-mono">
                    <Edit3 className="w-4 h-4 text-cyan-400" />
                    <span className="uppercase tracking-wider text-xs">Surveyor Override Adjustment Form</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                    <div className="sm:col-span-1">
                      <label className="text-slate-400 block mb-1">Surveyor ID</label>
                      <input
                        type="text"
                        value={surveyorId}
                        onChange={(e) => setSurveyorId(e.target.value)}
                        className="w-full bg-[#070A12] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-slate-400 block mb-1">Audit Justification &amp; Notes</label>
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Enter rationale for price, part, or severity adjustment..."
                        className="w-full bg-[#070A12] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      onClick={handleSaveOverride}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-[0_0_14px_rgba(37,99,235,0.4)] disabled:opacity-50 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Save Override &amp; Recalculate</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Audit Trail History */}
              <div className="bg-[#070A12] rounded-xl border border-white/[0.08] p-5 shadow-lg">
                <div className="flex items-center space-x-2 text-white font-semibold text-sm mb-3 font-mono">
                  <History className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs uppercase tracking-wider">Auditable Override History</span>
                </div>
                {claim.overrides && claim.overrides.length > 0 ? (
                  <div className="space-y-2 text-xs font-mono">
                    {claim.overrides.map((o, idx) => (
                      <div key={idx} className="p-3 bg-[#131929] rounded-lg border border-white/[0.05] flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-semibold text-white">{o.surveyor_id}</span>
                            <span className="text-slate-500 text-[11px]">
                              {o.created_at ? new Date(o.created_at).toLocaleString() : 'Recently'}
                            </span>
                          </div>
                          <p className="text-slate-300 mt-1 font-sans">{o.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-mono py-2">
                    No manual overrides recorded for this claim yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Persistent Sticky Footer: Financial Summary & Formal Authorization */}
        <div className="px-6 py-3.5 bg-[#070A12] border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 font-mono">
          <div className="flex items-center gap-5 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Subtotal</span>
              <span className="text-white font-medium">₹{calculatedSubtotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Deductible</span>
              <span className="text-amber-400 font-medium">-₹{Number(claim.deductible || 1000).toFixed(2)}</span>
            </div>
            <div className="pl-3 border-l border-white/[0.08]">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Payable</span>
              <span className={`text-sm font-bold ${isRejected ? 'text-red-400' : 'text-emerald-400'}`}>
                ₹{calculatedPayable.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {claim.status !== 'APPROVED' && claim.status !== 'REJECTED' ? (
              <>
                <button
                  onClick={() => openFinalDecisionPrompt('REJECTED')}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5 inline mr-1" />
                  Reject Claim
                </button>
                <button
                  onClick={() => openFinalDecisionPrompt('APPROVED')}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-[0_0_14px_rgba(16,185,129,0.35)] hover:shadow-[0_0_22px_rgba(16,185,129,0.6)] active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Sign &amp; Authorize Payout</span>
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400 font-sans">
                Claim already finalized as <strong className="text-white">{claim.status}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* In-app Confirm/Prompt Modal */}
      {modalConfig && <ConfirmModal {...modalConfig} />}
    </div>
  );
};
