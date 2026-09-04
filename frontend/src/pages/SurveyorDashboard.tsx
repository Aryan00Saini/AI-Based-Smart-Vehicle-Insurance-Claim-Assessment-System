import React, { useState, useEffect } from 'react';
import {
  FileText, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Search, ShieldAlert, ArrowUpRight, Filter
} from 'lucide-react';
import { Claim } from '../types';
import { fetchClaims, fetchClaimDetail } from '../services/api';
import { ClaimDetailModal } from '../components/ClaimDetailModal';

export const SurveyorDashboard: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadClaims = async () => {
    setLoading(true);
    try {
      const data = await fetchClaims();
      setClaims(data);
    } catch (err) {
      console.error('Failed to load claims:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
    // Auto-refresh queue every 10 seconds
    const interval = setInterval(loadClaims, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenClaim = async (claimId: string) => {
    try {
      const detail = await fetchClaimDetail(claimId);
      setSelectedClaim(detail);
    } catch (err) {
      alert('Error fetching claim details');
    }
  };

  const filteredClaims = claims.filter((c) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      c.status.toUpperCase() === statusFilter.toUpperCase() ||
      (statusFilter === 'SURVEYOR_REVIEW' && c.decision === 'SURVEYOR_REVIEW');

    const matchesSearch =
      c.policy_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.vehicle_reg_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claim_id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Calculate high level metrics
  const totalClaims = claims.length;
  const autoApprovedCount = claims.filter((c) => c.decision === 'AUTO_APPROVED' || c.status === 'APPROVED').length;
  const autoApproveRate = totalClaims > 0 ? ((autoApprovedCount / totalClaims) * 100).toFixed(0) : '0';
  const surveyorPendingCount = claims.filter((c) => c.decision === 'SURVEYOR_REVIEW' && c.status !== 'APPROVED' && c.status !== 'REJECTED').length;
  const totalPayout = claims.reduce((acc, c) => acc + Number(c.payable_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Claims</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalClaims}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Registered in database</span>
        </div>

        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Auto-Approval Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{autoApproveRate}%</div>
          <span className="text-[11px] text-slate-400 mt-1 block">{autoApprovedCount} clean low-value claims</span>
        </div>

        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Surveyor Queue</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{surveyorPendingCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting human adjuster review</span>
        </div>

        <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Payable Payout</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">₹{totalPayout.toFixed(0)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Net assessed payable sum</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Policy ID, Reg No, or Claim ID..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {['ALL', 'SUBMITTED', 'ASSESSED', 'SURVEYOR_REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700/80'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
          <button
            onClick={loadClaims}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-lg ml-2"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Claim ID & Policy</th>
                <th className="py-3.5 px-4">Vehicle Details</th>
                <th className="py-3.5 px-4">AI Decision</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Subtotal</th>
                <th className="py-3.5 px-4 text-right">Net Payable</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading && claims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading claims from server...</span>
                  </td>
                </tr>
              ) : filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No claims found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredClaims.map((claim) => (
                  <tr key={claim.claim_id} className="hover:bg-slate-700/30 transition-colors">
                    {/* ID & Policy */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white font-mono">{claim.claim_id.slice(0, 12)}...</div>
                      <div className="text-slate-400 text-[11px]">{claim.policy_id}</div>
                      {claim.fraud_score > 0 && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-950/80 text-red-300 border border-red-800">
                          <ShieldAlert className="w-3 h-3" /> Fraud Flags ({claim.fraud_score})
                        </span>
                      )}
                    </td>

                    {/* Vehicle */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">{claim.vehicle_reg_no}</div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                        {claim.vehicle_tier}
                      </span>
                    </td>

                    {/* AI Decision */}
                    <td className="py-3.5 px-4">
                      {claim.decision === 'AUTO_APPROVED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> AUTO_APPROVED
                        </span>
                      ) : claim.decision === 'SURVEYOR_REVIEW' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3 mr-1" /> SURVEYOR_REVIEW
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Pending AI</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        claim.status === 'APPROVED' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                        claim.status === 'REJECTED' ? 'bg-red-900/60 text-red-300 border border-red-700' :
                        claim.status === 'SURVEYOR_REVIEWED' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                        claim.status === 'ASSESSED' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {claim.status}
                      </span>
                    </td>

                    {/* Subtotal */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                      ₹{Number(claim.subtotal).toFixed(2)}
                    </td>

                    {/* Net Payable */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      ₹{Number(claim.payable_amount).toFixed(2)}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleOpenClaim(claim.claim_id)}
                        className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-lg text-xs font-medium transition-all"
                      >
                        Inspect Claim
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onRefresh={() => {
            loadClaims();
            handleOpenClaim(selectedClaim.claim_id);
          }}
        />
      )}
    </div>
  );
};
