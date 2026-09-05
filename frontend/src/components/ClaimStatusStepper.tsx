import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Clock, Car, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import { Claim } from '../types';
import { fetchClaimDetail } from '../services/api';
import { translateDecisionReason } from '../constants/reasons';

interface ClaimStatusStepperProps {
  claimId: string;
  onReset: () => void;
}

const STEPS = [
  { id: 1, title: 'Submitted', description: 'Received in queue' },
  { id: 2, title: 'Validating Photos', description: 'Checking blur & vehicle' },
  { id: 3, title: 'Analyzing Damage', description: 'Neural segmentation & pricing' },
  { id: 4, title: 'Decision Ready', description: 'Assessment complete' },
];

export const ClaimStatusStepper: React.FC<ClaimStatusStepperProps> = ({ claimId, onReset }) => {
  const [currentStep, setCurrentStep] = useState<number>(2);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let pollCount = 0;
    const maxPolls = 20; // 30 seconds max polling

    const checkStatus = async () => {
      try {
        pollCount++;
        const detail = await fetchClaimDetail(claimId);
        setClaim(detail);

        if (detail.decision || detail.status === 'ASSESSED' || detail.status === 'APPROVED' || detail.status === 'REJECTED') {
          setCurrentStep(4);
          return;
        }

        if (detail.photo_validation_passed || (detail.photos && detail.photos.length > 0 && detail.photos[0].blur_score !== undefined)) {
          setCurrentStep(3);
        } else {
          setCurrentStep(2);
        }

        if (pollCount < maxPolls) {
          timer = setTimeout(checkStatus, 1500);
        } else {
          // If max polls reached, assume ready
          setCurrentStep(4);
        }
      } catch (err: any) {
        console.warn('Polling error:', err);
        if (pollCount < maxPolls) {
          timer = setTimeout(checkStatus, 2000);
        } else {
          setPollingError('Assessment is taking longer than usual. It will appear on your surveyor dashboard.');
          setCurrentStep(4);
        }
      }
    };

    // First check after 1 second
    timer = setTimeout(checkStatus, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [claimId]);

  // Determine final status message
  const getDecisionSummary = () => {
    if (!claim) {
      return {
        title: 'Assessment in progress...',
        desc: 'Our automated system is processing your vehicle photographs.',
        type: 'pending' as const,
      };
    }

    if (claim.decision === 'AUTO_APPROVED' || claim.status === 'APPROVED') {
      const payable = Number(claim.payable_amount || 0).toFixed(2);
      return {
        title: '✅ Approved automatically — no further action needed.',
        desc: `Net assessed payable amount: ₹${payable} (after deductible). Funds will be disbursed according to policy terms.`,
        type: 'approved' as const,
      };
    }

    if (claim.decision === 'SURVEYOR_REVIEW' || (claim.decision_reasons && claim.decision_reasons.length > 0)) {
      const primaryReason = claim.decision_reasons && claim.decision_reasons.length > 0
        ? translateDecisionReason(claim.decision_reasons[0]).sentence
        : 'Physical inspection or policy audit required';

      return {
        title: `🕵️ A surveyor will review your claim because: ${primaryReason}`,
        desc: 'A licensed claims surveyor will inspect the damage photos and finalize your repair estimate within 24 to 48 hours.',
        type: 'review' as const,
      };
    }

    if (claim.status === 'REJECTED') {
      return {
        title: '❌ Claim requires manual surveyor escalation.',
        desc: 'The claim could not be processed automatically and has been routed to our claims department.',
        type: 'rejected' as const,
      };
    }

    return {
      title: 'Assessment successfully recorded.',
      desc: 'Your claim details and photos are registered in the claims management system.',
      type: 'pending' as const,
    };
  };

  const decisionSummary = getDecisionSummary();

  return (
    <div className="p-6 sm:p-8 bg-slate-900/90 border border-slate-700 rounded-2xl space-y-8 shadow-xl">
      {/* Header Info */}
      <div className="text-center space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Automated Triage Tracking</span>
        <h3 className="text-xl font-bold text-white tracking-tight">Claim Processing Status</h3>
        <p className="text-xs text-slate-400">
          Claim ID: <span className="font-mono font-bold text-slate-200">{claimId}</span>
        </p>
      </div>

      {/* Horizontal Status Stepper */}
      <div className="relative py-4">
        {/* Connecting Line */}
        <div className="absolute top-8 left-6 right-6 h-0.5 bg-slate-700 -translate-y-1/2 z-0 hidden sm:block" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
          {STEPS.map((step) => {
            const isCompleted = step.id < currentStep || (step.id === 4 && currentStep === 4);
            const isCurrent = step.id === currentStep && currentStep !== 4;
            const isPending = step.id > currentStep;

            return (
              <div key={step.id} className="flex flex-col items-center text-center space-y-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-600/20 animate-pulse'
                      : 'bg-slate-800 border-2 border-slate-700 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="text-xs font-bold font-mono">{step.id}</span>
                  )}
                </div>

                <div>
                  <div
                    className={`text-xs font-semibold ${
                      isCompleted
                        ? 'text-emerald-300'
                        : isCurrent
                        ? 'text-blue-400 font-bold'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision Summary Card */}
      <div
        className={`p-5 rounded-xl border text-left transition-all ${
          decisionSummary.type === 'approved'
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
            : decisionSummary.type === 'review'
            ? 'bg-blue-950/40 border-blue-800/80 text-blue-200'
            : decisionSummary.type === 'rejected'
            ? 'bg-red-950/40 border-red-800/80 text-red-200'
            : 'bg-slate-800/60 border-slate-700 text-slate-300'
        }`}
      >
        <div className="flex items-start space-x-3">
          <div className="mt-0.5 shrink-0">
            {decisionSummary.type === 'approved' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {decisionSummary.type === 'review' && <Clock className="w-5 h-5 text-blue-400" />}
            {decisionSummary.type === 'rejected' && <ShieldAlert className="w-5 h-5 text-red-400" />}
            {decisionSummary.type === 'pending' && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white tracking-tight">{decisionSummary.title}</h4>
            <p className="text-xs leading-relaxed text-slate-300">{decisionSummary.desc}</p>
          </div>
        </div>
      </div>

      {/* Polling Notice if any */}
      {pollingError && (
        <p className="text-xs text-amber-400 text-center">{pollingError}</p>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onReset}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
        >
          <span>File Another Claim</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
