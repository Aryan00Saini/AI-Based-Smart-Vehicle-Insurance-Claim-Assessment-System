import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { SurveyorDashboard } from './pages/SurveyorDashboard';
import { SubmitClaimPage } from './pages/SubmitClaimPage';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'surveyor' | 'submit'>('surveyor');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'surveyor' ? (
          <SurveyorDashboard />
        ) : (
          <SubmitClaimPage onClaimSubmitted={() => setCurrentTab('surveyor')} />
        )}
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        AI-Based Smart Vehicle Insurance Claim Assessment System &bull; Graphic Era Hill University Major Project
      </footer>
    </div>
  );
};

export default App;
