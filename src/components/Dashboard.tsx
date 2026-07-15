import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { formatCurrency, formatDate } from '../utils';
import { 
  Users, 
  UserCheck, 
  UserX, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle, 
  Plus, 
  Trash2, 
  CheckCircle,
  FileText,
  UserPlus,
  RefreshCw,
  Send
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'motion/react';

export const Dashboard: React.FC = () => {
  const { clients, leads, tasks, activities, stats, addTask, toggleTask, deleteTask, sendTodayWorkSummary } = useCRM();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSendingSummary, setIsSendingSummary] = useState(false);

  const handleSendDailySummary = async () => {
    if (!sendTodayWorkSummary) return;
    setIsSendingSummary(true);
    try {
      await sendTodayWorkSummary();
      alert("📅 Today's Agency Workplan compiled and successfully dispatched to Telegram!");
    } catch (err: any) {
      console.error(err);
      alert(`❌ Failed to send summary: ${err.message || err}`);
    } finally {
      setIsSendingSummary(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await addTask(newTaskTitle.trim(), taskDueDate);
      setNewTaskTitle('');
    } catch (err) {
      console.error(err);
    }
  };

  // Prepare dynamic revenue chart data based on actual client records in Firestore
  const getRevenueChartData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    // Group client revenue by start month
    const monthlyAcc: { [key: string]: { revenue: number; clients: number } } = {};
    
    // Initialize last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mLabel = `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyAcc[mKey] = { revenue: 0, clients: 0, label: mLabel } as any;
    }

    clients.forEach(c => {
      if (c.startDate) {
        const cKey = c.startDate.substring(0, 7); // YYYY-MM
        if (monthlyAcc[cKey]) {
          monthlyAcc[cKey].revenue += (c.revenue || 0);
          monthlyAcc[cKey].clients += 1;
        }
      }
    });

    return Object.keys(monthlyAcc).map(key => ({
      name: (monthlyAcc[key] as any).label,
      Revenue: monthlyAcc[key].revenue,
      Clients: monthlyAcc[key].clients
    }));
  };

  const chartData = useMemo(() => getRevenueChartData(), [clients]);

  // Filter tasks for today's checklist
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.dueDate === todayStr);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Real-time performance metrics for AB Graphics campaigns.</p>
        </div>
        <button
          onClick={handleSendDailySummary}
          disabled={isSendingSummary}
          className="self-start md:self-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/5"
        >
          <Send className={`h-3.5 w-3.5 ${isSendingSummary ? 'animate-pulse' : ''}`} />
          {isSendingSummary ? 'Dispatching Summary...' : "Send Today's Work Plan to Telegram"}
        </button>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Clients */}
        <motion.div 
          whileHover={{ scale: 1.01, y: -2 }}
          className="bg-[#141414] border border-emerald-900/10 p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300"
        >
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Clients</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-3xl font-bold text-white tracking-tight">{stats.totalClients}</span>
            <span className="text-emerald-500 text-xs font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              {stats.activeClients} Active
            </span>
          </div>
        </motion.div>

        {/* Total Revenue */}
        <motion.div 
          whileHover={{ scale: 1.01, y: -2 }}
          className="bg-[#141414] border border-emerald-900/10 p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300"
        >
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Revenue</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.totalRevenue)}</span>
            <span className="text-emerald-500 text-xs font-medium flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Growth
            </span>
          </div>
        </motion.div>

        {/* Monthly Revenue */}
        <motion.div 
          whileHover={{ scale: 1.01, y: -2 }}
          className="bg-[#141414] border border-emerald-900/10 p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/20 transition-all duration-300"
        >
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Monthly Revenue</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-3xl font-bold text-white tracking-tight">{formatCurrency(stats.monthlyRevenue)}</span>
            <span className="text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
              New Additions
            </span>
          </div>
        </motion.div>

        {/* Pending Payments */}
        <motion.div 
          whileHover={{ scale: 1.01, y: -2 }}
          className="bg-emerald-500 p-5 rounded-2xl flex flex-col justify-between text-black shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-all duration-300"
        >
          <span className="text-xs text-emerald-950 uppercase tracking-wider font-bold">Pending Payments</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-2xl font-black italic tracking-tight">{formatCurrency(stats.pendingPayments)}</span>
            <span className="text-emerald-950 text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Action
            </span>
          </div>
        </motion.div>

      </div>

      {/* Sub-Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-emerald-900/10 hover:border-emerald-500/10 p-4 rounded-2xl flex items-center gap-3.5 transition-all duration-300">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active Client Accounts</p>
            <p className="text-lg font-bold text-white mt-0.5">{stats.activeClients}</p>
          </div>
        </div>

        <div className="bg-[#141414] border border-emerald-900/10 hover:border-emerald-500/10 p-4 rounded-2xl flex items-center gap-3.5 transition-all duration-300">
          <div className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 flex items-center justify-center shrink-0">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Expired Campaigns</p>
            <p className="text-lg font-bold text-white mt-0.5">{stats.expiredClients}</p>
          </div>
        </div>

        <div className="bg-[#141414] border border-emerald-900/10 hover:border-emerald-500/10 p-4 rounded-2xl flex items-center gap-3.5 transition-all duration-300">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Today's Reminders</p>
            <p className="text-lg font-bold text-white mt-0.5">{stats.todayTasksCount} Pending</p>
          </div>
        </div>
      </div>

      {/* Interactive Graph Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Revenue Performance Chart */}
        <div className="lg:col-span-2 bg-[#111111] border border-emerald-900/20 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Revenue Performance</h3>
              <p className="text-xs text-gray-500 mt-1">Monthly campaign additions and paid revenues.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 bg-emerald-500/20 rounded-full text-emerald-400 font-medium">
                Revenue
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141414', borderColor: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#f3f4f6' }}
                  labelStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client Growth Chart */}
        <div className="bg-[#141414] border border-emerald-900/10 p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Client Portfolio</h3>
            <p className="text-xs text-gray-500 mt-1">Clients added per month.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141414', borderColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#f3f4f6' }}
                />
                <Bar dataKey="Clients" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Task List and Activities Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Interactive Today's Tasks Checklist */}
        <div className="bg-[#141414] border border-emerald-900/10 p-5 rounded-2xl flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Today's Tasks</h3>
              <p className="text-xs text-gray-500 mt-1">Manage checklist for action items today.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">
              {todayTasks.filter(t => !t.completed).length} Pending
            </span>
          </div>

          {/* Task Addition Form */}
          <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add checklist item..."
              className="flex-1 bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 text-sm transition-all duration-200 cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" /> Add
            </button>
          </form>

          {/* Checklist content */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {todayTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2 py-8">
                <CheckCircle className="h-10 w-10 text-gray-700" />
                <div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs">No tasks listed for today.</p>
                </div>
              </div>
            ) : (
              todayTasks.map((task) => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-[#0d0d0d] border border-emerald-900/5 rounded-xl hover:border-emerald-500/10 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id, !task.completed)}
                      className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        task.completed 
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950' 
                          : 'border-emerald-900/30 bg-[#090909] hover:border-emerald-500 text-transparent'
                      }`}
                    >
                      ✓
                    </button>
                    <span className={`text-sm ${task.completed ? 'line-through text-gray-500' : 'text-gray-200 font-medium'}`}>
                      {task.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-emerald-500/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit/Activity Feed */}
        <div className="bg-[#141414] border border-emerald-900/10 p-5 rounded-2xl flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Recent Activity</h3>
              <p className="text-xs text-gray-500 mt-1">Campaign events and sales workflow log.</p>
            </div>
            <button 
              type="button"
              onClick={() => window.location.reload()}
              className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10"
              title="Refresh Logs"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {activities.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2 py-8">
                <FileText className="h-10 w-10 text-gray-700" />
                <div>
                  <p className="text-sm font-medium">No activity log found</p>
                  <p className="text-xs">Campaign edits and updates will log here.</p>
                </div>
              </div>
            ) : (
              activities.slice(0, 8).map((act) => {
                let badgeColor = 'bg-[#0d0d0d] border-emerald-900/10 text-gray-400';
                let Icon = FileText;

                if (act.type.includes('added')) {
                  badgeColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                  Icon = UserPlus;
                } else if (act.type.includes('converted')) {
                  badgeColor = 'bg-green-500/10 border-green-500/20 text-emerald-300';
                  Icon = CheckCircle;
                } else if (act.type.includes('deleted')) {
                  badgeColor = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                  Icon = Trash2;
                }

                return (
                  <div key={act.id} className="flex gap-3 text-sm items-start">
                    <div className={`p-2 rounded-lg border ${badgeColor} shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 font-semibold leading-tight text-xs">{act.description}</p>
                      <span className="text-[10px] text-gray-500 block mt-1">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {formatDate(act.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
