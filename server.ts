import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

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

// Securely fetch Telegram settings using Google Firestore REST API with the client's ID Token
async function fetchTelegramSettingsFromRest(userId: string, idToken: string): Promise<CachedSettings> {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/telegramSettings/${userId}`;

  console.log(`[REST Firestore] Fetching document: ${url}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    }
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

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Telegram API returned ${response.status}: ${errText}`);
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

  // API route for Telegram Notifications
  app.post('/api/telegram/notify', async (req, res) => {
    try {
      const { userId, idToken, eventType, messageText, data } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      console.log(`[Telegram API] Received notification request for user ${userId}, eventType: ${eventType}`);

      let settings: CachedSettings | null = null;

      // 1. Attempt to fetch live Telegram settings from Firestore via Admin SDK directly
      if (userId) {
        try {
          const docSnap = await db.collection('telegramSettings').doc(userId).get();
          if (docSnap.exists) {
            const docData = docSnap.data();
            if (docData) {
              settings = {
                enabled: docData.enabled ?? false,
                botToken: docData.botToken ?? '',
                chatId: docData.chatId ?? '',
              };
              saveSettingsToCache(userId, settings);
              console.log(`[Telegram API] Loaded live Telegram settings using Admin SDK for user ${userId}`);
            }
          }
        } catch (adminErr: any) {
          console.warn(`[Telegram API] Admin SDK Firestore fetch failed, trying local cache... Error: ${adminErr.message}`);
        }
      }

      // 2. Fallback to local cache if Admin SDK fails
      if (!settings) {
        const cache = loadSettingsFromCache();
        if (cache[userId]) {
          settings = cache[userId];
          console.log(`[Telegram API] Loaded Telegram settings from local cache for user ${userId}`);
        }
      }

      // 3. Error if no configuration available
      if (!settings) {
        return res.status(400).json({ 
          error: 'Telegram settings not found. Please configure your Telegram Bot settings in the Telegram Settings tab.' 
        });
      }

      if (!settings.enabled || !settings.botToken || !settings.chatId) {
        return res.status(400).json({ error: 'Telegram notifications are disabled or incomplete for this user.' });
      }

      let formattedMessage = '';

      if (eventType === 'client_created' || eventType === 'client_updated') {
        const services = Array.isArray(data.packageDetails?.services) 
          ? data.packageDetails.services.join(', ') 
          : 'None';
        const amountPaid = data.revenue ?? 0;
        const pendingAmount = data.pendingAmount ?? 0;

        const header = eventType === 'client_created' 
          ? `🚀 *New Client Onboarded Successfully!*` 
          : `🔄 *Client Profile Updated!*`;

        formattedMessage = `${header}\n\n` +
          `👤 *Client Name:* ${data.name || 'N/A'}\n` +
          `🏢 *Business Name:* ${data.businessName || 'N/A'}\n` +
          `📞 *Mobile Number:* ${data.mobile || 'N/A'}\n` +
          `📦 *Package Name:* ${data.packageDetails?.customName || data.packageDetails?.type || 'Custom'}\n` +
          `💰 *Package Price:* ₹${data.packageDetails?.price || 0}\n` +
          `💵 *Amount Paid:* ₹${amountPaid}\n` +
          `📉 *Pending Amount:* ₹${pendingAmount}\n` +
          `⏳ *Package Duration:* ${data.packageDuration || data.packageDetails?.duration || 'N/A'}\n` +
          `📅 *Start Date:* ${data.startDate || 'N/A'}\n` +
          `⌛ *Expiry Date:* ${data.expiryDate || 'N/A'}\n` +
          `🛠️ *Included Services:* ${services}`;

      } else if (eventType === 'payment_added') {
        formattedMessage = `💰 *Payment Received!*\n\n` +
          `👤 *Client:* ${data.clientName || 'N/A'}\n` +
          `🏢 *Business:* ${data.businessName || 'N/A'}\n` +
          `💵 *Amount:* ₹${data.payment?.amount || 0}\n` +
          `💳 *Mode:* ${data.payment?.mode || 'N/A'}\n` +
          `📝 *Type:* ${data.payment?.type || 'N/A'}\n` +
          `📝 *Notes:* ${data.payment?.notes || 'N/A'}\n` +
          `📉 *Pending Balance:* ₹${data.pendingAmount ?? 0}`;

      } else if (eventType === 'package_renewed') {
        formattedMessage = `🔄 *Campaign Renewed!*\n\n` +
          `👤 *Client:* ${data.name || 'N/A'}\n` +
          `🏢 *Business:* ${data.businessName || 'N/A'}\n` +
          `📦 *New Package:* ${data.packageDetails?.customName || data.packageDetails?.type || 'Custom'}\n` +
          `💰 *Price:* ₹${data.packageDetails?.price || 0}\n` +
          `📅 *New Start Date:* ${data.startDate || 'N/A'}\n` +
          `⌛ *New Expiry Date:* ${data.expiryDate || 'N/A'}`;

      } else if (eventType === 'package_expired') {
        formattedMessage = `⚠️ *Campaign Expired!*\n\n` +
          `👤 *Client:* ${data.name || 'N/A'}\n` +
          `🏢 *Business:* ${data.businessName || 'N/A'}\n` +
          `📦 *Package:* ${data.packageDetails?.customName || data.packageDetails?.type || 'Custom'}\n` +
          `📅 *Expired On:* ${data.expiryDate || 'N/A'}`;

      } else if (eventType === 'followup_created') {
        formattedMessage = `📞 *New Follow-up Created*\n\n` +
          `👤 *Client:* ${data.clientName || 'N/A'}\n` +
          `🏢 *Business:* ${data.businessName || 'N/A'}\n` +
          `📱 *Mobile:* ${data.mobile || 'N/A'}\n\n` +
          `📅 *Date:* ${data.followUpDate || 'N/A'}\n` +
          `⏰ *Time:* ${data.followUpTime || 'N/A'}\n\n` +
          `📌 *Reason:* ${data.reason || 'N/A'}\n` +
          `📝 *Notes:* ${data.notes || 'N/A'}\n\n` +
          `Priority: *${data.priority || 'N/A'}*\n` +
          `Status: *${data.status || 'N/A'}*`;

      } else if (eventType === 'followup_missed') {
        formattedMessage = `⚠️ *FOLLOW-UP MISSED*\n\n` +
          `Client: ${data.clientName || 'N/A'}\n` +
          `Phone: ${data.mobile || 'N/A'}\n` +
          `Please contact immediately.`;

      } else if (eventType === 'followup_rescheduled') {
        formattedMessage = `🔄 *Follow-up Rescheduled*\n\n` +
          `👤 *Client:* ${data.clientName || 'N/A'}\n` +
          `🏢 *Business:* ${data.businessName || 'N/A'}\n` +
          `📅 *New Date:* ${data.followUpDate || 'N/A'}\n` +
          `⏰ *New Time:* ${data.followUpTime || 'N/A'}\n\n` +
          `📝 *Notes:* ${data.notes || 'N/A'}`;

      } else {
        formattedMessage = messageText || 'Notification from AB Graphics CRM';
      }

      // Send Telegram API request with up to 3 automatic retries
      await sendTelegramWithRetry(settings.botToken, settings.chatId, formattedMessage, 3);

      console.log(`[Telegram API] Message successfully sent with retries for user ${userId}`);
      return res.json({ success: true });

    } catch (error: any) {
      console.error('[Telegram API] Failed to send notification after retries:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

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

// Startup Automatic Testing (Requirement 10)
setTimeout(async () => {
  try {
    console.log('[Startup Test] Running automated client creation Telegram notification test...');
    const cache = loadSettingsFromCache();
    const activeUserId = Object.keys(cache).find(uid => {
      const s = cache[uid];
      return s && s.enabled && s.botToken && s.chatId;
    });
    
    if (activeUserId) {
      const settings = cache[activeUserId];
      console.log(`[Startup Test] Found active cached Telegram settings for user ${activeUserId}. Dispatching test notification...`);

      const testClient = {
        name: 'John Doe (Startup Test)',
        businessName: 'AB Graphics Test Enterprise',
        mobile: '+91 98765 43210',
        whatsApp: '+91 98765 43210',
        email: 'johndoe@test.com',
        address: '123 Creative Studio Lane, Delhi',
        startDate: new Date().toISOString().split('T')[0],
        packageDuration: '3 Months',
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Active',
        paymentStatus: 'Paid',
        revenue: 15000,
        pendingAmount: 2500,
        packageDetails: {
          type: 'Pro',
          customName: 'Mega Premium Brand Package',
          price: 17500,
          duration: '3 Months',
          services: ['Brand Logo Design', 'Daily Social Media Graphics', '3D Motion Reel Video', 'SEO Audit']
        }
      };

      const services = testClient.packageDetails.services.join(', ');

      const formattedMessage = `🤖 *AB Graphics CRM - Automated Client Creation Test*\n\n` +
        `This is a secure server-side automatic test following deployment verification.\n\n` +
        `👤 *Client Name:* ${testClient.name}\n` +
        `🏢 *Business Name:* ${testClient.businessName}\n` +
        `📞 *Mobile Number:* ${testClient.mobile}\n` +
        `📦 *Package Name:* ${testClient.packageDetails.customName}\n` +
        `💰 *Package Price:* ₹${testClient.packageDetails.price}\n` +
        `💵 *Amount Paid:* ₹${testClient.revenue}\n` +
        `📉 *Pending Amount:* ₹${testClient.pendingAmount}\n` +
        `⏳ *Package Duration:* ${testClient.packageDuration}\n` +
        `📅 *Start Date:* ${testClient.startDate}\n` +
        `⌛ *Expiry Date:* ${testClient.expiryDate}\n` +
        `🛠️ *Included Services:* ${services}`;

      const telegramUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: formattedMessage,
          parse_mode: 'Markdown',
        }),
      });

      if (response.ok) {
        console.log('[Startup Test] Automated client creation Telegram test notification dispatched successfully!');
      } else {
        const text = await response.text();
        console.error(`[Startup Test] Automated test failed. Telegram API status: ${response.status}, response: ${text}`);
      }
    } else {
      console.log('[Startup Test] No active / enabled Telegram configuration profiles found in local cache. Once any user interacts or triggers an event, their settings will be cached locally to enable background startup tests.');
    }
  } catch (err) {
    console.error('[Startup Test] Error executing automated test notification:', err);
  }
}, 5000);
