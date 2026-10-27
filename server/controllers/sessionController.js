import FocusSession from '../models/FocusSession.js';
import { asyncHandler } from '../middleware/errors.js';

function serialize(s) {
  const item = s.toObject ? s.toObject() : s;
  return {
    id: item.clientId || String(item._id), taskId: item.taskId, taskTitle: item.taskTitle,
    startTime: new Date(item.startTime).toISOString(), endTime: new Date(item.endTime).toISOString(),
    activeDurationSeconds: item.activeDurationSeconds, activeDurationMinutes: item.activeDurationMinutes,
    plannedDurationMinutes: item.plannedDurationMinutes, outcome: item.outcome, notes: item.notes || '',
    createdAt: item.clientCreatedAt ? new Date(item.clientCreatedAt).toISOString() : new Date(item.createdAt).toISOString(),
  };
}
export const listSessions = asyncHandler(async (req, res) => {
  const sessions = await FocusSession.find({ userId: req.userId }).sort({ startTime: -1 }).limit(2000).lean();
  res.json({ sessions: sessions.map(serialize) });
});
export const createSession = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const start = new Date(b.startTime);
  const end = new Date(b.endTime);
  const seconds = Number(b.activeDurationSeconds);
  const planned = Number(b.plannedDurationMinutes);
  if (!b.startTime || Number.isNaN(start.getTime()) || !b.endTime || Number.isNaN(end.getTime()) || end < start) return res.status(400).json({ error: { code: 'INVALID_SESSION_TIME', message: 'Valid start and end times are required.' } });
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(planned) || planned < 1 || planned > 1440) return res.status(400).json({ error: { code: 'INVALID_SESSION_DURATION', message: 'Session duration values are invalid.' } });
  const session = await FocusSession.create({
    userId: req.userId, clientId: typeof b.id === 'string' ? b.id.slice(0, 120) : undefined,
    taskId: String(b.taskId || 'unlinked').slice(0, 120), taskTitle: String(b.taskTitle || 'Untitled Task').slice(0, 120),
    startTime: start, endTime: end, activeDurationSeconds: Math.round(seconds),
    activeDurationMinutes: Math.max(0, Math.round(seconds / 60)), plannedDurationMinutes: Math.round(planned),
    outcome: ['Completed', 'Incomplete', 'Abandoned'].includes(b.outcome) ? b.outcome : 'Incomplete',
    notes: String(b.notes || '').slice(0, 5000),
    clientCreatedAt: b.createdAt && !Number.isNaN(new Date(b.createdAt).getTime()) ? new Date(b.createdAt) : new Date(),
  });
  res.status(201).json({ session: serialize(session) });
});
