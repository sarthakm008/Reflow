import mongoose from 'mongoose';

const dailyPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  plan: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, minimize: false });

dailyPlanSchema.index({ userId: 1, planDate: 1 }, { unique: true });
export default mongoose.models.DailyPlan || mongoose.model('DailyPlan', dailyPlanSchema);
