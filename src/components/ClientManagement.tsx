import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { calculateExpiryDate, formatCurrency, formatDate } from '../utils';
import { Client, Payment, ClientPackage } from '../types';
import { defaultLogo, defaultQr } from '../defaultAssets';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Eye, 
  MessageSquare, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  Building, 
  X,
  User,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Lock,
  CreditCard,
  DollarSign,
  History,
  AlertCircle,
  PlusCircle,
  Share2,
  Send,
  RefreshCw,
  FileText,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';

export const AVAILABLE_SERVICES = [
  'Reel Shooting',
  'Reel Editing',
  'Meta Ads',
  'Google Ads',
  'Instagram Handling',
  'Facebook Handling',
  'Poster Design',
  'WhatsApp Status Poster',
  'Logo Design',
  'Website Development',
  'WhatsApp Automation',
  'Visiting Card Design',
  'Visiting Card Printing',
  'Banner Design',
  'Banner Printing',
  'Photography',
  'Video Shoot',
  'Event Coverage',
  'Custom Service'
];

export const ClientManagement: React.FC = () => {
  const { 
    clients, 
    addClient, 
    updateClient, 
    deleteClient, 
    logActivity, 
    sendTelegramNotification, 
    addTask,
    followUps,
    addFollowUp,
    updateFollowUp,
    deleteFollowUp,
    brandSettings
  } = useCRM();

  // Action state trackers
  const [isTelegramSending, setIsTelegramSending] = useState<Record<string, boolean>>({});
  const [isFollowUpTelegramSending, setIsFollowUpTelegramSending] = useState<Record<string, boolean>>({});

  const handleSendFollowUpTelegram = async (f: any) => {
    setIsFollowUpTelegramSending(prev => ({ ...prev, [f.id]: true }));
    try {
      await sendTelegramNotification("", "followup_created", f);
      alert(`Success: Telegram notification sent for scheduled task!`);
    } catch (err: any) {
      console.error("Failed to send Telegram follow-up:", err);
      alert(`Error sending Telegram follow-up: ${err.message || err}`);
    } finally {
      setIsFollowUpTelegramSending(prev => ({ ...prev, [f.id]: false }));
    }
  };
  
  // Follow-up modal state
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [followUpClient, setFollowUpClient] = useState<Client | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [followUpType, setFollowUpType] = useState<'Call' | 'Meeting' | 'Proposal' | 'Other'>('Call');
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpPriority, setFollowUpPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [followUpStatus, setFollowUpStatus] = useState<'Pending' | 'Completed' | 'Missed' | 'Rescheduled'>('Pending');

  // Inline rescheduling states
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newReschedDate, setNewReschedDate] = useState('');
  const [newReschedTime, setNewReschedTime] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Renew Package modal state
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewClient, setRenewClient] = useState<Client | null>(null);
  const [renewStartDate, setRenewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [renewDuration, setRenewDuration] = useState('1 Month');
  const [renewPrice, setRenewPrice] = useState(0);
  const [renewPaymentReceived, setRenewPaymentReceived] = useState(0);
  const [renewPaymentMode, setRenewPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('UPI');
  const [renewPaymentNotes, setRenewPaymentNotes] = useState('');

  // Invoice modal state
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceClient, setInvoiceClient] = useState<Client | null>(null);

  // Send Telegram profile update handler
  const handleSendTelegramUpdate = async (client: Client) => {
    setIsTelegramSending(prev => ({ ...prev, [client.id]: true }));
    try {
      await sendTelegramNotification("", "client_updated", client);
      alert(`Success: Telegram notification sent for ${client.name}!`);
    } catch (err: any) {
      console.error("Failed to send Telegram update:", err);
      alert(`Error sending Telegram update: ${err.message || err}`);
    } finally {
      setIsTelegramSending(prev => ({ ...prev, [client.id]: false }));
    }
  };

  // Follow-up task submission handler
  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpClient) return;
    try {
      await addFollowUp({
        clientId: followUpClient.id,
        clientName: followUpClient.name,
        businessName: followUpClient.businessName,
        mobile: followUpClient.mobile,
        followUpDate: followUpDate,
        followUpTime: followUpTime,
        followUpType: followUpType,
        reason: followUpReason || followUpTitle || 'General Follow-up',
        notes: followUpNotes,
        priority: followUpPriority,
        status: followUpStatus
      });
      setIsFollowUpOpen(false);
      setFollowUpClient(null);
      // Reset form fields
      setFollowUpReason('');
      setFollowUpNotes('');
      setFollowUpPriority('Medium');
      setFollowUpStatus('Pending');
      setFollowUpTime('10:00');
      alert(`Success: Follow-up scheduled successfully for ${followUpClient.name}!`);
    } catch (err: any) {
      console.error(err);
      alert(`Error scheduling follow-up: ${err.message || err}`);
    }
  };

  // Package renewal submission handler
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewClient) return;

    try {
      const calculatedExpiry = calculateExpiryDate(renewStartDate, renewDuration);
      
      // Calculate payment update
      let updatedPayments = [...(renewClient.payments || [])];
      let newPayment: Payment | null = null;
      if (renewPaymentReceived > 0) {
        newPayment = {
          id: 'pay_' + Date.now(),
          amount: Number(renewPaymentReceived),
          date: renewStartDate,
          mode: renewPaymentMode,
          type: 'Advance',
          notes: renewPaymentNotes || 'Campaign renewal advance'
        };
        updatedPayments.push(newPayment);
      }

      const totalReceived = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newPrice = Number(renewPrice);
      const calculatedPending = Math.max(0, newPrice - (renewPaymentReceived || 0));
      const computedPaymentStatus = calculatedPending <= 0 ? 'Paid' : 'Pending';

      const updatedClientData: Partial<Client> = {
        startDate: renewStartDate,
        packageDuration: renewDuration,
        expiryDate: calculatedExpiry,
        status: 'Active',
        payments: updatedPayments,
        revenue: totalReceived,
        pendingAmount: calculatedPending,
        paymentStatus: computedPaymentStatus,
        packageDetails: {
          type: renewClient.packageDetails?.type || 'Custom',
          customName: renewClient.packageDetails?.customName || 'Custom Package',
          price: newPrice,
          duration: renewDuration,
          services: renewClient.packageDetails?.services || []
        }
      };

      await updateClient(renewClient.id, updatedClientData);
      
      setIsRenewOpen(false);
      setRenewClient(null);
      alert(`Success: Campaign renewed successfully for ${renewClient.name}!`);
    } catch (err: any) {
      console.error(err);
      alert(`Error renewing campaign: ${err.message || err}`);
    }
  };

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Expired'>('All');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form Fields State
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsApp, setWhatsApp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [packageDuration, setPackageDuration] = useState('1 Month');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Package & Services Form States
  const [packageType, setPackageType] = useState<'Basic' | 'Advance' | 'Pro' | 'Custom'>('Basic');
  const [customPackageName, setCustomPackageName] = useState('');
  const [packagePrice, setPackagePrice] = useState(10000); // Package price (INR)
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  // Initial Onboarding Payment States
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number>(0);
  const [initialPaymentMode, setInitialPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('UPI');
  const [initialPaymentType, setInitialPaymentType] = useState<'Advance' | 'Full Payment'>('Advance');
  const [initialPaymentNotes, setInitialPaymentNotes] = useState('');

  // Client Details Tab
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'package' | 'payments' | 'followups'>('overview');

  // New payment log states inside detail modal
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('UPI');
  const [payType, setPayType] = useState<'Advance' | 'Installment' | 'Full Payment' | 'Other'>('Installment');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);

  // Update detail view reference if selectedClient changes in overall state
  useEffect(() => {
    if (selectedClient) {
      const updated = clients.find(c => c.id === selectedClient.id);
      if (updated) {
        setSelectedClient(updated);
      }
    }
  }, [clients, selectedClient]);

  // Handle Form open for Add
  const openAddModal = () => {
    setEditingClient(null);
    setName('');
    setBusinessName('');
    setMobile('');
    setWhatsApp('');
    setEmail('');
    setAddress('');
    setGstNumber('');
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setPackageDuration('1 Month');
    setExpiryDate(calculateExpiryDate(today, '1 Month'));
    setNotes('');
    setImageFile(null);
    setImagePreview('');
    
    // Default package is Basic
    setPackageType('Basic');
    setCustomPackageName('');
    setPackagePrice(10000);
    setSelectedServices([
      'Instagram Handling',
      'Facebook Handling',
      'Poster Design',
      'WhatsApp Status Poster'
    ]);
    
    // Initial Payment Reset
    setInitialPaymentAmount(0);
    setInitialPaymentMode('UPI');
    setInitialPaymentType('Advance');
    setInitialPaymentNotes('');

    setIsFormOpen(true);
  };

  // Handle Form open for Edit
  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setBusinessName(client.businessName);
    setMobile(client.mobile);
    setWhatsApp(client.whatsApp);
    setEmail(client.email);
    setAddress(client.address);
    setGstNumber(client.gstNumber || '');
    setStartDate(client.startDate);
    setPackageDuration(client.packageDuration);
    setExpiryDate(client.expiryDate);
    setNotes(client.notes);
    setImageFile(null);
    setImagePreview(client.profilePhoto || '');

    // Load Package Details
    if (client.packageDetails) {
      setPackageType(client.packageDetails.type);
      setCustomPackageName(client.packageDetails.customName || '');
      setPackagePrice(client.packageDetails.price);
      setSelectedServices(client.packageDetails.services || []);
    } else {
      // Backward compatibility fallback
      setPackageType('Custom');
      setCustomPackageName('Standard Campaign');
      setPackagePrice((client.revenue || 0) + (client.pendingAmount || 0));
      setSelectedServices([]);
    }

    setIsFormOpen(true);
  };

  // Auto-fill defaults when package changes
  const handlePackageTypeChange = (type: 'Basic' | 'Advance' | 'Pro' | 'Custom') => {
    setPackageType(type);
    if (type === 'Basic') {
      setPackagePrice(10000);
      setPackageDuration('1 Month');
      setSelectedServices([
        'Instagram Handling',
        'Facebook Handling',
        'Poster Design',
        'WhatsApp Status Poster'
      ]);
    } else if (type === 'Advance') {
      setPackagePrice(25000);
      setPackageDuration('3 Months');
      setSelectedServices([
        'Reel Shooting',
        'Reel Editing',
        'Meta Ads',
        'Instagram Handling',
        'Facebook Handling',
        'Poster Design',
        'WhatsApp Status Poster'
      ]);
    } else if (type === 'Pro') {
      setPackagePrice(50000);
      setPackageDuration('6 Months');
      setSelectedServices([
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
      setCustomPackageName('');
      setPackagePrice(0);
      setPackageDuration('1 Month');
      setSelectedServices([]);
    }
  };

  // Auto calculate expiry date when startDate or packageDuration changes
  useEffect(() => {
    if (startDate && packageDuration) {
      setExpiryDate(calculateExpiryDate(startDate, packageDuration));
    }
  }, [startDate, packageDuration]);

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let currentPayments: Payment[] = editingClient?.payments || [];

      // Create initial payment if adding a new client with a payment amount
      if (!editingClient && initialPaymentAmount > 0) {
        currentPayments = [{
          id: 'pay_' + Date.now(),
          amount: Number(initialPaymentAmount),
          date: startDate,
          mode: initialPaymentMode,
          type: initialPaymentType === 'Full Payment' ? 'Full Payment' : 'Advance',
          notes: initialPaymentNotes || 'Onboarding package advance'
        }];
      }

      // Calculations
      const totalReceived = currentPayments.reduce((sum, p) => sum + p.amount, 0);
      const finalPackagePrice = Number(packagePrice);
      const calculatedPending = Math.max(0, finalPackagePrice - totalReceived);
      const computedPaymentStatus = calculatedPending <= 0 ? 'Paid' : 'Pending';

      const clientData = {
        name,
        businessName,
        mobile,
        whatsApp,
        email,
        address,
        gstNumber: gstNumber || undefined,
        startDate,
        packageDuration,
        expiryDate,
        notes,
        revenue: totalReceived,
        pendingAmount: calculatedPending,
        paymentStatus: computedPaymentStatus,
        profilePhoto: imagePreview || '',
        packageDetails: {
          type: packageType,
          customName: packageType === 'Custom' ? customPackageName || 'Custom Package' : `${packageType} Package`,
          price: finalPackagePrice,
          duration: packageDuration,
          services: selectedServices
        },
        payments: currentPayments
      };

      if (editingClient) {
        await updateClient(editingClient.id, clientData, imageFile);
      } else {
        await addClient(clientData, imageFile);
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error("Form submit error:", err);
      alert("Failed to save client: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDeleteClient = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteClient(deleteConfirmId);
      setDeleteConfirmId(null);
      alert("Success: Client and all associated records have been permanently deleted.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete client: " + (err.message || err));
    }
  };

  // Payment log inside Detail Modal
  const handleAddNewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const newPayment: Payment = {
        id: 'pay_' + Date.now(),
        amount: Number(payAmount),
        date: payDate,
        mode: payMode,
        type: payType,
        notes: payNotes || undefined
      };

      const existingPayments = selectedClient.payments || [];
      const updatedPayments = [...existingPayments, newPayment];

      const packageVal = selectedClient.packageDetails?.price || (selectedClient.revenue + selectedClient.pendingAmount) || 0;
      const totalReceived = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const calculatedPending = Math.max(0, packageVal - totalReceived);
      const computedPaymentStatus = calculatedPending <= 0 ? 'Paid' : 'Pending';

      const updatedClientData: Partial<Client> = {
        payments: updatedPayments,
        revenue: totalReceived,
        pendingAmount: calculatedPending,
        paymentStatus: computedPaymentStatus
      };

      await updateClient(selectedClient.id, updatedClientData);

      // Reset transaction form
      setPayAmount(0);
      setPayNotes('');
      setPayType('Installment');
      setPayDate(new Date().toISOString().split('T')[0]);
      setShowAddPaymentForm(false);

      // Update local detailed view reference
      setSelectedClient({
        ...selectedClient,
        ...updatedClientData
      });

      await logActivity('payment_updated', `Added payment of ${formatCurrency(newPayment.amount)} via ${newPayment.mode} for ${selectedClient.name}`);
    } catch (err) {
      console.error(err);
      alert("Failed to record payment transaction");
    }
  };

  const handleDeletePaymentRecord = async (paymentId: string) => {
    if (!selectedClient || !window.confirm("Are you sure you want to delete this payment record? The ledger will recompute.")) return;

    try {
      const existingPayments = selectedClient.payments || [];
      const updatedPayments = existingPayments.filter(p => p.id !== paymentId);

      const packageVal = selectedClient.packageDetails?.price || (selectedClient.revenue + selectedClient.pendingAmount) || 0;
      const totalReceived = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const calculatedPending = Math.max(0, packageVal - totalReceived);
      const computedPaymentStatus = calculatedPending <= 0 ? 'Paid' : 'Pending';

      const updatedClientData: Partial<Client> = {
        payments: updatedPayments,
        revenue: totalReceived,
        pendingAmount: calculatedPending,
        paymentStatus: computedPaymentStatus
      };

      await updateClient(selectedClient.id, updatedClientData);

      setSelectedClient({
        ...selectedClient,
        ...updatedClientData
      });

      await logActivity('payment_updated', `Removed a payment record for ${selectedClient.name}`);
    } catch (err) {
      console.error(err);
      alert("Failed to delete payment transaction");
    }
  };

  // Filter & Search Logic
  const filteredClients = clients.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm);

    const matchesStatus = 
      statusFilter === 'All' || 
      c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Active Client Base</h2>
          <p className="text-sm text-gray-500 mt-1">Total of {clients.length} campaign accounts on file.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer text-sm transition-all duration-200 shrink-0"
        >
          <Plus className="h-5 w-5" /> Add Client
        </button>
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clients by name, business, phone or email..."
            className="w-full pl-11 pr-4 py-3 bg-[#141414] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
          />
        </div>
        
        {/* Status Filters */}
        <div className="flex bg-[#141414] p-1.5 rounded-xl border border-emerald-900/10 self-start md:self-auto shrink-0">
          {(['All', 'Active', 'Expired'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-emerald-500/5'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-12 text-center text-gray-400 space-y-4">
          <User className="h-12 w-12 mx-auto text-emerald-900/30" />
          <div>
            <h3 className="text-lg font-bold text-white">No clients found</h3>
            <p className="text-sm mt-1">Try refining your search terms or create a brand new client account.</p>
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#0d0d0d] border border-emerald-900/20 hover:border-emerald-500/20 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Create client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const finalPkgPrice = client.packageDetails?.price || (client.revenue + client.pendingAmount) || 0;
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={client.id}
                className="bg-[#141414] border border-emerald-900/10 hover:border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between transition-all duration-300"
              >
                {/* Client Card Header */}
                <div 
                  onClick={() => { setSelectedClient(client); setActiveDetailTab('overview'); setIsDetailOpen(true); }}
                  className="flex gap-4 items-start pb-4 border-b border-emerald-900/10 cursor-pointer group"
                >
                  <div className="h-14 w-14 rounded-xl bg-[#0d0d0d] border border-emerald-900/10 overflow-hidden flex items-center justify-center shrink-0 group-hover:border-emerald-500/40 transition-colors">
                    {client.profilePhoto ? (
                      <img 
                        src={client.profilePhoto} 
                        alt={client.name} 
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-xl font-bold text-emerald-400 uppercase">{client.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 relative">
                    <div className="flex justify-between items-start gap-1">
                      <h3 className="text-base font-bold text-white truncate leading-tight group-hover:text-emerald-400 transition-colors">{client.name}</h3>
                      <Eye className="h-4 w-4 text-gray-500 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" title="View Profile" />
                    </div>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-1">
                      <Building className="h-3.5 w-3.5 shrink-0" /> {client.businessName}
                    </p>
                    
                    {/* Active/Expired Status Badge */}
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        client.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {client.status}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        client.paymentStatus === 'Paid'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {client.paymentStatus === 'Paid' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Client Info Details */}
                <div 
                  onClick={() => { setSelectedClient(client); setActiveDetailTab('overview'); setIsDetailOpen(true); }}
                  className="py-4 space-y-2 text-xs text-gray-300 flex-1 cursor-pointer"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Contact Number:</span>
                    <span className="font-mono">{client.mobile}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Package Type:</span>
                    <span className="font-semibold">{client.packageDetails?.type || 'Custom'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Package Value:</span>
                    <span className="font-semibold text-white">{formatCurrency(finalPkgPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Expiry Date:</span>
                    <span className={`font-semibold ${client.status === 'Expired' ? 'text-rose-400' : 'text-gray-200'}`}>
                      {formatDate(client.expiryDate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">Total Received:</span>
                    <span className="font-bold text-emerald-400">{formatCurrency(client.revenue || 0)}</span>
                  </div>
                </div>

                {/* 7 Action Buttons Grid */}
                <div className="pt-4 border-t border-emerald-900/10 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest">Client Console</span>
                    <div className="flex gap-1.5">
                      <a
                        href={`https://wa.me/${client.whatsApp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 rounded-md transition-all text-[10px] font-bold flex items-center gap-1"
                        title="WhatsApp Chat"
                      >
                        <MessageSquare className="h-3 w-3 shrink-0" /> WA
                      </a>
                      <a
                        href={`tel:${client.mobile}`}
                        className="p-1 bg-[#0d0d0d] hover:bg-[#1e1e1e] border border-emerald-900/10 text-gray-400 hover:text-white rounded-md transition-colors flex items-center"
                        title="Call Mobile"
                      >
                        <Phone className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                    {/* 1. Send Telegram Update */}
                    <button
                      id={`tg-update-${client.id}`}
                      onClick={() => handleSendTelegramUpdate(client)}
                      disabled={isTelegramSending[client.id]}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 hover:bg-emerald-500 border border-emerald-500/10 hover:border-emerald-500 text-emerald-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer truncate"
                      title="Push client details to Telegram Group"
                    >
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      {isTelegramSending[client.id] ? 'Sending...' : 'Push to Telegram'}
                    </button>

                    {/* 2. Add Payment */}
                    <button
                      id={`add-pay-${client.id}`}
                      onClick={() => {
                        setSelectedClient(client);
                        setActiveDetailTab('payments');
                        setShowAddPaymentForm(true);
                        setIsDetailOpen(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-sky-500/5 hover:bg-sky-500 border border-sky-500/10 hover:border-sky-500 text-sky-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer truncate"
                      title="Log Campaign Income Transaction"
                    >
                      <CreditCard className="h-3.5 w-3.5 shrink-0" />
                      Add Payment
                    </button>

                    {/* 3. Schedule Follow-up */}
                    <button
                      id={`follow-up-${client.id}`}
                      onClick={() => {
                        setFollowUpClient(client);
                        setFollowUpTitle(`Follow-up: ${client.name}`);
                        setFollowUpNotes(`Discuss campaign deliverables and overall client satisfaction.`);
                        setIsFollowUpOpen(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 hover:bg-amber-500 border border-amber-500/10 hover:border-amber-500 text-amber-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer truncate"
                      title="Create Follow-up Reminder Task"
                    >
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      Follow-up
                    </button>

                    {/* 4. Renew Package */}
                    <button
                      id={`renew-${client.id}`}
                      onClick={() => {
                        setRenewClient(client);
                        setRenewStartDate(client.expiryDate);
                        setRenewDuration(client.packageDuration);
                        setRenewPrice(client.packageDetails?.price || 0);
                        setRenewPaymentReceived(0);
                        setRenewPaymentNotes(`Campaign renewal payment`);
                        setIsRenewOpen(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-indigo-500/5 hover:bg-indigo-500 border border-indigo-500/10 hover:border-indigo-500 text-indigo-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer truncate"
                      title="Renew Campaign Package"
                    >
                      <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                      Renew Package
                    </button>

                    {/* 5. Edit Client */}
                    <button
                      id={`edit-${client.id}`}
                      onClick={() => openEditModal(client)}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-500/5 hover:bg-purple-500 border border-purple-500/10 hover:border-purple-500 text-purple-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer truncate"
                      title="Modify Campaign Parameters"
                    >
                      <Edit className="h-3.5 w-3.5 shrink-0" />
                      Edit Client
                    </button>

                    {/* 6. Generate Invoice */}
                    <button
                      id={`invoice-${client.id}`}
                      onClick={() => {
                        setInvoiceClient(client);
                        setIsInvoiceOpen(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-teal-500/5 hover:bg-teal-500 border border-teal-500/10 hover:border-teal-500 text-teal-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer truncate"
                      title="Print or Download Corporate Invoice"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      Invoice
                    </button>

                    {/* 7. Delete Client */}
                    <button
                      id={`delete-${client.id}`}
                      onClick={() => handleDelete(client.id)}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 hover:border-rose-500 text-rose-400 hover:text-white rounded-xl transition-all cursor-pointer truncate col-span-2"
                      title="Permanently Delete Client Campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      Delete Client
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ADD/EDIT CLIENT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/10 bg-[#0d0d0d]">
              <h3 className="text-lg font-bold text-white">
                {editingClient ? 'Edit Client Campaign' : 'Create Client Campaign'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Scroll Area */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Photo Upload Section */}
              <div className="flex flex-col sm:flex-row gap-4 items-center bg-[#0d0d0d] p-4 rounded-xl border border-emerald-900/10">
                <div className="h-16 w-16 rounded-full bg-[#090909] border border-emerald-900/20 overflow-hidden flex items-center justify-center shrink-0 relative group">
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="h-7 w-7 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <p className="text-xs font-semibold text-white">Profile Photo</p>
                  <p className="text-[10px] text-gray-500">Supported formats: JPG, PNG. Max 5MB.</p>
                  <label className="inline-block mt-2 px-3 py-1 bg-[#141414] hover:bg-[#1e1e1e] border border-emerald-900/20 text-gray-300 hover:text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                    Upload Photo
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Client Name <span className="text-emerald-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter Client Name"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Business Name <span className="text-emerald-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. AB Graphics Studio"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Mobile Number <span className="text-emerald-400">*</span></label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">WhatsApp Number <span className="text-emerald-400">*</span></label>
                  <input
                    type="tel"
                    required
                    value={whatsApp}
                    onChange={(e) => setWhatsApp(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Email and Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Email Address <span className="text-emerald-400">*</span></label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. client@example.com"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">GST Number (Optional)</label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 27AAAAA0000A1Z"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400">Office / Physical Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter physical address details"
                  rows={2}
                  className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                ></textarea>
              </div>

              {/* Contract Start and Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Start Date <span className="text-emerald-400">*</span></label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Campaign Duration <span className="text-emerald-400">*</span></label>
                  <select
                    value={packageDuration}
                    onChange={(e) => setPackageDuration(e.target.value)}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="1 Month">1 Month Campaign</option>
                    <option value="3 Months">3 Months Campaign</option>
                    <option value="6 Months">6 Months Campaign</option>
                    <option value="1 Year">1 Year Enterprise</option>
                    <option value="2 Years">2 Years Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Expiry Date (Auto-Calculated)</label>
                  <input
                    type="text"
                    disabled
                    value={expiryDate}
                    className="mt-1 block w-full bg-[#0d0d0d]/60 border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm text-gray-500 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Package Management Module */}
              <div className="bg-[#0d0d0d] p-5 rounded-2xl border border-emerald-500/10 space-y-4">
                <div className="flex items-center gap-2 border-b border-emerald-900/15 pb-2.5">
                  <div className="p-1 bg-emerald-500/10 rounded-md border border-emerald-500/20 text-emerald-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Package Specification Setup</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Package Blueprint Selection <span className="text-emerald-400">*</span></label>
                    <select
                      value={packageType}
                      onChange={(e) => handlePackageTypeChange(e.target.value as any)}
                      className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="Basic">Basic Package (Default)</option>
                      <option value="Advance">Advance Package (Default)</option>
                      <option value="Pro">Pro Package (Default)</option>
                      <option value="Custom">Custom Package</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400">Package Cost (INR) <span className="text-emerald-400">*</span></label>
                    <input
                      type="number"
                      required
                      value={packagePrice}
                      onChange={(e) => setPackagePrice(Number(e.target.value))}
                      placeholder="e.g. 15000"
                      className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                {packageType === 'Custom' && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="block text-xs font-medium text-gray-400 font-semibold text-emerald-400">Custom Package Identification Name</label>
                    <input
                      type="text"
                      required
                      value={customPackageName}
                      onChange={(e) => setCustomPackageName(e.target.value)}
                      placeholder="e.g. VIP Double Social Blast"
                      className="mt-1 block w-full bg-[#141414] border border-emerald-900/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </motion.div>
                )}

                {/* Services Checkboxes Selection */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-gray-400">
                    Services Included in Package ({selectedServices.length} selected)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 bg-[#141414] border border-emerald-900/10 rounded-xl">
                    {AVAILABLE_SERVICES.map(service => {
                      const isSelected = selectedServices.includes(service);
                      return (
                        <button
                          key={service}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedServices(selectedServices.filter(s => s !== service));
                            } else {
                              setSelectedServices([...selectedServices, service]);
                            }
                          }}
                          className={`px-3 py-2 text-left rounded-lg text-xs font-medium border flex items-center gap-2.5 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                              : 'bg-[#0d0d0d] border-emerald-950 text-gray-500 hover:text-gray-300 hover:border-emerald-900/50'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-800'}`}></span>
                          <span className="truncate">{service}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Initial Payment logging only during creation */}
              {!editingClient && (
                <div className="bg-[#0d0d0d] p-5 rounded-2xl border border-emerald-500/10 space-y-4">
                  <div className="flex items-center gap-2 border-b border-emerald-900/15 pb-2.5">
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
                        value={initialPaymentAmount}
                        onChange={(e) => setInitialPaymentAmount(Number(e.target.value))}
                        placeholder="e.g. 5000"
                        className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Payment Channel</label>
                      <select
                        value={initialPaymentMode}
                        onChange={(e) => setInitialPaymentMode(e.target.value as any)}
                        className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                      >
                        <option value="UPI">UPI (GooglePay/PhonePe)</option>
                        <option value="Cash">Cash Ledger</option>
                        <option value="Bank Transfer">Bank Wire Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400">Receipt Type</label>
                      <select
                        value={initialPaymentType}
                        onChange={(e) => setInitialPaymentType(e.target.value as any)}
                        className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
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
                      value={initialPaymentNotes}
                      onChange={(e) => setInitialPaymentNotes(e.target.value)}
                      placeholder="e.g. Received via GPay, screen share verified."
                      className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400">Campaign Notes & Strategy</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Focus on SEO, social graphics and weekly Facebook leads campaign."
                  rows={3}
                  className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-emerald-900/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-emerald-900/20 hover:border-emerald-500/20 text-gray-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md"
                >
                  Save Campaign
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* CLIENT DETAIL VIEW MODAL */}
      {isDetailOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Detail Header */}
            <div className="px-6 py-5 border-b border-emerald-900/10 flex justify-between items-start bg-[#0d0d0d]">
              <div className="flex gap-4 items-center">
                <div className="h-14 w-14 rounded-xl bg-[#090909] border border-emerald-900/10 overflow-hidden flex items-center justify-center shrink-0">
                  {selectedClient.profilePhoto ? (
                    <img 
                      src={selectedClient.profilePhoto} 
                      alt={selectedClient.name} 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-xl font-bold text-emerald-400 uppercase">{selectedClient.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-snug">{selectedClient.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Building className="h-3.5 w-3.5" /> {selectedClient.businessName}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* TAB SELECTOR BAR */}
            <div className="flex border-b border-emerald-900/15 bg-[#0d0d0d] px-6">
              {(['overview', 'package', 'payments', 'followups'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveDetailTab(tab);
                    setShowAddPaymentForm(false);
                  }}
                  className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                    activeDetailTab === tab
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab === 'overview' 
                    ? 'Overview' 
                    : tab === 'package' 
                    ? 'Package Blueprint' 
                    : tab === 'payments' 
                    ? 'Payment Ledger' 
                    : 'Follow-ups'}
                </button>
              ))}
            </div>

            {/* Detail Body (Dynamic Tab rendering) */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              
              {activeDetailTab === 'overview' && (
                <motion.div 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Campaign status metrics */}
                  <div className="grid grid-cols-2 gap-4 bg-[#0d0d0d] p-4 border border-emerald-900/10 rounded-xl text-center">
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase">Campaign Status</p>
                      <span className={`inline-block mt-1.5 px-3 py-1 text-xs font-bold rounded-full ${
                        selectedClient.status === 'Active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {selectedClient.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold uppercase">Payment Balance Status</p>
                      <span className={`inline-block mt-1.5 px-3 py-1 text-xs font-bold rounded-full ${
                        selectedClient.paymentStatus === 'Paid' 
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {selectedClient.paymentStatus === 'Paid' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Textual Specs Grid */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-emerald-400 tracking-wider uppercase border-b border-emerald-900/10 pb-1.5">Contact Specifications</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Email Address</p>
                        <p className="text-white flex items-center gap-1.5">
                          <Mail className="h-4 w-4 text-gray-500" /> {selectedClient.email}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Mobile Phone</p>
                        <p className="text-white flex items-center gap-1.5 font-mono">
                          <Phone className="h-4 w-4 text-gray-500" /> {selectedClient.mobile}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">WhatsApp Contact</p>
                        <p className="text-white flex items-center gap-1.5 font-mono">
                          <MessageSquare className="h-4 w-4 text-emerald-400" /> {selectedClient.whatsApp}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">GST Registration No.</p>
                        <p className="text-white font-mono">
                          {selectedClient.gstNumber || 'No GST Registered'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm pt-2">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Physical Address
                      </p>
                      <p className="text-white leading-relaxed">{selectedClient.address || 'No physical address stored.'}</p>
                    </div>
                  </div>

                  {/* Notes Details */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 tracking-wider uppercase border-b border-emerald-900/10 pb-1.5">Campaign Objectives & Strategy Directive</h4>
                    <p className="text-sm text-gray-300 bg-[#0d0d0d] p-4 border border-emerald-900/10 rounded-xl leading-relaxed italic">
                      "{selectedClient.notes || 'No objectives stated.'}"
                    </p>
                  </div>

                  {/* Client Action Center Grid */}
                  <div className="space-y-3 pt-4 border-t border-emerald-900/10">
                    <h4 className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Client Action Center</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                      {/* 1. Send Telegram Update */}
                      <button
                        id={`detail-tg-${selectedClient.id}`}
                        onClick={() => handleSendTelegramUpdate(selectedClient)}
                        disabled={isTelegramSending[selectedClient.id]}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-500/5 hover:bg-emerald-500 border border-emerald-500/10 hover:border-emerald-500 text-emerald-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                      >
                        <Send className="h-4 w-4 shrink-0" />
                        {isTelegramSending[selectedClient.id] ? 'Sending to Telegram...' : 'Push to Telegram'}
                      </button>

                      {/* 2. Add Payment */}
                      <button
                        id={`detail-pay-${selectedClient.id}`}
                        onClick={() => {
                          setActiveDetailTab('payments');
                          setShowAddPaymentForm(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-sky-500/5 hover:bg-sky-500 border border-sky-500/10 hover:border-sky-500 text-sky-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                      >
                        <CreditCard className="h-4 w-4 shrink-0" />
                        Add Payment
                      </button>

                      {/* 3. Schedule Follow-up */}
                      <button
                        id={`detail-follow-${selectedClient.id}`}
                        onClick={() => {
                          setFollowUpClient(selectedClient);
                          setFollowUpReason(`Discuss campaign details with ${selectedClient.name}`);
                          setFollowUpType('Call');
                          setFollowUpPriority('Medium');
                          setFollowUpTime('10:00');
                          setFollowUpNotes(`Discuss campaign deliverables and overall client satisfaction.`);
                          setIsFollowUpOpen(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-500/5 hover:bg-amber-500 border border-amber-500/10 hover:border-amber-500 text-amber-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                      >
                        <Calendar className="h-4 w-4 shrink-0" />
                        Schedule Follow-up
                      </button>

                      {/* 4. Renew Package */}
                      <button
                        id={`detail-renew-${selectedClient.id}`}
                        onClick={() => {
                          setRenewClient(selectedClient);
                          setRenewStartDate(selectedClient.expiryDate);
                          setRenewDuration(selectedClient.packageDuration);
                          setRenewPrice(selectedClient.packageDetails?.price || 0);
                          setRenewPaymentReceived(0);
                          setRenewPaymentNotes(`Campaign renewal payment`);
                          setIsRenewOpen(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-indigo-500/5 hover:bg-indigo-500 border border-indigo-500/10 hover:border-indigo-500 text-indigo-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                      >
                        <RefreshCw className="h-4 w-4 shrink-0" />
                        Renew Package
                      </button>

                      {/* 5. Edit Client */}
                      <button
                        id={`detail-edit-${selectedClient.id}`}
                        onClick={() => {
                          setIsDetailOpen(false);
                          openEditModal(selectedClient);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-purple-500/5 hover:bg-purple-500 border border-purple-500/10 hover:border-purple-500 text-purple-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                      >
                        <Edit className="h-4 w-4 shrink-0" />
                        Edit Client
                      </button>

                      {/* 6. Generate Invoice */}
                      <button
                        id={`detail-invoice-${selectedClient.id}`}
                        onClick={() => {
                          setInvoiceClient(selectedClient);
                          setIsInvoiceOpen(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-teal-500/5 hover:bg-teal-500 border border-teal-500/10 hover:border-teal-500 text-teal-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        Generate Invoice
                      </button>

                      {/* 7. Delete Client */}
                      <button
                        id={`detail-delete-${selectedClient.id}`}
                        onClick={() => {
                          setIsDetailOpen(false);
                          handleDelete(selectedClient.id);
                        }}
                        className="flex items-center justify-center gap-2.5 px-3 py-2.5 bg-rose-500/5 hover:bg-rose-500 border border-rose-500/10 hover:border-rose-500 text-rose-400 hover:text-white rounded-xl transition-all cursor-pointer col-span-2"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        Delete Client
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeDetailTab === 'package' && (
                <motion.div 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="bg-[#0d0d0d] p-5 rounded-2xl border border-emerald-900/20 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Plan</span>
                        <h4 className="text-lg font-bold text-white mt-1">
                          {selectedClient.packageDetails?.customName || `${selectedClient.packageDetails?.type || 'Custom'} Blueprint`}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pricing Model</span>
                        <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
                          {formatCurrency(selectedClient.packageDetails?.price || (selectedClient.revenue + selectedClient.pendingAmount) || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-emerald-900/10 text-xs">
                      <div>
                        <p className="text-gray-500 font-semibold">Blueprinted Duration</p>
                        <p className="text-white font-bold text-sm mt-1">{selectedClient.packageDuration}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-semibold">Commencement Date</p>
                        <p className="text-white font-bold text-sm mt-1">{formatDate(selectedClient.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-semibold">Operational Expiry</p>
                        <p className="text-emerald-400 font-bold text-sm mt-1">{formatDate(selectedClient.expiryDate)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-emerald-400 tracking-wider uppercase border-b border-emerald-900/10 pb-1.5">
                      Blueprinted Agency Services Checklist
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                      {AVAILABLE_SERVICES.map(service => {
                        const isIncluded = selectedClient.packageDetails?.services?.includes(service);
                        return (
                          <div
                            key={service}
                            className={`px-3 py-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                              isIncluded
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-gray-200 font-semibold'
                                : 'bg-[#0d0d0d]/30 border-emerald-950/20 text-gray-600'
                            }`}
                          >
                            <span className="truncate">{service}</span>
                            {isIncluded ? (
                              <span className="text-emerald-400 bg-emerald-500/10 p-1 rounded-full shrink-0">
                                <CheckCircle2 className="h-4.5 w-4.5" />
                              </span>
                            ) : (
                              <span className="text-gray-700 bg-gray-900/20 p-1 rounded-full shrink-0" title="Optional Upsell Available">
                                <Lock className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeDetailTab === 'payments' && (
                <motion.div 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Financial Metrics Cards */}
                  {(() => {
                    const packageTotal = selectedClient.packageDetails?.price || (selectedClient.revenue + selectedClient.pendingAmount) || 0;
                    const totalReceived = selectedClient.revenue || 0;
                    const totalPending = selectedClient.pendingAmount || 0;
                    const percentPaid = packageTotal > 0 ? Math.min(100, Math.round((totalReceived / packageTotal) * 100)) : 0;

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-[#0d0d0d] border border-emerald-900/15 p-3 rounded-xl text-center">
                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Contract Value</span>
                            <span className="text-sm font-mono font-bold text-white block mt-1">{formatCurrency(packageTotal)}</span>
                          </div>
                          <div className="bg-emerald-950/20 border border-emerald-500/10 p-3 rounded-xl text-center">
                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">Received Cash</span>
                            <span className="text-sm font-mono font-bold text-emerald-400 block mt-1">{formatCurrency(totalReceived)}</span>
                          </div>
                          <div className="bg-amber-950/20 border border-amber-500/10 p-3 rounded-xl text-center">
                            <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block">Balance Due</span>
                            <span className="text-sm font-mono font-bold text-amber-400 block mt-1">{formatCurrency(totalPending)}</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1 bg-[#0d0d0d] p-3 rounded-xl border border-emerald-900/10">
                          <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400">
                            <span>Settle Percentage</span>
                            <span className="text-emerald-400 font-bold">{percentPaid}% Settled</span>
                          </div>
                          <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-emerald-950">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-md shadow-emerald-500/25"
                              style={{ width: `${percentPaid}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-between items-center border-t border-emerald-900/10 pt-3">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <History className="h-4.5 w-4.5 text-emerald-400" /> Transaction Ledger
                          </h4>
                          <button
                            onClick={() => setShowAddPaymentForm(!showAddPaymentForm)}
                            className="text-[11px] font-bold px-3 py-1.5 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-lg cursor-pointer flex items-center gap-1 transition-colors"
                          >
                            {showAddPaymentForm ? <X className="h-3.5 w-3.5" /> : <PlusCircle className="h-3.5 w-3.5" />}
                            {showAddPaymentForm ? 'Close Drawer' : 'Record Transaction'}
                          </button>
                        </div>

                        {/* Expandable transaction form */}
                        {showAddPaymentForm && (
                          <motion.form 
                            onSubmit={handleAddNewPayment}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="bg-[#0d0d0d] p-4 rounded-xl border border-emerald-500/20 space-y-3"
                          >
                            <h5 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Log Income Receipt</h5>
                            
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-gray-400 font-medium">Receipt Amount (INR) *</label>
                                <input
                                  type="number"
                                  required
                                  value={payAmount || ''}
                                  onChange={(e) => setPayAmount(Number(e.target.value))}
                                  placeholder="Amount"
                                  className="mt-1 block w-full bg-[#141414] border border-emerald-900/25 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>

                              <div>
                                <label className="block text-gray-400 font-medium">Payment Date *</label>
                                <input
                                  type="date"
                                  required
                                  value={payDate}
                                  onChange={(e) => setPayDate(e.target.value)}
                                  className="mt-1 block w-full bg-[#141414] border border-emerald-900/25 rounded-lg px-3 py-2 text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-gray-400 font-medium">Payment Channel *</label>
                                <select
                                  value={payMode}
                                  onChange={(e) => setPayMode(e.target.value as any)}
                                  className="mt-1 block w-full bg-[#141414] border border-emerald-900/25 rounded-lg px-3 py-2 text-white focus:outline-none"
                                >
                                  <option value="UPI">UPI (GooglePay/PhonePe)</option>
                                  <option value="Cash">Cash Ledger</option>
                                  <option value="Bank Transfer">Bank Wire Transfer</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-gray-400 font-medium">Receipt Category *</label>
                                <select
                                  value={payType}
                                  onChange={(e) => setPayType(e.target.value as any)}
                                  className="mt-1 block w-full bg-[#141414] border border-emerald-900/25 rounded-lg px-3 py-2 text-white focus:outline-none"
                                >
                                  <option value="Advance">Advance payment</option>
                                  <option value="Installment">Installment account</option>
                                  <option value="Full Payment">Settled Full</option>
                                  <option value="Other">Miscellaneous Fees</option>
                                </select>
                              </div>
                            </div>

                            <div className="text-xs">
                              <label className="block text-gray-400 font-medium">Memo / Transaction note</label>
                              <input
                                type="text"
                                value={payNotes}
                                onChange={(e) => setPayNotes(e.target.value)}
                                placeholder="e.g. Bank Ref No 283921, verified credit."
                                className="mt-1 block w-full bg-[#141414] border border-emerald-900/25 rounded-lg px-3 py-2 text-white focus:outline-none"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1 text-xs">
                              <button
                                type="button"
                                onClick={() => setShowAddPaymentForm(false)}
                                className="px-3 py-1.5 border border-emerald-950 text-gray-400 hover:text-white rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors"
                              >
                                Record Transaction
                              </button>
                            </div>
                          </motion.form>
                        )}

                        {/* Payments timeline cards */}
                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {(!selectedClient.payments || selectedClient.payments.length === 0) ? (
                            <div className="bg-[#0d0d0d]/30 border border-emerald-950/30 p-8 rounded-xl text-center text-gray-500 text-xs">
                              <AlertCircle className="h-5 w-5 mx-auto text-emerald-950 mb-2" />
                              No payments recorded on ledger yet.
                            </div>
                          ) : (
                            [...selectedClient.payments].reverse().map((payment) => (
                              <div
                                key={payment.id}
                                className="bg-[#0d0d0d] hover:bg-[#0f0f0f] border border-emerald-950 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors relative overflow-hidden"
                              >
                                {/* Left strip based on payment mode */}
                                <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                                  payment.mode === 'UPI' 
                                    ? 'bg-emerald-500' 
                                    : payment.mode === 'Cash' 
                                    ? 'bg-sky-500' 
                                    : 'bg-indigo-500'
                                }`}></div>

                                <div className="pl-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs">{payment.type} Receipt</span>
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded font-mono ${
                                      payment.mode === 'UPI'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                        : payment.mode === 'Cash'
                                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/10'
                                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10'
                                    }`}>
                                      {payment.mode}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 font-semibold">{formatDate(payment.date)}</p>
                                  {payment.notes && (
                                    <p className="text-gray-400 text-[11px] italic">"{payment.notes}"</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-mono font-extrabold text-sm text-emerald-400">
                                    {formatCurrency(payment.amount)}
                                  </span>
                                  <button
                                    onClick={() => handleDeletePaymentRecord(payment.id)}
                                    className="p-1.5 bg-[#141414] hover:bg-rose-950 border border-emerald-950/50 text-gray-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                    title="Revoke Transaction"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {activeDetailTab === 'followups' && (
                <motion.div 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="flex justify-between items-center border-b border-emerald-900/10 pb-3">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="h-4.5 w-4.5" /> Follow-up Schedule & History
                    </h4>
                    <button
                      onClick={() => {
                        setFollowUpClient(selectedClient);
                        setFollowUpTitle(`Follow-up: ${selectedClient.name}`);
                        setFollowUpNotes(`Discuss campaign deliverables and overall client satisfaction.`);
                        setIsFollowUpOpen(true);
                      }}
                      className="text-[11px] font-bold px-3 py-1.5 bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-lg cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Schedule Follow-up
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                    {followUps.filter(f => f.clientId === selectedClient.id).length === 0 ? (
                      <div className="bg-[#0d0d0d]/30 border border-emerald-950/30 p-8 rounded-xl text-center text-gray-500 text-xs">
                        <AlertCircle className="h-5 w-5 mx-auto text-emerald-950 mb-2" />
                        No follow-ups scheduled for this client yet.
                      </div>
                    ) : (
                      followUps
                        .filter(f => f.clientId === selectedClient.id)
                        .map((f) => {
                          const isPending = f.status === 'Pending' || f.status === 'Rescheduled';
                          return (
                            <div 
                              key={f.id}
                              className="bg-[#0d0d0d] border border-emerald-900/10 p-4 rounded-xl space-y-2 text-xs hover:border-emerald-500/20 transition-all"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-white text-sm">{f.followUpType}</span>
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                                      f.priority === 'High'
                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                                        : f.priority === 'Medium'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                    }`}>
                                      {f.priority} Priority
                                    </span>
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                                      f.status === 'Completed'
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : f.status === 'Missed'
                                        ? 'bg-rose-500/15 text-rose-400'
                                        : f.status === 'Rescheduled'
                                        ? 'bg-sky-500/15 text-sky-400'
                                        : 'bg-amber-500/15 text-amber-400'
                                    }`}>
                                      {f.status}
                                    </span>
                                  </div>
                                  <p className="text-gray-400 font-medium">📅 {f.followUpDate} at {f.followUpTime || '10:00'}</p>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {isPending && (
                                    <>
                                      <button
                                        onClick={async () => {
                                          if (window.confirm("Mark this follow-up as Completed?")) {
                                            await updateFollowUp(f.id, { status: 'Completed' });
                                          }
                                        }}
                                        className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded text-[10px] transition-colors"
                                      >
                                        Complete
                                      </button>
                                      <button
                                        onClick={() => {
                                          setReschedulingId(f.id);
                                          setNewReschedDate(f.followUpDate);
                                          setNewReschedTime(f.followUpTime || '10:00');
                                        }}
                                        className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 font-bold rounded text-[10px] transition-colors"
                                      >
                                        Reschedule
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (window.confirm("Mark this follow-up as Missed?")) {
                                            await updateFollowUp(f.id, { status: 'Missed' });
                                          }
                                        }}
                                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 font-bold rounded text-[10px] transition-colors"
                                      >
                                        Missed
                                      </button>
                                    </>
                                  )}
                                  <button
                                    id={`push-followup-${f.id}`}
                                    disabled={isFollowUpTelegramSending[f.id]}
                                    onClick={() => handleSendFollowUpTelegram(f)}
                                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold rounded text-[10px] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                    title="Push to Telegram"
                                  >
                                    <Send className="h-3 w-3 shrink-0" />
                                    {isFollowUpTelegramSending[f.id] ? 'Pushing...' : 'Push to Telegram'}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await deleteFollowUp(f.id);
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
                                    }}
                                    className="p-1.5 bg-[#141414] hover:bg-rose-950 text-gray-500 hover:text-rose-400 rounded transition-colors"
                                    title="Delete Entry"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {f.reason && (
                                <p className="text-gray-300 font-semibold mt-1">📌 Reason: {f.reason}</p>
                              )}
                              {f.notes && (
                                <p className="text-gray-400 italic">📝 Notes: "{f.notes}"</p>
                              )}

                              {/* Rescheduling Form Drawer */}
                              {reschedulingId === f.id && (
                                <div className="bg-[#0a0a0a] border border-amber-950/40 p-3.5 rounded-xl space-y-2 mt-2">
                                  <p className="font-bold text-amber-400 text-[10px] uppercase tracking-wider">Select New Date & Time</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-gray-500 text-[9px] uppercase font-bold block">New Date</label>
                                      <input 
                                        type="date"
                                        value={newReschedDate}
                                        onChange={e => setNewReschedDate(e.target.value)}
                                        className="mt-1 w-full bg-[#141414] border border-emerald-900/10 rounded px-2 py-1 text-white text-xs focus:outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-gray-500 text-[9px] uppercase font-bold block">New Time</label>
                                      <input 
                                        type="time"
                                        value={newReschedTime}
                                        onChange={e => setNewReschedTime(e.target.value)}
                                        className="mt-1 w-full bg-[#141414] border border-emerald-900/10 rounded px-2 py-1 text-white text-xs focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setReschedulingId(null)}
                                      className="px-2 py-1 border border-emerald-950 text-gray-400 hover:text-white rounded text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!newReschedDate) {
                                          alert("Please specify a valid date.");
                                          return;
                                        }
                                        try {
                                          await updateFollowUp(f.id, {
                                            followUpDate: newReschedDate,
                                            followUpTime: newReschedTime,
                                            status: 'Rescheduled'
                                          });
                                          setReschedulingId(null);
                                          alert("Success: Rescheduled successfully!");
                                        } catch (err: any) {
                                          alert("Error rescheduling: " + err.message);
                                        }
                                      }}
                                      className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded text-[10px]"
                                    >
                                      Reschedule Follow-up
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </motion.div>
              )}

            </div>

            {/* Details Footer */}
            <div className="px-6 py-4 border-t border-emerald-900/10 bg-[#0d0d0d] flex justify-between items-center">
              <a
                href={`https://wa.me/${selectedClient.whatsApp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold"
              >
                Open Chat <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-1.5 bg-[#141414] hover:bg-[#1e1e1e] border border-emerald-900/20 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Close View
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SCHEDULE FOLLOW-UP MODAL */}
      {isFollowUpOpen && followUpClient && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col my-8 max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/10 bg-[#0d0d0d] shrink-0">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Schedule Strategic Follow-up</h3>
                <p className="text-xs text-gray-500 mt-0.5">Campaign Client Profile Onboarding</p>
              </div>
              <button 
                onClick={() => setIsFollowUpOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleFollowUpSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Client Info Grid (Read-only for validation) */}
              <div className="grid grid-cols-2 gap-3 bg-[#0d0d0d] p-4 rounded-xl border border-emerald-950/40 text-xs">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block">Client Name</label>
                  <p className="text-white font-bold mt-1">{followUpClient.name}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block">Business Name</label>
                  <p className="text-white font-bold mt-1">{followUpClient.businessName}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-emerald-950">
                  <label className="text-[10px] uppercase font-bold text-gray-500 block">Mobile Connection</label>
                  <p className="text-emerald-400 font-mono font-bold mt-1">{followUpClient.mobile}</p>
                </div>
              </div>

              {/* Schedule Timing Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Target Date *</label>
                  <input
                    type="date"
                    required
                    value={followUpDate}
                    onChange={e => setFollowUpDate(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Target Time *</label>
                  <input
                    type="time"
                    required
                    value={followUpTime}
                    onChange={e => setFollowUpTime(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Type and Priority Selection Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Follow-up Type *</label>
                  <select
                    value={followUpType}
                    onChange={e => setFollowUpType(e.target.value as any)}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Call">Phone Call</option>
                    <option value="Meeting">In-Person Meeting</option>
                    <option value="Proposal">Proposal Presentation</option>
                    <option value="Other">Other / Miscellaneous</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400">Urgency Priority *</label>
                  <select
                    value={followUpPriority}
                    onChange={e => setFollowUpPriority(e.target.value as any)}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                  </select>
                </div>
              </div>

              {/* Follow-up Reason (Core field) */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 font-sans">Objective Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discuss poster design sign-off, collect balance payment"
                  value={followUpReason}
                  onChange={e => setFollowUpReason(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Action Notes / Guidelines */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400">Detailed Action Notes / Directives</label>
                <textarea
                  rows={3}
                  placeholder="Provide precise details, files requested, or talking points..."
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <div className="pt-3 border-t border-emerald-900/10 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFollowUpOpen(false)}
                  className="px-4 py-2 bg-transparent text-gray-400 text-xs font-bold uppercase tracking-wider hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-amber-400 transition-colors"
                >
                  Schedule Follow-up
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RENEW PACKAGE MODAL */}
      {isRenewOpen && renewClient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/10 bg-[#0d0d0d]">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Renew Campaign Package</h3>
                <p className="text-xs text-gray-500 mt-0.5">Client: {renewClient.name}</p>
              </div>
              <button 
                onClick={() => setIsRenewOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRenewSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">New Start Date</label>
                  <input
                    type="date"
                    required
                    value={renewStartDate}
                    onChange={e => setRenewStartDate(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Duration</label>
                  <select
                    value={renewDuration}
                    onChange={e => setRenewDuration(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="1 Month">1 Month</option>
                    <option value="3 Months">3 Months</option>
                    <option value="6 Months">6 Months</option>
                    <option value="1 Year">1 Year</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Package Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={renewPrice}
                    onChange={e => setRenewPrice(Number(e.target.value))}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500">Advance Received (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={renewPaymentReceived}
                    onChange={e => setRenewPaymentReceived(Number(e.target.value))}
                    className="w-full bg-[#0d0d0d] border border-emerald-900/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {renewPaymentReceived > 0 && (
                <div className="grid grid-cols-1 gap-4 p-4 bg-[#0d0d0d] border border-emerald-900/5 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">Payment Mode</label>
                    <div className="flex gap-4">
                      {(['UPI', 'Cash', 'Bank Transfer'] as const).map(mode => (
                        <label key={mode} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                          <input
                            type="radio"
                            name="renewPaymentMode"
                            checked={renewPaymentMode === mode}
                            onChange={() => setRenewPaymentMode(mode)}
                            className="accent-emerald-500"
                          />
                          {mode}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">Payment Reference Notes</label>
                    <input
                      type="text"
                      value={renewPaymentNotes}
                      onChange={e => setRenewPaymentNotes(e.target.value)}
                      placeholder="e.g. advance payment ref ID"
                      className="w-full bg-[#141414] border border-emerald-900/15 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRenewOpen(false)}
                  className="px-4 py-2 bg-transparent text-gray-400 text-xs font-bold uppercase tracking-wider hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-400 transition-colors"
                >
                  Renew Campaign
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* GENERATE INVOICE MODAL */}
      {isInvoiceOpen && invoiceClient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-900/10 bg-[#0d0d0d] print:hidden">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Client Corporate Invoice</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-emerald-400 transition-colors shadow-lg"
                >
                  <Download className="h-3.5 w-3.5" /> Print / PDF
                </button>
                <button 
                  onClick={() => setIsInvoiceOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Container */}
            <div 
              id="printable-invoice-area" 
              className="relative p-8 md:p-12 bg-white text-slate-800 overflow-y-auto flex-1 font-sans print:p-0 print:overflow-visible print:static"
              style={{ contentVisibility: 'auto' }}
            >
              {/* CSS Print Overrides */}
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #printable-invoice-area, #printable-invoice-area * {
                    visibility: visible;
                  }
                  #printable-invoice-area {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0 !important;
                    background: white !important;
                    color: #1a1a1a !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  @page {
                    size: A4;
                    margin: 15mm;
                  }
                }
              `}</style>

              {/* Background Watermark */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none z-0">
                <img 
                  src={brandSettings?.logo || defaultLogo} 
                  alt="Watermark" 
                  className="w-[450px] h-[450px] object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="relative z-10 space-y-8">
                {/* Header Grid */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-slate-100 pb-8">
                  {/* Brand Profile */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-transparent flex items-center justify-center p-0.5 shrink-0 overflow-hidden border border-slate-100/80">
                        <img 
                          src={brandSettings?.logo || defaultLogo} 
                          alt="AB Graphics" 
                          className="max-h-full max-w-full object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                          AB GRAPHICS
                        </h2>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Graphic Designer & Digital Marketer</p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p className="font-semibold text-slate-700">AB Graphics Studio</p>
                      <p>Mobile: +91 93076 43461</p>
                      <p>Email: support@abgraphics.co</p>
                      <p>Website: www.abgraphics.co</p>
                      <p className="font-mono text-[10px] text-slate-400">GSTIN: 27AABCA1234F1Z5</p>
                    </div>
                  </div>

                  {/* Invoice Meta */}
                  <div className="md:text-right space-y-3 shrink-0">
                    <div>
                      <h1 className="text-2xl font-black uppercase tracking-widest text-slate-800">SERVICE INVOICE</h1>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">Invoice #: INV-CRM-{Date.now().toString().slice(-6)}</p>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <p><span className="font-medium text-slate-400">Invoice Date:</span> <span className="font-mono font-semibold text-slate-700">{new Date().toISOString().split('T')[0]}</span></p>
                      <p><span className="font-medium text-slate-400">Due Date:</span> <span className="font-mono font-semibold text-slate-700">{formatDate(invoiceClient.expiryDate)}</span></p>
                    </div>

                    {/* Status Badge */}
                    <div className="pt-1">
                      {(() => {
                        const isPaid = (invoiceClient.pendingAmount || 0) <= 0;
                        const isPartial = (invoiceClient.revenue || 0) > 0 && (invoiceClient.pendingAmount || 0) > 0;
                        const label = isPaid ? 'PAID' : (isPartial ? 'PARTIAL' : 'UNPAID');
                        const colorClass = isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : (isPartial ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200');

                        return (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${colorClass}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Client Specs (Premium Card) */}
                <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Invoiced To</p>
                    <p className="font-bold text-base text-slate-900">{invoiceClient.name}</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{invoiceClient.businessName}</p>
                    <p className="text-slate-500 mt-2 leading-relaxed">{invoiceClient.address || 'Address on file'}</p>
                    <p className="text-slate-500 mt-1">Mobile: {invoiceClient.mobile}</p>
                    {invoiceClient.gstNumber && (
                      <p className="text-slate-400 font-mono mt-1.5 text-[11px]">GSTIN: {invoiceClient.gstNumber}</p>
                    )}
                  </div>

                  <div className="md:border-l md:border-slate-200/60 md:pl-6 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Campaign Details</p>
                    <p><span className="text-slate-400">Package Name:</span> <span className="font-semibold text-slate-700">{invoiceClient.packageDetails?.customName || invoiceClient.packageDetails?.type || 'Custom Package'}</span></p>
                    <p><span className="text-slate-400">Package Duration:</span> <span className="font-semibold text-slate-700">{invoiceClient.packageDuration}</span></p>
                    <p><span className="text-slate-400">Start Date:</span> <span className="font-mono text-slate-600">{formatDate(invoiceClient.startDate)}</span></p>
                    <p><span className="text-slate-400">Expiry Date:</span> <span className="font-mono text-slate-600">{formatDate(invoiceClient.expiryDate)}</span></p>
                  </div>
                </div>

                {/* Line Item Table */}
                <div className="overflow-hidden border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-100">
                        <th className="py-3 px-4">Service & Description</th>
                        <th className="py-3 px-4 text-center">Quantity</th>
                        <th className="py-3 px-4 text-center">Duration</th>
                        <th className="py-3 px-4 text-right">Price (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr className="bg-white hover:bg-slate-50/20">
                        <td className="py-5 px-4 max-w-sm">
                          <p className="font-bold text-slate-950">
                            {invoiceClient.packageDetails?.customName || `${invoiceClient.packageDetails?.type || 'Custom'} Marketing Campaign`}
                          </p>
                          <ul className="list-disc pl-4 mt-2 text-[11px] text-slate-500 space-y-1">
                            {(invoiceClient.packageDetails?.services || ['Custom Branding Solutions']).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </td>
                        <td className="py-5 px-4 text-center font-semibold text-slate-600">1</td>
                        <td className="py-5 px-4 text-center font-semibold text-slate-600">{invoiceClient.packageDuration}</td>
                        <td className="py-5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(invoiceClient.packageDetails?.price || (invoiceClient.revenue + invoiceClient.pendingAmount) || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Summary & UPI QR Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  {/* UPI Payment Scan Box */}
                  <div className="border border-slate-150 border-slate-200/60 rounded-2xl p-5 flex items-center justify-between gap-4 bg-slate-50/30">
                    <div className="space-y-2 text-left">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Scan to Pay</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Scan from any UPI application (GPay, PhonePe, Paytm, BHIM) to settle due balances instantly.
                      </p>
                      <div className="text-[10px] font-mono text-slate-600 bg-white border border-slate-100 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                        <span>UPI: 9307643461@axl</span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">UPI Payment</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <div className="w-24 h-32 bg-white border border-slate-200/60 rounded-xl p-1.5 shadow-sm flex items-center justify-center overflow-hidden">
                        <img 
                          src={brandSettings?.qr || defaultQr} 
                          alt="UPI QR" 
                          className="max-h-full max-w-full object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="bg-slate-50/30 border border-slate-200/60 rounded-2xl p-5 space-y-2.5 text-xs">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest pb-1 border-b border-slate-200/40">Payment Summary</h4>
                    
                    <div className="flex justify-between text-slate-500">
                      <span>Package Value:</span>
                      <span className="font-mono">
                        {formatCurrency(invoiceClient.packageDetails?.price || (invoiceClient.revenue + invoiceClient.pendingAmount) || 0)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-500">
                      <span>Discount:</span>
                      <span className="font-mono text-slate-400">₹0</span>
                    </div>

                    <div className="flex justify-between text-slate-500">
                      <span>Tax (GST 0%):</span>
                      <span className="font-mono text-slate-400">₹0</span>
                    </div>

                    <div className="flex justify-between text-slate-600 border-t border-slate-200/40 pt-2 font-medium">
                      <span>Final Total:</span>
                      <span className="font-mono">
                        {formatCurrency(invoiceClient.packageDetails?.price || (invoiceClient.revenue + invoiceClient.pendingAmount) || 0)}
                      </span>
                    </div>

                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Amount Paid:</span>
                      <span className="font-mono">-{formatCurrency(invoiceClient.revenue || 0)}</span>
                    </div>

                    <div className="flex justify-between border-t border-slate-200 pt-2.5 text-sm font-black">
                      <span className="text-slate-800">Outstanding:</span>
                      <span className={`font-mono ${(invoiceClient.pendingAmount || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(invoiceClient.pendingAmount || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment History Log */}
                {invoiceClient.payments && invoiceClient.payments.length > 0 && (
                  <div className="pt-6 border-t border-dashed border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recorded Payment Ledger History</p>
                    <div className="space-y-1.5 text-[11px] text-slate-600">
                      {invoiceClient.payments.map((p, idx) => (
                        <div key={p.id || idx} className="flex justify-between bg-slate-50/40 px-3 py-1.5 rounded-lg border border-slate-100">
                          <span>• Received {formatCurrency(p.amount)} via {p.mode} on {formatDate(p.date)}</span>
                          <span className="font-mono text-slate-400 italic">({p.notes})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Terms and Conditions (Exactly 10 Points in 2 Columns) */}
                <div className="border-t border-slate-100 pt-6">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Terms & Conditions</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[9px] text-slate-400 leading-relaxed">
                    <div>1. 50% advance payment is mandatory.</div>
                    <div>2. Remaining payment before final delivery.</div>
                    <div>3. Reel production timelines may vary depending on shoot schedule and revisions.</div>
                    <div>4. Meta Ads and Digital Marketing results depend on audience, competition and advertising budget.</div>
                    <div>5. AB Graphics provides professional marketing services only.</div>
                    <div>6. We do not guarantee any fixed number of leads, admissions, sales or revenue.</div>
                    <div>7. Client delays in approvals may affect delivery timelines.</div>
                    <div>8. Two minor revisions are included unless otherwise agreed.</div>
                    <div>9. Advertisement budget is separate unless mentioned in package.</div>
                    <div>10. By making payment the client accepts all terms.</div>
                  </div>
                </div>

                {/* Thank You & Powered By Footer */}
                <div className="text-center text-[10px] text-slate-400 pt-6 border-t border-slate-100">
                  <p className="font-bold text-slate-600">Thank you for choosing AB Graphics.</p>
                  <p className="mt-0.5">We appreciate your trust.</p>
                  <p className="text-[8px] uppercase tracking-widest text-slate-300 mt-3">Powered by AB Graphics CRM</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-rose-950 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/10 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-white">Permanently Delete Client</h4>
                <p className="text-xs text-rose-400 font-semibold mt-0.5">Critical System Warning</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              Are you sure you want to permanently delete this client? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2.5 bg-transparent text-gray-400 hover:text-white font-bold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteClient}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
