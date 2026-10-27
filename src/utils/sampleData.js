// CommitZero - Primary Demonstration & Sample Data
// Pure JavaScript, matches the official prompt evaluation scenario exactly

import { TaskPriority, TaskStatus, createTask } from '../models/taskModel.js';
import { createSessionRecord, SessionOutcome } from '../models/sessionModel.js';

export function getCollegeStudentDemoTasks() {
  const now = new Date();

  // Tomorrow deadline (24 hours from now)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(17, 0, 0, 0);

  // In 2 days deadline (48 hours from now)
  const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  inTwoDays.setHours(18, 0, 0, 0);

  // In 3 days deadline (72 hours from now)
  const inThreeDays = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  inThreeDays.setHours(23, 59, 0, 0);

  return [
    createTask({
      id: 'demo-task-express',
      title: 'Revise Express.js',
      description: 'Review routing, middleware chaining, error handlers, and REST API conventions.',
      estimatedDurationMinutes: 120,
      remainingDurationMinutes: 120,
      actualWorkMinutes: 0,
      deadline: tomorrow.toISOString(),
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
      subject: 'Web Development',
    }),
    createTask({
      id: 'demo-task-mongodb',
      title: 'Complete a MongoDB assignment',
      description: 'Aggregation pipelines, indexing strategies, and schema validation scripts.',
      estimatedDurationMinutes: 180,
      remainingDurationMinutes: 180,
      actualWorkMinutes: 0,
      deadline: tomorrow.toISOString(),
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
      subject: 'Database Systems',
    }),
    createTask({
      id: 'demo-task-algorithms',
      title: 'Practice algorithms',
      description: 'Graph traversal (BFS/DFS), shortest path algorithms, and dynamic programming memoization.',
      estimatedDurationMinutes: 120,
      remainingDurationMinutes: 120,
      actualWorkMinutes: 0,
      deadline: inThreeDays.toISOString(),
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      subject: 'Algorithms & Data Structures',
    }),
    createTask({
      id: 'demo-task-lecture',
      title: 'Revise lecture notes',
      description: 'Operating systems memory management, virtual paging, and page replacement algorithms.',
      estimatedDurationMinutes: 60,
      remainingDurationMinutes: 60,
      actualWorkMinutes: 0,
      deadline: inTwoDays.toISOString(),
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      subject: 'Computer Science',
    }),
  ];
}

export function getDemoPreferences() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  return {
    planDate: dateStr,
    startTime: '13:00',
    endTime: '17:00',
    maxDailyMinutes: 180, // Section 16 requirement: "The student has only 180 minutes available today."
    breakDurationMinutes: 10,
    workIntervalMinutes: 50,
    unavailablePeriods: [
      { id: 'office-hours', title: 'Prof Office Hours', startTime: '15:00', endTime: '15:30' }
    ],
  };
}

/**
 * Simulates the Section 16 mid-day progress event:
 * "The student begins revising Express.js.
 * After working for 90 minutes, the student records that the task requires another 60 minutes."
 */
export function simulateSection16MiddayProgress(tasks = [], existingSessions = []) {
  const expressTask = tasks.find((t) => t.id === 'demo-task-express' || t.title.toLowerCase().includes('express'));

  if (!expressTask) {
    throw new Error('Express.js revision task not found in active task list.');
  }

  const now = new Date();
  const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);

  // 1. Create a 90-minute focus session record
  const newSession = createSessionRecord({
    taskId: expressTask.id,
    taskTitle: expressTask.title,
    startTime: ninetyMinutesAgo.toISOString(),
    endTime: now.toISOString(),
    activeDurationSeconds: 90 * 60, // 90 minutes
    plannedDurationMinutes: 120,
    outcome: SessionOutcome.INCOMPLETE,
    notes: 'Covered middleware and router modules. Requires another 60m for error handling and async error propagation.',
  });

  // 2. Update task: accumulated actual work = 90m, remaining work = 60m (total work = 150m)
  const updatedTasks = tasks.map((t) => {
    if (t.id === expressTask.id) {
      return {
        ...t,
        status: TaskStatus.IN_PROGRESS,
        actualWorkMinutes: (t.actualWorkMinutes || 0) + 90,
        remainingDurationMinutes: 60, // Student recorded it requires another 60 mins
      };
    }
    return t;
  });

  return {
    updatedTasks,
    newSession,
    updatedSessions: [newSession, ...existingSessions],
  };
}
