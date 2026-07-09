const formatTelegramMessage = (eventType, data, messageText) => {
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
};

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  try {
    const { eventType, messageText, data } = JSON.parse(event.body || '{}');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Telegram environment variables TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not configured on Netlify.'
        })
      };
    }

    const formattedMessage = formatTelegramMessage(eventType, data, messageText);

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: formattedMessage,
        parse_mode: 'Markdown'
      })
    });

    const resData = await response.json();

    if (!response.ok || !resData.ok) {
      return {
        statusCode: response.status || 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: resData.description || 'Failed to send Telegram message.'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal Server Error'
      })
    };
  }
};
