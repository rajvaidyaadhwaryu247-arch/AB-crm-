import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

// Initialize Firebase Admin
const app = admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const CACHE_FILE = path.join(process.cwd(), 'telegram-cache.json');

interface CachedSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

// Save active settings to local file cache so automated background tests can use them
function saveSettingsToCache(userId: string, settings: CachedSettings) {
  try {
    let cache: Record<string, CachedSettings> = {};
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
    cache[userId] = settings;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log(`[Cache] Successfully cached Telegram settings for user ${userId}`);
  } catch (err) {
    console.error('[Cache] Failed to save settings to local cache:', err);
  }
}

// Load settings from local file cache
function loadSettingsFromCache(): Record<string, CachedSettings> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[Cache] Failed to load settings from local cache:', err);
  }
  return {};
}

// Securely fetch Telegram settings using Google Firestore REST API with the client's ID Token or public API Key
async function fetchTelegramSettingsFromRest(userId: string, idToken?: string): Promise<CachedSettings> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/telegramSettings/${userId}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  } else {
    url += `?key=${firebaseConfig.apiKey}`;
  }

  console.log(`[REST Firestore] Fetching document: ${url}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: headers
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST API returned ${res.status}: ${text}`);
  }

  const json = await res.json();
  const fields = json.fields || {};

  const enabled = fields.enabled && fields.enabled.booleanValue !== undefined ? fields.enabled.booleanValue : false;
  const botToken = fields.botToken && fields.botToken.stringValue !== undefined ? fields.botToken.stringValue : '';
  const chatId = fields.chatId && fields.chatId.stringValue !== undefined ? fields.chatId.stringValue : '';

  const settings = { enabled, botToken, chatId };
  saveSettingsToCache(userId, settings);
  return settings;
}

async function sendTelegramWithRetry(botToken: string, chatId: string, text: string, retries = 3) {
  let attempt = 1;
  while (attempt <= retries) {
    try {
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
        }),
      });

      const resJson = await response.json().catch(() => null);

      if (!response.ok || !resJson || resJson.ok !== true) {
        const errMsg = resJson?.description || `Telegram API returned status ${response.status}`;
        throw new Error(errMsg);
      }

      console.log(`[Telegram] Message sent successfully on attempt ${attempt}`);
      return true;
    } catch (err) {
      console.error(`[Telegram] Attempt ${attempt} failed:`, err);
      if (attempt === retries) {
        throw err;
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
}

async function runBackgroundFollowUpCheck() {
  try {
    const snap = await db.collection('followups').where('status', 'in', ['Pending', 'Rescheduled']).get();
    if (snap.empty) return;

    for (const doc of snap.docs) {
      const fData = doc.data();
      const id = doc.id;
      
      // Target -07:00 as requested for local timezone
      const scheduledDate = new Date(`${fData.followUpDate}T${fData.followUpTime || '00:00'}:00-07:00`);
      const now = new Date();
      
      const timeDiffMs = now.getTime() - scheduledDate.getTime();
      
      if (timeDiffMs >= 0) {
        const userId = fData.createdBy;
        if (!userId) continue;

        const settingsSnap = await db.collection('telegramSettings').doc(userId).get();
        if (!settingsSnap.exists) continue;
        const settings = settingsSnap.data();

        if (settings && settings.enabled && settings.botToken && settings.chatId) {
          if (!fData.telegramReminderSent) {
            const reminderText = `🔔 *FOLLOW-UP REMINDER*\n\n` +
              `Call this client now.\n\n` +
              `👤 *Client:* ${fData.clientName || 'N/A'}\n` +
              `🏢 *Business:* ${fData.businessName || 'N/A'}\n` +
              `📱 *Mobile:* ${fData.mobile || 'N/A'}\n` +
              `📅 *Date:* ${fData.followUpDate || 'N/A'}\n` +
              `⏰ *Time:* ${fData.followUpTime || 'N/A'}\n` +
              `📝 *Notes:* ${fData.notes || 'N/A'}`;

            try {
              await sendTelegramWithRetry(settings.botToken, settings.chatId, reminderText, 3);
              await doc.ref.update({ telegramReminderSent: true });
              console.log(`[Background Scheduler] Reminder sent successfully for meetup: ${id}`);
            } catch (err) {
              console.error(`[Background Scheduler] Failed to send reminder for mockup: ${id}`, err);
            }
          }

          // Automatically mark as Missed if still pending after 15 minutes
          const fifteenMinutesMs = 15 * 60 * 1000;
          if (timeDiffMs > fifteenMinutesMs && !fData.telegramMissedSent && fData.status !== 'Completed' && fData.status !== 'Missed') {
            const missedText = `⚠️ *FOLLOW-UP MISSED*\n\n` +
              `Client: ${fData.clientName || 'N/A'}\n` +
              `Phone: ${fData.mobile || 'N/A'}\n` +
              `Please contact immediately.`;

            try {
              await sendTelegramWithRetry(settings.botToken, settings.chatId, missedText, 3);
              await doc.ref.update({ 
                status: 'Missed', 
                telegramMissedSent: true 
              });
              
              await db.collection('activities').add({
                type: 'followup_updated',
                description: `Auto-marked follow-up for ${fData.clientName || 'Client'} as Missed`,
                timestamp: new Date().toISOString(),
                createdBy: userId,
                clientId: fData.clientId || null
              });
              console.log(`[Background Scheduler] Follow-up marked as missed for mockup: ${id}`);
            } catch (err) {
              console.error(`[Background Scheduler] Failed to send missed alert for mockup: ${id}`, err);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Background Scheduler] Error running follow-up check:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware with increased limit for photos
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  function formatTelegramMessage(eventType: string, data: any, messageText: string): string {
    if (eventType === 'custom' || eventType === 'test') {
      return messageText || `🔔 *AB Graphics CRM Bot Test*\n\nYour Telegram Bot settings have been saved successfully!\n\n🤖 *Bot Status:* Online & Connected\n📅 *Server Time:* ${new Date().toLocaleString('en-IN')}\n🚀 *System:* Ready to push active lead & renewal notifications.`;
    }

    // Client (New Client Created, Client Push Button, Client Expiry Reminder, Package Renewed)
    if (eventType === 'client_created' || eventType === 'client_updated') {
      const isNew = eventType === 'client_created';
      const header = isNew ? '🆕 *New Client Created*' : '👤 *Client Details*';
      const name = data?.name || 'N/A';
      const business = data?.businessName || 'N/A';
      const mobile = data?.mobile || 'N/A';
      const packageName = data?.packageDetails?.customName || data?.packageDetails?.type || 'Custom';
      const price = data?.packageDetails?.price ?? 0;
      const pending = data?.pendingAmount ?? 0;
      const startDate = data?.startDate || 'N/A';
      const expiryDate = data?.expiryDate || 'N/A';

      return `${header}\n\n` +
        `• *Name:* ${name}\n` +
        `• *Business:* ${business}\n` +
        `• *Mobile:* ${mobile}\n` +
        `• *Package:* ${packageName}\n` +
        `• *Amount:* ₹${price}\n` +
        `• *Pending:* ₹${pending}\n` +
        `• *Start Date:* ${startDate}\n` +
        `• *Expiry Date:* ${expiryDate}`;
    }

    // New Lead Created / Lead Push Button
    if (eventType === 'lead_created' || eventType === 'lead_updated') {
      const header = eventType === 'lead_created' ? '🆕 *New Lead Created*' : '📊 *Lead Details*';
      const name = data?.name || 'N/A';
      const mobile = data?.mobile || 'N/A';
      const business = data?.business || 'N/A';
      const source = data?.leadSource || 'N/A';
      const notes = data?.notes || 'None';
      const createdDate = data?.createdAt 
        ? new Date(data.createdAt).toLocaleDateString('en-IN') 
        : new Date().toLocaleDateString('en-IN');

      return `${header}\n\n` +
        `• *Name:* ${name}\n` +
        `• *Mobile:* ${mobile}\n` +
        `• *Business:* ${business}\n` +
        `• *Source:* ${source}\n` +
        `• *Notes:* ${notes}\n` +
        `• *Date:* ${createdDate}`;
    }

    // Task vs Schedule (followup_created)
    if (eventType === 'followup_created' || eventType === 'task_created' || eventType === 'schedule_created') {
      // If it has followUpDate, it's a Schedule
      if (data?.followUpDate || eventType === 'schedule_created') {
        const header = '📅 *New Schedule Created*';
        const title = data?.reason || data?.title || 'N/A';
        const date = data?.followUpDate || 'N/A';
        const time = data?.followUpTime || 'N/A';
        const client = data?.clientName || 'N/A';

        return `${header}\n\n` +
          `• *Title:* ${title}\n` +
          `• *Date:* ${date}\n` +
          `• *Time:* ${time}\n` +
          `• *Assigned Client:* ${client}`;
      } else {
        // It's a Task
        const header = '📌 *New Task Created*';
        const title = data?.title || 'N/A';
        const client = data?.clientName || 'N/A';
        const dueDate = data?.dueDate || 'N/A';
        const priority = data?.priority || 'Medium';
        const status = data?.status || 'Pending';

        return `${header}\n\n` +
          `• *Title:* ${title}\n` +
          `• *Client:* ${client}\n` +
          `• *Due Date:* ${dueDate}\n` +
          `• *Priority:* ${priority}\n` +
          `• *Status:* ${status}`;
      }
    }

    // Payment Added
    if (eventType === 'payment_added') {
      const header = '💰 *Payment Added*';
      const client = data?.clientName || 'N/A';
      const amount = data?.payment?.amount || 0;
      const remaining = data?.pendingAmount ?? 0;

      return `${header}\n\n` +
        `• *Client:* ${client}\n` +
        `• *Amount:* ₹${amount}\n` +
        `• *Remaining Balance:* ₹${remaining}`;
    }

    // Package Renewed
    if (eventType === 'package_renewed') {
      const header = '🔄 *Package Renewed*';
      const client = data?.name || 'N/A';
      const packageName = data?.packageDetails?.customName || data?.packageDetails?.type || 'Custom';
      const amount = data?.packageDetails?.price ?? 0;
      const startDate = data?.startDate || 'N/A';
      const expiryDate = data?.expiryDate || 'N/A';

      return `${header}\n\n` +
        `• *Client:* ${client}\n` +
        `• *Package:* ${packageName}\n` +
        `• *Amount:* ₹${amount}\n` +
        `• *Start Date:* ${startDate}\n` +
        `• *Expiry Date:* ${expiryDate}`;
    }

    // Client Expiry Reminder / package_expired
    if (eventType === 'package_expired' || eventType === 'expiry_reminder') {
      const header = '⚠️ *Client Expiry Reminder*';
      const client = data?.name || 'N/A';
      const packageName = data?.packageDetails?.customName || data?.packageDetails?.type || 'Custom';
      const expiryDate = data?.expiryDate || 'N/A';

      return `${header}\n\n` +
        `• *Client:* ${client}\n` +
        `• *Package:* ${packageName}\n` +
        `• *Expiry Date:* ${expiryDate}`;
    }

    if (eventType === 'followup_missed') {
      const client = data?.clientName || 'N/A';
      const mobile = data?.mobile || 'N/A';
      return `⚠️ *FOLLOW-UP MISSED*\n\n• *Client:* ${client}\n• *Mobile:* ${mobile}\n\nPlease contact immediately.`;
    }

    if (eventType === 'followup_rescheduled') {
      const client = data?.clientName || 'N/A';
      const business = data?.businessName || 'N/A';
      const date = data?.followUpDate || 'N/A';
      const time = data?.followUpTime || 'N/A';
      const notes = data?.notes || 'N/A';
      return `🔄 *Schedule Rescheduled*\n\n• *Client:* ${client}\n• *Business:* ${business}\n• *Date:* ${date}\n• *Time:* ${time}\n• *Notes:* ${notes}`;
    }

    return messageText || 'Notification from AB Graphics CRM';
  }

  const handleSendTelegram = async (req: any, res: any) => {
    try {
      const { userId, idToken, eventType, messageText, data } = req.body;
      const bodyBotToken = req.body.botToken;
      const bodyChatId = req.body.chatId;

      console.log(`[Telegram API] Received notification request. eventType: ${eventType}`);

      // 1. Try to read from environment variables first
      let botToken = process.env.TELEGRAM_BOT_TOKEN;
      let chatId = process.env.TELEGRAM_CHAT_ID;

      // 2. If not in environment variables, try bodyBotToken/bodyChatId or Firestore fallback (only for local dev/preview)
      if (!botToken || !chatId) {
        if (bodyBotToken && bodyChatId) {
          botToken = bodyBotToken;
          chatId = bodyChatId;
          console.log(`[Telegram API] Environment variables missing. Using botToken and chatId from request body.`);
        } else if (userId) {
          let settings: CachedSettings | null = null;
          try {
            settings = await fetchTelegramSettingsFromRest(userId, idToken);
            if (settings && settings.enabled && settings.botToken && settings.chatId) {
              botToken = settings.botToken;
              chatId = settings.chatId;
              console.log(`[Telegram API] Environment variables missing. Loaded settings from Firestore via REST for user ${userId}`);
            }
          } catch (restErr: any) {
            console.log(`[Telegram API] Firestore REST fetch bypassed: ${restErr.message}`);
          }

          if (!botToken || !chatId) {
            try {
              const docSnap = await db.collection('telegramSettings').doc(userId).get();
              if (docSnap.exists) {
                const docData = docSnap.data();
                if (docData && docData.enabled && docData.botToken && docData.chatId) {
                  botToken = docData.botToken;
                  chatId = docData.chatId;
                  console.log(`[Telegram API] Environment variables missing. Loaded settings from Firestore via Admin SDK fallback for user ${userId}`);
                }
              }
            } catch (adminErr: any) {
              console.log(`[Telegram API] Firestore Admin SDK fallback bypassed: ${adminErr.message}`);
            }
          }

          if (!botToken || !chatId) {
            const cache = loadSettingsFromCache();
            if (cache[userId]) {
              const cached = cache[userId];
              if (cached.enabled && cached.botToken && cached.chatId) {
                botToken = cached.botToken;
                chatId = cached.chatId;
                console.log(`[Telegram API] Environment variables missing. Loaded settings from local cache for user ${userId}`);
              }
            }
          }
        }
      }

      if (!botToken || !chatId) {
        return res.status(400).json({ 
          success: false,
          error: 'Telegram environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not configured.' 
        });
      }

      // Format message exactly as specified
      const formattedMessage = formatTelegramMessage(eventType, data, messageText);

      // Send Telegram API request with up to 3 automatic retries
      await sendTelegramWithRetry(botToken, chatId, formattedMessage, 3);

      console.log(`[Telegram API] Message successfully sent with retries`);
      return res.json({ success: true });

    } catch (error: any) {
      console.error('[Telegram API] Failed to send notification after retries:', error);
      return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  };

  // Register both paths to handle local and preview requests beautifully
  app.post('/.netlify/functions/sendTelegram', handleSendTelegram);
  app.post('/api/telegram/notify', handleSendTelegram);

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: firebaseConfig.projectId });
  });

  // Vite middleware for development or static file serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Follow-up background check shifted securely to client-side to operate within user authentication context
  });
}

startServer();

