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

export interface ActivityProof {
  instagramLink?: string;
  facebookLink?: string;
  canvaLink?: string;
  googleDriveLink?: string;
  screenshot?: string; // Base64 or image url
  referenceLink?: string;
}

export interface DailyActivity {
  id: string;
  type: string;
  customTypeName?: string; // If type is "Custom Activity"
  status: 'Planned' | 'In Progress' | 'Waiting For Client Approval' | 'Approved' | 'Posted' | 'Completed' | 'Cancelled';
  proof?: ActivityProof;
  notes?: string;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  activities: DailyActivity[];
  internalNotes?: string;
  clientNotes?: string;
}

export interface ContentPlanner {
  planType?: '7 Days' | '15 Days' | '30 Days' | 'Custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  days: Record<string, DayPlan>; // Keyed by YYYY-MM-DD
  aiStrategy?: {
    strategyTitle: string;
    highLevelStrategy: string;
    keyMetrics: string;
  };
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
  contentPlanner?: ContentPlanner;
}

export interface LeadTimelineItem {
  id?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  action: string;
  previousValue?: string;
  newValue?: string;
  user: string;
  notes?: string;
}

export interface Lead {
  id: string;
  name: string;
  business: string;
  mobile: string;
  leadSource: string; // e.g. Facebook, Instagram, Google, Website, Reference, Direct, Other
  followUpDate: string; // YYYY-MM-DD
  status: 'New' | 'Contacted' | 'Meeting Scheduled' | 'Meeting Done' | 'Proposal / Quotation Sent' | 'In Progress' | 'Interested' | 'Negotiation' | 'Waiting For Client Decision' | 'Payment Pending' | 'Converted' | 'Lost';
  notes: string;
  createdBy: string;
  createdAt: string;
  
  // New Digital Marketing Agency fields
  address?: string;
  email?: string;
  website?: string;
  googleMapsLink?: string;
  
  mood?: 'Very Positive' | 'Positive' | 'Neutral' | 'Thinking' | 'Confused' | 'Negative' | 'Not Interested';
  buyingIntent?: 'Low' | 'Medium' | 'High' | 'Very High';
  priority?: 'Low' | 'Medium' | 'High';
  
  expectedRevenue?: number;
  expectedPackage?: string;
  expectedClosingMonth?: string;
  interestedService?: string;
  budgetRange?: string;
  decisionMaker?: string;
  
  meetingOutcome?: 'Very Interested' | 'Interested' | 'Need Time' | 'Budget Issue' | 'Partner Approval Pending' | 'Already Working With Someone' | 'Not Interested' | 'Other';
  meetingNotes?: string;
  objections?: string[];
  
  lastContactDate?: string; // YYYY-MM-DD
  timeline?: LeadTimelineItem[];
  leadScore?: number;
  health?: 'Healthy' | 'Needs Attention' | 'At Risk';
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
  leadId?: string;
  leadName?: string;
  assignedTo?: 'Bhargav' | 'Adhwaryu' | 'Pari';
  priority?: 'Low' | 'Medium' | 'High';
  plannerActivityId?: string; // Linked activity ID in a client's planner
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface BrandSettings {
  logo?: string; // Base64 or URL of custom logo
  qr?: string;   // Base64 or URL of custom QR code
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

export interface CRMUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'Owner' | 'Team Member';
  title: string;
  permissions: string[];
}

export const teamMembers: CRMUser[] = [
  {
    uid: 'bhargav',
    email: 'bhargav@abgraphics.com',
    displayName: 'Bhargav',
    role: 'Owner',
    title: 'Creative Head',
    permissions: ['all']
  },
  {
    uid: 'adhwaryu',
    email: 'adhwaryu@abgraphics.com',
    displayName: 'Adhwaryu',
    role: 'Team Member',
    title: 'Client Handling & Operations',
    permissions: ['clients', 'leads', 'operations']
  },
  {
    uid: 'pari',
    email: 'pari@abgraphics.com',
    displayName: 'Pari',
    role: 'Team Member',
    title: 'Assistant & Content Planner',
    permissions: ['assistant', 'scheduling', 'reports', 'planner', 'followups']
  }
];
