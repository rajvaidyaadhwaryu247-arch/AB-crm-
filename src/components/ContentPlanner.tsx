import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { Client, ContentPlanner as IContentPlanner, DayPlan, DailyActivity, ActivityProof } from '../types';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Link as LinkIcon,
  Upload,
  Download,
  Save,
  CheckSquare,
  Square,
  AlertCircle,
  Clock,
  ArrowRight,
  Clipboard,
  FileText,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

// Constant list of activities requested by the user
const ACTIVITY_TYPES = [
  'Instagram Story',
  'Facebook Story',
  'WhatsApp Status',
  'Instagram Post',
  'Facebook Post',
  'Instagram Reel',
  'Facebook Reel',
  'YouTube Short',
  'Poster Design',
  'Carousel',
  'Graphic Design',
  'Content Shoot',
  'Video Editing',
  'Meta Ads',
  'Google Ads',
  'Meeting',
  'Phone Call',
  'Client Visit',
  'Festival Creative',
  'Custom Activity'
];

// Constant list of statuses requested by the user
const ACTIVITY_STATUSES = [
  'Planned',
  'In Progress',
  'Waiting For Client Approval',
  'Approved',
  'Posted',
  'Completed',
  'Cancelled'
] as const;

type ActivityStatus = typeof ACTIVITY_STATUSES[number];

interface ContentPlannerProps {
  client: Client;
}

export const ContentPlanner: React.FC<ContentPlannerProps> = ({ client }) => {
  const { updateClient, brandSettings, addTask, tasks, sendTelegramNotification } = useCRM();

  // Selected Date state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Calendar Navigation month/year state
  const [currentNavDate, setCurrentNavDate] = useState<Date>(() => {
    return new Date();
  });

  // State for adding a new activity
  const [newActivityType, setNewActivityType] = useState<string>(ACTIVITY_TYPES[0]);
  const [customActivityName, setCustomActivityName] = useState<string>('');
  
  // Active proof of work editor state
  const [activeProofActivityId, setActiveProofActivityId] = useState<string | null>(null);

  // Moving activity states
  const [movingActivityId, setMovingActivityId] = useState<string | null>(null);
  const [movingTargetDate, setMovingTargetDate] = useState<string>(selectedDate);

  // States for Plan Settings Panel
  const [planDuration, setPlanDuration] = useState<'7 Days' | '15 Days' | '30 Days' | 'Custom'>('30 Days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Local state helper for toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Safe accessor to client contentPlanner
  const planner: IContentPlanner = useMemo(() => {
    return client.contentPlanner || { days: {} };
  }, [client.contentPlanner]);

  const daysData = useMemo(() => {
    const rawDays = planner.days || {};
    const sanitizedDays: Record<string, DayPlan> = {};
    
    Object.keys(rawDays).forEach(dateKey => {
      const dayPlan = rawDays[dateKey];
      if (dayPlan && Array.isArray(dayPlan.activities)) {
        const uniqueActivities: DailyActivity[] = [];
        const seenIds = new Set<string>();
        dayPlan.activities.forEach(act => {
          if (act && act.id) {
            if (!seenIds.has(act.id)) {
              seenIds.add(act.id);
              uniqueActivities.push(act);
            }
          }
        });
        sanitizedDays[dateKey] = {
          ...dayPlan,
          activities: uniqueActivities
        };
      } else {
        sanitizedDays[dateKey] = dayPlan;
      }
    });
    
    return sanitizedDays;
  }, [planner.days]);

  // Helpers to get dates
  const todayStr = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Update Firestore helper
  const savePlanner = async (updatedPlanner: IContentPlanner) => {
    try {
      await updateClient(client.id, {
        contentPlanner: updatedPlanner
      });
    } catch (err: any) {
      console.error("Failed to save Content Planner data:", err);
      showToast("❌ Failed to save changes in cloud database.", "error");
    }
  };

  // Premium AI Strategy Parameters
  const [businessType, setBusinessType] = useState(client.businessName || '');
  const [packageNameState, setPackageNameState] = useState(client.packageDetails?.customName || client.packageDetails?.type || 'Custom');
  const [campaignGoal, setCampaignGoal] = useState('Brand Awareness & Customer Acquisition');
  const [campaignBudget, setCampaignBudget] = useState(client.packageDetails?.price ? `₹${client.packageDetails.price}` : 'Standard');
  const [campaignSeason, setCampaignSeason] = useState('Normal Season');
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync inputs with active client
  useEffect(() => {
    if (client) {
      setBusinessType(client.businessName || '');
      setPackageNameState(client.packageDetails?.customName || client.packageDetails?.type || 'Custom');
      setCampaignGoal('Brand Awareness & Customer Acquisition');
      setCampaignBudget(client.packageDetails?.price ? `₹${client.packageDetails.price}` : 'Standard');
      setCampaignSeason('Normal Season');
    }
  }, [client.id]);

  // Check and automatically mark past incomplete deliverables as "Overdue"
  const checkAndMarkOverdue = async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    let hasChanges = false;
    const updatedDays = { ...daysData };

    Object.keys(updatedDays).forEach(dateKey => {
      if (dateKey < todayStr) {
        const dayPlan = updatedDays[dateKey];
        if (dayPlan && Array.isArray(dayPlan.activities)) {
          const updatedActivities = dayPlan.activities.map(act => {
            if (act.status === 'Planned' || act.status === 'In Progress') {
              hasChanges = true;
              return { ...act, status: 'Overdue' as any };
            }
            return act;
          });
          if (hasChanges) {
            updatedDays[dateKey] = {
              ...dayPlan,
              activities: updatedActivities
            };
          }
        }
      }
    });

    if (hasChanges) {
      const updated = {
        ...planner,
        days: updatedDays
      };
      await savePlanner(updated);
      showToast("⏰ Automatically marked past pending items as Overdue.", "success");
    }
  };

  // Run overdue scan whenever client or planner changes
  useEffect(() => {
    if (Object.keys(daysData).length > 0) {
      checkAndMarkOverdue();
    }
  }, [client.id, Object.keys(daysData).length]);

  // Set package duration and bounds
  const handleSavePlanSettings = async () => {
    let start = todayStr;
    let end = todayStr;

    if (planDuration === '7 Days') {
      const d = new Date();
      d.setDate(d.getDate() + 6);
      end = d.toISOString().split('T')[0];
    } else if (planDuration === '15 Days') {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      end = d.toISOString().split('T')[0];
    } else if (planDuration === '30 Days') {
      const d = new Date();
      d.setDate(d.getDate() + 29);
      end = d.toISOString().split('T')[0];
    } else {
      if (!customStartDate || !customEndDate) {
        showToast("❌ Please specify start and end dates.", "error");
        return;
      }
      start = customStartDate;
      end = customEndDate;
    }

    const updated: IContentPlanner = {
      ...planner,
      planType: planDuration,
      startDate: start,
      endDate: end
    };

    await savePlanner(updated);
    showToast(`📅 Content plan set for ${planDuration}!`, "success");
  };

  // Generate Premium AI Agency Plan Template
  const handleGenerateTemplate = async () => {
    setIsGenerating(true);
    let start = planner.startDate || todayStr;
    let end = planner.endDate || todayStr;

    if (!planner.startDate || !planner.endDate) {
      // Auto fallback to 30 days if not setup
      const d = new Date();
      d.setDate(d.getDate() + 29);
      end = d.toISOString().split('T')[0];
    }

    const startD = new Date(start);
    const endD = new Date(end);
    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const datesList: string[] = [];
    for (let i = 0; i < diffDays; i++) {
      const currentD = new Date(startD);
      currentD.setDate(startD.getDate() + i);
      datesList.push(currentD.toISOString().split('T')[0]);
    }

    try {
      const response = await fetch('/api/gemini/generate-planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessType,
          packageName: packageNameState,
          goal: campaignGoal,
          budget: campaignBudget,
          startDate: start,
          endDate: end,
          datesList,
          season: campaignSeason
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to generate plan via AI engine');
      }

      const aiData = json.data;
      const generatedDaysList = aiData.days || [];
      const newDays: Record<string, DayPlan> = { ...daysData };

      generatedDaysList.forEach((aiDay: any) => {
        const dateStr = aiDay.date;
        const existingDay = daysData[dateStr];
        const existingActivities = existingDay?.activities || [];

        // Preserve any completed or approved activities
        const completedActivities = existingActivities.filter(a => 
          a.status === 'Completed' || a.status === 'Posted' || a.status === 'Approved' || a.status === 'Waiting For Client Approval'
        );

        // Map the new AI generated activities
        const newActivities = (aiDay.activities || []).map((aiAct: any, idx: number) => ({
          id: aiAct.id || `act-ai-${dateStr}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          type: aiAct.type,
          customTypeName: aiAct.customTypeName,
          notes: aiAct.notes || '',
          status: 'Planned' as const
        }));

        // Merge: keep all completed ones, and append new ones if they don't have duplicates
        const mergedActivities = [...completedActivities];
        newActivities.forEach((act: any) => {
          if (!mergedActivities.some(m => m.type === act.type)) {
            mergedActivities.push(act);
          }
        });

        newDays[dateStr] = {
          date: dateStr,
          activities: mergedActivities,
          internalNotes: aiDay.internalNotes || existingDay?.internalNotes || '',
          clientNotes: aiDay.clientNotes || existingDay?.clientNotes || ''
        };
      });

      // Synchronize with Tasks workspace - Create operational deliverables tasks assigned to team members
      const aiTasks = aiData.tasks || [];
      for (const t of aiTasks) {
        // Prevent duplicate task creation for this client
        const isDuplicate = tasks.some(existing => 
          existing.clientId === client.id && 
          existing.title.toLowerCase() === t.title.toLowerCase() && 
          existing.dueDate === t.dueDate
        );

        if (!isDuplicate) {
          await addTask(
            t.title,
            t.dueDate,
            t.type || 'Poster',
            'Pending',
            client.id,
            client.name,
            t.notes,
            undefined,
            undefined,
            undefined, // AI must NEVER assign team members, let owner assign!
            t.priority || 'Medium',
            t.plannerActivityId || `task-ai-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
          );
        }
      }

      // Save content planner along with strategic visual parameters in the database
      const updated: IContentPlanner = {
        ...planner,
        planType: planDuration,
        startDate: start,
        endDate: end,
        days: newDays,
        aiStrategy: {
          strategyTitle: aiData.strategyTitle || `${businessType} Campaign Strategy`,
          highLevelStrategy: aiData.highLevelStrategy || 'AI Strategized Campaign Planner',
          keyMetrics: aiData.keyMetrics || 'KPIs: Followers Growth, Lead Conversions',
          weeklyThemes: aiData.weeklyThemes || []
        } as any
      };

      await savePlanner(updated);
      showToast("⚡ Premium AI Campaign Strategy & Daily Calendar compiled successfully!", "success");
    } catch (err: any) {
      console.error("Gemini Premium Planner compilation failure:", err);
      showToast(`❌ AI Generation Error: ${err.message || 'Connection lost'}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Add a single custom activity
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const typeLabel = newActivityType === 'Custom Activity' ? (customActivityName.trim() || 'Custom Activity') : newActivityType;
    
    const newAct: DailyActivity = {
      id: `act-${Date.now()}`,
      type: newActivityType,
      customTypeName: newActivityType === 'Custom Activity' ? customActivityName.trim() : undefined,
      status: 'Planned'
    };

    const currentDayPlan = daysData[selectedDate] || { date: selectedDate, activities: [] };
    const updatedActivities = [...(currentDayPlan.activities || []), newAct];

    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentDayPlan,
        activities: updatedActivities
      }
    };

    await savePlanner({
      ...planner,
      days: updatedDays
    });

    setCustomActivityName('');
    showToast("✅ Activity added to planner!", "success");
  };

  // Delete a single activity
  const handleDeleteActivity = async (activityId: string) => {
    const currentDayPlan = daysData[selectedDate];
    if (!currentDayPlan) return;

    const updatedActivities = currentDayPlan.activities.filter(a => a.id !== activityId);
    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentDayPlan,
        activities: updatedActivities
      }
    };

    await savePlanner({
      ...planner,
      days: updatedDays
    });

    showToast("🗑️ Activity removed from planner.", "success");
  };

  // Change activity status
  const handleStatusChange = async (activityId: string, status: ActivityStatus) => {
    const currentDayPlan = daysData[selectedDate];
    if (!currentDayPlan) return;

    const updatedActivities = currentDayPlan.activities.map(a => {
      if (a.id === activityId) {
        return { ...a, status };
      }
      return a;
    });

    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentDayPlan,
        activities: updatedActivities
      }
    };

    await savePlanner({
      ...planner,
      days: updatedDays
    });

    showToast(`Status updated to ${status}!`, "success");
  };

  // Fast Toggle: Complete Activity (✓ Mark Completed)
  const handleToggleComplete = async (activityId: string) => {
    const currentDayPlan = daysData[selectedDate];
    if (!currentDayPlan) return;

    const updatedActivities = currentDayPlan.activities.map(a => {
      if (a.id === activityId) {
        const isCompleted = a.status === 'Completed';
        return { ...a, status: (isCompleted ? 'Planned' : 'Completed') as ActivityStatus };
      }
      return a;
    });

    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentDayPlan,
        activities: updatedActivities
      }
    };

    await savePlanner({
      ...planner,
      days: updatedDays
    });

    showToast("Status synchronized successfully!", "success");
  };

  // Move activity to a different date
  const handleMoveActivity = async (activityId: string, fromDate: string, toDate: string) => {
    if (!fromDate || !toDate || fromDate === toDate) {
      showToast("⚠️ Target date must be different.", "error");
      return;
    }

    const sourceDayPlan = daysData[fromDate];
    if (!sourceDayPlan) return;

    const matchedActivity = sourceDayPlan.activities.find(a => a.id === activityId);
    if (!matchedActivity) return;

    // Remove from source date
    const updatedSourceActivities = sourceDayPlan.activities.filter(a => a.id !== activityId);
    
    // Add to target date
    const targetDayPlan = daysData[toDate] || { date: toDate, activities: [] };
    const updatedTargetActivities = [...(targetDayPlan.activities || []), matchedActivity];

    const updatedDays = {
      ...daysData,
      [fromDate]: {
        ...sourceDayPlan,
        activities: updatedSourceActivities
      },
      [toDate]: {
        ...targetDayPlan,
        activities: updatedTargetActivities
      }
    };

    await savePlanner({
      ...planner,
      days: updatedDays
    });

    setMovingActivityId(null);
    showToast(`✈️ Moved deliverable to ${new Date(toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}!`, "success");
  };

  // Save Notes (Internal / Client)
  const handleSaveNotes = async (type: 'internal' | 'client', val: string) => {
    const currentDayPlan = daysData[selectedDate] || { date: selectedDate, activities: [] };
    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentDayPlan,
        [type === 'internal' ? 'internalNotes' : 'clientNotes']: val
      }
    };

    await savePlanner({
      ...planner,
      days: updatedDays
    });
  };

  // Update Activity Proof of Work fields
  const handleUpdateProof = async (activityId: string, proof: Partial<ActivityProof>) => {
    const currentDayPlan = daysData[selectedDate];
    if (!currentDayPlan) return;

    const updatedActivities = currentDayPlan.activities.map(a => {
      if (a.id === activityId) {
        return {
          ...a,
          proof: {
            ...(a.proof || {}),
            ...proof
          }
        };
      }
      return a;
    });

    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentDayPlan,
        activities: updatedActivities
      }
    };

    await savePlanner({
      ...planner,
      days: updatedDays
    });
  };

  // Convert image upload to Base64 for Screenshot Proof of Work
  const handleScreenshotUpload = (file: File, activityId: string) => {
    if (!file.type.startsWith('image/')) {
      showToast("❌ Only image files are supported as screenshots.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      handleUpdateProof(activityId, { screenshot: base64 });
      showToast("📸 Screenshot attached successfully!", "success");
    };
    reader.readAsDataURL(file);
  };

  // File drag & drop handlers
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActiveId(id);
    } else if (e.type === 'dragleave') {
      setDragActiveId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveId(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleScreenshotUpload(e.dataTransfer.files[0], id);
    }
  };

  // Copy Features implementation
  const handleCopyYesterday = async () => {
    const targetDate = new Date(selectedDate);
    targetDate.setDate(targetDate.getDate() - 1);
    const prevDateStr = targetDate.toISOString().split('T')[0];

    const prevPlan = daysData[prevDateStr];
    if (!prevPlan || !prevPlan.activities || prevPlan.activities.length === 0) {
      showToast("⚠️ Yesterday has no activities to copy.", "error");
      return;
    }

    // Deep copy activities with new IDs
    const copiedActivities = prevPlan.activities.map(a => ({
      ...a,
      id: `act-copied-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: 'Planned' as ActivityStatus // resets status to planned when copying
    }));

    const currentPlan = daysData[selectedDate] || ({ date: selectedDate, activities: [], internalNotes: '', clientNotes: '' } as DayPlan);
    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentPlan,
        activities: [...(currentPlan.activities || []), ...copiedActivities],
        internalNotes: currentPlan.internalNotes || prevPlan.internalNotes || '',
        clientNotes: currentPlan.clientNotes || prevPlan.clientNotes || ''
      }
    };

    await savePlanner({ ...planner, days: updatedDays });
    showToast("📋 Copied yesterday's activities to today!", "success");
  };

  const handleCopyLastWeek = async () => {
    const targetDate = new Date(selectedDate);
    targetDate.setDate(targetDate.getDate() - 7);
    const lastWeekDateStr = targetDate.toISOString().split('T')[0];

    const prevPlan = daysData[lastWeekDateStr];
    if (!prevPlan || !prevPlan.activities || prevPlan.activities.length === 0) {
      showToast("⚠️ Last week's weekday has no activities to copy.", "error");
      return;
    }

    const copiedActivities = prevPlan.activities.map(a => ({
      ...a,
      id: `act-copied-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: 'Planned' as ActivityStatus
    }));

    const currentPlan = daysData[selectedDate] || ({ date: selectedDate, activities: [], internalNotes: '', clientNotes: '' } as DayPlan);
    const updatedDays = {
      ...daysData,
      [selectedDate]: {
        ...currentPlan,
        activities: [...(currentPlan.activities || []), ...copiedActivities],
        internalNotes: currentPlan.internalNotes || prevPlan.internalNotes || '',
        clientNotes: currentPlan.clientNotes || prevPlan.clientNotes || ''
      }
    };

    await savePlanner({ ...planner, days: updatedDays });
    showToast("📋 Copied activities from 7 days ago to today!", "success");
  };

  const handleCopyEntireWeek = async () => {
    // Copy the preceding 7 days of activities to the next 7 days starting from selectedDate
    const updatedDays = { ...daysData };
    let copiedCount = 0;

    for (let i = 0; i < 7; i++) {
      // Source day is 7 days before the target day
      const targetDay = new Date(selectedDate);
      targetDay.setDate(targetDay.getDate() + i);
      const targetDateStr = targetDay.toISOString().split('T')[0];

      const sourceDay = new Date(selectedDate);
      sourceDay.setDate(sourceDay.getDate() - 7 + i);
      const sourceDateStr = sourceDay.toISOString().split('T')[0];

      const sourcePlan = daysData[sourceDateStr];
      if (sourcePlan && sourcePlan.activities && sourcePlan.activities.length > 0) {
        const copiedActivities = sourcePlan.activities.map(a => ({
          ...a,
          id: `act-copied-week-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          status: 'Planned' as ActivityStatus
        }));

        const targetPlan = updatedDays[targetDateStr] || { date: targetDateStr, activities: [] };
        updatedDays[targetDateStr] = {
          ...targetPlan,
          activities: [...(targetPlan.activities || []), ...copiedActivities],
          internalNotes: targetPlan.internalNotes || sourcePlan.internalNotes || '',
          clientNotes: targetPlan.clientNotes || sourcePlan.clientNotes || ''
        };
        copiedCount++;
      }
    }

    if (copiedCount === 0) {
      showToast("⚠️ The previous week has no content plans to copy.", "error");
      return;
    }

    await savePlanner({ ...planner, days: updatedDays });
    showToast("📋 Copied previous week's daily plans to this week!", "success");
  };

  const handleCopyEntireMonth = async () => {
    // Copy activities from previous 30 days into the upcoming 30 days starting from selectedDate
    const updatedDays = { ...daysData };
    let copiedCount = 0;

    for (let i = 0; i < 30; i++) {
      const targetDay = new Date(selectedDate);
      targetDay.setDate(targetDay.getDate() + i);
      const targetDateStr = targetDay.toISOString().split('T')[0];

      const sourceDay = new Date(selectedDate);
      sourceDay.setDate(sourceDay.getDate() - 30 + i);
      const sourceDateStr = sourceDay.toISOString().split('T')[0];

      const sourcePlan = daysData[sourceDateStr];
      if (sourcePlan && sourcePlan.activities && sourcePlan.activities.length > 0) {
        const copiedActivities = sourcePlan.activities.map(a => ({
          ...a,
          id: `act-copied-month-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          status: 'Planned' as ActivityStatus
        }));

        const targetPlan = updatedDays[targetDateStr] || { date: targetDateStr, activities: [] };
        updatedDays[targetDateStr] = {
          ...targetPlan,
          activities: [...(targetPlan.activities || []), ...copiedActivities],
          internalNotes: targetPlan.internalNotes || sourcePlan.internalNotes || '',
          clientNotes: targetPlan.clientNotes || sourcePlan.clientNotes || ''
        };
        copiedCount++;
      }
    }

    if (copiedCount === 0) {
      showToast("⚠️ The previous month (30 days) has no content plans to copy.", "error");
      return;
    }

    await savePlanner({ ...planner, days: updatedDays });
    showToast("📋 Copied preceding 30 days of daily plans to this month!", "success");
  };

  // Calendar render math
  const daysInMonth = useMemo(() => {
    const year = currentNavDate.getFullYear();
    const month = currentNavDate.getMonth();
    // First day of the month
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Total days in month
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Preceding month filler days
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      days.push({
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: true
      });
    }

    // Succeeding month filler days to complete calendar grid of 42 cells (6 rows of 7)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      days.push({
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentNavDate]);

  const handlePrevMonth = () => {
    setCurrentNavDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentNavDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  // Automatically calculate Monthly Summary
  const monthlySummary = useMemo(() => {
    const targetMonth = currentNavDate.getMonth();
    const targetYear = currentNavDate.getFullYear();

    const stats = {
      igStory: 0,
      fbStory: 0,
      waStatus: 0,
      igPost: 0,
      fbPost: 0,
      reel: 0,
      carousel: 0,
      design: 0,
      adsDays: 0,
      meetings: 0,
      calls: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      total: 0
    };

    Object.keys(daysData).forEach((dateKey) => {
      const d = new Date(dateKey);
      if (d.getMonth() === targetMonth && d.getFullYear() === targetYear) {
        const plan = daysData[dateKey];
        if (plan && plan.activities) {
          plan.activities.forEach((act) => {
            stats.total++;
            if (act.status === 'Completed' || act.status === 'Posted') {
              stats.completed++;
            } else if (act.status === 'Cancelled') {
              stats.cancelled++;
            } else {
              stats.pending++;
            }

            const lowerType = act.type.toLowerCase();
            if (lowerType.includes('story')) {
              if (lowerType.includes('instagram')) stats.igStory++;
              else if (lowerType.includes('facebook')) stats.fbStory++;
            } else if (lowerType.includes('status')) {
              stats.waStatus++;
            } else if (lowerType.includes('post')) {
              if (lowerType.includes('instagram')) stats.igPost++;
              else if (lowerType.includes('facebook')) stats.fbPost++;
            } else if (lowerType.includes('reel') || lowerType.includes('short')) {
              stats.reel++;
            } else if (lowerType.includes('carousel')) {
              stats.carousel++;
            } else if (lowerType.includes('design') || lowerType.includes('poster') || lowerType.includes('graphic')) {
              stats.design++;
            } else if (lowerType.includes('ads')) {
              stats.adsDays++;
            } else if (lowerType.includes('meeting') || lowerType.includes('visit')) {
              stats.meetings++;
            } else if (lowerType.includes('call') || lowerType.includes('phone')) {
              stats.calls++;
            }
          });
        }
      }
    });

    const completionRate = stats.total > 0 ? Math.round((stats.completed / (stats.total - stats.cancelled || 1)) * 100) : 0;

    return {
      ...stats,
      completionRate
    };
  }, [daysData, currentNavDate]);

  // Selected Day Plan Activities computed
  const selectedDayPlan = useMemo(() => {
    return daysData[selectedDate] || { date: selectedDate, activities: [], internalNotes: '', clientNotes: '' };
  }, [daysData, selectedDate]);

  const [pendingActivities, completedHistory] = useMemo(() => {
    const list = selectedDayPlan.activities || [];
    const pending = list.filter(a => a.status !== 'Completed');
    const completed = list.filter(a => a.status === 'Completed');
    return [pending, completed];
  }, [selectedDayPlan]);

  // Premium PDF Report Generation using jsPDF
  const handleGeneratePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const year = currentNavDate.getFullYear();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthLabel = `${monthNames[currentNavDate.getMonth()]} ${year}`;

    // A4 dimensions: 210mm x 297mm
    let y = 15;

    // Helper: draw professional header on each page
    const drawHeader = (pageNum: number) => {
      // Clean slate header bar
      doc.setFillColor(13, 148, 136); // emerald-600 color
      doc.rect(15, y, 180, 2, 'F');
      y += 6;

      // Brand Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(17, 24, 39); // deep charcoal
      doc.text('AB GRAPHICS CRM', 15, y);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128); // slate-500
      doc.text(`Page ${pageNum}`, 180, y);
      y += 5;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(13, 148, 136);
      doc.text('AGENCY CONTENT PLANNER & POW REPORT', 15, y);
      y += 8;

      // Metadata section grid
      doc.setDrawColor(229, 231, 235); // light gray
      doc.setLineWidth(0.2);
      doc.line(15, y, 195, y);
      y += 5;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text('Client Profile:', 15, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(client.name, 40, y);

      doc.setFont('Helvetica', 'bold');
      doc.text('Brand/Business:', 105, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(client.businessName, 135, y);
      y += 5;

      doc.setFont('Helvetica', 'bold');
      doc.text('Reporting Month:', 15, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(monthLabel, 45, y);

      doc.setFont('Helvetica', 'bold');
      doc.text('Package Scope:', 105, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(client.packageDetails?.type || client.packageDuration || 'Standard Planner', 135, y);
      y += 6;

      doc.line(15, y, 195, y);
      y += 8;
    };

    // PAGE 1: Intro & Monthly Summary Dashboard
    drawHeader(1);

    // Beautiful summary card box
    doc.setFillColor(249, 250, 251); // cool gray background
    doc.setDrawColor(229, 231, 235);
    doc.rect(15, y, 180, 50, 'FD');

    // Title of Dashboard
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text('MONTHLY DELIVERABLES METRICS SUMMARY', 20, y + 8);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);

    // Row 1 metrics
    doc.text(`Total Planned: ${monthlySummary.total}`, 20, y + 18);
    doc.text(`Completed Activities: ${monthlySummary.completed}`, 75, y + 18);
    doc.text(`Pending Activities: ${monthlySummary.pending}`, 135, y + 18);

    // Row 2 metrics
    doc.text(`Instagram Stories: ${monthlySummary.igStory}`, 20, y + 26);
    doc.text(`Facebook Stories: ${monthlySummary.fbStory}`, 75, y + 26);
    doc.text(`WhatsApp Statuses: ${monthlySummary.waStatus}`, 135, y + 26);

    // Row 3 metrics
    doc.text(`Instagram Posts: ${monthlySummary.igPost}`, 20, y + 34);
    doc.text(`Facebook Posts: ${monthlySummary.fbPost}`, 75, y + 34);
    doc.text(`Video Reels/Shorts: ${monthlySummary.reel}`, 135, y + 34);

    // Row 4 metrics
    doc.text(`Meta Campaign Ads: ${monthlySummary.adsDays} Days`, 20, y + 42);
    doc.text(`Meetings & Calls: ${monthlySummary.meetings + monthlySummary.calls}`, 75, y + 42);
    
    // Progress gauge right corner
    doc.setFillColor(13, 148, 136);
    doc.rect(135, y + 32, 50, 10, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`COMPLETION: ${monthlySummary.completionRate}%`, 139, y + 38);

    y += 62;

    // Table of Activities Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text('CHRONOLOGICAL DAY-WISE WORK REPORT', 15, y);
    y += 6;

    // Filter day-wise records for this month
    const activeDays = Object.keys(daysData)
      .filter(dateKey => {
        const d = new Date(dateKey);
        return d.getMonth() === currentNavDate.getMonth() && d.getFullYear() === currentNavDate.getFullYear();
      })
      .sort();

    // Table Column Headers
    doc.setFillColor(17, 24, 39); // dark header
    doc.rect(15, y, 180, 8, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('DATE', 18, y + 5);
    doc.text('ACTIVITY TYPE & FOCUS', 45, y + 5);
    doc.text('STATUS', 125, y + 5);
    doc.text('PROOF LINKS / NOTES', 150, y + 5);
    y += 8;

    let pageNum = 1;

    // Write rows
    if (activeDays.length === 0) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('No planned deliverables scheduled for this reporting month.', 20, y + 8);
    } else {
      activeDays.forEach((dateKey) => {
        const dayPlan = daysData[dateKey];
        if (!dayPlan || !dayPlan.activities || dayPlan.activities.length === 0) return;

        // Display Date row separator
        dayPlan.activities.forEach((act) => {
          // If page overflow, start new page
          if (y > 260) {
            pageNum++;
            doc.addPage();
            y = 15;
            drawHeader(pageNum);

            // Re-draw Table Headers
            doc.setFillColor(17, 24, 39);
            doc.rect(15, y, 180, 8, 'F');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text('DATE', 18, y + 5);
            doc.text('ACTIVITY TYPE & FOCUS', 45, y + 5);
            doc.text('STATUS', 125, y + 5);
            doc.text('PROOF LINKS / NOTES', 150, y + 5);
            y += 8;
          }

          // Format details
          const formattedDate = new Date(dateKey).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          const actType = act.type === 'Custom Activity' ? (act.customTypeName || 'Custom Deliverable') : act.type;
          
          let proofText = '';
          if (act.proof) {
            const links = [];
            if (act.proof.instagramLink) links.push('IG');
            if (act.proof.facebookLink) links.push('FB');
            if (act.proof.canvaLink) links.push('Canva');
            if (act.proof.googleDriveLink) links.push('GDrive');
            if (act.proof.screenshot) links.push('Img');
            proofText = links.length > 0 ? `Links: ${links.join(', ')}` : '';
          }
          if (act.notes) {
            proofText += (proofText ? ' | ' : '') + act.notes;
          }

          // Row style
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(243, 244, 246);
          doc.rect(15, y, 180, 7, 'FD');

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(55, 65, 81);
          doc.text(formattedDate, 18, y + 4.5);

          doc.setFont('Helvetica', 'normal');
          doc.text(actType, 45, y + 4.5);

          // Status Badge Highlight
          if (act.status === 'Completed' || act.status === 'Posted') {
            doc.setTextColor(13, 148, 136); // Emerald green
            doc.setFont('Helvetica', 'bold');
          } else if (act.status === 'Cancelled') {
            doc.setTextColor(156, 163, 175); // Slate light
          } else {
            doc.setTextColor(245, 158, 11); // Amber orange
          }
          doc.text(act.status, 125, y + 4.5);

          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(107, 114, 128);
          doc.setFontSize(7);
          const truncatedProof = proofText.length > 25 ? proofText.substring(0, 22) + '...' : proofText;
          doc.text(truncatedProof || 'None', 150, y + 4.5);

          y += 7;
        });
      });
    }

    // Page margin bottom spacing
    y += 10;
    if (y > 270) {
      doc.addPage();
      y = 25;
    }

    // Signatures / Footer line
    doc.setDrawColor(229, 231, 235);
    doc.line(15, 275, 195, 275);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text('Report Generated Automatically via AB Graphics CRM Platform.', 15, 280);
    doc.text('Official Brand Copy of AB Graphics CRM Inc.', 150, 280);

    // Save PDF file
    doc.save(`Deliverables_Report_${client.businessName.replace(/\s+/g, '_')}_${monthLabel}.pdf`);
    showToast("📄 Premium A4 PDF Report downloaded successfully!", "success");
  };

  // Quick stats computed for the selected single date
  const selectedDateStats = useMemo(() => {
    const total = selectedDayPlan.activities?.length || 0;
    const completed = selectedDayPlan.activities?.filter(a => a.status === 'Completed' || a.status === 'Posted').length || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }, [selectedDayPlan]);

  return (
    <div className="space-y-6">
      
      {/* HEADER BAR WITH TOAST */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-900/15 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-emerald-400" />
            📅 Brand Deliverables Content Planner
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Design content matrices, schedule campaigns, attach links, and build automated reports for {client.businessName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGeneratePDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" /> Download POW PDF Report
          </button>
        </div>
      </div>

      {/* TOAST ALERT BANNER */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* THREE PANELS LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: SETUP SCOPE & MONTHLY MATRIX (SPAN 7) */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. PLAN SETTINGS PANEL */}
          <div className="bg-[#0c0c0c] border border-slate-850 p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" /> Package Plan Setup Directive
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-500 text-[10px] uppercase font-bold block mb-1">Contract Scope Duration</label>
                <select
                  value={planDuration}
                  onChange={(e) => setPlanDuration(e.target.value as any)}
                  className="w-full bg-[#141414] border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                >
                  <option value="7 Days">7 Days Content Scope</option>
                  <option value="15 Days">15 Days Content Scope</option>
                  <option value="30 Days">30 Days Content Scope</option>
                  <option value="Custom">Custom Duration Range</option>
                </select>
              </div>

              {planDuration === 'Custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-500 text-[9px] uppercase font-bold block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-[#141414] border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-[9px] uppercase font-bold block mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-[#141414] border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Premium AI Planner Campaign Parameters */}
            <div className="border border-indigo-950/20 bg-[#0d0d0d]/80 p-4 rounded-xl space-y-3">
              <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Premium AI Agency Strategy Parameters
              </h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-500 text-[9px] uppercase font-bold block mb-0.5">Business Type / Niche</label>
                  <input
                    type="text"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    placeholder="e.g., Dental Clinic, Gym, Realtor"
                    className="w-full bg-[#141414] border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-[9px] uppercase font-bold block mb-0.5">Service Package</label>
                  <input
                    type="text"
                    value={packageNameState}
                    onChange={(e) => setPackageNameState(e.target.value)}
                    placeholder="e.g., Diamond Retainer"
                    className="w-full bg-[#141414] border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-[9px] uppercase font-bold block mb-0.5">Campaign Goal</label>
                  <input
                    type="text"
                    value={campaignGoal}
                    onChange={(e) => setCampaignGoal(e.target.value)}
                    placeholder="e.g., Increase walk-ins"
                    className="w-full bg-[#141414] border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-[9px] uppercase font-bold block mb-0.5">Budget Bracket</label>
                  <input
                    type="text"
                    value={campaignBudget}
                    onChange={(e) => setCampaignBudget(e.target.value)}
                    placeholder="e.g., ₹30,000 / month"
                    className="w-full bg-[#141414] border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-gray-500 text-[9px] uppercase font-bold block mb-0.5">Season / Occasion</label>
                  <select
                    value={campaignSeason}
                    onChange={(e) => setCampaignSeason(e.target.value)}
                    className="w-full bg-[#141414] border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none"
                  >
                    <option value="Normal Season">Normal Season / Ever-Green Content</option>
                    <option value="Festive Season (Diwali / New Year)">Festive Season (Diwali / New Year)</option>
                    <option value="Summer Campaign">Summer Campaign</option>
                    <option value="Monsoon / Autumn Launch">Monsoon / Autumn Launch</option>
                    <option value="Holiday / Gifting Season">Holiday / Gifting Season</option>
                    <option value="Off-Season Clearance / Promo">Off-Season Clearance / Promo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={handleSavePlanSettings}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" /> Save Plan Bounds
              </button>

              <button
                onClick={handleGenerateTemplate}
                disabled={isGenerating}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 border border-indigo-500/20 disabled:bg-indigo-950/20 disabled:text-indigo-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center gap-1.5"
                title="Generate premium marketing agency checklist using Gemini AI"
              >
                <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isGenerating ? 'animate-spin' : ''}`} /> {isGenerating ? 'AI Generating Planner...' : 'Generate Premium AI Plan'}
              </button>
            </div>
            
            <p className="text-[10px] text-gray-500 italic mt-1 leading-relaxed">
              * Click "Generate Premium AI Plan" to use Gemini to compile a unique, highly targeted monthly campaign strategy with coordinated social content themes and team operation assignments.
            </p>
          </div>

          {/* AI CAMPAIGN STRATEGY COMPILER PANEL */}
          {planner.aiStrategy && (
            <div className="bg-[#0c0c0c] border border-indigo-950/30 p-5 rounded-2xl space-y-4 shadow-lg shadow-indigo-500/2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> Premium AI Agency Strategy Directive
                </h4>
                <span className="text-[9px] font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase">
                  ACTIVE AI STRATEGY
                </span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Campaign Theme & Core Idea</span>
                  <h3 className="text-sm font-extrabold text-white tracking-tight mt-0.5">{planner.aiStrategy.strategyTitle}</h3>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">High-Level Campaign Strategy & Visual Tone</span>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed whitespace-pre-wrap">{planner.aiStrategy.highLevelStrategy}</p>
                </div>

                {planner.aiStrategy.weeklyThemes && planner.aiStrategy.weeklyThemes.length > 0 && (
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-500 block">Weekly Themes & Core Topics Flow</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {planner.aiStrategy.weeklyThemes.map((theme, tIdx) => (
                        <div key={tIdx} className="bg-[#141414]/60 border border-slate-850 p-2.5 rounded-xl text-xs">
                          <span className="text-[9px] font-bold text-emerald-400 uppercase block">Week {tIdx + 1}</span>
                          <p className="text-gray-300 mt-0.5 font-medium">{theme}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Strategic Key Performance Indicators (KPIs)</span>
                  <p className="text-xs text-indigo-300/90 mt-1 font-mono">{planner.aiStrategy.keyMetrics}</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. THE CALENDAR BOARD */}
          <div className="bg-[#0c0c0c] border border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4" /> Monthly Content Calendar Matrix
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                  Active range: {planner.startDate || 'Unset'} to {planner.endDate || 'Unset'}
                </p>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-2 bg-[#141414] px-3 py-1.5 border border-slate-800 rounded-xl">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-900 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-white uppercase min-w-[100px] text-center">
                  {currentNavDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-900 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Grid Header days of week */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-gray-500 font-bold uppercase text-[9px] tracking-wider py-1 border-b border-slate-850">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1.5">
              {daysInMonth.map(({ dateStr, dayNum, isCurrentMonth }) => {
                const dayData = daysData[dateStr];
                const totalActs = dayData?.activities?.length || 0;
                const completedActs = dayData?.activities?.filter(a => a.status === 'Completed' || a.status === 'Posted').length || 0;
                
                const isSelected = selectedDate === dateStr;
                const isToday = todayStr === dateStr;

                // Color rating
                let statusColor = 'text-gray-500';
                let statsBadge = null;

                if (totalActs > 0) {
                  const percent = Math.round((completedActs / totalActs) * 100);
                  if (completedActs === totalActs) {
                    statusColor = 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
                    statsBadge = (
                      <span className="text-[8px] font-bold text-emerald-400 flex items-center justify-center gap-0.5 mt-1 font-mono">
                        {completedActs}/{totalActs} ✅
                      </span>
                    );
                  } else if (completedActs > 0) {
                    statusColor = 'bg-amber-500/10 border border-amber-500/20 text-amber-400';
                    statsBadge = (
                      <span className="text-[8px] font-bold text-amber-400 block mt-1 font-mono">
                        {completedActs}/{totalActs}
                      </span>
                    );
                  } else {
                    statusColor = 'bg-rose-500/10 border border-rose-500/20 text-rose-400';
                    statsBadge = (
                      <span className="text-[8px] font-bold text-rose-400 block mt-1 font-mono">
                        {completedActs}/{totalActs}
                      </span>
                    );
                  }
                }

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-2.5 min-h-[60px] rounded-xl flex flex-col justify-between items-center cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500 border-2 border-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/10 scale-105'
                        : isToday
                        ? 'bg-[#181818] border border-sky-500/40 text-sky-400'
                        : isCurrentMonth
                        ? 'bg-[#141414] hover:bg-[#1c1c1c] text-white border border-slate-850'
                        : 'bg-[#0d0d0d] opacity-35 text-gray-600 border border-transparent'
                    }`}
                  >
                    <span className={`text-xs font-bold block ${isSelected ? 'text-slate-950' : ''}`}>
                      {dayNum}
                    </span>
                    {!isSelected && statsBadge}
                    {isSelected && totalActs > 0 && (
                      <span className="text-[8px] font-bold text-slate-950 mt-1 font-mono">
                        {completedActs}/{totalActs}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="flex flex-wrap gap-4 text-[10px] text-gray-500 justify-center pt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-500/25 border border-rose-500/40 rounded-full block"></span> Red: 0% Complete</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500/25 border border-amber-500/40 rounded-full block"></span> Yellow: In Progress</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/25 border border-emerald-500/40 rounded-full block"></span> Green: 100% Completed</span>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: SINGLE DAY ACTIVITES & NOTES PANEL (SPAN 5) */}
        <div className="lg:col-span-5 space-y-6">

          {/* 3. COPING UTILITIES CARDS */}
          <div className="bg-[#0c0c0c] border border-slate-850 p-4 rounded-2xl space-y-3">
            <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Fast Copy Diagnostics
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyYesterday}
                className="px-2.5 py-2 bg-[#141414] hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Clipboard className="h-3.5 w-3.5 text-gray-400" /> Copy Yesterday
              </button>
              <button
                onClick={handleCopyLastWeek}
                className="px-2.5 py-2 bg-[#141414] hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Clipboard className="h-3.5 w-3.5 text-gray-400" /> Copy Last Week
              </button>
              <button
                onClick={handleCopyEntireWeek}
                className="px-2.5 py-2 bg-[#141414] hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Clipboard className="h-3.5 w-3.5 text-gray-400" /> Copy Entire Week
              </button>
              <button
                onClick={handleCopyEntireMonth}
                className="px-2.5 py-2 bg-[#141414] hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Clipboard className="h-3.5 w-3.5 text-gray-400" /> Copy Entire Month
              </button>
            </div>
          </div>

          {/* 4. DAILY ACTIVITY CHECKLIST BOARD */}
          <div className="bg-[#0c0c0c] border border-slate-850 p-5 rounded-2xl space-y-4">
            <div className="border-b border-slate-850 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block font-mono">Active Day Planner</span>
                <span className="text-[10px] font-semibold font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <h4 className="text-sm font-black text-white">Daily Scope Deliverables</h4>
                <div className="text-xs text-gray-400 font-mono">
                  {selectedDateStats.completed}/{selectedDateStats.total} ({selectedDateStats.percentage}%)
                </div>
              </div>
            </div>

            {/* ADD INDIVIDUAL ACTIVITY FORM */}
            <form onSubmit={handleAddActivity} className="space-y-3 bg-[#141414] p-3.5 border border-slate-850 rounded-2xl">
              <div>
                <label className="text-gray-500 text-[9px] uppercase font-bold block mb-1">Add Deliverable / Event</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={newActivityType}
                    onChange={(e) => setNewActivityType(e.target.value)}
                    className="bg-[#0d0d0d] border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                  >
                    {ACTIVITY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  {newActivityType === 'Custom Activity' && (
                    <input
                      type="text"
                      placeholder="Type custom name..."
                      value={customActivityName}
                      onChange={(e) => setCustomActivityName(e.target.value)}
                      className="bg-[#0d0d0d] border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                    />
                  )}
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                <Plus className="h-4 w-4" /> Add Deliverable
              </button>
            </form>

            {/* DELIVERABLES LISTING */}
            <div className="space-y-3">
              
              {/* PENDING WORK BLOCK */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">📋 Pending Deliverables</span>
                {pendingActivities.length === 0 ? (
                  <p className="text-xs text-gray-600 italic py-2 pl-2">No pending deliverables scheduled for today.</p>
                ) : (
                  pendingActivities.map((act) => {
                    const actName = act.type === 'Custom Activity' ? (act.customTypeName || 'Custom Activity') : act.type;
                    const isProofActive = activeProofActivityId === act.id;

                    return (
                      <div key={act.id} className="bg-[#141414] border border-slate-850 p-3 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleToggleComplete(act.id)}
                            className="flex items-center gap-2.5 text-xs text-left font-semibold text-white hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <Square className="h-4 w-4 text-gray-600 shrink-0" />
                            <span>{actName}</span>
                          </button>
                          
                          <div className="flex items-center gap-1.5">
                            {/* Status Pill */}
                            <select
                              value={act.status}
                              onChange={(e) => handleStatusChange(act.id, e.target.value as any)}
                              className="bg-[#0d0d0d] border border-slate-800 text-gray-400 text-[10px] rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                            >
                              {ACTIVITY_STATUSES.map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleDeleteActivity(act.id)}
                              className="p-1 hover:bg-rose-950 text-gray-500 hover:text-rose-400 rounded cursor-pointer"
                              title="Delete activity"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMovingActivityId(movingActivityId === act.id ? null : act.id);
                                setMovingTargetDate(selectedDate);
                              }}
                              className={`p-1 rounded cursor-pointer transition-colors ${movingActivityId === act.id ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-gray-500 hover:text-white'}`}
                              title="Move deliverable to another date"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Move Activity inline panel */}
                        {movingActivityId === act.id && (
                          <div className="bg-[#0c0c0c] border border-slate-800 p-2.5 rounded-lg space-y-2 mt-1">
                            <span className="text-[9px] uppercase font-bold text-emerald-400 block font-mono">Move Deliverable to another Date</span>
                            <div className="flex gap-1.5">
                              <input
                                type="date"
                                value={movingTargetDate}
                                onChange={(e) => setMovingTargetDate(e.target.value)}
                                className="bg-[#141414] border border-slate-800 text-xs rounded px-2 py-1 text-white focus:outline-none flex-1 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => handleMoveActivity(act.id, selectedDate, movingTargetDate)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-2.5 py-1 rounded text-[10px] cursor-pointer font-sans"
                              >
                                Move
                              </button>
                              <button
                                type="button"
                                onClick={() => setMovingActivityId(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-gray-400 px-2 py-1 rounded text-[10px] cursor-pointer font-sans"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Expand Proof Section */}
                        <div className="pt-1.5 border-t border-slate-850 flex items-center justify-between text-[10px]">
                          <button
                            type="button"
                            onClick={() => setActiveProofActivityId(isProofActive ? null : act.id)}
                            className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ImageIcon className="h-3.5 w-3.5" /> Proof of Work & Links
                          </button>
                          <span className="text-[9px] text-gray-500 uppercase font-mono font-bold">
                            Status: {act.status}
                          </span>
                        </div>

                        {/* Proof of Work Editor Section */}
                        {isProofActive && (
                          <div className="bg-[#0d0d0d] border border-slate-850/60 p-3 rounded-lg space-y-3 mt-2 text-xs">
                            <h5 className="font-bold text-gray-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <LinkIcon className="h-3 w-3" /> Attach Deliverables Proof Links
                            </h5>
                            
                            <div className="space-y-2">
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 block">Instagram Link</label>
                                <input
                                  type="url"
                                  placeholder="https://instagram.com/..."
                                  value={act.proof?.instagramLink || ''}
                                  onChange={(e) => handleUpdateProof(act.id, { instagramLink: e.target.value })}
                                  className="w-full bg-[#141414] border border-slate-800 text-[11px] rounded px-2 py-1 focus:outline-none text-white mt-0.5"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 block">Canva Design Template Link</label>
                                <input
                                  type="url"
                                  placeholder="https://canva.com/..."
                                  value={act.proof?.canvaLink || ''}
                                  onChange={(e) => handleUpdateProof(act.id, { canvaLink: e.target.value })}
                                  className="w-full bg-[#141414] border border-slate-800 text-[11px] rounded px-2 py-1 focus:outline-none text-white mt-0.5"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 block">Google Drive Assets Link</label>
                                <input
                                  type="url"
                                  placeholder="https://drive.google.com/..."
                                  value={act.proof?.googleDriveLink || ''}
                                  onChange={(e) => handleUpdateProof(act.id, { googleDriveLink: e.target.value })}
                                  className="w-full bg-[#141414] border border-slate-800 text-[11px] rounded px-2 py-1 focus:outline-none text-white mt-0.5"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-gray-500 block">External Reference / Website Link</label>
                                <input
                                  type="url"
                                  placeholder="https://..."
                                  value={act.proof?.referenceLink || ''}
                                  onChange={(e) => handleUpdateProof(act.id, { referenceLink: e.target.value })}
                                  className="w-full bg-[#141414] border border-slate-800 text-[11px] rounded px-2 py-1 focus:outline-none text-white mt-0.5"
                                />
                              </div>
                            </div>

                            {/* DRAG AND DROP SCREENSHOT ZONE */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-500 block">Attached Graphic / Screenshot</label>
                              <div
                                onDragEnter={(e) => handleDrag(e, act.id)}
                                onDragOver={(e) => handleDrag(e, act.id)}
                                onDragLeave={(e) => handleDrag(e, act.id)}
                                onDrop={(e) => handleDrop(e, act.id)}
                                className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                                  dragActiveId === act.id
                                    ? 'border-emerald-500 bg-emerald-500/5 text-emerald-400'
                                    : act.proof?.screenshot
                                    ? 'border-emerald-900/30 bg-emerald-950/10 text-emerald-500'
                                    : 'border-slate-800 hover:border-slate-700 bg-[#141414] text-gray-500'
                                }`}
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  accept="image/*"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleScreenshotUpload(e.target.files[0], act.id);
                                    }
                                  }}
                                  className="hidden"
                                />
                                {act.proof?.screenshot ? (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-emerald-400 block flex items-center justify-center gap-1">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Screenshot Attached!
                                    </span>
                                    <img
                                      src={act.proof.screenshot}
                                      alt="Screenshot proof"
                                      className="max-h-24 mx-auto rounded border border-emerald-900/10 object-contain"
                                    />
                                    <span className="text-[8px] text-gray-500 block hover:text-rose-400 mt-1 cursor-pointer" onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateProof(act.id, { screenshot: undefined });
                                    }}>Remove Image</span>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <Upload className="h-4 w-4 mx-auto text-gray-500" />
                                    <span className="text-[9px] font-semibold block">Drag & Drop or Click to Upload</span>
                                    <span className="text-[8px] text-gray-600 block">Supports JPEG, PNG</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* COMPLETED HISTORY BLOCK */}
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">✅ Completed History</span>
                {completedHistory.length === 0 ? (
                  <p className="text-xs text-gray-600 italic py-2 pl-2">No completed deliverables yet today.</p>
                ) : (
                  completedHistory.map((act) => {
                    const actName = act.type === 'Custom Activity' ? (act.customTypeName || 'Custom Activity') : act.type;
                    const isProofActive = activeProofActivityId === act.id;

                    return (
                      <div key={act.id} className="bg-[#141414]/60 border border-slate-850/40 p-3 rounded-xl space-y-2 opacity-85">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleToggleComplete(act.id)}
                            className="flex items-center gap-2.5 text-xs text-left font-semibold text-gray-500 hover:text-emerald-400 transition-colors cursor-pointer line-through decoration-emerald-500/50"
                          >
                            <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span>{actName}</span>
                          </button>
                          
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase rounded-full tracking-wider">
                              Completed
                            </span>

                            <button
                              onClick={() => handleDeleteActivity(act.id)}
                              className="p-1 hover:bg-rose-950 text-gray-600 hover:text-rose-400 rounded cursor-pointer"
                              title="Delete activity"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMovingActivityId(movingActivityId === act.id ? null : act.id);
                                setMovingTargetDate(selectedDate);
                              }}
                              className={`p-1 rounded cursor-pointer transition-colors ${movingActivityId === act.id ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-slate-800 text-gray-500 hover:text-white'}`}
                              title="Move deliverable to another date"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Move Activity inline panel */}
                        {movingActivityId === act.id && (
                          <div className="bg-[#0c0c0c] border border-slate-800 p-2.5 rounded-lg space-y-2 mt-1">
                            <span className="text-[9px] uppercase font-bold text-emerald-400 block font-mono">Move Deliverable to another Date</span>
                            <div className="flex gap-1.5">
                              <input
                                type="date"
                                value={movingTargetDate}
                                onChange={(e) => setMovingTargetDate(e.target.value)}
                                className="bg-[#141414] border border-slate-800 text-xs rounded px-2 py-1 text-white focus:outline-none flex-1 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => handleMoveActivity(act.id, selectedDate, movingTargetDate)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-2.5 py-1 rounded text-[10px] cursor-pointer font-sans"
                              >
                                Move
                              </button>
                              <button
                                type="button"
                                onClick={() => setMovingActivityId(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-gray-400 px-2 py-1 rounded text-[10px] cursor-pointer font-sans"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Proof of Work Display */}
                        {act.proof && (
                          <div className="flex flex-wrap gap-2 text-[9px] bg-[#0d0d0d] p-2 rounded-lg text-gray-500 border border-slate-850/30">
                            {act.proof.instagramLink && <a href={act.proof.instagramLink} target="_blank" rel="noreferrer" className="hover:text-emerald-400 font-semibold">🔗 Instagram</a>}
                            {act.proof.canvaLink && <a href={act.proof.canvaLink} target="_blank" rel="noreferrer" className="hover:text-emerald-400 font-semibold">🎨 Canva</a>}
                            {act.proof.googleDriveLink && <a href={act.proof.googleDriveLink} target="_blank" rel="noreferrer" className="hover:text-emerald-400 font-semibold">📁 GDrive</a>}
                            {act.proof.referenceLink && <a href={act.proof.referenceLink} target="_blank" rel="noreferrer" className="hover:text-emerald-400 font-semibold">🌐 Link</a>}
                            {act.proof.screenshot && <span className="text-emerald-500/80">📸 Image POW</span>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

          {/* 5. DAILY NOTES MANAGER */}
          <div className="bg-[#0c0c0c] border border-slate-850 p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Daily Campaign Notes
            </h4>

            <div className="space-y-4">
              <div>
                <label className="text-gray-500 text-[10px] uppercase font-bold block mb-1">✍️ Internal Team Notes</label>
                <textarea
                  placeholder="Team directives, shoot requirements, reference concepts..."
                  value={selectedDayPlan.internalNotes || ''}
                  onChange={(e) => handleSaveNotes('internal', e.target.value)}
                  className="w-full h-16 bg-[#141414] border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="text-gray-500 text-[10px] uppercase font-bold block mb-1">🗣️ Client Communication Notes</label>
                <textarea
                  placeholder="Content copy drafts, approvals pending, client directives..."
                  value={selectedDayPlan.clientNotes || ''}
                  onChange={(e) => handleSaveNotes('client', e.target.value)}
                  className="w-full h-16 bg-[#141414] border border-slate-800 rounded-xl p-3 text-white text-xs focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* FOOTER METRICS SUMMARY BOARD */}
      <div className="bg-[#0c0c0c] border border-slate-850 p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-850 pb-3 gap-2">
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Active Month Deliverables Summary Panel
            </h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Analyzes scheduled work scopes and completion rates for this current month navigation.
            </p>
          </div>
          <div className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
            Active Month: {currentNavDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-center">
          <div className="bg-[#141414] border border-slate-850/60 p-3 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Stories (IG)</span>
            <span className="text-lg font-mono font-bold text-white block mt-1">{monthlySummary.igStory}</span>
          </div>
          <div className="bg-[#141414] border border-slate-850/60 p-3 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Stories (FB)</span>
            <span className="text-lg font-mono font-bold text-white block mt-1">{monthlySummary.fbStory}</span>
          </div>
          <div className="bg-[#141414] border border-slate-850/60 p-3 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">WhatsApp Status</span>
            <span className="text-lg font-mono font-bold text-white block mt-1">{monthlySummary.waStatus}</span>
          </div>
          <div className="bg-[#141414] border border-slate-850/60 p-3 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Posts (IG/FB)</span>
            <span className="text-lg font-mono font-bold text-white block mt-1">{monthlySummary.igPost + monthlySummary.fbPost}</span>
          </div>
          <div className="bg-[#141414] border border-slate-850/60 p-3 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Reels/Shorts</span>
            <span className="text-lg font-mono font-bold text-white block mt-1">{monthlySummary.reel}</span>
          </div>
          <div className="bg-[#141414] border border-slate-850/60 p-3 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Meta Ads days</span>
            <span className="text-lg font-mono font-bold text-white block mt-1">{monthlySummary.adsDays}</span>
          </div>
          <div className="bg-[#141414] border border-slate-850/60 p-3 rounded-xl">
            <span className="text-[9px] text-gray-500 font-bold uppercase block">Meetings/Calls</span>
            <span className="text-lg font-mono font-bold text-white block mt-1">{monthlySummary.meetings + monthlySummary.calls}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-xl text-center">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Completed Scope Items</span>
            <span className="text-2xl font-mono font-black text-emerald-400 block mt-1">{monthlySummary.completed}</span>
          </div>
          <div className="bg-amber-950/10 border border-amber-500/10 p-4 rounded-xl text-center">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Pending / Planned Scope</span>
            <span className="text-2xl font-mono font-black text-amber-400 block mt-1">{monthlySummary.pending}</span>
          </div>
          <div className="bg-indigo-950/20 border border-indigo-500/10 p-4 rounded-xl text-center flex flex-col justify-center items-center">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">Overall Task Completion Rate</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-mono font-black text-indigo-400">{monthlySummary.completionRate}%</span>
              <span className="text-xs text-gray-500">of active tasks</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
