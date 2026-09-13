import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  CheckCircle2,
  Shield,
  TrendingUp,
  ArrowUp,
  Search,
  RotateCw,
  Download,
  Copy,
  Check,
  Car,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';
import { Claim } from '../types';
import { fetchClaims, fetchClaimDetail } from '../services/api';
import { ClaimDetailModal } from '../components/ClaimDetailModal';
import { ConfirmModal, ConfirmModalProps } from '../components/ConfirmModal';
import { Toast, ToastMessage } from '../components/Toast';

export const SurveyorDashboard: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalConfig, setModalConfig] = useState<ConfirmModalProps | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (title: string, message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToast({ id, title, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 2800);
  };

  const loadClaims = async (showSyncToast = false) => {
    setLoading(true);
    try {
      const data = await fetchClaims();
      setClaims(data);
      if (showSyncToast) {
        showToast('Database Synced', `All ${data.length} vehicle claims up to date`, 'success');
      }
    } catch (err) {
      console.error('Failed to load claims:', err);
      if (showSyncToast) {
        showToast('Sync Failed', 'Could not sync with the claims database', 'warning');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
    // Auto-refresh queue every 10 seconds
    const interval = setInterval(() => loadClaims(false), 10000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenClaim = async (claimId: string) => {
    try {
      const detail = await fetchClaimDetail(claimId);
      setSelectedClaim(detail);
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Inspection Failed',
        message: err.message || 'Could not load claim details from the server.',
        type: 'alert',
        confirmVariant: 'red',
        onConfirm: () => setModalConfig(null),
        onClose: () => setModalConfig(null),
      });
    }
  };

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    setCopiedId(id);
    showToast('Claim ID Copied', `${id.slice(0, 16)}... copied to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefreshClick = () => {
    setIsRotating(true);
    showToast('Syncing Pipeline', 'Synchronizing with Forensic ML backend...', 'info');
    loadClaims(true);
    setTimeout(() => setIsRotating(false), 750);
  };

  const handleExportCsv = () => {
    if (claims.length === 0) {
      showToast('Export Notice', 'No claims available to export', 'info');
      return;
    }
    const headers = [
      'Claim ID',
      'Policy ID',
      'Registration No',
      'Vehicle Tier',
      'AI Decision',
      'Status',
      'Subtotal (INR)',
      'Net Payable (INR)',
      'Fraud Score',
      'Created At',
    ];

    const rows = filteredClaims.map((c) => [
      `"${c.claim_id}"`,
      `"${c.policy_id}"`,
      `"${c.vehicle_reg_no}"`,
      `"${c.vehicle_tier}"`,
      `"${c.decision || 'PENDING'}"`,
      `"${c.status}"`,
      c.subtotal,
      c.payable_amount,
      c.fraud_score,
      `"${c.created_at || 'N/A'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `claims_triage_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Export Triggered', `Exported ${filteredClaims.length} claims to claims_triage_audit.csv`);
  };

  const filteredClaims = claims.filter((c) => {
    const isApproved = c.status === 'APPROVED' || c.decision === 'AUTO_APPROVED';
    const isRejected = c.status === 'REJECTED';
    const isPending = !isApproved && !isRejected;

    let matchesStatus = true;
    if (statusFilter === 'APPROVED') matchesStatus = isApproved;
    else if (statusFilter === 'REJECTED') matchesStatus = isRejected;
    else if (statusFilter === 'PENDING') matchesStatus = isPending;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      c.policy_id.toLowerCase().includes(q) ||
      c.vehicle_reg_no.toLowerCase().includes(q) ||
      c.claim_id.toLowerCase().includes(q) ||
      c.vehicle_tier.toLowerCase().includes(q) ||
      (c.decision && c.decision.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
  });

  // Calculate high level metrics
  const totalClaims = claims.length;
  const autoApprovedCount = claims.filter((c) => c.decision === 'AUTO_APPROVED' || c.status === 'APPROVED').length;
  const autoApproveRate = totalClaims > 0 ? ((autoApprovedCount / totalClaims) * 100).toFixed(1) : '0.0';
  const surveyorPendingCount = claims.filter((c) => c.status !== 'APPROVED' && c.status !== 'REJECTED').length;
  const rejectedCount = claims.filter((c) => c.status === 'REJECTED').length;
  const totalPayout = claims.reduce((acc, c) => acc + Number(c.payable_amount || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* TOP STATS METRIC GRID */}
      <section id="metricsSection" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Claims */}
        <div
          id="cardTotalClaims"
          onClick={() => setStatusFilter('ALL')}
          className="shimmer-card relative overflow-hidden rounded-2xl bg-[#131929] border border-white/[0.08] p-5 shadow-lg hover:border-blue-500/60 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(37,99,235,0.22)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-600/15 blur-2xl pointer-events-none group-hover:bg-blue-600/35 animate-ambient transition-all"></div>
          <div className="flex items-center justify-between mb-2 relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
              Total Claims
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)] group-hover:scale-110 group-hover:shadow-[0_0_18px_rgba(59,130,246,0.4)] group-hover:bg-blue-500/20 transition-all duration-300">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1 relative z-10">
            <span className="font-mono text-3xl font-bold text-white tracking-tight group-hover:text-blue-200 transition-colors">
              {totalClaims}
            </span>
            <span className="font-mono text-xs text-blue-400 font-semibold flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
              <ArrowUp className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" />
              Active
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/[0.06] mt-2 relative z-10">
            <span>Registered in system</span>
            <span className="px-2 py-0.5 rounded-md bg-[#1E293B] font-mono text-[11px] text-blue-300 border border-white/[0.05]">
              Live Portfolio
            </span>
          </div>
        </div>

        {/* Card 2: Auto-Approval Rate */}
        <div
          id="cardAutoApprovalRate"
          onClick={() => setStatusFilter('APPROVED')}
          className="shimmer-card relative overflow-hidden rounded-2xl bg-[#131929] border border-emerald-500/25 p-5 shadow-lg hover:border-emerald-400/70 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(16,185,129,0.28)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none group-hover:bg-emerald-500/35 animate-ambient transition-all"></div>
          <div className="flex items-center justify-between mb-2 relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
              Auto-Approval Rate
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_14px_rgba(16,185,129,0.3)] group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] group-hover:bg-emerald-500/25 transition-all duration-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1 relative z-10">
            <span className="font-mono text-3xl font-bold text-emerald-400 tracking-tight group-hover:text-emerald-300 transition-colors">
              {autoApproveRate}%
            </span>
            <span className="font-mono text-xs text-emerald-300 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 group-hover:bg-emerald-500/25 transition-all">
              {autoApprovedCount} clean
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/[0.06] mt-2 relative z-10">
            <span>Low-risk auto-settled</span>
            {/* Glowing Tip Progress Bar */}
            <div className="w-16 h-2 rounded-full bg-[#1E293B] overflow-hidden p-0.5 border border-white/[0.05]">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full shadow-[0_0_10px_rgba(52,211,153,1)] relative transition-all duration-500"
                style={{ width: `${Math.min(Math.max(parseFloat(autoApproveRate), 10), 100)}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white rounded-full opacity-80 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Surveyor Queue */}
        <div
          id="cardSurveyorQueue"
          onClick={() => setStatusFilter('PENDING')}
          className="shimmer-card relative overflow-hidden rounded-2xl bg-[#131929] border border-amber-500/25 p-5 shadow-lg hover:border-amber-400/70 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(245,158,11,0.26)] transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-500/15 blur-2xl pointer-events-none group-hover:bg-amber-500/35 animate-ambient transition-all"></div>
          <div className="flex items-center justify-between mb-2 relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
              Surveyor Queue
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_14px_rgba(245,158,11,0.25)] group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] group-hover:bg-amber-500/25 transition-all duration-300">
              <Shield className="w-4 h-4 fill-amber-400/30" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1 relative z-10">
            <span className="font-mono text-3xl font-bold text-amber-300 tracking-tight group-hover:text-amber-200 transition-colors">
              {surveyorPendingCount}
            </span>
            <span className="font-mono text-[11px] text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 uppercase font-bold tracking-wider group-hover:bg-amber-500/25 transition-all">
              Awaiting Review
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/[0.06] mt-2 relative z-10">
            <span className="truncate">Escalation rule triggers</span>
            <span className="text-amber-400 font-semibold text-[11px] font-mono shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              High Priority
            </span>
          </div>
        </div>

        {/* Card 4: Total Payable Payout */}
        <div
          id="cardTotalPayout"
          className="shimmer-card relative overflow-hidden rounded-2xl bg-[#131929] border border-indigo-500/25 p-5 shadow-lg hover:border-indigo-400/70 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(99,102,241,0.28)] transition-all duration-300 flex flex-col justify-between group cursor-default"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-600/15 blur-2xl pointer-events-none group-hover:bg-indigo-600/35 animate-ambient transition-all"></div>
          <div className="flex items-center justify-between mb-2 relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
              Total Payable Payout
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.25)] group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] group-hover:bg-indigo-500/25 transition-all duration-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 my-1 relative z-10">
            <span className="font-mono text-3xl font-bold text-white tracking-tight group-hover:text-indigo-200 transition-colors">
              ₹{totalPayout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <span className="font-mono text-xs text-indigo-300 uppercase font-semibold">
              INR
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/[0.06] mt-2 relative z-10">
            <span>Net assessed payable sum</span>
            <span className="font-mono text-[11px] text-indigo-300 font-medium px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              {claims.filter((c) => c.status === 'APPROVED' || c.status === 'ASSESSED').length} Validated
            </span>
          </div>
        </div>
      </section>

      {/* ACTION CONTROL BAR */}
      <div
        id="actionControlBar"
        className="rounded-2xl bg-[#131929] border border-white/[0.08] p-3 sm:p-4 shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
      >
        {/* Search Field */}
        <div className="relative flex-1 max-w-md group" id="searchContainer">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-[18px] h-[18px] group-focus-within:text-cyan-400 transition-colors pointer-events-none" />
          <input
            ref={searchInputRef}
            id="claimSearchInput"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Policy ID, Reg No, or Claim ID..."
            className="w-full bg-[#070A12] border border-white/[0.08] text-white placeholder:text-slate-500 text-sm pl-10 pr-12 py-2.5 rounded-xl outline-none focus:border-cyan-400/80 focus:ring-4 focus:ring-cyan-500/20 transition-all font-sans"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#1E293B] border border-white/[0.08] font-mono text-[10px] text-slate-400 tracking-wider font-semibold group-focus-within:border-cyan-400/40 group-focus-within:text-cyan-300 transition-all pointer-events-none">
            ⌘K
          </span>
        </div>

        {/* Filter Chips & Operations */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            id="filterButtonsContainer"
            className="flex items-center p-1 rounded-xl bg-[#070A12] border border-white/[0.08] gap-1"
          >
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)] hover:shadow-[0_0_20px_rgba(37,99,235,0.65)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              All Claims <span className="ml-1 opacity-80 font-mono">{totalClaims}</span>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              Pending Review{' '}
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold">
                {surveyorPendingCount}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                statusFilter === 'APPROVED'
                  ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              Approved <span className="ml-1 font-mono opacity-80">{autoApprovedCount}</span>
            </button>
            <button
              onClick={() => setStatusFilter('REJECTED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 cursor-pointer ${
                statusFilter === 'REJECTED'
                  ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              Rejected <span className="ml-1 font-mono opacity-80">{rejectedCount}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              id="refreshBtn"
              onClick={handleRefreshClick}
              title="Refresh Claims Data"
              className="w-9 h-9 rounded-xl bg-[#161f36] border border-white/[0.08] hover:border-cyan-400/40 hover:bg-[#1E293B] text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all duration-200 shadow-sm active:scale-90 group cursor-pointer"
            >
              <RotateCw
                className={`w-[17px] h-[17px] transition-transform duration-700 ${
                  isRotating || loading ? 'rotate-[720deg]' : ''
                }`}
              />
            </button>
            <button
              id="exportBtn"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#161f36] border border-white/[0.08] hover:border-white/[0.2] hover:bg-[#1E293B] text-slate-200 hover:text-white text-xs font-semibold transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN DATA TABLE (Desktop Viewport) */}
      <div
        id="claimsDesktopTableContainer"
        className="hidden lg:block rounded-2xl bg-[#131929] border border-white/[0.08] shadow-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#070A12]/90 border-b border-white/[0.08] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3.5 pl-6 pr-4 font-semibold">Claim ID &amp; Policy</th>
                <th className="py-3.5 px-4 font-semibold">Vehicle Details</th>
                <th className="py-3.5 px-4 font-semibold">AI Decision</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 text-right font-semibold">Subtotal</th>
                <th className="py-3.5 px-4 text-right font-semibold">Net Payable</th>
                <th className="py-3.5 pl-4 pr-6 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-sm" id="claimsDesktopTableBody">
              {loading && claims.length === 0 ? (
                // Shimmer Loading Skeleton State
                <>
                  {[...Array(5)].map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 pl-6 pr-4 space-y-2">
                        <div className="h-4 bg-slate-800/80 rounded w-28"></div>
                        <div className="h-3 bg-slate-800/50 rounded w-20"></div>
                      </td>
                      <td className="py-4 px-4 space-y-2">
                        <div className="h-4 bg-slate-800/80 rounded w-24"></div>
                        <div className="h-3 bg-slate-800/50 rounded w-16"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-6 bg-slate-800/70 rounded-full w-32"></div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 bg-slate-800/70 rounded-full w-20"></div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 bg-slate-800/70 rounded w-16 ml-auto"></div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-4 bg-slate-800/80 rounded w-20 ml-auto"></div>
                      </td>
                      <td className="py-4 pl-4 pr-6 text-right">
                        <div className="h-7 bg-blue-600/20 rounded-xl w-24 ml-auto"></div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-mono text-sm">
                    No claims match current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => {
                  const isApproved = claim.status === 'APPROVED' || claim.decision === 'AUTO_APPROVED';
                  const isRejected = claim.status === 'REJECTED';
                  const isFraud = claim.fraud_score > 0;

                  return (
                    <tr
                      key={claim.claim_id}
                      onClick={() => handleOpenClaim(claim.claim_id)}
                      className="claim-row hover:bg-white/[0.04] transition-all duration-200 group cursor-pointer relative"
                    >
                      {/* Left colored vertical accent line */}
                      <td className="py-4 pl-6 pr-4 relative">
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all ${
                            isApproved
                              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover:shadow-[0_0_14px_rgba(16,185,129,0.85)]'
                              : isRejected
                              ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] group-hover:shadow-[0_0_14px_rgba(239,68,68,0.9)]'
                              : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] group-hover:shadow-[0_0_14px_rgba(245,158,11,0.85)]'
                          }`}
                        ></div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                            {claim.claim_id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={(e) => handleCopy(claim.claim_id, e)}
                            className="text-slate-500 hover:text-cyan-400 p-1 hover:bg-cyan-400/10 rounded transition-all active:scale-90"
                            title="Copy Claim ID"
                          >
                            {copiedId === claim.claim_id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-slate-400 text-xs font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{claim.policy_id}</span>
                          {claim.created_at && (
                            <>
                              <span>•</span>
                              <span className="text-[11px]">{new Date(claim.created_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Vehicle details */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#070A12] border border-white/[0.08] font-mono text-xs font-semibold text-slate-200 tracking-wider group-hover:border-cyan-400/30 transition-colors">
                          <Car className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                          {claim.vehicle_reg_no}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 font-medium">
                          Category: {claim.vehicle_tier}
                        </div>
                      </td>

                      {/* AI Decision */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {claim.decision === 'AUTO_APPROVED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold shadow-[0_0_10px_rgba(16,185,129,0.15)] group-hover:border-emerald-400/60 transition-all">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                              AUTO_APPROVED
                            </span>
                          ) : claim.decision === 'SURVEYOR_REVIEW' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold shadow-[0_0_10px_rgba(245,158,11,0.15)] group-hover:border-amber-400/60 transition-all">
                              <Shield className="w-3.5 h-3.5 fill-amber-400/30 text-amber-300" />
                              SURVEYOR_REVIEW
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs font-mono">Pending AI Evaluation</span>
                          )}

                          {isFraud && (
                            <span className="animate-fraud-pulse inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                              <AlertTriangle className="w-3 h-3 text-red-400" />
                              Fraud Flagged ({claim.fraud_score})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {claim.status === 'APPROVED' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                            APPROVED
                          </span>
                        ) : claim.status === 'REJECTED' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold uppercase tracking-wider bg-red-500/20 border border-red-500/30 text-red-300">
                            REJECTED
                          </span>
                        ) : claim.status === 'SUBMITTED' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                            SUBMITTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 border border-blue-500/30 text-blue-300">
                            {claim.status}
                          </span>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td className="py-4 px-4 text-right font-mono text-sm text-slate-300">
                        ₹{Number(claim.subtotal || 0).toFixed(2)}
                      </td>

                      {/* Net Payable */}
                      <td className="py-4 px-4 text-right">
                        <div
                          className={`font-mono text-sm font-bold group-hover:brightness-110 transition-all ${
                            isRejected ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          ₹{Number(claim.payable_amount || 0).toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {isApproved ? 'Settlement ready' : 'Pending review'}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 pl-4 pr-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenClaim(claim.claim_id);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600/20 group-hover:bg-blue-600 border border-blue-500/30 group-hover:border-blue-400 text-blue-300 group-hover:text-white text-xs font-semibold shadow-sm group-hover:shadow-[0_0_16px_rgba(37,99,235,0.6)] transition-all duration-200 active:scale-95 cursor-pointer"
                        >
                          <span>Inspect Claim</span>
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="px-6 py-3.5 bg-[#070A12]/90 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-white font-semibold">{filteredClaims.length > 0 ? 1 : 0}</strong> to{' '}
              <strong className="text-white font-semibold">{filteredClaims.length}</strong> of{' '}
              <strong className="text-white font-semibold">{claims.length}</strong> claims
            </span>
            {/* Real-Time Ticker Pulse Sync Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-[10px] shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="tracking-wider">SYNCED LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-1 font-mono">
            <button
              disabled
              className="w-8 h-8 rounded-lg bg-[#161f36] border border-white/[0.08] text-slate-500 opacity-50 cursor-not-allowed flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-[0_0_10px_rgba(37,99,235,0.4)]">
              1
            </span>
            <button
              disabled
              className="w-8 h-8 rounded-lg bg-[#161f36] border border-white/[0.08] text-slate-500 opacity-50 cursor-not-allowed flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE CLAIMS CARDS LIST (Responsive Viewports < 1024px) */}
      <div className="lg:hidden flex flex-col gap-3.5" id="claimsMobileContainer">
        {filteredClaims.length === 0 ? (
          <div className="rounded-2xl bg-[#131929] border border-white/[0.08] p-8 text-center text-slate-400 font-mono text-sm">
            No claims match current filter criteria.
          </div>
        ) : (
          filteredClaims.map((claim) => {
            const isApproved = claim.status === 'APPROVED' || claim.decision === 'AUTO_APPROVED';
            const isRejected = claim.status === 'REJECTED';

            return (
              <div
                key={claim.claim_id}
                onClick={() => handleOpenClaim(claim.claim_id)}
                className="rounded-2xl bg-[#131929] border border-white/[0.08] p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isApproved
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : isRejected
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                      : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                  }`}
                ></div>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white font-mono">
                        {claim.vehicle_reg_no}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#070A12] border border-white/[0.08] font-mono text-xs font-bold text-slate-300">
                        {claim.vehicle_tier}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                      ID: {claim.claim_id.slice(0, 12)}... • {claim.policy_id}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                      isApproved
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : isRejected
                        ? 'bg-red-500/20 border border-red-500/30 text-red-300'
                        : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                    }`}
                  >
                    {claim.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {claim.decision === 'AUTO_APPROVED' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      AUTO_APPROVED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-semibold">
                      <Shield className="w-3 h-3 fill-amber-400/30" />
                      SURVEYOR_REVIEW
                    </span>
                  )}
                  {claim.fraud_score > 0 && (
                    <span className="animate-fraud-pulse inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 font-mono text-[10px] uppercase font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      Fraud Flagged ({claim.fraud_score})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 bg-[#070A12]/80 border border-white/[0.05] p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono font-semibold">
                      Subtotal
                    </span>
                    <span className="font-mono text-sm text-slate-200 font-medium">
                      ₹{Number(claim.subtotal || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono font-semibold">
                      Net Payable
                    </span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        isRejected ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      ₹{Number(claim.payable_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenClaim(claim.claim_id);
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <span>Inspect Claim</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Inspection Modal */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onRefresh={() => {
            loadClaims(false);
            handleOpenClaim(selectedClaim.claim_id);
          }}
        />
      )}

      {/* Alert / Notice Modal */}
      {modalConfig && <ConfirmModal {...modalConfig} />}
    </div>
  );
};
