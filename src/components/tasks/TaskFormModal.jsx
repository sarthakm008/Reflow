// CommitZero - Task Creation & Editing Modal
// Pure JavaScript, validation, and accessible form controls

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { TASK_SUBJECTS, TaskPriority, validateTaskInput } from '../../models/taskModel.js';
import { X, AlertCircle } from 'lucide-react';

export default function TaskFormModal({ isOpen, onClose, taskToEdit = null }) {
  const { addTask, updateTask } = useApp();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    estimatedDurationMinutes: 60,
    remainingDurationMinutes: 60,
    priority: TaskPriority.MEDIUM,
    subject: 'Computer Science',
    deadline: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (taskToEdit) {
      setFormData({
        title: taskToEdit.title || '',
        description: taskToEdit.description || '',
        estimatedDurationMinutes: taskToEdit.estimatedDurationMinutes || 60,
        remainingDurationMinutes:
          taskToEdit.remainingDurationMinutes !== undefined
            ? taskToEdit.remainingDurationMinutes
            : taskToEdit.estimatedDurationMinutes || 60,
        priority: taskToEdit.priority || TaskPriority.MEDIUM,
        subject: taskToEdit.subject || 'Computer Science',
        deadline: taskToEdit.deadline ? taskToEdit.deadline.slice(0, 16) : '',
      });
    } else {
      // Default new task with tomorrow 17:00 deadline
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      tomorrow.setHours(17, 0, 0, 0);
      const isoLocal = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setFormData({
        title: '',
        description: '',
        estimatedDurationMinutes: 60,
        remainingDurationMinutes: 60,
        priority: TaskPriority.MEDIUM,
        subject: 'Computer Science',
        deadline: isoLocal,
      });
    }
    setErrors({});
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const submission = {
      ...formData,
      estimatedDurationMinutes: Number(formData.estimatedDurationMinutes),
      remainingDurationMinutes: Number(formData.remainingDurationMinutes),
      deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
    };

    const validation = validateTaskInput(submission);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    if (taskToEdit) {
      updateTask(taskToEdit.id, submission);
    } else {
      addTask(submission);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-900">
            {taskToEdit ? 'Edit Task' : 'Create New Academic Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Revise Express.js middleware or MongoDB assignment"
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                errors.title ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            {errors.title && (
              <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.title}
              </p>
            )}
          </div>

          {/* Subject & Priority in 2 cols */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject / Category
              </label>
              <select
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {TASK_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value={TaskPriority.HIGH}>High (Critical focus)</option>
                <option value={TaskPriority.MEDIUM}>Medium (Standard)</option>
                <option value={TaskPriority.LOW}>Low (Flexible / Backlog)</option>
              </select>
            </div>
          </div>

          {/* Estimated Duration & Remaining Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estimated Duration (Minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="estimatedDurationMinutes"
                value={formData.estimatedDurationMinutes}
                onChange={handleChange}
                min="5"
                max="1440"
                step="5"
                className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.estimatedDurationMinutes ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {errors.estimatedDurationMinutes && (
                <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.estimatedDurationMinutes}
                </p>
              )}
            </div>

            {taskToEdit ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remaining Work (Minutes)
                </label>
                <input
                  type="number"
                  name="remainingDurationMinutes"
                  value={formData.remainingDurationMinutes}
                  onChange={handleChange}
                  min="0"
                  max="1440"
                  step="5"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Deadline
                </label>
                <input
                  type="datetime-local"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          {taskToEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Deadline
              </label>
              <input
                type="datetime-local"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description or Notes (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Key concepts, textbook chapters, or project deliverables..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
            >
              {taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
