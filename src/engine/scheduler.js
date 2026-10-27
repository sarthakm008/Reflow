// CommitZero - Deterministic Daily Scheduling Engine
// Pure JavaScript, transparent heuristic scheduling with conflict detection

import { TaskPriority, TaskStatus, getPriorityWeight } from '../models/taskModel.js';

/**
 * Converts "HH:MM" (e.g. "09:30") to minutes from midnight (570)
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Converts minutes from midnight (e.g. 570) to "HH:MM" (e.g. "09:30")
 */
export function minutesToTimeString(minutes) {
  const normalized = Math.max(0, Math.floor(minutes)) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Computes deadline urgency score for prioritization.
 * Lower daysRemaining = higher urgency.
 */
export function calculateUrgencyScore(task, referenceDate = new Date()) {
  const priorityWeight = getPriorityWeight(task.priority); // 1, 2, or 3
  let deadlineScore = 0;
  let isOverdue = false;
  let daysUntilDeadline = null;

  if (task.deadline) {
    const deadlineTime = new Date(task.deadline).getTime();
    const refTime = referenceDate.getTime();
    const diffHours = (deadlineTime - refTime) / (1000 * 60 * 60);
    daysUntilDeadline = diffHours / 24;

    if (diffHours < 0) {
      // Overdue: extreme urgency
      isOverdue = true;
      deadlineScore = 100;
    } else if (diffHours <= 24) {
      // Due within 24 hours (today or tomorrow morning)
      deadlineScore = 60;
    } else if (diffHours <= 48) {
      // Due tomorrow
      deadlineScore = 40;
    } else if (diffHours <= 72) {
      // Due in 3 days
      deadlineScore = 25;
    } else if (diffHours <= 168) {
      // Due within a week
      deadlineScore = 15;
    } else {
      deadlineScore = 5;
    }
  } else {
    // No deadline: baseline score
    deadlineScore = 0;
  }

  // Combined score: Priority + Deadline urgency
  const compositeScore = deadlineScore + priorityWeight * 12;

  return {
    compositeScore,
    isOverdue,
    daysUntilDeadline,
    priorityWeight,
  };
}

/**
 * Main Scheduling Function
 * Generates non-overlapping chronological blocks within user availability.
 *
 * @param {Array} tasks - All tasks
 * @param {Object} preferences - User availability preferences
 * @param {Date|string} planDate - Target date being planned
 * @returns {Object} { blocks, unscheduledTasks, stats, warnings }
 */
export function generateDailySchedule(tasks = [], preferences = {}, planDate = new Date()) {
  const refDate = typeof planDate === 'string' ? new Date(planDate) : planDate;

  // Filter eligible tasks: must not be completed and must have remaining work
  const eligibleTasks = tasks.filter((t) => {
    return t.status !== TaskStatus.COMPLETED && (t.remainingDurationMinutes || 0) > 0;
  });

  // Calculate user time bounds
  const startMinutes = timeStringToMinutes(preferences.startTime || '09:00');
  const endMinutes = timeStringToMinutes(preferences.endTime || '17:00');
  const totalWindowMinutes = Math.max(0, endMinutes - startMinutes);

  // Maximum allowed study time for the day (cap by maxDailyMinutes preference if set)
  const maxStudyBudget = preferences.maxDailyMinutes
    ? Math.min(totalWindowMinutes, Number(preferences.maxDailyMinutes))
    : totalWindowMinutes;

  const breakDuration = Number(preferences.breakDurationMinutes) || 10;
  const workInterval = Number(preferences.workIntervalMinutes) || 50;

  // Build unavailable spans (e.g. lunch breaks or classes)
  const unavailableSpans = (preferences.unavailablePeriods || [])
    .map((period) => ({
      id: period.id,
      title: period.title || 'Unavailable',
      start: timeStringToMinutes(period.startTime),
      end: timeStringToMinutes(period.endTime),
    }))
    .filter((p) => p.end > p.start);

  // Sort eligible tasks by urgency score descending
  const scoredTasks = eligibleTasks.map((task) => {
    const urgency = calculateUrgencyScore(task, refDate);
    return {
      task,
      ...urgency,
      remainingMinutes: task.remainingDurationMinutes || task.estimatedDurationMinutes || 30,
    };
  });

  scoredTasks.sort((a, b) => {
    // 1. Highest composite score first
    if (b.compositeScore !== a.compositeScore) {
      return b.compositeScore - a.compositeScore;
    }
    // 2. High priority over low
    if (b.priorityWeight !== a.priorityWeight) {
      return b.priorityWeight - a.priorityWeight;
    }
    // 3. Shorter remaining duration to make quick progress
    return a.remainingMinutes - b.remainingMinutes;
  });

  const totalRemainingWorkAllTasks = eligibleTasks.reduce(
    (acc, t) => acc + (t.remainingDurationMinutes || t.estimatedDurationMinutes || 0),
    0
  );

  const blocks = [];
  const unscheduledTasks = [];
  let currentCursor = startMinutes;
  let totalAllocatedMinutes = 0;
  const isOverloaded = totalRemainingWorkAllTasks > maxStudyBudget;

  for (const item of scoredTasks) {
    const task = item.task;
    const taskDuration = item.remainingMinutes;

    // Check if we hit total study budget cap
    if (totalAllocatedMinutes + taskDuration > maxStudyBudget) {
      // Check if partial slot fits or if completely unscheduled
      const remainingBudget = maxStudyBudget - totalAllocatedMinutes;

      if (remainingBudget >= 25 && taskDuration > 45) {
        // Can allocate a split block of remainingBudget minutes
        const splitDuration = remainingBudget;
        const scheduledSpan = findNextAvailableSpan(
          currentCursor,
          splitDuration,
          endMinutes,
          unavailableSpans
        );

        if (scheduledSpan) {
          blocks.push({
            id: `block_${task.id}_split_${Date.now()}`,
            taskId: task.id,
            taskTitle: task.title,
            subject: task.subject,
            priority: task.priority,
            deadline: task.deadline,
            startMinutes: scheduledSpan.start,
            endMinutes: scheduledSpan.end,
            startTime: minutesToTimeString(scheduledSpan.start),
            endTime: minutesToTimeString(scheduledSpan.end),
            durationMinutes: splitDuration,
            isSplit: true,
            originalTaskDuration: taskDuration,
            remainingAfterBlock: taskDuration - splitDuration,
            status: 'Upcoming',
          });

          totalAllocatedMinutes += splitDuration;
          currentCursor = scheduledSpan.end;

          unscheduledTasks.push({
            task,
            reason: `Partially scheduled (${splitDuration}m). Remaining ${taskDuration - splitDuration}m exceeds today's remaining time budget.`,
            isPartiallyScheduled: true,
            scheduledMinutes: splitDuration,
            unallocatedMinutes: taskDuration - splitDuration,
          });
          continue;
        }
      }

      unscheduledTasks.push({
        task,
        reason: isOverloaded
          ? `Workload exceeds today's available study budget (${maxStudyBudget}m). Defer to tomorrow or weekend.`
          : `Insufficient continuous time before end of day (${preferences.endTime}).`,
        isPartiallyScheduled: false,
        scheduledMinutes: 0,
        unallocatedMinutes: taskDuration,
      });
      continue;
    }

    // Try finding next span that doesn't conflict with unavailable spans
    const slot = findNextAvailableSpan(
      currentCursor,
      taskDuration,
      endMinutes,
      unavailableSpans
    );

    if (!slot) {
      unscheduledTasks.push({
        task,
        reason: `Could not fit ${taskDuration}m within available window before ${preferences.endTime}.`,
        isPartiallyScheduled: false,
        scheduledMinutes: 0,
        unallocatedMinutes: taskDuration,
      });
      continue;
    }

    // If slot starts after cursor, add unavailable period representation if needed
    blocks.push({
      id: `block_${task.id}_${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      subject: task.subject,
      priority: task.priority,
      deadline: task.deadline,
      startMinutes: slot.start,
      endMinutes: slot.end,
      startTime: minutesToTimeString(slot.start),
      endTime: minutesToTimeString(slot.end),
      durationMinutes: taskDuration,
      isSplit: false,
      remainingAfterBlock: 0,
      status: 'Upcoming',
    });

    totalAllocatedMinutes += taskDuration;
    currentCursor = slot.end;

    // Insert break if configured and not at the end
    if (breakDuration > 0 && currentCursor + breakDuration < endMinutes) {
      blocks.push({
        id: `break_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        isBreak: true,
        title: 'Rest & Mental Reset',
        startMinutes: currentCursor,
        endMinutes: currentCursor + breakDuration,
        startTime: minutesToTimeString(currentCursor),
        endTime: minutesToTimeString(currentCursor + breakDuration),
        durationMinutes: breakDuration,
      });
      currentCursor += breakDuration;
    }
  }

  // Identify deadline risks among all tasks (especially unscheduled ones)
  const deadlineRisks = [];
  scoredTasks.forEach((item) => {
    if (item.task.deadline) {
      const deadlineDate = new Date(item.task.deadline);
      const isUnscheduledOrPartial = unscheduledTasks.some((u) => u.task.id === item.task.id);
      const diffHours = (deadlineDate.getTime() - refDate.getTime()) / (1000 * 60 * 60);

      if (diffHours < 0) {
        deadlineRisks.push({
          taskId: item.task.id,
          taskTitle: item.task.title,
          riskLevel: 'Critical',
          message: `Task is already overdue! Immediate attention required.`,
        });
      } else if (diffHours <= 24 && isUnscheduledOrPartial) {
        deadlineRisks.push({
          taskId: item.task.id,
          taskTitle: item.task.title,
          riskLevel: 'High',
          message: `Deadline is tomorrow (${Math.round(diffHours)}h away), but remaining work cannot fit into today's available time.`,
        });
      }
    }
  });

  return {
    date: typeof planDate === 'string' ? planDate : planDate.toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    blocks,
    unscheduledTasks,
    deadlineRisks,
    stats: {
      totalEligibleTasks: eligibleTasks.length,
      scheduledTasksCount: blocks.filter((b) => !b.isBreak).length,
      unscheduledTasksCount: unscheduledTasks.filter((u) => !u.isPartiallyScheduled).length,
      totalRemainingWorkMinutes: totalRemainingWorkAllTasks,
      totalAllocatedMinutes,
      availableStudyBudgetMinutes: maxStudyBudget,
      isOverloaded,
      overloadMinutes: Math.max(0, totalRemainingWorkAllTasks - maxStudyBudget),
    },
  };
}

/**
 * Finds next contiguous slot of neededMinutes starting from cursor,
 * jumping over any unavailable periods.
 */
function findNextAvailableSpan(startCursor, neededMinutes, maxEndMinutes, unavailableSpans) {
  let cursor = startCursor;

  while (cursor + neededMinutes <= maxEndMinutes) {
    const candidateEnd = cursor + neededMinutes;

    // Check collision with any unavailable span
    const collision = unavailableSpans.find((span) => {
      return cursor < span.end && candidateEnd > span.start;
    });

    if (!collision) {
      return { start: cursor, end: candidateEnd };
    }

    // Skip cursor past the end of the colliding unavailable period
    cursor = collision.end;
  }

  return null;
}
