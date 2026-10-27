// CommitZero - Deterministic Daily Scheduling Engine
// Pure JavaScript, transparent heuristic scheduling with conflict detection & work intervals

import { TaskPriority, TaskStatus, getPriorityWeight, getTaskRemainingMinutes } from '../models/taskModel.js';

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
 * @returns {Object} { blocks, partiallyScheduledTasks, unscheduledTasks, stats, deadlineRisks, validationError }
 */
export function generateDailySchedule(tasks = [], preferences = {}, planDate = new Date(), now = null) {
  // Treat YYYY-MM-DD as a local calendar date, avoiding UTC date shifts.
  const targetDateKey = typeof planDate === 'string'
    ? planDate.slice(0, 10)
    : `${planDate.getFullYear()}-${String(planDate.getMonth() + 1).padStart(2, '0')}-${String(planDate.getDate()).padStart(2, '0')}`;
  const planReferenceDate = typeof planDate === 'string'
    ? new Date(`${targetDateKey}T12:00:00`)
    : planDate;
  const refDate = now && targetDateKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    ? now
    : planReferenceDate;
  const todayKey = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    : null;
  const isPlanningToday = Boolean(now) && targetDateKey === todayKey;

  // Filter eligible tasks: must not be completed and must have true remaining work > 0
  const eligibleTasks = tasks.filter((t) => {
    return t.status !== TaskStatus.COMPLETED && getTaskRemainingMinutes(t) > 0;
  });

  const totalRemainingWorkAllTasks = eligibleTasks.reduce(
    (acc, t) => acc + getTaskRemainingMinutes(t),
    0
  );

  const startStr = preferences.startTime || '09:00';
  const endStr = preferences.endTime || '17:00';
  const startMinutes = timeStringToMinutes(startStr);
  const endMinutes = timeStringToMinutes(endStr);

  // Validate time window: start must be strictly before end
  if (endMinutes <= startMinutes) {
    const errorMsg = `Invalid study window: Start time (${startStr}) must be earlier than end time (${endStr}). Overnight scheduling across calendar days is not supported in a single daily plan.`;
    return {
      date: targetDateKey,
      generatedAt: new Date().toISOString(),
      blocks: [],
      partiallyScheduledTasks: [],
      unscheduledTasks: eligibleTasks.map((t) => ({
        task: t,
        scheduledMinutes: 0,
        unallocatedMinutes: getTaskRemainingMinutes(t),
        reason: errorMsg,
      })),
      deadlineRisks: [],
      validationError: errorMsg,
      stats: {
        totalEligibleTasks: eligibleTasks.length,
        scheduledTasksCount: 0,
        partiallyScheduledTasksCount: 0,
        unscheduledTasksCount: eligibleTasks.length,
        totalRemainingWorkMinutes: totalRemainingWorkAllTasks,
        totalAllocatedMinutes: 0,
        availableStudyBudgetMinutes: 0,
        isOverloaded: totalRemainingWorkAllTasks > 0,
        overloadMinutes: totalRemainingWorkAllTasks,
      },
    };
  }

  const totalWindowMinutes = Math.max(0, endMinutes - startMinutes);

  // Maximum allowed study time for the day (cap by maxDailyMinutes preference if set)
  const configuredBudget = preferences.maxDailyMinutes !== undefined && preferences.maxDailyMinutes !== null
    ? Number(preferences.maxDailyMinutes)
    : totalWindowMinutes;
  let maxStudyBudget = Number.isFinite(configuredBudget)
    ? Math.max(0, Math.min(totalWindowMinutes, configuredBudget))
    : totalWindowMinutes;

  const breakDuration = Math.max(0, Number(preferences.breakDurationMinutes) || 0);
  const workInterval = Math.max(0, Number(preferences.workIntervalMinutes) || 0);

  // Build unavailable spans (e.g. lunch breaks or classes)
  const unavailableSpans = (preferences.unavailablePeriods || [])
    .map((period) => ({
      id: period.id,
      title: period.title || 'Unavailable',
      start: timeStringToMinutes(period.startTime),
      end: timeStringToMinutes(period.endTime),
    }))
    .filter((p) => p.end > p.start);

  // Today's plan only has the time that remains in the configured window.
  // Do not advertise or allocate a full daily budget after most of the window has passed.
  let currentCursor = isPlanningToday
    ? Math.max(startMinutes, now.getHours() * 60 + now.getMinutes())
    : startMinutes;
  currentCursor = Math.min(currentCursor, endMinutes);
  const remainingWindowCapacity = calculateAvailableMinutes(
    currentCursor,
    endMinutes,
    unavailableSpans
  );
  maxStudyBudget = Math.min(maxStudyBudget, remainingWindowCapacity);

  // If study budget is 0
  if (maxStudyBudget === 0) {
    return {
      date: targetDateKey,
      generatedAt: new Date().toISOString(),
      blocks: [],
      partiallyScheduledTasks: [],
      unscheduledTasks: eligibleTasks.map((t) => ({
        task: t,
        scheduledMinutes: 0,
        unallocatedMinutes: getTaskRemainingMinutes(t),
        reason: remainingWindowCapacity === 0
          ? `No usable time remains in the configured study window (${startStr}–${endStr}). Choose a later window or schedule this task for another day.`
          : 'Zero study capacity configured for today.',
      })),
      deadlineRisks: [],
      stats: {
        totalEligibleTasks: eligibleTasks.length,
        scheduledTasksCount: 0,
        partiallyScheduledTasksCount: 0,
        unscheduledTasksCount: eligibleTasks.length,
        totalRemainingWorkMinutes: totalRemainingWorkAllTasks,
        totalAllocatedMinutes: 0,
        availableStudyBudgetMinutes: 0,
        isOverloaded: totalRemainingWorkAllTasks > 0,
        overloadMinutes: totalRemainingWorkAllTasks,
      },
    };
  }

  // Sort eligible tasks by urgency score descending
  const scoredTasks = eligibleTasks.map((task) => {
    const urgency = calculateUrgencyScore(task, refDate);
    return {
      task,
      ...urgency,
      remainingMinutes: getTaskRemainingMinutes(task),
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
    // 3. Shorter remaining duration
    if (a.remainingMinutes !== b.remainingMinutes) {
      return a.remainingMinutes - b.remainingMinutes;
    }
    // 4. Stable deterministic tie-breaker by task ID
    return (a.task.id || '').localeCompare(b.task.id || '');
  });

  const blocks = [];
  const partiallyScheduledTasks = [];
  const unscheduledTasks = [];
  // For today's plan, never generate work in the past. Future dates retain the configured start time.
  let totalAllocatedMinutes = 0;
  const isOverloaded = totalRemainingWorkAllTasks > maxStudyBudget;

  for (let taskIndex = 0; taskIndex < scoredTasks.length; taskIndex++) {
    const item = scoredTasks[taskIndex];
    const task = item.task;
    const taskTotalRemaining = item.remainingMinutes;
    let taskAllocatedToday = 0;

    // Determine chunk sizes for this task based on workInterval
    // e.g. 120m with workInterval 50m -> chunks of [50, 50, 20]
    const chunks = [];
    if (workInterval > 0 && taskTotalRemaining > workInterval) {
      let rem = taskTotalRemaining;
      while (rem > 0) {
        const chunk = Math.min(workInterval, rem);
        chunks.push(chunk);
        rem -= chunk;
      }
      // Avoid a throwaway final session (e.g. 50 + 10 minutes). Rebalance it
      // into a meaningful 15-minute minimum when possible (e.g. 45 + 15).
      if (chunks.length > 1 && chunks[chunks.length - 1] < 15) {
        const needed = 15 - chunks[chunks.length - 1];
        const previousIndex = chunks.length - 2;
        if (chunks[previousIndex] - needed >= 15) {
          chunks[previousIndex] -= needed;
          chunks[chunks.length - 1] += needed;
        }
      }
    } else {
      chunks.push(taskTotalRemaining);
    }

    let chunkIndex = 0;
    let stoppedEarly = false;
    let stopReason = '';

    for (let i = 0; i < chunks.length; i++) {
      const chunkDuration = chunks[i];
      const remainingBudget = maxStudyBudget - totalAllocatedMinutes;

      if (remainingBudget <= 0) {
        stoppedEarly = true;
        stopReason = isOverloaded
          ? `Workload exceeds today's available study budget (${maxStudyBudget}m). Defer to tomorrow or later.`
          : `Insufficient remaining study budget today (${maxStudyBudget}m).`;
        break;
      }

      // Check how much can fit in budget
      let durationToFit = chunkDuration;
      let isPartialChunk = false;

      if (durationToFit > remainingBudget) {
        // Can we allocate a partial split of at least 15 minutes?
        if (remainingBudget >= 15) {
          durationToFit = remainingBudget;
          isPartialChunk = true;
        } else {
          stoppedEarly = true;
          stopReason = `Remaining capacity (${remainingBudget}m) is smaller than minimum session block (15m).`;
          break;
        }
      }

      // Try finding next span in the day window avoiding unavailable spans
      let slot = findNextAvailableSpan(
        currentCursor,
        durationToFit,
        endMinutes,
        unavailableSpans
      );

      // If cannot fit full durationToFit before endMinutes, try partial if at least 15m fits
      if (!slot) {
        const maxFitSpan = findMaxFittingSpan(currentCursor, endMinutes, unavailableSpans, 15);
        if (maxFitSpan && maxFitSpan.duration >= 15 && maxFitSpan.duration < durationToFit) {
          durationToFit = Math.min(maxFitSpan.duration, remainingBudget);
          if (durationToFit >= 15) {
            slot = { start: maxFitSpan.start, end: maxFitSpan.start + durationToFit };
            isPartialChunk = true;
          }
        }
      }

      if (!slot) {
        stoppedEarly = true;
        stopReason = `Could not fit remaining work within available window before ${endStr}.`;
        break;
      }

      // Add the schedule block
      const isSplit = isPartialChunk || chunks.length > 1 || taskAllocatedToday + durationToFit < taskTotalRemaining;
      chunkIndex++;

      blocks.push({
        id: `block_${task.id}_${chunkIndex}_${Date.now()}`,
        taskId: task.id,
        taskTitle: task.title,
        subject: task.subject,
        priority: task.priority,
        deadline: task.deadline,
        startMinutes: slot.start,
        endMinutes: slot.end,
        startTime: minutesToTimeString(slot.start),
        endTime: minutesToTimeString(slot.end),
        durationMinutes: durationToFit,
        isSplit,
        chunkNumber: chunkIndex,
        totalChunksExpected: chunks.length,
        originalTaskDuration: taskTotalRemaining,
        remainingAfterBlock: Math.max(0, taskTotalRemaining - (taskAllocatedToday + durationToFit)),
        status: 'Upcoming',
      });

      taskAllocatedToday += durationToFit;
      totalAllocatedMinutes += durationToFit;
      currentCursor = slot.end;

      // If this was a partial chunk, we cannot fit the rest of the chunks today
      if (isPartialChunk) {
        stoppedEarly = true;
        stopReason = isOverloaded
          ? `Workload exceeds today's available study budget (${maxStudyBudget}m). Remaining ${taskTotalRemaining - taskAllocatedToday}m deferred.`
          : `Day study window reached. Remaining ${taskTotalRemaining - taskAllocatedToday}m deferred.`;
        break;
      }

      // Insert a break only when another work block can actually follow it.
      // This avoids leaving a pointless trailing break when the remaining budget
      // or time window is too small for another valid (15-minute minimum) block.
      const hasMoreChunksForTask = i < chunks.length - 1;
      const hasMoreTasks = scoredTasks.slice(taskIndex + 1).some((nextItem) => nextItem.remainingMinutes > 0);
      // Don't force a break after every tiny task. Between different tasks, add
      // one only after a full work interval; always break between split chunks.
      const reachedWorkInterval = workInterval > 0 && durationToFit >= workInterval;
      const shouldBreakAfterBlock = hasMoreChunksForTask || (hasMoreTasks && reachedWorkInterval);
      const remainingBudgetAfterBlock = maxStudyBudget - totalAllocatedMinutes;
      const canFitAnotherWorkBlock = remainingBudgetAfterBlock >= 15
        && findMaxFittingSpan(
          currentCursor + breakDuration,
          endMinutes,
          unavailableSpans,
          15
        ) !== null;

      if (
        breakDuration > 0
        && shouldBreakAfterBlock
        && canFitAnotherWorkBlock
        && currentCursor + breakDuration <= endMinutes
      ) {
        const breakSlot = findNextAvailableSpan(currentCursor, breakDuration, endMinutes, unavailableSpans);
        if (breakSlot && breakSlot.start === currentCursor) {
          blocks.push({
            id: `break_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            isBreak: true,
            title: 'Rest & Mental Reset',
            startMinutes: breakSlot.start,
            endMinutes: breakSlot.end,
            startTime: minutesToTimeString(breakSlot.start),
            endTime: minutesToTimeString(breakSlot.end),
            durationMinutes: breakDuration,
          });
          currentCursor = breakSlot.end;
        }
      }
    }

    // Evaluate task allocation status:
    // Case 1: Partially scheduled (some minutes scheduled, some unallocated)
    if (taskAllocatedToday > 0 && taskAllocatedToday < taskTotalRemaining) {
      partiallyScheduledTasks.push({
        task,
        scheduledMinutes: taskAllocatedToday,
        unallocatedMinutes: taskTotalRemaining - taskAllocatedToday,
        reason: stopReason || `Partially scheduled (${taskAllocatedToday}m of ${taskTotalRemaining}m). Remaining ${taskTotalRemaining - taskAllocatedToday}m deferred to next session.`,
      });
    } else if (taskAllocatedToday === 0) {
      // Case 2: Completely unscheduled
      unscheduledTasks.push({
        task,
        scheduledMinutes: 0,
        unallocatedMinutes: taskTotalRemaining,
        reason: stopReason || (isOverloaded
          ? `Workload exceeds today's available study budget (${maxStudyBudget}m). Defer to tomorrow or later.`
          : `Insufficient continuous time before end of day (${endStr}).`),
      });
    }
    // Case 3: Fully scheduled (taskAllocatedToday >= taskTotalRemaining) -> neither in partial nor unscheduled
  }

  // Identify deadline risks
  const deadlineRisks = [];
  scoredTasks.forEach((item) => {
    if (item.task.deadline) {
      const deadlineDate = new Date(item.task.deadline);
      const diffHours = (deadlineDate.getTime() - refDate.getTime()) / (1000 * 60 * 60);

      const isUnscheduled = unscheduledTasks.some((u) => u.task.id === item.task.id);
      const isPartial = partiallyScheduledTasks.some((p) => p.task.id === item.task.id);

      if (diffHours < 0) {
        deadlineRisks.push({
          taskId: item.task.id,
          taskTitle: item.task.title,
          riskLevel: 'Critical',
          message: `Task is already overdue! Immediate attention required.`,
        });
      } else if (diffHours <= 24 && (isUnscheduled || isPartial)) {
        deadlineRisks.push({
          taskId: item.task.id,
          taskTitle: item.task.title,
          riskLevel: 'High',
          message: `Deadline is ${diffHours < 1 ? 'less than an hour' : diffHours < 24 ? `in about ${Math.round(diffHours)} hours` : 'within about 48 hours'}, but remaining work cannot fully fit into today's available study time.`,
        });
      }
    }
  });

  // Unique tasks scheduled
  const scheduledTaskIds = new Set(blocks.filter((b) => !b.isBreak).map((b) => b.taskId));

  return {
    date: targetDateKey,
    generatedAt: new Date().toISOString(),
    blocks,
    partiallyScheduledTasks,
    unscheduledTasks,
    deadlineRisks,
    stats: {
      totalEligibleTasks: eligibleTasks.length,
      scheduledTasksCount: scheduledTaskIds.size,
      partiallyScheduledTasksCount: partiallyScheduledTasks.length,
      unscheduledTasksCount: unscheduledTasks.length,
      totalRemainingWorkMinutes: totalRemainingWorkAllTasks,
      totalAllocatedMinutes,
      availableStudyBudgetMinutes: maxStudyBudget,
      isOverloaded,
      overloadMinutes: Math.max(0, totalRemainingWorkAllTasks - maxStudyBudget),
    },
  };
}

/** Calculates usable focused-work minutes in the remaining clock window. */
function calculateAvailableMinutes(start, end, unavailableSpans) {
  if (end <= start) return 0;
  const clipped = unavailableSpans
    .map((span) => ({ start: Math.max(start, span.start), end: Math.min(end, span.end) }))
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start - b.start);

  let unavailableMinutes = 0;
  let mergedStart = null;
  let mergedEnd = null;
  for (const span of clipped) {
    if (mergedStart === null) {
      mergedStart = span.start;
      mergedEnd = span.end;
    } else if (span.start <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, span.end);
    } else {
      unavailableMinutes += mergedEnd - mergedStart;
      mergedStart = span.start;
      mergedEnd = span.end;
    }
  }
  if (mergedStart !== null) unavailableMinutes += mergedEnd - mergedStart;
  return Math.max(0, end - start - unavailableMinutes);
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

/**
 * Finds the largest contiguous span of at least minMinutes starting at or after cursor
 */
function findMaxFittingSpan(startCursor, maxEndMinutes, unavailableSpans, minMinutes = 15) {
  let cursor = startCursor;

  while (cursor + minMinutes <= maxEndMinutes) {
    const collision = unavailableSpans.find((span) => cursor < span.end && cursor + minMinutes > span.start);
    if (collision) {
      cursor = collision.end;
      continue;
    }

    // Found start, find how far it can extend before next collision or maxEndMinutes
    let end = maxEndMinutes;
    const nextCollision = unavailableSpans
      .filter((span) => span.start >= cursor)
      .sort((a, b) => a.start - b.start)[0];

    if (nextCollision && nextCollision.start < end) {
      end = nextCollision.start;
    }

    const duration = end - cursor;
    if (duration >= minMinutes) {
      return { start: cursor, end, duration };
    }

    cursor = (nextCollision ? nextCollision.end : maxEndMinutes);
  }

  return null;
}
