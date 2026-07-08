import React, { createContext, useContext, useState, useEffect } from 'react';
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
import { Client, Lead, Task, Activity, DashboardStats, TelegramSettings, BrandSettings, FollowUp } from '../types';
import { isExpired, sanitizeForFirestore } from '../utils';

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
  addClient: (client: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'status'>, imageFile?: File | null) => Promise<void>;
  updateClient: (id: string, client: Partial<Client>, imageFile?: File | null) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addLead: (lead: Omit<Lead, 'id' | 'createdBy' | 'createdAt'>) => Promise<Lead>;
  updateLead: (id: string, lead: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  convertLeadToClient: (leadId: string, clientDetails: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'status'>, imageFile?: File | null) => Promise<void>;
  addTask: (
    title: string, 
    dueDate: string,
    type?: Task['type'],
    status?: Task['status'],
    clientId?: string,
    clientName?: string,
    notes?: string
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
  sendTelegramNotification: (messageText: string, eventType?: string, data?: any) => Promise<void>;
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

  const currentUser = {
    uid: 'default_user',
    email: 'admin@abgraphics.com',
    displayName: 'AB Graphics Admin'
  };

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

  // Client-side background checker for due/missed strategic follow-ups
  useEffect(() => {
    if (!currentUser || loading.followUps) return;

    const checkInterval = setInterval(async () => {
      const now = new Date();
      for (const f of followUps) {
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
                createdBy: currentUser.uid,
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
  }, [currentUser, followUps, loading.followUps, telegramSettings]);

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
    await sendTelegramNotification("", "client_created", { ...newClientDoc, id: docRef.id });
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

    const docRef = doc(db, 'clients', id);
    try {
      await updateDoc(docRef, sanitizeForFirestore(updatedData));

      if (isPaymentAdded && addedPayment) {
        sendTelegramNotification("", "payment_added", {
          clientName: existingClient?.name,
          businessName: existingClient?.businessName,
          payment: addedPayment,
          pendingAmount: clientData.pendingAmount ?? 0
        });
      }

      if (isPackageRenewed) {
        sendTelegramNotification("", "package_renewed", {
          name: clientData.name || existingClient?.name,
          businessName: clientData.businessName || existingClient?.businessName,
          packageDetails: clientData.packageDetails || existingClient?.packageDetails,
          startDate: clientData.startDate || existingClient?.startDate,
          expiryDate: clientData.expiryDate
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `clients/${id}`);
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

    const newLeadDoc = {
      ...leadData,
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString()
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

  const updateLead = async (id: string, leadData: Partial<Lead>) => {
    if (!currentUser) throw new Error("User must be authenticated");

    let updatedData = { ...leadData };
    delete updatedData.id;

    const docRef = doc(db, 'leads', id);
    try {
      await updateDoc(docRef, sanitizeForFirestore(updatedData));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${id}`);
    }
    await logActivity('lead_updated', `Updated lead: ${leadData.name || 'Lead'}`);
  };

  const deleteLead = async (id: string) => {
    if (!currentUser) throw new Error("User must be authenticated");
    
    const lead = leads.find(l => l.id === id);
    const leadName = lead ? lead.name : 'Unknown';

    try {
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

    // 1. Create client
    await addClient(clientDetails, imageFile);

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
    notes?: string
  ) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const newTask = {
      title,
      dueDate,
      completed: status === 'Completed',
      status,
      type,
      clientId: clientId || null,
      clientName: clientName || null,
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
    await logActivity('task_added', `Created task: "${title}" (${type}) due by ${dueDate}`);

    // Fetch matching client to get businessName for the Telegram notification
    const matchedClient = clients.find(c => c.id === clientId);
    const businessName = matchedClient ? matchedClient.businessName : 'N/A';

    await sendTelegramNotification("", "followup_created", {
      ...newTask,
      id: docRef.id,
      businessName
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
    }
  };

  const updateTask = async (id: string, taskData: Partial<Task>) => {
    if (!currentUser) throw new Error("User must be authenticated");

    const taskRef = doc(db, 'tasks', id);
    const dataToUpdate = { ...taskData };
    delete dataToUpdate.id;

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
    await logActivity('task_completed', `Updated task details for "${taskData.title || 'Task'}"`);
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
    await sendTelegramNotification("", "followup_created", { ...newFollowUpDoc, id: docRef.id });
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
      
      if (updatedData.status === 'Completed') {
        await logActivity('followup_updated', `Marked follow-up for ${name} as Completed`, existing?.clientId);
      } else if (updatedData.status === 'Missed') {
        // Trigger instant Missed telegram alert
        sendTelegramNotification("", "followup_missed", { ...existing, ...updatedData });
        await logActivity('followup_updated', `Marked follow-up for ${name} as Missed`, existing?.clientId);
      } else if (updatedData.status === 'Rescheduled') {
        // Trigger instant Rescheduled notification
        sendTelegramNotification("", "followup_rescheduled", { ...existing, ...updatedData });
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

  const sendTelegramNotification = async (messageText: string, eventType = 'custom', data?: any) => {
    if (!telegramSettings || !telegramSettings.enabled) {
      console.log("Telegram notifications disabled or unconfigured in client.");
      return;
    }

    try {
      const docId = (telegramSettings as any)?.id || 'default_user';
      const response = await fetch('/api/telegram/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: docId,
          eventType,
          messageText,
          data
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

  // Compute Dashboard Stats
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

  const stats: DashboardStats = {
    totalClients: clients.length,
    activeClients,
    expiredClients,
    totalRevenue,
    pendingPayments,
    monthlyRevenue,
    todayTasksCount
  };

  return (
    <CRMContext.Provider value={{
      clients,
      leads,
      tasks,
      activities,
      followUps,
      telegramSettings,
      brandSettings,
      loading,
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
      stats
    }}>
      {children}
    </CRMContext.Provider>
  );
};
