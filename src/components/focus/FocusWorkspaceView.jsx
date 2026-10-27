// CommitZero - Focus Workspace View
// Pure JavaScript, distraction-free deep work timer with accurate timestamp tracking

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { formatTimeDisplay, formatMinutesHuman } from '../../models/sessionModel.js';
import { TaskStatus } from '../../models/taskModel.js';

export default function FocusWorkspaceView() {
  const {
    tasks,
    activeTimer,
    liveElapsedSeconds,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    finishFocusSession,
    cancelFocusSession,
    triggerPlanRecovery,
    setCurrentView,
  } = useApp();

  // Task selection when starting a new session
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [customMinutes, setCustomMinutes] = useState(25);

  // Finish session dialog state
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [isTaskCompletedOption, setIsTaskCompletedOption] = useState(false);
  const [newRemainingMinutes, setNewRemainingMinutes] = useState(30);
  const [sessionNotes, setSessionNotes] = useState('');

  // Find active task object
  const activeTask = activeTimer ? tasks.find((t) => t.id === activeTimer.taskId) : null;
  const eligibleTasks = tasks.filter((t) => t.status !== TaskStatus.COMPLETED);

  // Initialize selectedTaskId default
  useEffect(() => {
    if (!selectedTaskId && eligibleTasks.length > 0) {
      setSelectedTaskId(eligibleTasks[0].id);
      setCustomMinutes(eligibleTasks[0].remainingDurationMinutes || 25);
    }
  }, [eligibleTasks, selectedTaskId]);

  const handleTaskSelectionChange = (e) => {
    const tid = e.target.value;
    setSelectedTaskId(tid);
    const t = tasks.find((item) => item.id === tid);
    if (t) {
      setCustomMinutes(t.remainingDurationMinutes || 25);
    }
  };

  const handleStartFromSelector = () => {
    if (!selectedTaskId) return;
    startFocusSession(selectedTaskId, Number(customMinutes));
  };

  // Open finish dialog
  const handleInitiateFinish = () => {
    if (!activeTimer) return;
    const elapsedMins = Math.max(1, Math.round(liveElapsedSeconds / 60));
    const currentRemaining = activeTask?.remainingDurationMinutes || 0;
    const estimatedNewRemaining = Math.max(0, currentRemaining - elapsedMins);

    setIsTaskCompletedOption(estimatedNewRemaining === 0);
    setNewRemainingMinutes(estimatedNewRemaining);
    setSessionNotes('');
    setShowFinishDialog(true);
  };

  const handleConfirmFinish = (triggerRecoveryAfter = false) => {
    const result = finishFocusSession({
      isTaskComplete: isTaskCompletedOption,
      remainingMinutes: isTaskCompletedOption ? 0 : Number(newRemainingMinutes),
      notes: sessionNotes,
    });

    setShowFinishDialog(false);

    if (triggerRecoveryAfter && activeTimer) {
      triggerPlanRecovery({
        triggerReason: 'Task took longer than expected',
        affectedTaskId: activeTimer.taskId,
      });
    }
  };

  // Calculate timer visual progress
  const plannedSeconds = (activeTimer?.plannedDurationMinutes || 25) * 60;
  const percentProgress = Math.min(100, Math.round((liveElapsedSeconds / (plannedSeconds || 1)) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Focus Workspace</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitored academic deep work with true active-time recording.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('planner')}
          className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors self-start sm:self-auto"
        >
          View Daily Schedule
        </button>
      </div>

      {/* ACTIVE TIMER INTERFACE */}
      {activeTimer ? (
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-10 shadow-lg border border-slate-800 text-center space-y-6 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Active task badge & title */}
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
              <span className={`w-2 h-2 rounded-full ${activeTimer.isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
              <span className="text-slate-300 font-medium">{activeTask?.subject || 'Academic Task'}</span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-emerald-400 font-semibold">
                Planned: {formatMinutesHuman(activeTimer.plannedDurationMinutes)}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white max-w-xl mx-auto">
              {activeTimer.taskTitle}
            </h2>

            {activeTimer.isPaused && (
              <div className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                Session Paused — Paused time is not counted
              </div>
            )}
          </div>

          {/* Big Digital Timer Display */}
          <div className="relative z-10 py-4">
            <div className="font-mono text-6xl sm:text-8xl font-black tracking-tight text-white drop-shadow-sm select-none">
              {formatTimeDisplay(liveElapsedSeconds)}
            </div>

            <div className="mt-2 text-xs text-slate-400 font-mono">
              Elapsed Active Work
            </div>

            {/* Visual progress bar */}
            <div className="max-w-md mx-auto mt-6 bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  activeTimer.isPaused ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${percentProgress}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-2">
              {percentProgress}% of planned {activeTimer.plannedDurationMinutes}m
            </div>
          </div>

          {/* Controls: Pause/Resume, Finish, Cancel */}
          <div className="relative z-10 flex items-center justify-center gap-3 pt-4">
            {activeTimer.isPaused ? (
              <button
                type="button"
                onClick={resumeFocusSession}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-md transition-all hover:scale-105"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Session</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseFocusSession}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleInitiateFinish}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl shadow-md transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Finish & Record</span>
            </button>

            <button
              type="button"
              onClick={cancelFocusSession}
              className="p-3 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Cancel session"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* NO ACTIVE TIMER: START NEW FOCUS SESSION */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Start an Academic Focus Session</h2>
            <p className="text-xs text-slate-500">
              Pick a task to track actual deep work time against your daily plan.
            </p>
          </div>

          {eligibleTasks.length > 0 ? (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Task to Work On
                </label>
                <select
                  value={selectedTaskId}
                  onChange={handleTaskSelectionChange}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {eligibleTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title} ({task.remainingDurationMinutes || task.estimatedDurationMinutes}m remaining) — {task.priority} Priority
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Session Length (Minutes)
                </label>
                <div className="flex items-center gap-2">
                  {[25, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setCustomMinutes(mins)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        customMinutes === mins
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleStartFromSelector}
                  className="w-full py-3 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Begin Focus Session ({customMinutes} min)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-slate-500">All tasks are completed! Add a new task to start focusing.</p>
              <button
                type="button"
                onClick={() => setCurrentView('tasks')}
                className="mt-3 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Go to Task Manager
              </button>
            </div>
          )}
        </div>
      )}

      {/* FINISH SESSION MODAL (Decision Support: is it done? how much remains?) */}
      {showFinishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Record Focus Session
            </h3>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-800">{activeTask?.title}</span>
              <p className="text-slate-500 mt-0.5">
                Actual time logged: <strong className="font-mono text-emerald-600 font-bold">{Math.max(1, Math.round(liveElapsedSeconds / 60))} minutes</strong>
              </p>
            </div>

            {/* Did this finish? */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Is this task completely finished?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsTaskCompletedOption(true)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                    isTaskCompletedOption
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Yes, Completed!
                </button>
                <button
                  type="button"
                  onClick={() => setIsTaskCompletedOption(false)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                    !isTaskCompletedOption
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  No, Work Remains
                </button>
              </div>
            </div>

            {/* If work remains, ask how many minutes */}
            {!isTaskCompletedOption && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  How many minutes of work still remain?
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  step="5"
                  value={newRemainingMinutes}
                  onChange={(e) => setNewRemainingMinutes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Example: If the task ran over, input the realistic additional minutes needed.
                </span>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Session Reflection or Progress Notes (Optional)
              </label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="What did you get through? Any blockers or formulas to review?"
                rows="2"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleConfirmFinish(false)}
                className="w-full py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
              >
                Save & Update Task Progress
              </button>

              {!isTaskCompletedOption && (
                <button
                  type="button"
                  onClick={() => handleConfirmFinish(true)}
                  className="w-full py-2 text-xs font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save & Trigger Plan Recovery Immediately</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowFinishDialog(false)}
                className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-700 text-center"
              >
                Back to Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
