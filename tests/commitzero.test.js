// CommitZero - Automated Test Suite
// Pure JavaScript, uses Node.js native test runner and assert module

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTask,
  validateTaskInput,
  TaskPriority,
  TaskStatus,
  isTaskOverdue,
  isTaskDueSoon,
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
  defaultPreferences,
} from '../src/utils/storage.js';

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
});

describe('2. Scheduling Engine Tests', () => {
  const prefs = {
    planDate: '2026-10-27',
    startTime: '09:00',
    endTime: '17:00',
    maxDailyMinutes: 180, // 3 hours available
    breakDurationMinutes: 10,
    unavailablePeriods: [
      { id: 'lunch', title: 'Lunch', startTime: '12:00', endTime: '13:00' }
    ],
  };

  test('Test 1: All tasks fit within available time when work <= available time', () => {
    const tasks = [
      createTask({ title: 'Task A', estimatedDurationMinutes: 60, priority: TaskPriority.HIGH }),
      createTask({ title: 'Task B', estimatedDurationMinutes: 60, priority: TaskPriority.MEDIUM }),
    ];

    const plan = generateDailySchedule(tasks, prefs, '2026-10-27');
    assert.equal(plan.unscheduledTasks.length, 0);
    assert.equal(plan.stats.isOverloaded, false);
    const taskBlocks = plan.blocks.filter((b) => !b.isBreak);
    assert.equal(taskBlocks.length, 2);
  });

  test('Test 2: Total work exceeds available time (Overload detection)', () => {
    // 4 tasks matching Section 16 demonstration
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
    assert.ok(plan.unscheduledTasks.length > 0);
    // Allocated time cannot exceed study budget of 180m
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

  test('Test 8 & 9: Respects unavailable periods and unallocated tasks are reported with reasons', () => {
    const tasks = [
      createTask({ title: 'Big Task', estimatedDurationMinutes: 180 }),
      createTask({ title: 'Second Task', estimatedDurationMinutes: 120 }),
    ];

    const plan = generateDailySchedule(tasks, prefs);
    // Check no block overlaps with lunch (12:00 to 13:00 -> 720 to 780 min)
    plan.blocks.forEach((b) => {
      const overlapsWithLunch = b.startMinutes < 780 && b.endMinutes > 720;
      assert.equal(overlapsWithLunch, false, `Block ${b.title || b.taskTitle} overlaps with lunch window!`);
    });

    assert.ok(plan.unscheduledTasks.length > 0);
    assert.ok(plan.unscheduledTasks[0].reason.length > 0);
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
});

describe('4. Plan Recovery Engine Tests', () => {
  test('Recovery Scenario 1: A task takes longer than expected and updates schedule', () => {
    const tasks = [
      createTask({
        id: 'task-express',
        title: 'Revise Express.js',
        estimatedDurationMinutes: 120,
        actualWorkMinutes: 90,
        remainingDurationMinutes: 60, // Took 90m and still needs 60m (total 150m)
        priority: TaskPriority.HIGH,
      }),
      createTask({
        id: 'task-mongo',
        title: 'Complete a MongoDB assignment',
        estimatedDurationMinutes: 180,
        remainingDurationMinutes: 180,
        priority: TaskPriority.HIGH,
      }),
      createTask({
        id: 'task-algo',
        title: 'Practice algorithms',
        estimatedDurationMinutes: 120,
        remainingDurationMinutes: 120,
        priority: TaskPriority.MEDIUM,
      }),
      createTask({
        id: 'task-lecture',
        title: 'Revise lecture notes',
        estimatedDurationMinutes: 60,
        remainingDurationMinutes: 60,
        priority: TaskPriority.MEDIUM,
      }),
    ];

    const proposal = analyzePlanRecovery({
      tasks,
      sessions: [
        createSessionRecord({
          taskId: 'task-express',
          taskTitle: 'Revise Express.js',
          activeDurationSeconds: 90 * 60,
          plannedDurationMinutes: 120,
          outcome: SessionOutcome.INCOMPLETE,
        })
      ],
      currentPlan: null,
      preferences: {
        startTime: '13:00',
        endTime: '17:00',
        maxDailyMinutes: 180,
      },
      recoveryContext: {
        triggerReason: RecoveryTriggerReason.TASK_RAN_OVER,
        affectedTaskId: 'task-express',
        overrideAvailableMinutes: 90, // 90 min remaining in day
      },
    });

    assert.ok(proposal);
    assert.equal(proposal.effectiveAvailableMinutes, 90);
    // Explanations must be generated
    assert.ok(proposal.explanations.length > 0);
    // Non-overlapping revised blocks
    const revisedBlocks = proposal.revisedPlan.blocks;
    for (let i = 0; i < revisedBlocks.length - 1; i++) {
      assert.ok(revisedBlocks[i].endMinutes <= revisedBlocks[i + 1].startMinutes);
    }
  });

  test('Completed tasks remain completed during recovery', () => {
    const tasks = [
      createTask({
        id: 'task-done',
        title: 'Done Lab',
        status: TaskStatus.COMPLETED,
        remainingDurationMinutes: 0,
        actualWorkMinutes: 60,
      }),
      createTask({
        id: 'task-pending',
        title: 'Pending Lab',
        status: TaskStatus.PENDING,
        remainingDurationMinutes: 45,
      }),
    ];

    const proposal = analyzePlanRecovery({
      tasks,
      sessions: [],
      currentPlan: null,
      preferences: { maxDailyMinutes: 120 },
      recoveryContext: {},
    });

    const revisedIds = proposal.revisedPlan.blocks.filter((b) => !b.isBreak).map((b) => b.taskId);
    assert.ok(!revisedIds.includes('task-done'));
    assert.ok(revisedIds.includes('task-pending'));
  });
});

describe('5. Analytics Metrics Tests', () => {
  test('Calculates metrics without division by zero on empty dataset', () => {
    const metrics = calculateAnalyticsMetrics([], []);
    assert.equal(metrics.totalTasks, 0);
    assert.equal(metrics.completionRate, 0);
    assert.equal(metrics.totalFocusMinutes, 0);
    assert.equal(metrics.underestimationRatio, 1.0);
  });

  test('Computes realistic underestimation factor from actual logged work', () => {
    const tasks = [
      createTask({
        title: 'Project A',
        estimatedDurationMinutes: 60,
        actualWorkMinutes: 90, // Took 1.5x longer
      }),
      createTask({
        title: 'Project B',
        estimatedDurationMinutes: 60,
        actualWorkMinutes: 60, // Took exact
      }),
    ];

    const metrics = calculateAnalyticsMetrics(tasks, []);
    // Total estimated = 120, Total actual = 150 -> 150 / 120 = 1.25x
    assert.equal(metrics.underestimationRatio, 1.25);
  });
});
