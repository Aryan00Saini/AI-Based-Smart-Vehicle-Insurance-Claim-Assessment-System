import React from 'react';
import { Shield, Plus, BarChart2, User } from 'lucide-react';

interface NavbarProps {
  currentTab: 'surveyor' | 'submit' | 'analytics';
  setCurrentTab: (tab: 'surveyor' | 'submit' | 'analytics') => void;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount = 0,
}) => {
  return (
    <header
      id="appHeader"
      className="fixed top-0 left-0 right-0 z-50 bg-[#0B0F19]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
    >
      <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand & Section Switcher */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => setCurrentTab('surveyor')}
            className="flex items-center gap-3 group cursor-pointer"
            id="brandLogoButton"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600/30 to-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.25)] group-hover:shadow-[0_0_24px_rgba(34,211,238,0.5)] group-hover:scale-105 transition-all duration-300">
              <Shield className="w-5 h-5 fill-cyan-400/40 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] tracking-tight font-bold text-white group-hover:text-cyan-300 transition-colors">
                  AutoClaim
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 font-mono text-[11px] font-bold tracking-wider uppercase">
                  AI TRIAGE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide font-medium">
                Smart Vehicle Insurance Assessment Portal
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav
            id="navigationTabs"
            className="hidden md:flex items-center p-1 bg-[#070A12]/80 rounded-xl border border-white/[0.08] shadow-inner"
          >
            <button
              id="navSurveyorQueue"
              onClick={() => setCurrentTab('surveyor')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                currentTab === 'surveyor'
                  ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)] hover:bg-blue-500'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <span>Surveyor Queue</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full font-mono text-[10px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 font-bold animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              id="navSubmitClaim"
              onClick={() => setCurrentTab('submit')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                currentTab === 'submit'
                  ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              <span>Submit Claim</span>
            </button>
            <button
              id="navAnalyticsAudit"
              onClick={() => setCurrentTab('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                currentTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-[0_0_14px_rgba(37,99,235,0.45)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Analytics &amp; Audit</span>
            </button>
          </nav>
        </div>

        {/* Right Profile & Status Indicators */}
        <div className="flex items-center gap-3.5">
          {/* Telemetry Dual-Ring Pulse Beacon */}
          <div
            id="telemetryBeacon"
            className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:border-emerald-400 hover:shadow-[0_0_22px_rgba(16,185,129,0.4)] transition-all cursor-pointer group"
            title="Low latency telemetry socket: Active (14ms)"
          >
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="beacon-ripple absolute inline-flex h-full w-full rounded-full bg-emerald-400/60"></span>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
            </div>
            <span className="font-mono text-[11px] font-bold text-emerald-300 tracking-wider uppercase group-hover:text-emerald-200">
              BACKEND CONNECTED
            </span>
          </div>

          <div className="h-5 w-[1px] bg-white/[0.1] hidden sm:block"></div>

          {/* User Profile Pill */}
          <div
            id="userProfilePill"
            className="flex items-center gap-2.5 pl-1 group cursor-pointer"
          >
            <div className="text-right hidden xl:block">
              <div className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors">
                Chief Surveyor #409
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Forensic Tier 1
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-[1px] shadow-[0_0_12px_rgba(37,99,235,0.3)] group-hover:shadow-[0_0_18px_rgba(37,99,235,0.6)] group-hover:scale-105 transition-all">
              <div className="w-full h-full rounded-full bg-[#131929] flex items-center justify-center text-blue-400 group-hover:text-cyan-300 transition-colors">
                <User className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
