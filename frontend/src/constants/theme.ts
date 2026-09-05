/**
 * Standardized Design System & Color Tokens
 * Consistent palette across CanvasAnnotator, DecisionAuditCard,
 * SurveyorDashboard, CostBreakdownTable, and ClaimStatusStepper.
 */

export const THEME_COLORS = {
  // Severity Tokens
  severity: {
    minor: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      dot: 'bg-amber-400',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      label: 'Minor',
    },
    moderate: {
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      dot: 'bg-orange-500',
      badge: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
      label: 'Moderate',
    },
    severe: {
      text: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      dot: 'bg-red-500',
      badge: 'bg-red-500/10 text-red-300 border-red-500/30',
      label: 'Severe',
    },
  },

  // Claim Status Tokens
  status: {
    approved: {
      text: 'text-emerald-300',
      bg: 'bg-emerald-900/60',
      border: 'border-emerald-700',
      borderLeft: 'border-l-4 border-l-emerald-500',
      badge: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
      dot: 'bg-emerald-400',
    },
    pending: {
      text: 'text-blue-300',
      bg: 'bg-blue-900/60',
      border: 'border-blue-700',
      borderLeft: 'border-l-4 border-l-blue-500',
      badge: 'bg-blue-900/60 text-blue-300 border border-blue-700',
      dot: 'bg-blue-400',
    },
    rejected: {
      text: 'text-red-300',
      bg: 'bg-red-900/60',
      border: 'border-red-700',
      borderLeft: 'border-l-4 border-l-red-500',
      badge: 'bg-red-900/60 text-red-300 border border-red-700',
      dot: 'bg-red-400',
    },
  },

  // AI Decision Tokens
  decision: {
    autoApproved: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    },
    surveyorReview: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    },
  },
} as const;

/**
 * Helper to get badge classes for a severity string
 */
export function getSeverityBadgeClass(severity: string): string {
  const norm = (severity || '').toUpperCase();
  if (norm === 'MINOR') return THEME_COLORS.severity.minor.badge;
  if (norm === 'MODERATE') return THEME_COLORS.severity.moderate.badge;
  if (norm === 'SEVERE') return THEME_COLORS.severity.severe.badge;
  return 'bg-slate-700 text-slate-300 border-slate-600';
}

/**
 * Helper to get badge classes for a claim status string
 */
export function getStatusBadgeClass(status: string): string {
  const norm = (status || '').toUpperCase();
  if (norm === 'APPROVED') return THEME_COLORS.status.approved.badge;
  if (norm === 'REJECTED') return THEME_COLORS.status.rejected.badge;
  return THEME_COLORS.status.pending.badge;
}

/**
 * Helper to get left-border accent class for claim row in tables
 */
export function getStatusBorderClass(status: string, decision?: string): string {
  const normStatus = (status || '').toUpperCase();
  const normDecision = (decision || '').toUpperCase();

  if (normStatus === 'APPROVED' || normDecision === 'AUTO_APPROVED') {
    return THEME_COLORS.status.approved.borderLeft;
  }
  if (normStatus === 'REJECTED') {
    return THEME_COLORS.status.rejected.borderLeft;
  }
  return THEME_COLORS.status.pending.borderLeft;
}
