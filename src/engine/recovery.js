// CommitZero - Plan Recovery Engine
// Pure JavaScript, the core differentiator: algorithmic schedule repair & decision support

import { TaskPriority, TaskStatus, getPriorityWeight } from '../models/taskModel.js';
import { generateDailySchedule, timeStringToMinutes, minutesToTimeString } from './scheduler.js';

export const RecoveryTriggerReason = {
  TASK_RAN_OVER: 'Task took longer than expected',
  SESSION_UNFINISHED: 'Focus session ended with remaining work',
  SKIPPED_TASK: 'Scheduled block was skipped or delayed',
  URGENT_TASK_ADDED: 'New urgent assignment added to queue',
  TIME_REDUCED: 'Less time available today than anticipated',
  TASK_POSTPONED: 'Task was postponed or reprioritized',
  DEADLINE_AT_RISK: 'Approaching deadline requires plan restructuring',
  MANUAL_REQUEST: 'Student requested plan optimization',
};

/**
 * Executes the 8-Step Plan Recovery Analysis.
 *
 * @param {Object} params
 * @param {Array} params.tasks - Current list of tasks
 * @param {Array} params.sessions - Recorded focus sessions history
 * @param {Object} params.currentPlan - The active daily plan (blocks, stats, etc.)
 * @param {Object} params.preferences - Scheduling preferences (startTime, endTime, maxDailyMinutes, etc.)
 * @param {Object} params.recoveryContext - Trigger details (triggerReason, affectedTaskId, overrideAvailableMinutes, etc.)
 * @returns {Object} Comprehensive recovery proposal with explanations, diffs, and warnings
 */
export function analyzePlanRecovery({
  tasks = [],
  sessions = [],
  currentPlan = null,
  preferences = {},
  recoveryContext = {},
}) {
  const trigger = recoveryContext.triggerReason || RecoveryTriggerReason.MANUAL_REQUEST;
  const now = new Date();
  const currentPlanDate = currentPlan?.date || preferences.planDate || now.toISOString().split('T')[0];

  // STEP 1: Inspect Current Plan
  const completedTaskIds = new Set(
    tasks.filter((t) => t.status === TaskStatus.COMPLETED || (t.remainingDurationMinutes || 0) <= 0).map((t) => t.id)
  );

  const existingBlocks = currentPlan?.blocks || [];

  // Categorize existing blocks
  const finishedBlocks = existingBlocks.filter(
    (b) => !b.isBreak && completedTaskIds.has(b.taskId)
  );

  const remainingOriginalBlocks = existingBlocks.filter(
    (b) => !b.isBreak && !completedTaskIds.has(b.taskId)
  );

  // STEP 2: Calculate Actual Remaining Workload
  // Sum remaining durations for active, incomplete tasks
  const eligibleTasks = tasks.filter((t) => {
    return t.status !== TaskStatus.COMPLETED && (t.remainingDurationMinutes || 0) > 0;
  });

  const totalRemainingWorkMinutes = eligibleTasks.reduce(
    (acc, t) => acc + (t.remainingDurationMinutes || t.estimatedDurationMinutes || 0),
    0
  );

  // Calculate actual total recorded focus time today from sessions
  const todayDateStr = now.toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.startTime && s.startTime.startsWith(todayDateStr));
  const todayRecordedActiveMinutes = todaySessions.reduce(
    (acc, s) => acc + (s.activeDurationMinutes || 0),
    0
  );

  // Determine remaining available study budget
  const configuredMaxMinutes = Number(preferences.maxDailyMinutes) || 180;
  // If user provided an override in recovery context (e.g. "I only have 90m left today")
  let effectiveAvailableMinutes = configuredMaxMinutes;
  if (recoveryContext.overrideAvailableMinutes !== undefined && recoveryContext.overrideAvailableMinutes !== null) {
    effectiveAvailableMinutes = Number(recoveryContext.overrideAvailableMinutes);
  } else if (todayRecordedActiveMinutes > 0) {
    // Deduct already-worked time from the daily budget
    effectiveAvailableMinutes = Math.max(0, configuredMaxMinutes - todayRecordedActiveMinutes);
  }

  // STEP 3: Generate Revised Candidate Schedule
  // Adjusted preferences for remaining part of the day
  const recoveryPreferences = {
    ...preferences,
    maxDailyMinutes: effectiveAvailableMinutes,
    // If started mid-day, advance start time to now or preserve start
    startTime: recoveryContext.useCurrentTimeAsStart
      ? minutesToTimeString(now.getHours() * 60 + now.getMinutes())
      : preferences.startTime,
  };

  const revisedPlanResult = generateDailySchedule(eligibleTasks, recoveryPreferences, currentPlanDate);

  // STEP 4: Conflict & Shift Detection
  // Compare original remaining blocks with revised blocks
  const originalTaskIdsInPlan = new Set(remainingOriginalBlocks.map((b) => b.taskId));
  const revisedTaskIdsInPlan = new Set(
    revisedPlanResult.blocks.filter((b) => !b.isBreak).map((b) => b.taskId)
  );

  const tasksMovedOut = [];
  const tasksAddedIn = [];
  const tasksRescheduled = [];
  const tasksSplit = [];

  // Identify tasks that were scheduled in original remaining blocks but dropped in revised plan
  remainingOriginalBlocks.forEach((origBlock) => {
    const stillPresent = revisedPlanResult.blocks.some((b) => b.taskId === origBlock.taskId);
    if (!stillPresent) {
      const taskObj = tasks.find((t) => t.id === origBlock.taskId);
      if (taskObj) {
        tasksMovedOut.push(taskObj);
      }
    }
  });

  // Identify new tasks brought into schedule
  revisedPlanResult.blocks.forEach((revBlock) => {
    if (revBlock.isBreak) return;
    if (!originalTaskIdsInPlan.has(revBlock.taskId)) {
      const taskObj = tasks.find((t) => t.id === revBlock.taskId);
      if (taskObj && !tasksAddedIn.some((t) => t.id === taskObj.id)) {
        tasksAddedIn.push(taskObj);
      }
    }
    if (revBlock.isSplit) {
      const taskObj = tasks.find((t) => t.id === revBlock.taskId);
      if (taskObj && !tasksSplit.some((t) => t.id === taskObj.id)) {
        tasksSplit.push({
          task: taskObj,
          allocatedMinutes: revBlock.durationMinutes,
          remainingAfterBlock: revBlock.remainingAfterBlock,
        });
      }
    }
  });

  // Check changed timings for retained tasks
  revisedPlanResult.blocks.forEach((revBlock) => {
    if (revBlock.isBreak) return;
    const orig = remainingOriginalBlocks.find((b) => b.taskId === revBlock.taskId);
    if (orig && (orig.startTime !== revBlock.startTime || orig.durationMinutes !== revBlock.durationMinutes)) {
      const taskObj = tasks.find((t) => t.id === revBlock.taskId);
      if (taskObj) {
        tasksRescheduled.push({
          task: taskObj,
          oldStartTime: orig.startTime,
          newStartTime: revBlock.startTime,
          oldDuration: orig.durationMinutes,
          newDuration: revBlock.durationMinutes,
        });
      }
    }
  });

  // STEP 5: Transparent Explanations (Generated from factual scheduling decisions)
  const explanations = [];

  // Check trigger specific explanation
  if (trigger === RecoveryTriggerReason.TASK_RAN_OVER && recoveryContext.affectedTaskId) {
    const affTask = tasks.find((t) => t.id === recoveryContext.affectedTaskId);
    if (affTask) {
      explanations.push({
        type: 'trigger',
        icon: 'clock-alert',
        text: `Task "${affTask.title}" required more time than planned. Remaining work updated to ${affTask.remainingDurationMinutes}m.`,
      });
    }
  }

  // Workload vs capacity explanation
  if (totalRemainingWorkMinutes > effectiveAvailableMinutes) {
    const deficit = totalRemainingWorkMinutes - effectiveAvailableMinutes;
    explanations.push({
      type: 'capacity',
      icon: 'alert-triangle',
      text: `Remaining workload (${totalRemainingWorkMinutes}m) exceeds available study capacity (${effectiveAvailableMinutes}m) by ${deficit}m. Lower priority and later-due tasks have been deferred.`,
    });
  } else {
    explanations.push({
      type: 'capacity_fit',
      icon: 'check-circle',
      text: `All remaining tasks (${totalRemainingWorkMinutes}m) fit into today's ${effectiveAvailableMinutes}m available window.`,
    });
  }

  // Explanation for moved-out tasks
  tasksMovedOut.forEach((task) => {
    let reasonText = `Moved "${task.title}" to tomorrow/backlog because `;
    if (task.priority === TaskPriority.LOW) {
      reasonText += `it is Low Priority and higher priority deadlines take precedence.`;
    } else if (!task.deadline) {
      reasonText += `it has no upcoming hard deadline compared to immediate due dates.`;
    } else {
      const days = task.deadline ? Math.round((new Date(task.deadline) - now) / (1000 * 3600 * 24)) : 99;
      reasonText += `urgent high-priority items due sooner (${days}d vs today) require the remaining time slot.`;
    }
    explanations.push({
      type: 'deferral',
      icon: 'calendar-arrow-right',
      text: reasonText,
    });
  });

  // Explanation for split tasks
  tasksSplit.forEach((split) => {
    explanations.push({
      type: 'split',
      icon: 'scissors',
      text: `Split "${split.task.title}" into a ${split.allocatedMinutes}m session today; the remaining ${split.remainingAfterBlock}m will roll over to tomorrow.`,
    });
  });

  // Explanation for deadline risks
  revisedPlanResult.deadlineRisks.forEach((risk) => {
    explanations.push({
      type: 'deadline_risk',
      icon: 'flame',
      text: `Deadline Warning: ${risk.message}`,
    });
  });

  // STEP 6: Side-by-Side Comparison Object
  const diffSummary = {
    originalScheduledCount: remainingOriginalBlocks.length,
    revisedScheduledCount: revisedPlanResult.blocks.filter((b) => !b.isBreak).length,
    tasksMovedOutCount: tasksMovedOut.length,
    tasksAddedInCount: tasksAddedIn.length,
    tasksRescheduledCount: tasksRescheduled.length,
    tasksSplitCount: tasksSplit.length,
  };

  return {
    id: `recov_${Date.now()}`,
    createdAt: now.toISOString(),
    triggerReason: trigger,
    effectiveAvailableMinutes,
    totalRemainingWorkMinutes,
    todayRecordedActiveMinutes,
    finishedBlocks,
    originalRemainingBlocks: remainingOriginalBlocks,
    revisedPlan: revisedPlanResult,
    diffSummary,
    tasksMovedOut,
    tasksAddedIn,
    tasksRescheduled,
    tasksSplit,
    explanations,
    deadlineRisks: revisedPlanResult.deadlineRisks,
    canApply: revisedPlanResult.blocks.length > 0 || eligibleTasks.length === 0,
  };
}
