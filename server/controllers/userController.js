import User from '../models/User.js';
import DailyPlan from '../models/DailyPlan.js';
import { asyncHandler } from '../middleware/errors.js';

export const getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).select('preferences').lean();
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User account was not found.' } });
  res.json({ preferences: user.preferences || {} });
});
export const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = req.body?.preferences;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return res.status(400).json({ error: { code: 'INVALID_PREFERENCES', message: 'Preferences must be a JSON object.' } });
  const user = await User.findByIdAndUpdate(req.userId, { $set: { preferences } }, { new: true, runValidators: true }).select('preferences').lean();
  if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User account was not found.' } });
  res.json({ preferences: user.preferences || {} });
});
export const getPlan = asyncHandler(async (req, res) => {
  const planDate = String(req.params.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) return res.status(400).json({ error: { code: 'INVALID_PLAN_DATE', message: 'Plan date must use YYYY-MM-DD format.' } });
  const doc = await DailyPlan.findOne({ userId: req.userId, planDate }).lean();
  res.json({ plan: doc?.plan || null });
});
export const savePlan = asyncHandler(async (req, res) => {
  const planDate = String(req.body?.planDate || req.body?.plan?.planDate || '');
  const plan = req.body?.plan;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate) || !plan || typeof plan !== 'object' || Array.isArray(plan)) return res.status(400).json({ error: { code: 'INVALID_PLAN', message: 'A plan object and YYYY-MM-DD planDate are required.' } });
  const doc = await DailyPlan.findOneAndUpdate({ userId: req.userId, planDate }, { $set: { plan } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  res.json({ plan: doc.plan });
});
