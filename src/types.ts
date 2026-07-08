export interface Payment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  mode: 'Cash' | 'UPI' | 'Bank Transfer';
  type: 'Advance' | 'Installment' | 'Full Payment' | 'Other';
  notes?: string;
}

export interface ClientPackage {
  type: 'Basic' | 'Advance' | 'Pro' | 'Custom';
  customName?: string; // For Custom Package
  price: number; // Total package value
  duration: string; // e.g. "1 Month", "3 Months", "6 Months", "1 Year", "Custom"
  services: string[]; // Selected services
}

export interface Client {
  id: string;
  name: string;
  businessName: string;
  mobile: string;
  whatsApp: string;
  email: string;
  address: string;
  gstNumber?: string;
  startDate: string; // YYYY-MM-DD
  packageDuration: string; // e.g. "1 Month", "3 Months", "6 Months", "1 Year", "Custom"
  expiryDate: string; // YYYY-MM-DD
  profilePhoto?: string; // Base64 or URL
  notes: string;
  status: 'Active' | 'Expired';
  paymentStatus: 'Paid' | 'Pending';
  revenue: number; // Storing total received to preserve existing calculations
  pendingAmount: number; // Storing calculated pending to preserve existing calculations
  createdBy: string;
  createdAt: string;
  packageDetails?: ClientPackage;
  payments?: Payment[];
}

export interface Lead {
  id: string;
  name: string;
  business: string;
  mobile: string;
  leadSource: string; // e.g. Facebook, Instagram, Google, Website, Reference, Direct, Other
  followUpDate: string; // YYYY-MM-DD
  status: 'New' | 'Contacted' | 'In Progress' | 'Converted' | 'Lost';
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  status: 'Pending' | 'In Progress' | 'Completed';
  type: 'Shoot' | 'Editing' | 'Poster' | 'Ads' | 'Website' | 'Printing';
  clientId?: string;
  clientName?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface Activity {
  id: string;
  type: 'client_added' | 'client_updated' | 'client_deleted' | 'lead_added' | 'lead_converted' | 'lead_updated' | 'task_added' | 'task_completed' | 'payment_updated' | 'followup_added' | 'followup_updated' | 'followup_deleted';
  description: string;
  timestamp: string; // ISO String
  createdBy: string;
  clientId?: string;
}

export interface FollowUp {
  id: string;
  clientId: string;
  clientName: string;
  businessName: string;
  mobile: string;
  followUpDate: string; // YYYY-MM-DD
  followUpTime: string; // HH:MM
  followUpType: 'Call' | 'Meeting' | 'Proposal' | 'Other';
  reason: string;
  notes: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'Completed' | 'Missed' | 'Rescheduled';
  createdBy: string;
  createdAt: string;
  telegramReminderSent?: boolean;
  telegramMissedSent?: boolean;
}

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  expiredClients: number;
  totalRevenue: number;
  pendingPayments: number;
  monthlyRevenue: number;
  todayTasksCount: number;
}
