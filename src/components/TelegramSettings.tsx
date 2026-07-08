import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { 
  Send, 
  Settings, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  HelpCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { motion } from 'motion/react';

export const TelegramSettings: React.FC = () => {
  const { telegramSettings, updateTelegramSettings, sendTelegramNotification, loading } = useCRM();

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);

  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load current settings when they are fetched from context
  useEffect(() => {
    if (telegramSettings) {
      setBotToken(telegramSettings.botToken || '');
      setChatId(telegramSettings.chatId || '');
      setEnabled(telegramSettings.enabled || false);
    }
  }, [telegramSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await updateTelegramSettings({
        botToken: botToken.trim(),
        chatId: chatId.trim(),
        enabled
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      alert("Please enter both Bot Token and Chat ID to send a test message.");
      return;
    }

    setIsTesting(true);
    setTestStatus('idle');

    try {
      // Formulate a clean test message
      const testMsg = `🔔 *AB Graphics CRM Bot Test*\n\nYour Telegram Bot settings have been saved successfully!\n\n🤖 *Bot Status:* Online & Connected\n📅 *Server Time:* ${new Date().toLocaleString()}\n🚀 *System:* Ready to push active lead & renewal notifications.`;
      
      // Temporary override to send even if not toggled "enabled" yet in Firestore
      const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: testMsg,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram error status ${response.status}`);
      }

      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setTestStatus('error');
      alert("Test message failed. Please verify that your Token is correct and that your bot has been started with /start in the selected Chat ID.");
    } finally {
      setIsTesting(false);
    }
  };

  if (loading.telegram) {
    return (
      <div className="flex items-center justify-center py-20 text-emerald-500 font-mono space-x-2">
        <span className="animate-spin text-xl">⏳</span>
        <span>Securing and loading Telegram credentials...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans text-white">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Telegram Integration Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Get instant, real-time push messages on your phone whenever leads, payments, or campaigns change status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Helper Instructions card */}
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4 md:col-span-1">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
            <Info className="h-4 w-4" /> Setup Instructions
          </h3>
          <div className="text-xs text-gray-400 space-y-3 leading-relaxed">
            <p>
              1. Search for <span className="text-white font-semibold">@BotFather</span> inside Telegram and send <span className="font-mono text-emerald-500">/newbot</span> to generate your bot token.
            </p>
            <p>
              2. Paste the generated token into the <span className="text-white font-semibold">Bot Token</span> secure input.
            </p>
            <p>
              3. Retrieve your personal or channel <span className="text-white font-semibold">Chat ID</span> (using bots like <span className="text-white">@userinfobot</span> or similar helpers).
            </p>
            <p>
              4. Make sure to click <span className="text-emerald-500 font-bold">/start</span> in the conversation with your bot so it has permission to send you messages.
            </p>
          </div>
        </div>

        {/* Configuration Panel Form */}
        <form onSubmit={handleSave} className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-6 space-y-5 md:col-span-2">
          
          <div className="flex items-center justify-between border-b border-emerald-900/10 pb-3">
            <h3 className="text-base font-bold flex items-center gap-2 text-white">
              <Settings className="h-4.5 w-4.5 text-emerald-500" /> API Credentials
            </h3>
            
            {/* Enabled toggle slider */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">{enabled ? 'Notifications Enabled' : 'Notifications Paused'}</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className="text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none cursor-pointer"
              >
                {enabled ? (
                  <ToggleRight className="h-8 w-8" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {/* Bot Token Secure Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400">Telegram Bot Token *</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                required
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="e.g., 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full pl-4 pr-11 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3.5 top-3 text-gray-500 hover:text-gray-300 focus:outline-none cursor-pointer"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Chat ID Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400">Chat ID / Channel Handle *</label>
            <input
              type="text"
              required
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g., 987654321 or @mychannel"
              className="w-full px-4 py-2.5 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono"
            />
          </div>

          {/* Alert Status Feedback */}
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Bot configuration stored securely in cloud ledger.</span>
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Failed to save. Check your Firestore access or authentication state.</span>
            </div>
          )}

          {testStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Test message dispatched! Please verify your Telegram client inbox.</span>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-emerald-900/10">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleSendTestMessage}
              className="px-4 py-2 bg-[#0d0d0d] hover:bg-[#1a1a1a] border border-emerald-900/10 hover:border-emerald-500/15 text-xs text-emerald-400 font-semibold rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="h-3.5 w-3.5" /> {isTesting ? 'Sending test...' : 'Send Test Notification'}
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-600 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              {isSaving ? 'Storing...' : 'Save Configuration'}
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};
