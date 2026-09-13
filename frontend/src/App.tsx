import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { SurveyorDashboard } from './pages/SurveyorDashboard';
import { SubmitClaimPage } from './pages/SubmitClaimPage';
import { AnalyticsModal } from './components/AnalyticsModal';
import { fetchClaims } from './services/api';
import { Claim } from './types';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'surveyor' | 'submit' | 'analytics'>('surveyor');
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    fetchClaims()
      .then((data) => setClaims(data))
      .catch(() => {});
  }, [currentTab]);

  const pendingCount = claims.filter((c) => c.status !== 'APPROVED' && c.status !== 'REJECTED').length;

  return (
    <div className="min-h-screen bg-[#0B0F19] bg-gradient-to-b from-[#0B0F19] via-[#0d1322] to-[#090D15] text-slate-200 antialiased selection:bg-blue-600/30 selection:text-white bg-grid-cyber relative flex flex-col justify-between">
      {/* Header / Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingCount={pendingCount}
      />

      {/* Main Content Dashboard */}
      <main className="w-full pt-24 pb-16 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {currentTab === 'submit' ? (
          <SubmitClaimPage onClaimSubmitted={() => setCurrentTab('surveyor')} />
        ) : (
          <SurveyorDashboard />
        )}
      </main>

      {/* Analytics Modal */}
      <AnalyticsModal
        isOpen={currentTab === 'analytics'}
        onClose={() => setCurrentTab('surveyor')}
        claims={claims}
      />

      {/* Footer */}
      <footer className="w-full bg-[#070A12] border-t border-white/[0.08] py-5 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              AI-BASED SMART VEHICLE INSURANCE CLAIM ASSESSMENT SYSTEM
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Triage Engine v4.2
            </span>
            <span>•</span>
            <span>Model Precision 99.4%</span>
            <span>•</span>
            <span className="text-slate-500">Graphic Era Hill University Major Project</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
