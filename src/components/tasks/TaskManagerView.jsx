// CommitZero - Task Manager View
// Pure JavaScript, complete task lifecycle with filtering, sorting, and search

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Play,
  Edit2,
  Trash2,
  RotateCcw,
  AlertCircle,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatMinutesHuman } from '../../models/sessionModel.js';
import { isTaskOverdue, isTaskDueSoon, TaskStatus, TaskPriority } from '../../models/taskModel.js';
import TaskFormModal from './TaskFormModal.jsx';

export default function TaskManagerView() {
  const {
    tasks,
    deleteTask,
    toggleTaskComplete,
    reopenTask,
    startFocusSession,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, IN_PROGRESS, COMPLETED, OVERDUE, DUE_SOON
  const [sortBy, setSortBy] = useState('DEADLINE'); // DEADLINE, PRIORITY, DURATION, CREATED

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);

  // Deletion confirmation state
  const [taskToDelete, setTaskToDelete] = useState(null);

  const now = new Date();

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.subject && t.subject.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === 'PENDING') {
      result = result.filter((t) => t.status === TaskStatus.PENDING);
    } else if (statusFilter === 'IN_PROGRESS') {
      result = result.filter((t) => t.status === TaskStatus.IN_PROGRESS);
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter((t) => t.status === TaskStatus.COMPLETED);
    } else if (statusFilter === 'OVERDUE') {
      result = result.filter((t) => isTaskOverdue(t, now));
    } else if (statusFilter === 'DUE_SOON') {
      result = result.filter((t) => isTaskDueSoon(t, 48, now));
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'DEADLINE') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }
      if (sortBy === 'PRIORITY') {
        const pOrder = { [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
        return (pOrder[b.priority] || 1) - (pOrder[a.priority] || 1);
      }
      if (sortBy === 'DURATION') {
        return (
          (a.remainingDurationMinutes || a.estimatedDurationMinutes) -
          (b.remainingDurationMinutes || b.estimatedDurationMinutes)
        );
      }
      if (sortBy === 'CREATED') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return 0;
    });

    return result;
  }, [tasks, searchQuery, statusFilter, sortBy, now]);

  const handleOpenCreate = () => {
    setTaskToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete.id);
      setTaskToDelete(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Academic Tasks</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your assignments, code reviews, and revision priorities.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Academic Task</span>
        </button>
      </div>

      {/* Controls: Search, Filter Tabs, Sort */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, subject, or description..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs py-1.5 px-2.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
            >
              <option value="DEADLINE">Deadline (Earliest)</option>
              <option value="PRIORITY">Priority (Highest)</option>
              <option value="DURATION">Remaining Duration</option>
              <option value="CREATED">Creation Date</option>
            </select>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 text-xs">
          {[
            { id: 'ALL', label: 'All Tasks', count: tasks.length },
            { id: 'PENDING', label: 'Pending', count: tasks.filter((t) => t.status === TaskStatus.PENDING).length },
            { id: 'IN_PROGRESS', label: 'In Progress', count: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length },
            { id: 'COMPLETED', label: 'Completed', count: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length },
            { id: 'OVERDUE', label: 'Overdue', count: tasks.filter((t) => isTaskOverdue(t, now)).length },
            { id: 'DUE_SOON', label: 'Due Soon (48h)', count: tasks.filter((t) => isTaskDueSoon(t, 48, now)).length },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task List / Cards */}
      {filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const isDone = task.status === TaskStatus.COMPLETED;
            const isOver = isTaskOverdue(task, now);
            const isSoon = isTaskDueSoon(task, 48, now);

            const remaining = task.remainingDurationMinutes !== undefined
              ? task.remainingDurationMinutes
              : task.estimatedDurationMinutes;
            const actual = task.actualWorkMinutes || 0;
            const totalWork = actual + remaining;
            const percentWorked = totalWork > 0 ? Math.min(100, Math.round((actual / totalWork) * 100)) : 0;

            const deadlineDisplay = task.deadline
              ? new Date(task.deadline).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'No deadline';

            return (
              <div
                key={task.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
                  isDone
                    ? 'border-slate-200 bg-slate-50/50 opacity-75'
                    : isOver
                    ? 'border-red-300 ring-1 ring-red-200'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Card Header: Subject, Priority, Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                      {task.subject}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                          task.priority === TaskPriority.HIGH
                            ? 'bg-red-100 text-red-800'
                            : task.priority === TaskPriority.MEDIUM
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {task.priority} Priority
                      </span>

                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : task.status === TaskStatus.IN_PROGRESS
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3
                    className={`text-sm font-bold tracking-tight mt-1 ${
                      isDone ? 'line-through text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Deadline info */}
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Calendar className={`w-3.5 h-3.5 ${isOver ? 'text-red-500' : 'text-slate-400'}`} />
                    <span
                      className={`font-medium ${
                        isOver
                          ? 'text-red-600 font-bold'
                          : isSoon
                          ? 'text-amber-700 font-semibold'
                          : 'text-slate-500'
                      }`}
                    >
                      {isOver ? 'Overdue: ' : 'Deadline: '} {deadlineDisplay}
                    </span>
                  </div>

                  {/* Progress / Duration Breakdown */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span>
                        Worked: <strong className="font-mono text-slate-800">{formatMinutesHuman(actual)}</strong>
                      </span>
                      <span>
                        Remaining: <strong className="font-mono text-slate-800">{formatMinutesHuman(remaining)}</strong>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isDone ? 'bg-emerald-500' : 'bg-slate-800'
                        }`}
                        style={{ width: `${isDone ? 100 : percentWorked}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <button
                        type="button"
                        onClick={() => reopenTask(task.id)}
                        className="p-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1"
                        title="Reopen Task"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reopen</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleTaskComplete(task.id)}
                        className="p-1.5 text-xs text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors flex items-center gap-1 font-medium"
                        title="Mark Completed"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="hidden sm:inline">Done</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(task)}
                      className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                      title="Edit Task"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskToDelete(task)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!isDone && (
                    <button
                      type="button"
                      onClick={() => startFocusSession(task.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-xs transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Start Focus</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md mx-auto my-6">
          <Layers className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No matching tasks</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or switching the status filter tab.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
            }}
            className="mt-4 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Task Creation & Edit Modal */}
      <TaskFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
      />

      {/* Delete Confirmation Dialog */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">Delete Task?</h3>
            <p className="text-xs text-slate-600 mt-2">
              Are you sure you want to delete <strong className="text-slate-900">"{taskToDelete.title}"</strong>?
              Past focus session records will be safely preserved in your analytics history.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
