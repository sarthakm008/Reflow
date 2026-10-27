// Reflow - Daily Planner View
// Pure JavaScript, transparent chronological schedule generator with availability configuration

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Calendar,
  Clock,
  Play,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Ban,
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Scissors,
} from 'lucide-react';
import { formatMinutesHuman } from '../../models/sessionModel.js';
import { TaskStatus } from '../../models/taskModel.js';

export default function PlannerView() {
  const {
    tasks,
    preferences,
    currentPlan,
    planStaleInfo,
    generatePlan,
    applyPlan,
    startFocusSession,
    toggleTaskComplete,
    triggerPlanRecovery,
  } = useApp();

  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    planDate: preferences.planDate || new Date().toISOString().split('T')[0],
    startTime: preferences.startTime || '09:00',
    endTime: preferences.endTime || '17:00',
    maxDailyMinutes: preferences.maxDailyMinutes ?? 180,
    breakDurationMinutes: preferences.breakDurationMinutes ?? 10,
    workIntervalMinutes: preferences.workIntervalMinutes ?? 50,
    unavailablePeriods: preferences.unavailablePeriods || [],
  });

  // State for adding a new unavailable period
  const [newPeriod, setNewPeriod] = useState({ title: '', startTime: '12:00', endTime: '13:00' });

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfigForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddUnavailablePeriod = () => {
    if (!newPeriod.title.trim()) return;
    const periodObj = {
      id: `unavail_${Date.now()}`,
      title: newPeriod.title.trim(),
      startTime: newPeriod.startTime,
      endTime: newPeriod.endTime,
    };
    setConfigForm((prev) => ({
      ...prev,
      unavailablePeriods: [...prev.unavailablePeriods, periodObj],
    }));
    setNewPeriod({ title: '', startTime: '12:00', endTime: '13:00' });
  };

  const handleRemoveUnavailablePeriod = (periodId) => {
    setConfigForm((prev) => ({
      ...prev,
      unavailablePeriods: prev.unavailablePeriods.filter((p) => p.id !== periodId),
    }));
  };

  const handleSaveAndGenerate = (e) => {
    e.preventDefault();
    const updatedPrefs = {
      ...configForm,
      maxDailyMinutes: Number(configForm.maxDailyMinutes),
      breakDurationMinutes: Number(configForm.breakDurationMinutes),
      workIntervalMinutes: Number(configForm.workIntervalMinutes),
    };
    generatePlan(updatedPrefs);
    setShowConfig(false);
  };

  const stats = currentPlan?.stats;
  const isOverloaded = stats?.isOverloaded;
  const blocks = currentPlan?.blocks || [];
  const partiallyScheduledTasks = currentPlan?.partiallyScheduledTasks || [];
  const unscheduledTasks = currentPlan?.unscheduledTasks || [];
  const deadlineRisks = currentPlan?.deadlineRisks || [];
  const validationError = currentPlan?.validationError;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Daily Schedule Planner</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic, conflict-free chronological scheduling based on your actual study window.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Availability Settings</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => generatePlan(preferences)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Recalculate Schedule</span>
          </button>
        </div>
      </div>

      {/* SCHEDULE STALENESS / INVALIDATION ALERT */}
      {planStaleInfo?.isStale && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <RefreshCw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">Schedule Invalidation Notice</p>
              <p className="text-xs text-amber-800 mt-0.5">{planStaleInfo.reason}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => generatePlan()}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shrink-0 transition-colors shadow-xs"
          >
            Recalculate Schedule Now
          </button>
        </div>
      )}

      {/* CONFIGURATION / VALIDATION ERROR */}
      {validationError && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-900">Invalid Availability Window</p>
            <p className="text-xs text-red-800 mt-0.5">{validationError}</p>
          </div>
        </div>
      )}

      {/* AVAILABILITY CONFIGURATION PANEL (Collapsible) */}
      {showConfig && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-in fade-in">
          <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
            Study Window & Availability Preferences
          </h2>

          <form onSubmit={handleSaveAndGenerate} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date</label>
                <input
                  type="date"
                  name="planDate"
                  value={configForm.planDate}
                  onChange={handleConfigChange}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Day Start Time</label>
                <input
                  type="time"
                  name="startTime"
                  value={configForm.startTime}
                  onChange={handleConfigChange}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Day End Time</label>
                <input
                  type="time"
                  name="endTime"
                  value={configForm.endTime}
                  onChange={handleConfigChange}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daily Study Budget (Minutes)
                </label>
                <input
                  type="number"
                  name="maxDailyMinutes"
                  value={configForm.maxDailyMinutes}
                  onChange={handleConfigChange}
                  min="0"
                  max="720"
                  step="15"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {formatMinutesHuman(configForm.maxDailyMinutes)} maximum planned focus
                </span>
              </div>
            </div>

            {/* Break Preferences & Work Intervals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Interval (Minutes)
                </label>
                <input
                  type="number"
                  name="workIntervalMinutes"
                  value={configForm.workIntervalMinutes}
                  onChange={handleConfigChange}
                  min="15"
                  max="180"
                  step="5"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Max continuous focus block before a rest break
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buffer Break Duration (Minutes)
                </label>
                <input
                  type="number"
                  name="breakDurationMinutes"
                  value={configForm.breakDurationMinutes}
                  onChange={handleConfigChange}
                  min="0"
                  max="60"
                  step="5"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unavailable Periods
                </label>
                <div className="space-y-1.5">
                  {configForm.unavailablePeriods.map((period) => (
                    <div
                      key={period.id}
                      className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                    >
                      <span className="font-medium text-slate-700">
                        {period.title} ({period.startTime} - {period.endTime})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUnavailablePeriod(period.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="e.g. Lunch"
                      value={newPeriod.title}
                      onChange={(e) => setNewPeriod({ ...newPeriod, title: e.target.value })}
                      className="text-xs px-2 py-1 border border-slate-300 rounded w-1/3"
                    />
                    <input
                      type="time"
                      value={newPeriod.startTime}
                      onChange={(e) => setNewPeriod({ ...newPeriod, startTime: e.target.value })}
                      className="text-xs px-2 py-1 border border-slate-300 rounded"
                    />
                    <span className="text-xs text-slate-400">to</span>
                    <input
                      type="time"
                      value={newPeriod.endTime}
                      onChange={(e) => setNewPeriod({ ...newPeriod, endTime: e.target.value })}
                      className="text-xs px-2 py-1 border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={handleAddUnavailablePeriod}
                      className="text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 px-2.5 py-1 rounded"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
              >
                Apply & Regenerate
              </button>
            </div>
          </form>
        </div>
      )}

      {/* OVERLOAD AND STATS BANNER */}
      {stats && (
        <div
          className={`p-4 rounded-xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isOverloaded ? 'bg-amber-50/90 border-amber-300' : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {isOverloaded ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isOverloaded ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {isOverloaded ? 'Capacity Overload Detected' : 'Feasible Schedule Generated'}
                </span>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                  {formatMinutesHuman(stats.totalAllocatedMinutes)} Allocated / {formatMinutesHuman(stats.availableStudyBudgetMinutes)} Study Budget
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                {isOverloaded
                  ? `Total remaining work across eligible tasks is ${formatMinutesHuman(stats.totalRemainingWorkMinutes)}, which exceeds today's ${formatMinutesHuman(stats.availableStudyBudgetMinutes)} limit. Reflow scheduled a feasible subset (${stats.scheduledTasksCount} tasks: ${stats.scheduledTasksCount - stats.partiallyScheduledTasksCount} fully, ${stats.partiallyScheduledTasksCount} partially) and deferred ${stats.unscheduledTasksCount} tasks.`
                  : `All eligible work (${formatMinutesHuman(stats.totalAllocatedMinutes)}) has been allocated into non-overlapping chronological blocks.`}
              </p>
            </div>
          </div>

          {isOverloaded && (
            <button
              type="button"
              onClick={() => triggerPlanRecovery()}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-300 hover:bg-amber-400 rounded-lg shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch Plan Recovery</span>
            </button>
          )}
        </div>
      )}

      {/* DEADLINE RISKS (IF ANY) */}
      {deadlineRisks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>Critical Deadline Risks Detected:</span>
          </div>
          <div className="space-y-1.5">
            {deadlineRisks.map((risk, idx) => (
              <div key={idx} className="text-xs text-red-800 bg-white/80 border border-red-200 rounded-md p-2">
                <strong className="font-semibold text-red-950">{risk.taskTitle}: </strong>
                {risk.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN SCHEDULE VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Chronological Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Chronological Timeline</h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {preferences.startTime} — {preferences.endTime}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {blocks.length > 0 ? (
                blocks.map((block) => {
                  if (block.isBreak) {
                    return (
                      <div
                        key={block.id}
                        className="flex items-center justify-between px-4 py-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs font-mono text-slate-500"
                      >
                        <div className="flex items-center gap-2">
                          <Coffee className="w-3.5 h-3.5 text-slate-400" />
                          <span>{block.title} ({block.durationMinutes} min)</span>
                        </div>
                        <span>{block.startTime} — {block.endTime}</span>
                      </div>
                    );
                  }

                  const task = tasks.find((t) => t.id === block.taskId);
                  const isDone = task?.status === TaskStatus.COMPLETED || block.status === 'Completed';

                  return (
                    <div
                      key={block.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isDone
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white hover:border-slate-300 border-slate-200/90 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {block.startTime} — {block.endTime}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              ({formatMinutesHuman(block.durationMinutes)})
                            </span>
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {block.subject}
                            </span>
                            {block.isSplit && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                Split Session ({block.durationMinutes}m allocated)
                              </span>
                            )}
                            {block.chunkNumber && block.totalChunksExpected > 1 && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold">
                                Interval {block.chunkNumber}/{block.totalChunksExpected}
                              </span>
                            )}
                          </div>

                          <h4
                            className={`text-sm font-bold mt-2 ${
                              isDone ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {block.taskTitle}
                          </h4>

                          {task?.deadline && (
                            <p className="text-xs text-slate-500 mt-1">
                              Due: {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => task && toggleTaskComplete(task.id)}
                            className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              isDone
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'border-slate-300 text-slate-600 hover:border-slate-400'
                            }`}
                            title={isDone ? 'Mark Incomplete' : 'Mark Completed'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          {!isDone && task && (
                            <button
                              type="button"
                              onClick={() => startFocusSession(task.id, block.durationMinutes)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-xs transition-colors"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Focus ({block.durationMinutes}m)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  {validationError ? (
                    <span className="text-red-600 font-medium">{validationError}</span>
                  ) : (
                    <>No active blocks scheduled. Click "Recalculate Schedule" above.</>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Partially Scheduled & Unscheduled Work */}
        <div className="space-y-4">
          {/* Partially Scheduled Work */}
          {partiallyScheduledTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                <div className="flex items-center gap-1.5 text-amber-800">
                  <Scissors className="w-4 h-4" />
                  <h3 className="text-sm font-bold">Partially Scheduled Tasks</h3>
                </div>
                <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  {partiallyScheduledTasks.length} Task{partiallyScheduledTasks.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2.5">
                {partiallyScheduledTasks.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="font-bold text-slate-900">{item.task.title}</strong>
                      <span className="font-mono text-[11px] text-amber-900 font-semibold">
                        {item.scheduledMinutes}m scheduled / {item.unallocatedMinutes}m deferred
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {item.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completely Unscheduled Tasks */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Unscheduled Tasks</h3>
              <span className="text-xs font-mono font-bold text-slate-500">
                {unscheduledTasks.length} Task{unscheduledTasks.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {unscheduledTasks.length > 0 ? (
                unscheduledTasks.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="font-bold text-slate-900">{item.task.title}</strong>
                      <span className="font-mono text-[11px] text-slate-600">
                        {formatMinutesHuman(item.unallocatedMinutes)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Priority: {item.task.priority} | Subject: {item.task.subject}
                    </div>

                    <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 leading-relaxed">
                      <strong>Why deferred: </strong>
                      {item.reason}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">
                  All eligible tasks fit within today's schedule.
                </p>
              )}
            </div>

            {(unscheduledTasks.length > 0 || partiallyScheduledTasks.length > 0) && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => triggerPlanRecovery()}
                  className="w-full py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-xs flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Recover & Reorganize Schedule</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
