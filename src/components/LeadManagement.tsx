import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import { calculateExpiryDate, formatDate, formatCurrency } from '../utils';
import { Lead, Client, Payment, FollowUp } from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  UserPlus, 
  Phone, 
  MapPin, 
  Building, 
  X,
  User,
  Sparkles,
  RefreshCw,
  HelpCircle,
  Calendar,
  MessageSquare,
  CreditCard,
  DollarSign,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Activity,
  FileText,
  Mail,
  Globe,
  ThumbsUp,
  Award,
  AlertOctagon,
  TrendingDown,
  FileCode,
  Zap,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AVAILABLE_SERVICES } from './ClientManagement';

const getCleanErrorMessage = (err: any): string => {
  const msg = err?.message || String(err);
  if (msg.trim().startsWith('<') || msg.toLowerCase().includes('<!doctype') || msg.toLowerCase().includes('html')) {
    return 'Server error (please verify your network connection and try again).';
  }
  return msg;
};

const formatLeadTelegramMessage = (lead: Lead): string => {
  const getVal = (val: any) => {
    if (val === undefined || val === null || String(val).trim() === '') {
      return 'Not Provided';
    }
    return String(val).trim();
  };

  const getCurrencyVal = (val: any) => {
    if (val === undefined || val === null || String(val).trim() === '') {
      return 'Not Provided';
    }
    return `₹${val}`;
  };

  const objectionsStr = lead.objections && lead.objections.length > 0 
    ? lead.objections.join(', ') 
    : 'Not Provided';

  const updatedAtStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  return `📌 LEAD UPDATE PUSHED

👤 Lead Name: ${getVal(lead.name)}
🏢 Business: ${getVal(lead.business)}
📱 Phone: ${getVal(lead.mobile)}
📍 Address: ${getVal(lead.address)}

📊 Status: ${getVal(lead.status)}
🔥 Priority: ${getVal(lead.priority)}
😊 Mood: ${getVal(lead.mood)}
🎯 Buying Intent: ${getVal(lead.buyingIntent)}
📊 Lead Score: ${getVal(lead.leadScore)}
🟢 Lead Health: ${getVal(lead.health)}

💰 Expected Value: ${getCurrencyVal(lead.expectedRevenue)}
🎯 Interested Service: ${getVal(lead.interestedService)}
💬 Objection: ${objectionsStr}
📝 Notes: ${getVal(lead.notes)}

🕒 Updated At: ${updatedAtStr}`;
};

export const LeadManagement: React.FC = () => {
  const { 
    leads, 
    addLead, 
    updateLead, 
    deleteLead, 
    convertLeadToClient, 
    sendTelegramNotification, 
    telegramSettings,
    followUps
  } = useCRM();

  // Filter/Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [healthFilter, setHealthFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);

  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [timelineLead, setTimelineLead] = useState<Lead | null>(null);
  const [actionLead, setActionLead] = useState<Lead | null>(null);

  // Lead Form Fields
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [mobile, setMobile] = useState('');
  const [leadSource, setLeadSource] = useState('Facebook');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<Lead['status']>('New');
  const [notes, setNotes] = useState('');

  // Expanded Lead Form Fields
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [address, setAddress] = useState('');
  const [mood, setMood] = useState<NonNullable<Lead['mood']>>('Neutral');
  const [buyingIntent, setBuyingIntent] = useState<NonNullable<Lead['buyingIntent']>>('Medium');
  const [priority, setPriority] = useState<NonNullable<Lead['priority']>>('Medium');
  const [expectedRevenue, setExpectedRevenue] = useState<number>(0);
  const [expectedPackage, setExpectedPackage] = useState('');
  const [interestedService, setInterestedService] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [decisionMaker, setDecisionMaker] = useState('Yes');
  const [meetingOutcome, setMeetingOutcome] = useState<string>('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [selectedObjections, setSelectedObjections] = useState<string[]>([]);

  // Action Logging Fields
  const [logActionType, setLogActionType] = useState<'Phone Call' | 'WhatsApp Contact' | 'Meeting Outcome' | 'Proposal Sent' | 'Negotiation Log' | 'Custom Note'>('Phone Call');
  const [logNotes, setLogNotes] = useState('');
  const [logOutcome, setLogOutcome] = useState<string>('');
  const [logObjections, setLogObjections] = useState<string[]>([]);

  // Conversion Client Fields State
  const [cName, setCName] = useState('');
  const [cBusinessName, setCBusinessName] = useState('');
  const [cMobile, setCMobile] = useState('');
  const [cWhatsApp, setCWhatsApp] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cGstNumber, setCGstNumber] = useState('');
  const [cStartDate, setCStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [cPackageDuration, setCPackageDuration] = useState('1 Month');
  const [cExpiryDate, setCExpiryDate] = useState('');
  const [cNotes, setCNotes] = useState('');
  const [cImageFile, setCImageFile] = useState<File | null>(null);
  const [cImagePreview, setCImagePreview] = useState<string>('');

  // Conversion Package & Services States
  const [cPackageType, setCPackageType] = useState<'Basic' | 'Advance' | 'Pro' | 'Custom'>('Basic');
  const [cCustomPackageName, setCCustomPackageName] = useState('');
  const [cPackagePrice, setCPackagePrice] = useState(10000);
  const [cSelectedServices, setCSelectedServices] = useState<string[]>([]);
  
  // Initial Conversion Payment States
  const [cInitialPaymentAmount, setCInitialPaymentAmount] = useState<number>(0);
  const [cInitialPaymentMode, setCInitialPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('UPI');
  const [cInitialPaymentType, setCInitialPaymentType] = useState<'Advance' | 'Full Payment'>('Advance');
  const [cInitialPaymentNotes, setCInitialPaymentNotes] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [isTelegramSending, setIsTelegramSending] = useState<Record<string, boolean>>({});

  const handleSendLeadTelegram = async (lead: Lead) => {
    setIsTelegramSending(prev => ({ ...prev, [lead.id]: true }));
    try {
      const latestLead = leads.find(l => l.id === lead.id) || lead;
      const messageText = formatLeadTelegramMessage(latestLead);
      await sendTelegramNotification(messageText, 'custom');
      showToast("✅ Lead pushed to Telegram successfully!", "success");
    } catch (err: any) {
      console.error("Failed to send Lead to Telegram:", err);
      const cleanMsg = getCleanErrorMessage(err);
      showToast(`❌ Failed: ${cleanMsg}`, "error");
    } finally {
      setIsTelegramSending(prev => ({ ...prev, [lead.id]: false }));
    }
  };

  // Auto calculate client conversion expiry date
  useEffect(() => {
    if (cStartDate && cPackageDuration) {
      setCExpiryDate(calculateExpiryDate(cStartDate, cPackageDuration));
    }
  }, [cStartDate, cPackageDuration]);

  // Open Lead Form for Add
  const openAddModal = () => {
    setEditingLead(null);
    setName('');
    setBusiness('');
    setMobile('');
    setLeadSource('Facebook');
    setFollowUpDate(new Date().toISOString().split('T')[0]);
    setStatus('New');
    setNotes('');

    setEmail('');
    setWebsite('');
    setGoogleMapsLink('');
    setAddress('');
    setMood('Neutral');
    setBuyingIntent('Medium');
    setPriority('Medium');
    setExpectedRevenue(0);
    setExpectedPackage('');
    setInterestedService('');
    setBudgetRange('');
    setDecisionMaker('Yes');
    setMeetingOutcome('');
    setMeetingNotes('');
    setSelectedObjections([]);
    setIsFormOpen(true);
  };

  // Open Lead Form for Edit
  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setName(lead.name);
    setBusiness(lead.business);
    setMobile(lead.mobile);
    setLeadSource(lead.leadSource);
    setFollowUpDate(lead.followUpDate);
    setStatus(lead.status);
    setNotes(lead.notes || '');

    setEmail(lead.email || '');
    setWebsite(lead.website || '');
    setGoogleMapsLink(lead.googleMapsLink || '');
    setAddress(lead.address || '');
    setMood(lead.mood || 'Neutral');
    setBuyingIntent(lead.buyingIntent || 'Medium');
    setPriority(lead.priority || 'Medium');
    setExpectedRevenue(lead.expectedRevenue || 0);
    setExpectedPackage(lead.expectedPackage || '');
    setInterestedService(lead.interestedService || '');
    setBudgetRange(lead.budgetRange || '');
    setDecisionMaker(lead.decisionMaker || 'Yes');
    setMeetingOutcome(lead.meetingOutcome || '');
    setMeetingNotes(lead.meetingNotes || '');
    setSelectedObjections(lead.objections || []);
    setIsFormOpen(true);
  };

  // Open Action Logger Modal
  const openActionModal = (lead: Lead) => {
    setActionLead(lead);
    setLogActionType('Phone Call');
    setLogNotes('');
    setLogOutcome('');
    setLogObjections([]);
    setIsActionModalOpen(true);
  };

  // Open Conversion Modal
  const openConvertModal = (lead: Lead) => {
    setConvertingLead(lead);
    
    // Auto populate client fields from lead parameters
    setCName(lead.name);
    setCBusinessName(lead.business);
    setCMobile(lead.mobile);
    setCWhatsApp(lead.mobile); // Fallback Whatsapp to same number
    setCEmail(lead.email || '');
    setCAddress(lead.address || '');
    setCGstNumber('');
    const today = new Date().toISOString().split('T')[0];
    setCStartDate(today);
    setCPackageDuration('1 Month');
    setCExpiryDate(calculateExpiryDate(today, '1 Month'));
    setCNotes(`Converted from Lead source: ${lead.leadSource}. Previous Notes: ${lead.notes}`);
    setCImageFile(null);
    setCImagePreview('');

    // Pre-populate package selection based on lead's expectation if matching
    if (lead.expectedPackage === 'Basic' || lead.expectedPackage === 'Advance' || lead.expectedPackage === 'Pro') {
      handleCPackageTypeChange(lead.expectedPackage);
    } else {
      // Default package details for basic package
      setCPackageType('Basic');
      setCCustomPackageName('');
      setCPackagePrice(10000);
      setCSelectedServices([
        'Instagram Handling',
        'Facebook Handling',
        'Poster Design',
        'WhatsApp Status Poster'
      ]);
    }

    if (lead.expectedRevenue) {
      setCPackagePrice(lead.expectedRevenue);
    }

    // Initial onboarding payment reset
    setCInitialPaymentAmount(0);
    setCInitialPaymentMode('UPI');
    setCInitialPaymentType('Advance');
    setCInitialPaymentNotes('');
    
    setIsConvertOpen(true);
  };

  // Helper to sync defaults when converting package changes
  const handleCPackageTypeChange = (type: 'Basic' | 'Advance' | 'Pro' | 'Custom') => {
    setCPackageType(type);
    if (type === 'Basic') {
      setCPackagePrice(10000);
      setCPackageDuration('1 Month');
      setCSelectedServices([
        'Instagram Handling',
        'Facebook Handling',
        'Poster Design',
        'WhatsApp Status Poster'
      ]);
    } else if (type === 'Advance') {
      setCPackagePrice(25000);
      setCPackageDuration('3 Months');
      setCSelectedServices([
        'Reel Shooting',
        'Reel Editing',
        'Meta Ads',
        'Instagram Handling',
        'Facebook Handling',
        'Poster Design',
        'WhatsApp Status Poster'
      ]);
    } else if (type === 'Pro') {
      setCPackagePrice(50000);
      setCPackageDuration('6 Months');
      setCSelectedServices([
        'Reel Shooting',
        'Reel Editing',
        'Meta Ads',
        'Google Ads',
        'Instagram Handling',
        'Facebook Handling',
        'Poster Design',
        'WhatsApp Status Poster',
        'WhatsApp Automation',
        'Website Development'
      ]);
    } else {
      setCCustomPackageName('');
      setCPackagePrice(0);
      setCPackageDuration('1 Month');
      setCSelectedServices([]);
    }
  };

  // Submit Lead Add/Edit
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const leadData = {
        name,
        business,
        mobile,
        leadSource,
        followUpDate,
        status,
        notes,
        email,
        website,
        googleMapsLink,
        address,
        mood,
        buyingIntent,
        priority,
        expectedRevenue: Number(expectedRevenue) || 0,
        expectedPackage,
        interestedService,
        budgetRange,
        decisionMaker,
        meetingOutcome: meetingOutcome || undefined,
        meetingNotes,
        objections: selectedObjections
      };

      if (editingLead) {
        await updateLead(editingLead.id, leadData);
        showToast("✅ Lead updated successfully.");
      } else {
        const savedLead = await addLead(leadData);
        showToast("✅ Lead created successfully.");
        
        // Construct and send Telegram notification
        if (telegramSettings && telegramSettings.enabled) {
          const createdDate = savedLead.createdAt 
            ? new Date(savedLead.createdAt).toLocaleString('en-IN') 
            : new Date().toLocaleString('en-IN');

          const messageText = `🆕 NEW LEAD RECEIVED
          
👤 Name: ${savedLead.name}
🏢 Business: ${savedLead.business}
📞 Phone: ${savedLead.mobile}
📧 Email: ${savedLead.email || 'N/A'}
📍 Address: ${savedLead.address || 'N/A'}
📦 Expected Package: ${savedLead.expectedPackage || 'N/A'}
💰 Expected Revenue: ₹${savedLead.expectedRevenue || 'N/A'}
📢 Source: ${savedLead.leadSource}
📝 Notes: ${savedLead.notes || 'None'}
📅 Created: ${createdDate}

Also include two quick action links:

📲 WhatsApp:
https://wa.me/91${savedLead.mobile}

📞 Call:
tel:${savedLead.mobile}`;

          try {
            await sendTelegramNotification(messageText, 'lead_created', savedLead);
          } catch (tgError: any) {
            console.error(tgError);
          }
        }
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to save lead", "error");
    }
  };

  // Submit Quick Action Log
  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionLead) return;

    try {
      const notesToSave = logNotes || `${logActionType} completed.`;
      const updatePayload: Partial<Lead> = {};

      if (logActionType === 'Meeting Outcome') {
        updatePayload.meetingOutcome = logOutcome as any;
        updatePayload.meetingNotes = notesToSave;
        updatePayload.objections = logObjections;
      }

      await updateLead(actionLead.id, updatePayload, logActionType, notesToSave);
      showToast(`✅ Action "${logActionType}" logged in timeline.`);
      setIsActionModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to log action", "error");
    }
  };

  // Submit Client Conversion
  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;

    try {
      const currentPayments: Payment[] = [];
      if (cInitialPaymentAmount > 0) {
        currentPayments.push({
          id: 'pay_' + Date.now(),
          amount: Number(cInitialPaymentAmount),
          date: cStartDate,
          mode: cInitialPaymentMode,
          type: cInitialPaymentType === 'Full Payment' ? 'Full Payment' : 'Advance',
          notes: cInitialPaymentNotes || 'Onboarding package payment'
        });
      }

      const totalReceived = currentPayments.reduce((sum, p) => sum + p.amount, 0);
      const finalPkgPrice = Number(cPackagePrice);
      const calculatedPending = Math.max(0, finalPkgPrice - totalReceived);
      const computedPaymentStatus = calculatedPending <= 0 ? 'Paid' : 'Pending';

      const clientDetails = {
        name: cName,
        businessName: cBusinessName,
        mobile: cMobile,
        whatsApp: cWhatsApp,
        email: cEmail,
        address: cAddress,
        gstNumber: cGstNumber || undefined,
        startDate: cStartDate,
        packageDuration: cPackageDuration,
        expiryDate: cExpiryDate,
        notes: cNotes,
        revenue: totalReceived,
        pendingAmount: calculatedPending,
        paymentStatus: computedPaymentStatus,
        profilePhoto: cImagePreview || '',
        packageDetails: {
          type: cPackageType,
          customName: cPackageType === 'Custom' ? cCustomPackageName || 'Custom Package' : `${cPackageType} Package`,
          price: finalPkgPrice,
          duration: cPackageDuration,
          services: cSelectedServices
        },
        payments: currentPayments
      };

      // Set lead status to Converted as well before transition
      await updateLead(convertingLead.id, { status: 'Converted' });
      await convertLeadToClient(convertingLead.id, clientDetails, cImageFile);
      
      // Send telegram update
      if (telegramSettings && telegramSettings.enabled) {
        const messageText = `🎉 LEAD CONVERTED TO PAID CLIENT!
        
👤 Name: ${cName}
🏢 Business: ${cBusinessName}
📞 Phone: ${cMobile}
📦 Package Details: ${cPackageType === 'Custom' ? cCustomPackageName : cPackageType + ' Package'}
💰 Deal Value: ₹${finalPkgPrice}
💵 Received Amount: ₹${totalReceived}
📅 Campaign Starts: ${cStartDate}
📅 Campaign Expires: ${cExpiryDate}`;

        try {
          await sendTelegramNotification(messageText, 'client_created', clientDetails);
        } catch (tgErr) {
          console.error(tgErr);
        }
      }

      setIsConvertOpen(false);
      showToast("🎉 Converted to Paid Client successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to convert lead: " + (err instanceof Error ? err.message : String(err)), "error");
    }
  };

  // Delete Lead
  const handleDeleteLead = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this prospect lead? This cannot be undone.")) return;
    try {
      await deleteLead(id);
      showToast("✅ Deleted successfully.", "success");
    } catch (err: any) {
      console.error(err);
      showToast(`❌ Failed to delete lead`, "error");
    }
  };

  // Handle click contact and auto-log
  const handleQuickContactLog = async (lead: Lead, action: 'Phone Call' | 'WhatsApp Contact') => {
    try {
      await updateLead(
        lead.id, 
        {}, 
        action, 
        `Initiated quick contact via ${action === 'Phone Call' ? 'phone dialer' : 'WhatsApp messaging link'}.`
      );
      showToast(`Logged ${action} in timeline.`);
      
      if (action === 'Phone Call') {
        window.location.href = `tel:${lead.mobile}`;
      } else {
        window.open(`https://wa.me/91${lead.mobile}`, '_blank');
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to log activity", "error");
    }
  };

  // Handle conversion image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Pipeline stages lookup
  const PIPELINE_STAGES = [
    'New',
    'Contacted',
    'Meeting Scheduled',
    'Meeting Done',
    'Proposal / Quotation Sent',
    'In Progress',
    'Interested',
    'Negotiation',
    'Waiting For Client Decision',
    'Payment Pending',
    'Converted',
    'Lost'
  ];

  // Search & Filter Logic
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.business.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.mobile.includes(searchTerm);

      const matchesStatus = 
        statusFilter === 'All' || 
        l.status === statusFilter;

      const matchesPriority = 
        priorityFilter === 'All' || 
        l.priority === priorityFilter;

      const matchesHealth = 
        healthFilter === 'All' || 
        l.health === healthFilter;

      const matchesSource = 
        sourceFilter === 'All' || 
        l.leadSource === sourceFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesHealth && matchesSource;
    });
  }, [leads, searchTerm, statusFilter, priorityFilter, healthFilter, sourceFilter]);

  // Analytics helper calculations (memoized to avoid redundant recalculations on search)
  const { 
    totalLeadsCount, 
    activeLeadsCount, 
    convertedLeadsCount, 
    lostLeadsCount,
    conversionRate,
    hotLeadsCount,
    atRiskLeadsCount,
    expectedTotalRevenue
  } = useMemo(() => {
    const total = leads.length;
    const active = leads.filter(l => l.status !== 'Converted' && l.status !== 'Lost').length;
    const converted = leads.filter(l => l.status === 'Converted').length;
    const lost = leads.filter(l => l.status === 'Lost').length;
    const rate = total > 0 ? ((converted / total) * 100).toFixed(0) : '0';
    const hot = leads.filter(l => l.status !== 'Converted' && l.status !== 'Lost' && (l.leadScore || 0) >= 50).length;
    const atRisk = leads.filter(l => l.status !== 'Converted' && l.status !== 'Lost' && l.health === 'At Risk').length;
    const expectedRev = leads
      .filter(l => l.status !== 'Converted' && l.status !== 'Lost')
      .reduce((sum, l) => sum + (l.expectedRevenue || 0), 0);
    return {
      totalLeadsCount: total,
      activeLeadsCount: active,
      convertedLeadsCount: converted,
      lostLeadsCount: lost,
      conversionRate: rate,
      hotLeadsCount: hot,
      atRiskLeadsCount: atRisk,
      expectedTotalRevenue: expectedRev
    };
  }, [leads]);

  // Status Badge styling helper
  const getStatusBadgeStyles = (statusVal: Lead['status']) => {
    switch (statusVal) {
      case 'New':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Contacted':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Meeting Scheduled':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'Meeting Done':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'Proposal / Quotation Sent':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'In Progress':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Interested':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      case 'Negotiation':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'Waiting For Client Decision':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'Payment Pending':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Converted':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Lost':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  // Health Badge styling helper
  const getHealthBadgeStyles = (healthVal: Lead['health']) => {
    switch (healthVal) {
      case 'Healthy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Needs Attention':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'At Risk':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  // Priority Badge styling helper
  const getPriorityBadgeStyles = (priVal: Lead['priority']) => {
    switch (priVal) {
      case 'High':
        return 'text-rose-400 bg-rose-500/5 border border-rose-500/20';
      case 'Medium':
        return 'text-amber-400 bg-amber-500/5 border border-amber-500/20';
      case 'Low':
        return 'text-blue-400 bg-blue-500/5 border border-blue-500/20';
      default:
        return 'text-amber-400 bg-amber-500/5 border border-amber-500/20';
    }
  };

  return (
    <div className="space-y-6 font-sans pb-10 text-gray-200">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">Sales Intelligence</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            Campaign Prospects & Agency CRM
          </h2>
          <p className="text-sm text-gray-400 mt-1">Real-time pipeline journey, auto score tracking, and client health indicators.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('All');
              setPriorityFilter('All');
              setHealthFilter('All');
              setSourceFilter('All');
              showToast('🔄 Search filters reset.', 'success');
            }}
            className="p-2.5 bg-[#141414] hover:bg-[#1f1f1f] border border-slate-800 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Clear Filters"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer text-sm transition-all duration-200"
          >
            <Plus className="h-5 w-5" /> Log Lead
          </button>
        </div>
      </div>

      {/* CRM Dashboard Intelligence Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline Value */}
        <div className="bg-[#141414] border border-slate-800/40 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Pipeline Projections</span>
            <span className="p-1.5 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <h3 className="text-lg sm:text-xl font-bold text-white">{formatCurrency(expectedTotalRevenue)}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{activeLeadsCount} unresolved prospects in play</p>
          </div>
        </div>

        {/* Hot Leads Indicator */}
        <div className="bg-[#141414] border border-slate-800/40 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Hot Leads</span>
            <span className="p-1.5 bg-rose-500/10 border border-rose-500/15 text-rose-400 rounded-lg">
              <Zap className="h-4 w-4 animate-pulse" />
            </span>
          </div>
          <div className="mt-2.5">
            <h3 className="text-lg sm:text-xl font-bold text-white">{hotLeadsCount} Prospect{hotLeadsCount === 1 ? '' : 's'}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Scoring {'>'}= 50/100 engagement</p>
          </div>
        </div>

        {/* Conversion Rate Percentage */}
        <div className="bg-[#141414] border border-slate-800/40 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Conversion Efficiency</span>
            <span className="p-1.5 bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 rounded-lg">
              <CheckCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <h3 className="text-lg sm:text-xl font-bold text-white">{conversionRate}%</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">{convertedLeadsCount} closed deals of {totalLeadsCount} total</p>
          </div>
        </div>

        {/* Health Risk warning */}
        <div className="bg-[#141414] border border-slate-800/40 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Engagement Risks</span>
            <span className={`p-1.5 rounded-lg border ${atRiskLeadsCount > 0 ? 'bg-red-500/10 border-red-500/15 text-red-400' : 'bg-slate-800 text-gray-400'}`}>
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5">
            <h3 className={`text-lg sm:text-xl font-bold ${atRiskLeadsCount > 0 ? 'text-red-400' : 'text-white'}`}>{atRiskLeadsCount} Lead{atRiskLeadsCount === 1 ? '' : 's'}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Marked as At Risk & silent</p>
          </div>
        </div>
      </div>

      {/* FILTER TOOLBAR / OPTIONS BAR */}
      <div className="bg-[#141414] border border-slate-800/40 p-4 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search prospects by name, company name, mobile..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#0d0d0d] border border-slate-800/80 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/45 text-xs transition-all"
            />
          </div>
          
          <div className="flex gap-2">
            {/* View Mode Toggle */}
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-[#0d0d0d] border-slate-850 text-gray-450 hover:text-white'}`}
            >
              Card Bento
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${viewMode === 'table' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-[#0d0d0d] border-slate-850 text-gray-450 hover:text-white'}`}
            >
              Master Table
            </button>
          </div>
        </div>

        {/* Detailed Attribute Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-850">
          {/* Status Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-widest">Pipeline Phase</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full bg-[#0d0d0d] border border-slate-850 rounded-lg py-1.5 px-3 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">All Phases</option>
              {PIPELINE_STAGES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-widest">Priority Segment</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="mt-1 w-full bg-[#0d0d0d] border border-slate-850 rounded-lg py-1.5 px-3 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">All Priorities</option>
              <option value="High">🔥 High</option>
              <option value="Medium">⚡ Medium</option>
              <option value="Low">❄️ Low</option>
            </select>
          </div>

          {/* Health Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-widest">Client Health</label>
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="mt-1 w-full bg-[#0d0d0d] border border-slate-850 rounded-lg py-1.5 px-3 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">All Health Statuses</option>
              <option value="Healthy">🟢 Healthy</option>
              <option value="Needs Attention">🟡 Needs Attention</option>
              <option value="At Risk">🔴 At Risk</option>
            </select>
          </div>

          {/* Source Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-gray-550 uppercase tracking-widest">Acquisition Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="mt-1 w-full bg-[#0d0d0d] border border-slate-850 rounded-lg py-1.5 px-3 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="All">All Channels</option>
              <option value="Facebook">Facebook Marketing</option>
              <option value="Instagram">Instagram Ad</option>
              <option value="Google Ads">Google Search Ad</option>
              <option value="Website">Website Form</option>
              <option value="Reference">Reference / Referral</option>
              <option value="Direct Outreach">Direct Outreach</option>
              <option value="Other">Other Channel</option>
            </select>
          </div>
        </div>
      </div>

      {/* LEADS CORE CONTAINER DISPLAY */}
      {filteredLeads.length === 0 ? (
        <div className="bg-[#141414] border border-slate-850 rounded-2xl p-16 text-center text-gray-400 space-y-4">
          <Sparkles className="h-12 w-12 mx-auto text-emerald-900/35 animate-pulse" />
          <div>
            <h3 className="text-lg font-bold text-white">No Lead Matches Found</h3>
            <p className="text-sm mt-1 text-gray-500">No prospects correspond to the current filter criteria.</p>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('All');
              setPriorityFilter('All');
              setHealthFilter('All');
              setSourceFilter('All');
            }}
            className="px-4 py-2 bg-[#0d0d0d] border border-slate-800 hover:border-emerald-500/30 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Clear Search Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* CARD BENTO GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLeads.map((lead) => {
            const displayScore = lead.leadScore ?? 10;
            // Determine dynamic colors for scores
            let progressColor = 'bg-red-500';
            let scoreLabel = 'Cold';
            if (displayScore >= 80) {
              progressColor = 'bg-emerald-500';
              scoreLabel = 'Ready To Close';
            } else if (displayScore >= 50) {
              progressColor = 'bg-orange-500';
              scoreLabel = 'Hot';
            } else if (displayScore >= 30) {
              progressColor = 'bg-yellow-500';
              scoreLabel = 'Warm';
            }

            return (
              <motion.div
                key={lead.id}
                layoutId={`lead-card-${lead.id}`}
                className="bg-[#141414] border border-slate-800/50 hover:border-slate-700/60 transition-all rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Top line Name / Business / Priority */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center font-black text-sm">
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-white leading-tight text-sm tracking-tight">{lead.name}</h4>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-gray-500 shrink-0" /> {lead.business}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${getPriorityBadgeStyles(lead.priority)}`}>
                        {lead.priority || 'Medium'}
                      </span>
                    </div>
                  </div>

                  {/* Badges Line (Status / Health / Source) */}
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeStyles(lead.status)}`}>
                      {lead.status}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getHealthBadgeStyles(lead.health)}`}>
                      {lead.health || 'Healthy'}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-slate-800 bg-[#0d0d0d] text-gray-400">
                      {lead.leadSource}
                    </span>
                  </div>

                  {/* Middle Section: Score & Metrics */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-850 text-xs">
                    
                    {/* Score section */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium">
                        <span>Lead Score</span>
                        <span className="font-bold text-white">{displayScore}/100</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full ${progressColor}`} style={{ width: `${displayScore}%` }}></div>
                      </div>
                      <span className="text-[9px] font-semibold text-gray-550 block mt-0.5">Segment: {scoreLabel}</span>
                    </div>

                    {/* Mood / Intent */}
                    <div className="space-y-0.5 pl-2 border-l border-slate-850">
                      <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                        <span>Mood:</span>
                        <span className="text-white font-semibold">
                          {lead.mood === 'Very Positive' && '🔥 Very Positive'}
                          {lead.mood === 'Positive' && '😊 Positive'}
                          {lead.mood === 'Neutral' && '😐 Neutral'}
                          {lead.mood === 'Thinking' && '🤔 Thinking'}
                          {lead.mood === 'Confused' && '😕 Confused'}
                          {lead.mood === 'Negative' && '😡 Negative'}
                          {lead.mood === 'Not Interested' && '🚫 Cold'}
                          {!lead.mood && '😐 Neutral'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                        <span>Intent:</span>
                        <span className="text-white font-semibold">{lead.buyingIntent || 'Medium'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Budget & Target Service */}
                  <div className="mt-3.5 p-2.5 bg-[#0d0d0d]/40 rounded-xl border border-slate-850 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Projected budget:</span>
                      <span className="text-white font-bold">{lead.expectedRevenue ? formatCurrency(lead.expectedRevenue) : (lead.budgetRange || 'Not Discussed')}</span>
                    </div>
                    {lead.expectedPackage && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">Blueprint package:</span>
                        <span className="text-emerald-400 font-semibold">{lead.expectedPackage} Package</span>
                      </div>
                    )}
                    {lead.lastContactDate && (
                      <div className="flex justify-between text-[9px] text-gray-500 pt-1 border-t border-slate-850/40">
                        <span>Last Contacted:</span>
                        <span>{formatDate(lead.lastContactDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card footer CTA buttons */}
                <div className="pt-4 border-t border-slate-850/50 mt-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    
                    {/* Quick Dialer & WhatsApp with Auto-Log */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickContactLog(lead, 'Phone Call')}
                        className="p-1.5 bg-[#0d0d0d] hover:bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                        title="Log Call & Dial"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleQuickContactLog(lead, 'WhatsApp Contact')}
                        className="p-1.5 bg-[#0d0d0d] hover:bg-slate-900 border border-slate-800 rounded-lg text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
                        title="Log WhatsApp & Direct Chat"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Action Panel: History Log & Event Timeline */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openActionModal(lead)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Log Meeting outcome, objections, or custom updates"
                      >
                        <Activity className="h-3 w-3" /> Log Action
                      </button>
                      
                      <button
                        onClick={() => {
                          setTimelineLead(lead);
                          setIsTimelineOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                        title="See complete lead change history and actions timeline"
                      >
                        <Clock className="h-3 w-3" /> Timeline
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(lead)}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 text-gray-400 hover:text-white border border-slate-800/80 rounded-lg transition-colors cursor-pointer"
                        title="Edit Details"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="p-1.5 bg-slate-900 hover:bg-red-950/40 text-gray-400 hover:text-red-400 border border-slate-800/80 rounded-lg transition-colors cursor-pointer"
                        title="Delete Lead"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        id={`tg-update-lead-${lead.id}`}
                        onClick={() => handleSendLeadTelegram(lead)}
                        disabled={isTelegramSending[lead.id]}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        title="Push lead details to Telegram Group"
                      >
                        <Send className="h-3.5 w-3.5 shrink-0" />
                        {isTelegramSending[lead.id] ? 'Pushing...' : 'Push to Telegram'}
                      </button>
                    </div>

                    {lead.status !== 'Converted' ? (
                      <button
                        onClick={() => openConvertModal(lead)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[10px] transition-all flex items-center gap-1 cursor-pointer shadow-lg shadow-emerald-500/5 hover:-translate-y-0.5"
                      >
                        <UserPlus className="h-3 w-3" /> Convert Client
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Active Client
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* MASTER DATA TABLE VIEW */
        <div className="bg-[#141414] border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-gray-400 font-bold uppercase tracking-widest bg-[#0d0d0d] text-[10px]">
                  <th className="px-5 py-4">Prospect Details</th>
                  <th className="px-5 py-4">Score</th>
                  <th className="px-5 py-4">Pipeline Status</th>
                  <th className="px-5 py-4">Health</th>
                  <th className="px-5 py-4">Mood & Intent</th>
                  <th className="px-5 py-4">Budget projection</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-gray-350">
                {filteredLeads.map((lead) => {
                  const displayScore = lead.leadScore ?? 10;
                  return (
                    <tr key={lead.id} className="hover:bg-[#0d0d0d]/30 transition-colors">
                      {/* Name / Business info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#0d0d0d] border border-slate-800 text-emerald-400 flex items-center justify-center font-bold">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{lead.name}</p>
                            <p className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <Building className="h-3 w-3 text-gray-600" /> {lead.business}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Score display */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded font-black font-mono text-[10px] ${displayScore >= 80 ? 'bg-emerald-500/10 text-emerald-400' : displayScore >= 50 ? 'bg-orange-500/10 text-orange-400' : 'bg-red-500/10 text-red-400'}`}>
                            {displayScore}
                          </span>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadgeStyles(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>

                      {/* Health */}
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getHealthBadgeStyles(lead.health)}`}>
                          {lead.health || 'Healthy'}
                        </span>
                      </td>

                      {/* Mood / Intent */}
                      <td className="px-5 py-4 font-medium text-gray-400">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-white">Mood: {lead.mood || 'Neutral'}</p>
                          <p className="text-[9px] text-gray-550">Intent: {lead.buyingIntent || 'Medium'}</p>
                        </div>
                      </td>

                      {/* Expected Value */}
                      <td className="px-5 py-4 font-bold text-white">
                        {lead.expectedRevenue ? formatCurrency(lead.expectedRevenue) : (lead.budgetRange || 'Not Discussed')}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setTimelineLead(lead);
                              setIsTimelineOpen(true);
                            }}
                            className="p-1.5 bg-[#0d0d0d] hover:bg-slate-900 border border-slate-850 rounded text-gray-400 hover:text-white cursor-pointer"
                            title="Timeline"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(lead)}
                            className="p-1.5 bg-[#0d0d0d] hover:bg-slate-900 border border-slate-850 rounded text-gray-400 hover:text-white cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            id={`tg-update-lead-tbl-${lead.id}`}
                            onClick={() => handleSendLeadTelegram(lead)}
                            disabled={isTelegramSending[lead.id]}
                            className="p-1.5 bg-[#0d0d0d] hover:bg-[#141414] border border-slate-850 rounded text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
                            title="Push lead details to Telegram"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                          {lead.status !== 'Converted' && (
                            <button
                              onClick={() => openConvertModal(lead)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded cursor-pointer text-[10px]"
                            >
                              Convert
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEAD CREATION / EDIT MODAL */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-[#141414] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
            >
              <div className="px-6 py-4.5 border-b border-slate-850 flex justify-between items-center bg-[#0d0d0d]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {editingLead ? 'Edit CRM Prospect Lead' : 'Log Brand New Sales Lead'}
                    </h3>
                    <p className="text-[10px] text-gray-500">Inputs populate sales probability, rule-based scoring and indicators.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-slate-850"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleLeadSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                
                {/* Section 1: Core Contact Information */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="h-3.5 w-3.5" /> 1. Prospect & Company details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Prospect Name <span className="text-emerald-400">*</span></label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Business / Company Name <span className="text-emerald-400">*</span></label>
                      <input
                        type="text"
                        required
                        value={business}
                        onChange={(e) => setBusiness(e.target.value)}
                        placeholder="e.g. Acme Supermarts"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Mobile Number <span className="text-emerald-400">*</span></label>
                      <input
                        type="tel"
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="10 digit calling number"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Email Address (Optional)</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. contact@business.com"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Website Address</label>
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="e.g. www.business.com"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Google Maps Link</label>
                      <input
                        type="text"
                        value={googleMapsLink}
                        onChange={(e) => setGoogleMapsLink(e.target.value)}
                        placeholder="Google business listing maps URL"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400">Physical Location Address</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter full office or business location address..."
                      rows={2}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    ></textarea>
                  </div>
                </div>

                {/* Section 2: Pipeline State & Score Signals */}
                <div className="space-y-3 pt-3 border-t border-slate-850">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5" /> 2. Pipeline State & Sales signals
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Acquisition Source</label>
                      <select
                        value={leadSource}
                        onChange={(e) => setLeadSource(e.target.value)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Facebook">Facebook Marketing</option>
                        <option value="Instagram">Instagram Ad</option>
                        <option value="Google Ads">Google Search Ad</option>
                        <option value="Website">Website Form</option>
                        <option value="Reference">Reference / Referral</option>
                        <option value="Direct Outreach">Direct Outreach</option>
                        <option value="Other">Other Channel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">CRM Sales Stage</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold text-emerald-400"
                      >
                        {PIPELINE_STAGES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Next Action Date <span className="text-emerald-400">*</span></label>
                      <input
                        type="date"
                        required
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Client Mood Indicator</label>
                      <select
                        value={mood}
                        onChange={(e) => setMood(e.target.value as any)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="Very Positive">😊 Very Positive</option>
                        <option value="Positive">🙂 Positive</option>
                        <option value="Neutral">😐 Neutral</option>
                        <option value="Thinking">🤔 Thinking</option>
                        <option value="Confused">😕 Confused</option>
                        <option value="Negative">😡 Negative</option>
                        <option value="Not Interested">🚫 Cold / Not Interested</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Buying Intent Rating</label>
                      <select
                        value={buyingIntent}
                        onChange={(e) => setBuyingIntent(e.target.value as any)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="Low">Low (Informational)</option>
                        <option value="Medium">Medium (Investigating)</option>
                        <option value="High">High (Needs Proposal)</option>
                        <option value="Very High">Very High (Direct Request)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Priority Tier</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="High">🔥 High Priority</option>
                        <option value="Medium">⚡ Medium Priority</option>
                        <option value="Low">❄️ Low Priority</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Financial & Requirements Profile */}
                <div className="space-y-3 pt-3 border-t border-slate-850">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5" /> 3. Requirements & Projected Budget
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Budget Range (Text)</label>
                      <input
                        type="text"
                        value={budgetRange}
                        onChange={(e) => setBudgetRange(e.target.value)}
                        placeholder="e.g. ₹20k - ₹30k / Month"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Estimated Revenue (INR)</label>
                      <input
                        type="number"
                        value={expectedRevenue || ''}
                        onChange={(e) => setExpectedRevenue(Number(e.target.value))}
                        placeholder="e.g. 25000"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Decision Maker status</label>
                      <select
                        value={decisionMaker}
                        onChange={(e) => setDecisionMaker(e.target.value)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="Yes">Yes (Direct Contact)</option>
                        <option value="No">No (Need Reference)</option>
                        <option value="Under Discussion">Under Discussion</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Expected Blueprint Package</label>
                      <select
                        value={expectedPackage}
                        onChange={(e) => setExpectedPackage(e.target.value)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="">No Package Selected</option>
                        <option value="Basic">Basic Package (₹10,000/M)</option>
                        <option value="Advance">Advance Package (₹25,000/M)</option>
                        <option value="Pro">Pro Package (₹50,000/M)</option>
                        <option value="Custom">Custom Scope</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Specific Interested Service</label>
                      <input
                        type="text"
                        value={interestedService}
                        onChange={(e) => setInterestedService(e.target.value)}
                        placeholder="e.g. Lead Gen Reels Campaign"
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Meeting Outcomes & Objection Records */}
                <div className="space-y-3 pt-3 border-t border-slate-850">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> 4. Meeting Notes & Objections
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Meeting Outcome Rating</label>
                      <select
                        value={meetingOutcome}
                        onChange={(e) => setMeetingOutcome(e.target.value)}
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="">No Meeting Recorded Yet</option>
                        <option value="Very Interested">🔥 Very Interested</option>
                        <option value="Interested">🙂 Interested</option>
                        <option value="Need Time">🤔 Need Time / Evaluating</option>
                        <option value="Budget Issue">💸 Budget Issue</option>
                        <option value="Partner Approval Pending">👥 Partner/Board Approval Pending</option>
                        <option value="Already Working With Someone">⚡ Already Engaged with Competitor</option>
                        <option value="Not Interested">🚫 Cold / Discarded</option>
                        <option value="Other">Other Outcome</option>
                      </select>
                    </div>

                    <div className="space-y-2.5">
                      <label className="block text-xs font-medium text-gray-400">Client Objections Raised</label>
                      <div className="flex flex-wrap gap-2">
                        {['Pricing', 'Competitors', 'Trust/Portfolio', 'Timing', 'Technical Scope', 'None'].map(objection => {
                          const isSelected = selectedObjections.includes(objection);
                          return (
                            <button
                              key={objection}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedObjections(selectedObjections.filter(o => o !== objection));
                                } else {
                                  setSelectedObjections([...selectedObjections.filter(o => o !== 'None'), objection]);
                                }
                              }}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                                  : 'bg-[#0d0d0d] border-slate-850 text-gray-500 hover:text-white'
                              }`}
                            >
                              {objection}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400">Campaign Brief & Strategic Directive</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter core objective of client, target metrics, key requirements..."
                      rows={3}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    ></textarea>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-850 flex justify-end gap-3 bg-[#141414]">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-gray-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
                  >
                    {editingLead ? 'Save Updates' : 'Publish Prospect Lead'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTION LOGGER MODAL */}
      <AnimatePresence>
        {isActionModalOpen && actionLead && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141414] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-slate-850 flex justify-between items-center bg-[#0d0d0d]">
                <div>
                  <h3 className="text-base font-bold text-white">Log Live Action / Event</h3>
                  <p className="text-[10px] text-gray-550">Instantly update CRM trail for {actionLead.name}</p>
                </div>
                <button 
                  onClick={() => setIsActionModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Interaction Channel / Action</label>
                  <select
                    value={logActionType}
                    onChange={(e) => setLogActionType(e.target.value as any)}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white"
                  >
                    <option value="Phone Call">📞 Phone Call Dialer initiated</option>
                    <option value="WhatsApp Contact">📲 WhatsApp Contact made</option>
                    <option value="Meeting Outcome">🤝 Meeting Outcome / Outcome analysis</option>
                    <option value="Proposal Sent">📝 Proposal / Quotation dispatched</option>
                    <option value="Negotiation Log">💰 Pricing / Scope Negotiation</option>
                    <option value="Custom Note">📌 Custom Timeline update</option>
                  </select>
                </div>

                {logActionType === 'Meeting Outcome' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Meeting Outcome Verdict</label>
                      <select
                        value={logOutcome}
                        onChange={(e) => setLogOutcome(e.target.value)}
                        required
                        className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-emerald-400"
                      >
                        <option value="">Select Outcome...</option>
                        <option value="Very Interested">🔥 Very Interested</option>
                        <option value="Interested">🙂 Interested</option>
                        <option value="Need Time">🤔 Need Time / Evaluating</option>
                        <option value="Budget Issue">💸 Budget Issue</option>
                        <option value="Partner Approval Pending">👥 Partner Approval Pending</option>
                        <option value="Already Working With Someone">⚡ Engaged with Competitor</option>
                        <option value="Not Interested">🚫 Cold / Rejected</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400">Objections Highlighted</label>
                      <div className="flex flex-wrap gap-2">
                        {['Pricing', 'Competitors', 'Trust/Portfolio', 'Timing', 'Technical Scope', 'None'].map(obj => {
                          const isSel = logObjections.includes(obj);
                          return (
                            <button
                              key={obj}
                              type="button"
                              onClick={() => {
                                if (isSel) {
                                  setLogObjections(logObjections.filter(o => o !== obj));
                                } else {
                                  setLogObjections([...logObjections.filter(o => o !== 'None'), obj]);
                                }
                              }}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                                isSel ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' : 'bg-[#0d0d0d] border-slate-850 text-gray-500 hover:text-white'
                              }`}
                            >
                              {obj}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-400">Activity Outcome Summary / Notes</label>
                  <textarea
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    required
                    placeholder="Enter precise notes on conversation details..."
                    rows={3}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2 text-sm text-white"
                  ></textarea>
                </div>

                <div className="pt-4 border-t border-slate-850 flex justify-end gap-3 bg-[#141414]">
                  <button
                    type="button"
                    onClick={() => setIsActionModalOpen(false)}
                    className="px-4 py-2 border border-slate-800 text-gray-300 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs cursor-pointer"
                  >
                    Commit Activity
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TIMELINE VIEW DRAWER / MODAL */}
      <AnimatePresence>
        {isTimelineOpen && timelineLead && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141414] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-850 flex justify-between items-center bg-[#0d0d0d]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                    <Clock className="h-4 w-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Lead Journey & Audit Timeline</h3>
                    <p className="text-[10px] text-gray-500">Chronological history logs of status, moods, and actions.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTimelineOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {timelineLead.timeline && timelineLead.timeline.length > 0 ? (
                  <div className="relative border-l-2 border-slate-800 pl-5 ml-2.5 space-y-6">
                    {timelineLead.timeline.map((item, index) => (
                      <div key={index} className="relative space-y-1">
                        {/* Dot */}
                        <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-[#141414] shadow shadow-indigo-500/20"></span>
                        
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">{item.action}</span>
                          <span className="text-[9px] font-mono text-gray-500">{item.date} • {item.time}</span>
                        </div>
                        
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">{item.notes}</p>
                        
                        {item.previousValue && item.newValue && (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-900 rounded border border-slate-850 text-[9px] font-semibold text-gray-400">
                            <span>{item.previousValue}</span>
                            <span>➡️</span>
                            <span className="text-white font-bold">{item.newValue}</span>
                          </div>
                        )}

                        <div className="text-[9px] text-gray-550 flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3" /> Logged by: {item.user || 'AB Graphics Admin'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 space-y-3">
                    <Clock className="h-10 w-10 mx-auto text-slate-800" />
                    <p className="text-sm">No timeline logs found. Initializing automatically on first change.</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-850 flex justify-between items-center bg-[#0d0d0d]">
                <button
                  id={`detail-tg-lead-${timelineLead.id}`}
                  onClick={() => handleSendLeadTelegram(timelineLead)}
                  disabled={isTelegramSending[timelineLead.id]}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  {isTelegramSending[timelineLead.id] ? 'Sending to Telegram...' : 'Push to Telegram'}
                </button>
                <button
                  onClick={() => setIsTimelineOpen(false)}
                  className="px-5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Close Journey Trail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LEAD CONVERT TO PAID CLIENT MODAL */}
      <AnimatePresence>
        {isConvertOpen && convertingLead && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141414] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-850 flex justify-between items-center bg-[#0d0d0d]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white animate-pulse">Convert Lead to Paying Client</h3>
                    <p className="text-[10px] text-gray-500">Finalize paid campaign setup details for {convertingLead.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsConvertOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Scroll area */}
              <form onSubmit={handleConversionSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                
                {/* Photo Setup Section */}
                <div className="flex flex-col sm:flex-row gap-4 items-center bg-[#0d0d0d] p-4 rounded-xl border border-slate-850">
                  <div className="h-14 w-14 rounded-full bg-[#090909] border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    {cImagePreview ? (
                      <img 
                        src={cImagePreview} 
                        alt="Preview" 
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="h-6 w-6 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <p className="text-xs font-semibold text-white">Profile Photo</p>
                    <p className="text-[10px] text-gray-500">Provide an avatar or business branding photo.</p>
                    <label className="inline-block mt-2 px-3 py-1 bg-[#141414] hover:bg-[#1e1e1e] border border-slate-800 text-gray-350 hover:text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                      Upload Avatar
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                {/* Names Mapping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Client / Contact Name <span className="text-emerald-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Business / Company Name <span className="text-emerald-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={cBusinessName}
                      onChange={(e) => setCBusinessName(e.target.value)}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Contacts mapping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Calling Mobile <span className="text-emerald-400">*</span></label>
                    <input
                      type="tel"
                      required
                      value={cMobile}
                      onChange={(e) => setCMobile(e.target.value)}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">WhatsApp Contact <span className="text-emerald-400">*</span></label>
                    <input
                      type="tel"
                      required
                      value={cWhatsApp}
                      onChange={(e) => setCWhatsApp(e.target.value)}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Extra Info mapping */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Client Email Address <span className="text-emerald-400">*</span></label>
                    <input
                      type="email"
                      required
                      value={cEmail}
                      onChange={(e) => setCEmail(e.target.value)}
                      placeholder="Enter email for receipts & reports"
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">GST Registration No. (Optional)</label>
                    <input
                      type="text"
                      value={cGstNumber}
                      onChange={(e) => setCGstNumber(e.target.value)}
                      placeholder="GST Registration No."
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400">Client Physical Address</label>
                  <textarea
                    value={cAddress}
                    onChange={(e) => setCAddress(e.target.value)}
                    placeholder="Enter business location address"
                    rows={2}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2 text-sm text-white"
                  ></textarea>
                </div>

                {/* Contract terms mapping */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Campaign Start Date <span className="text-emerald-400">*</span></label>
                    <input
                      type="date"
                      required
                      value={cStartDate}
                      onChange={(e) => setCStartDate(e.target.value)}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Campaign Duration <span className="text-emerald-400">*</span></label>
                    <select
                      value={cPackageDuration}
                      onChange={(e) => setCPackageDuration(e.target.value)}
                      className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    >
                      <option value="1 Month">1 Month Campaign</option>
                      <option value="3 Months">3 Months Campaign</option>
                      <option value="6 Months">6 Months Campaign</option>
                      <option value="1 Year">1 Year Enterprise</option>
                      <option value="2 Years">2 Years Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Auto Expiry Calculation</label>
                    <input
                      type="text"
                      disabled
                      value={cExpiryDate}
                      className="mt-1 block w-full bg-[#090909] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-gray-500 font-mono"
                    />
                  </div>
                </div>

                {/* Package Setup Section */}
                <div className="bg-[#0d0d0d] p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-850 pb-2.5">
                    <div className="p-1 bg-emerald-500/10 rounded-md border border-emerald-500/20 text-emerald-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Package Specification Setup</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Package Blueprint Selection <span className="text-emerald-400">*</span></label>
                      <select
                        value={cPackageType}
                        onChange={(e) => handleCPackageTypeChange(e.target.value as any)}
                        className="mt-1 block w-full bg-[#141414] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="Basic">Basic Package (₹10,000/M)</option>
                        <option value="Advance">Advance Package (₹25,000/M)</option>
                        <option value="Pro">Pro Package (₹50,000/M)</option>
                        <option value="Custom">Custom Scope</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Package Cost (INR) <span className="text-emerald-400">*</span></label>
                      <input
                        type="number"
                        required
                        value={cPackagePrice || ''}
                        onChange={(e) => setCPackagePrice(Number(e.target.value))}
                        placeholder="e.g. 15000"
                        className="mt-1 block w-full bg-[#141414] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                      />
                    </div>
                  </div>

                  {cPackageType === 'Custom' && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <label className="block text-xs font-medium text-emerald-400">Custom Package Identification Name</label>
                      <input
                        type="text"
                        required
                        value={cCustomPackageName}
                        onChange={(e) => setCCustomPackageName(e.target.value)}
                        placeholder="e.g. Custom Corporate Launch"
                        className="mt-1 block w-full bg-[#141414] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </motion.div>
                  )}

                  {/* Services Checkboxes Selection */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-semibold text-gray-400">
                      Services Included in Package ({cSelectedServices.length} selected)
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 bg-[#141414] border border-slate-850 rounded-xl">
                      {AVAILABLE_SERVICES.map(service => {
                        const isSelected = cSelectedServices.includes(service);
                        return (
                          <button
                            key={service}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setCSelectedServices(cSelectedServices.filter(s => s !== service));
                              } else {
                                setCSelectedServices([...cSelectedServices, service]);
                              }
                            }}
                            className={`px-3 py-2 text-left rounded-lg text-xs font-medium border flex items-center gap-2.5 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                                : 'bg-[#0d0d0d] border-slate-850 text-gray-550 hover:text-gray-300'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-emerald-400' : 'bg-gray-800'}`}></span>
                            <span className="truncate">{service}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Initial Onboarding Payment log */}
                <div className="bg-[#0d0d0d] p-5 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-850 pb-2.5">
                    <div className="p-1 bg-emerald-500/10 rounded-md border border-emerald-500/20 text-emerald-400">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Initial Onboarding Payment (Optional)</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Received Amount (INR)</label>
                      <input
                        type="number"
                        value={cInitialPaymentAmount || ''}
                        onChange={(e) => setCInitialPaymentAmount(Number(e.target.value))}
                        placeholder="e.g. 5000"
                        className="mt-1 block w-full bg-[#141414] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Payment Channel</label>
                      <select
                        value={cInitialPaymentMode}
                        onChange={(e) => setCInitialPaymentMode(e.target.value as any)}
                        className="mt-1 block w-full bg-[#141414] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="UPI">UPI (GooglePay/PhonePe)</option>
                        <option value="Cash">Cash Ledger</option>
                        <option value="Bank Transfer">Bank Wire Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Receipt Type</label>
                      <select
                        value={cInitialPaymentType}
                        onChange={(e) => setCInitialPaymentType(e.target.value as any)}
                        className="mt-1 block w-full bg-[#141414] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="Advance">Advance Account</option>
                        <option value="Full Payment">Settled Full</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400">Receipt Memo & Transaction Notes</label>
                    <input
                      type="text"
                      value={cInitialPaymentNotes}
                      onChange={(e) => setCInitialPaymentNotes(e.target.value)}
                      placeholder="e.g. UPI Transaction Reference ID"
                      className="mt-1 block w-full bg-[#141414] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400">Campaign Notes & Directives</label>
                  <textarea
                    value={cNotes}
                    onChange={(e) => setCNotes(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-slate-850 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
                  ></textarea>
                </div>

                {/* Form Controls */}
                <div className="pt-4 border-t border-slate-850 flex justify-end gap-3 bg-[#141414]">
                  <button
                    type="button"
                    onClick={() => setIsConvertOpen(false)}
                    className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-gray-300 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    Confirm Convert <UserPlus className="h-4 w-4" />
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION CONTAINER */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/90 border-rose-500/30 text-rose-300'
        }`}>
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

    </div>
  );
};
