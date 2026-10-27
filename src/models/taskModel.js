// CommitZero - Task Model & Domain Logic
// Pure JavaScript, validation, and status transitions

export const TaskPriority = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const TaskStatus = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const TASK_SUBJECTS = [
  'Computer Science',
  'Software Engineering',
  'Mathematics',
  'Web Development',
  'Algorithms & Data Structures',
  'Database Systems',
  'General Revision',
];

export function validateTaskInput(input) {
  const errors = {};

  if (!input.title || !input.title.trim()) {
    errors.title = 'Task title is required.';
  } else if (input.title.trim().length > 120) {
    errors.title = 'Task title must be under 120 characters.';
  }

  const duration = Number(input.estimatedDurationMinutes);
  if (isNaN(duration) || duration <= 0) {
    errors.estimatedDurationMinutes = 'Estimated duration must be greater than 0 minutes.';
  } else if (duration > 1440) {
    errors.estimatedDurationMinutes = 'Duration cannot exceed 24 hours (1440 minutes). Break large projects into subtasks.';
  }

  const validPriorities = Object.values(TaskPriority);
  if (input.priority && !validPriorities.includes(input.priority)) {
    errors.priority = 'Invalid priority level.';
  }

  if (input.deadline) {
    const deadlineDate = new Date(input.deadline);
    if (isNaN(deadlineDate.getTime())) {
      errors.deadline = 'Invalid deadline date format.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function createTask({
  id = null,
  title,
  description = '',
  estimatedDurationMinutes,
  remainingDurationMinutes = null,
  actualWorkMinutes = 0,
  deadline = null,
  priority = TaskPriority.MEDIUM,
  status = TaskStatus.PENDING,
  subject = 'Computer Science',
  createdAt = null,
  completedAt = null,
}) {
  const validDuration = Math.max(1, Math.round(Number(estimatedDurationMinutes) || 30));
  const remaining = remainingDurationMinutes !== null
    ? Math.max(0, Math.round(Number(remainingDurationMinutes)))
    : validDuration;

  return {
    id: id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    title: (title || '').trim(),
    description: (description || '').trim(),
    estimatedDurationMinutes: validDuration,
    remainingDurationMinutes: remaining,
    actualWorkMinutes: Math.max(0, Math.round(Number(actualWorkMinutes) || 0)),
    deadline: deadline || null,
    priority: Object.values(TaskPriority).includes(priority) ? priority : TaskPriority.MEDIUM,
    status: Object.values(TaskStatus).includes(status) ? status : TaskStatus.PENDING,
    subject: subject || 'Computer Science',
    createdAt: createdAt || new Date().toISOString(),
    completedAt: completedAt || null,
  };
}

export function isTaskOverdue(task, referenceDate = new Date()) {
  if (!task || task.status === TaskStatus.COMPLETED || !task.deadline) {
    return false;
  }
  const deadlineDate = new Date(task.deadline);
  return deadlineDate.getTime() < referenceDate.getTime();
}

export function isTaskDueSoon(task, hours = 48, referenceDate = new Date()) {
  if (!task || task.status === TaskStatus.COMPLETED || !task.deadline) {
    return false;
  }
  const deadlineDate = new Date(task.deadline);
  const now = referenceDate.getTime();
  const threshold = now + hours * 60 * 60 * 1000;
  return deadlineDate.getTime() >= now && deadlineDate.getTime() <= threshold;
}

export function getPriorityWeight(priority) {
  switch (priority) {
    case TaskPriority.HIGH:
      return 3;
    case TaskPriority.MEDIUM:
      return 2;
    case TaskPriority.LOW:
      return 1;
    default:
      return 1;
  }
}
