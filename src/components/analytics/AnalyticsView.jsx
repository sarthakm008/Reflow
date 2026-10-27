// CommitZero - Analytics View
// Pure JavaScript, grounded productivity telemetry and underestimation analysis

import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Layers,
  History,
  Target,
} from 'lucide-react';
import { calculateAnalyticsMetrics } from '../../engine/analytics.js';
import { formatMinutesHuman } from '../../models/sessionModel.js';

export default function AnalyticsView() {
  const { tasks, sessions, setCurrentView } = useApp();

  const metrics = calculateAnalyticsMetrics(tasks, sessions);
  const hasRecordedData = tasks.length > 0 || sessions.length > 0;

  // Find max minutes in daily focus series for scaling bar heights
  const maxDailyMins = Math.max(0, ...metrics.dailyFocusSeries.map((d) => d.minutes));

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Academic Productivity Telemetry</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real data from your focus sessions and schedule outcomes. No fabricated statistics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('focus')}
          className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-2 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          Start Focus Session
        </button>
      </div>

      {!hasRecordedData && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
          Complete some tasks and focus sessions to see your productivity insights.
        </div>
      )}

      {/* METRICS CARDS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Focus Time */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Deep Work</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {formatMinutesHuman(metrics.totalFocusMinutes)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {metrics.totalSessions} recorded session{metrics.totalSessions === 1 ? '' : 's'}
          </p>
        </div>

        {/* Today's Focus */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Today's Focus</span>
            <Calendar className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {formatMinutesHuman(metrics.todayFocusMinutes)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Active logged work today
          </p>
        </div>

        {/* Task Completion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {metrics.completionRate === null ? 'N/A' : `${metrics.completionRate}%`}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.totalTasks === 0 ? 'No tasks recorded yet' : `${metrics.completedCount} of ${metrics.totalTasks} tasks finished`}
          </p>
        </div>

        {/* Estimation Underestimate Factor */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Estimation Ratio</span>
            <Target className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 flex items-baseline gap-1">
            <span>{metrics.underestimationRatio === null ? 'N/A' : `${metrics.underestimationRatio}x`}</span>
            <span className="text-xs font-normal text-slate-400 font-sans">actual/planned</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.underestimationRatio === null
              ? 'Record task work to compare estimates with actual time'
              : metrics.underestimationRatio > 1.1
              ? 'Tending to underestimate task duration'
              : 'Estimations closely align with reality'}
          </p>
        </div>
      </div>

      {/* 7-DAY FOCUS DISTRIBUTION & SUBJECT BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Focus Distribution Bar Visualizer */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">7-Day Focus Time Distribution</h3>
              <p className="text-xs text-slate-500">Recorded active minutes per calendar day</p>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-600">
              Peak: {sessions.length === 0 ? 'N/A' : formatMinutesHuman(maxDailyMins)}
            </span>
          </div>

          <div className="mt-6 flex items-end justify-between gap-3 h-44 px-2">
            {metrics.dailyFocusSeries.map((day, idx) => {
              const heightPct = maxDailyMins > 0 ? Math.round((day.minutes / maxDailyMins) * 100) : 0;
              const hasWork = day.minutes > 0;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-mono font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.minutes > 0 ? `${day.minutes}m` : '0'}
                  </span>

                  <div className="w-full max-w-[42px] bg-slate-100 rounded-t-md h-full flex items-end overflow-hidden p-0.5">
                    <div
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        hasWork ? 'bg-emerald-500 group-hover:bg-emerald-400' : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(hasWork ? 8 : 0, heightPct)}%` }}
                    />
                  </div>

                  <span className="text-[11px] font-medium text-slate-500 truncate w-full text-center">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Subject / Category Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Work by Subject</h3>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>

          <div className="mt-4 space-y-3.5">
            {metrics.subjectBreakdown.length > 0 ? (
              metrics.subjectBreakdown.map((subj, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{subj.subject}</span>
                    <span className="font-mono text-slate-600">
                      {formatMinutesHuman(subj.actualMinutes)} logged
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{subj.taskCount} task{subj.taskCount === 1 ? '' : 's'}</span>
                    <span>{formatMinutesHuman(subj.remainingMinutes)} remaining</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No subjects recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* ESTIMATED VS ACTUAL COMPARATIVE TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Task Estimation vs Actual Work Duration
            </h3>
            <p className="text-xs text-slate-500">
              Helps identify tasks that tend to blow past original estimates.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {metrics.taskAccuracyRecords.length} recorded tasks
          </span>
        </div>

        {metrics.taskAccuracyRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="px-3 py-2.5 rounded-l-lg">Task Title</th>
                  <th className="px-3 py-2.5">Subject</th>
                  <th className="px-3 py-2.5">Estimated</th>
                  <th className="px-3 py-2.5">Actual Logged</th>
                  <th className="px-3 py-2.5">Variance</th>
                  <th className="px-3 py-2.5 rounded-r-lg">Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.taskAccuracyRecords.map((rec) => {
                  const ranOver = rec.varianceMinutes > 0;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{rec.title}</td>
                      <td className="px-3 py-2.5 text-slate-600">{rec.subject}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {formatMinutesHuman(rec.estimatedDurationMinutes)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-800">
                        {formatMinutesHuman(rec.actualWorkMinutes)}
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            ranOver
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ranOver ? `+${rec.varianceMinutes}m` : `${rec.varianceMinutes}m`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700">
                        {rec.ratio}x
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-6 text-center">
            No focus sessions logged yet. Work on tasks in Focus Workspace to view estimation insights.
          </p>
        )}
      </div>

      {/* FOCUS SESSIONS HISTORY LOG */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">Recorded Focus Session Log</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {sessions.length} sessions
          </span>
        </div>

        {sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.slice(0, 10).map((sess) => (
              <div
                key={sess.id}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{sess.taskTitle}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                        sess.outcome === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sess.outcome === 'Incomplete'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {sess.outcome}
                    </span>
                  </div>
                  {sess.notes && (
                    <p className="text-[11px] text-slate-500 mt-0.5 italic">"{sess.notes}"</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-slate-900">
                    {sess.activeDurationMinutes} min
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {sess.startTime ? new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-6 text-center">
            No historical focus sessions logged yet.
          </p>
        )}
      </div>
    </div>
  );
}
