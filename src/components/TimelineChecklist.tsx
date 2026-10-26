'use client';

import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus } from '@/types/event';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  User,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  Link2,
} from 'lucide-react';

interface TimelineChecklistProps {
  tasks: Task[];
  eventDate: string;
  onUpdateTasks: (tasks: Task[]) => void;
}

export const TimelineChecklist: React.FC<TimelineChecklistProps> = ({
  tasks,
  eventDate,
  onUpdateTasks,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    category: 'General',
    dueDate: '',
    priority: 'medium' as TaskPriority,
    owner: 'Organizer',
    prerequisiteTaskId: '',
    notes: '',
  });

  const today = new Date().toISOString().split('T')[0];

  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const nextStatus: TaskStatus = t.status === 'completed' ? 'todo' : 'completed';
        return { ...t, status: nextStatus };
      }
      return t;
    });
    onUpdateTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    onUpdateTasks(tasks.filter((t) => t.id !== taskId));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    // Calculate offset days relative to event date
    const evTime = new Date(eventDate).getTime();
    const taskTime = new Date(newTask.dueDate || eventDate).getTime();
    const offsetDays = Math.round((taskTime - evTime) / (1000 * 60 * 60 * 24));

    const task: Task = {
      id: `task-${Date.now()}`,
      title: newTask.title,
      category: newTask.category,
      dueDate: newTask.dueDate || eventDate,
      dueOffsetDays: offsetDays,
      priority: newTask.priority,
      status: 'todo',
      owner: newTask.owner || 'Organizer',
      prerequisiteTaskIds: newTask.prerequisiteTaskId ? [newTask.prerequisiteTaskId] : [],
      notes: newTask.notes,
      aiGenerated: false,
    };

    onUpdateTasks([...tasks, task]);
    setIsAddModalOpen(false);
    setNewTask({
      title: '',
      category: 'General',
      dueDate: '',
      priority: 'medium',
      owner: 'Organizer',
      prerequisiteTaskId: '',
      notes: '',
    });
  };

  // Sort tasks chronologically by dueDate
  const sortedTasks = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const filteredTasks = sortedTasks.filter((t) => {
    if (filterStatus === 'pending') return t.status !== 'completed';
    if (filterStatus === 'completed') return t.status === 'completed';
    return true;
  });

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header and Progress Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-lg text-slate-900">Chronological Checklist & Milestones</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {completedCount} / {tasks.length} Completed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deadlines dynamically tied to event date. Dates recalculate automatically via Ripple Engine.
          </p>

          <div className="w-full sm:w-72 bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pending ({tasks.length - completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Done ({completedCount})
            </button>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm py-2 px-3 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold">No tasks match your selected filter.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isOverdue = task.status !== 'completed' && task.dueDate < today;

            // Check if any prerequisite tasks are incomplete
            const uncompletedPrereqs = task.prerequisiteTaskIds
              .map((id) => tasks.find((t) => t.id === id))
              .filter((p) => p && p.status !== 'completed');
            const hasUnresolvedPrereq = uncompletedPrereqs.length > 0;

            return (
              <div
                key={task.id}
                className={`p-4 sm:p-5 flex items-start gap-4 hover:bg-slate-50/70 transition-colors ${
                  task.status === 'completed' ? 'bg-slate-50/40 opacity-75' : ''
                }`}
              >
                {/* Completion Checkbox */}
                <button
                  onClick={() => handleToggleTask(task.id)}
                  className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Circle className="w-6 h-6 hover:stroke-indigo-600" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-bold text-sm sm:text-base ${
                        task.status === 'completed'
                          ? 'line-through text-slate-400'
                          : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </span>

                    {/* Category Tag */}
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {task.category}
                    </span>

                    {/* Priority Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        task.priority === 'high'
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : task.priority === 'medium'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.priority.toUpperCase()}
                    </span>

                    {/* AI Generated Badge */}
                    {task.aiGenerated && (
                      <span className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> AI Milestone
                      </span>
                    )}

                    {/* Overdue Warning Flag */}
                    {isOverdue && (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-rose-300 inline-flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> OVERDUE
                      </span>
                    )}
                  </div>

                  {task.notes && (
                    <p className="text-xs text-slate-500 mt-1">{task.notes}</p>
                  )}

                  {/* Prerequisite Conflict Warning */}
                  {hasUnresolvedPrereq && (
                    <div className="text-[11px] text-amber-800 font-semibold bg-amber-50 border border-amber-200 rounded-md p-1.5 mt-2 inline-flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Prerequisite pending: &quot;{uncompletedPrereqs[0]?.title}&quot; must be resolved first.
                    </div>
                  )}

                  {/* Footer Meta */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                    <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Due: {task.dueDate}
                      {task.dueOffsetDays !== undefined && (
                        <span className="text-[10px] text-slate-400">
                          ({task.dueOffsetDays < 0 ? `${Math.abs(task.dueOffsetDays)} days before` : 'Day of event'})
                        </span>
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Owner: <span className="font-semibold text-slate-700">{task.owner}</span>
                    </span>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg transition-colors"
                  title="Delete Task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-lg text-slate-900 mb-4">Add Event Milestone</h3>
            <form onSubmit={handleAddTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Confirm Sound License & DJ Tracklist"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="Venue, Catering, Music"
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({ ...newTask, priority: e.target.value as TaskPriority })
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Owner / Assignee
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aarav, Meera"
                    value={newTask.owner}
                    onChange={(e) => setNewTask({ ...newTask, owner: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Prerequisite Task (Optional)
                </label>
                <select
                  value={newTask.prerequisiteTaskId}
                  onChange={(e) =>
                    setNewTask({ ...newTask, prerequisiteTaskId: e.target.value })
                  }
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="">None (Standalone Task)</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Key instructions or contacts"
                  value={newTask.notes}
                  onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-xs"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
