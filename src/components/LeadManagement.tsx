import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { calculateExpiryDate, formatDate } from '../utils';
import { Lead, Client, Payment } from '../types';
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
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import { AVAILABLE_SERVICES } from './ClientManagement';

export const LeadManagement: React.FC = () => {
  const { 
    leads, 
    addLead, 
    updateLead, 
    deleteLead, 
    convertLeadToClient, 
    sendTelegramNotification, 
    telegramSettings 
  } = useCRM();

  // Filter/Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'New' | 'Contacted' | 'In Progress' | 'Converted' | 'Lost'>('All');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);

  // Lead Form Fields
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [mobile, setMobile] = useState('');
  const [leadSource, setLeadSource] = useState('Facebook');
  const [followUpDate, setFollowUpDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<Lead['status']>('New');
  const [notes, setNotes] = useState('');

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
    setNotes(lead.notes);
    setIsFormOpen(true);
  };

  // Open Conversion Modal
  const openConvertModal = (lead: Lead) => {
    setConvertingLead(lead);
    
    // Auto populate client fields from lead parameters
    setCName(lead.name);
    setCBusinessName(lead.business);
    setCMobile(lead.mobile);
    setCWhatsApp(lead.mobile); // Fallback Whatsapp to same number
    setCEmail('');
    setCAddress('');
    setCGstNumber('');
    const today = new Date().toISOString().split('T')[0];
    setCStartDate(today);
    setCPackageDuration('1 Month');
    setCExpiryDate(calculateExpiryDate(today, '1 Month'));
    setCNotes(`Converted from Lead source: ${lead.leadSource}. Previous Notes: ${lead.notes}`);
    setCImageFile(null);
    setCImagePreview('');

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
        notes
      };

      if (editingLead) {
        await updateLead(editingLead.id, leadData);
      } else {
        const savedLead = await addLead(leadData);
        
        // Construct and send Telegram notification
        if (telegramSettings && telegramSettings.enabled) {
          const createdDate = savedLead.createdAt 
            ? new Date(savedLead.createdAt).toLocaleString('en-IN') 
            : new Date().toLocaleString('en-IN');

          const messageText = `🆕 NEW LEAD RECEIVED

👤 Name: ${savedLead.name}
🏢 Business: ${savedLead.business}
📞 Phone: ${savedLead.mobile}
📧 Email: N/A
📍 Address: N/A
📦 Interested Service: N/A
💰 Budget: N/A
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
            alert("Lead saved successfully! Telegram notification sent.");
          } catch (tgError: any) {
            alert(`Lead saved successfully! Telegram notification failed: ${tgError.message}`);
          }
        } else {
          alert("Lead saved successfully!");
        }
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save lead");
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

      await convertLeadToClient(convertingLead.id, clientDetails, cImageFile);
      setIsConvertOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to convert lead: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Delete Lead
  const handleDeleteLead = async (id: string) => {
    try {
      await deleteLead(id);
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

  // Search & Filter Logic
  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.business.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.mobile.includes(searchTerm);

    const matchesStatus = 
      statusFilter === 'All' || 
      l.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Campaign Prospects & Leads</h2>
          <p className="text-sm text-gray-500 mt-1">Manage campaign leads and sales pipeline contacts.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer text-sm transition-all duration-200 shrink-0"
        >
          <Plus className="h-5 w-5" /> Add Lead
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search prospects by name, business or phone..."
            className="w-full pl-11 pr-4 py-3 bg-[#141414] border border-emerald-900/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
          />
        </div>
        
        {/* Status Filters */}
        <div className="flex bg-[#141414] p-1.5 rounded-xl border border-emerald-900/10 overflow-x-auto self-start md:self-auto shrink-0 max-w-full">
          {(['All', 'New', 'Contacted', 'In Progress', 'Converted', 'Lost'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
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

      {/* Leads Table / List */}
      {filteredLeads.length === 0 ? (
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-12 text-center text-gray-400 space-y-4">
          <Sparkles className="h-12 w-12 mx-auto text-emerald-900/30 animate-pulse" />
          <div>
            <h3 className="text-lg font-bold text-white">No prospects found</h3>
            <p className="text-sm mt-1">Try expanding your filters or log a brand new pipeline lead.</p>
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#0d0d0d] border border-emerald-900/20 hover:border-emerald-500/20 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Log Lead
          </button>
        </div>
      ) : (
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-emerald-900/10 text-gray-500 text-xs font-semibold uppercase tracking-wider bg-[#0d0d0d]/40">
                  <th className="px-6 py-4">Prospect / Business</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Follow-Up Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/10 text-sm text-gray-300">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#0d0d0d]/40 transition-colors">
                    {/* Name / Business */}
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#0d0d0d] flex items-center justify-center font-bold text-emerald-400 border border-emerald-900/20">
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white leading-tight">{lead.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Building className="h-3 w-3" /> {lead.business}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact details */}
                    <td className="px-6 py-4.5 font-mono text-xs text-gray-400">
                      {lead.mobile}
                    </td>

                    {/* Source */}
                    <td className="px-6 py-4.5">
                      <span className="text-xs px-2.5 py-1 bg-[#0d0d0d] border border-emerald-900/10 rounded-lg text-gray-300">
                        {lead.leadSource}
                      </span>
                    </td>

                    {/* Follow Up Date */}
                    <td className="px-6 py-4.5 text-xs text-gray-400">
                      {formatDate(lead.followUpDate)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        lead.status === 'New' && 'bg-blue-500/10 text-blue-400 border-blue-500/20' ||
                        lead.status === 'Contacted' && 'bg-amber-500/10 text-amber-400 border-amber-500/20' ||
                        lead.status === 'In Progress' && 'bg-purple-500/10 text-purple-400 border-purple-500/20' ||
                        lead.status === 'Converted' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' ||
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {lead.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {lead.status !== 'Converted' && (
                          <button
                            onClick={() => openConvertModal(lead)}
                            className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="Convert to Paying Client"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Convert
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(lead)}
                          className="p-1.5 bg-[#0d0d0d] border border-emerald-900/10 hover:border-emerald-500/20 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead.id)}
                          className="p-1.5 bg-[#0d0d0d] border border-emerald-900/10 hover:border-emerald-500/10 text-gray-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete Lead"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEAD CREATION / EDIT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-emerald-900/10 flex justify-between items-center bg-[#0d0d0d]">
              <h3 className="text-base font-bold text-white">
                {editingLead ? 'Edit Prospect Lead' : 'Log Prospect Lead'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLeadSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Prospect Name <span className="text-emerald-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Business / Company <span className="text-emerald-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={business}
                    onChange={(e) => setBusiness(e.target.value)}
                    placeholder="e.g. Acme Agency"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                    placeholder="e.g. 9876543210"
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Lead Acquisition Source <span className="text-emerald-400">*</span></label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400">Next Follow-Up Date <span className="text-emerald-400">*</span></label>
                  <input
                    type="date"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Lead Pipeline Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Lead['status'])}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="New">New / Fresh</option>
                    <option value="Contacted">Contact Established</option>
                    <option value="In Progress">Active Nurture</option>
                    <option value="Lost">Closed / Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400">Discussion Logs & Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Highly interested in standard social graphics campaign. Budget looks good."
                  rows={3}
                  className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-emerald-900/10 flex justify-end gap-3 bg-[#141414]">
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
                  Log Prospect
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* LEAD CONVERT TO PAID CLIENT MODAL */}
      {isConvertOpen && convertingLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-emerald-900/20 rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-emerald-900/10 flex justify-between items-center bg-[#0d0d0d]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Convert Lead to Paying Client</h3>
                  <p className="text-[10px] text-gray-500">Finalize paid campaign setup details for {convertingLead.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsConvertOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scroll area */}
            <form onSubmit={handleConversionSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Photo Setup Section */}
              <div className="flex flex-col sm:flex-row gap-4 items-center bg-[#0d0d0d] p-4 rounded-xl border border-emerald-900/10">
                <div className="h-14 w-14 rounded-full bg-[#090909] border border-emerald-900/20 overflow-hidden flex items-center justify-center shrink-0">
                  {cImagePreview ? (
                    <img 
                      src={cImagePreview} 
                      alt="Preview" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="h-6 w-6 text-gray-550" />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <p className="text-xs font-semibold text-white">Profile Photo</p>
                  <p className="text-[10px] text-gray-500">Provide an avatar or business branding photo.</p>
                  <label className="inline-block mt-2 px-3 py-1 bg-[#141414] hover:bg-[#1e1e1e] border border-emerald-900/20 text-gray-300 hover:text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors">
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
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Business / Company Name <span className="text-emerald-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={cBusinessName}
                    onChange={(e) => setCBusinessName(e.target.value)}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">WhatsApp Contact <span className="text-emerald-400">*</span></label>
                  <input
                    type="tel"
                    required
                    value={cWhatsApp}
                    onChange={(e) => setCWhatsApp(e.target.value)}
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">GST Registration No. (Optional)</label>
                  <input
                    type="text"
                    value={cGstNumber}
                    onChange={(e) => setCGstNumber(e.target.value)}
                    placeholder="GST Registration No."
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                  className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
                    className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Campaign Duration <span className="text-emerald-400">*</span></label>
                  <select
                    value={cPackageDuration}
                    onChange={(e) => setCPackageDuration(e.target.value)}
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
                  <label className="block text-xs font-medium text-gray-500">Auto Expiry Calculation</label>
                  <input
                    type="text"
                    disabled
                    value={cExpiryDate}
                    className="mt-1 block w-full bg-[#0d0d0d]/60 border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm text-gray-500 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Package Setup Section */}
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
                      value={cPackageType}
                      onChange={(e) => handleCPackageTypeChange(e.target.value as any)}
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
                      value={cPackagePrice}
                      onChange={(e) => setCPackagePrice(Number(e.target.value))}
                      placeholder="e.g. 15000"
                      className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                {cPackageType === 'Custom' && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className="block text-xs font-medium text-gray-400 font-semibold text-emerald-400">Custom Package Identification Name</label>
                    <input
                      type="text"
                      required
                      value={cCustomPackageName}
                      onChange={(e) => setCCustomPackageName(e.target.value)}
                      placeholder="e.g. Custom Corporate Launch"
                      className="mt-1 block w-full bg-[#141414] border border-emerald-900/30 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </motion.div>
                )}

                {/* Services Checkboxes Selection */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-semibold text-gray-400">
                    Services Included in Package ({cSelectedServices.length} selected)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 bg-[#141414] border border-emerald-900/10 rounded-xl">
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

              {/* Initial Onboarding Payment log */}
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
                      value={cInitialPaymentAmount}
                      onChange={(e) => setCInitialPaymentAmount(Number(e.target.value))}
                      placeholder="e.g. 5000"
                      className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400">Payment Channel</label>
                    <select
                      value={cInitialPaymentMode}
                      onChange={(e) => setCInitialPaymentMode(e.target.value as any)}
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
                      value={cInitialPaymentType}
                      onChange={(e) => setCInitialPaymentType(e.target.value as any)}
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
                    value={cInitialPaymentNotes}
                    onChange={(e) => setCInitialPaymentNotes(e.target.value)}
                    placeholder="e.g. Received via PhonePe, transaction verified."
                    className="mt-1 block w-full bg-[#141414] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400">Campaign Notes & Directives</label>
                <textarea
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full bg-[#0d0d0d] border border-emerald-900/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                ></textarea>
              </div>

              {/* Form Controls */}
              <div className="pt-4 border-t border-emerald-900/10 flex justify-end gap-3 bg-[#141414]">
                <button
                  type="button"
                  onClick={() => setIsConvertOpen(false)}
                  className="px-4 py-2 border border-emerald-900/20 hover:border-emerald-500/20 text-gray-300 font-semibold rounded-xl text-xs cursor-pointer"
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
