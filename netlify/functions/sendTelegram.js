const formatTelegramMessage = (eventType, data, messageText) => {
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
