import React from 'react';
import { ShieldCheck, FileSpreadsheet, PlusCircle, Car } from 'lucide-react';

interface NavbarProps {
  currentTab: 'surveyor' | 'submit';
  setCurrentTab: (tab: 'surveyor' | 'submit') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                AutoClaim <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 font-semibold border border-blue-700/50">AI Triage</span>
              </h1>
              <p className="text-xs text-slate-400">Smart Vehicle Insurance Assessment Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <nav className="flex space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setCurrentTab('surveyor')}
                className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  currentTab === 'surveyor'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Surveyor Queue</span>
              </button>

              <button
                onClick={() => setCurrentTab('submit')}
                className={`flex items-center space-x-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  currentTab === 'submit'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Submit Claim</span>
              </button>
            </nav>

            <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-slate-800 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-slate-400">Backend Connected</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
