import mongoose from 'mongoose';
import Task from '../models/Task.js';
import { asyncHandler } from '../middleware/errors.js';

function serialize(task) {
  const item = task.toObject ? task.toObject() : task;
  return {
    id: item.clientId || String(item._id),
    title: item.title,
    description: item.description || '',
    estimatedDurationMinutes: item.estimatedDurationMinutes,
    remainingDurationMinutes: item.status === 'Completed' ? 0 : item.remainingDurationMinutes,
    actualWorkMinutes: item.actualWorkMinutes || 0,
    deadline: item.deadline || null,
    priority: item.priority,
    status: item.status,
    subject: item.subject || 'Computer Science',
    createdAt: item.clientCreatedAt ? new Date(item.clientCreatedAt).toISOString() : item.createdAt.toISOString(),
    completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : null,
    updatedAt: item.updatedAt?.toISOString?.() || null,
  };
}
function validateTask(body, partial = false) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) errors.push('Title must be between 1 and 120 characters.');
  }
  if (!partial || body.estimatedDurationMinutes !== undefined) {
    const d = Number(body.estimatedDurationMinutes);
    if (!Number.isFinite(d) || d < 1 || d > 1440) errors.push('Estimated duration must be between 1 and 1440 minutes.');
  }
  if (body.remainingDurationMinutes !== undefined && (!Number.isFinite(Number(body.remainingDurationMinutes)) || Number(body.remainingDurationMinutes) < 0 || Number(body.remainingDurationMinutes) > 1440)) errors.push('Remaining duration must be between 0 and 1440 minutes.');
  if (body.actualWorkMinutes !== undefined && (!Number.isFinite(Number(body.actualWorkMinutes)) || Number(body.actualWorkMinutes) < 0)) errors.push('Actual work minutes must be zero or greater.');
  if (body.priority !== undefined && !['Low', 'Medium', 'High'].includes(body.priority)) errors.push('Priority must be Low, Medium, or High.');
  if (body.status !== undefined && !['Pending', 'In Progress', 'Completed'].includes(body.status)) errors.push('Status is invalid.');
  if (body.deadline && Number.isNaN(new Date(body.deadline).getTime())) errors.push('Deadline must be a valid date.');
  return errors;
}
const failValidation = (res, details) => res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Task data is invalid.', details } });

export const listTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ userId: req.userId }).sort({ clientCreatedAt: -1, createdAt: -1 }).lean();
  res.json({ tasks: tasks.map(serialize) });
});

export const createTask = asyncHandler(async (req, res) => {
  const errors = validateTask(req.body || {});
  if (errors.length) return failValidation(res, errors);
  const body = req.body;
  const status = body.status || 'Pending';
  const task = await Task.create({
    userId: req.userId,
    clientId: typeof body.id === 'string' ? body.id.slice(0, 120) : undefined,
    title: body.title.trim(), description: String(body.description || '').slice(0, 5000),
    estimatedDurationMinutes: Math.round(Number(body.estimatedDurationMinutes)),
    remainingDurationMinutes: status === 'Completed' ? 0 : Math.round(Number(body.remainingDurationMinutes ?? body.estimatedDurationMinutes)),
    actualWorkMinutes: Math.max(0, Math.round(Number(body.actualWorkMinutes || 0))),
    deadline: body.deadline || null, priority: body.priority || 'Medium', status,
    subject: String(body.subject || 'Computer Science').slice(0, 120),
    completedAt: status === 'Completed' ? (body.completedAt || new Date()) : null,
    clientCreatedAt: body.createdAt && !Number.isNaN(new Date(body.createdAt).getTime()) ? new Date(body.createdAt) : new Date(),
  });
  res.status(201).json({ task: serialize(task) });
});

export const updateTask = asyncHandler(async (req, res) => {
  const errors = validateTask(req.body || {}, true);
  if (errors.length) return failValidation(res, errors);
  const updates = {};
  const allowed = ['title', 'description', 'estimatedDurationMinutes', 'remainingDurationMinutes', 'actualWorkMinutes', 'deadline', 'priority', 'status', 'subject', 'completedAt'];
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  if (updates.title !== undefined) updates.title = updates.title.trim();
  for (const key of ['estimatedDurationMinutes', 'remainingDurationMinutes', 'actualWorkMinutes']) if (updates[key] !== undefined) updates[key] = Math.round(Number(updates[key]));
  if (updates.status === 'Completed') { updates.remainingDurationMinutes = 0; updates.completedAt = updates.completedAt || new Date(); }
  if (updates.status && updates.status !== 'Completed' && updates.completedAt === undefined) updates.completedAt = null;
  const filter = { userId: req.userId, $or: [{ clientId: req.params.id }] };
  if (mongoose.isValidObjectId(req.params.id)) filter.$or.push({ _id: req.params.id });
  const task = await Task.findOneAndUpdate(filter, { $set: updates }, { new: true, runValidators: true });
  if (!task) return res.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'Task was not found.' } });
  res.json({ task: serialize(task) });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const filter = { userId: req.userId, $or: [{ clientId: req.params.id }] };
  if (mongoose.isValidObjectId(req.params.id)) filter.$or.push({ _id: req.params.id });
  const deleted = await Task.findOneAndDelete(filter);
  if (!deleted) return res.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'Task was not found.' } });
  res.status(204).end();
});
