import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react';
import { Claim } from '../types';
import { translateDecisionReason } from '../constants/reasons';
import { THEME_COLORS } from '../constants/theme';

interface DecisionAuditCardProps {
  claim: Claim;
}

export const DecisionAuditCard: React.FC<DecisionAuditCardProps> = ({ claim }) => {
  const isAutoApproved =
    claim.decision === 'AUTO_APPROVED' ||
    (claim.status === 'APPROVED' && (!claim.decision_reasons || claim.decision_reasons.length === 0));

  const rules = [
    { code: 'E1', name: 'Unattributed Damage', desc: 'No unassigned damage blobs outside vehicle parts' },
    { code: 'E2', name: 'Structural Integrity', desc: 'No damage to frame-adjacent components (hood, fender rails)' },
    { code: 'E3', name: 'Inference Confidence', desc: 'Model confidence >= 80% on all part and damage detections' },
    { code: 'E4', name: 'Damage Extent', desc: 'Maximum 2 distinct vehicle parts affected' },
    { code: 'E5', name: 'Severity Level', desc: 'All damage limited to Minor or Moderate classification' },
    { code: 'E6', name: 'Payout Ceiling', desc: 'Calculated payable amount within auto-approval limit (₹25,000)' },
    { code: 'E7', name: 'Fraud Screening', desc: 'Zero duplicate photo matches and valid EXIF metadata' },
    { code: 'E8', name: 'Rate Matrix Coverage', desc: 'All line items priced deterministically against rate matrix' },
    { code: 'E9', name: 'Photo Validation', desc: 'Sufficient sharpness (Laplacian variance) and vehicle presence' },
  ];

  const reasons = claim.decision_reasons || [];

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Deterministic Decision Engine</h3>
            <p className="text-xs text-slate-400">Rules E1 through E9 Evaluation Audit</p>
          </div>
        </div>

        <div>
          {isAutoApproved ? (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${THEME_COLORS.decision.autoApproved.badge}`}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              AUTO_APPROVED
            </span>
          ) : (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${THEME_COLORS.decision.surveyorReview.badge}`}>
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              SURVEYOR_REVIEW
            </span>
          )}
        </div>
      </div>

      {/* Escalation Triggers list translated to plain English */}
      {reasons.length > 0 && (
        <div className="mb-4 p-3.5 bg-amber-950/40 rounded-xl border border-amber-800/50">
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold mb-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Escalation Triggers ({reasons.length}):</span>
          </div>
          <ul className="space-y-1.5 text-xs text-amber-200/90">
            {reasons.map((r, i) => {
              const translated = translateDecisionReason(r);
              return (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-200 font-medium">{translated.sentence}</span>
                    {translated.code && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-900/60 text-amber-300 border border-amber-700/60">
                        {translated.code}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        {rules.map((rule) => {
          const hasFired = reasons.some((r) => r.includes(rule.code));
          return (
            <div
              key={rule.code}
              className={`p-2.5 rounded-lg border transition-all ${
                hasFired
                  ? 'bg-red-950/30 border-red-800/60 text-red-200'
                  : 'bg-slate-900/50 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between font-medium">
                <span className="flex items-center space-x-1.5">
                  <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${hasFired ? 'bg-red-900/60 text-red-300' : 'bg-slate-800 text-slate-400'}`}>
                    {rule.code}
                  </span>
                  <span>{rule.name}</span>
                </span>
                {hasFired ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">{rule.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
