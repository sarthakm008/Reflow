// CommitZero - Top Navigation Bar
// Pure JavaScript, clean, accessible, with quick action helpers

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Clock,
  RotateCcw,
  Sparkles,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
} from 'lucide-react';
import { formatTimeDisplay } from '../../models/sessionModel.js';

export default function Navbar({ onToggleMobileMenu, isMobileMenuOpen }) {
  const {
    activeTimer,
    liveElapsedSeconds,
    setCurrentView,
    resetAllData,
    notice,
    user,
    signOut,
  } = useApp();

  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const todayDateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Mobile hamburger & Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 focus:outline-none"
              aria-label="Toggle navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div
              onClick={() => setCurrentView('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-mono font-bold text-slate-950 text-base shadow-sm group-hover:bg-emerald-400 transition-colors">
                R
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-tight text-base sm:text-lg text-white font-mono">
                    <span className="text-emerald-400">Reflow</span>
                  </span>
                  <span className="hidden sm:inline-block text-[11px] font-medium tracking-wide text-emerald-400/90 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    ACADEMIC
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-400 leading-tight">
                  Plan realistically. Recover intelligently.
                </p>
              </div>
            </div>
          </div>

          {/* Center: Active Timer pill (if running or paused) */}
          {activeTimer && (
            <div
              onClick={() => setCurrentView('focus')}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full cursor-pointer transition-all border ${
                activeTimer.isPaused
                  ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
                  : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-sm animate-pulse'
              }`}
              title="Click to open Focus Workspace"
            >
              <span className={`w-2 h-2 rounded-full ${activeTimer.isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono text-xs font-semibold">
                {formatTimeDisplay(liveElapsedSeconds)}
              </span>
              <span className="text-xs max-w-[120px] truncate hidden sm:inline text-slate-300">
                {activeTimer.taskTitle}
              </span>
            </div>
          )}

          {/* Right: Date & Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden lg:inline text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              {todayDateFormatted}
            </span>

            <button
              type="button"
              onClick={() => user ? signOut() : setCurrentView('auth')}
              className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
              title={user ? `Sign out ${user.email}` : 'Sign in to sync your data'}
            >
              {user ? <LogOut className="h-3.5 w-3.5 text-emerald-400" /> : <LogIn className="h-3.5 w-3.5 text-emerald-400" />}
              <span className="hidden sm:inline">{user ? 'Sign out' : 'Sign in'}</span>
            </button>

            {!user && (
              <button
                type="button"
                onClick={() => setShowConfirmReset(true)}
                className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md border border-slate-700 transition-colors"
                title="Reset guest data stored on this device"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Reset guest data</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Notification Toast */}
      {notice && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          {notice.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {notice.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {notice.type === 'info' && <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />}
          <p className="text-xs text-slate-200">{notice.message}</p>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Reset Guest Data?</h3>
            <p className="text-xs text-slate-600 mt-2">
              This will permanently remove all tasks, focus sessions, and active plans from localStorage.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetAllData();
                  setShowConfirmReset(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
