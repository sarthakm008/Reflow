// CommitZero - Sidebar Navigation
// Pure JavaScript, collegiate productivity design, responsive navigation

import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Timer,
  RefreshCw,
  BarChart3,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatMinutesHuman } from '../../models/sessionModel.js';

export default function Sidebar({ isMobileMenuOpen, onCloseMobileMenu }) {
  const {
    currentView,
    setCurrentView,
    tasks,
    currentPlan,
    planStaleInfo,
    preferences,
    activeTimer,
    recoveryProposal,
  } = useApp();

  const pendingCount = tasks.filter((t) => t.status !== 'Completed').length;
  const overdueCount = tasks.filter((t) => {
    if (t.status === 'Completed' || !t.deadline) return false;
    return new Date(t.deadline).getTime() < Date.now();
  }).length;

  const totalRemainingMins = tasks
    .filter((t) => t.status !== 'Completed')
    .reduce((acc, t) => acc + (t.remainingDurationMinutes !== undefined ? t.remainingDurationMinutes : t.estimatedDurationMinutes || 0), 0);

  const availableStudyMins = Number(preferences.maxDailyMinutes) || 180;
  const isOverloaded = totalRemainingMins > availableStudyMins;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'tasks',
      label: 'Task Manager',
      icon: CheckSquare,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-slate-700 text-slate-300',
    },
    {
      id: 'planner',
      label: 'Daily Planner',
      icon: Calendar,
      badge: planStaleInfo?.isStale ? 'Update Needed' : isOverloaded ? 'Overloaded' : null,
      badgeColor: 'bg-amber-900/60 text-amber-300 border border-amber-700/50',
    },
    {
      id: 'focus',
      label: 'Focus Workspace',
      icon: Timer,
      badge: activeTimer ? 'Active' : null,
      badgeColor: 'bg-emerald-900/80 text-emerald-300 border border-emerald-600/50 animate-pulse',
    },
    {
      id: 'recovery',
      label: 'Plan Recovery',
      icon: RefreshCw,
      badge: recoveryProposal ? 'Reviewing' : isOverloaded ? 'Recommended' : null,
      badgeColor: 'bg-sky-900/70 text-sky-200 border border-sky-700/50',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
    },
  ];

  const handleNavClick = (viewId) => {
    setCurrentView(viewId);
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-xs"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
          {/* Main Navigation links */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Productivity Views
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white font-semibold shadow-xs border-l-2 border-emerald-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                        item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Overdue Alert pill if tasks are overdue */}
          {overdueCount > 0 && (
            <div
              onClick={() => handleNavClick('tasks')}
              className="mx-1 p-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs cursor-pointer hover:bg-red-950/60 transition-colors"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{overdueCount} Overdue Task{overdueCount > 1 ? 's' : ''}</span>
              </div>
              <p className="text-[11px] text-red-400/80 mt-1">
                Deadlines missed. Review in Task Manager.
              </p>
            </div>
          )}
        </div>

        {/* Capacity summary footer card */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90">
          <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs">
            <div className="flex items-center justify-between text-slate-300 mb-1.5">
              <span className="text-[11px] font-medium flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                Study Budget
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                {formatMinutesHuman(availableStudyMins)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-2">
              <span>Queued Work:</span>
              <span className={`font-mono font-medium ${isOverloaded ? 'text-amber-400' : 'text-slate-300'}`}>
                {formatMinutesHuman(totalRemainingMins)}
              </span>
            </div>

            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverloaded ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((totalRemainingMins / (availableStudyMins || 1)) * 100))}%`,
                }}
              />
            </div>

            {isOverloaded && (
              <button
                type="button"
                onClick={() => handleNavClick('recovery')}
                className="mt-2.5 w-full py-1 text-[11px] font-semibold text-center text-amber-300 hover:text-amber-200 bg-amber-950/50 hover:bg-amber-950/80 border border-amber-800/60 rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                Recover Overload
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
