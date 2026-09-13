import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Cpu, Check, Info } from 'lucide-react';
import { Claim } from '../types';
import { translateDecisionReason } from '../constants/reasons';

interface DecisionAuditCardProps {
  claim: Claim;
}

export const DecisionAuditCard: React.FC<DecisionAuditCardProps> = ({ claim }) => {
  const [activeRuleDetail, setActiveRuleDetail] = useState<string | null>(null);

  const isAutoApproved =
    claim.decision === 'AUTO_APPROVED' ||
    (claim.status === 'APPROVED' && (!claim.decision_reasons || claim.decision_reasons.length === 0));

  const rules = [
    { code: 'E1', name: 'Unattributed Damage', desc: 'No unassigned damage blobs outside localized vehicle parts' },
    { code: 'E2', name: 'Structural Integrity', desc: 'No damage to frame-adjacent components (hood, fender rails)' },
    { code: 'E3', name: 'Inference Confidence', desc: 'Model confidence >= 80% on all part and damage detections' },
    { code: 'E4', name: 'Damage Extent', desc: 'Maximum 2 distinct vehicle panels affected' },
    { code: 'E5', name: 'Severity Level', desc: 'All damage limited to Minor or Moderate classification' },
    { code: 'E6', name: 'Payout Ceiling', desc: 'Calculated payable amount within auto-approval limit (₹25,000)' },
    { code: 'E7', name: 'Fraud Screening', desc: 'Zero duplicate photo matches and valid EXIF metadata' },
    { code: 'E8', name: 'Rate Matrix Coverage', desc: 'All line items priced deterministically against rate matrix' },
    { code: 'E9', name: 'Photo Validation', desc: 'Sufficient sharpness (Laplacian variance) and vehicle presence' },
  ];

  const reasons = claim.decision_reasons || [];

  return (
    <div className="p-4 rounded-xl bg-[#070A12] border border-white/[0.08] flex flex-col gap-3 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
              Deterministic Decision Engine (E1–E9)
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">Automated Triage Evaluation</p>
          </div>
        </div>

        <div>
          {isAutoApproved ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full font-mono text-[10px] font-bold uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-300" />
              AUTO_APPROVED
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full font-mono text-[10px] font-bold uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <AlertTriangle className="w-3 h-3 mr-1 text-amber-300" />
              SURVEYOR_REVIEW
            </span>
          )}
        </div>
      </div>

      {/* Escalation Triggers list translated to plain English */}
      {reasons.length > 0 && (
        <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-800/40">
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold mb-1.5 font-mono">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Escalation Triggers ({reasons.length}):</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-200/90">
            {reasons.map((r, i) => {
              const translated = translateDecisionReason(r);
              return (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-200 font-medium">{translated.sentence}</span>
                    {translated.code && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-900/60 text-amber-300 border border-amber-700/60">
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
      <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
        {rules.map((rule) => {
          const hasFired = reasons.some((r) => r.includes(rule.code));
          const isSelected = activeRuleDetail === rule.code;

          return (
            <button
              key={rule.code}
              onClick={() => setActiveRuleDetail(isSelected ? null : rule.code)}
              className={`p-2 rounded-lg text-left border flex items-center justify-between transition-all cursor-pointer ${
                hasFired
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : 'bg-[#131929] border-white/[0.05] text-slate-300 hover:border-white/20'
              }`}
            >
              <span className="truncate">{rule.code}: {rule.name.split(' ')[0]}</span>
              {hasFired ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanatory Rule Detail Bubble */}
      {activeRuleDetail && (
        <div className="p-2.5 rounded-lg bg-[#161f36] border border-cyan-400/30 text-xs font-mono text-cyan-200 animate-in fade-in duration-150">
          <span className="font-bold text-white block mb-0.5">
            {rules.find((r) => r.code === activeRuleDetail)?.name} ({activeRuleDetail}):
          </span>
          {rules.find((r) => r.code === activeRuleDetail)?.desc}
        </div>
      )}
    </div>
  );
};
