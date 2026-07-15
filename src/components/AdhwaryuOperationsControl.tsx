import React, { useState, useMemo, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { Client, Lead, Task, FollowUp, DailyActivity, Payment } from '../types';
import { formatDate, formatCurrency, calculateExpiryDate } from '../utils';
import { 
  Phone, Video, Plus, Calendar, AlertCircle, FileText, CheckCircle2, 
  RotateCw, Trash2, Edit, MessageSquare, IndianRupee, Bell, Sparkles, 
  Send, CheckSquare, Clock, ArrowRight, UserPlus, Heart, Zap, Play, 
  Check, X, FileSpreadsheet, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AdhwaryuOperationsControl: React.FC = () => {
  const { 
    clients, leads, tasks, followUps, updateLead, convertLeadToClient, 
    updateClient, addTask, updateTask, sendTelegramNotification 
  } = useCRM();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, []);

  const [activeTab, setActiveTab] = useState<'attention' | 'calls' | 'meetings' | 'leads' | 'clients' | 'recovery' | 'planner' | 'upcoming' | 'overdue' | 'completed'>('attention');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [modalType, setModalType] = useState<'schedule' | 'convert' | 'payment' | 'planner_add' | 'invoice' | 'none'>('none');

  // Modal forms fields state
  const [scheduleDate, setScheduleDate] = useState(todayStr);
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleType, setScheduleType] = useState<'Call' | 'Meeting' | 'Follow-up'>('Call');

  // Convert Lead Form State
  const [cPkgType, setCPkgType] = useState<'Basic' | 'Advance' | 'Pro' | 'Custom' | 'Quick Service'>('Basic');
  const [cQuickServiceName, setCQuickServiceName] = useState('1 Reel');
  const [cPrice, setCPrice] = useState(10000);
  const [cDuration, setCDuration] = useState('1 Month');
  const [cServices, setCServices] = useState<string[]>(['Instagram Handling', 'Facebook Handling', 'Poster Design']);
  const [cPaid, setCPaid] = useState(5000);
  const [cPayMode, setCPayMode] = useState<'UPI' | 'Cash' | 'Bank Transfer'>('UPI');

  // Record Payment State
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState<'UPI' | 'Cash' | 'Bank Transfer'>('UPI');
  const [payType, setPayType] = useState<'Installment' | 'Advance' | 'Full Payment'>('Installment');
  const [payNotes, setPayNotes] = useState('');

  // Add Planner Activity State
  const [plaDate, setPlaDate] = useState(todayStr);
  const [plaType, setPlaType] = useState('Instagram Post');
  const [plaNotes, setPlaNotes] = useState('');

  // Helper to open modal
  const openModal = (type: typeof modalType, lead: Lead | null, client: Client | null) => {
    setActiveLead(lead);
    setActiveClient(client);
    setModalType(type);
    setScheduleDate(todayStr);
    setScheduleNotes('');
    setScheduleType('Call');
    
    if (lead) {
      setCPkgType('Basic');
      setCPrice(10000);
      setCDuration('1 Month');
      setCServices(['Instagram Handling', 'Facebook Handling', 'Poster Design']);
      setCPaid(5000);
      setCPayMode('UPI');
    }

    if (client) {
      setPayAmount(client.pendingAmount || 0);
      setPayNotes('');
      setPayType('Installment');
      setPlaDate(todayStr);
      setPlaType('Instagram Post');
      setPlaNotes('');
    }
  };

  const closeModal = () => {
    setModalType('none');
    setActiveLead(null);
    setActiveClient(null);
  };

  // Smart Operations & Attention Engine
  const needsAttentionList = useMemo(() => {
    const list: {
      id: string;
      category: 'Follow-up Overdue' | 'Payment Overdue' | 'Package Expiring' | 'Meeting Today' | 'Inactive Lead' | 'Inactive Client';
      title: string;
      description: string;
      lead?: Lead;
      client?: Client;
      followUp?: FollowUp;
      task?: Task;
      severity: 'high' | 'medium' | 'low';
    }[] = [];

    // 1. Follow-up Overdue (Leads)
    leads.forEach(lead => {
      if (lead.status !== 'Converted' && lead.status !== 'Lost' && lead.status !== 'Not Interested' && lead.followUpDate < todayStr) {
        list.push({
          id: `lead-fo-${lead.id}`,
          category: 'Follow-up Overdue',
          title: `Overdue Follow-up: ${lead.name}`,
          description: `Scheduled for ${formatDate(lead.followUpDate)}. Lead is in "${lead.status}" state.`,
          lead,
          severity: 'high'
        });
      }
    });

    // 2. Follow-up Overdue (Clients)
    followUps.forEach(fo => {
      if (fo.status === 'Pending' && fo.followUpDate < todayStr) {
        const client = clients.find(c => c.id === fo.clientId);
        list.push({
          id: `client-fo-${fo.id}`,
          category: 'Follow-up Overdue',
          title: `Client Follow-up Missed: ${fo.businessName}`,
          description: `${fo.followUpType} scheduled on ${formatDate(fo.followUpDate)} by Adhwaryu.`,
          client,
          followUp: fo,
          severity: 'high'
        });
      }
    });

    // 3. Payment Overdue (Pending Payment & campaign expired or close to it)
    clients.forEach(client => {
      if (client.status === 'Active' && client.paymentStatus === 'Pending' && client.pendingAmount > 0) {
        const isOverdue = client.expiryDate < todayStr;
        if (isOverdue) {
          list.push({
            id: `client-pay-${client.id}`,
            category: 'Payment Overdue',
            title: `Payment Overdue: ${client.businessName}`,
            description: `Pending balance: ${formatCurrency(client.pendingAmount)}. Campaign expired on ${formatDate(client.expiryDate)}.`,
            client,
            severity: 'high'
          });
        }
      }
    });

    // 4. Package Expiring (Within 7 days)
    clients.forEach(client => {
      if (client.status === 'Active') {
        const diffTime = new Date(client.expiryDate).getTime() - new Date(todayStr).getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 7) {
          list.push({
            id: `client-exp-${client.id}`,
            category: 'Package Expiring',
            title: `Package Expiring: ${client.businessName}`,
            description: `Campaign expires in ${diffDays} days (${formatDate(client.expiryDate)}).`,
            client,
            severity: 'medium'
          });
        }
      }
    });

    // 5. Meeting Today
    tasks.forEach(task => {
      if (task.assignedTo === 'Adhwaryu' && task.status !== 'Completed' && task.dueDate === todayStr) {
        if (task.title.toLowerCase().includes('meeting') || task.type === 'Shoot') {
          const client = clients.find(c => c.id === task.clientId);
          list.push({
            id: `task-meet-${task.id}`,
            category: 'Meeting Today',
            title: task.title,
            description: `Assigned operational checklist item for today.`,
            client,
            task,
            severity: 'high'
          });
        }
      }
    });

    followUps.forEach(fo => {
      if (fo.status === 'Pending' && fo.followUpDate === todayStr && fo.followUpType === 'Meeting') {
        const client = clients.find(c => c.id === fo.clientId);
        list.push({
          id: `fo-meet-${fo.id}`,
          category: 'Meeting Today',
          title: `Meeting with ${fo.clientName} (${fo.businessName})`,
          description: `Time: ${fo.followUpTime || 'N/A'}. Topic: ${fo.reason}`,
          client,
          followUp: fo,
          severity: 'high'
        });
      }
    });

    // 6. Inactive Lead (No update/action in 14 days)
    leads.forEach(lead => {
      if (lead.status !== 'Converted' && lead.status !== 'Lost' && lead.status !== 'Not Interested') {
        const lastActiveDate = lead.timeline && lead.timeline.length > 0
          ? lead.timeline[lead.timeline.length - 1].date
          : lead.createdAt.split('T')[0];
        const daysInactive = Math.floor((Date.parse(todayStr) - Date.parse(lastActiveDate)) / (1000 * 60 * 60 * 24));
        if (daysInactive >= 14) {
          list.push({
            id: `lead-inact-${lead.id}`,
            category: 'Inactive Lead',
            title: `Inactive Lead: ${lead.name}`,
            description: `No interactions or pipeline updates recorded in ${daysInactive} days.`,
            lead,
            severity: 'low'
          });
        }
      }
    });

    // 7. Inactive Client (No planner activity in last 14 days)
    clients.forEach(client => {
      if (client.status === 'Active') {
        let hasRecent = false;
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];

        if (client.contentPlanner && client.contentPlanner.days) {
          hasRecent = Object.keys(client.contentPlanner.days).some(dStr => {
            return dStr >= fourteenDaysAgoStr && (client.contentPlanner?.days[dStr]?.activities?.length || 0) > 0;
          });
        }

        if (!hasRecent) {
          list.push({
            id: `client-inact-${client.id}`,
            category: 'Inactive Client',
            title: `Inactive Client: ${client.businessName}`,
            description: `No creative post, reel, or story scheduled in content planner for the last 14 days.`,
            client,
            severity: 'low'
          });
        }
      }
    });

    return list;
  }, [leads, clients, followUps, tasks, todayStr]);

  // Organize other Work Sections
  const todayCalls = useMemo(() => {
    const list: { title: string; subtitle: string; lead?: Lead; client?: Client; followUp?: FollowUp; task?: Task }[] = [];
    
    // Lead followups today
    leads.forEach(l => {
      if (l.status !== 'Converted' && l.status !== 'Lost' && l.status !== 'Not Interested' && l.followUpDate === todayStr) {
        list.push({ title: `📞 Follow-up: ${l.name}`, subtitle: `Lead (${l.business}) - Status: ${l.status}`, lead: l });
      }
    });

    // Client followups of type Call today
    followUps.forEach(f => {
      if (f.status === 'Pending' && f.followUpDate === todayStr && f.followUpType === 'Call') {
        const client = clients.find(c => c.id === f.clientId);
        list.push({ title: `📞 Call Client: ${f.clientName}`, subtitle: `Business: ${f.businessName} - Reason: ${f.reason}`, client, followUp: f });
      }
    });

    // General tasks with call
    tasks.forEach(t => {
      if (t.assignedTo === 'Adhwaryu' && t.status !== 'Completed' && t.dueDate === todayStr && t.title.toLowerCase().includes('call')) {
        const client = clients.find(c => c.id === t.clientId);
        list.push({ title: `📞 ${t.title}`, subtitle: t.notes || 'Deliverable call task', client, task: t });
      }
    });

    return list;
  }, [leads, followUps, tasks, clients, todayStr]);

  const todayMeetings = useMemo(() => {
    const list: { title: string; time?: string; reason: string; lead?: Lead; client?: Client; followUp?: FollowUp; task?: Task }[] = [];
    
    // Client followup meetings today
    followUps.forEach(f => {
      if (f.status === 'Pending' && f.followUpDate === todayStr && f.followUpType === 'Meeting') {
        const client = clients.find(c => c.id === f.clientId);
        list.push({ title: `🤝 Meeting: ${f.clientName}`, time: f.followUpTime, reason: f.reason, client, followUp: f });
      }
    });

    // General tasks meeting today
    tasks.forEach(t => {
      if (t.assignedTo === 'Adhwaryu' && t.status !== 'Completed' && t.dueDate === todayStr && (t.title.toLowerCase().includes('meeting') || t.type === 'Shoot')) {
        const client = clients.find(c => c.id === t.clientId);
        list.push({ title: `🤝 ${t.title}`, reason: t.notes || 'Strategic briefing', client, task: t });
      }
    });

    // Leads scheduled for meetings today
    leads.forEach(l => {
      if (l.status === 'Meeting Scheduled' && l.followUpDate === todayStr) {
        list.push({ title: `🤝 Meet Lead: ${l.name}`, reason: l.notes || 'Initial agency presentation', lead: l });
      }
    });

    return list;
  }, [followUps, tasks, leads, clients, todayStr]);

  const todayLeads = useMemo(() => {
    return leads.filter(l => l.followUpDate === todayStr || l.createdAt.split('T')[0] === todayStr);
  }, [leads, todayStr]);

  const todayClientsList = useMemo(() => {
    // Clients who have active deliverables today or expiring today
    return clients.filter(c => {
      const hasTaskToday = tasks.some(t => t.clientId === c.id && t.dueDate === todayStr && t.assignedTo === 'Adhwaryu');
      const hasPlannerToday = c.contentPlanner?.days?.[todayStr]?.activities?.length;
      const isExpiringToday = c.expiryDate === todayStr;
      return c.status === 'Active' && (hasTaskToday || hasPlannerToday || isExpiringToday);
    });
  }, [clients, tasks, todayStr]);

  const paymentRecoveryList = useMemo(() => {
    return clients.filter(c => c.status === 'Active' && c.paymentStatus === 'Pending' && c.pendingAmount > 0);
  }, [clients]);

  // All Planner Activities assigned to Adhwaryu
  const adhwaryuPlannerActivities = useMemo(() => {
    const list: {
      client: Client;
      date: string;
      activity: DailyActivity;
      task?: Task;
    }[] = [];

    clients.forEach(c => {
      if (c.contentPlanner && c.contentPlanner.days) {
        Object.keys(c.contentPlanner.days).forEach(dateStr => {
          const dayPlan = c.contentPlanner!.days[dateStr];
          if (dayPlan && Array.isArray(dayPlan.activities)) {
            dayPlan.activities.forEach(act => {
              const matchedTask = tasks.find(t => t.clientId === c.id && t.plannerActivityId === act.id);
              if (matchedTask && matchedTask.assignedTo === 'Adhwaryu') {
                list.push({ client: c, date: dateStr, activity: act, task: matchedTask });
              } else if (!matchedTask) {
                // If task doesn't exist, check auto assign keywords fallback for Adhwaryu
                const actName = act.type === 'Custom Activity' ? (act.customTypeName || 'Custom Activity') : act.type;
                const text = `${actName} ${act.notes || ''}`.toLowerCase();
                const isAdhwaryu = text.includes('client') || text.includes('meeting') || text.includes('payment') || text.includes('follow-up') || text.includes('recovery');
                if (isAdhwaryu) {
                  list.push({ client: c, date: dateStr, activity: act });
                }
              }
            });
          }
        });
      }
    });

    // Sort by date (descending/ascending)
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [clients, tasks]);

  const todayContentPlanner = useMemo(() => {
    return adhwaryuPlannerActivities.filter(item => item.date === todayStr);
  }, [adhwaryuPlannerActivities, todayStr]);

  const upcomingWork = useMemo(() => {
    const taskList = tasks.filter(t => t.assignedTo === 'Adhwaryu' && t.status !== 'Completed' && t.dueDate > todayStr);
    const foList = followUps.filter(f => f.status === 'Pending' && f.followUpDate > todayStr);
    return { tasks: taskList, followUps: foList };
  }, [tasks, followUps, todayStr]);

  const overdueWork = useMemo(() => {
    const taskList = tasks.filter(t => t.assignedTo === 'Adhwaryu' && t.status !== 'Completed' && t.dueDate < todayStr);
    const foList = followUps.filter(f => f.status === 'Pending' && f.followUpDate < todayStr);
    return { tasks: taskList, followUps: foList };
  }, [tasks, followUps, todayStr]);

  const completedToday = useMemo(() => {
    const taskList = tasks.filter(t => t.assignedTo === 'Adhwaryu' && t.status === 'Completed' && t.dueDate === todayStr);
    const foList = followUps.filter(f => f.status === 'Completed' && f.followUpDate === todayStr);
    return { tasks: taskList, followUps: foList };
  }, [tasks, followUps, todayStr]);

  // SMART REMINDERS ENGINE
  const smartReminders = useMemo(() => {
    const alerts: { type: 'meeting' | 'call' | 'followup' | 'payment' | 'renewal' | 'missed' | 'overdue'; message: string; sub: string }[] = [];

    if (todayMeetings.length > 0) {
      alerts.push({ type: 'meeting', message: `🤝 You have ${todayMeetings.length} Meeting(s) Scheduled Today`, sub: 'Prepare client notes and package details before call' });
    }
    if (todayCalls.length > 0) {
      alerts.push({ type: 'call', message: `📞 You have ${todayCalls.length} Call(s) Slated Today`, sub: 'Follow up on leads and payment collections' });
    }
    
    const activeFollowupsToday = followUps.filter(f => f.status === 'Pending' && f.followUpDate === todayStr);
    if (activeFollowupsToday.length > 0) {
      alerts.push({ type: 'followup', message: `⏱️ ${activeFollowupsToday.length} Client Follow-up(s) Due`, sub: 'Keep CRM updated with latest notes' });
    }

    const outstandingPayments = clients.filter(c => c.status === 'Active' && c.paymentStatus === 'Pending' && c.pendingAmount > 0);
    if (outstandingPayments.length > 0) {
      const totalAmount = outstandingPayments.reduce((sum, c) => sum + c.pendingAmount, 0);
      alerts.push({ type: 'payment', message: `💰 ₹${totalAmount.toLocaleString('en-IN')} In Outstanding Payments`, sub: `Recovery needed for ${outstandingPayments.length} clients` });
    }

    const renewals = clients.filter(c => c.status === 'Active' && c.expiryDate >= todayStr && c.expiryDate <= calculateExpiryDate(todayStr, '1 Month'));
    const criticalRenewals = renewals.filter(c => {
      const diff = new Date(c.expiryDate).getTime() - new Date(todayStr).getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24)) <= 7;
    });
    if (criticalRenewals.length > 0) {
      alerts.push({ type: 'renewal', message: `⚠️ ${criticalRenewals.length} Campaigns Expiring in 7 Days`, sub: 'Reach out to pitch renewals' });
    }

    if (overdueWork.tasks.length > 0 || overdueWork.followUps.length > 0) {
      alerts.push({ type: 'overdue', message: `🔴 Overdue: ${overdueWork.tasks.length} Deliverable(s) & ${overdueWork.followUps.length} Follow-up(s)`, sub: 'Complete or reschedule immediately' });
    }

    return alerts;
  }, [todayMeetings, todayCalls, followUps, clients, overdueWork, todayStr]);


  // QUICK ACTIONS ACTIONS

  // 1. Call Action Handler
  const handleCallAction = async (target: Lead | Client, isLead: boolean) => {
    const logText = '📞 Call Initiated';
    if (isLead) {
      const lead = target as Lead;
      const logItem = {
        date: todayStr,
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        action: logText,
        user: 'Adhwaryu',
        notes: 'Outbound call placed from operations workspace'
      };
      await updateLead(lead.id, { 
        timeline: [...(lead.timeline || []), logItem],
        lastContactDate: todayStr
      });
    } else {
      const client = target as Client;
      await updateClient(client.id, {
        notes: `${client.notes}\n[${todayStr}] 📞 Call placed by Adhwaryu.`
      });
    }
    window.open(`tel:${target.mobile}`, '_self');
  };

  // 2. WhatsApp Action Handler
  const handleWhatsAppAction = async (target: Lead | Client, isLead: boolean) => {
    const mobile = isLead ? (target as Lead).mobile : (target as Client).whatsApp || target.mobile;
    const cleanMobile = mobile.replace(/\D/g, '');
    const mobileWithCountry = cleanMobile.startsWith('91') ? cleanMobile : '91' + cleanMobile;
    
    const message = `Hi ${target.name}, Adhwaryu here from AB Graphics. Hope you are having an amazing day! Just wanted to connect regarding our agency operations. Let me know when is a good time to chat!`;
    const encodedMessage = encodeURIComponent(message);
    
    const logText = '💬 WhatsApp Initiated';
    if (isLead) {
      const lead = target as Lead;
      const logItem = {
        date: todayStr,
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        action: logText,
        user: 'Adhwaryu',
        notes: 'WhatsApp thread opened'
      };
      await updateLead(lead.id, { 
        timeline: [...(lead.timeline || []), logItem],
        lastContactDate: todayStr
      });
    } else {
      const client = target as Client;
      await updateClient(client.id, {
        notes: `${client.notes}\n[${todayStr}] 💬 WhatsApp chat started by Adhwaryu.`
      });
    }

    window.open(`https://wa.me/${mobileWithCountry}?text=${encodedMessage}`, '_blank');
  };

  // 3. Complete Task/Followup Handler
  const handleCompleteAction = async (item: { task?: Task; followUp?: FollowUp; lead?: Lead }) => {
    if (item.task) {
      await updateTask(item.task.id, { status: 'Completed', completed: true });
    } else if (item.followUp) {
      // Just update client notes or followUp array if possible
      // Let's mark general tasks linked to followup as completed
      const linkedTask = tasks.find(t => t.clientId === item.followUp?.clientId && t.dueDate === item.followUp?.followUpDate);
      if (linkedTask) {
        await updateTask(linkedTask.id, { status: 'Completed', completed: true });
      }
    } else if (item.lead) {
      // Mark lead status as waiting decision or contacted
      await updateLead(item.lead.id, { status: 'Contacted' });
    }
  };

  // 4. Submit Schedule Meeting/Followup
  const handleSubmitSchedule = async () => {
    if (!activeLead && !activeClient) return;

    if (activeLead) {
      const logItem = {
        date: todayStr,
        time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        action: `📅 Follow-up Scheduled (${scheduleType})`,
        user: 'Adhwaryu',
        notes: scheduleNotes
      };
      await updateLead(activeLead.id, {
        status: scheduleType === 'Meeting' ? 'Meeting Scheduled' : 'Contacted',
        followUpDate: scheduleDate,
        timeline: [...(activeLead.timeline || []), logItem]
      });

      // Also create a linked Task
      await addTask(
        `${scheduleType === 'Meeting' ? '🤝 Meet' : '📞 Call'}: Lead ${activeLead.name} (${activeLead.business})`,
        scheduleDate,
        'Shoot',
        'Pending',
        undefined,
        undefined,
        scheduleNotes,
        activeLead.id,
        activeLead.name,
        'Adhwaryu'
      );
    } else if (activeClient) {
      // Create a task
      await addTask(
        `${scheduleType === 'Meeting' ? '🤝 Client Meeting' : '📞 Operational Call'}: ${activeClient.businessName}`,
        scheduleDate,
        'Shoot',
        'Pending',
        activeClient.id,
        activeClient.name,
        scheduleNotes,
        undefined,
        undefined,
        'Adhwaryu'
      );
    }

    closeModal();
  };

  // 5. Submit Convert Lead to Client
  const handleSubmitConvert = async () => {
    if (!activeLead) return;

    const expiry = calculateExpiryDate(todayStr, cDuration);
    const clientDetails = {
      name: activeLead.name,
      businessName: activeLead.business,
      mobile: activeLead.mobile,
      whatsApp: activeLead.mobile,
      email: activeLead.email || 'info@agency.com',
      address: activeLead.address || 'Address N/A',
      startDate: todayStr,
      packageDuration: cDuration,
      expiryDate: expiry,
      notes: activeLead.notes || 'Converted from Lead',
      packageDetails: {
        type: cPkgType,
        customName: cPkgType === 'Quick Service' ? cQuickServiceName : (cPkgType === 'Custom' ? 'Custom Package' : `${cPkgType} Package`),
        price: cPrice,
        duration: cDuration,
        services: cServices
      },
      payments: [
        {
          id: 'pay_' + Date.now(),
          amount: cPaid,
          date: todayStr,
          mode: cPayMode,
          type: cPaid === cPrice ? 'Full Payment' : 'Advance' as any,
          notes: 'Initial payment recorded on conversion'
        }
      ],
      revenue: cPaid,
      pendingAmount: Math.max(0, cPrice - cPaid),
      paymentStatus: (cPaid >= cPrice ? 'Paid' : 'Pending') as any
    };

    await updateLead(activeLead.id, { status: 'Converted' });
    await convertLeadToClient(activeLead.id, clientDetails, null);
    closeModal();
  };

  // 6. Submit Record Payment
  const handleSubmitPayment = async () => {
    if (!activeClient) return;

    const newPayment: Payment = {
      id: 'pay_' + Date.now(),
      amount: Number(payAmount),
      date: todayStr,
      mode: payMode,
      type: payType as any,
      notes: payNotes || undefined
    };

    const existingPayments = activeClient.payments || [];
    const updatedPayments = [...existingPayments, newPayment];
    
    // Calculate total price of package
    const packageVal = activeClient.packageDetails?.price || (activeClient.revenue + activeClient.pendingAmount) || 0;
    const totalReceived = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const calculatedPending = Math.max(0, packageVal - totalReceived);
    const computedPaymentStatus = calculatedPending <= 0 ? 'Paid' : 'Pending';

    await updateClient(activeClient.id, {
      payments: updatedPayments,
      revenue: totalReceived,
      pendingAmount: calculatedPending,
      paymentStatus: computedPaymentStatus
    });

    closeModal();
  };

  // 7. Submit Add Planner Activity
  const handleSubmitPlannerAdd = async () => {
    if (!activeClient) return;

    const planner = activeClient.contentPlanner || { days: {} };
    const days = { ...planner.days };
    const dayPlan = days[plaDate] || { date: plaDate, activities: [] };

    const newActivity: DailyActivity = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: plaType,
      status: 'Planned',
      notes: plaNotes || undefined
    };

    dayPlan.activities = [...dayPlan.activities, newActivity];
    days[plaDate] = dayPlan;

    await updateClient(activeClient.id, {
      contentPlanner: {
        ...planner,
        days
      }
    });

    closeModal();
  };

  // 8. Delete Planner Activity
  const handleDeletePlannerItem = async (client: Client, date: string, activityId: string) => {
    const planner = client.contentPlanner;
    if (!planner || !planner.days) return;
    const days = { ...planner.days };
    const dayPlan = days[date];
    if (!dayPlan || !dayPlan.activities) return;

    dayPlan.activities = dayPlan.activities.filter(act => act.id !== activityId);
    days[date] = dayPlan;

    await updateClient(client.id, {
      contentPlanner: {
        ...planner,
        days
      }
    });
  };

  // 9. Move Planner Activity
  const handleMovePlannerItem = async (client: Client, oldDate: string, targetDate: string, activity: DailyActivity) => {
    const planner = client.contentPlanner;
    if (!planner || !planner.days) return;
    const days = { ...planner.days };

    // Remove from old date
    const oldPlan = days[oldDate];
    if (oldPlan && oldPlan.activities) {
      days[oldDate] = {
        ...oldPlan,
        activities: oldPlan.activities.filter(a => a.id !== activity.id)
      };
    }

    // Add to target date
    const newPlan = days[targetDate] || { date: targetDate, activities: [] };
    days[targetDate] = {
      ...newPlan,
      activities: [...newPlan.activities, activity]
    };

    await updateClient(client.id, {
      contentPlanner: {
        ...planner,
        days
      }
    });
  };

  // 10. Complete/Toggle Planner Activity status
  const handleTogglePlannerItem = async (client: Client, date: string, activityId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Completed' || currentStatus === 'Posted' ? 'Planned' : 'Completed';
    const planner = client.contentPlanner;
    if (!planner || !planner.days) return;
    const days = { ...planner.days };
    const dayPlan = days[date];
    if (!dayPlan || !dayPlan.activities) return;

    dayPlan.activities = dayPlan.activities.map(act => {
      if (act.id === activityId) {
        return { ...act, status: nextStatus as any };
      }
      return act;
    });
    days[date] = dayPlan;

    await updateClient(client.id, {
      contentPlanner: {
        ...planner,
        days
      }
    });
  };


  // TAB LIST RENDERER HELPERS
  const filteredNeedsAttention = useMemo(() => {
    return needsAttentionList.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [needsAttentionList, searchTerm]);

  const filteredTodayCalls = useMemo(() => {
    return todayCalls.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todayCalls, searchTerm]);

  const filteredTodayMeetings = useMemo(() => {
    return todayMeetings.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.reason.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todayMeetings, searchTerm]);

  const filteredTodayLeads = useMemo(() => {
    return todayLeads.filter(l => 
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.business.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todayLeads, searchTerm]);

  const filteredTodayClients = useMemo(() => {
    return todayClientsList.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.businessName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todayClientsList, searchTerm]);

  const filteredPaymentRecovery = useMemo(() => {
    return paymentRecoveryList.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.businessName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [paymentRecoveryList, searchTerm]);

  const filteredTodayPlanner = useMemo(() => {
    return todayContentPlanner.filter(item => 
      item.client.businessName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.activity.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todayContentPlanner, searchTerm]);

  const filteredUpcoming = useMemo(() => {
    const tasks = upcomingWork.tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const followUps = upcomingWork.followUps.filter(f => f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || f.businessName.toLowerCase().includes(searchTerm.toLowerCase()));
    return { tasks, followUps };
  }, [upcomingWork, searchTerm]);

  const filteredOverdue = useMemo(() => {
    const tasks = overdueWork.tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const followUps = overdueWork.followUps.filter(f => f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || f.businessName.toLowerCase().includes(searchTerm.toLowerCase()));
    return { tasks, followUps };
  }, [overdueWork, searchTerm]);

  const filteredCompletedToday = useMemo(() => {
    const tasks = completedToday.tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const followUps = completedToday.followUps.filter(f => f.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || f.businessName.toLowerCase().includes(searchTerm.toLowerCase()));
    return { tasks, followUps };
  }, [completedToday, searchTerm]);

  return (
    <div className="space-y-6">
      
      {/* Smart Reminders Board */}
      {smartReminders.length > 0 && (
        <div className="bg-[#121c15] border border-emerald-500/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4.5 w-4.5 text-emerald-400 animate-bounce" />
            <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Smart Operations Reminders</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {smartReminders.map((alert, idx) => (
              <div key={idx} className="bg-[#0b0f0c] border border-emerald-500/5 rounded-xl p-3 flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg ${
                  alert.type === 'overdue' || alert.type === 'renewal' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">{alert.message}</h5>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{alert.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Center Sub-tabs navigation */}
      <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-emerald-900/5 pb-2 overflow-x-auto gap-1">
          {[
            { id: 'attention', label: '🔥 Attention', count: needsAttentionList.length, color: 'text-rose-400' },
            { id: 'calls', label: '📞 Calls', count: todayCalls.length, color: 'text-sky-400' },
            { id: 'meetings', label: '🤝 Meetings', count: todayMeetings.length, color: 'text-purple-400' },
            { id: 'leads', label: '👥 Today Leads', count: todayLeads.length, color: 'text-indigo-400' },
            { id: 'clients', label: '🏢 Today Clients', count: todayClientsList.length, color: 'text-emerald-400' },
            { id: 'recovery', label: '💰 Recovery', count: paymentRecoveryList.length, color: 'text-amber-400' },
            { id: 'planner', label: '📅 My Planner', count: todayContentPlanner.length, color: 'text-pink-400' },
            { id: 'upcoming', label: '⏳ Upcoming', count: upcomingWork.tasks.length + upcomingWork.followUps.length, color: 'text-teal-400' },
            { id: 'overdue', label: '🔴 Overdue', count: overdueWork.tasks.length + overdueWork.followUps.length, color: 'text-rose-500' },
            { id: 'completed', label: '✅ Done Today', count: completedToday.tasks.length + completedToday.followUps.length, color: 'text-emerald-400' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 border-b-2 text-[11px] font-extrabold tracking-wide uppercase cursor-pointer transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-emerald-500 bg-emerald-500/5 ' + tab.color
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${activeTab === tab.id ? 'bg-white/10' : 'bg-[#0b0b0b]'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search input inside control center */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search Adhwaryu Control: ${activeTab.toUpperCase()} queue...`}
            className="w-full px-4 py-2.5 pl-10 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-xs text-white focus:outline-none"
          />
          <span className="absolute left-3.5 top-3 text-gray-600 text-xs">🔍</span>
        </div>
      </div>

      {/* Main Tab Content lists */}
      <div className="space-y-4">
        
        {/* 🔥 Tab: Needs Attention */}
        {activeTab === 'attention' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNeedsAttention.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">✨ Outstanding job! Adhwaryu has zero items requiring urgent attention today.</div>
            ) : (
              filteredNeedsAttention.map((item) => (
                <div key={item.id} className="bg-[#141414] border border-rose-950/20 hover:border-rose-500/20 rounded-2xl p-4 flex flex-col justify-between transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/15 px-2 py-0.5 rounded-md">
                        🚨 {item.category}
                      </span>
                      <span className={`h-1.5 w-1.5 rounded-full ${item.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    </div>
                    <h4 className="text-sm font-extrabold text-white">{item.title}</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.description}</p>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-850">
                    {item.lead && (
                      <>
                        <button onClick={() => handleCallAction(item.lead!, true)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs flex items-center gap-1 cursor-pointer">
                          <Phone className="h-3 w-3" /> Call
                        </button>
                        <button onClick={() => handleWhatsAppAction(item.lead!, true)} className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs flex items-center gap-1 cursor-pointer">
                          <MessageSquare className="h-3 w-3" /> Chat
                        </button>
                        <button onClick={() => openModal('convert', item.lead!, null)} className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 text-xs flex items-center gap-1 cursor-pointer">
                          <Sparkles className="h-3 w-3" /> Convert
                        </button>
                      </>
                    )}
                    {item.client && (
                      <>
                        <button onClick={() => handleCallAction(item.client!, false)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs flex items-center gap-1 cursor-pointer">
                          <Phone className="h-3 w-3" /> Call
                        </button>
                        <button onClick={() => openModal('payment', null, item.client!)} className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 text-xs flex items-center gap-1 cursor-pointer">
                          <IndianRupee className="h-3 w-3" /> Record Payment
                        </button>
                      </>
                    )}
                    {item.task && (
                      <button onClick={() => handleCompleteAction({ task: item.task })} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs flex items-center gap-1 cursor-pointer">
                        <CheckSquare className="h-3 w-3" /> Complete Task
                      </button>
                    )}
                    {item.followUp && (
                      <button onClick={() => handleCompleteAction({ followUp: item.followUp })} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs flex items-center gap-1 cursor-pointer">
                        <CheckSquare className="h-3 w-3" /> Check-off
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 📞 Tab: Today's Calls */}
        {activeTab === 'calls' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTodayCalls.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">🎉 No telephonic calls scheduled for today.</div>
            ) : (
              filteredTodayCalls.map((item, idx) => (
                <div key={idx} className="bg-[#141414] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-white">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-850">
                    <button onClick={() => item.lead ? handleCallAction(item.lead, true) : item.client ? handleCallAction(item.client, false) : null} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                      <Phone className="h-3 w-3" /> Dial Now
                    </button>
                    <button onClick={() => item.lead ? handleWhatsAppAction(item.lead, true) : item.client ? handleWhatsAppAction(item.client, false) : null} className="px-3 py-1.5 bg-[#0d0d0d] border border-slate-800 text-sky-400 hover:text-sky-300 rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </button>
                    <button onClick={() => handleCompleteAction(item)} className="px-3 py-1.5 bg-emerald-950/20 text-emerald-400 border border-emerald-500/10 rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                      <Check className="h-3 w-3" /> Log Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 🤝 Tab: Today's Meetings */}
        {activeTab === 'meetings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTodayMeetings.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">🤝 No briefings or business meetings scheduled today.</div>
            ) : (
              filteredTodayMeetings.map((item, idx) => (
                <div key={idx} className="bg-[#141414] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-white">{item.title}</h4>
                      {item.time && <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono">{item.time}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{item.reason}</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-850">
                    {item.client && (
                      <button onClick={() => handleCallAction(item.client!, false)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs flex items-center gap-1 cursor-pointer">
                        <Phone className="h-3 w-3" /> Call Client
                      </button>
                    )}
                    <button onClick={() => handleCompleteAction(item)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                      <Check className="h-3.5 w-3.5" /> Check-off Meeting
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 👥 Tab: Today's Leads */}
        {activeTab === 'leads' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTodayLeads.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">👥 No lead follow-ups slotted for today. Use CRM to add more pipeline prospects.</div>
            ) : (
              filteredTodayLeads.map((lead) => (
                <div key={lead.id} className="bg-[#141414] border border-slate-850 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{lead.name}</h4>
                      <p className="text-xs text-emerald-400 font-bold">{lead.business}</p>
                    </div>
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 px-2 py-0.5 rounded">
                      {lead.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-900">
                    <div>📞 Mobile: <span className="text-white font-mono">{lead.mobile}</span></div>
                    <div>🎯 Source: <span className="text-white">{lead.leadSource}</span></div>
                    <div className="col-span-2 mt-1 pt-1 border-t border-slate-900 text-gray-400">
                      📝 Notes: {lead.notes || 'No remarks recorded.'}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-1.5 pt-2">
                    <button onClick={() => handleCallAction(lead, true)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs cursor-pointer">
                      📞 Call
                    </button>
                    <button onClick={() => handleWhatsAppAction(lead, true)} className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs cursor-pointer">
                      💬 Chat
                    </button>
                    <button onClick={() => openModal('schedule', lead, null)} className="p-1.5 rounded-lg bg-[#0d0d0d] border border-slate-800 text-gray-400 hover:text-white text-xs cursor-pointer">
                      📅 Re-schedule
                    </button>
                    <button onClick={() => openModal('convert', lead, null)} className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/20 text-xs font-bold cursor-pointer">
                      🏆 Convert Client
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 🏢 Tab: Today's Clients */}
        {activeTab === 'clients' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTodayClients.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">🏢 No active client operational updates required today.</div>
            ) : (
              filteredTodayClients.map((client) => {
                const todayPlannerCount = client.contentPlanner?.days?.[todayStr]?.activities?.length || 0;
                return (
                  <div key={client.id} className="bg-[#141414] border border-slate-850 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-extrabold text-white">{client.businessName}</h4>
                        <p className="text-xs text-gray-400">Owner: {client.name}</p>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/5 px-2.5 py-0.5 rounded-full border border-emerald-500/10 font-bold">
                        {client.packageDetails?.customName || client.packageDetails?.type || 'Custom'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-900">
                      <div>💰 Balance: <span className="text-amber-400 font-bold font-mono">{formatCurrency(client.pendingAmount)}</span></div>
                      <div>⌛ Expires: <span className="text-white font-mono">{formatDate(client.expiryDate)}</span></div>
                      <div className="col-span-2">📅 Today's Planner activities: <span className="text-emerald-400 font-bold">{todayPlannerCount} items</span></div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-1.5 pt-2">
                      <button onClick={() => handleCallAction(client, false)} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs cursor-pointer">
                        📞 Call
                      </button>
                      <button onClick={() => handleWhatsAppAction(client, false)} className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 text-xs cursor-pointer">
                        💬 WhatsApp
                      </button>
                      <button onClick={() => openModal('planner_add', null, client)} className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 text-xs cursor-pointer">
                        ➕ Planner Item
                      </button>
                      <button onClick={() => openModal('payment', null, client)} className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs cursor-pointer">
                        💰 Record Payment
                      </button>
                      <button onClick={() => openModal('invoice', null, client)} className="p-1.5 rounded-lg bg-slate-800 text-white text-xs cursor-pointer">
                        📄 Receipt
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 💰 Tab: Payment Recovery */}
        {activeTab === 'recovery' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPaymentRecovery.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">💰 Zero pending balance across clients. All ledgers cleared!</div>
            ) : (
              filteredPaymentRecovery.map((client) => (
                <div key={client.id} className="bg-[#141414] border border-amber-950/25 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{client.businessName}</h4>
                      <p className="text-xs text-gray-500">Contact: {client.name} ({client.mobile})</p>
                    </div>
                    <span className="text-xs text-rose-400 font-extrabold bg-rose-500/5 px-2.5 py-0.5 border border-rose-500/10 rounded-lg font-mono">
                      {formatCurrency(client.pendingAmount)} Pending
                    </span>
                  </div>

                  <div className="text-[10px] text-gray-400 bg-[#0d0d0d] p-3 rounded-xl border border-slate-900 flex justify-between">
                    <div>🚀 Campaign Value: <span className="text-white font-mono">{formatCurrency(client.packageDetails?.price || 0)}</span></div>
                    <div>🟢 Revenue Paid: <span className="text-emerald-400 font-mono">{formatCurrency(client.revenue || 0)}</span></div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => handleWhatsAppAction(client, false)} className="px-3 py-1.5 bg-[#0d0d0d] border border-slate-800 text-sky-400 hover:text-sky-300 text-xs rounded-xl flex items-center gap-1 cursor-pointer">
                      💬 Request UPI Remind
                    </button>
                    <button onClick={() => openModal('payment', null, client)} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer">
                      💰 Log Cash/UPI Receipt
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 📅 Tab: My Content Planner Activities (Adhwaryu's Operations) */}
        {activeTab === 'planner' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 font-extrabold tracking-widest uppercase">My Active Content Tasks</span>
              <p className="text-[10px] text-gray-500">Add, complete, move, or delete activities assigned to Adhwaryu.</p>
            </div>

            {filteredTodayPlanner.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">📅 No creative planner operations assigned to you today.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTodayPlanner.map((item, idx) => (
                  <div key={idx} className="bg-[#141414] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 bg-pink-500/10 text-pink-400 border border-pink-500/10 rounded-md">
                          🎬 {item.activity.type}
                        </span>
                        <button 
                          onClick={() => handleTogglePlannerItem(item.client, item.date, item.activity.id, item.activity.status)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            item.activity.status === 'Completed' || item.activity.status === 'Posted'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {item.activity.status} (Toggle)
                        </button>
                      </div>

                      <h4 className="text-sm font-extrabold text-white">{item.client.businessName}</h4>
                      {item.activity.notes && <p className="text-xs text-gray-400">📝 {item.activity.notes}</p>}
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-850">
                      {/* Move date utility */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500">📅 Move:</span>
                        <input 
                          type="date" 
                          value={item.date} 
                          onChange={(e) => handleMovePlannerItem(item.client, item.date, e.target.value, item.activity)}
                          className="bg-[#0d0d0d] border border-slate-850 text-[10px] text-white rounded p-1"
                        />
                      </div>

                      <button 
                        onClick={() => handleDeletePlannerItem(item.client, item.date, item.activity.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                        title="Delete from planner"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ⏳ Tab: Upcoming */}
        {activeTab === 'upcoming' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredUpcoming.tasks.length === 0 && filteredUpcoming.followUps.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">🔮 No upcoming operations listed for the future weeks.</div>
            ) : (
              <>
                {filteredUpcoming.tasks.map((task) => (
                  <div key={task.id} className="bg-[#141414] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/10 uppercase font-bold">Task</span>
                        <span className="text-[10px] text-gray-500 font-mono">📅 {formatDate(task.dueDate)}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white">{task.title}</h4>
                      {task.notes && <p className="text-xs text-gray-400 mt-1">{task.notes}</p>}
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-850">
                      <button onClick={() => handleCompleteAction({ task })} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer">
                        Complete
                      </button>
                    </div>
                  </div>
                ))}

                {filteredUpcoming.followUps.map((fo) => (
                  <div key={fo.id} className="bg-[#141414] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] bg-purple-500/10 text-purple-400 px-2.5 py-0.5 rounded border border-purple-500/10 uppercase font-bold">Follow-Up</span>
                        <span className="text-[10px] text-gray-500 font-mono">📅 {formatDate(fo.followUpDate)}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white">{fo.businessName} ({fo.clientName})</h4>
                      <p className="text-xs text-gray-400 mt-1">📝 Type: {fo.followUpType} | Reason: {fo.reason}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* 🔴 Tab: Overdue */}
        {activeTab === 'overdue' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOverdue.tasks.length === 0 && filteredOverdue.followUps.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">🟢 All deliverables and follow-ups are up-to-date!</div>
            ) : (
              <>
                {filteredOverdue.tasks.map((task) => (
                  <div key={task.id} className="bg-[#141414] border border-rose-950/30 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded border border-rose-500/15 uppercase font-black">OVERDUE</span>
                        <span className="text-[10px] text-rose-400 font-black font-mono">📅 {formatDate(task.dueDate)}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white">{task.title}</h4>
                      {task.notes && <p className="text-xs text-gray-400 mt-1">{task.notes}</p>}
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-850">
                      <button onClick={() => handleCompleteAction({ task })} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer">
                        Complete Deliverable
                      </button>
                    </div>
                  </div>
                ))}

                {filteredOverdue.followUps.map((fo) => (
                  <div key={fo.id} className="bg-[#141414] border border-rose-950/30 rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded border border-rose-500/15 uppercase font-black">OVERDUE FO</span>
                        <span className="text-[10px] text-rose-400 font-black font-mono">📅 {formatDate(fo.followUpDate)}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white">{fo.businessName} ({fo.clientName})</h4>
                      <p className="text-xs text-gray-400 mt-1">📝 Type: {fo.followUpType} | Reason: {fo.reason}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ✅ Tab: Completed Today */}
        {activeTab === 'completed' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCompletedToday.tasks.length === 0 && filteredCompletedToday.followUps.length === 0 ? (
              <div className="col-span-2 text-center py-10 text-gray-500 text-xs">⏳ Complete some tasks or follow-ups to see today's log stack.</div>
            ) : (
              <>
                {filteredCompletedToday.tasks.map((task) => (
                  <div key={task.id} className="bg-[#141414]/50 border border-emerald-950/20 rounded-2xl p-4 opacity-75">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.2 rounded font-bold">COMPLETED</span>
                      <span className="text-[10px] text-gray-500 font-mono">📅 {formatDate(task.dueDate)}</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white line-through">{task.title}</h4>
                  </div>
                ))}

                {filteredCompletedToday.followUps.map((fo) => (
                  <div key={fo.id} className="bg-[#141414]/50 border border-emerald-950/20 rounded-2xl p-4 opacity-75">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.2 rounded font-bold">COMPLETED FO</span>
                      <span className="text-[10px] text-gray-500 font-mono">📅 {formatDate(fo.followUpDate)}</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white line-through">{fo.businessName} ({fo.clientName})</h4>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </div>

      {/* ALL MODALS COMPONENT */}
      <AnimatePresence>
        {modalType !== 'none' && (
          <div className="fixed inset-0 bg-[#000]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  {modalType === 'schedule' && '📅 Schedule Operations Follow-Up'}
                  {modalType === 'convert' && '🏆 Convert Lead to Paid Client'}
                  {modalType === 'payment' && '💰 Record Payment Cash/UPI'}
                  {modalType === 'planner_add' && '➕ Add Content Planner Activity'}
                  {modalType === 'invoice' && '📄 Digital Invoice Ledger Receipt'}
                </h3>
                <button onClick={closeModal} className="text-gray-500 hover:text-white cursor-pointer">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Modal Context: Schedule Followup */}
              {modalType === 'schedule' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Type</label>
                    <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as any)} className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none">
                      <option value="Call">📞 Call (Log Call Follow-up)</option>
                      <option value="Meeting">🤝 Meeting (Log Client Briefing/Shoot)</option>
                      <option value="Follow-up">⏱️ General Follow-up Task</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Target Follow-Up Date</label>
                    <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Operational Notes / Agenda</label>
                    <textarea value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)} placeholder="Provide agenda or call reminders..." className="w-full h-24 px-4 py-2.5 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none resize-none" />
                  </div>
                  <button onClick={handleSubmitSchedule} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest transition cursor-pointer">
                    Schedule Activity
                  </button>
                </div>
              )}

              {/* Modal Context: Convert Lead */}
              {modalType === 'convert' && activeLead && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 bg-[#0d0d0d] p-3 rounded-2xl border border-slate-900 text-xs">
                    <div>👤 Name: <span className="text-white font-bold">{activeLead.name}</span></div>
                    <div>🏢 Business: <span className="text-white font-bold">{activeLead.business}</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block">Campaign Package</label>
                      <select value={cPkgType} onChange={(e) => {
                        const val = e.target.value as any;
                        setCPkgType(val);
                        if (val === 'Basic') { setCPrice(10000); setCDuration('1 Month'); }
                        else if (val === 'Advance') { setCPrice(25000); setCDuration('3 Months'); }
                        else if (val === 'Pro') { setCPrice(50000); setCDuration('6 Months'); }
                        else if (val === 'Quick Service') { setCPrice(1500); setCDuration('One-Time'); setCQuickServiceName('1 Reel'); setCServices(['Reel Editing']); }
                      }} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none">
                        <option value="Basic">Basic (₹10,000)</option>
                        <option value="Advance">Advance (₹25,000)</option>
                        <option value="Pro">Pro (₹50,000)</option>
                        <option value="Quick Service">⚡ Quick Service</option>
                        <option value="Custom">Custom Pricing</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block">Duration</label>
                      <select value={cDuration} onChange={(e) => setCDuration(e.target.value)} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none">
                        <option value="One-Time">One-Time Project</option>
                        <option value="1 Month">1 Month</option>
                        <option value="3 Months">3 Months</option>
                        <option value="6 Months">6 Months</option>
                        <option value="1 Year">1 Year</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block">Total Package Value (INR)</label>
                      <input type="number" value={cPrice} onChange={(e) => setCPrice(Number(e.target.value))} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block">Down payment Amount</label>
                      <input type="number" value={cPaid} onChange={(e) => setCPaid(Number(e.target.value))} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none" />
                    </div>
                  </div>

                  {cPkgType === 'Quick Service' && (
                    <div className="space-y-2 bg-[#080808] p-3 rounded-xl border border-slate-900 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <span>⚡ Quick Service:</span>
                        <input
                          type="text"
                          value={cQuickServiceName}
                          onChange={(e) => setCQuickServiceName(e.target.value)}
                          className="bg-transparent border-b border-slate-800 text-white text-xs px-1 focus:outline-none focus:border-emerald-500 font-medium w-36"
                          placeholder="e.g. 1 Reel"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[
                          { name: '1 Reel', price: 1500, service: 'Reel Editing' },
                          { name: 'Poster', price: 500, service: 'Poster Design' },
                          { name: 'Banner', price: 1000, service: 'Banner Design' },
                          { name: 'Logo', price: 2500, service: 'Logo Design' },
                          { name: 'Visiting Card', price: 600, service: 'Visiting Card Design' },
                        ].map(preset => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setCQuickServiceName(preset.name);
                              setCPrice(preset.price);
                              setCServices([preset.service]);
                            }}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-all cursor-pointer ${
                              cQuickServiceName === preset.name
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                                : 'bg-[#141414] text-gray-400 border-slate-900 hover:border-slate-800'
                            }`}
                          >
                            {preset.name} (₹{preset.price})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">UPI / Payment Instrument Mode</label>
                    <select value={cPayMode} onChange={(e) => setCPayMode(e.target.value as any)} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none">
                      <option value="UPI">GPay / PhonePe / UPI</option>
                      <option value="Cash">Cash Ledger</option>
                      <option value="Bank Transfer">NEFT / Bank Transfer</option>
                    </select>
                  </div>

                  <button onClick={handleSubmitConvert} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer">
                    Convert & Initialize Campaign
                  </button>
                </div>
              )}

              {/* Modal Context: Record Payment */}
              {modalType === 'payment' && activeClient && (
                <div className="space-y-4">
                  <div className="p-3 bg-[#0d0d0d] border border-slate-900 rounded-2xl flex justify-between text-xs">
                    <div>🏢 Business: <span className="text-white font-bold">{activeClient.businessName}</span></div>
                    <div>💰 Pending Amount: <span className="text-rose-400 font-extrabold font-mono">{formatCurrency(activeClient.pendingAmount)}</span></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block">Received Amount (INR)</label>
                      <input type="number" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block">Transaction Type</label>
                      <select value={payType} onChange={(e) => setPayType(e.target.value as any)} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none">
                        <option value="Installment">Installment Payment</option>
                        <option value="Advance">Advance Payment</option>
                        <option value="Full Payment">Full Balance Clearance</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">UPI / Cash Mode</label>
                    <select value={payMode} onChange={(e) => setPayMode(e.target.value as any)} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none">
                      <option value="UPI">GPay / PhonePe / UPI</option>
                      <option value="Cash">Cash Handover</option>
                      <option value="Bank Transfer">NEFT / Net Banking</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Ledger Remarks</label>
                    <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="UTR link, billing comments..." className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none" />
                  </div>

                  <button onClick={handleSubmitPayment} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer">
                    Record Payment Receipt
                  </button>
                </div>
              )}

              {/* Modal Context: Add Planner Activity */}
              {modalType === 'planner_add' && activeClient && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Scheduled Date</label>
                    <input type="date" value={plaDate} onChange={(e) => setPlaDate(e.target.value)} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Activity Type (Creative / Digital Media)</label>
                    <select value={plaType} onChange={(e) => setPlaType(e.target.value)} className="w-full px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none">
                      <option value="Instagram Post">Instagram Post Graphic</option>
                      <option value="Instagram Reel">Creative Video Reel</option>
                      <option value="Facebook Ad Creative">Facebook Ad Campaign</option>
                      <option value="Story Upload">Instagram Status / Story</option>
                      <option value="Poster Design">Physical Banner/Poster Print</option>
                      <option value="Client Meeting">In-person Client Briefing</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Planner Briefing / Topic</label>
                    <textarea value={plaNotes} onChange={(e) => setPlaNotes(e.target.value)} placeholder="Notes for creative designers..." className="w-full h-24 px-4 py-2 bg-[#0d0d0d] border border-slate-800 rounded-xl text-xs text-white focus:outline-none resize-none" />
                  </div>

                  <button onClick={handleSubmitPlannerAdd} className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-widest cursor-pointer">
                    Commit To Content Planner
                  </button>
                </div>
              )}

              {/* Modal Context: Digital Invoice Receipt */}
              {modalType === 'invoice' && activeClient && (
                <div className="space-y-4 text-xs">
                  <div className="bg-[#0b0b0b] border border-slate-850 p-6 rounded-2xl space-y-4 font-mono text-gray-300">
                    <div className="text-center border-b border-dashed border-slate-800 pb-3">
                      <h4 className="text-base font-extrabold text-white">AB GRAPHICS CRM</h4>
                      <p className="text-[9px] text-gray-500">OPERATIONAL TRANSACTION STATEMENT</p>
                    </div>

                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex justify-between"><span>CLIENT BUSINESS:</span><span className="text-white font-bold">{activeClient.businessName}</span></div>
                      <div className="flex justify-between"><span>CLIENT NAME:</span><span className="text-white">{activeClient.name}</span></div>
                      <div className="flex justify-between"><span>CONTACT MOBILE:</span><span className="text-white">{activeClient.mobile}</span></div>
                      <div className="flex justify-between"><span>BILLING ADDRESS:</span><span className="text-white">{activeClient.address}</span></div>
                      <div className="flex justify-between"><span>CAMPAIGN START:</span><span className="text-white">{formatDate(activeClient.startDate)}</span></div>
                      <div className="flex justify-between"><span>CAMPAIGN EXPIRY:</span><span className="text-white">{formatDate(activeClient.expiryDate)}</span></div>
                    </div>

                    <div className="border-t border-dashed border-slate-800 pt-3 space-y-2">
                      <div className="flex justify-between text-white font-extrabold text-xs">
                        <span>TOTAL DEAL VALUE:</span>
                        <span>{formatCurrency(activeClient.packageDetails?.price || 0)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>TOTAL REVENUE PAID:</span>
                        <span>{formatCurrency(activeClient.revenue)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400 font-bold">
                        <span>BALANCE DUPLICATE OUTSTANDING:</span>
                        <span>{formatCurrency(activeClient.pendingAmount)}</span>
                      </div>
                    </div>

                    {activeClient.payments && activeClient.payments.length > 0 && (
                      <div className="border-t border-dashed border-slate-800 pt-3">
                        <span className="text-[9px] text-gray-500 block mb-1">TRANSACTION JOURNAL LEDGER:</span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {activeClient.payments.map((p, idx) => (
                            <div key={p.id} className="flex justify-between text-[9px]">
                              <span>{idx+1}. {formatDate(p.date)} ({p.mode})</span>
                              <span className="text-white">{formatCurrency(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const summaryText = `📄 TRANSACTION STATEMENT: ${activeClient.businessName}\nValue: ${formatCurrency(activeClient.packageDetails?.price || 0)}\nPaid: ${formatCurrency(activeClient.revenue)}\nBalance Outstanding: ${formatCurrency(activeClient.pendingAmount)}\nLedger cleared successfully on system accounts.`;
                        window.open(`https://wa.me/91${activeClient.whatsApp || activeClient.mobile}?text=${encodeURIComponent(summaryText)}`, '_blank');
                      }}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-center cursor-pointer"
                    >
                      💬 Send Receipt on WhatsApp
                    </button>
                    <button onClick={closeModal} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl cursor-pointer">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
