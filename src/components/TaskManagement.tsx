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
import { AdhwaryuOperationsControl } from './AdhwaryuOperationsControl';
import { PariAssistantControl } from './PariAssistantControl';


const TASK_TYPES = ['Shoot', 'Editing', 'Poster', 'Ads', 'Website', 'Printing'] as const;
const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'] as const;

export const TaskManagement: React.FC = () => {
  const { tasks, clients, addTask, updateTask, deleteTask, sendTelegramNotification, sendTodayWorkSummary } = useCRM();

  // Workspace Member Filter State
  const [selectedWorkspace, setSelectedWorkspace] = useState<'All' | 'Bhargav' | 'Adhwaryu' | 'Pari'>('All');

  // Daily Work View Sub-tabs state
  const [activeWorkTab, setActiveWorkTab] = useState<'today' | 'upcoming' | 'overdue' | 'completed'>('today');

  // Search and Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clientFilter, setClientFilter] = useState<string>('All');

  const [isTaskTelegramSending, setIsTaskTelegramSending] = useState<Record<string, boolean>>({});
  const [isSendingSummary, setIsSendingSummary] = useState(false);

  const handleSendDailySummary = async () => {
    if (!sendTodayWorkSummary) return;
    setIsSendingSummary(true);
    try {
      await sendTodayWorkSummary();
      showToast("📅 Dispatched Today's Agency Workplan to Telegram!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Failed to send: ${err.message || err}`, "error");
    } finally {
      setIsSendingSummary(false);
    }
  };

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
      showToast("✈️ Task forwarded to Telegram!", "success");
    } catch (err: any) {
      console.error("Failed to send Telegram task:", err);
      showToast(`❌ Failed to send task: ${err.message || err}`, "error");
    } finally {
      setIsTaskTelegramSending(prev => ({ ...prev, [task.id]: false }));
    }
  };

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
  const [assignedTo, setAssignedTo] = useState<Task['assignedTo'] | '' | 'auto'>('auto');

  // Handle opening modal for Add
  const openAddModal = () => {
    setEditingTask(null);
    setTitle('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setType('Editing');
    setStatus('Pending');
    setSelectedClientId('');
    setNotes('');
    setAssignedTo('auto');
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
    setAssignedTo(task.assignedTo || 'unassigned_explicit');
    setIsFormOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate || isSaving) return;

    setIsSaving(true);
    try {
      const matchedClient = clients.find(c => c.id === selectedClientId);
      const clientName = matchedClient ? matchedClient.name : undefined;

      const resolvedAssignee = assignedTo === 'auto'
        ? 'auto'
        : (assignedTo === 'unassigned_explicit' || !assignedTo ? null : (assignedTo as Task['assignedTo']));

      if (editingTask) {
        await updateTask(editingTask.id, {
          title,
          dueDate,
          type,
          status,
          clientId: selectedClientId || undefined,
          clientName: clientName || undefined,
          notes: notes || undefined,
          assignedTo: resolvedAssignee as any
        });
        showToast("✅ Task updated successfully.", "success");
      } else {
        await addTask(
          title,
          dueDate,
          type,
          status,
          selectedClientId || undefined,
          clientName || undefined,
          notes || undefined,
          undefined, // leadId
          undefined, // leadName
          resolvedAssignee as any
        );
        showToast("✅ Task scheduled successfully.", "success");
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save task: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  // Handle quick status transition
  const handleQuickStatusChange = async (task: Task, nextStatus: Task['status']) => {
    try {
      await updateTask(task.id, { status: nextStatus });
      showToast(`Status updated to ${nextStatus}!`, "success");
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

  // Filter Logic: Search, Type, Status, Client, and Workspace Member
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (task.notes && task.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = typeFilter === 'All' || task.type === typeFilter;
      const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
      const matchesClient = clientFilter === 'All' || task.clientId === clientFilter;
      const matchesWorkspace = selectedWorkspace === 'All' || task.assignedTo === selectedWorkspace;

      return matchesSearch && matchesType && matchesStatus && matchesClient && matchesWorkspace;
    });
  }, [tasks, searchTerm, typeFilter, statusFilter, clientFilter, selectedWorkspace]);

  // Today Date string YYYY-MM-DD
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Compute tasks segmented into sub-tabs (Today, Upcoming, Overdue, Completed History)
  const { todaysWork, upcomingTasks, overdueTasks, completedHistory } = useMemo(() => {
    const today = todayStr;
    const todayTasks: Task[] = [];
    const upcoming: Task[] = [];
    const overdue: Task[] = [];
    const completed: Task[] = [];

    filteredTasks.forEach(task => {
      if (task.status === 'Completed' || task.completed) {
        completed.push(task);
      } else if (task.dueDate < today) {
        overdue.push(task);
      } else if (task.dueDate === today) {
        todayTasks.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return {
      todaysWork: todayTasks,
      upcomingTasks: upcoming,
      overdueTasks: overdue,
      completedHistory: completed
    };
  }, [filteredTasks, todayStr]);

  // Filtered list of tasks to show in the active sub-tab
  const activeTabTasks = useMemo(() => {
    switch (activeWorkTab) {
      case 'today': return todaysWork;
      case 'upcoming': return upcomingTasks;
      case 'overdue': return overdueTasks;
      case 'completed': return completedHistory;
      default: return todaysWork;
    }
  }, [activeWorkTab, todaysWork, upcomingTasks, overdueTasks, completedHistory]);

  // Calculate high-level metrics for workspace member (memoized)
  const { totalTasksCount, pendingCount, inProgressCount, completedCount } = useMemo(() => {
    return {
      totalTasksCount: filteredTasks.length,
      pendingCount: filteredTasks.filter(t => t.status === 'Pending').length,
      inProgressCount: filteredTasks.filter(t => t.status === 'In Progress').length,
      completedCount: filteredTasks.filter(t => t.status === 'Completed' || t.completed).length
    };
  }, [filteredTasks]);

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141414] border border-emerald-900/10 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-emerald-400" />
            <h2 className="text-2xl font-bold tracking-tight">Team Workspace</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Centralized agency workspace. Assign deliverables, track operation schedules, and check daily checklists.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleSendDailySummary}
            disabled={isSendingSummary}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 font-bold rounded-xl text-xs cursor-pointer transition-all duration-200"
          >
            <Send className={`h-4 w-4 ${isSendingSummary ? 'animate-pulse' : ''}`} />
            {isSendingSummary ? "Sending..." : "Send Today's Plan to Telegram"}
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer text-xs transition-all duration-200 animate-fade-in"
          >
            <Plus className="h-4.5 w-4.5" /> Schedule New Task
          </button>
        </div>
      </div>

      {/* Grid of Workspace Filters and Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Workspace Filters Column (Bhargav, Adhwaryu, Pari) */}
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4">
          <div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">👥 Workspace Filters</span>
            <p className="text-[10px] text-gray-600">Click to filter tasks by operational role workspace.</p>
          </div>

          <div className="space-y-3">
            {/* Top All Team small button */}
            <button
              onClick={() => setSelectedWorkspace('All')}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer ${
                selectedWorkspace === 'All'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-bold shadow-lg shadow-emerald-500/10'
                  : 'bg-[#0d0d0d] border-emerald-900/10 hover:border-emerald-500/20 text-gray-400 hover:text-white'
              }`}
            >
              👥 All Team Workspace
            </button>

            {/* Below members list */}
            <div className="space-y-2 border-t border-emerald-900/5 pt-3">
              {[
                { name: 'Bhargav', emoji: '🎨', role: 'Creative & Reel Editing' },
                { name: 'Adhwaryu', emoji: '👤', role: 'Client Handling & Ads' },
                { name: 'Pari', emoji: '👑', role: 'Agency Records & Planner' }
              ].map(member => (
                <button
                  key={member.name}
                  onClick={() => setSelectedWorkspace(member.name as any)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    selectedWorkspace === member.name
                      ? 'bg-[#181d1a] border-emerald-500/40 text-emerald-400'
                      : 'bg-[#0d0d0d] border-slate-850 hover:border-slate-800 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base shrink-0">{member.emoji}</span>
                    <div>
                      <h4 className="text-xs font-bold">{member.name}</h4>
                      <p className="text-[9px] text-gray-500 mt-0.5">{member.role}</p>
                    </div>
                  </div>
                  {selectedWorkspace === member.name && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 block shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Workspace Quick Metrics Counters */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active in View', count: totalTasksCount, icon: ClipboardList, color: 'border-slate-850 bg-[#141414]/40' },
            { label: 'Pending Queue', count: pendingCount, icon: AlertCircle, color: 'border-rose-950/20 text-rose-400 bg-rose-500/5' },
            { label: 'In Progress', count: inProgressCount, icon: RotateCw, color: 'border-amber-950/20 text-amber-400 bg-amber-500/5' },
            { label: 'Completed Jobs', count: completedCount, icon: CheckSquare, color: 'border-emerald-950/20 text-emerald-400 bg-emerald-500/5' }
          ].map((item, i) => (
            <div key={i} className={`bg-[#141414] border ${item.color} rounded-2xl p-4 flex flex-col justify-between h-28`}>
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{item.label}</p>
                <div className="h-7 w-7 rounded-lg bg-[#0d0d0d] flex items-center justify-center border border-slate-850 shrink-0">
                  <item.icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <h4 className="text-2xl font-black mt-2">{item.count}</h4>
            </div>
          ))}
        </div>

      </div>

      {selectedWorkspace === 'Adhwaryu' ? (
        <AdhwaryuOperationsControl />
      ) : selectedWorkspace === 'Pari' ? (
        <PariAssistantControl />
      ) : (
        <>
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
                  placeholder="Search active workspace tasks..."
                  className="w-full pl-11 pr-4 py-3 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-sm"
                />
              </div>
              
              {/* Filters dropdowns */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
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
                <button
                  onClick={() => { setSearchTerm(''); setTypeFilter('All'); setClientFilter('All'); setSelectedWorkspace('All'); }}
                  className="hidden md:block px-4 py-3 bg-[#0d0d0d] border border-emerald-900/20 hover:border-emerald-500/30 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Daily Work Sub-tabs Navigation */}
          <div className="flex border-b border-emerald-900/10 pt-2 gap-1 overflow-x-auto">
            {[
              { id: 'today', label: "📅 Today's Work", count: todaysWork.length, activeColor: 'border-emerald-500 text-emerald-400 bg-emerald-500/5' },
              { id: 'upcoming', label: '🔮 Upcoming', count: upcomingTasks.length, activeColor: 'border-blue-500 text-blue-400 bg-blue-500/5' },
              { id: 'overdue', label: '⚠️ Overdue Check', count: overdueTasks.length, activeColor: 'border-rose-500 text-rose-400 bg-rose-500/5' },
              { id: 'completed', label: '✅ Completed History', count: completedHistory.length, activeColor: 'border-emerald-500 text-emerald-400 bg-emerald-500/5' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveWorkTab(tab.id as any)}
                className={`px-4 py-3 border-b-2 text-xs font-bold cursor-pointer transition-all duration-200 shrink-0 flex items-center gap-2 ${
                  activeWorkTab === tab.id
                    ? tab.activeColor
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeWorkTab === tab.id ? 'bg-white/10' : 'bg-[#141414]'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Task Cards Grid for Active Tab */}
          {activeTabTasks.length === 0 ? (
            <div className="bg-[#141414] border border-slate-850 rounded-2xl p-12 text-center text-gray-400 space-y-3">
              <ClipboardList className="h-10 w-10 mx-auto text-emerald-900/20" />
              <div>
                <h3 className="text-base font-bold text-white">No tasks in this list</h3>
                <p className="text-xs text-gray-500 mt-1">
                  There are no {activeWorkTab} deliverables listed for the selected filters.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {activeTabTasks.map((task) => {
                  const matchedClient = clients.find(c => c.id === task.clientId);
                  const isOverdue = task.dueDate < todayStr && task.status !== 'Completed';

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={task.id}
                      className={`bg-[#141414] border hover:border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 group ${
                        isOverdue ? 'border-rose-950/40 bg-rose-950/5' : 'border-emerald-900/10'
                      }`}
                    >
                      <div>
                        {/* Card Header Info */}
                        <div className="flex items-center justify-between gap-2 border-b border-emerald-900/5 pb-3 mb-3">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getTypeBadgeColor(task.type)}`}>
                            {task.type}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar className="h-3.5 w-3.5 text-emerald-500/50" />
                            <span className={`font-mono text-[11px] ${isOverdue ? 'text-rose-400 font-bold' : ''}`}>
                              {formatDate(task.dueDate)} {isOverdue ? '(Overdue)' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Task Content */}
                        <div className="space-y-2.5">
                          <h3 className="font-bold text-white text-base leading-tight group-hover:text-emerald-400 transition-colors">
                            {task.title}
                          </h3>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {task.clientName && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-2 py-0.5 self-start">
                                <User className="h-3 w-3 shrink-0" />
                                <span className="font-medium truncate max-w-[130px]">{task.clientName}</span>
                              </div>
                            )}

                            {/* Beautiful Assignee Badge */}
                            <div className={`flex items-center gap-1 text-[10px] rounded-lg px-2 py-0.5 self-start border ${
                              task.assignedTo 
                                ? 'bg-[#181d1a] text-emerald-400 border-emerald-500/10' 
                                : 'bg-rose-950/10 text-rose-400 border-rose-500/10'
                            }`}>
                              <span className="shrink-0">{task.assignedTo === 'Bhargav' ? '🎨' : task.assignedTo === 'Adhwaryu' ? '👤' : task.assignedTo === 'Pari' ? '👑' : '⚠️'}</span>
                              <span className="font-medium truncate">{task.assignedTo ? `Assigned: ${task.assignedTo}` : 'Unassigned'}</span>
                            </div>
                          </div>

                          {task.notes && (
                            <p className="text-xs text-gray-400 bg-[#0d0d0d] rounded-lg p-2.5 border border-slate-850 leading-relaxed italic text-ellipsis overflow-hidden line-clamp-3">
                              {task.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-emerald-900/5">
                        {/* Status Dropdown/Selector */}
                        <div className="relative">
                          <select
                            value={task.status}
                            onChange={(e) => handleQuickStatusChange(task, e.target.value as Task['status'])}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer transition-all ${getStatusColor(task.status)}`}
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
                            className="p-2 bg-[#0d0d0d] hover:bg-emerald-500/10 border border-slate-850 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors cursor-pointer"
                            title="Push to Telegram"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(task)}
                            className="p-2 bg-[#0d0d0d] hover:bg-[#1c1c1c] border border-slate-850 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Edit Task"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="p-2 bg-[#0d0d0d] hover:bg-red-500/10 border border-slate-850 text-gray-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* ADD/EDIT TASK MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-850 bg-[#0d0d0d]">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {editingTask ? 'Modify Operational Deliverable' : 'Schedule Workspace Deliverable'}
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
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Task Title / Activity Summary *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Shoot Dental Care reels at corporate outlet"
                  className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-sm"
                />
              </div>

              {/* Task Type and Status Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Operational Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Task['type'])}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-sm text-white focus:outline-none"
                  >
                    {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Task['status'])}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-sm text-white focus:outline-none"
                  >
                    {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Due Date & Associated Client */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-850 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Link Client</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-sm text-white focus:outline-none"
                  >
                    <option value="">None / Internal Job</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Assign To Team Member Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assign Workspace Member (Manual)</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-sm text-white focus:outline-none"
                >
                  <option value="auto">✨ Smart Auto-Assign (Based on Role Rules)</option>
                  <option value="unassigned_explicit">Unassigned (Keep Unassigned / Manual)</option>
                  <option value="Bhargav">🎨 Bhargav (Reel Editing, Graphic Design, Posters, Website, Ads)</option>
                  <option value="Adhwaryu">👤 Adhwaryu (Client Handling, Meetings, CRM, Payments, Scheduling)</option>
                  <option value="Pari">👑 Pari (Agency Records, Reports, Content Planner, Data Work)</option>
                </select>
              </div>

              {/* Detailed notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Operational Notes / Brief Instructions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Provide precise briefs, shoot venues, dimensions, layout guidelines, or link instructions..."
                  className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-xs leading-relaxed"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850 mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-slate-900 border border-slate-850 rounded-xl text-gray-400 hover:text-white font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Scheduling...' : (editingTask ? 'Save Changes' : 'Schedule Deliverable')}
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
