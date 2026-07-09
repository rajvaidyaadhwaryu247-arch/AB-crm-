import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { Task } from '../types';
import { formatDate } from '../utils';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  User, 
  ClipboardList, 
  X, 
  FileText, 
  Filter, 
  CheckSquare, 
  TrendingUp,
  RotateCw,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TASK_TYPES = ['Shoot', 'Editing', 'Poster', 'Ads', 'Website', 'Printing'] as const;
const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;

export const TaskManagement: React.FC = () => {
  const { tasks, clients, addTask, updateTask, deleteTask, sendTelegramNotification } = useCRM();

  // Search and Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clientFilter, setClientFilter] = useState<string>('All');

  const [isTaskTelegramSending, setIsTaskTelegramSending] = useState<Record<string, boolean>>({});

  const handleSendTaskTelegram = async (task: Task) => {
    setIsTaskTelegramSending(prev => ({ ...prev, [task.id]: true }));
    try {
      const matchedClient = clients.find(c => c.id === task.clientId);
      const businessName = matchedClient ? matchedClient.businessName : 'N/A';

      await sendTelegramNotification("", "followup_created", {
        ...task,
        businessName,
        address: matchedClient?.address,
        notes: matchedClient?.notes
      });
      alert(`Success: Telegram notification sent for task!`);
    } catch (err: any) {
      console.error("Failed to send Telegram task:", err);
      alert(`Error sending Telegram task: ${err.message || err}`);
    } finally {
      setIsTaskTelegramSending(prev => ({ ...prev, [task.id]: false }));
    }
  };

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Form Fields State
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<Task['type']>('Editing');
  const [status, setStatus] = useState<Task['status']>('Pending');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [notes, setNotes] = useState('');

  // Handle opening modal for Add
  const openAddModal = () => {
    setEditingTask(null);
    setTitle('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setType('Editing');
    setStatus('Pending');
    setSelectedClientId('');
    setNotes('');
    setIsFormOpen(true);
  };

  // Handle opening modal for Edit
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDueDate(task.dueDate);
    setType(task.type || 'Editing');
    setStatus(task.status || (task.completed ? 'Completed' : 'Pending'));
    setSelectedClientId(task.clientId || '');
    setNotes(task.notes || '');
    setIsFormOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    try {
      const matchedClient = clients.find(c => c.id === selectedClientId);
      const clientName = matchedClient ? matchedClient.name : undefined;

      if (editingTask) {
        await updateTask(editingTask.id, {
          title,
          dueDate,
          type,
          status,
          clientId: selectedClientId || undefined,
          clientName: clientName || undefined,
          notes: notes || undefined
        });
      } else {
        await addTask(
          title,
          dueDate,
          type,
          status,
          selectedClientId || undefined,
          clientName || undefined,
          notes || undefined
        );
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save task: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Handle quick status transition
  const handleQuickStatusChange = async (task: Task, nextStatus: Task['status']) => {
    try {
      await updateTask(task.id, { status: nextStatus });
    } catch (err) {
      console.error(err);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
      showToast("✅ Deleted successfully.", "success");
    } catch (err: any) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      let readableMsg = errMsg;
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed && parsed.error) {
          readableMsg = parsed.error;
        }
      } catch (pErr) {
        // Not JSON
      }
      showToast(`❌ Failed to delete: ${readableMsg}`, "error");
    }
  };

  // Filter Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (task.notes && task.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = typeFilter === 'All' || task.type === typeFilter;
      const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
      const matchesClient = clientFilter === 'All' || task.clientId === clientFilter;

      return matchesSearch && matchesType && matchesStatus && matchesClient;
    });
  }, [tasks, searchTerm, typeFilter, statusFilter, clientFilter]);

  // Calculate high-level metrics (memoized)
  const { totalTasksCount, pendingCount, inProgressCount, completedCount } = useMemo(() => {
    return {
      totalTasksCount: tasks.length,
      pendingCount: tasks.filter(t => t.status === 'Pending').length,
      inProgressCount: tasks.filter(t => t.status === 'In Progress').length,
      completedCount: tasks.filter(t => t.status === 'Completed').length
    };
  }, [tasks]);

  const getStatusColor = (s: Task['status']) => {
    switch (s) {
      case 'Completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'In Progress': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getTypeBadgeColor = (t: Task['type']) => {
    switch (t) {
      case 'Shoot': return 'bg-purple-500/10 text-purple-400 border-purple-500/10';
      case 'Editing': return 'bg-sky-500/10 text-sky-400 border-sky-500/10';
      case 'Poster': return 'bg-pink-500/10 text-pink-400 border-pink-500/10';
      case 'Ads': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10';
      case 'Website': return 'bg-teal-500/10 text-teal-400 border-teal-500/10';
      case 'Printing': return 'bg-rose-500/10 text-rose-400 border-rose-500/10';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/10';
    }
  };

  return (
    <div className="space-y-6 font-sans text-white">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaign Task Center</h2>
          <p className="text-sm text-gray-500 mt-1">Track graphics, shooting, and ad operations in real-time.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer text-sm transition-all duration-200"
        >
          <Plus className="h-5 w-5" /> Add New Task
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Active Tasks', count: totalTasksCount, icon: ClipboardList, color: 'border-slate-800' },
          { label: 'Pending Queue', count: pendingCount, icon: AlertCircle, color: 'border-rose-900/10 text-rose-400 bg-rose-500/5' },
          { label: 'In Progress', count: inProgressCount, icon: RotateCw, color: 'border-amber-900/10 text-amber-400 bg-amber-500/5' },
          { label: 'Completed Jobs', count: completedCount, icon: CheckSquare, color: 'border-emerald-900/10 text-emerald-400 bg-emerald-500/5' }
        ].map((item, i) => (
          <div key={i} className={`bg-[#141414] border ${item.color} rounded-2xl p-4 flex items-center justify-between`}>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{item.label}</p>
              <h4 className="text-2xl font-bold mt-1">{item.count}</h4>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#0d0d0d] flex items-center justify-center border border-emerald-900/5">
              <item.icon className="h-5 w-5 shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Filters & Search */}
      <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search task title, brief description or notes..."
              className="w-full pl-11 pr-4 py-3 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-sm"
            />
          </div>
          
          {/* Filters dropdowns */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="All">All Statuses</option>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="All">All Types</option>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 max-w-[150px] truncate"
              >
                <option value="All">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Task Cards Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-12 text-center text-gray-400 space-y-4">
          <ClipboardList className="h-12 w-12 mx-auto text-emerald-900/30" />
          <div>
            <h3 className="text-lg font-bold text-white">No tasks match your filters</h3>
            <p className="text-sm mt-1">Get started by creating a new job or clear your current filters.</p>
          </div>
          <button
            onClick={() => { setSearchTerm(''); setTypeFilter('All'); setStatusFilter('All'); setClientFilter('All'); }}
            className="px-4 py-2 bg-[#0d0d0d] border border-emerald-900/20 hover:border-emerald-500/20 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={task.id}
                className="bg-[#141414] border border-emerald-900/10 hover:border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group"
              >
                <div>
                  {/* Card Header Info */}
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-900/10 pb-3 mb-3">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getTypeBadgeColor(task.type)}`}>
                      {task.type}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500/50" />
                      <span className="font-mono text-[11px]">{formatDate(task.dueDate)}</span>
                    </div>
                  </div>

                  {/* Task Content */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-white text-base leading-tight group-hover:text-emerald-400 transition-colors">
                      {task.title}
                    </h3>
                    
                    {task.clientName && (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-2 py-1 self-start inline-flex">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="font-medium truncate max-w-[150px]">{task.clientName}</span>
                      </div>
                    )}

                    {task.notes && (
                      <p className="text-xs text-gray-400 bg-[#0d0d0d] rounded-lg p-2.5 border border-emerald-900/5 leading-relaxed italic text-ellipsis overflow-hidden line-clamp-3">
                        {task.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-emerald-900/10">
                  {/* Status Dropdown/Selector */}
                  <div className="relative">
                    <select
                      value={task.status}
                      onChange={(e) => handleQuickStatusChange(task, e.target.value as Task['status'])}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer transition-all ${getStatusColor(task.status)}`}
                    >
                      {TASK_STATUSES.map(s => (
                        <option key={s} value={s} className="bg-[#141414] text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Edit/Delete Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      id={`push-task-${task.id}`}
                      disabled={isTaskTelegramSending[task.id]}
                      onClick={() => handleSendTaskTelegram(task)}
                      className="p-2 bg-[#0d0d0d] hover:bg-emerald-500/10 border border-emerald-900/10 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors cursor-pointer"
                      title="Push to Telegram"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(task)}
                      className="p-2 bg-[#0d0d0d] hover:bg-[#1c1c1c] border border-emerald-900/10 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Edit Task"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-2 bg-[#0d0d0d] hover:bg-red-500/10 border border-emerald-900/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ADD/EDIT TASK MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/10 bg-[#0d0d0d]">
              <h3 className="text-lg font-bold text-white">
                {editingTask ? 'Modify Operational Task' : 'Schedule New Job/Task'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Task Title / Activity Summary *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Reel shoot at corporate outlet"
                  className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-sm"
                />
              </div>

              {/* Task Type and Status Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Operational Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Task['type'])}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-sm text-white focus:outline-none"
                  >
                    {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Current Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Task['status'])}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-sm text-white focus:outline-none"
                  >
                    {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Due Date & Associated Client */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Link Client</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-sm text-white focus:outline-none"
                  >
                    <option value="">None / Internal Job</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Detailed notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Operational Notes / Brief Instructions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Provide precise briefs, shoot venues, dimensions, layout guidelines, or link instructions..."
                  className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-xs leading-relaxed"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-emerald-900/10 mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-900 border border-emerald-900/10 rounded-xl text-gray-400 hover:text-white font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  {editingTask ? 'Save Changes' : 'Schedule Task'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
        }`}>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

    </div>
  );
};
