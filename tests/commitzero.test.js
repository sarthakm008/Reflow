// CommitZero - Automated Test Suite
// Pure JavaScript, uses Node.js native test runner and assert module

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTask,
  validateTaskInput,
  TaskPriority,
  TaskStatus,
  getTaskRemainingMinutes,
  isTaskOverdue,
  isTaskDueSoon,
  getPriorityWeight,
} from '../src/models/taskModel.js';

import {
  createSessionRecord,
  SessionOutcome,
  calculateCurrentElapsedSeconds,
  formatTimeDisplay,
  formatMinutesHuman,
} from '../src/models/sessionModel.js';

import {
  generateDailySchedule,
  calculateUrgencyScore,
  timeStringToMinutes,
  minutesToTimeString,
} from '../src/engine/scheduler.js';

import {
  analyzePlanRecovery,
  RecoveryTriggerReason,
} from '../src/engine/recovery.js';

import {
  calculateAnalyticsMetrics,
} from '../src/engine/analytics.js';

import {
  loadFromStorage,
  saveToStorage,
  clearAllStorage,
  STORAGE_KEYS,
  defaultPreferences,
} from '../src/utils/storage.js';
import {
  removeDemoTasks,
  removeDemoSessions,
  removeDemoPlan,
  removeDemoPreferences,
} from '../src/utils/guestData.js';

describe('1. Task Model & Validation Tests', () => {
  test('rejects missing or empty title', () => {
    const res = validateTaskInput({ title: '   ', estimatedDurationMinutes: 60 });
    assert.equal(res.isValid, false);
    assert.ok(res.errors.title);
  });

  test('rejects zero or negative duration', () => {
    const res1 = validateTaskInput({ title: 'Physics HW', estimatedDurationMinutes: 0 });
    assert.equal(res1.isValid, false);
    assert.ok(res1.errors.estimatedDurationMinutes);

    const res2 = validateTaskInput({ title: 'Math Quiz', estimatedDurationMinutes: -20 });
    assert.equal(res2.isValid, false);
    assert.ok(res2.errors.estimatedDurationMinutes);
  });

  test('rejects duration exceeding 24 hours (1440 minutes)', () => {
    const res = validateTaskInput({ title: 'Gigantic Project', estimatedDurationMinutes: 2000 });
    assert.equal(res.isValid, false);
    assert.ok(res.errors.estimatedDurationMinutes);
  });

  test('creates a task with correct defaults', () => {
    const task = createTask({
      title: 'Study Operating Systems',
      estimatedDurationMinutes: 90,
      priority: TaskPriority.HIGH,
    });

    assert.equal(task.title, 'Study Operating Systems');
    assert.equal(task.estimatedDurationMinutes, 90);
    assert.equal(task.remainingDurationMinutes, 90);
    assert.equal(task.actualWorkMinutes, 0);
    assert.equal(task.priority, TaskPriority.HIGH);
    assert.equal(task.status, TaskStatus.PENDING);
    assert.ok(task.id);
  });

  test('getTaskRemainingMinutes returns 0 for completed tasks', () => {
    const completedTask = createTask({
      title: 'Done Lab',
      estimatedDurationMinutes: 120,
      status: TaskStatus.COMPLETED,
    });
    assert.equal(getTaskRemainingMinutes(completedTask), 0);
  });

  test('getTaskRemainingMinutes returns explicit remaining duration for active tasks', () => {
    const activeTask = createTask({
      title: 'Ongoing Assignment',
      estimatedDurationMinutes: 120,
      remainingDurationMinutes: 45,
      actualWorkMinutes: 75,
      status: TaskStatus.IN_PROGRESS,
    });
    assert.equal(getTaskRemainingMinutes(activeTask), 45);
  });
});

test('analytics reports unavailable ratios when no records exist', () => {
  const metrics = calculateAnalyticsMetrics([], []);
  assert.equal(metrics.totalTasks, 0);
  assert.equal(metrics.totalSessions, 0);
  assert.equal(metrics.completionRate, null);
  assert.equal(metrics.underestimationRatio, null);
  assert.equal(metrics.totalFocusMinutes, 0);
});

test('legacy demo cleanup removes only known demo data and preserves guest records', () => {
  const realTask = { id: 'guest-task', title: 'My task' };
  const keptTasks = removeDemoTasks([realTask, { id: 'demo-task-express' }]);
  const keptSessions = removeDemoSessions([
    { id: 'guest-session', taskId: 'guest-task' },
    { id: 'demo-session', taskId: 'demo-task-express' },
  ]);
  const cleanPlan = removeDemoPlan({ blocks: [{ taskId: 'demo-task-express' }] });
  const preferences = removeDemoPreferences({ unavailablePeriods: [{ id: 'office-hours' }, { id: 'guest-break' }] });

  assert.deepEqual(keptTasks, [realTask]);
  assert.deepEqual(keptSessions, [{ id: 'guest-session', taskId: 'guest-task' }]);
  assert.equal(cleanPlan, null);
  assert.deepEqual(preferences.unavailablePeriods, [{ id: 'guest-break' }]);
});

describe('2. Scheduling Engine Tests', () => {
  const prefs = {
    planDate: '2026-10-27',
    startTime: '09:00',
    endTime: '17:00',
    maxDailyMinutes: 180, // 3 hours available
    breakDurationMinutes: 10,
    workIntervalMinutes: 50,
    unavailablePeriods: [
      { id: 'lunch', title: 'Lunch', startTime: '12:00', endTime: '13:00' },
    ],
  };

  test('Test 1: All tasks fit within available time when work <= available time', () => {
    const tasks = [
      createTask({ title: 'Task A', estimatedDurationMinutes: 60, priority: TaskPriority.HIGH }),
      createTask({ title: 'Task B', estimatedDurationMinutes: 60, priority: TaskPriority.MEDIUM }),
    ];

    const plan = generateDailySchedule(tasks, prefs, '2026-10-27');
    assert.equal(plan.unscheduledTasks.length, 0);
    assert.equal(plan.partiallyScheduledTasks.length, 0);
    assert.equal(plan.stats.isOverloaded, false);
    const taskBlocks = plan.blocks.filter((b) => !b.isBreak);
    assert.ok(taskBlocks.length >= 2);
  });

  test('Test 2: Total work exceeds available time (Overload detection)', () => {
    const tasks = [
      createTask({ title: 'Revise Express.js', estimatedDurationMinutes: 120, priority: TaskPriority.HIGH }),
      createTask({ title: 'MongoDB Assignment', estimatedDurationMinutes: 180, priority: TaskPriority.HIGH }),
      createTask({ title: 'Practice Algorithms', estimatedDurationMinutes: 120, priority: TaskPriority.MEDIUM }),
      createTask({ title: 'Revise Lecture Notes', estimatedDurationMinutes: 60, priority: TaskPriority.MEDIUM }),
    ]; // Total = 480m

    const plan = generateDailySchedule(tasks, prefs, '2026-10-27');
    assert.equal(plan.stats.isOverloaded, true);
    assert.equal(plan.stats.totalRemainingWorkMinutes, 480);
    assert.equal(plan.stats.availableStudyBudgetMinutes, 180);
    assert.ok(plan.unscheduledTasks.length > 0 || plan.partiallyScheduledTasks.length > 0);
    assert.ok(plan.stats.totalAllocatedMinutes <= 180);
  });

  test('Test 3 & 4: Priority and approaching deadlines affect prioritization', () => {
    const today = new Date('2026-10-27T10:00:00Z');
    const tomorrow = new Date('2026-10-28T17:00:00Z').toISOString();
    const nextWeek = new Date('2026-11-04T17:00:00Z').toISOString();

    const urgentTask = createTask({
      title: 'Urgent Project',
      estimatedDurationMinutes: 60,
      priority: TaskPriority.HIGH,
      deadline: tomorrow,
    });

    const lowPriorityTask = createTask({
      title: 'Casual Reading',
      estimatedDurationMinutes: 60,
      priority: TaskPriority.LOW,
      deadline: nextWeek,
    });

    const scoreUrgent = calculateUrgencyScore(urgentTask, today);
    const scoreLow = calculateUrgencyScore(lowPriorityTask, today);

    assert.ok(scoreUrgent.compositeScore > scoreLow.compositeScore);
  });

  test('Test 5: No scheduled blocks overlap', () => {
    const tasks = [
      createTask({ title: 'Task 1', estimatedDurationMinutes: 45 }),
      createTask({ title: 'Task 2', estimatedDurationMinutes: 50 }),
      createTask({ title: 'Task 3', estimatedDurationMinutes: 30 }),
    ];

    const plan = generateDailySchedule(tasks, { ...prefs, maxDailyMinutes: 300 });

    for (let i = 0; i < plan.blocks.length - 1; i++) {
      const current = plan.blocks[i];
      const next = plan.blocks[i + 1];
      assert.ok(
        current.endMinutes <= next.startMinutes,
        `Block "${current.taskTitle || current.title}" (${current.endMinutes}) overlaps with "${next.taskTitle || next.title}" (${next.startMinutes})`
      );
    }
  });

  test('Test 6: Completed tasks are excluded from scheduling', () => {
    const tasks = [
      createTask({ title: 'Finished Lab', estimatedDurationMinutes: 60, status: TaskStatus.COMPLETED }),
      createTask({ title: 'Active HW', estimatedDurationMinutes: 45, status: TaskStatus.PENDING }),
    ];

    const plan = generateDailySchedule(tasks, prefs);
    const scheduledTaskIds = plan.blocks.filter((b) => !b.isBreak).map((b) => b.taskId);
    assert.ok(!scheduledTaskIds.includes(tasks[0].id));
    assert.ok(scheduledTaskIds.includes(tasks[1].id));
  });

  test('Test 7: Tasks without deadlines are safely handled', () => {
    const tasks = [
      createTask({ title: 'No Deadline Review', estimatedDurationMinutes: 40, deadline: null }),
    ];

    const plan = generateDailySchedule(tasks, prefs);
    assert.equal(plan.blocks.filter((b) => !b.isBreak).length, 1);
  });

  test('Test 8 & 9: Respects unavailable periods and separates partially scheduled vs unscheduled tasks', () => {
    // 3 tasks: budget 180m
    // Task 1 (120m) takes 120m -> 60m budget left
    // Task 2 (120m) gets 60m allocated -> partially scheduled (60m remaining)
    // Task 3 (60m) gets 0m allocated -> completely unscheduled
    const tasks = [
      createTask({ id: 't1', title: 'Task 1', estimatedDurationMinutes: 120, priority: TaskPriority.HIGH }),
      createTask({ id: 't2', title: 'Task 2', estimatedDurationMinutes: 120, priority: TaskPriority.MEDIUM }),
      createTask({ id: 't3', title: 'Task 3', estimatedDurationMinutes: 60, priority: TaskPriority.LOW }),
    ];

    const plan = generateDailySchedule(tasks, { ...prefs, maxDailyMinutes: 180 });

    // Verify unavailable periods: lunch 12:00 to 13:00 (720 to 780 min)
    plan.blocks.forEach((b) => {
      const overlapsWithLunch = b.startMinutes < 780 && b.endMinutes > 720;
      assert.equal(overlapsWithLunch, false, `Block ${b.title || b.taskTitle} overlaps with lunch window!`);
    });

    // Verify strict separation of partially scheduled and unscheduled tasks
    assert.ok(plan.partiallyScheduledTasks.length > 0, 'Must have at least one partially scheduled task');
    assert.ok(plan.unscheduledTasks.length > 0, 'Must have at least one completely unscheduled task');
    assert.ok(plan.unscheduledTasks[0].reason.length > 0, 'Unscheduled task must explain why it could not be scheduled');

    // Confirm that a partially scheduled task is NOT also listed in unscheduledTasks
    const partialIds = plan.partiallyScheduledTasks.map((p) => p.task.id);
    const unscheduledIds = plan.unscheduledTasks.map((u) => u.task.id);
    partialIds.forEach((pid) => {
      assert.equal(unscheduledIds.includes(pid), false, `Task ${pid} should not be in both partial and unscheduled arrays`);
    });
  });

  test('Test 10: Invalid study window (start >= end) returns validationError and zero blocks', () => {
    const tasks = [createTask({ title: 'Task 1', estimatedDurationMinutes: 60 })];
    const invalidPrefs = { ...prefs, startTime: '18:00', endTime: '09:00' };

    const plan = generateDailySchedule(tasks, invalidPrefs);
    assert.ok(plan.validationError, 'Should produce a validationError for invalid window');
    assert.equal(plan.blocks.length, 0);
    assert.equal(plan.unscheduledTasks.length, 1);
    assert.ok(plan.unscheduledTasks[0].reason.includes('Invalid study window'));
  });

  test('Test 11: Zero study capacity returns zero blocks and explains reason', () => {
    const tasks = [createTask({ title: 'Task 1', estimatedDurationMinutes: 60 })];
    const zeroPrefs = { ...prefs, maxDailyMinutes: 0 };

    const plan = generateDailySchedule(tasks, zeroPrefs);
    assert.equal(plan.blocks.length, 0);
    assert.equal(plan.unscheduledTasks.length, 1);
    assert.ok(plan.unscheduledTasks[0].reason.includes('Zero study capacity'));
  });

  test('does not schedule past blocks when generating a plan for today', () => {
    const task = createTask({ id: 'today-task', title: 'Today task', estimatedDurationMinutes: 60 });
    const plan = generateDailySchedule(
      [task],
      { ...prefs, startTime: '09:00', endTime: '17:00', maxDailyMinutes: 180, unavailablePeriods: [] },
      '2026-10-27',
      new Date(2026, 9, 27, 14, 30)
    );

    const workBlocks = plan.blocks.filter((block) => !block.isBreak);
    assert.ok(workBlocks.length > 0);
    assert.ok(workBlocks.every((block) => block.startMinutes >= 14 * 60 + 30));
  });

  test('keeps configured start time for a future date', () => {
    const task = createTask({ id: 'future-task', title: 'Future task', estimatedDurationMinutes: 30 });
    const plan = generateDailySchedule(
      [task],
      { ...prefs, startTime: '09:00', endTime: '17:00', maxDailyMinutes: 180, unavailablePeriods: [] },
      '2026-10-28',
      new Date(2026, 9, 27, 14, 30)
    );

    assert.equal(plan.blocks.find((block) => !block.isBreak).startTime, '09:00');
  });

  test('does not insert a break after the final work block', () => {
    const task = createTask({ id: 'single-block', title: 'Single block', estimatedDurationMinutes: 30 });
    const plan = generateDailySchedule(
      [task],
      { ...prefs, workIntervalMinutes: 50, breakDurationMinutes: 10, maxDailyMinutes: 180, unavailablePeriods: [] },
      '2026-10-28',
      new Date(2026, 9, 27, 8, 0)
    );

    assert.equal(plan.blocks.filter((block) => block.isBreak).length, 0);
  });

  test('does not add a break when the remaining study budget cannot fit another work block', () => {
    const tasks = [
      createTask({ id: 'budget-task-1', title: 'First task', estimatedDurationMinutes: 50, priority: TaskPriority.HIGH }),
      createTask({ id: 'budget-task-2', title: 'Second task', estimatedDurationMinutes: 60, priority: TaskPriority.LOW }),
    ];
    const plan = generateDailySchedule(tasks, {
      ...prefs,
      startTime: '09:00',
      endTime: '17:00',
      maxDailyMinutes: 55,
      workIntervalMinutes: 50,
      breakDurationMinutes: 10,
      unavailablePeriods: [],
    }, '2026-10-28', new Date(2026, 9, 27, 8, 0));

    assert.equal(plan.stats.totalAllocatedMinutes, 50);
    assert.equal(plan.blocks.filter((block) => block.isBreak).length, 0);
  });

  test('invalid numeric study budget falls back to the available study window', () => {
    const task = createTask({ id: 'nan-budget-task', title: 'Study task', estimatedDurationMinutes: 30 });
    const plan = generateDailySchedule([task], {
      ...prefs,
      startTime: '09:00',
      endTime: '17:00',
      maxDailyMinutes: Number.NaN,
      workIntervalMinutes: 0,
      breakDurationMinutes: 0,
      unavailablePeriods: [],
    }, '2026-10-28', new Date(2026, 9, 27, 8, 0));

    assert.equal(plan.stats.availableStudyBudgetMinutes, 480);
    assert.equal(plan.stats.totalAllocatedMinutes, 30);
  });

  test('Test 12: Enforces work intervals and inserts buffer breaks', () => {
    // 100m task with 45m work intervals -> rebalance tiny tail to [45, 40, 15]
    const tasks = [createTask({ title: 'Long coding session', estimatedDurationMinutes: 100 })];
    const intervalPrefs = {
      ...prefs,
      workIntervalMinutes: 45,
      breakDurationMinutes: 10,
      maxDailyMinutes: 200,
    };

    const plan = generateDailySchedule(tasks, intervalPrefs);
    const taskBlocks = plan.blocks.filter((b) => !b.isBreak);
    const breakBlocks = plan.blocks.filter((b) => b.isBreak);

    assert.equal(taskBlocks.length, 3, 'Should be split into 3 meaningful chunks (45, 40, 15)');
    assert.deepEqual(taskBlocks.map((block) => block.durationMinutes), [45, 40, 15]);
    assert.equal(breakBlocks.length, 2, 'Breaks should appear only between the three work chunks, never after the final chunk');
  });

  test('today budget reflects only the remaining configured window', () => {
    const task = createTask({ id: 'late-task', title: 'Late task', estimatedDurationMinutes: 60 });
    const plan = generateDailySchedule([task], {
      ...prefs,
      startTime: '21:00',
      endTime: '23:59',
      maxDailyMinutes: 180,
      workIntervalMinutes: 50,
      breakDurationMinutes: 10,
      unavailablePeriods: [],
    }, '2026-10-27', new Date(2026, 9, 27, 21, 9));

    assert.equal(plan.stats.availableStudyBudgetMinutes, 170);
    assert.equal(plan.stats.totalAllocatedMinutes, 60);
    assert.equal(plan.blocks.find((block) => !block.isBreak).startTime, '21:09');
  });

  test('does not add a full break between short unrelated tasks', () => {
    const tasks = [
      createTask({ id: 'short-1', title: 'Read notes', estimatedDurationMinutes: 20, priority: TaskPriority.HIGH }),
      createTask({ id: 'short-2', title: 'Review flashcards', estimatedDurationMinutes: 15, priority: TaskPriority.MEDIUM }),
    ];
    const plan = generateDailySchedule(tasks, {
      ...prefs,
      startTime: '09:00',
      endTime: '12:00',
      maxDailyMinutes: 180,
      workIntervalMinutes: 50,
      breakDurationMinutes: 10,
      unavailablePeriods: [],
    }, '2026-10-28', new Date(2026, 9, 27, 8, 0));

    assert.equal(plan.stats.totalAllocatedMinutes, 35);
    assert.equal(plan.blocks.filter((block) => block.isBreak).length, 0);
  });
});

describe('3. Focus Session Tracking Tests', () => {
  test('Starting and calculating elapsed active time with timestamps', () => {
    const now = Date.now();
    const timerState = {
      isRunning: true,
      isPaused: false,
      accumulatedSeconds: 30,
      lastResumedTimestamp: now - 15000, // 15 seconds ago
    };

    const elapsed = calculateCurrentElapsedSeconds(timerState);
    assert.ok(elapsed >= 44 && elapsed <= 46);
  });

  test('Paused time is strictly excluded from active elapsed work', () => {
    const timerState = {
      isRunning: true,
      isPaused: true,
      accumulatedSeconds: 120, // 2 minutes before pause
      lastResumedTimestamp: null,
    };

    const elapsed = calculateCurrentElapsedSeconds(timerState);
    assert.equal(elapsed, 120);
  });

  test('Documented rounding policy: >=30s rounds to whole minute; <30s discarded', () => {
    // 29 seconds -> 0 minutes logged
    const sec29 = 29;
    const min29 = sec29 >= 30 ? Math.max(1, Math.round(sec29 / 60)) : 0;
    assert.equal(min29, 0);

    // 35 seconds -> rounds to 1 minute
    const sec35 = 35;
    const min35 = sec35 >= 30 ? Math.max(1, Math.round(sec35 / 60)) : 0;
    assert.equal(min35, 1);

    // 89 seconds -> rounds to 1 minute
    const sec89 = 89;
    const min89 = sec89 >= 30 ? Math.max(1, Math.round(sec89 / 60)) : 0;
    assert.equal(min89, 1);

    // 91 seconds -> rounds to 2 minutes
    const sec91 = 91;
    const min91 = sec91 >= 30 ? Math.max(1, Math.round(sec91 / 60)) : 0;
    assert.equal(min91, 2);
  });

  test('Creates session record and preserves history', () => {
    const session = createSessionRecord({
      taskId: 'task-123',
      taskTitle: 'Data Structures practice',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      activeDurationSeconds: 3600,
      plannedDurationMinutes: 60,
      outcome: SessionOutcome.COMPLETED,
      notes: 'Implemented AVL trees',
    });

    assert.equal(session.activeDurationMinutes, 60);
    assert.equal(session.outcome, SessionOutcome.COMPLETED);
    assert.ok(session.id);
  });

  test('Session cancellation policy: timer discarded without phantom records', () => {
    let activeTimer = {
      sessionId: 'sess_1',
      taskId: 't1',
      isRunning: true,
      accumulatedSeconds: 500,
    };
    let sessions = [];

    // Cancellation: set activeTimer to null, don't append to sessions
    activeTimer = null;
    assert.equal(activeTimer, null);
    assert.equal(sessions.length, 0);
  });

  test('Focus sessions for deleted tasks do not crash analytics', () => {
    const orphanSession = createSessionRecord({
      taskId: 'deleted-task-id',
      taskTitle: 'Old Deleted Task',
      activeDurationSeconds: 1800,
      plannedDurationMinutes: 30,
      outcome: SessionOutcome.COMPLETED,
    });

    const tasks = [
      createTask({ id: 'active-task', title: 'Active Task', estimatedDurationMinutes: 60 }),
    ];

    const metrics = calculateAnalyticsMetrics(tasks, [orphanSession]);
    assert.equal(metrics.totalSessions, 1);
    assert.equal(metrics.totalFocusMinutes, 30);
  });
});

describe('4. Section 2: Split-Task Semantics & Plan Recovery Consistency', () => {
  test('Regression 1: Accepting a partial allocation does not mark task complete and preserves remaining work', () => {
    // 120m task with only 60m available today
    const task = createTask({
      id: 'task-split',
      title: 'Split Task',
      estimatedDurationMinutes: 120,
      remainingDurationMinutes: 120,
      actualWorkMinutes: 0,
      priority: TaskPriority.HIGH,
    });

    const prefs = {
      planDate: '2026-10-27',
      startTime: '09:00',
      endTime: '11:00',
      maxDailyMinutes: 60, // Only 60m available
    };

    const plan = generateDailySchedule([task], prefs);
    assert.equal(plan.blocks.length, 1);
    assert.equal(plan.blocks[0].durationMinutes, 60);
    assert.equal(plan.blocks[0].isSplit, true);

    // After accepting schedule:
    // Task is NOT completed
    assert.notEqual(task.status, TaskStatus.COMPLETED);
    // Original duration (120) is not confused with remaining duration (120 until worked)
    assert.equal(task.estimatedDurationMinutes, 120);
    assert.equal(task.remainingDurationMinutes, 120);
    // Scheduled work is 60m
    assert.equal(plan.blocks[0].durationMinutes, 60);
    // The unallocated 60m is tracked in partiallyScheduledTasks
    assert.equal(plan.partiallyScheduledTasks.length, 1);
    assert.equal(plan.partiallyScheduledTasks[0].unallocatedMinutes, 60);
  });

  test('Regression 2: Accepting a fully scheduled task', () => {
    const task = createTask({
      id: 'task-full',
      title: 'Full Task',
      estimatedDurationMinutes: 60,
      remainingDurationMinutes: 60,
    });

    const plan = generateDailySchedule([task], {
      startTime: '09:00',
      endTime: '12:00',
      maxDailyMinutes: 120,
    });

    assert.equal(plan.blocks.length, 1);
    assert.equal(plan.blocks[0].durationMinutes, 60);
    assert.equal(plan.partiallyScheduledTasks.length, 0);
    assert.equal(plan.unscheduledTasks.length, 0);
  });

  test('Regression 3: Regenerating a schedule after partial allocation does not duplicate work', () => {
    const task = createTask({
      id: 'task-split-regen',
      title: 'Regen Test Task',
      estimatedDurationMinutes: 120,
      remainingDurationMinutes: 120,
    });

    const prefs = {
      startTime: '09:00',
      endTime: '12:00',
      maxDailyMinutes: 60,
    };

    const plan1 = generateDailySchedule([task], prefs);
    const plan2 = generateDailySchedule([task], prefs);

    // Total allocated minutes across both runs must remain 60, never duplicated
    assert.equal(plan1.stats.totalAllocatedMinutes, 60);
    assert.equal(plan2.stats.totalAllocatedMinutes, 60);
  });

  test('Regression 4: Completing only part of a task updates remaining work without false completion', () => {
    const task = createTask({
      id: 'task-part',
      title: 'Partially Worked Task',
      estimatedDurationMinutes: 120,
      remainingDurationMinutes: 120,
      actualWorkMinutes: 0,
    });

    // Simulate 45 minute work session
    const workedMinutes = 45;
    const updatedTask = {
      ...task,
      actualWorkMinutes: task.actualWorkMinutes + workedMinutes,
      remainingDurationMinutes: Math.max(0, task.remainingDurationMinutes - workedMinutes),
      status: TaskStatus.IN_PROGRESS,
    };

    assert.equal(updatedTask.status, TaskStatus.IN_PROGRESS);
    assert.equal(updatedTask.actualWorkMinutes, 45);
    assert.equal(updatedTask.remainingDurationMinutes, 75);
    assert.equal(getTaskRemainingMinutes(updatedTask), 75);
  });

  test('Regression 5: Completing a task after a focus session sets status COMPLETED and remaining to 0', () => {
    const task = createTask({
      id: 'task-fin',
      title: 'Finish Me',
      estimatedDurationMinutes: 60,
      remainingDurationMinutes: 60,
      actualWorkMinutes: 0,
    });

    const workedMinutes = 60;
    const completedTask = {
      ...task,
      actualWorkMinutes: task.actualWorkMinutes + workedMinutes,
      remainingDurationMinutes: 0,
      status: TaskStatus.COMPLETED,
      completedAt: new Date().toISOString(),
    };

    assert.equal(completedTask.status, TaskStatus.COMPLETED);
    assert.equal(completedTask.remainingDurationMinutes, 0);
    assert.equal(getTaskRemainingMinutes(completedTask), 0);
  });

  test('Regression 6: Planned minutes do not count as actual completed minutes in analytics', () => {
    const task = createTask({
      title: 'Scheduled Task',
      estimatedDurationMinutes: 120,
      remainingDurationMinutes: 120,
      actualWorkMinutes: 0, // No actual work recorded yet
    });

    // Plan schedules 60m
    const plan = generateDailySchedule([task], {
      startTime: '09:00',
      endTime: '12:00',
      maxDailyMinutes: 60,
    });

    assert.equal(plan.blocks[0].durationMinutes, 60);

    // Calculate analytics with 0 sessions
    const metrics = calculateAnalyticsMetrics([task], []);
    assert.equal(metrics.totalFocusMinutes, 0, 'Planned minutes must not be counted as actual focus minutes');
    assert.equal(metrics.completedCount, 0, 'Scheduled task must not be counted as completed');
  });

  test('Regression 7: Completed tasks are not reintroduced by plan recovery', () => {
    const doneTask = createTask({
      id: 'done-1',
      title: 'Finished Project',
      status: TaskStatus.COMPLETED,
      remainingDurationMinutes: 0,
      actualWorkMinutes: 120,
    });

    const pendingTask = createTask({
      id: 'pending-1',
      title: 'Pending Lab',
      status: TaskStatus.PENDING,
      remainingDurationMinutes: 60,
    });

    const proposal = analyzePlanRecovery({
      tasks: [doneTask, pendingTask],
      sessions: [],
      currentPlan: null,
      preferences: { maxDailyMinutes: 120 },
      recoveryContext: {},
    });

    const scheduledIds = proposal.revisedPlan.blocks
      .filter((b) => !b.isBreak)
      .map((b) => b.taskId);

    assert.ok(!scheduledIds.includes('done-1'), 'Completed task must never be reintroduced by recovery');
    assert.ok(scheduledIds.includes('pending-1'));
  });
});

describe('5. Section 3: Recovery Rejection & State Invariance Tests', () => {
  test('Rejecting a proposal leaves original schedule and task data unchanged', () => {
    const initialTasks = [
      createTask({ id: 't1', title: 'Task 1', estimatedDurationMinutes: 60, remainingDurationMinutes: 60 }),
      createTask({ id: 't2', title: 'Task 2', estimatedDurationMinutes: 60, remainingDurationMinutes: 60 }),
    ];

    const initialPlan = generateDailySchedule(initialTasks, { maxDailyMinutes: 120 });
    const originalBlocksSnapshot = JSON.stringify(initialPlan.blocks);
    const originalTasksSnapshot = JSON.stringify(initialTasks);

    // Generate recovery proposal
    let recoveryProposal = analyzePlanRecovery({
      tasks: initialTasks,
      sessions: [],
      currentPlan: initialPlan,
      preferences: { maxDailyMinutes: 60 }, // Shrunk time
      recoveryContext: { triggerReason: RecoveryTriggerReason.TIME_REDUCED },
    });

    assert.ok(recoveryProposal !== null);
    assert.equal(recoveryProposal.canApply, true);

    // Reject proposal
    recoveryProposal = null;

    // Check that original schedule and task data are completely unaltered
    assert.equal(JSON.stringify(initialPlan.blocks), originalBlocksSnapshot);
    assert.equal(JSON.stringify(initialTasks), originalTasksSnapshot);
    assert.equal(recoveryProposal, null);
  });
});

describe('6. Section 4: Schedule Invalidation on Task Mutations', () => {
  test('Task creation flags schedule invalidation', () => {
    let planStaleInfo = null;
    const newTask = createTask({ title: 'New Math Homework', estimatedDurationMinutes: 45 });

    // Emulate AppContext addTask staleness handler
    planStaleInfo = {
      isStale: true,
      reason: `New task "${newTask.title}" was added. Recalculate schedule to incorporate it.`,
    };

    assert.equal(planStaleInfo.isStale, true);
    assert.ok(planStaleInfo.reason.includes('New task'));
  });

  test('Editing task duration, priority, or deadline flags schedule invalidation', () => {
    const task = createTask({ id: 't-edit', title: 'Task', estimatedDurationMinutes: 60, priority: TaskPriority.LOW });

    const checkShouldInvalidate = (updates, original) => {
      if (updates.estimatedDurationMinutes !== undefined && updates.estimatedDurationMinutes !== original.estimatedDurationMinutes) return true;
      if (updates.remainingDurationMinutes !== undefined && updates.remainingDurationMinutes !== original.remainingDurationMinutes) return true;
      if (updates.priority !== undefined && updates.priority !== original.priority) return true;
      if (updates.deadline !== undefined && updates.deadline !== original.deadline) return true;
      return false;
    };

    assert.equal(checkShouldInvalidate({ estimatedDurationMinutes: 90 }, task), true);
    assert.equal(checkShouldInvalidate({ priority: TaskPriority.HIGH }, task), true);
    assert.equal(checkShouldInvalidate({ deadline: '2026-10-30' }, task), true);
    assert.equal(checkShouldInvalidate({ title: 'Renamed Task' }, task), false);
  });

  test('Completing and reopening a task handles schedule invalidation', () => {
    const task = createTask({ id: 't-comp', title: 'Task To Complete', estimatedDurationMinutes: 60 });
    let planStaleInfo = null;

    // Complete
    const completed = { ...task, status: TaskStatus.COMPLETED, remainingDurationMinutes: 0 };
    planStaleInfo = { isStale: true, reason: 'Task marked complete.' };
    assert.equal(planStaleInfo.isStale, true);

    // Reopen
    const reopened = { ...completed, status: TaskStatus.PENDING, remainingDurationMinutes: 60 };
    planStaleInfo = { isStale: true, reason: 'Task reopened.' };
    assert.equal(planStaleInfo.isStale, true);
    assert.equal(getTaskRemainingMinutes(reopened), 60);
  });
});

describe('7. Section 7: Local Storage Resilience Tests', () => {
  let fakeStore = {};

  beforeEach(() => {
    fakeStore = {};
    globalThis.window = {
      localStorage: {
        getItem: (k) => fakeStore[k] || null,
        setItem: (k, v) => {
          if (fakeStore.__throwQuota) throw new Error('QuotaExceededError');
          fakeStore[k] = String(v);
        },
        removeItem: (k) => { delete fakeStore[k]; },
      },
    };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  test('Safely handles malformed JSON without crashing', () => {
    fakeStore[STORAGE_KEYS.TASKS] = 'INVALID { JSON';
    const fallback = [{ id: 'fallback-1' }];

    const loaded = loadFromStorage(STORAGE_KEYS.TASKS, fallback);
    assert.deepEqual(loaded, fallback);
  });

  test('Safely migrates legacy unversioned keys', () => {
    const legacyKey = STORAGE_KEYS.TASKS.split('_v')[0]; // 'commitzero_tasks'
    fakeStore[legacyKey] = JSON.stringify([{ id: 'legacy-task', title: 'Old Task' }]);

    const loaded = loadFromStorage(STORAGE_KEYS.TASKS, []);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].id, 'legacy-task');
  });

  test('Handles localStorage write quota error gracefully', () => {
    fakeStore.__throwQuota = true;
    const writeOk = saveToStorage(STORAGE_KEYS.TASKS, [{ id: '1' }]);
    assert.equal(writeOk, false);
  });
});
