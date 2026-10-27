import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, trim: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  description: { type: String, default: '', maxlength: 5000 },
  estimatedDurationMinutes: { type: Number, required: true, min: 1, max: 1440 },
  remainingDurationMinutes: { type: Number, required: true, min: 0, max: 1440 },
  actualWorkMinutes: { type: Number, default: 0, min: 0 },
  deadline: { type: String, default: null },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  subject: { type: String, default: 'Computer Science', maxlength: 120 },
  completedAt: { type: Date, default: null },
  clientCreatedAt: { type: Date, default: null },
}, { timestamps: true, minimize: false });

taskSchema.index({ userId: 1, updatedAt: -1 });
export default mongoose.models.Task || mongoose.model('Task', taskSchema);
