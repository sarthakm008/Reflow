// Reflow - Plan Recovery View
// Pure JavaScript, the flagship decision-support and schedule repair system

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  ArrowLeftRight,
  HelpCircle,
  Scissors,
  Check,
  RefreshCw,
} from 'lucide-react';
import { formatMinutesHuman } from '../../models/sessionModel.js';
import { RecoveryTriggerReason } from '../../engine/recovery.js';

export default function PlanRecoveryView() {
  const {
    tasks,
    sessions,
    currentPlan,
    preferences,
    recoveryProposal,
    triggerPlanRecovery,
    acceptRecoveryPlan,
    rejectRecoveryPlan,
    setCurrentView,
  } = useApp();

  // Local controls for fine-tuning recovery parameters
  const [selectedTrigger, setSelectedTrigger] = useState(
    recoveryProposal?.triggerReason || RecoveryTriggerReason.TASK_RAN_OVER
  );

  const [overrideAvailableMins, setOverrideAvailableMins] = useState(
    recoveryProposal?.effectiveAvailableMinutes !== undefined
      ? recoveryProposal.effectiveAvailableMinutes
      : 90
  );

  // Re-run analysis when trigger or available minutes change
  const handleRecalculateProposal = (customMins = null, customTrigger = null) => {
    const mins = customMins !== null ? customMins : overrideAvailableMins;
    const trig = customTrigger || selectedTrigger;

    triggerPlanRecovery({
      triggerReason: trig,
      overrideAvailableMinutes: Number(mins),
      useCurrentTimeAsStart: true,
    });
  };

  // Ensure recovery proposal is generated if user opened recovery view directly without an active proposal
  useEffect(() => {
    if (!recoveryProposal) {
      triggerPlanRecovery({
        triggerReason: RecoveryTriggerReason.MANUAL_REQUEST,
      });
    }
  }, []);

  const proposal = recoveryProposal;

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Core Differentiator • 8-Step Intelligent Recovery</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
            Plan Recovery Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
            When tasks take longer, sessions get cut short, or unplanned delays occur, Reflow recalibrates your workload with transparent reasoning instead of passive guilt.
          </p>
        </div>

        {/* Quick Decision Actions */}
        {proposal && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={rejectRecoveryPlan}
              className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
            >
              Decline Changes
            </button>

            <button
              type="button"
              onClick={acceptRecoveryPlan}
              className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-md transition-all flex items-center gap-2 hover:scale-[1.02]"
            >
              <CheckCircle2 className="w-4 h-4 fill-current" />
              <span>Accept Revised Plan</span>
            </button>
          </div>
        )}
      </div>

      {/* RECOVERY TUNING & SCENARIO SELECTION */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Recovery Scenario & Capacity Adjuster
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              What caused the schedule deviation?
            </label>
            <select
              value={selectedTrigger}
              onChange={(e) => {
                const newT = e.target.value;
                setSelectedTrigger(newT);
                handleRecalculateProposal(overrideAvailableMins, newT);
              }}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={RecoveryTriggerReason.TASK_RAN_OVER}>A task took longer than expected</option>
              <option value={RecoveryTriggerReason.SESSION_UNFINISHED}>A focus session ended while task remains unfinished</option>
              <option value={RecoveryTriggerReason.TIME_REDUCED}>I have less time available today than expected</option>
              <option value={RecoveryTriggerReason.SKIPPED_TASK}>A scheduled task was skipped or delayed</option>
              <option value={RecoveryTriggerReason.URGENT_TASK_ADDED}>A new urgent assignment was added</option>
              <option value={RecoveryTriggerReason.DEADLINE_AT_RISK}>A deadline is approaching and at risk</option>
              <option value={RecoveryTriggerReason.MANUAL_REQUEST}>General schedule optimization</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Remaining Study Capacity Today (Minutes)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="15"
                max="600"
                step="15"
                value={overrideAvailableMins}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setOverrideAvailableMins(val);
                }}
                className="w-1/2 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleRecalculateProposal(overrideAvailableMins, selectedTrigger)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-run Analysis</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {formatMinutesHuman(overrideAvailableMins)} remaining focus window
            </span>
          </div>
        </div>
      </div>

      {proposal && (
        <>
          {/* STEP 1 TO 5: TRANSPARENT DECISION RATIONALE */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Algorithmic Rationale & Transparent Decisions
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Workload: {formatMinutesHuman(proposal.totalRemainingWorkMinutes)} vs Capacity: {formatMinutesHuman(proposal.effectiveAvailableMinutes)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {proposal.explanations.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    item.type === 'capacity'
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : item.type === 'deferral'
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : item.type === 'split'
                      ? 'bg-sky-50 border-sky-200 text-sky-900'
                      : item.type === 'deadline_risk'
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0" />
                  <p className="leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Changes Summary Pills */}
            <div className="pt-2 flex items-center gap-3 flex-wrap text-xs font-mono">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                Moved to Later: <strong className="text-slate-900">{proposal.diffSummary.tasksMovedOutCount}</strong>
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                Split Sessions: <strong className="text-slate-900">{proposal.diffSummary.tasksSplitCount}</strong>
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                Timing Shifts: <strong className="text-slate-900">{proposal.diffSummary.tasksRescheduledCount}</strong>
              </span>
            </div>
          </div>

          {/* STEP 6: SIDE-BY-SIDE SCHEDULE PREVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ORIGINAL REMAINING SCHEDULE */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-600">Current Plan (Unrecovered)</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {proposal.originalRemainingBlocks.length} blocks
                </span>
              </div>

              <div className="space-y-2.5">
                {proposal.originalRemainingBlocks.length > 0 ? (
                  proposal.originalRemainingBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">{block.taskTitle}</span>
                        <span className="font-mono text-slate-500">{block.startTime} - {block.endTime}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {block.subject} • {formatMinutesHuman(block.durationMinutes)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No active blocks remained in original schedule.
                  </p>
                )}
              </div>
            </div>

            {/* PROPOSED REVISED SCHEDULE */}
            <div className="bg-white rounded-xl border-2 border-emerald-500/60 p-5 shadow-sm space-y-4 relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-emerald-950">Proposed Revised Plan</h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  Feasible & Non-overlapping
                </span>
              </div>

              <div className="space-y-2.5">
                {proposal.revisedPlan.blocks.length > 0 ? (
                  proposal.revisedPlan.blocks.map((block) => {
                    if (block.isBreak) {
                      return (
                        <div
                          key={block.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 font-mono flex items-center justify-between"
                        >
                          <span>{block.title} ({block.durationMinutes}m)</span>
                          <span>{block.startTime} - {block.endTime}</span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={block.id}
                        className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{block.taskTitle}</span>
                          <span className="font-mono font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            {block.startTime} - {block.endTime}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex items-center gap-2">
                          <span>{block.subject}</span>
                          <span>•</span>
                          <span>{formatMinutesHuman(block.durationMinutes)}</span>
                          {block.isSplit && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold">
                              Split
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No tasks fit into remaining time window.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* STEP 7 & 8: STUDENT DECISION CONTROLS */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Apply this revised schedule to your day?
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Historical focus logs are preserved. Completed tasks stay completed. Your dashboard updates immediately.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={rejectRecoveryPlan}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Reject Changes
              </button>
              <button
                type="button"
                onClick={acceptRecoveryPlan}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-all flex items-center gap-2 hover:scale-[1.02]"
              >
                <Check className="w-4 h-4" />
                <span>Accept & Apply Plan</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
