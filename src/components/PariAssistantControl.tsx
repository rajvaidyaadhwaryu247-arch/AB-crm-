import React, { useState, useMemo, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { Client, Lead, Task, FollowUp, Activity } from '../types';
import { formatDate, formatCurrency } from '../utils';
import { 
  Plus, Calendar, AlertCircle, CheckCircle2, RotateCw, Trash2, Edit, 
  Send, CheckSquare, Clock, ArrowRight, UserPlus, Zap, Check, X, 
  FileSpreadsheet, Layers, Bell, Eye, ClipboardList, ShieldAlert, 
  Sparkles, ExternalLink, RefreshCw, User, Info, DollarSign, Award, ArrowUpRight, CheckCircle, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ContentPlanner } from './ContentPlanner';

// Pari Task Categories
const PARI_TASK_CATEGORIES = [
  'Excel Updates',
  'Client Records',
  'Lead Records',
  'Reports',
  'Documentation',
  'Data Verification',
  'Reminder Tasks',
  'Package Records',
  'Pending Payment Records'
];

export const PariAssistantControl: React.FC = () => {
  const { 
    clients, leads, tasks, followUps, activities, 
    updateClient, updateLead, addTask, updateTask, deleteTask,
    sendTelegramNotification
  } = useCRM();

  // Date constants
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, []);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<'overview' | 'data-center' | 'my-tasks' | 'team' | 'clients' | 'leads' | 'reminders'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // Firestore Live States
  const [reminders, setReminders] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<Record<string, any>>({});
  const [loadingReminders, setLoadingReminders] = useState(true);

  // Pari Data Center States & Live Sync
  const [pariDataCenterStatuses, setPariDataCenterStatuses] = useState<Record<string, any>>({});
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [selectedRecordTypeFilter, setSelectedRecordTypeFilter] = useState<'All' | 'Lead' | 'Client' | 'Quick Service' | 'Payment' | 'Package'>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'Needs Verification' | 'Not Sent' | 'Sent' | 'Updated'>('All');
  const [isPushing, setIsPushing] = useState<Record<string, boolean>>({});
  const [isBulkPushing, setIsBulkPushing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Helper to serialize stable record values for modification checking
  const serializeRecord = (record: any, type: string) => {
    if (type === 'Lead') {
      return JSON.stringify({
        name: record.name || '',
        business: record.business || '',
        mobile: record.mobile || '',
        email: record.email || '',
        address: record.address || '',
        status: record.status || '',
        expectedPackage: record.expectedPackage || '',
        expectedRevenue: record.expectedRevenue || 0,
        followUpDate: record.followUpDate || '',
        notes: record.notes || '',
      });
    } else if (type === 'Client' || type === 'Quick Service' || type === 'Package') {
      return JSON.stringify({
        name: record.name || '',
        businessName: record.businessName || '',
        mobile: record.mobile || '',
        email: record.email || '',
        address: record.address || '',
        status: record.status || '',
        packageType: record.packageDetails?.type || '',
        customName: record.packageDetails?.customName || '',
        price: record.packageDetails?.price || 0,
        duration: record.packageDetails?.duration || '',
        revenue: record.revenue || 0,
        pendingAmount: record.pendingAmount || 0,
        startDate: record.startDate || '',
        expiryDate: record.expiryDate || '',
        notes: record.notes || '',
      });
    } else if (type === 'Payment') {
      const { payment, client } = record;
      return JSON.stringify({
        amount: payment?.amount || 0,
        date: payment?.date || '',
        mode: payment?.mode || '',
        type: payment?.type || '',
        notes: payment?.notes || '',
        clientName: client?.name || '',
      });
    }
    return '';
  };

  // Helper to format clean text updates for Telegram matching the specified layout
  const formatPariTelegramMessage = (r: any, statusLabel: string): string => {
    const emailVal = r.email && r.email !== 'Not Provided' ? r.email : 'Not Provided';
    return `📋 *DATA UPDATE*
*Record Type:* ${r.recordType}
*Name:* ${r.name}
*Business:* ${r.businessName}
*Phone:* ${r.phone}
*Email:* ${emailVal}
*Address:* ${r.address}
*Status:* ${r.status}
*Package / Service:* ${r.packageOrService}
*Package Amount:* ₹${r.packageAmount}
*Paid:* ₹${r.paidAmount}
*Pending:* ₹${r.pendingAmount}
*Start Date:* ${r.startDate}
*Expiry Date:* ${r.expiryDate}
*Follow-up:* ${r.followUpDate}
*Notes:* ${r.notes}
*Verification Status:* ${statusLabel}
*Last Updated:* ${r.updatedAt}`;
  };

  // Modal & Selection States
  const [selectedClientForPlanner, setSelectedClientForPlanner] = useState<Client | null>(null);
  const [selectedLinkedClient, setSelectedLinkedClient] = useState<Client | null>(null);
  const [selectedLinkedLead, setSelectedLinkedLead] = useState<Lead | null>(null);
  const [activeReminderTarget, setActiveReminderTarget] = useState<{
    targetId: string;
    targetName: string;
    targetType: 'task' | 'client' | 'lead';
    assignedTo?: string;
  } | null>(null);

  // New Pari Task Form
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskCategory, setNewTaskCategory] = useState(PARI_TASK_CATEGORIES[0]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState(todayStr);
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // New Reminder Form Note
  const [reminderNote, setReminderNote] = useState('');

  // Listen to Pari's reminders, verification alerts, and Pari Data Center status from Firestore
  useEffect(() => {
    const unsubReminders = onSnapshot(collection(db, 'pari_reminders'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setReminders(list);
      setLoadingReminders(false);
    }, (err) => {
      console.error('Error listening to pari_reminders:', err);
      setLoadingReminders(false);
    });

    const unsubVerifications = onSnapshot(collection(db, 'pari_verifications'), (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.forEach((doc) => {
        map[doc.id] = { id: doc.id, ...doc.data() };
      });
      setVerifications(map);
    }, (err) => {
      console.error('Error listening to pari_verifications:', err);
    });

    const unsubPariDataCenter = onSnapshot(collection(db, 'pari_data_center'), (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.forEach((doc) => {
        map[doc.id] = { id: doc.id, ...doc.data() };
      });
      setPariDataCenterStatuses(map);
    }, (err) => {
      console.error('Error listening to pari_data_center:', err);
    });

    return () => {
      unsubReminders();
      unsubVerifications();
      unsubPariDataCenter();
    };
  }, []);

  // PARI DATA CENTER COMPUTED RECORDS
  const pariDataRecords = useMemo(() => {
    const list: any[] = [];

    // 1. Leads
    leads.forEach(l => {
      list.push({
        id: `Lead_${l.id}`,
        recordId: l.id,
        recordType: 'Lead',
        name: l.name,
        businessName: l.business || 'Not Provided',
        phone: l.mobile || 'Not Provided',
        email: l.email || 'Not Provided',
        address: l.address || 'Not Provided',
        status: l.status || 'New',
        packageOrService: l.interestedService || l.expectedPackage || 'Not Provided',
        packageAmount: l.expectedRevenue || 0,
        paidAmount: 0,
        pendingAmount: l.expectedRevenue || 0,
        startDate: 'Not Provided',
        expiryDate: 'Not Provided',
        followUpDate: l.followUpDate || 'Not Provided',
        notes: l.notes || 'No notes',
        updatedAt: l.createdAt || 'Not Provided',
        originalRecord: l,
      });
    });

    // 2. Clients
    clients.forEach(c => {
      const isQuickService = c.packageDetails?.type === 'Quick Service';
      if (!isQuickService) {
        // Standard Client
        list.push({
          id: `Client_${c.id}`,
          recordId: c.id,
          recordType: 'Client',
          name: c.name,
          businessName: c.businessName || 'Not Provided',
          phone: c.mobile || 'Not Provided',
          email: c.email || 'Not Provided',
          address: c.address || 'Not Provided',
          status: c.status || 'Active',
          packageOrService: c.packageDetails?.customName || `${c.packageDetails?.type || 'Standard'} Package`,
          packageAmount: c.packageDetails?.price || 0,
          paidAmount: c.revenue || 0,
          pendingAmount: c.pendingAmount || 0,
          startDate: c.startDate || 'Not Provided',
          expiryDate: c.expiryDate || 'Not Provided',
          followUpDate: 'Not Provided',
          notes: c.notes || 'No notes',
          updatedAt: c.createdAt || 'Not Provided',
          originalRecord: c,
        });

        // Add as Package record if package details exist
        if (c.packageDetails) {
          list.push({
            id: `Package_${c.id}`,
            recordId: c.id,
            recordType: 'Package',
            name: c.name,
            businessName: c.businessName || 'Not Provided',
            phone: c.mobile || 'Not Provided',
            email: c.email || 'Not Provided',
            address: c.address || 'Not Provided',
            status: c.packageDetails.type || 'Standard',
            packageOrService: c.packageDetails.customName || `${c.packageDetails.type} Package`,
            packageAmount: c.packageDetails.price || 0,
            paidAmount: c.revenue || 0,
            pendingAmount: c.pendingAmount || 0,
            startDate: c.startDate || 'Not Provided',
            expiryDate: c.expiryDate || 'Not Provided',
            followUpDate: 'Not Provided',
            notes: `Duration: ${c.packageDetails.duration || 'Not Provided'}\nServices: ${(c.packageDetails.services || []).join(', ')}\n${c.notes || ''}`,
            updatedAt: c.createdAt || 'Not Provided',
            originalRecord: c,
          });
        }
      } else {
        // Quick Service Customer
        list.push({
          id: `Quick Service_${c.id}`,
          recordId: c.id,
          recordType: 'Quick Service',
          name: c.name,
          businessName: c.businessName || 'Not Provided',
          phone: c.mobile || 'Not Provided',
          email: c.email || 'Not Provided',
          address: c.address || 'Not Provided',
          status: c.status || 'Active',
          packageOrService: c.packageDetails?.customName || 'Quick Service Work',
          packageAmount: c.packageDetails?.price || 0,
          paidAmount: c.revenue || 0,
          pendingAmount: c.pendingAmount || 0,
          startDate: c.startDate || 'Not Provided',
          expiryDate: c.expiryDate || 'Not Provided',
          followUpDate: 'Not Provided',
          notes: c.notes || 'No notes',
          updatedAt: c.createdAt || 'Not Provided',
          originalRecord: c,
        });
      }

      // Add payments associated with this client
      if (c.payments && c.payments.length > 0) {
        c.payments.forEach(p => {
          list.push({
            id: `Payment_${p.id}`,
            recordId: p.id,
            recordType: 'Payment',
            name: `${c.name} (Payment)`,
            businessName: c.businessName || 'Not Provided',
            phone: c.mobile || 'Not Provided',
            email: c.email || 'Not Provided',
            address: c.address || 'Not Provided',
            status: p.type || 'Payment',
            packageOrService: `Payment via ${p.mode || 'UPI'}`,
            packageAmount: p.amount || 0,
            paidAmount: p.amount || 0,
            pendingAmount: 0,
            startDate: p.date || 'Not Provided',
            expiryDate: 'Not Provided',
            followUpDate: 'Not Provided',
            notes: p.notes || `Payment of ₹${p.amount}`,
            updatedAt: p.date || 'Not Provided',
            originalRecord: { payment: p, client: c },
          });
        });
      }
    });

    return list;
  }, [clients, leads]);

  // FILTERED PARI DATA CENTER RECORDS
  const filteredPariDataRecords = useMemo(() => {
    return pariDataRecords.filter(r => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesBusiness = r.businessName.toLowerCase().includes(query);
        if (!matchesName && !matchesBusiness) return false;
      }

      // 2. Type filter
      if (selectedRecordTypeFilter !== 'All' && r.recordType !== selectedRecordTypeFilter) {
        return false;
      }

      // 3. Status filter
      if (selectedStatusFilter !== 'All') {
        const statusDoc = pariDataCenterStatuses[r.id];
        const isVerified = statusDoc?.verified === true;
        const isSent = statusDoc?.sentToTelegram === true;
        const currentContent = serializeRecord(r.originalRecord, r.recordType);
        const isUpdated = isSent && statusDoc?.lastPushedContent !== currentContent;

        if (selectedStatusFilter === 'Needs Verification' && isVerified) return false;
        if (selectedStatusFilter === 'Not Sent' && (!isVerified || isSent)) return false;
        if (selectedStatusFilter === 'Sent' && (!isVerified || !isSent || isUpdated)) return false;
        if (selectedStatusFilter === 'Updated' && (!isVerified || !isSent || !isUpdated)) return false;
      }

      return true;
    });
  }, [pariDataRecords, pariDataCenterStatuses, searchTerm, selectedRecordTypeFilter, selectedStatusFilter]);

  // Handle Mark Verified/Unverified
  const handleVerifyPariRecord = async (recordId: string, verified: boolean) => {
    try {
      await setDoc(doc(db, 'pari_data_center', recordId), {
        verified,
        verifiedAt: verified ? new Date().toISOString() : null,
      }, { merge: true });
      showToast(verified ? "✅ Record verified!" : "⚠️ Record unverified.");
    } catch (err) {
      console.error("Error toggling verification:", err);
      showToast("❌ Failed to save verification.", "error");
    }
  };

  // Push single record
  const pushSingleRecord = async (record: any) => {
    setIsPushing(prev => ({ ...prev, [record.id]: true }));
    try {
      const statusDoc = pariDataCenterStatuses[record.id];
      const isVerified = statusDoc?.verified === true;
      const statusLabel = isVerified ? "Verified" : "Needs Verification";
      
      const message = formatPariTelegramMessage(record, statusLabel);
      await sendTelegramNotification(message, "custom");
      
      const currentContent = serializeRecord(record.originalRecord, record.recordType);
      await setDoc(doc(db, 'pari_data_center', record.id), {
        verified: true, // auto verify on successful manual single push
        verifiedAt: statusDoc?.verifiedAt || new Date().toISOString(),
        sentToTelegram: true,
        sentAt: new Date().toISOString(),
        lastPushedContent: currentContent
      }, { merge: true });

      showToast(`🎉 ${record.recordType} pushed to Telegram!`, "success");
    } catch (err: any) {
      console.error("Error pushing single record:", err);
      showToast(`❌ Failed: ${err.message || err}`, "error");
    } finally {
      setIsPushing(prev => ({ ...prev, [record.id]: false }));
    }
  };

  // Push bulk records
  const handleBulkPush = async (recordsToPush: any[]) => {
    if (recordsToPush.length === 0) {
      showToast("⚠️ No records to push matching the criteria.", "error");
      return;
    }

    setIsBulkPushing(true);
    let successCount = 0;
    let failCount = 0;

    for (const record of recordsToPush) {
      try {
        setIsPushing(prev => ({ ...prev, [record.id]: true }));
        const statusDoc = pariDataCenterStatuses[record.id];
        const currentContent = serializeRecord(record.originalRecord, record.recordType);
        const message = formatPariTelegramMessage(record, "Verified");

        await sendTelegramNotification(message, "custom");

        await setDoc(doc(db, 'pari_data_center', record.id), {
          verified: true,
          verifiedAt: statusDoc?.verifiedAt || new Date().toISOString(),
          sentToTelegram: true,
          sentAt: new Date().toISOString(),
          lastPushedContent: currentContent
        }, { merge: true });

        successCount++;
      } catch (err) {
        console.error(`Failed bulk push for ${record.id}:`, err);
        failCount++;
      } finally {
        setIsPushing(prev => ({ ...prev, [record.id]: false }));
      }
    }

    setIsBulkPushing(false);
    if (successCount > 0) {
      showToast(`🎉 Successfully pushed ${successCount} records to Telegram!`, "success");
    }
    if (failCount > 0) {
      showToast(`⚠️ Failed to push ${failCount} records.`, "error");
    }
  };

  // Filter activities to get New / Updated records (Data Alerts)
  const dataAlerts = useMemo(() => {
    return activities
      .filter(act => {
        const isImportant = [
          'client_added', 'client_updated', 
          'lead_added', 'lead_converted', 'lead_updated', 
          'payment_updated', 'task_added'
        ].includes(act.type);
        // Exclude system logs/brand/telegram settings updates to keep focused
        const isSystemSettings = act.description.includes('Telegram Bot settings') || act.description.includes('global agency brand assets');
        return isImportant && !isSystemSettings;
      })
      .map(act => {
        const isVerified = verifications[act.id]?.verified === true;
        return {
          ...act,
          isVerified
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, verifications]);

  // Unverified alerts count
  const unverifiedAlertsCount = useMemo(() => {
    return dataAlerts.filter(a => !a.isVerified).length;
  }, [dataAlerts]);

  // Handle Mark Data Updated (Verification alert)
  const handleVerifyData = async (activityId: string) => {
    try {
      await setDoc(doc(db, 'pari_verifications', activityId), {
        verified: true,
        verifiedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error saving data verification:', err);
    }
  };

  // Handle Open Linked Record from alert
  const handleOpenLinkedRecord = (act: Activity) => {
    if (act.clientId) {
      const client = clients.find(c => c.id === act.clientId);
      if (client) {
        setSelectedLinkedClient(client);
        return;
      }
    }
    
    // Fallback: search client by name in description
    const foundClient = clients.find(c => act.description.includes(c.name) || act.description.includes(c.businessName));
    if (foundClient) {
      setSelectedLinkedClient(foundClient);
      return;
    }

    // Try finding lead
    const foundLead = leads.find(l => act.description.includes(l.name) || act.description.includes(l.business));
    if (foundLead) {
      setSelectedLinkedLead(foundLead);
      return;
    }
  };

  // PARI'S OWN ASSIGNED TASKS
  const pariTasks = useMemo(() => {
    return tasks.filter(t => t.assignedTo === 'Pari');
  }, [tasks]);

  // Filter tasks by Pari specific Categories
  const pariTasksCategorized = useMemo(() => {
    const categoriesMap: Record<string, Task[]> = {};
    PARI_TASK_CATEGORIES.forEach(cat => {
      categoriesMap[cat] = [];
    });
    categoriesMap['Other Pari Tasks'] = [];

    pariTasks.forEach(task => {
      // Check if title starts with the category prefix e.g. "Excel Updates: "
      const matchedCat = PARI_TASK_CATEGORIES.find(cat => task.title.startsWith(`${cat}:`) || task.notes?.includes(`Category: ${cat}`));
      if (matchedCat) {
        categoriesMap[matchedCat].push(task);
      } else {
        categoriesMap['Other Pari Tasks'].push(task);
      }
    });

    return categoriesMap;
  }, [pariTasks]);

  // Submit adding a Pari Task
  const handleAddPariTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const prefixedTitle = `${newTaskCategory}: ${newTaskTitle.trim()}`;
    const formattedNotes = `Category: ${newTaskCategory}\n\n${newTaskNotes.trim()}`;

    try {
      await addTask(
        prefixedTitle,
        newTaskDueDate,
        'Website', // Default type compatibility
        'Pending',
        undefined,
        undefined,
        formattedNotes,
        undefined,
        undefined,
        'Pari', // Assigned to Pari
        'Medium'
      );
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewTaskDueDate(todayStr);
      setShowAddTaskModal(false);
    } catch (err) {
      console.error('Error adding Pari task:', err);
    }
  };

  // TEAM WORK MONITORING STATS
  const teamMonitoringStats = useMemo(() => {
    const bhargavTasks = tasks.filter(t => t.assignedTo === 'Bhargav');
    const adhwaryuTasks = tasks.filter(t => t.assignedTo === 'Adhwaryu');

    const getStats = (teamTasks: Task[]) => {
      return {
        today: teamTasks.filter(t => t.dueDate === todayStr),
        tomorrow: teamTasks.filter(t => t.dueDate === tomorrowStr),
        pending: teamTasks.filter(t => t.status !== 'Completed'),
        overdue: teamTasks.filter(t => t.dueDate < todayStr && t.status !== 'Completed'),
        completedToday: teamTasks.filter(t => t.status === 'Completed' && t.dueDate === todayStr)
      };
    };

    return {
      Bhargav: getStats(bhargavTasks),
      Adhwaryu: getStats(adhwaryuTasks)
    };
  }, [tasks, todayStr, tomorrowStr]);

  // CLIENT MONITORING COMPUTED FIELDS
  const clientMonitoringData = useMemo(() => {
    return clients.map(client => {
      const planner = client.contentPlanner || { days: {} };
      const days = planner.days || {};

      // Today's Planner activities
      const todayPlanner = days[todayStr]?.activities || [];
      // Tomorrow's Planner activities
      const tomorrowPlanner = days[tomorrowStr]?.activities || [];

      // Collect all planner activities
      let allActivities: any[] = [];
      Object.keys(days).forEach(date => {
        if (days[date]?.activities) {
          allActivities.push(...days[date].activities.map(act => ({ ...act, date })));
        }
      });

      const pendingPlanner = allActivities.filter(act => !['Completed', 'Posted', 'Approved'].includes(act.status));
      const completedPlanner = allActivities.filter(act => ['Completed', 'Posted', 'Approved'].includes(act.status));

      // Meetings
      const clientMeetings = followUps.filter(f => f.clientId === client.id && f.followUpType === 'Meeting' && f.status === 'Pending');
      // Follow-ups
      const clientFollowUps = followUps.filter(f => f.clientId === client.id && f.status === 'Pending');

      // Payment Recovery
      const paymentRecovery = {
        pendingAmount: client.pendingAmount || 0,
        status: client.paymentStatus,
        expiryDate: client.expiryDate
      };

      // Progress Calculation
      const totalCount = allActivities.length;
      const completedCount = completedPlanner.length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        client,
        todayPlanner,
        tomorrowPlanner,
        pendingPlanner,
        completedPlanner,
        clientMeetings,
        clientFollowUps,
        paymentRecovery,
        progressPercent
      };
    });
  }, [clients, followUps, todayStr, tomorrowStr]);

  // LEAD MONITORING DATA
  const leadMonitoringData = useMemo(() => {
    return leads.map(lead => {
      const timeline = lead.timeline || [];
      
      // Last Call
      const lastCallItem = [...timeline]
        .reverse()
        .find(t => t.action?.toLowerCase().includes('call') || t.notes?.toLowerCase().includes('call'));
      const lastCall = lastCallItem 
        ? `${lastCallItem.date} (${lastCallItem.notes || lastCallItem.action})` 
        : lead.lastContactDate ? `${lead.lastContactDate} (Contacted)` : 'No calls logged';

      // Last Follow-up
      const lastFollowUpItem = [...timeline]
        .reverse()
        .find(t => t.action?.toLowerCase().includes('follow') || t.notes?.toLowerCase().includes('follow'));
      const lastFollowUp = lastFollowUpItem 
        ? `${lastFollowUpItem.date} - ${lastFollowUpItem.notes || lastFollowUpItem.action}` 
        : 'No logged followups';

      // Last Reply
      const lastReplyItem = [...timeline]
        .reverse()
        .find(t => t.notes?.toLowerCase().includes('reply') || t.notes?.toLowerCase().includes('said') || t.notes?.toLowerCase().includes('responded') || t.notes?.toLowerCase().includes('interested'));
      const lastReply = lastReplyItem 
        ? `"${lastReplyItem.notes}"` 
        : lead.notes ? `"${lead.notes}"` : 'No replies logged';

      // Next Follow-up
      const nextFollowUp = lead.followUpDate || 'Not Scheduled';

      // Next Action
      const nextAction = lead.status === 'New' ? 'Initial Contact Call' 
        : lead.status === 'Contacted' ? 'Schedule discovery meeting'
        : lead.status === 'Meeting Scheduled' ? 'Conduct scheduled meeting'
        : lead.status === 'Meeting Done' ? 'Prepare and send custom quotation'
        : lead.status === 'Proposal / Quotation Sent' ? 'Follow up on proposal feedback'
        : lead.status === 'Interested' ? 'Negotiate package and terms'
        : lead.status === 'Payment Pending' ? 'Recover advance payment'
        : 'N/A';

      // Linked task assigned to
      const linkedTask = tasks.find(t => t.leadId === lead.id && !t.completed);
      const assignedTo = linkedTask?.assignedTo || lead.createdBy || 'Unassigned';

      return {
        lead,
        lastCall,
        lastFollowUp,
        lastReply,
        nextFollowUp,
        nextAction,
        assignedTo
      };
    });
  }, [leads, tasks]);

  // DAILY ASSISTANT VIEW (OVERVIEW METRICS)
  const overviewMetrics = useMemo(() => {
    // Today's agency tasks
    const bhargavToday = tasks.filter(t => t.assignedTo === 'Bhargav' && t.dueDate === todayStr);
    const adhwaryuToday = tasks.filter(t => t.assignedTo === 'Adhwaryu' && t.dueDate === todayStr);
    const pariToday = tasks.filter(t => t.assignedTo === 'Pari' && t.dueDate === todayStr);

    // Today's & Tomorrow's active planner clients
    const todayClients = clientMonitoringData.filter(c => c.todayPlanner.length > 0);
    const tomorrowClients = clientMonitoringData.filter(c => c.tomorrowPlanner.length > 0);

    // Package expiry
    const expiringSoon = clients.filter(c => {
      if (!c.expiryDate) return false;
      const diffTime = new Date(c.expiryDate).getTime() - new Date(todayStr).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 10;
    });

    const expired = clients.filter(c => c.expiryDate && c.expiryDate < todayStr);

    // Pending payments
    const pendingPayments = clients.filter(c => c.paymentStatus === 'Pending' && c.pendingAmount > 0);

    // Overdue Work
    const overdueTasks = tasks.filter(t => t.dueDate < todayStr && t.status !== 'Completed');

    // Needs attention
    const needsAttentionCount = unverifiedAlertsCount + overdueTasks.length + expiringSoon.length + pendingPayments.length;

    return {
      bhargavToday,
      adhwaryuToday,
      pariToday,
      todayClients,
      tomorrowClients,
      expiringSoon,
      expired,
      pendingPayments,
      overdueTasks,
      needsAttentionCount
    };
  }, [tasks, clients, clientMonitoringData, todayStr, unverifiedAlertsCount]);

  // REMINDER ACTIONS & SUBMIT
  const handleOpenReminderModal = (targetId: string, targetName: string, targetType: 'task' | 'client' | 'lead', assignedTo?: string) => {
    setActiveReminderTarget({ targetId, targetName, targetType, assignedTo });
    setReminderNote('');
  };

  const handleSaveReminderState = async (status: 'Reminder Given' | 'Reminder Pending' | 'Waiting Confirmation' | 'Work Verified') => {
    if (!activeReminderTarget) return;

    const reminderId = activeReminderTarget.targetId;
    const existingReminder = reminders.find(r => r.id === reminderId);
    const history = existingReminder?.history || [];

    const newHistoryItem = {
      status,
      timestamp: new Date().toISOString(),
      notes: reminderNote.trim()
    };

    const updatedReminder = {
      id: reminderId,
      targetId: activeReminderTarget.targetId,
      targetName: activeReminderTarget.targetName,
      targetType: activeReminderTarget.targetType,
      assignedTo: activeReminderTarget.assignedTo || 'Unassigned',
      status,
      lastUpdated: new Date().toISOString(),
      history: [...history, newHistoryItem]
    };

    try {
      await setDoc(doc(db, 'pari_reminders', reminderId), updatedReminder);
      
      // Post activity log
      await setDoc(doc(collection(db, 'activities')), {
        type: 'followup_updated',
        description: `Pari marked Reminder [${status}] for: ${activeReminderTarget.targetName} (${activeReminderTarget.targetType})`,
        timestamp: new Date().toISOString(),
        createdBy: 'pari'
      });

      setActiveReminderTarget(null);
      setReminderNote('');
    } catch (err) {
      console.error('Error saving reminder state:', err);
    }
  };

  // Search filter implementation
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clientMonitoringData;
    return clientMonitoringData.filter(item => 
      item.client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.client.businessName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clientMonitoringData, searchTerm]);

  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return leadMonitoringData;
    return leadMonitoringData.filter(item => 
      item.lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.lead.business.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leadMonitoringData, searchTerm]);

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER */}
      <div className="relative bg-gradient-to-r from-emerald-950 via-neutral-900 to-neutral-950 border border-emerald-500/20 rounded-2xl p-6 overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-radial-gradient from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Sparkles className="h-3 w-3 animate-pulse" /> Agency Owner Control
              </div>
              <span className="text-xs text-gray-500 font-mono font-bold">{formatDate(todayStr)}</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              👑 Pari's Assistant Control Center
            </h1>
            <p className="text-xs text-gray-400 max-w-xl">
              Monitor team activities, verify real-time client records, manage reminders, and maintain absolute quality assurance across all workspace operations.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Log Pari Task
            </button>
          </div>
        </div>
      </div>

      {/* DATA ALERTS PANEL */}
      {unverifiedAlertsCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#180d0d] border border-rose-950/40 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Bell className="h-4.5 w-4.5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                🔔 Data Verification Alerts ({unverifiedAlertsCount} Pending)
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                Pari, there are fresh activities or records awaiting your formal review. Click "Verify" to mark them audited.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full md:max-w-md">
            {dataAlerts.filter(a => !a.isVerified).slice(0, 1).map(alert => (
              <div key={alert.id} className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white max-w-[150px] truncate">
                  {alert.description}
                </span>
                <button
                  onClick={() => handleOpenLinkedRecord(alert)}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold rounded-lg text-gray-300 transition-colors cursor-pointer"
                >
                  Inspect
                </button>
                <button
                  onClick={() => handleVerifyData(alert.id)}
                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black text-[10px] font-black rounded-lg border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Verify
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* CORE CONTROL NAV TABS */}
      <div className="flex border-b border-emerald-900/10 pt-2 gap-1 overflow-x-auto shrink-0 scrollbar-none">
        {[
          { id: 'overview', label: '📱 Assistant Dashboard', count: null, color: 'border-emerald-500 text-emerald-400 bg-emerald-500/5' },
          { id: 'data-center', label: '📊 Pari Data Center', count: pariDataRecords.length, color: 'border-emerald-500 text-emerald-400 bg-emerald-500/5' },
          { id: 'my-tasks', label: '👑 Pari Tasks', count: pariTasks.filter(t => !t.completed).length, color: 'border-purple-500 text-purple-400 bg-purple-500/5' },
          { id: 'team', label: '👥 Team Monitoring', count: overviewMetrics.overdueTasks.length + overviewMetrics.bhargavToday.filter(t => !t.completed).length + overviewMetrics.adhwaryuToday.filter(t => !t.completed).length, color: 'border-blue-500 text-blue-400 bg-blue-500/5' },
          { id: 'clients', label: '💼 Client Control', count: clients.length, color: 'border-pink-500 text-pink-400 bg-pink-500/5' },
          { id: 'leads', label: '📢 Lead Pipeline', count: leads.length, color: 'border-amber-500 text-amber-400 bg-amber-500/5' },
          { id: 'reminders', label: '⏰ Live Reminder Logs', count: reminders.length, color: 'border-emerald-500 text-emerald-400 bg-emerald-500/5' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 border-b-2 text-xs font-bold cursor-pointer transition-all duration-200 shrink-0 flex items-center gap-2 ${
              activeTab === tab.id
                ? tab.color
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-slate-850'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 font-mono">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* SEARCH IF APPLICABLE */}
      {['clients', 'leads'].includes(activeTab) && (
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${activeTab === 'clients' ? 'clients' : 'leads'}...`}
            className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-xs"
          />
        </div>
      )}

      {/* RENDER CONTENT PANELS */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          
          {/* 1. OVERVIEW / ASSISTANT DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* METRICS CARD GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* CARD 1: TEAM TODAY */}
                <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-4 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Today's Agency Work</span>
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black mt-2">
                      {overviewMetrics.bhargavToday.length + overviewMetrics.adhwaryuToday.length + overviewMetrics.pariToday.length} Tasks
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Bhargav ({overviewMetrics.bhargavToday.length}) • Adhwaryu ({overviewMetrics.adhwaryuToday.length}) • Pari ({overviewMetrics.pariToday.length})
                    </p>
                  </div>
                </div>

                {/* CARD 2: TODAY'S CLIENTS */}
                <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-4 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Today's Clients</span>
                    <div className="h-7 w-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                      <Layers className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black mt-2">
                      {overviewMetrics.todayClients.length} Active Planners
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {overviewMetrics.tomorrowClients.length} Clients scheduled for tomorrow
                    </p>
                  </div>
                </div>

                {/* CARD 3: NEED ATTENTION */}
                <div className="bg-[#141414] border border-rose-950/40 rounded-2xl p-4 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-rose-400 font-black uppercase tracking-wider">Needs Attention</span>
                    <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-rose-400 mt-2">
                      {overviewMetrics.needsAttentionCount} Alerts
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {overviewMetrics.overdueTasks.length} Overdue Work • {overviewMetrics.expiringSoon.length} Expiries
                    </p>
                  </div>
                </div>

                {/* CARD 4: PENDING PAYMENTS */}
                <div className="bg-[#141414] border border-amber-950/40 rounded-2xl p-4 flex flex-col justify-between h-32">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">Pending Payments</span>
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-amber-400 mt-2">
                      {overviewMetrics.pendingPayments.length} Accounts
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Total pending: {formatCurrency(overviewMetrics.pendingPayments.reduce((sum, c) => sum + (c.pendingAmount || 0), 0))}
                    </p>
                  </div>
                </div>

              </div>

              {/* AGENCY SUMMARY SECTIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT 2 COLUMNS: DETAILED AGENCY DAILY TRACKER */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* OVERDUE WORK DETAILED ALERT */}
                  {overviewMetrics.overdueTasks.length > 0 && (
                    <div className="bg-rose-950/5 border border-rose-950/40 rounded-2xl p-4">
                      <h3 className="text-xs font-black text-rose-400 flex items-center gap-1.5 mb-3">
                        ⚠️ Overdue Deliverables Warning ({overviewMetrics.overdueTasks.length})
                      </h3>
                      <div className="space-y-2">
                        {overviewMetrics.overdueTasks.slice(0, 4).map(task => (
                          <div key={task.id} className="flex justify-between items-center text-xs bg-[#0d0d0d] p-3 rounded-xl border border-rose-950/10">
                            <div>
                              <p className="font-bold text-white">{task.title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Assigned: {task.assignedTo || 'Unassigned'} • Due: {formatDate(task.dueDate)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleOpenReminderModal(task.id, task.title, 'task', task.assignedTo)}
                              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black text-[10px] font-bold rounded-lg border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Bell className="h-3.5 w-3.5" /> Nudge Team
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* BHARGAV & ADHWARYU DAILY STATUS CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* BHARGAV MONITORING SUMMARY */}
                    <div className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎨</span>
                          <div>
                            <h3 className="text-sm font-black text-white">Bhargav Monitoring</h3>
                            <p className="text-[10px] text-emerald-400">Creative Head</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setActiveTab('team')}
                          className="text-[10px] font-bold text-gray-500 hover:text-emerald-400 flex items-center gap-1"
                        >
                          View All <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">
                          <p className="text-[9px] text-gray-500 font-bold uppercase">Today's Work</p>
                          <p className="text-base font-black text-white mt-1">
                            {teamMonitoringStats.Bhargav.today.filter(t => t.status === 'Completed').length}/{teamMonitoringStats.Bhargav.today.length} Done
                          </p>
                        </div>
                        <div className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">
                          <p className="text-[9px] text-gray-500 font-bold uppercase">Overdue</p>
                          <p className={`text-base font-black mt-1 ${teamMonitoringStats.Bhargav.overdue.length > 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                            {teamMonitoringStats.Bhargav.overdue.length} Tasks
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Today's Actions Queue:</p>
                        {teamMonitoringStats.Bhargav.today.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic">No tasks assigned for today.</p>
                        ) : (
                          teamMonitoringStats.Bhargav.today.map(t => (
                            <div key={t.id} className="flex items-center justify-between text-xs bg-[#0d0d0d] p-2.5 rounded-lg border border-slate-850">
                              <span className={`truncate max-w-[150px] ${t.status === 'Completed' ? 'line-through text-gray-500' : 'text-white'}`}>{t.title}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${t.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {t.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* ADHWARYU MONITORING SUMMARY */}
                    <div className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👤</span>
                          <div>
                            <h3 className="text-sm font-black text-white">Adhwaryu Monitoring</h3>
                            <p className="text-[10px] text-emerald-400">Client Handling & Operations</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setActiveTab('team')}
                          className="text-[10px] font-bold text-gray-500 hover:text-emerald-400 flex items-center gap-1"
                        >
                          View All <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">
                          <p className="text-[9px] text-gray-500 font-bold uppercase">Today's Work</p>
                          <p className="text-base font-black text-white mt-1">
                            {teamMonitoringStats.Adhwaryu.today.filter(t => t.status === 'Completed').length}/{teamMonitoringStats.Adhwaryu.today.length} Done
                          </p>
                        </div>
                        <div className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">
                          <p className="text-[9px] text-gray-500 font-bold uppercase">Overdue</p>
                          <p className={`text-base font-black mt-1 ${teamMonitoringStats.Adhwaryu.overdue.length > 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                            {teamMonitoringStats.Adhwaryu.overdue.length} Tasks
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Today's Actions Queue:</p>
                        {teamMonitoringStats.Adhwaryu.today.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic">No tasks assigned for today.</p>
                        ) : (
                          teamMonitoringStats.Adhwaryu.today.map(t => (
                            <div key={t.id} className="flex items-center justify-between text-xs bg-[#0d0d0d] p-2.5 rounded-lg border border-slate-850">
                              <span className={`truncate max-w-[150px] ${t.status === 'Completed' ? 'line-through text-gray-500' : 'text-white'}`}>{t.title}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${t.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {t.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>

                </div>

                {/* RIGHT COLUMN: PACKAGE EXPIRIES & RECOVERIES */}
                <div className="space-y-6">
                  
                  {/* EXPIRATIONS CARD */}
                  <div className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      ⚠️ Near Package Expiry ({overviewMetrics.expiringSoon.length + overviewMetrics.expired.length})
                    </h3>
                    
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
                      {overviewMetrics.expired.map(c => (
                        <div key={c.id} className="text-xs bg-[#0d0d0d] p-3 rounded-xl border border-rose-950/20 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-white">{c.name}</p>
                            <p className="text-[9px] text-rose-400 mt-0.5">Expired on {c.expiryDate}</p>
                          </div>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">EXPIRED</span>
                        </div>
                      ))}
                      {overviewMetrics.expiringSoon.map(c => (
                        <div key={c.id} className="text-xs bg-[#0d0d0d] p-3 rounded-xl border border-amber-950/20 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-white">{c.name}</p>
                            <p className="text-[9px] text-amber-400 mt-0.5">Expires soon: {c.expiryDate}</p>
                          </div>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">WARN</span>
                        </div>
                      ))}
                      {overviewMetrics.expiringSoon.length === 0 && overviewMetrics.expired.length === 0 && (
                        <p className="text-xs text-gray-500 italic">No package expirations recorded.</p>
                      )}
                    </div>
                  </div>

                  {/* PENDING RECOVERIES LIST */}
                  <div className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                      💰 Pending Payments Recovery
                    </h3>

                    <div className="space-y-2.5 max-h-[180px] overflow-y-auto">
                      {overviewMetrics.pendingPayments.map(c => (
                        <div key={c.id} className="text-xs bg-[#0d0d0d] p-3 rounded-xl border border-amber-950/20 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-white">{c.name}</p>
                            <p className="text-[9px] text-gray-500 mt-0.5">Business: {c.businessName}</p>
                          </div>
                          <p className="font-black text-amber-400">{formatCurrency(c.pendingAmount)}</p>
                        </div>
                      ))}
                      {overviewMetrics.pendingPayments.length === 0 && (
                        <p className="text-xs text-gray-500 italic">Excellent! No outstanding balances.</p>
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* PARI DATA CENTER MATRIX */}
          {activeTab === 'data-center' && (
            <div className="space-y-6">
              
              {/* TOP HEADER CONTROLS */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#141414] border border-emerald-950/40 rounded-2xl p-4">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    📊 Pari Data Verification & Sync Center
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Review live record updates, mark records as verified, and push them to the official Telegram group channel.
                  </p>
                </div>
                
                {/* BULK ACTIONS CONTAINER */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const selectedVerified = filteredPariDataRecords.filter(r => selectedRecordIds.includes(r.id) && pariDataCenterStatuses[r.id]?.verified === true);
                      if (selectedVerified.length === 0) {
                        showToast("⚠️ Select verified records first.", "error");
                        return;
                      }
                      handleBulkPush(selectedVerified);
                    }}
                    disabled={isBulkPushing}
                    className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    <Send className="h-3.5 w-3.5" /> Push Selected ({filteredPariDataRecords.filter(r => selectedRecordIds.includes(r.id) && pariDataCenterStatuses[r.id]?.verified === true).length})
                  </button>

                  <button
                    onClick={() => {
                      const newVerified = pariDataRecords.filter(r => {
                        const statusDoc = pariDataCenterStatuses[r.id];
                        return statusDoc?.verified === true && !statusDoc?.sentToTelegram;
                      });
                      handleBulkPush(newVerified);
                    }}
                    disabled={isBulkPushing}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    <Plus className="h-3.5 w-3.5" /> Push New ({pariDataRecords.filter(r => pariDataCenterStatuses[r.id]?.verified === true && !pariDataCenterStatuses[r.id]?.sentToTelegram).length})
                  </button>

                  <button
                    onClick={() => {
                      const updatedVerified = pariDataRecords.filter(r => {
                        const statusDoc = pariDataCenterStatuses[r.id];
                        if (statusDoc?.verified !== true || !statusDoc?.sentToTelegram) return false;
                        const currentContent = serializeRecord(r.originalRecord, r.recordType);
                        return statusDoc.lastPushedContent !== currentContent;
                      });
                      handleBulkPush(updatedVerified);
                    }}
                    disabled={isBulkPushing}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Push Updated ({
                      pariDataRecords.filter(r => {
                        const statusDoc = pariDataCenterStatuses[r.id];
                        if (statusDoc?.verified !== true || !statusDoc?.sentToTelegram) return false;
                        const currentContent = serializeRecord(r.originalRecord, r.recordType);
                        return statusDoc.lastPushedContent !== currentContent;
                      }).length
                    })
                  </button>

                  <button
                    onClick={() => {
                      const allVerified = pariDataRecords.filter(r => {
                        const statusDoc = pariDataCenterStatuses[r.id];
                        if (statusDoc?.verified !== true) return false;
                        if (!statusDoc?.sentToTelegram) return true;
                        const currentContent = serializeRecord(r.originalRecord, r.recordType);
                        return statusDoc.lastPushedContent !== currentContent;
                      });
                      handleBulkPush(allVerified);
                    }}
                    disabled={isBulkPushing}
                    className="px-3 py-2 bg-purple-500 hover:bg-purple-400 text-black text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Push All Verified ({
                      pariDataRecords.filter(r => {
                        const statusDoc = pariDataCenterStatuses[r.id];
                        if (statusDoc?.verified !== true) return false;
                        if (!statusDoc?.sentToTelegram) return true;
                        const currentContent = serializeRecord(r.originalRecord, r.recordType);
                        return statusDoc.lastPushedContent !== currentContent;
                      }).length
                    })
                  </button>
                </div>
              </div>

              {/* FILTERS PANEL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#141414] border border-emerald-950/40 rounded-2xl p-4">
                
                {/* SEARCH INPUT */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Search Records</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or business..."
                    className="w-full px-3 py-2 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none text-xs"
                  />
                </div>

                {/* RECORD TYPE FILTER */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Record Type</label>
                  <select
                    value={selectedRecordTypeFilter}
                    onChange={(e: any) => setSelectedRecordTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white focus:outline-none text-xs"
                  >
                    <option value="All">All Types</option>
                    <option value="Lead">Lead</option>
                    <option value="Client">Client</option>
                    <option value="Quick Service">Quick Service</option>
                    <option value="Payment">Payment</option>
                    <option value="Package">Package</option>
                  </select>
                </div>

                {/* TELEGRAM SENT STATUS FILTER */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Sync Status</label>
                  <select
                    value={selectedStatusFilter}
                    onChange={(e: any) => setSelectedStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-white focus:outline-none text-xs"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Needs Verification">Needs Verification</option>
                    <option value="Not Sent">Not Sent (Verified)</option>
                    <option value="Sent">Sent (Fully Synced)</option>
                    <option value="Updated">Updated (Pending Sync)</option>
                  </select>
                </div>

              </div>

              {/* DATA TABLE */}
              <div className="bg-[#141414] border border-emerald-950/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#0d0d0d] text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                        <th className="p-4 w-12 text-center">
                          <button
                            onClick={() => {
                              const allIds = filteredPariDataRecords.map(r => r.id);
                              const areAllSelected = allIds.length > 0 && allIds.every(id => selectedRecordIds.includes(id));
                              if (areAllSelected) {
                                setSelectedRecordIds(prev => prev.filter(id => !allIds.includes(id)));
                              } else {
                                setSelectedRecordIds(prev => Array.from(new Set([...prev, ...allIds])));
                              }
                            }}
                            className="focus:outline-none"
                          >
                            <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                              filteredPariDataRecords.length > 0 && filteredPariDataRecords.every(r => selectedRecordIds.includes(r.id))
                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                                : 'border-gray-600 hover:border-emerald-500'
                            }`}>
                              {filteredPariDataRecords.length > 0 && filteredPariDataRecords.every(r => selectedRecordIds.includes(r.id)) && (
                                <Check className="h-3 w-3 stroke-[3]" />
                              )}
                            </div>
                          </button>
                        </th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Record Name & Business</th>
                        <th className="p-4">Key Details</th>
                        <th className="p-4">Verification</th>
                        <th className="p-4">Telegram Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredPariDataRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                            No records found matching current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredPariDataRecords.map(r => {
                          const statusDoc = pariDataCenterStatuses[r.id];
                          const isVerified = statusDoc?.verified === true;
                          const isSent = statusDoc?.sentToTelegram === true;
                          const currentContent = serializeRecord(r.originalRecord, r.recordType);
                          const isUpdated = isSent && statusDoc?.lastPushedContent !== currentContent;
                          
                          const isRowSelected = selectedRecordIds.includes(r.id);

                          return (
                            <tr key={r.id} className={`hover:bg-white/[0.02] transition-colors ${isRowSelected ? 'bg-emerald-500/[0.01]' : ''}`}>
                              {/* CHECKBOX */}
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => {
                                    if (isRowSelected) {
                                      setSelectedRecordIds(prev => prev.filter(id => id !== r.id));
                                    } else {
                                      setSelectedRecordIds(prev => [...prev, r.id]);
                                    }
                                  }}
                                  className="focus:outline-none"
                                >
                                  <div className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                                    isRowSelected
                                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                                      : 'border-gray-600 hover:border-emerald-500'
                                  }`}>
                                    {isRowSelected && (
                                      <Check className="h-3 w-3 stroke-[3]" />
                                    )}
                                  </div>
                                </button>
                              </td>

                              {/* TYPE */}
                              <td className="p-4 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  r.recordType === 'Lead' ? 'bg-amber-500/10 text-amber-400' :
                                  r.recordType === 'Client' ? 'bg-pink-500/10 text-pink-400' :
                                  r.recordType === 'Quick Service' ? 'bg-emerald-500/10 text-emerald-400' :
                                  r.recordType === 'Payment' ? 'bg-blue-500/10 text-blue-400' :
                                  'bg-purple-500/10 text-purple-400'
                                }`}>
                                  {r.recordType}
                                </span>
                              </td>

                              {/* NAME & BUSINESS */}
                              <td className="p-4">
                                <div className="font-bold text-white text-xs">{r.name}</div>
                                <div className="text-[10px] text-gray-500 mt-0.5">{r.businessName}</div>
                              </td>

                              {/* KEY DETAILS */}
                              <td className="p-4 space-y-0.5">
                                <div className="text-gray-300 font-medium">
                                  {r.packageOrService !== 'Not Provided' && <span>{r.packageOrService} • </span>}
                                  <span className="text-white font-bold">₹{r.packageAmount}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 flex flex-wrap items-center gap-2">
                                  {r.paidAmount > 0 && <span className="text-emerald-500 font-semibold">Paid: ₹{r.paidAmount}</span>}
                                  {r.pendingAmount > 0 && <span className="text-rose-400 font-semibold">Pending: ₹{r.pendingAmount}</span>}
                                  {r.followUpDate !== 'Not Provided' && <span>Follow-up: {r.followUpDate}</span>}
                                  {r.startDate !== 'Not Provided' && <span>Start: {r.startDate}</span>}
                                </div>
                              </td>

                              {/* VERIFICATION */}
                              <td className="p-4">
                                <button
                                  onClick={() => handleVerifyPariRecord(r.id, !isVerified)}
                                  className={`px-2.5 py-1 text-[10px] font-black rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                    isVerified
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400'
                                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400'
                                  }`}
                                  title={isVerified ? "Click to unverify" : "Click to verify"}
                                >
                                  {isVerified ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                    </>
                                  ) : (
                                    <>
                                      <AlertCircle className="h-3.5 w-3.5" /> Needs Verification
                                    </>
                                  )}
                                </button>
                              </td>

                              {/* TELEGRAM STATUS */}
                              <td className="p-4">
                                <div className="flex flex-col gap-1">
                                  {!isVerified ? (
                                    <span className="text-[10px] font-black text-rose-400 flex items-center gap-1 bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10 w-fit">
                                      <AlertCircle className="h-3 w-3" /> Needs Verification
                                    </span>
                                  ) : !isSent ? (
                                    <span className="text-[10px] font-black text-gray-400 flex items-center gap-1 bg-white/5 px-2 py-1 rounded border border-white/10 w-fit">
                                      <Clock className="h-3 w-3" /> Not Sent
                                    </span>
                                  ) : isUpdated ? (
                                    <span className="text-[10px] font-black text-amber-400 flex items-center gap-1 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 w-fit" title="Click push again to sync the modified data">
                                      <RefreshCw className="h-3 w-3 animate-pulse" /> Updated – Push Again
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 w-fit">
                                      <Check className="h-3 w-3" /> Sent
                                    </span>
                                  )}
                                  {statusDoc?.sentAt && (
                                    <span className="text-[9px] text-gray-500 font-mono">
                                      Sent: {new Date(statusDoc.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* ACTIONS */}
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      if (r.recordType === 'Lead') {
                                        setSelectedLinkedLead(r.originalRecord);
                                      } else if (r.recordType === 'Client' || r.recordType === 'Quick Service' || r.recordType === 'Package') {
                                        setSelectedLinkedClient(r.originalRecord);
                                      } else if (r.recordType === 'Payment') {
                                        setSelectedLinkedClient(r.originalRecord.client);
                                      }
                                    }}
                                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-lg border border-white/5 transition-colors cursor-pointer"
                                    title="Inspect Record Details"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    onClick={() => pushSingleRecord(r)}
                                    disabled={isPushing[r.id]}
                                    className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                      isPushing[r.id]
                                        ? 'bg-neutral-800 border-white/10 text-gray-500'
                                        : isUpdated
                                        ? 'bg-amber-500/10 hover:bg-amber-500 border-amber-500/20 hover:border-amber-500 text-amber-400 hover:text-black font-black'
                                        : isSent
                                        ? 'bg-neutral-800 hover:bg-emerald-500/20 border-white/5 hover:border-emerald-500 text-gray-400 hover:text-emerald-400'
                                        : 'bg-emerald-500/10 hover:bg-emerald-500 border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-black font-black'
                                    }`}
                                    title="Push Single Record to Telegram"
                                  >
                                    <Send className="h-3 w-3" /> {isPushing[r.id] ? 'Pushing...' : isUpdated ? 'Push Update' : 'Push'}
                                  </button>
                                </div>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 2. PARI'S OWN TASKS VIEW */}
          {activeTab === 'my-tasks' && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center">
                <h2 className="text-base font-black text-white">👑 Pari's Workspace Assignments</h2>
                <button
                  onClick={() => setShowAddTaskModal(true)}
                  className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-400 text-black text-xs font-black rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> New Record Task
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {PARI_TASK_CATEGORIES.map(category => {
                  const items = pariTasksCategorized[category] || [];
                  return (
                    <div key={category} className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h3 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                          💼 {category}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-bold">
                          {items.length}
                        </span>
                      </div>

                      <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                        {items.length === 0 ? (
                          <p className="text-[11px] text-gray-500 italic py-2">No pending tasks recorded for this category.</p>
                        ) : (
                          items.map(task => (
                            <div key={task.id} className="bg-[#0d0d0d] border border-slate-850 p-3 rounded-xl space-y-2 hover:border-purple-500/20 transition-all">
                              <div className="flex items-start justify-between gap-1">
                                <span className={`text-xs font-bold leading-tight ${task.status === 'Completed' ? 'line-through text-gray-500' : 'text-white'}`}>
                                  {task.title.replace(`${category}: `, '')}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={task.status === 'Completed'}
                                  onChange={async () => {
                                    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
                                    await updateTask(task.id, { 
                                      status: nextStatus,
                                      completed: nextStatus === 'Completed'
                                    });
                                  }}
                                  className="h-4.5 w-4.5 rounded border-slate-800 text-purple-500 focus:ring-purple-500"
                                />
                              </div>
                              {task.notes && (
                                <p className="text-[10px] text-gray-500 italic bg-black/10 p-2 rounded truncate">
                                  {task.notes.replace(`Category: ${category}\n\n`, '')}
                                </p>
                              )}
                              <div className="flex justify-between items-center text-[9px] text-gray-500 border-t border-white/5 pt-2">
                                <span className="font-mono">Due: {formatDate(task.dueDate)}</span>
                                <button
                                  onClick={async () => {
                                    if (confirm('Delete task?')) {
                                      await deleteTask(task.id);
                                    }
                                  }}
                                  className="text-gray-600 hover:text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* 3. TEAM MONITORING PANEL */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* BHARGAV DETAILED PANEL */}
                <div className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 text-xl font-bold">🎨</div>
                      <div>
                        <h3 className="text-base font-black text-white">Bhargav Monitor</h3>
                        <p className="text-xs text-emerald-400">Creative Head & Art Director</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-[#0d0d0d] px-3 py-1.5 rounded-xl text-gray-400 font-mono">
                      Owner Mode
                    </span>
                  </div>

                  {/* STATS BREAKDOWN */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#0d0d0d] p-3 rounded-xl text-center border border-slate-850">
                      <p className="text-[9px] text-gray-500 font-bold uppercase">Pending</p>
                      <p className="text-base font-black text-amber-400 mt-1">{teamMonitoringStats.Bhargav.pending.length}</p>
                    </div>
                    <div className="bg-[#0d0d0d] p-3 rounded-xl text-center border border-slate-850">
                      <p className="text-[9px] text-gray-500 font-bold uppercase">Overdue</p>
                      <p className="text-base font-black text-rose-400 mt-1">{teamMonitoringStats.Bhargav.overdue.length}</p>
                    </div>
                    <div className="bg-[#0d0d0d] p-3 rounded-xl text-center border border-slate-850">
                      <p className="text-[9px] text-gray-500 font-bold uppercase">Done Today</p>
                      <p className="text-base font-black text-emerald-400 mt-1">{teamMonitoringStats.Bhargav.completedToday.length}</p>
                    </div>
                  </div>

                  {/* TODAY'S & TOMORROW'S DELIVERABLES */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">📅 Today's Tasks ({teamMonitoringStats.Bhargav.today.length})</h4>
                      {teamMonitoringStats.Bhargav.today.length === 0 ? (
                        <p className="text-xs text-gray-500 italic bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">No tasks listed for today.</p>
                      ) : (
                        teamMonitoringStats.Bhargav.today.map(task => (
                          <div key={task.id} className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-white">{task.title}</p>
                              <p className="text-[9px] text-gray-500 mt-0.5">Type: {task.type} • Status: {task.status}</p>
                            </div>
                            <button
                              onClick={() => handleOpenReminderModal(task.id, task.title, 'task', 'Bhargav')}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg transition-all border border-emerald-500/20"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">🔮 Tomorrow's Tasks ({teamMonitoringStats.Bhargav.tomorrow.length})</h4>
                      {teamMonitoringStats.Bhargav.tomorrow.length === 0 ? (
                        <p className="text-xs text-gray-500 italic bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">No tasks listed for tomorrow.</p>
                      ) : (
                        teamMonitoringStats.Bhargav.tomorrow.map(task => (
                          <div key={task.id} className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-white">{task.title}</p>
                              <p className="text-[9px] text-gray-500 mt-0.5">Type: {task.type} • Status: {task.status}</p>
                            </div>
                            <button
                              onClick={() => handleOpenReminderModal(task.id, task.title, 'task', 'Bhargav')}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg transition-all border border-emerald-500/20"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* ADHWARYU DETAILED PANEL */}
                <div className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 text-xl font-bold">👤</div>
                      <div>
                        <h3 className="text-base font-black text-white">Adhwaryu Monitor</h3>
                        <p className="text-xs text-emerald-400">Client Handling & Operations</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-[#0d0d0d] px-3 py-1.5 rounded-xl text-gray-400 font-mono">
                      Operations Mode
                    </span>
                  </div>

                  {/* STATS BREAKDOWN */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#0d0d0d] p-3 rounded-xl text-center border border-slate-850">
                      <p className="text-[9px] text-gray-500 font-bold uppercase">Pending</p>
                      <p className="text-base font-black text-amber-400 mt-1">{teamMonitoringStats.Adhwaryu.pending.length}</p>
                    </div>
                    <div className="bg-[#0d0d0d] p-3 rounded-xl text-center border border-slate-850">
                      <p className="text-[9px] text-gray-500 font-bold uppercase">Overdue</p>
                      <p className="text-base font-black text-rose-400 mt-1">{teamMonitoringStats.Adhwaryu.overdue.length}</p>
                    </div>
                    <div className="bg-[#0d0d0d] p-3 rounded-xl text-center border border-slate-850">
                      <p className="text-[9px] text-gray-500 font-bold uppercase">Done Today</p>
                      <p className="text-base font-black text-emerald-400 mt-1">{teamMonitoringStats.Adhwaryu.completedToday.length}</p>
                    </div>
                  </div>

                  {/* TODAY'S & TOMORROW'S DELIVERABLES */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">📅 Today's Tasks ({teamMonitoringStats.Adhwaryu.today.length})</h4>
                      {teamMonitoringStats.Adhwaryu.today.length === 0 ? (
                        <p className="text-xs text-gray-500 italic bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">No tasks listed for today.</p>
                      ) : (
                        teamMonitoringStats.Adhwaryu.today.map(task => (
                          <div key={task.id} className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-white">{task.title}</p>
                              <p className="text-[9px] text-gray-500 mt-0.5">Type: {task.type} • Status: {task.status}</p>
                            </div>
                            <button
                              onClick={() => handleOpenReminderModal(task.id, task.title, 'task', 'Adhwaryu')}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg transition-all border border-emerald-500/20"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">🔮 Tomorrow's Tasks ({teamMonitoringStats.Adhwaryu.tomorrow.length})</h4>
                      {teamMonitoringStats.Adhwaryu.tomorrow.length === 0 ? (
                        <p className="text-xs text-gray-500 italic bg-[#0d0d0d] p-3 rounded-xl border border-slate-850">No tasks listed for tomorrow.</p>
                      ) : (
                        teamMonitoringStats.Adhwaryu.tomorrow.map(task => (
                          <div key={task.id} className="bg-[#0d0d0d] p-3 rounded-xl border border-slate-850 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-white">{task.title}</p>
                              <p className="text-[9px] text-gray-500 mt-0.5">Type: {task.type} • Status: {task.status}</p>
                            </div>
                            <button
                              onClick={() => handleOpenReminderModal(task.id, task.title, 'task', 'Adhwaryu')}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg transition-all border border-emerald-500/20"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* 4. CLIENT CONTROL MATRIX */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center">
                <h2 className="text-base font-black text-white">💼 Live Client Account Management</h2>
                <span className="text-xs text-gray-500">Connected: {clients.length} accounts</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredClients.map(item => {
                  const hasPending = item.paymentRecovery.status === 'Pending';
                  const isExpired = item.client.status === 'Expired';
                  const todayCount = item.todayPlanner.length;
                  const tomorrowCount = item.tomorrowPlanner.length;

                  return (
                    <div key={item.client.id} className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-5 space-y-4 hover:border-emerald-500/10 transition-all">
                      
                      {/* CLIENT TOP ROW */}
                      <div className="flex items-start justify-between border-b border-white/5 pb-3">
                        <div className="space-y-0.5">
                          <h3 className="text-sm font-black text-white">{item.client.name}</h3>
                          <p className="text-[10px] text-emerald-400">{item.client.businessName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedClientForPlanner(item.client)}
                            className="px-2.5 py-1.5 bg-pink-500/10 hover:bg-pink-500 text-pink-400 hover:text-black text-[10px] font-black rounded-lg border border-pink-500/20 transition-all cursor-pointer flex items-center gap-1"
                            title="Open Content Planner"
                          >
                            <Calendar className="h-3 w-3" /> Planner
                          </button>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                            isExpired ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {item.client.status}
                          </span>
                        </div>
                      </div>

                      {/* DATA ROW GRID */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        
                        {/* PLANNER COUNT */}
                        <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-850">
                          <p className="text-[8px] text-gray-500 font-bold uppercase">Planner Today</p>
                          <p className="text-xs font-black text-white mt-1">
                            {todayCount} Active {todayCount > 0 ? '🔥' : '⏳'}
                          </p>
                        </div>

                        {/* PLANNER TOMORROW */}
                        <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-850">
                          <p className="text-[8px] text-gray-500 font-bold uppercase">Tomorrow</p>
                          <p className="text-xs font-black text-white mt-1">
                            {tomorrowCount} Activities
                          </p>
                        </div>

                        {/* OUTSTANDING PAYMENT */}
                        <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-850 col-span-2 md:col-span-1">
                          <p className="text-[8px] text-gray-500 font-bold uppercase">Recovery</p>
                          <p className={`text-xs font-black mt-1 ${hasPending ? 'text-amber-400' : 'text-gray-400'}`}>
                            {hasPending ? formatCurrency(item.paymentRecovery.pendingAmount) : 'Clear ✅'}
                          </p>
                        </div>

                        {/* ACTIVE MEETINGS */}
                        <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-850">
                          <p className="text-[8px] text-gray-500 font-bold uppercase">Meetings Today</p>
                          <p className="text-xs font-black text-white mt-1">
                            {item.clientMeetings.length} Scheduled
                          </p>
                        </div>

                        {/* OPEN FOLLOWUPS */}
                        <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-850">
                          <p className="text-[8px] text-gray-500 font-bold uppercase">Follow-ups</p>
                          <p className="text-xs font-black text-white mt-1">
                            {item.clientFollowUps.length} Pending
                          </p>
                        </div>

                        {/* EXPIRY DATE */}
                        <div className="bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-850 col-span-2 md:col-span-1">
                          <p className="text-[8px] text-gray-500 font-bold uppercase">Package End</p>
                          <p className="text-xs font-black text-white mt-1 truncate">
                            {item.client.expiryDate}
                          </p>
                        </div>

                      </div>

                      {/* CURRENT CONTENT PROGRESS */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-gray-500 font-bold uppercase">Activity Progress</span>
                          <span className="text-emerald-400 font-black">{item.progressPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#0d0d0d] rounded-full overflow-hidden border border-slate-850">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* 5. LEAD MONITORING PIPELINE */}
          {activeTab === 'leads' && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center">
                <h2 className="text-base font-black text-white">📢 Lead Acquisition & Follow-up Guard</h2>
                <span className="text-xs text-gray-500">Pipeline: {leads.length} active leads</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-emerald-900/5 bg-[#141414]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#0d0d0d] text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      <th className="p-4">Lead Name</th>
                      <th className="p-4">Current Status</th>
                      <th className="p-4">Last Contact Call</th>
                      <th className="p-4">Last Reply</th>
                      <th className="p-4">Next Follow-up</th>
                      <th className="p-4">Next Action</th>
                      <th className="p-4">Assigned To</th>
                      <th className="p-4">Nudge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                    {filteredLeads.map(item => (
                      <tr key={item.lead.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white">{item.lead.name}</p>
                          <p className="text-[10px] text-emerald-400 mt-0.5">{item.lead.business}</p>
                        </td>
                        <td className="p-4">
                          <span className="text-[9px] font-black px-2 py-1 bg-amber-500/10 text-amber-400 rounded">
                            {item.lead.status}
                          </span>
                        </td>
                        <td className="p-4 text-gray-400 truncate max-w-[150px]" title={item.lastCall}>
                          {item.lastCall}
                        </td>
                        <td className="p-4 italic text-gray-500 truncate max-w-[150px]" title={item.lastReply}>
                          {item.lastReply}
                        </td>
                        <td className="p-4 font-mono font-bold text-amber-400">
                          {item.nextFollowUp}
                        </td>
                        <td className="p-4 text-emerald-400">
                          {item.nextAction}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            {item.assignedTo}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleOpenReminderModal(item.lead.id, item.lead.name, 'lead', item.assignedTo)}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-lg border border-emerald-500/20 transition-all"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-500 italic">No leads found matching criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* 6. REMINDER HISTORY LOGS */}
          {activeTab === 'reminders' && (
            <div className="space-y-6">
              
              <div className="flex justify-between items-center">
                <h2 className="text-base font-black text-white">⏰ Centralized Live Reminder Logs & Work Auditing</h2>
                <span className="text-xs text-gray-500">Tracked: {reminders.length} reminder streams</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reminders.map(rem => (
                  <div key={rem.id} className="bg-[#141414] border border-emerald-900/5 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-start border-b border-white/5 pb-2">
                      <div>
                        <h3 className="text-xs font-black text-white truncate max-w-[150px]">{rem.targetName}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">Type: {rem.targetType} • Owner: {rem.assignedTo}</p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 rounded ${
                        rem.status === 'Work Verified' ? 'bg-emerald-500/10 text-emerald-400' :
                        rem.status === 'Waiting Confirmation' ? 'bg-purple-500/10 text-purple-400' :
                        rem.status === 'Reminder Pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {rem.status}
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reminder Log History:</p>
                      {rem.history?.map((hist: any, i: number) => (
                        <div key={i} className="bg-[#0d0d0d] p-2.5 rounded-xl border border-slate-850 space-y-1">
                          <div className="flex justify-between items-center text-[9px] font-bold text-gray-500">
                            <span>{new Date(hist.timestamp).toLocaleString()}</span>
                            <span className="text-emerald-400 font-bold">{hist.status}</span>
                          </div>
                          {hist.notes && (
                            <p className="text-[10px] text-gray-400 italic">"{hist.notes}"</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleOpenReminderModal(rem.targetId, rem.targetName, rem.targetType, rem.assignedTo)}
                        className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        Nudge / Update <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {reminders.length === 0 && (
                  <div className="lg:col-span-3 text-center p-12 bg-[#141414] border border-slate-850 rounded-2xl text-gray-500 italic">
                    No reminder logs found. Log a reminder to track history.
                  </div>
                )}
              </div>

            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* MODAL 1: INTERACTIVE CONTENT PLANNER FOR CLIENT */}
      <AnimatePresence>
        {selectedClientForPlanner && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0c0c0c] border border-emerald-900/20 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col"
            >
              <button
                onClick={() => setSelectedClientForPlanner(null)}
                className="absolute right-4 top-4 text-gray-500 hover:text-white p-1.5 bg-neutral-900 rounded-xl border border-slate-850 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              
              <div className="mb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-1.5">
                  📅 {selectedClientForPlanner.name}'s Interactive Content Planner
                </h2>
                <p className="text-xs text-emerald-400">{selectedClientForPlanner.businessName} • Client Accounts Dashboard</p>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 bg-[#060606] rounded-xl border border-slate-850 p-4">
                <ContentPlanner client={selectedClientForPlanner} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: PARI NUDGE / REMINDER LOGGING */}
      <AnimatePresence>
        {activeReminderTarget && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-emerald-950 rounded-2xl w-full max-w-md p-6 relative space-y-5"
            >
              <button
                onClick={() => setActiveReminderTarget(null)}
                className="absolute right-4 top-4 text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">⏰ Create/Update Reminder Log</h3>
                <p className="text-xs text-gray-400">
                  Target: {activeReminderTarget.targetName} ({activeReminderTarget.targetType})
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] text-gray-500 font-bold uppercase block">Notes / Follow-up Details</label>
                <textarea
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  placeholder="e.g. Bhargav verified he is editing the poster. Promised delivery in 1 hour."
                  className="w-full h-24 p-3 bg-[#0d0d0d] border border-slate-850 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-xs resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase block">Select State to Save Log</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSaveReminderState('Reminder Given')}
                    className="py-2.5 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-black text-[10px] font-black rounded-xl border border-blue-500/20 transition-all cursor-pointer"
                  >
                    🔔 Reminder Given
                  </button>
                  <button
                    onClick={() => handleSaveReminderState('Reminder Pending')}
                    className="py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black text-[10px] font-black rounded-xl border border-amber-500/20 transition-all cursor-pointer"
                  >
                    ⏳ Reminder Pending
                  </button>
                  <button
                    onClick={() => handleSaveReminderState('Waiting Confirmation')}
                    className="py-2.5 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-black text-[10px] font-black rounded-xl border border-purple-500/20 transition-all cursor-pointer"
                  >
                    💬 Waiting Confirmation
                  </button>
                  <button
                    onClick={() => handleSaveReminderState('Work Verified')}
                    className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black text-[10px] font-black rounded-xl border border-emerald-500/20 transition-all cursor-pointer"
                  >
                    ✅ Work Verified
                  </button>
                </div>
              </div>

              <p className="text-[9px] text-gray-500 italic text-center">
                Reminder status is saved independently. This will never complete the original task.
              </p>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: INSPECT DETAILED CLIENT FROM ALERT */}
      <AnimatePresence>
        {selectedLinkedClient && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-emerald-950 rounded-2xl w-full max-w-lg p-6 relative space-y-4"
            >
              <button
                onClick={() => setSelectedLinkedClient(null)}
                className="absolute right-4 top-4 text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-black text-white">💼 Client Details Inspector</h3>
                <p className="text-xs text-emerald-400">Verifying live CRM record status</p>
              </div>

              <div className="bg-[#0d0d0d] p-4 rounded-xl border border-slate-850 space-y-3 text-xs text-gray-300">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Client Name</p>
                    <p className="text-white font-bold">{selectedLinkedClient.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Business Name</p>
                    <p className="text-white font-bold">{selectedLinkedClient.businessName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">WhatsApp</p>
                    <p className="text-white font-mono">{selectedLinkedClient.whatsApp}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Email</p>
                    <p className="text-white font-mono truncate">{selectedLinkedClient.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Package Price</p>
                    <p className="text-white font-bold">{formatCurrency(selectedLinkedClient.packageDetails?.price || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Outstanding Balance</p>
                    <p className="text-amber-400 font-black">{formatCurrency(selectedLinkedClient.pendingAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Expiry Date</p>
                    <p className="text-white font-mono font-bold">{selectedLinkedClient.expiryDate}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Status</p>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-black">{selectedLinkedClient.status}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedLinkedClient(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: INSPECT DETAILED LEAD FROM ALERT */}
      <AnimatePresence>
        {selectedLinkedLead && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-emerald-950 rounded-2xl w-full max-w-lg p-6 relative space-y-4"
            >
              <button
                onClick={() => setSelectedLinkedLead(null)}
                className="absolute right-4 top-4 text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-black text-white">📢 Lead Details Inspector</h3>
                <p className="text-xs text-emerald-400">Verifying live Lead acquisition record</p>
              </div>

              <div className="bg-[#0d0d0d] p-4 rounded-xl border border-slate-850 space-y-3 text-xs text-gray-300">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Lead Name</p>
                    <p className="text-white font-bold">{selectedLinkedLead.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Business Name</p>
                    <p className="text-white font-bold">{selectedLinkedLead.business}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Mobile</p>
                    <p className="text-white font-mono">{selectedLinkedLead.mobile}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Lead Source</p>
                    <p className="text-white font-bold">{selectedLinkedLead.leadSource}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Follow-up Date</p>
                    <p className="text-amber-400 font-bold font-mono">{selectedLinkedLead.followUpDate}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-bold uppercase text-[9px]">Status</p>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-black">{selectedLinkedLead.status}</span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 font-bold uppercase text-[9px] mb-1">Notes</p>
                    <p className="text-gray-400 italic bg-[#060606] p-2.5 rounded leading-relaxed">
                      "{selectedLinkedLead.notes || 'No notes logged.'}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedLinkedLead(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: LOG PARI TASK MODAL */}
      <AnimatePresence>
        {showAddTaskModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-emerald-950 rounded-2xl w-full max-w-md p-6 relative space-y-4"
            >
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="absolute right-4 top-4 text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <h3 className="text-base font-black text-white">👑 Log New Pari Workspace Task</h3>
                <p className="text-xs text-gray-400">Assigned exclusively to Pari</p>
              </div>

              <form onSubmit={handleAddPariTaskSubmit} className="space-y-4 text-xs">
                
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-bold uppercase text-[10px]">Pari task Category</label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  >
                    {PARI_TASK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 font-bold uppercase text-[10px]">Task Title</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g. Verify weekly payment status sheets"
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 font-bold uppercase text-[10px]">Due Date</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-slate-850 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 font-bold uppercase text-[10px]">Optional Description</label>
                  <textarea
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                    placeholder="Additional details regarding the verification check..."
                    className="w-full h-20 p-3 bg-[#0d0d0d] border border-slate-850 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-black font-black rounded-xl transition-all shadow-lg cursor-pointer"
                >
                  Create Assignment
                </button>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PARI CUSTOM TOAST ALERT */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[110] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 ${
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
