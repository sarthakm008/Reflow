import mongoose from 'mongoose';

const focusSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, trim: true, maxlength: 120 },
  taskId: { type: String, default: 'unlinked', maxlength: 120 },
  taskTitle: { type: String, default: 'Untitled Task', maxlength: 120 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  activeDurationSeconds: { type: Number, required: true, min: 0 },
  activeDurationMinutes: { type: Number, required: true, min: 0 },
  plannedDurationMinutes: { type: Number, required: true, min: 1, max: 1440 },
  outcome: { type: String, enum: ['Completed', 'Incomplete', 'Abandoned'], default: 'Completed' },
  notes: { type: String, default: '', maxlength: 5000 },
  clientCreatedAt: { type: Date, default: null },
}, { timestamps: true, minimize: false });

focusSessionSchema.index({ userId: 1, startTime: -1 });
export default mongoose.models.FocusSession || mongoose.model('FocusSession', focusSessionSchema);
