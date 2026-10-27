// Reflow - Dashboard View
// Pure JavaScript, actionable student productivity hub with real workload telemetry

import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Plus,
  BookOpen,
  CheckSquare,
  RefreshCw,
} from 'lucide-react';
import { formatMinutesHuman } from '../../models/sessionModel.js';
import { isTaskOverdue, isTaskDueSoon, TaskStatus, getTaskRemainingMinutes } from '../../models/taskModel.js';

export default function DashboardView({ onOpenNewTaskModal }) {
  const {
    tasks,
    currentPlan,
    planStaleInfo,
    storageWarning,
    preferences,
    activeTimer,
    setCurrentView,
    startFocusSession,
    toggleTaskComplete,
    triggerPlanRecovery,
    generatePlan,
    loadDemoScenario,
  } = useApp();

  const now = new Date();
  const currentHour = now.getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  const fullDateDisplay = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED);
  const pendingTasks = tasks.filter((t) => t.status !== TaskStatus.COMPLETED);

  const overdueTasks = tasks.filter((t) => isTaskOverdue(t, now));
  const dueSoonTasks = tasks.filter((t) => isTaskDueSoon(t, 48, now));

  const totalRemainingMinutes = pendingTasks.reduce(
    (acc, t) => acc + getTaskRemainingMinutes(t),
    0
  );

  const availableStudyMinutes = Number(preferences.maxDailyMinutes) || 180;
  const isOverloaded = totalRemainingMinutes > availableStudyMinutes;

  // Plan stats
  const scheduledBlocks = (currentPlan?.blocks || []).filter((b) => !b.isBreak);
  const totalScheduledMinutes = scheduledBlocks.reduce((acc, b) => acc + (b.durationMinutes || 0), 0);
  const unscheduledCount = (currentPlan?.unscheduledTasks || []).length;

  // Next recommended task
  const nextScheduledBlock = scheduledBlocks[0] || null;
  const nextTask = nextScheduledBlock
    ? tasks.find((t) => t.id === nextScheduledBlock.taskId)
    : pendingTasks[0] || null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Academic Command Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {greeting}, Scholar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{fullDateDisplay}</p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onOpenNewTaskModal()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>

          <button
            type="button"
            onClick={() => generatePlan()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Calendar className="w-4 h-4 text-slate-600" />
            <span>Generate Plan</span>
          </button>

          <button
            type="button"
            onClick={() => triggerPlanRecovery()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Plan Recovery</span>
          </button>
        </div>
      </div>

      {/* STORAGE WARNING BANNER */}
      {storageWarning && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs text-red-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{storageWarning}</span>
          </div>
        </div>
      )}

      {/* SCHEDULE STALENESS / INVALIDATION ALERT BANNER */}
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
            Recalculate Schedule
          </button>
        </div>
      )}

      {/* OVERLOAD ALERT BANNER (If work exceeds available time) */}
      {isOverloaded && (
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-900">
                  Workload Overload Detected: {formatMinutesHuman(totalRemainingMinutes)} Queued Work
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-200 text-amber-800 font-semibold">
                  +{totalRemainingMinutes - availableStudyMinutes}m Deficit
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                You have {formatMinutesHuman(totalRemainingMinutes)} of incomplete work queued, but your configured study budget for today is only {formatMinutesHuman(availableStudyMinutes)}.
                Reflow scheduled the most urgent items and flagged deferred tasks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentView('planner')}
              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-200/70 hover:bg-amber-200 rounded-lg transition-colors"
            >
              Inspect Schedule
            </button>
            <button
              type="button"
              onClick={() => triggerPlanRecovery()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Repair Plan
            </button>
          </div>
        </div>
      )}

      {/* OVERDUE TASKS BANNER */}
      {overdueTasks.length > 0 && (
        <div className="bg-red-50/90 border border-red-300 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <span className="text-xs font-bold text-red-900">
                {overdueTasks.length} task{overdueTasks.length > 1 ? 's are' : ' is'} overdue!
              </span>
              <p className="text-xs text-red-700 mt-0.5">
                Past deadlines must be prioritized or rescheduled.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCurrentView('tasks')}
            className="px-3 py-1 text-xs font-semibold text-red-800 bg-red-100 hover:bg-red-200 rounded-lg transition-colors shrink-0"
          >
            Review Overdue Tasks
          </button>
        </div>
      )}

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available study time */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Study Budget Today</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatMinutesHuman(availableStudyMinutes)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {preferences.startTime} to {preferences.endTime} window
          </p>
        </div>

        {/* Scheduled Work */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Scheduled Today</span>
            <Calendar className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatMinutesHuman(totalScheduledMinutes)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {scheduledBlocks.length} block{scheduledBlocks.length === 1 ? '' : 's'} allocated
          </p>
        </div>

        {/* Remaining Work */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Queued Work</span>
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div className={`text-xl sm:text-2xl font-bold font-mono ${isOverloaded ? 'text-amber-600' : 'text-slate-900'}`}>
            {formatMinutesHuman(totalRemainingMinutes)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {pendingTasks.length} pending task{pendingTasks.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Completed Tasks */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Completed Work</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {completedTasks.length} <span className="text-xs font-normal text-slate-500">/ {totalTasks}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0}% completion rate
          </p>
        </div>
      </div>

      {/* EMPTY STATE IF NO TASKS */}
      {tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Academic Tasks Yet</h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
            Add assignments, code revisions, or exam prep to calculate your realistic schedule and recover intelligently.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onOpenNewTaskModal()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
            >
              Add First Task
            </button>
            <button
              type="button"
              onClick={() => loadDemoScenario()}
              className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
            >
              Load College Demo Tasks
            </button>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN CONTENT */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Recommended Focus Card + Today's Agenda (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* NEXT FOCUS SESSION CARD */}
            {nextTask && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                      Recommended Next Focus
                    </span>
                  </div>
                  <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {formatMinutesHuman(nextTask.remainingDurationMinutes || nextTask.estimatedDurationMinutes)}
                  </span>
                </div>

                <div className="mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      {nextTask.subject || 'General'}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        nextTask.priority === 'High'
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {nextTask.priority} Priority
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mt-2 tracking-tight">
                    {nextTask.title}
                  </h3>
                  {nextTask.description && (
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                      {nextTask.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    {nextScheduledBlock ? (
                      <span>Scheduled time: <strong className="text-white font-mono">{nextScheduledBlock.startTime} - {nextScheduledBlock.endTime}</strong></span>
                    ) : (
                      <span>Pending focus session</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => startFocusSession(nextTask.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Focus Session</span>
                  </button>
                </div>
              </div>
            )}

            {/* TODAY'S SCHEDULE OVERVIEW */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">Today's Schedule Blocks</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('planner')}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <span>Detailed Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                {currentPlan?.blocks && currentPlan.blocks.length > 0 ? (
                  currentPlan.blocks.map((block) => {
                    if (block.isBreak) {
                      return (
                        <div
                          key={block.id}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-500 font-mono"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            {block.title} ({block.durationMinutes}m)
                          </span>
                          <span>{block.startTime} - {block.endTime}</span>
                        </div>
                      );
                    }

                    const associatedTask = tasks.find((t) => t.id === block.taskId);
                    const isDone = associatedTask?.status === TaskStatus.COMPLETED;

                    return (
                      <div
                        key={block.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                          isDone
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white hover:bg-slate-50/80 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => associatedTask && toggleTaskComplete(associatedTask.id)}
                            className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 hover:border-slate-400 text-transparent'
                            }`}
                            title={isDone ? 'Mark Incomplete' : 'Mark Completed'}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {block.taskTitle}
                              </span>
                              {block.isSplit && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-medium">
                                  Split ({block.durationMinutes}m)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{block.subject}</span>
                              <span>•</span>
                              <span>{block.priority} Priority</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {block.startTime} - {block.endTime}
                          </span>
                          {!isDone && associatedTask && (
                            <button
                              type="button"
                              onClick={() => startFocusSession(associatedTask.id)}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Start Focus on this block"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No plan generated for today yet.
                    <button
                      type="button"
                      onClick={() => generatePlan()}
                      className="block mx-auto mt-2 text-emerald-600 font-semibold hover:underline"
                    >
                      Generate Schedule Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Deadlines & Quick Recovery Widget (1 Col) */}
          <div className="space-y-6">
            {/* UPCOMING DEADLINES WIDGET */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">Upcoming Deadlines</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('tasks')}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  View All
                </button>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {tasks
                  .filter((t) => t.status !== TaskStatus.COMPLETED && t.deadline)
                  .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                  .slice(0, 5)
                  .map((task) => {
                    const isOver = isTaskOverdue(task, now);
                    const deadlineDate = new Date(task.deadline);
                    const dateFormatted = deadlineDate.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div key={task.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {task.title}
                          </p>
                          <p className={`text-[11px] font-medium mt-0.5 ${isOver ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                            {isOver ? 'Overdue: ' : 'Due: '} {dateFormatted}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            task.priority === 'High'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    );
                  })}

                {tasks.filter((t) => t.status !== TaskStatus.COMPLETED && t.deadline).length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    No tasks with upcoming deadlines.
                  </p>
                )}
              </div>
            </div>

            {/* INTELLIGENT PLAN RECOVERY WIDGET */}
            <div className="bg-emerald-950 text-white rounded-xl p-5 border border-emerald-900 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>The Core Differentiator</span>
              </div>
              <h4 className="text-sm font-bold text-white mt-1">
                Plan Recovery Engine
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Fell behind or underestimated task duration? Reflow recalculates a realistic schedule without simply shaming you with red overdue labels.
              </p>

              <button
                type="button"
                onClick={() => triggerPlanRecovery()}
                className="mt-4 w-full py-2 px-3 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze & Recover Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
