import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  getDocs,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Client, Lead, Task, Activity, DashboardStats, TelegramSettings, BrandSettings, FollowUp, CRMUser, teamMembers } from '../types';
import { isExpired, sanitizeForFirestore, calculateLeadScoreAndHealth } from '../utils';

interface CRMContextType {
  clients: Client[];
  leads: Lead[];
  tasks: Task[];
  activities: Activity[];
  followUps: FollowUp[];
  telegramSettings: TelegramSettings | null;
  brandSettings: BrandSettings | null;
  loading: {
    clients: boolean;
    leads: boolean;
    tasks: boolean;
    activities: boolean;
    telegram: boolean;
    followUps: boolean;
  };
  currentUser: CRMUser;
  setCurrentUser: (user: CRMUser) => void;
  teamMembers: CRMUser[];
  addClient: (client: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'status'>, imageFile?: File | null) => Promise<void>;
  updateClient: (id: string, client: Partial<Client>, imageFile?: File | null) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addLead: (lead: Omit<Lead, 'id' | 'createdBy' | 'createdAt'>) => Promise<Lead>;
  updateLead: (id: string, lead: Partial<Lead>, customAction?: string, customNotes?: string) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  convertLeadToClient: (leadId: string, clientDetails: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'status'>, imageFile?: File | null) => Promise<void>;
  addTask: (
    title: string, 
    dueDate: string,
    type?: Task['type'],
    status?: Task['status'],
    clientId?: string,
    clientName?: string,
    notes?: string,
    leadId?: string,
    leadName?: string,
    assignedTo?: Task['assignedTo'] | 'auto' | null,
    priority?: Task['priority'],
    plannerActivityId?: string
  ) => Promise<void>;
  toggleTask: (id: string, completed: boolean) => Promise<void>;
  updateTask: (id: string, taskData: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addFollowUp: (followUp: Omit<FollowUp, 'id' | 'createdBy' | 'createdAt'>) => Promise<void>;
  updateFollowUp: (id: string, followUp: Partial<FollowUp>) => Promise<void>;
  deleteFollowUp: (id: string) => Promise<void>;
  logActivity: (type: Activity['type'], description: string, clientId?: string) => Promise<void>;
  updateTelegramSettings: (settings: TelegramSettings) => Promise<void>;
  updateBrandSettings: (settings: Partial<BrandSettings>) => Promise<void>;
  sendTelegramNotification: (messageText: string, eventType?: string, data?: any, customBotToken?: string, customChatId?: string) => Promise<void>;
  sendTodayWorkSummary?: () => Promise<void>;
  stats: DashboardStats;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'default_user',
      email: 'admin@abgraphics.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getAutoAssignee(
  title: string,
  type?: string,
  notes?: string,
  hasPlanner?: boolean,
  hasLead?: boolean,
  hasClient?: boolean
): 'Bhargav' | 'Adhwaryu' | 'Pari' {
  const tLower = title.toLowerCase();
  const typeLower = (type || '').toLowerCase();
  const notesLower = (notes || '').toLowerCase();
  const text = `${tLower} ${typeLower} ${notesLower}`;

  // 1. Pari (Administration)
  if (
    text.includes('excel') ||
    text.includes('data entry') ||
    text.includes('client records') ||
    text.includes('lead records') ||
    text.includes('package records') ||
    text.includes('pending payment records') ||
    text.includes('payment records') ||
    text.includes('records') ||
    text.includes('reports') ||
    text.includes('report') ||
    text.includes('reminder') ||
    text.includes('verification') ||
    text.includes('documentation')
  ) {
    return 'Pari';
  }

  // 2. Bhargav (Creative)
  if (
    text.includes('reel shoot') ||
    text.includes('reel editing') ||
    text.includes('video editing') ||
    text.includes('reel') ||
    text.includes('creative') ||
    text.includes('design') ||
    text.includes('poster') ||
    text.includes('banner') ||
    text.includes('visiting card') ||
    text.includes('logo') ||
    text.includes('branding') ||
    text.includes('story design') ||
    text.includes('instagram post') ||
    text.includes('facebook post') ||
    text.includes('carousel') ||
    text.includes('website') ||
    text.includes('meta ads') ||
    text.includes('google ads') ||
    text.includes('media') ||
    text.includes('shoot') ||
    text.includes('editing') ||
    text.includes('graphic') ||
    text.includes('photo edit') ||
    text.includes('photo editing') ||
    text.includes('video edit') ||
    text.includes('story upload') ||
    typeLower.includes('shoot') ||
    typeLower.includes('editing') ||
    typeLower.includes('poster') ||
    typeLower.includes('website') ||
    typeLower.includes('printing')
  ) {
    return 'Bhargav';
  }

  // 3. Adhwaryu (Operations)
  if (
    text.includes('new lead') ||
    text.includes('lead follow-up') ||
    text.includes('lead followup') ||
    text.includes('lead follow') ||
    text.includes('lead conversion') ||
    text.includes('client meeting') ||
    text.includes('client call') ||
    text.includes('payment recovery') ||
    text.includes('package discussion') ||
    text.includes('package') ||
    text.includes('client management') ||
    text.includes('client') ||
    text.includes('content planner') ||
    text.includes('crm update') ||
    text.includes('crm') ||
    text.includes('follow-up') ||
    text.includes('followup') ||
    text.includes('schedule') ||
    text.includes('meeting') ||
    text.includes('operations') ||
    text.includes('call') ||
    text.includes('lead')
  ) {
    return 'Adhwaryu';
  }

  // Fallbacks by source module or properties
  if (hasPlanner) {
    return 'Bhargav';
  }
  if (hasLead || hasClient) {
    return 'Adhwaryu';
  }

  // Final smart structural defaults by type
  if (
    typeLower.includes('shoot') || 
    typeLower.includes('editing') || 
    typeLower.includes('poster') ||
    typeLower.includes('website') ||
    typeLower.includes('ads') ||
    typeLower.includes('printing')
  ) {
    return 'Bhargav';
  }

  return 'Adhwaryu';
}

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeeds] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings | null>(null);
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null);
  
  const [loading, setLoading] = useState({
    clients: true,
    leads: true,
    tasks: true,
    activities: true,
    telegram: true,
    followUps: true
  });

  const [currentUser, setCurrentUser] = useState<CRMUser>(teamMembers[0]);

  const hasScannedTasksRef = useRef(false);

  useEffect(() => {
    if (!loading.tasks && tasks.length > 0 && !hasScannedTasksRef.current) {
      hasScannedTasksRef.current = true;
      
      const scanAndAssignTasks = async () => {
        const unassignedTasks = tasks.filter(task => !task.assignedTo || task.assignedTo === 'Unassigned' as any || (task.assignedTo as any) === '');
        if (unassignedTasks.length === 0) return;

        console.log(`Smart Auto-Assignment Engine: Found ${unassignedTasks.length} unassigned tasks. Auto-assigning...`);
        
        for (const task of unassignedTasks) {
          const correctAssignee = getAutoAssignee(
            task.title,
            task.type,
            task.notes,
            !!task.plannerActivityId,
            !!task.leadId || !!task.leadName,
            !!task.clientId || !!task.clientName
          );

          try {
            const taskRef = doc(db, 'tasks', task.id);
            await updateDoc(taskRef, {
              assignedTo: correctAssignee
            });
            console.log(`Auto-assigned task "${task.title}" to ${correctAssignee}`);
          } catch (err) {
            console.error(`Failed to auto-assign task "${task.title}":`, err);
          }
        }
      };

      scanAndAssignTasks();
    }
  }, [loading.tasks, tasks]);

  // Set up Firestore real-time listeners for single-user environment (all docs loaded without auth gates)
  useEffect(() => {
    // Clients listener (fetch all)
    const qClients = query(
      collection(db, 'clients')
    );
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      const list: Client[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Check dynamically if clients are expired on load and update status if necessary
        const clientExpired = isExpired(data.expiryDate);
        const currentStatus = clientExpired ? 'Expired' : 'Active';
        
        // Send a Telegram notification if a client just transitioned to expired status
        if (data.status !== 'Expired' && clientExpired) {
          sendTelegramNotification("", "package_expired", data);
          
          // Persist the expired status in Firestore to prevent duplicate alerts
          const clientRef = doc(db, 'clients', docSnap.id);
          updateDoc(clientRef, { status: 'Expired' }).catch(err => console.error("Auto-expire save failed:", err));
        }

        list.push({
          id: docSnap.id,
          ...data,
          status: currentStatus,
        } as Client);
      });
      // Sort list by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setClients(list);
      setLoading((prev) => ({ ...prev, clients: false }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
      setLoading((prev) => ({ ...prev, clients: false }));
    });

    // Leads listener (fetch all)
    const qLeads = query(
      collection(db, 'leads')
    );
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      const list: Lead[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Lead);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLeeds(list);
      setLoading((prev) => ({ ...prev, leads: false }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
      setLoading((prev) => ({ ...prev, leads: false }));
    });

    // Tasks listener (fetch all)
    const qTasks = query(
      collection(db, 'tasks')
    );
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const completed = data.completed ?? false;
        const status = data.status || (completed ? 'Completed' : 'Pending');
        const type = data.type || 'Editing';
        list.push({
          id: docSnap.id,
          ...data,
          completed,
          status,
          type
        } as Task);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTasks(list);
      setLoading((prev) => ({ ...prev, tasks: false }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
      setLoading((prev) => ({ ...prev, tasks: false }));
    });

    // Telegram Settings listener (listen to 'default_user' directly)
    const docRef = doc(db, 'telegramSettings', 'default_user');
    const unsubTelegram = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setTelegramSettings({
          id: 'default_user',
          ...docSnap.data()
        } as any);
      } else {
        setTelegramSettings({ botToken: '', chatId: '', enabled: false });
      }
      setLoading((prev) => ({ ...prev, telegram: false }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'telegramSettings/default_user');
      setLoading((prev) => ({ ...prev, telegram: false }));
    });

    // Brand Settings listener (listen to 'default_user' directly)
    const brandDocRef = doc(db, 'brandSettings', 'default_user');
    const unsubBrand = onSnapshot(brandDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setBrandSettings({
          ...docSnap.data()
        } as BrandSettings);
      } else {
        setBrandSettings({});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'brandSettings/default_user');
    });

    // Activities listener (Limit to latest 50 for performance, fetch all)
    const qActivities = query(
      collection(db, 'activities')
    );
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      const list: Activity[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Activity);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(list.slice(0, 50));
      setLoading((prev) => ({ ...prev, activities: false }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activities');
      setLoading((prev) => ({ ...prev, activities: false }));
    });

    // Follow-ups listener (fetch all)
    const qFollowUps = query(
      collection(db, 'followups')
    );
    const unsubFollowUps = onSnapshot(qFollowUps, (snapshot) => {
      const list: FollowUp[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as FollowUp);
      });
      list.sort((a, b) => new Date(`${b.followUpDate}T${b.followUpTime || '00:00'}`).getTime() - new Date(`${a.followUpDate}T${a.followUpTime || '00:00'}`).getTime());
      setFollowUps(list);
      setLoading((prev) => ({ ...prev, followUps: false }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'followups');
      setLoading((prev) => ({ ...prev, followUps: false }));
    });

    return () => {
      unsubClients();
      unsubLeads();
      unsubTasks();
      unsubTelegram();
      unsubBrand();
      unsubActivities();
      unsubFollowUps();
    };
  }, []);

  // Keep updated refs of lists and settings for the background scheduler to avoid interval tear-downs
  const followUpsRef = useRef(followUps);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    followUpsRef.current = followUps;
    currentUserRef.current = currentUser;
  }, [followUps]);

  // Client-side background checker for due/missed strategic follow-ups
  useEffect(() => {
    if (loading.followUps) return;

    const checkInterval = setInterval(async () => {
      const now = new Date();
      const currentFollowUps = followUpsRef.current;
      const user = currentUserRef.current;
      if (!user) return;

      for (const f of currentFollowUps) {
        if (f.status !== 'Pending' && f.status !== 'Rescheduled') continue;

        // Scheduled datetime with local timezone offset -07:00 as requested
        const scheduledDate = new Date(`${f.followUpDate}T${f.followUpTime || '00:00'}:00-07:00`);
        const timeDiffMs = now.getTime() - scheduledDate.getTime();

        if (timeDiffMs >= 0) {
          // 1. Send Follow-up Reminder if not sent yet
          if (!f.telegramReminderSent) {
            const reminderText = `🔔 *FOLLOW-UP REMINDER*\n\n` +
              `Call this client now.\n\n` +
              `👤 *Client:* ${f.clientName || 'N/A'}\n` +
              `🏢 *Business:* ${f.businessName || 'N/A'}\n` +
              `📱 *Mobile:* ${f.mobile || 'N/A'}\n` +
              `📅 *Date:* ${f.followUpDate || 'N/A'}\n` +
              `⏰ *Time:* ${f.followUpTime || 'N/A'}\n` +
              `📝 *Notes:* ${f.notes || 'N/A'}`;

            try {
              // Optimistically set tag to avoid double execution on slow DB write
              f.telegramReminderSent = true;
              await updateDoc(doc(db, 'followups', f.id), { telegramReminderSent: true });
              console.log(`[Client Scheduler] Reminder for follow-up recorded: ${f.id}`);
            } catch (err) {
              f.telegramReminderSent = false;
              console.error(`[Client Scheduler] Failed to record reminder for follow-up: ${f.id}`, err);
            }
          }

          // 2. Auto-mark as Missed if still pending after 15 minutes
          const fifteenMinutesMs = 15 * 60 * 1000;
          if (timeDiffMs > fifteenMinutesMs && !f.telegramMissedSent && f.status !== 'Completed' && f.status !== 'Missed') {
            const missedText = `⚠️ *FOLLOW-UP MISSED*\n\n` +
              `Client: ${f.clientName || 'N/A'}\n` +
              `Phone: ${f.mobile || 'N/A'}\n` +
              `Please contact immediately.`;

            try {
              f.telegramMissedSent = true;
              f.status = 'Missed';
              
              await updateDoc(doc(db, 'followups', f.id), { 
                status: 'Missed', 
                telegramMissedSent: true 
              });
              
              await addDoc(collection(db, 'activities'), {
                type: 'followup_updated',
                description: `Auto-marked follow-up for ${f.clientName || 'Client'} as Missed`,
                timestamp: new Date().toISOString(),
                createdBy: user.uid,
                clientId: f.clientId || null
              });
              console.log(`[Client Scheduler] Marked follow-up as missed: ${f.id}`);
            } catch (err) {
              f.telegramMissedSent = false;
              f.status = 'Pending';
              console.error(`[Client Scheduler] Failed to mark follow-up as missed: ${f.id}`, err);
            }
          }
        }
      }
    }, 15000);

    return () => clearInterval(checkInterval);
  }, [loading.followUps]);

  // Image Upload Helper
  const handlePhotoUpload = async (file: File): Promise<string> => {
    if (!currentUser) return '';
    try {
      const storagePath = `users/${currentUser.uid}/clients/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(fileRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.warn("Storage upload failed or unauthorized, falling back to Base64:", error);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  };

  // Activity logger helper
  const logActivity = async (type: Activity['type'], description: string, clientId?: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'activities'), {
        type,
        description,
        timestamp: new Date().toISOString(),
        createdBy: currentUser.uid,
        clientId: clientId || null
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'activities');
    }
  };

  // Client Operations
  const addClient = async (
    clientData: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'status'>,
    imageFile?: File | null
  ) => {
    if (!currentUser) throw new Error("User must be authenticated");
    
    let photoUrl = clientData.profilePhoto || '';
    if (imageFile) {
      photoUrl = await handlePhotoUpload(imageFile);
    }

    const clientStatus = isExpired(clientData.expiryDate) ? 'Expired' : 'Active';

    const newClientDoc = {
      ...clientData,
      profilePhoto: photoUrl,
      status: clientStatus,
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString()
    };

    let docRef;
    try {
      docRef = await addDoc(collection(db, 'clients'), sanitizeForFirestore(newClientDoc));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'clients');
      return;
    }

    await logActivity('client_added', `Added new client: ${clientData.name} (${clientData.businessName})`, docRef.id);

    // If it is a Quick Service, create exactly one linked task in Team Workspace with auto assignment
    if (clientData.packageDetails?.type === 'Quick Service') {
      const serviceName = clientData.packageDetails.customName || 'Quick Service';
      const taskTitle = `${serviceName} (${clientData.businessName || clientData.name})`;
      
      const sNameLower = serviceName.toLowerCase();
      const notesLower = (clientData.notes || '').toLowerCase();
      const combinedText = `${sNameLower} ${notesLower}`;

      let taskType: Task['type'] = 'Editing';
      if (combinedText.includes('shoot')) {
        taskType = 'Shoot';
      } else if (
        combinedText.includes('poster') ||
        combinedText.includes('design') ||
        combinedText.includes('logo') ||
        combinedText.includes('banner') ||
        combinedText.includes('visiting card') ||
        combinedText.includes('branding') ||
        combinedText.includes('carousel') ||
        combinedText.includes('graphic')
      ) {
        taskType = 'Poster';
      } else if (combinedText.includes('ads') || combinedText.includes('google') || combinedText.includes('meta')) {
        taskType = 'Ads';
      } else if (combinedText.includes('website')) {
        taskType = 'Website';
      } else if (combinedText.includes('print')) {
        taskType = 'Printing';
      }

      // Determine correct assignee based on assignment rules
      const autoAssignedTo = getAutoAssignee(
        taskTitle,
        taskType,
        clientData.notes,
        false,
        false,
        true
      ) || 'Bhargav';

      const newTask = {
        title: taskTitle,
        dueDate: clientData.expiryDate || clientData.startDate,
        completed: false,
        status: 'Pending' as Task['status'],
        type: taskType,
        clientId: docRef.id,
        clientName: clientData.name,
        assignedTo: autoAssignedTo,
        priority: 'Medium' as Task['priority'],
        notes: clientData.notes || '',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString()
      };

      try {
        await addDoc(collection(db, 'tasks'), sanitizeForFirestore(newTask));
        await logActivity('task_added', `Created linked task: "${taskTitle}" (${taskType}) assigned to ${autoAssignedTo} for Quick Service customer ${clientData.name}`);
        
        // Send a beautiful custom Telegram notification with all required fields
        const price = clientData.packageDetails.price;
        const paid = clientData.revenue;
        const pending = clientData.pendingAmount;
        
        const tgMessage = `⚡ *NEW QUICK SERVICE CREATED* ⚡\n\n` +
          `👤 *Customer:* ${clientData.name} (${clientData.businessName})\n` +
          `📦 *Service:* ${serviceName}\n` +
          `👤 *Assigned To:* ${autoAssignedTo}\n` +
          `💰 *Amount:* ₹${price}\n` +
          `💵 *Paid:* ₹${paid}\n` +
          `💳 *Pending:* ₹${pending}\n` +
          `📅 *Due Date:* ${newTask.dueDate}\n` +
          `📝 *Notes:* ${clientData.notes || 'None'}`;
          
        await sendTelegramNotification(tgMessage, "custom");
      } catch (taskErr) {
        console.error("Failed to add linked Quick Service task:", taskErr);
      }
    } else {
      // Standard client creation notification
      await sendTelegramNotification("", "client_created", { ...newClientDoc, id: docRef.id });
    }
  };

  const updateClient = async (id: string, clientData: Partial<Client>, imageFile?: File | null) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const existingClient = clients.find(c => c.id === id);

    let updatedData = { ...clientData };
    if (imageFile) {
      const photoUrl = await handlePhotoUpload(imageFile);
      updatedData.profilePhoto = photoUrl;
    }

    if (updatedData.expiryDate) {
      updatedData.status = isExpired(updatedData.expiryDate) ? 'Expired' : 'Active';
    }

    // Strip out id if present
    delete updatedData.id;

    // Detect Payment Added trigger
    let isPaymentAdded = false;
    let addedPayment: any = null;
    const existingPaymentsCount = existingClient?.payments?.length || 0;
    const newPaymentsCount = clientData.payments?.length || 0;
    if (newPaymentsCount > existingPaymentsCount && clientData.payments) {
      isPaymentAdded = true;
      addedPayment = clientData.payments[clientData.payments.length - 1];
    }

    // Detect Package Renewed trigger
    let isPackageRenewed = false;
    if (existingClient && clientData.expiryDate && existingClient.expiryDate && clientData.expiryDate !== existingClient.expiryDate) {
      const oldTime = new Date(existingClient.expiryDate).getTime();
      const newTime = new Date(clientData.expiryDate).getTime();
      if (newTime > oldTime) {
        isPackageRenewed = true;
      }
    }

    // Detect Conversion from Quick Service to standard Campaign Client
    const isConvertingFromQuickService = 
      existingClient?.packageDetails?.type === 'Quick Service' && 
      updatedData.packageDetails?.type !== 'Quick Service' && 
      updatedData.packageDetails?.type !== undefined;

    const docRef = doc(db, 'clients', id);
    try {
      await updateDoc(docRef, sanitizeForFirestore(updatedData));

      if (isConvertingFromQuickService) {
        // Log client conversion activity
        const newPkgType = updatedData.packageDetails?.type || 'Custom';
        await logActivity('lead_converted', `Converted Quick Service customer "${existingClient.name}" into an official Campaign Client with package: ${newPkgType}`, id);

        // Send a custom Telegram notification for the conversion
        const price = updatedData.packageDetails?.price || 0;
        const startDate = updatedData.startDate || existingClient?.startDate || 'N/A';
        const expiryDate = updatedData.expiryDate || existingClient?.expiryDate || 'N/A';

        const tgConvMessage = `🔄 *QUICK SERVICE CUSTOMER CONVERTED TO CLIENT* 🔄\n\n` +
          `👤 *Customer:* ${existingClient.name}\n` +
          `🏢 *Business:* ${existingClient.businessName}\n` +
          `📦 *New Package:* ${newPkgType}\n` +
          `💰 *Package Price:* ₹${price}\n` +
          `📅 *Start Date:* ${startDate}\n` +
          `📅 *Expiry Date:* ${expiryDate}\n` +
          `📝 *Notes:* ${updatedData.notes || existingClient?.notes || 'None'}`;

        await sendTelegramNotification(tgConvMessage, "custom");
      }

      // Bidirectional sync: Content Planner to Tasks
      if (existingClient && clientData.contentPlanner && clientData.contentPlanner.days) {
        const updatedDays = clientData.contentPlanner.days;
        const clientName = clientData.name || existingClient?.name || '';
        const clientBusinessName = clientData.businessName || existingClient?.businessName || '';

        // 1. Gather all active activities in the updated content planner
        const activeActivities: { id: string; date: string; type: string; notes: string; status: string; customTypeName?: string }[] = [];
        for (const dateKey of Object.keys(updatedDays)) {
          const dayPlan = updatedDays[dateKey];
          if (dayPlan && Array.isArray(dayPlan.activities)) {
            for (const act of dayPlan.activities) {
              activeActivities.push({
                id: act.id,
                date: dateKey,
                type: act.type,
                customTypeName: act.customTypeName,
                notes: act.notes || '',
                status: act.status
              });
            }
          }
        }

        // 2. Find all existing tasks linked to this client that have a plannerActivityId
        const clientLinkedTasks = tasks.filter(t => t.clientId === id && t.plannerActivityId);

        // Map existing tasks by plannerActivityId
        const existingTasksMap = new Map<string, typeof tasks[0]>();
        clientLinkedTasks.forEach(t => {
          if (t.plannerActivityId) {
            existingTasksMap.set(t.plannerActivityId, t);
          }
        });

        // 3. Sync each active activity
        const mapActivityTypeToTaskType = (type: string): Task['type'] => {
          const t = type.toLowerCase();
          if (t.includes('shoot')) return 'Shoot';
          if (t.includes('edit')) return 'Editing';
          if (t.includes('poster') || t.includes('carousel') || t.includes('design') || t.includes('graphic')) return 'Poster';
          if (t.includes('ads') || t.includes('google') || t.includes('meta')) return 'Ads';
          if (t.includes('website')) return 'Website';
          if (t.includes('print')) return 'Printing';
          return 'Editing'; // fallback default
        };

        for (const act of activeActivities) {
          const matchedTask = existingTasksMap.get(act.id);
          const isCompleted = act.status === 'Completed' || act.status === 'Posted';
          const taskStatus: Task['status'] = isCompleted ? 'Completed' : (act.status === 'In Progress' ? 'In Progress' : 'Pending');
          const actName = act.type === 'Custom Activity' ? (act.customTypeName || 'Custom Activity') : act.type;
          const expectedTitle = `${actName} (${clientBusinessName || clientName})`;

          if (matchedTask) {
            // Task already exists, check if we need to update it
            const needsUpdate = 
              matchedTask.dueDate !== act.date ||
              matchedTask.completed !== isCompleted ||
              matchedTask.status !== taskStatus ||
              matchedTask.title !== expectedTitle ||
              matchedTask.notes !== act.notes;

            if (needsUpdate) {
              const taskRef = doc(db, 'tasks', matchedTask.id);
              await updateDoc(taskRef, {
                dueDate: act.date,
                completed: isCompleted,
                status: taskStatus,
                title: expectedTitle,
                notes: act.notes
              });
            }
          } else {
            // Task does not exist, create it!
            const newTaskType = mapActivityTypeToTaskType(act.type);
            const autoAssignedTo = getAutoAssignee(expectedTitle, newTaskType, act.notes, true, false, true) || 'Bhargav';
            await addDoc(collection(db, 'tasks'), sanitizeForFirestore({
              title: expectedTitle,
              dueDate: act.date,
              completed: isCompleted,
              status: taskStatus,
              type: newTaskType,
              clientId: id,
              clientName: clientName,
              assignedTo: autoAssignedTo,
              priority: 'Medium',
              plannerActivityId: act.id,
              notes: act.notes,
              createdBy: currentUser.uid,
              createdAt: new Date().toISOString()
            }));
          }
        }

        // 4. Delete tasks for activities that were deleted
        const activeActivityIds = new Set(activeActivities.map(a => a.id));
        for (const [activityId, taskObj] of existingTasksMap.entries()) {
          if (!activeActivityIds.has(activityId)) {
            // This activity was deleted, delete its corresponding task!
            const taskRef = doc(db, 'tasks', taskObj.id);
            await deleteDoc(taskRef);
          }
        }
      }

      if (isPaymentAdded && addedPayment) {
        sendTelegramNotification("", "payment_added", {
          clientName: existingClient?.name,
          businessName: existingClient?.businessName,
          payment: addedPayment,
          pendingAmount: clientData.pendingAmount ?? 0,
          address: existingClient?.address,
          notes: existingClient?.notes
        });
      }

      if (isPackageRenewed) {
        sendTelegramNotification("", "package_renewed", {
          name: clientData.name || existingClient?.name,
          businessName: clientData.businessName || existingClient?.businessName,
          packageDetails: clientData.packageDetails || existingClient?.packageDetails,
          startDate: clientData.startDate || existingClient?.startDate,
          expiryDate: clientData.expiryDate,
          address: clientData.address || existingClient?.address,
          notes: clientData.notes || existingClient?.notes
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${id}`);
    }

    // Bidirectional sync: Client to Lead and other modules
    if (existingClient) {
      const leadId = clientData.leadId || existingClient.leadId;
      const linkedLead = leads.find(l => l.id === leadId || (existingClient.mobile && l.mobile === existingClient.mobile));
      if (linkedLead) {
        const leadSyncData: Partial<Lead> = {};
        if (clientData.name && clientData.name !== linkedLead.name) leadSyncData.name = clientData.name;
        if (clientData.businessName && clientData.businessName !== linkedLead.business) leadSyncData.business = clientData.businessName;
        if (clientData.mobile && clientData.mobile !== linkedLead.mobile) leadSyncData.mobile = clientData.mobile;
        if (clientData.email && clientData.email !== linkedLead.email) leadSyncData.email = clientData.email;
        if (clientData.address && clientData.address !== linkedLead.address) leadSyncData.address = clientData.address;

        if (Object.keys(leadSyncData).length > 0) {
          const leadRef = doc(db, 'leads', linkedLead.id);
          await updateDoc(leadRef, sanitizeForFirestore(leadSyncData));
        }
      }

      // Sync all Tasks associated with this Client
      const updatedClientName = clientData.name || existingClient.name;
      const linkedTasks = tasks.filter(t => t.clientId === id || (linkedLead && t.leadId === linkedLead.id));
      for (const t of linkedTasks) {
        const taskSyncPayload: Partial<Task> = {};
        if (t.clientId === id && t.clientName !== updatedClientName) {
          taskSyncPayload.clientName = updatedClientName;
        }
        if (linkedLead && t.leadId === linkedLead.id && t.leadName !== updatedClientName) {
          taskSyncPayload.leadName = updatedClientName;
        }
        if (Object.keys(taskSyncPayload).length > 0) {
          const tRef = doc(db, 'tasks', t.id);
          await updateDoc(tRef, taskSyncPayload);
        }
      }

      // Sync all Followups associated with this Client
      const updatedBusinessName = clientData.businessName || existingClient.businessName;
      const updatedMobile = clientData.mobile || existingClient.mobile;
      const linkedFollowups = followUps.filter(f => f.clientId === id || (linkedLead && f.clientId === linkedLead.id) || (existingClient.mobile && f.mobile === existingClient.mobile));
      for (const f of linkedFollowups) {
        const followupSyncPayload: Partial<FollowUp> = {};
        if (f.clientName !== updatedClientName) followupSyncPayload.clientName = updatedClientName;
        if (f.businessName !== updatedBusinessName) followupSyncPayload.businessName = updatedBusinessName;
        if (f.mobile !== updatedMobile) followupSyncPayload.mobile = updatedMobile;

        if (Object.keys(followupSyncPayload).length > 0) {
          const fRef = doc(db, 'followups', f.id);
          await updateDoc(fRef, sanitizeForFirestore(followupSyncPayload));
        }
      }
    }

    await logActivity('client_updated', `Updated client details for: ${clientData.name || existingClient?.name || 'Client'}`, id);
  };

  const deleteClient = async (id: string) => {
    if (!currentUser) throw new Error("User must be authenticated");
    
    const client = clients.find(c => c.id === id);
    const clientName = client ? client.name : 'Unknown';

    try {
      // Cascade delete linked tasks
      const qTasks = query(collection(db, 'tasks'), where('clientId', '==', id));
      const snapTasks = await getDocs(qTasks);
      const deletePromises: Promise<void>[] = [];
      snapTasks.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'tasks', docSnap.id)));
      });

      // Cascade delete linked followups
      const qFollowups = query(collection(db, 'followups'), where('clientId', '==', id));
      const snapFollowups = await getDocs(qFollowups);
      snapFollowups.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'followups', docSnap.id)));
      });

      // Cascade delete linked reminders
      const qReminders = query(collection(db, 'reminders'), where('clientId', '==', id));
      const snapReminders = await getDocs(qReminders);
      snapReminders.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'reminders', docSnap.id)));
      });

      // Cascade delete linked activities
      const qActivities = query(collection(db, 'activities'), where('clientId', '==', id));
      const snapActivities = await getDocs(qActivities);
      snapActivities.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'activities', docSnap.id)));
      });

      // Cascade delete linked notifications (if stored)
      const qNotifications = query(collection(db, 'notifications'), where('clientId', '==', id));
      const snapNotifications = await getDocs(qNotifications);
      snapNotifications.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'notifications', docSnap.id)));
      });

      await Promise.all(deletePromises);

      // Delete core client document
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
    }
    await logActivity('client_deleted', `Deleted client: ${clientName}`);
  };

  // Lead Operations
  const addLead = async (leadData: Omit<Lead, 'id' | 'createdBy' | 'createdAt'>): Promise<Lead> => {
    if (!currentUser) throw new Error("User must be authenticated");

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const userStr = currentUser.displayName || 'AB Graphics Admin';

    // Initialize with a clean "Lead Created" timeline entry
    const initialTimelineItem = {
      date: dateStr,
      time: timeStr,
      action: 'Lead Created',
      previousValue: '',
      newValue: leadData.status || 'New',
      user: userStr,
      notes: leadData.notes || 'Lead logged in system'
    };

    const tempLead = {
      ...leadData,
      timeline: [initialTimelineItem],
      createdAt: now.toISOString()
    };

    const { score, health } = calculateLeadScoreAndHealth(tempLead, followUps);

    const newLeadDoc = {
      ...tempLead,
      leadScore: score,
      health: health,
      createdBy: currentUser.uid,
      createdAt: tempLead.createdAt
    };

    try {
      const docRef = await addDoc(collection(db, 'leads'), sanitizeForFirestore(newLeadDoc));
      const savedLead: Lead = {
        ...newLeadDoc,
        id: docRef.id
      };
      await logActivity('lead_added', `Created new lead: ${leadData.name} from ${leadData.leadSource}`);
      return savedLead;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leads');
      throw error;
    }
  };

  const updateLead = async (id: string, leadData: Partial<Lead>, customAction?: string, customNotes?: string) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const existingLead = leads.find(l => l.id === id);
    if (!existingLead) throw new Error("Lead not found");

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const userStr = currentUser.displayName || 'AB Graphics Admin';

    const newTimelineItems: any[] = [];

    // Check what changed to automatically maintain timeline history
    if (leadData.status && leadData.status !== existingLead.status) {
      newTimelineItems.push({
        date: dateStr,
        time: timeStr,
        action: 'Status Changed',
        previousValue: existingLead.status,
        newValue: leadData.status,
        user: userStr,
        notes: leadData.notes || `Pipeline status advanced from ${existingLead.status} to ${leadData.status}`
      });
    }

    if (leadData.mood && leadData.mood !== existingLead.mood) {
      newTimelineItems.push({
        date: dateStr,
        time: timeStr,
        action: 'Mood Changed',
        previousValue: existingLead.mood || 'N/A',
        newValue: leadData.mood,
        user: userStr,
        notes: `Mood set to ${leadData.mood}`
      });
    }

    if (leadData.buyingIntent && leadData.buyingIntent !== existingLead.buyingIntent) {
      newTimelineItems.push({
        date: dateStr,
        time: timeStr,
        action: 'Buying Intent Changed',
        previousValue: existingLead.buyingIntent || 'N/A',
        newValue: leadData.buyingIntent,
        user: userStr,
        notes: `Buying Intent set to ${leadData.buyingIntent}`
      });
    }

    if (customAction) {
      newTimelineItems.push({
        date: dateStr,
        time: timeStr,
        action: customAction,
        previousValue: '',
        newValue: '',
        user: userStr,
        notes: customNotes || ''
      });
    }

    const updatedTimeline = [...(leadData.timeline || existingLead.timeline || []), ...newTimelineItems];

    const tentativeLead: Lead = {
      ...existingLead,
      ...leadData,
      timeline: updatedTimeline
    };

    const { score, health } = calculateLeadScoreAndHealth(tentativeLead, followUps);

    const finalUpdatedData = {
      ...leadData,
      timeline: updatedTimeline,
      leadScore: score,
      health: health,
      lastContactDate: (customAction && (customAction.includes('Call') || customAction.includes('WhatsApp'))) 
        ? dateStr 
        : (leadData.lastContactDate || existingLead.lastContactDate || existingLead.createdAt.split('T')[0])
    };

    delete (finalUpdatedData as any).id;

    const docRef = doc(db, 'leads', id);
    try {
      await updateDoc(docRef, sanitizeForFirestore(finalUpdatedData));
      await logActivity('lead_updated', `Updated lead: ${existingLead.name} (${customAction || 'Details Updated'})`);

      // Real-time synchronization to linked Client and other modules
      const linkedClient = clients.find(c => c.leadId === id || (existingLead.mobile && c.mobile === existingLead.mobile));
      if (linkedClient) {
        const clientSyncData: Partial<Client> = {};
        if (leadData.name && leadData.name !== linkedClient.name) clientSyncData.name = leadData.name;
        if (leadData.business && leadData.business !== linkedClient.businessName) clientSyncData.businessName = leadData.business;
        if (leadData.mobile) {
          if (leadData.mobile !== linkedClient.mobile) clientSyncData.mobile = leadData.mobile;
          if (leadData.mobile !== linkedClient.whatsApp) clientSyncData.whatsApp = leadData.mobile;
        }
        if (leadData.email && leadData.email !== linkedClient.email) clientSyncData.email = leadData.email;
        if (leadData.address && leadData.address !== linkedClient.address) clientSyncData.address = leadData.address;

        if (Object.keys(clientSyncData).length > 0) {
          const clientRef = doc(db, 'clients', linkedClient.id);
          await updateDoc(clientRef, sanitizeForFirestore(clientSyncData));
        }
      }

      // Sync all Tasks linked with leadId or clientId
      const updatedLeadName = leadData.name || existingLead.name;
      const updatedClientName = leadData.name || existingLead.name;
      const linkedTasks = tasks.filter(t => t.leadId === id || (linkedClient && t.clientId === linkedClient.id));
      for (const t of linkedTasks) {
        const taskSyncPayload: Partial<Task> = {};
        if (t.leadId === id && t.leadName !== updatedLeadName) {
          taskSyncPayload.leadName = updatedLeadName;
        }
        if (linkedClient && t.clientId === linkedClient.id && t.clientName !== updatedClientName) {
          taskSyncPayload.clientName = updatedClientName;
        }
        if (Object.keys(taskSyncPayload).length > 0) {
          const tRef = doc(db, 'tasks', t.id);
          await updateDoc(tRef, taskSyncPayload);
        }
      }

      // Sync all Followups linked with leadId or clientId
      const updatedBusinessName = leadData.business || existingLead.business;
      const updatedMobile = leadData.mobile || existingLead.mobile;
      const linkedFollowups = followUps.filter(f => f.clientId === id || (linkedClient && f.clientId === linkedClient.id) || (existingLead.mobile && f.mobile === existingLead.mobile));
      for (const f of linkedFollowups) {
        const followupSyncPayload: Partial<FollowUp> = {};
        if (f.clientName !== updatedLeadName) followupSyncPayload.clientName = updatedLeadName;
        if (f.businessName !== updatedBusinessName) followupSyncPayload.businessName = updatedBusinessName;
        if (f.mobile !== updatedMobile) followupSyncPayload.mobile = updatedMobile;

        if (Object.keys(followupSyncPayload).length > 0) {
          const fRef = doc(db, 'followups', f.id);
          await updateDoc(fRef, sanitizeForFirestore(followupSyncPayload));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${id}`);
      throw error;
    }
  };

  const deleteLead = async (id: string) => {
    if (!currentUser) throw new Error("User must be authenticated");
    
    const lead = leads.find(l => l.id === id);
    const leadName = lead ? lead.name : 'Unknown';

    try {
      // 1. Cascade delete linked tasks where task.leadId === id
      const qTasks = query(collection(db, 'tasks'), where('leadId', '==', id));
      const snapTasks = await getDocs(qTasks);
      const deletePromises: Promise<void>[] = [];
      snapTasks.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'tasks', docSnap.id)));
      });

      // 2. Cascade delete linked followups where followup.clientId === id
      const qFollowups = query(collection(db, 'followups'), where('clientId', '==', id));
      const snapFollowups = await getDocs(qFollowups);
      snapFollowups.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'followups', docSnap.id)));
      });

      await Promise.all(deletePromises);

      // 3. Delete Lead document itself (never delete a linked Client)
      await deleteDoc(doc(db, 'leads', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leads/${id}`);
    }
    await logActivity('lead_updated', `Deleted lead: ${leadName}`);
  };

  // Convert Lead to Client
  const convertLeadToClient = async (
    leadId: string, 
    clientDetails: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'status'>,
    imageFile?: File | null
  ) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const lead = leads.find(l => l.id === leadId);
    const leadNotes = lead?.notes || '';
    let leadHistoryText = '';
    if (lead?.timeline && lead.timeline.length > 0) {
      leadHistoryText = '\n\n--- LEAD TIMELINE HISTORY ---\n' + lead.timeline.map(t => `[${t.date} ${t.time}] ${t.action}: ${t.notes || ''}`).join('\n');
    }

    const mergedNotes = (clientDetails.notes || '') + (leadNotes ? `\n\nLead Notes: ${leadNotes}` : '') + leadHistoryText;
    const finalClientDetails = {
      ...clientDetails,
      notes: mergedNotes,
      leadId: leadId
    };

    // Prevent duplicates: search for an existing client that is already linked or matches mobile / business
    const existingClient = clients.find(c => 
      c.leadId === leadId || 
      (lead?.mobile && c.mobile === lead.mobile) || 
      (lead?.business && c.businessName?.toLowerCase() === lead.business.toLowerCase())
    );

    if (existingClient) {
      // Link and update existing client rather than creating a duplicate
      await updateClient(existingClient.id, {
        ...finalClientDetails,
        leadId: leadId
      }, imageFile);
    } else {
      // Create new client if none exists
      await addClient(finalClientDetails, imageFile);
    }

    // 2. Update Lead status to 'Converted'
    const leadRef = doc(db, 'leads', leadId);
    try {
      await updateDoc(leadRef, { status: 'Converted' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${leadId}`);
    }

    // 3. Log conversion activity
    await logActivity('lead_converted', `Converted lead: ${clientDetails.name} into an official client!`);
  };

  // Task Operations
  const addTask = async (
    title: string, 
    dueDate: string,
    type: Task['type'] = 'Editing',
    status: Task['status'] = 'Pending',
    clientId?: string,
    clientName?: string,
    notes?: string,
    leadId?: string,
    leadName?: string,
    assignedTo?: Task['assignedTo'] | 'auto' | null,
    priority?: Task['priority'],
    plannerActivityId?: string
  ) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const autoAssignee = (assignedTo === undefined || (assignedTo as any) === 'auto') ? getAutoAssignee(
      title, 
      type, 
      notes, 
      !!plannerActivityId, 
      !!leadId || !!leadName, 
      !!clientId || !!clientName
    ) : assignedTo;

    const newTask = {
      title,
      dueDate,
      completed: status === 'Completed',
      status,
      type,
      clientId: clientId || null,
      clientName: clientName || null,
      leadId: leadId || null,
      leadName: leadName || null,
      assignedTo: autoAssignee || null,
      priority: priority || 'Medium',
      plannerActivityId: plannerActivityId || null,
      notes: notes || '',
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString()
    };

    let docRef;
    try {
      docRef = await addDoc(collection(db, 'tasks'), sanitizeForFirestore(newTask));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
      return;
    }
    const assignStr = assignedTo ? ` assigned to ${assignedTo}` : '';
    await logActivity('task_added', `Created task: "${title}" (${type})${assignStr} due by ${dueDate}`);

    // Fetch matching client to get businessName for the Telegram notification
    const matchedClient = clients.find(c => c.id === clientId);
    const businessName = matchedClient ? matchedClient.businessName : 'N/A';

    await sendTelegramNotification("", "followup_created", {
      ...newTask,
      id: docRef.id,
      businessName,
      address: matchedClient?.address,
      notes: matchedClient?.notes
    });
  };

  const toggleTask = async (id: string, completed: boolean) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const taskRef = doc(db, 'tasks', id);
    const status = completed ? 'Completed' : 'Pending';
    try {
      await updateDoc(taskRef, { completed, status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }

    const task = tasks.find(t => t.id === id);
    if (task) {
      await logActivity('task_completed', `Marked task "${task.title}" as ${status}`);

      // Sync task completion with content planner activity
      if (task.clientId && task.plannerActivityId) {
        const clientObj = clients.find(c => c.id === task.clientId);
        if (clientObj && clientObj.contentPlanner && clientObj.contentPlanner.days) {
          let updated = false;
          const updatedDays = { ...clientObj.contentPlanner.days };
          for (const dateKey of Object.keys(updatedDays)) {
            const dayPlan = updatedDays[dateKey];
            if (dayPlan && Array.isArray(dayPlan.activities)) {
              const acts = dayPlan.activities.map(act => {
                if (act.id === task.plannerActivityId) {
                  updated = true;
                  return { ...act, status: (completed ? 'Completed' : 'Planned') as any };
                }
                return act;
              });
              if (updated) {
                updatedDays[dateKey] = { ...dayPlan, activities: acts };
                break;
              }
            }
          }
          if (updated) {
            const clientRef = doc(db, 'clients', task.clientId);
            await updateDoc(clientRef, {
              'contentPlanner.days': updatedDays
            });
          }
        }
      }

      // Send Telegram notification if completed
      if (completed) {
        try {
          const matchedClient = clients.find(c => c.id === task.clientId);
          const businessName = matchedClient ? (matchedClient.businessName || matchedClient.name) : 'N/A';
          await sendTelegramNotification("", "followup_created", {
            ...task,
            status: 'Completed',
            completed: true,
            clientName: task.clientName || matchedClient?.name || 'N/A',
            businessName,
            address: matchedClient?.address,
            notes: task.notes
          });
        } catch (tgErr) {
          console.error("Failed to send task completion Telegram alert:", tgErr);
        }
      }
    }
  };

  const updateTask = async (id: string, taskData: Partial<Task>) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const taskRef = doc(db, 'tasks', id);
    const dataToUpdate = { ...taskData };
    delete dataToUpdate.id;

    if ((dataToUpdate.assignedTo as any) === 'auto') {
      const existingTask = tasks.find(t => t.id === id);
      dataToUpdate.assignedTo = getAutoAssignee(
        dataToUpdate.title || existingTask?.title || '',
        dataToUpdate.type || existingTask?.type,
        dataToUpdate.notes || existingTask?.notes,
        !!(dataToUpdate.plannerActivityId || existingTask?.plannerActivityId),
        !!(dataToUpdate.leadId || existingTask?.leadId),
        !!(dataToUpdate.clientId || existingTask?.clientId)
      );
    }

    if (dataToUpdate.status) {
      dataToUpdate.completed = dataToUpdate.status === 'Completed';
    } else if (dataToUpdate.completed !== undefined) {
      dataToUpdate.status = dataToUpdate.completed ? 'Completed' : 'Pending';
    }

    try {
      await updateDoc(taskRef, sanitizeForFirestore(dataToUpdate));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }

    const task = tasks.find(t => t.id === id);
    if (task) {
      await logActivity('task_completed', `Updated task details for "${taskData.title || 'Task'}"`);

      // Sync task details with content planner activity if status/completed changed
      const isCompleted = dataToUpdate.completed ?? taskData.completed ?? task.completed;
      const statusVal = isCompleted ? 'Completed' : 'Planned';

      if (task.clientId && task.plannerActivityId) {
        const clientObj = clients.find(c => c.id === task.clientId);
        if (clientObj && clientObj.contentPlanner && clientObj.contentPlanner.days) {
          let updated = false;
          const updatedDays = { ...clientObj.contentPlanner.days };
          for (const dateKey of Object.keys(updatedDays)) {
            const dayPlan = updatedDays[dateKey];
            if (dayPlan && Array.isArray(dayPlan.activities)) {
              const acts = dayPlan.activities.map(act => {
                if (act.id === task.plannerActivityId) {
                  updated = true;
                  return { ...act, status: statusVal as any };
                }
                return act;
              });
              if (updated) {
                updatedDays[dateKey] = { ...dayPlan, activities: acts };
                break;
              }
            }
          }
          if (updated) {
            const clientRef = doc(db, 'clients', task.clientId);
            await updateDoc(clientRef, {
              'contentPlanner.days': updatedDays
            });
          }
        }
      }

      // Send Telegram notification if newly completed
      const wasCompleted = task.completed;
      if (isCompleted && !wasCompleted) {
        try {
          const matchedClient = clients.find(c => c.id === task.clientId);
          const businessName = matchedClient ? (matchedClient.businessName || matchedClient.name) : 'N/A';
          await sendTelegramNotification("", "followup_created", {
            ...task,
            ...dataToUpdate,
            status: 'Completed',
            completed: true,
            clientName: task.clientName || matchedClient?.name || 'N/A',
            businessName,
            address: matchedClient?.address,
            notes: dataToUpdate.notes || task.notes
          });
        } catch (tgErr) {
          console.error("Failed to send task completion Telegram alert:", tgErr);
        }
      }
    }
  };

  const deleteTask = async (id: string) => {
    if (!currentUser) throw new Error("User must be authenticated");

    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  // Follow-Up Operations
  const addFollowUp = async (followUpData: Omit<FollowUp, 'id' | 'createdBy' | 'createdAt'>) => {
    if (!currentUser) throw new Error("User must be authenticated");

    // Validation
    const today = new Date().toISOString().split('T')[0];
    if (!followUpData.followUpDate || followUpData.followUpDate < today) {
      throw new Error("Invalid follow-up date. Date cannot be in the past.");
    }

    const newFollowUpDoc = {
      ...followUpData,
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString(),
      telegramReminderSent: false,
      telegramMissedSent: false
    };

    let docRef;
    try {
      docRef = await addDoc(collection(db, 'followups'), sanitizeForFirestore(newFollowUpDoc));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'followups');
      return;
    }

    await logActivity('followup_added', `Scheduled follow-up for client ${followUpData.clientName} on ${followUpData.followUpDate} at ${followUpData.followUpTime}`, followUpData.clientId);
    const matchedClient = clients.find(c => c.id === followUpData.clientId);
    await sendTelegramNotification("", "followup_created", { 
      ...newFollowUpDoc, 
      id: docRef.id,
      address: matchedClient?.address,
      notes: matchedClient?.notes
    });
  };

  const updateFollowUp = async (id: string, followUpData: Partial<FollowUp>) => {
    if (!currentUser) throw new Error("User must be authenticated");

    let updatedData = { ...followUpData };
    delete updatedData.id;

    // Reset Telegram reminders if rescheduled
    if (updatedData.status === 'Rescheduled' || (updatedData.followUpDate || updatedData.followUpTime)) {
      updatedData.telegramReminderSent = false;
      updatedData.telegramMissedSent = false;
    }

    const docRef = doc(db, 'followups', id);
    try {
      await updateDoc(docRef, sanitizeForFirestore(updatedData));
      
      const existing = followUps.find(f => f.id === id);
      const name = existing?.clientName || 'Client';
      const matchedClient = clients.find(c => c.id === existing?.clientId);
      
      if (updatedData.status === 'Completed') {
        await logActivity('followup_updated', `Marked follow-up for ${name} as Completed`, existing?.clientId);
      } else if (updatedData.status === 'Missed') {
        // Trigger instant Missed telegram alert
        sendTelegramNotification("", "followup_missed", { 
          ...existing, 
          ...updatedData,
          address: matchedClient?.address,
          notes: matchedClient?.notes
        });
        await logActivity('followup_updated', `Marked follow-up for ${name} as Missed`, existing?.clientId);
      } else if (updatedData.status === 'Rescheduled') {
        // Trigger instant Rescheduled notification
        sendTelegramNotification("", "followup_rescheduled", { 
          ...existing, 
          ...updatedData,
          address: matchedClient?.address,
          notes: matchedClient?.notes
        });
        await logActivity('followup_updated', `Rescheduled follow-up for ${name} to ${updatedData.followUpDate} ${updatedData.followUpTime}`, existing?.clientId);
      } else {
        await logActivity('followup_updated', `Updated follow-up settings for ${name}`, existing?.clientId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `followups/${id}`);
    }
  };

  const deleteFollowUp = async (id: string) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const existing = followUps.find(f => f.id === id);
    const name = existing?.clientName || 'Client';

    try {
      await deleteDoc(doc(db, 'followups', id));
      await logActivity('followup_deleted', `Deleted follow-up entry for ${name}`, existing?.clientId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `followups/${id}`);
    }
  };

  // Telegram settings functions
  const updateTelegramSettings = async (settings: TelegramSettings) => {
    const docId = (telegramSettings as any)?.id || 'default_user';
    const docRef = doc(db, 'telegramSettings', docId);
    try {
      await setDoc(docRef, sanitizeForFirestore(settings));
      setTelegramSettings({ ...settings, id: docId } as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `telegramSettings/${docId}`);
    }
    await logActivity('client_updated', `Updated Telegram Bot settings`);
  };

  // Brand settings functions
  const updateBrandSettings = async (settings: Partial<BrandSettings>) => {
    const docRef = doc(db, 'brandSettings', 'default_user');
    try {
      const updated = {
        ...brandSettings,
        ...settings
      };
      await setDoc(docRef, sanitizeForFirestore(updated));
      setBrandSettings(updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'brandSettings/default_user');
    }
    await logActivity('client_updated', `Updated global agency brand assets`);
  };

  const sendTelegramNotification = async (
    messageText: string,
    eventType = 'custom',
    data?: any,
    customBotToken?: string,
    customChatId?: string
  ) => {
    try {
      const docId = (telegramSettings as any)?.id || 'default_user';
      const idToken = '';

      const response = await fetch('/.netlify/functions/sendTelegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: docId,
          idToken,
          eventType,
          messageText,
          data,
          botToken: customBotToken || undefined,
          chatId: customChatId || undefined
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed && parsed.error) errMsg = parsed.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      console.log(`Telegram notification for event "${eventType}" sent successfully via secure backend!`);
    } catch (error) {
      console.error("Failed to send Telegram notification via backend:", error);
      throw error;
    }
  };

  // Send client-wise grouped Today's Work summary to Telegram
  const sendTodayWorkSummary = async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    let msg = `📅 *AB GRAPHICS - DAILY AGENCY WORKPLAN*\n`;
    msg += `Date: *${todayStr}*\n\n`;

    let activeClientsWithWork = 0;

    clients.forEach((c) => {
      if (c.status !== 'Active') return;

      const dayPlan = c.contentPlanner?.days?.[todayStr];
      const clientTasks = tasks.filter(t => t.clientId === c.id && t.dueDate === todayStr);

      const activities = dayPlan?.activities || [];

      if (activities.length === 0 && clientTasks.length === 0) {
        return;
      }

      activeClientsWithWork++;
      msg += `🏢 *CLIENT: ${c.businessName || c.name}*\n`;

      if (activities.length > 0) {
        msg += `• *Content Planner Checklist:*\n`;
        activities.forEach(act => {
          const actName = act.type === 'Custom Activity' ? (act.customTypeName || 'Custom Activity') : act.type;
          msg += `  - [${act.status}] *${actName}* ${act.notes ? `: ${act.notes}` : ''}\n`;
        });
      }

      if (clientTasks.length > 0) {
        msg += `• *Team Operations Tasks:*\n`;
        // Group by assignee
        const byAssignee: Record<string, typeof clientTasks> = {};
        clientTasks.forEach(t => {
          const assignee = t.assignedTo || 'Unassigned';
          if (!byAssignee[assignee]) byAssignee[assignee] = [];
          byAssignee[assignee].push(t);
        });

        Object.keys(byAssignee).forEach(assignee => {
          msg += `  👤 *${assignee}:*\n`;
          byAssignee[assignee].forEach(t => {
            msg += `    - [${t.status}] *${t.title}* (Priority: ${t.priority || 'Medium'})${t.notes ? `\n      _${t.notes}_` : ''}\n`;
          });
        });
      }

      msg += `\n-----------------------------------------\n\n`;
    });

    if (activeClientsWithWork === 0) {
      msg += `No marketing activities or team tasks scheduled for today. Ready for scheduling!`;
    } else {
      msg += `🚀 Let's deliver phenomenal results today!\n_Grouped for Bhargav & Adhwaryu_`;
    }

    await sendTelegramNotification(msg, 'custom');
  };

  // Compute Dashboard Stats
  const stats = useMemo<DashboardStats>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Calculate revenue from active/expired clients
    const totalRevenue = clients.reduce((acc, c) => acc + (c.revenue || 0), 0);
    const pendingPayments = clients.reduce((acc, c) => acc + (c.pendingAmount || 0), 0);
    
    // Monthly revenue is revenue from clients whose start date is in the current month
    const currentMonthYear = todayStr.substring(0, 7); // YYYY-MM
    const monthlyRevenue = clients
      .filter(c => c.startDate && c.startDate.startsWith(currentMonthYear))
      .reduce((acc, c) => acc + (c.revenue || 0), 0);

    const activeClients = clients.filter(c => c.status === 'Active').length;
    const expiredClients = clients.filter(c => c.status === 'Expired').length;
    const todayTasksCount = tasks.filter(t => t.dueDate === todayStr && !t.completed).length;

    return {
      totalClients: clients.length,
      activeClients,
      expiredClients,
      totalRevenue,
      pendingPayments,
      monthlyRevenue,
      todayTasksCount
    };
  }, [clients, tasks]);

  const providerValue = useMemo(() => ({
    clients,
    leads,
    tasks,
    activities,
    followUps,
    telegramSettings,
    brandSettings,
    loading,
    currentUser,
    setCurrentUser,
    teamMembers,
    addClient,
    updateClient,
    deleteClient,
    addLead,
    updateLead,
    deleteLead,
    convertLeadToClient,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    addFollowUp,
    updateFollowUp,
    deleteFollowUp,
    logActivity,
    updateTelegramSettings,
    updateBrandSettings,
    sendTelegramNotification,
    sendTodayWorkSummary,
    stats
  }), [
    clients,
    leads,
    tasks,
    activities,
    followUps,
    telegramSettings,
    brandSettings,
    loading,
    currentUser,
    addClient,
    updateClient,
    deleteClient,
    addLead,
    updateLead,
    deleteLead,
    convertLeadToClient,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    addFollowUp,
    updateFollowUp,
    deleteFollowUp,
    logActivity,
    updateTelegramSettings,
    updateBrandSettings,
    sendTelegramNotification,
    sendTodayWorkSummary,
    stats
  ]);

  return (
    <CRMContext.Provider value={providerValue}>
      {children}
    </CRMContext.Provider>
  );
};
