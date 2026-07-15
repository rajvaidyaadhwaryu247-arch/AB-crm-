import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
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

    // Client Address & Campaign Objectives & Strategy Directive helper extraction
    const getClientInfoSuffix = () => {
      const address = data?.address || data?.clientAddress || 'Not Provided';
      const notes = data?.notes || data?.clientNotes || data?.campaignObjectives || 'Not Provided';
      return `\n\n📍 *Client Address:* ${address}\n🎯 *Campaign Objectives & Strategy Directive:* ${notes}`;
    };

    if (eventType === 'client_created') {
      const name = data?.name || 'Not Provided';
      const business = data?.businessName || 'Not Provided';
      const mobile = data?.mobile || 'Not Provided';
      const email = data?.email || 'Not Provided';
      const address = data?.address || 'Not Provided';
      const website = data?.website || 'Not Provided';
      const mapsLink = data?.googleMapsLink || data?.googleMaps || 'Not Provided';

      const packageName = data?.packageDetails?.customName || data?.packageDetails?.type || 'Custom';
      const price = data?.packageDetails?.price ?? 0;
      const paidAmount = data?.revenue ?? 0;
      const pending = data?.pendingAmount ?? 0;

      const startDate = data?.startDate || 'Not Provided';
      const expiryDate = data?.expiryDate || 'Not Provided';
      const duration = data?.packageDuration || data?.packageDetails?.duration || 'Not Provided';

      const campaignObjectives = data?.notes || 'Not Provided';

      const services = data?.packageDetails?.services;
      const servicesStr = Array.isArray(services) && services.length > 0
        ? services.map(s => `• ${s}`).join('\n')
        : 'Not Provided';

      const internalNotes = data?.internalNotes || 'Not Provided';

      const createdAtStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      return `🆕 *NEW CLIENT ADDED*\n\n` +
        `👤 *Client Name:* ${name}\n` +
        `🏢 *Business Name:* ${business}\n` +
        `📱 *Mobile Number:* ${mobile}\n` +
        `📧 *Email:* ${email}\n` +
        `📍 *Full Address:* ${address}\n` +
        `🌐 *Website:* ${website}\n` +
        `📍 *Google Maps Link:* ${mapsLink}\n\n` +
        `📦 *Package Name:* ${packageName}\n` +
        `💰 *Package Price:* ₹${price}\n` +
        `💵 *Amount Paid:* ₹${paidAmount}\n` +
        `💳 *Pending Amount:* ₹${pending}\n\n` +
        `📅 *Start Date:* ${startDate}\n` +
        `📅 *Expiry Date:* ${expiryDate}\n` +
        `⏳ *Package Duration:* ${duration}\n\n` +
        `🎯 *Campaign Objectives:*\n${campaignObjectives}\n\n` +
        `📝 *Included Services:*\n${servicesStr}\n\n` +
        `📌 *Notes:*\n${internalNotes}\n\n` +
        `👨‍💼 *Created By:*\nAB Graphics CRM\n\n` +
        `🕒 *Created At:*\n${createdAtStr}`;
    }

    // Client Details (Client Push Button / Update)
    if (eventType === 'client_updated') {
      const name = data?.name || 'N/A';
      const business = data?.businessName || 'N/A';
      const mobile = data?.mobile || 'N/A';
      const packageName = data?.packageDetails?.customName || data?.packageDetails?.type || 'Custom';
      const price = data?.packageDetails?.price ?? 0;
      const pending = data?.pendingAmount ?? 0;
      const startDate = data?.startDate || 'N/A';
      const expiryDate = data?.expiryDate || 'N/A';

      return `👤 *Client Details*\n\n` +
        `• *Name:* ${name}\n` +
        `• *Business:* ${business}\n` +
        `• *Mobile:* ${mobile}\n` +
        `• *Package:* ${packageName}\n` +
        `• *Amount:* ₹${price}\n` +
        `• *Pending:* ₹${pending}\n` +
        `• *Start Date:* ${startDate}\n` +
        `• *Expiry Date:* ${expiryDate}` +
        getClientInfoSuffix();
    }

    // New Lead Created / Lead Push/Update Button
    if (eventType === 'lead_created' || eventType === 'lead_updated') {
      const header = eventType === 'lead_created' ? '🆕 *NEW LEAD RECEIVED*' : '📌 *LEAD UPDATE*';
      const name = data?.name || 'N/A';
      const business = data?.business || 'N/A';
      const mobile = data?.mobile || 'N/A';
      const address = data?.address || 'Not Provided';
      const score = data?.leadScore ?? 'N/A';
      const health = data?.health ? (data.health === 'Healthy' ? '🟢 Healthy' : data.health === 'Needs Attention' ? '🟡 Needs Attention' : '🔴 At Risk') : 'N/A';
      const mood = data?.mood ? `${data.mood}` : 'Neutral';
      const buyingIntent = data?.buyingIntent || 'N/A';
      const expectedRevenue = data?.expectedRevenue ? `₹${data.expectedRevenue}` : 'N/A';
      const status = data?.status || 'N/A';
      const notes = data?.notes || 'None';
      const updatedTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      return `${header}\n\n` +
        `👤 *Client:* ${name}\n` +
        `🏢 *Business:* ${business}\n` +
        `📞 *Phone:* ${mobile}\n` +
        `📍 *Address:* ${address}\n` +
        `📊 *Lead Score:* ${score}\n` +
        `🟢 *Health:* ${health}\n` +
        `😊 *Mood:* ${mood}\n` +
        `🔥 *Buying Intent:* ${buyingIntent}\n` +
        `💰 *Expected Revenue:* ${expectedRevenue}\n` +
        `📈 *Status:* ${status}\n` +
        `📝 *Notes:* ${notes}\n\n` +
        `🕒 *Updated Time:* ${updatedTime}`;
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
          `• *Assigned Client:* ${client}` +
          getClientInfoSuffix();
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
          `• *Status:* ${status}` +
          getClientInfoSuffix();
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
        `• *Remaining Balance:* ₹${remaining}` +
        getClientInfoSuffix();
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
        `• *Expiry Date:* ${expiryDate}` +
        getClientInfoSuffix();
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
        `• *Expiry Date:* ${expiryDate}` +
        getClientInfoSuffix();
    }

    if (eventType === 'followup_missed') {
      const client = data?.clientName || 'N/A';
      const mobile = data?.mobile || 'N/A';
      return `⚠️ *FOLLOW-UP MISSED*\n\n• *Client:* ${client}\n• *Mobile:* ${mobile}\n\nPlease contact immediately.` + getClientInfoSuffix();
    }

    if (eventType === 'followup_rescheduled') {
      const client = data?.clientName || 'N/A';
      const business = data?.businessName || 'N/A';
      const date = data?.followUpDate || 'N/A';
      const time = data?.followUpTime || 'N/A';
      const notes = data?.notes || 'N/A';
      return `🔄 *Schedule Rescheduled*\n\n• *Client:* ${client}\n• *Business:* ${business}\n• *Date:* ${date}\n• *Time:* ${time}\n• *Notes:* ${notes}` + getClientInfoSuffix();
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

  // Lazy-initialize GoogleGenAI to ensure we don't crash if GEMINI_API_KEY is missing
  const getGenAI = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // Helper for resilient Gemini API calls with retries and robust backoff
  const generateContentWithRetry = async (aiInstance: any, prompt: string, config: any) => {
    // List of models to try in order
    const modelsToTry = [
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-flash-latest'
    ];

    let lastError: any = null;

    for (const modelName of modelsToTry) {
      const maxAttemptsPerModel = 2;
      for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
        try {
          console.log(`[Gemini API] Attempting generation with model ${modelName} (Attempt ${attempt}/${maxAttemptsPerModel})`);
          const response = await aiInstance.models.generateContent({
            model: modelName,
            contents: prompt,
            config: config
          });

          if (response && response.text) {
            console.log(`[Gemini API] Successfully generated content using model: ${modelName}`);
            return response;
          }
          throw new Error('Empty response received from Gemini');
        } catch (error: any) {
          lastError = error;
          const errMsg = error.message || '';
          const errString = String(error);
          const errJSON = JSON.stringify(error);
          
          console.warn(`[Gemini API] Failed on model ${modelName} (Attempt ${attempt}/${maxAttemptsPerModel}):`, errMsg || errString);

          // Check if it's a 404 NOT_FOUND error (meaning model is not available/deprecated)
          const isNotFoundError = 
            errMsg.includes('404') || 
            errMsg.includes('NOT_FOUND') || 
            errMsg.includes('no longer available') ||
            errString.includes('404') || 
            errString.includes('NOT_FOUND') ||
            errString.includes('no longer available') ||
            errJSON.includes('404') || 
            errJSON.includes('NOT_FOUND') ||
            errJSON.includes('no longer available') ||
            error.status === 404 ||
            error.statusCode === 404 ||
            (error.error && error.error.code === 404);

          if (isNotFoundError) {
            console.log(`[Gemini API] Model ${modelName} reported 404/NOT_FOUND. Skipping further retries for this model.`);
            break; // Break the inner loop to try the next model immediately
          }

          // If we have more attempts for this model, delay with exponential backoff
          if (attempt < maxAttemptsPerModel) {
            const delayMs = attempt * 1500;
            console.log(`[Gemini API] Retrying model ${modelName} in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
      console.warn(`[Gemini API] Model ${modelName} failed or was skipped. Trying next fallback...`);
    }

    throw lastError || new Error('All Gemini models and retries failed.');
  };

  // Helper to safely extract and parse JSON from a response string
  const cleanAndParseJSON = (text: string) => {
    let cleaned = text.trim();
    
    // Remove markdown code block markers if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/i, '');
      cleaned = cleaned.replace(/\n?```$/, '');
      cleaned = cleaned.trim();
    }
    
    return JSON.parse(cleaned);
  };

  app.post('/api/gemini/generate-planner', async (req, res) => {
    try {
      const {
        businessType,
        packageName,
        goal,
        budget,
        targetAudience,
        campaignObjective,
        startDate,
        endDate,
        datesList,
        season
      } = req.body;

      if (!businessType || !startDate || !endDate || !datesList || !Array.isArray(datesList)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required campaign inputs (businessType, startDate, endDate, datesList).'
        });
      }

      console.log(`[Gemini API] Generating monthly strategy for ${businessType} with package ${packageName}, season ${season || 'Standard'}`);

      const aiInstance = getGenAI();
      const prompt = `You are an elite, results-driven Digital Marketing Director and Content Strategist. Your goal is to design a high-converting, fully customized monthly digital marketing campaign and operations plan for a client.

CLIENT PROFILE & DIRECTION:
- Business Type/Niche: ${businessType}
- Selected Service Package: ${packageName || 'Custom / Pro'}
- Campaign Main Goal: ${goal || 'Brand Awareness & Customer Acquisition'}
- Budget Bracket: ${budget || 'Standard / Flexible'}
- Target Customer Audience: ${targetAudience || 'General Demographics'}
- Key Campaign Objective: ${campaignObjective || 'Boost local walk-ins and direct inquiries'}
- Selected Season/Occasion: ${season || 'Normal Season'}
- Implementation Period: ${startDate} to ${endDate}

DATES FOR THE CALENDAR (Generate exactly one activity block for each date listed below):
${JSON.stringify(datesList)}

STRICT OPERATIONAL DIRECTIVES:
1. CUSTOMIZATION & UNIQUENESS: Never generate a generic plan. Every strategy and piece of copy must be hyper-specific to the client's business type "${businessType}" and the season/occasion "${season || 'Normal Season'}". Provide concrete post/reel concepts, copy hooks, and visual details.
2. REEL SCHEDULING GAP: You MUST maintain a minimum of 1-2 days of gap between any Reel/Short activities (Instagram Reel, Facebook Reel, YouTube Short). Do not schedule any Reel/Short activities on consecutive days or the same day.
3. INTELLIGENT DISTRIBUTION: Distribute Posts, Stories, and Ads intelligently. Instagram/Facebook Stories and WhatsApp Status can run daily, but main grid Posts and Ads checks should be scattered elegantly.
4. NO AI ASSIGNMENT: AI must NEVER assign team members to tasks. You are strictly forbidden from assigning team members. The 'assignedTo' field in the 'tasks' array MUST always be an empty string "" or null. The business owner manually assigns every task.
5. STRATEGY HIERARCHY: Generate a coherent strategic narrative following the flow: Monthly Strategy → Weekly Themes → Daily Calendar → Content Topics.

You MUST respond with valid JSON matching this structure (do not wrap in markdown blocks, just return raw JSON):
{
  "strategyTitle": "String - Compelling campaign theme",
  "highLevelStrategy": "String - High-level strategic reasoning, theme explanation, and visual tone",
  "keyMetrics": "String - 3 to 4 metrics to monitor",
  "weeklyThemes": [
    "Week 1 Theme: [Write a business-specific theme name and focus]",
    "Week 2 Theme: [Write a business-specific theme name and focus]",
    "Week 3 Theme: [Write a business-specific theme name and focus]",
    "Week 4 Theme: [Write a business-specific theme name and focus]"
  ],
  "days": [
    {
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "type": "Instagram Story" | "Facebook Story" | "WhatsApp Status" | "Instagram Reel" | "Instagram Post" | "Facebook Post" | "Meta Ads" | "Weekly Review" | "Custom Activity",
          "customTypeName": "String if type is Custom Activity, otherwise empty",
          "notes": "Provide precise creative brief, copy hooks, hashtags, and visual instructions for this activity."
        }
      ],
      "internalNotes": "String (optional) - brief internal coordination notes",
      "clientNotes": "String (optional) - notes visible to the client"
    }
  ],
  "tasks": [
    {
      "title": "String - Clear, descriptive task name",
      "dueDate": "YYYY-MM-DD",
      "type": "Shoot" | "Editing" | "Poster" | "Ads" | "Website" | "Printing",
      "assignedTo": "",
      "priority": "Low" | "Medium" | "High",
      "notes": "Actionable creative brief or execution checklist."
    }
  ]
}`;

      const response = await generateContentWithRetry(aiInstance, prompt, {
        responseMimeType: 'application/json'
      });

      const responseText = response.text;
      console.log(`[Gemini API] Strategy generated successfully!`);
      
      const parsedData = cleanAndParseJSON(responseText);
      return res.json({
        success: true,
        data: parsedData
      });

    } catch (error: any) {
      console.error('[Gemini API] Content Planner generation failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
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

