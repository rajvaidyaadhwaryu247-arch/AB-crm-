import { Lead, FollowUp } from './types';

/**
 * Auto-calculate expiry date based on start date and package duration
 */
export function calculateExpiryDate(startDateStr: string, duration: string): string {
  if (!startDateStr) return '';
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return '';

  switch (duration) {
    case '1 Month':
      date.setMonth(date.getMonth() + 1);
      break;
    case '3 Months':
      date.setMonth(date.getMonth() + 3);
      break;
    case '6 Months':
      date.setMonth(date.getMonth() + 6);
      break;
    case '1 Year':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case '2 Years':
      date.setFullYear(date.getFullYear() + 2);
      break;
    default:
      // Default fallback to 1 month
      date.setMonth(date.getMonth() + 1);
      break;
  }

  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format currency to Indian Rupees / USD
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format date to a readable string
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Check if a date string is in the past (expired)
 */
export function isExpired(expiryDateStr: string): boolean {
  if (!expiryDateStr) return false;
  const expiry = new Date(expiryDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return expiry.getTime() < today.getTime();
}

/**
 * Recursively removes all undefined properties from an object so that it can be safely saved to Firestore.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item)) as any;
  }

  if (typeof obj === 'object') {
    // If it's a date or other special object, return as is
    if (obj instanceof Date) {
      return obj;
    }
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Calculate Lead Score and Health based on rules and pipeline actions
 */
export function calculateLeadScoreAndHealth(
  lead: Partial<Lead>,
  followUps: FollowUp[] = []
): { score: number; label: 'Cold' | 'Warm' | 'Hot' | 'Ready To Close'; health: 'Healthy' | 'Needs Attention' | 'At Risk' } {
  // Converted is 100
  if (lead.status === 'Converted') {
    return { score: 100, label: 'Ready To Close', health: 'Healthy' };
  }
  // Lost is 0
  if (lead.status === 'Lost') {
    return { score: 0, label: 'Cold', health: 'At Risk' };
  }

  let score = 10; // Lead Created is +10

  const timeline = lead.timeline || [];
  const status = lead.status as any;

  // Phone Call
  const hasPhoneCall = timeline.some(item => 
    item.action.toLowerCase().includes('phone call') || 
    item.action.toLowerCase().includes('call') || 
    item.action.toLowerCase().includes('whatsapp contact')
  );
  if (hasPhoneCall || lead.lastContactDate) {
    score += 10;
  }

  // Meeting Scheduled
  const hasMeetingScheduled = status === 'Meeting Scheduled' || timeline.some(item => item.action.toLowerCase().includes('meeting scheduled') || item.action.toLowerCase().includes('schedule'));
  if (hasMeetingScheduled) {
    score += 10;
  }

  // Meeting Done
  const hasMeetingDone = status === 'Meeting Done' || !!lead.meetingOutcome || timeline.some(item => item.action.toLowerCase().includes('meeting done'));
  if (hasMeetingDone) {
    score += 15;
  }

  // Client Interested
  const isInterested = lead.mood === 'Very Positive' || lead.mood === 'Positive' || lead.buyingIntent === 'High' || lead.buyingIntent === 'Very High' || lead.meetingOutcome === 'Very Interested' || lead.meetingOutcome === 'Interested' || status === 'Interested';
  if (isInterested) {
    score += 20;
  }

  // Budget Discussed
  const isBudgetDiscussed = !!lead.budgetRange || !!lead.expectedRevenue;
  if (isBudgetDiscussed) {
    score += 10;
  }

  // Quotation Sent
  const isQuotationSent = status === 'Proposal / Quotation Sent' || timeline.some(item => item.action.toLowerCase().includes('proposal') || item.action.toLowerCase().includes('quotation'));
  if (isQuotationSent) {
    score += 5;
  }

  // Follow-up Completed
  const hasFollowUpCompleted = timeline.some(item => item.action.toLowerCase().includes('completed') || item.action.toLowerCase().includes('follow-up completed'));
  if (hasFollowUpCompleted) {
    score += 5;
  }

  // Payment Pending
  const isPaymentPending = status === 'Payment Pending' || timeline.some(item => item.action.toLowerCase().includes('payment pending'));
  if (isPaymentPending) {
    score += 10;
  }

  // Temporal/Negatives: No Contact for 7 Days (-15)
  let daysSinceLastContact = 0;
  if (lead.lastContactDate) {
    const lastContact = new Date(lead.lastContactDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastContact.getTime());
    daysSinceLastContact = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else if (lead.createdAt) {
    const created = new Date(lead.createdAt);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - created.getTime());
    daysSinceLastContact = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  if (daysSinceLastContact > 7) {
    score -= 15;
  }

  // Missed Follow-up (-10)
  const hasMissedFollowUp = followUps.some(f => f.clientId === lead.id && f.status === 'Missed');
  if (hasMissedFollowUp) {
    score -= 10;
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine display label
  let label: 'Cold' | 'Warm' | 'Hot' | 'Ready To Close' = 'Cold';
  if (score >= 80) {
    label = 'Ready To Close';
  } else if (score >= 50) {
    label = 'Hot';
  } else if (score >= 30) {
    label = 'Warm';
  }

  // Determine Health
  let health: 'Healthy' | 'Needs Attention' | 'At Risk' = 'Healthy';
  const hasPendingFollowUp = followUps.some(f => f.clientId === lead.id && f.status === 'Pending');

  if (status === 'Lost' || daysSinceLastContact > 14 || hasMissedFollowUp) {
    health = 'At Risk';
  } else if (daysSinceLastContact > 7 || (!hasPendingFollowUp && status !== 'Converted' && status !== 'New') || lead.mood === 'Negative' || lead.mood === 'Not Interested') {
    health = 'Needs Attention';
  }

  return { score, label, health };
}

