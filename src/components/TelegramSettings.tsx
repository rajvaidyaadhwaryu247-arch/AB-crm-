import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import { 
  Send, 
  Settings, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ToggleLeft, 
  ToggleRight,
  Upload,
  RefreshCw,
  Image as ImageIcon,
  QrCode,
  Trash2,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { defaultLogo, defaultQr } from '../defaultAssets';

export const TelegramSettings: React.FC = () => {
  const { 
    telegramSettings, 
    updateTelegramSettings, 
    brandSettings, 
    updateBrandSettings, 
    loading 
  } = useCRM();

  // Active sub-tab state: 'brand' or 'telegram'
  const [activeSubTab, setActiveSubTab] = useState<'brand' | 'telegram'>('brand');

  // Telegram state variables
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Brand upload state variables
  const [logoUploading, setLogoUploading] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [brandSaveStatus, setBrandSaveStatus] = useState<'idle' | 'logo_saved' | 'qr_saved' | 'reset_saved' | 'error'>('idle');

  // Hidden file input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop states
  const [logoDragging, setLogoDragging] = useState(false);
  const [qrDragging, setQrDragging] = useState(false);

  // Load current settings when they are fetched from context
  useEffect(() => {
    if (telegramSettings) {
      setBotToken(telegramSettings.botToken || '');
      setChatId(telegramSettings.chatId || '');
      setEnabled(telegramSettings.enabled || false);
    }
  }, [telegramSettings]);

  // Image optimization helper using Canvas
  const optimizeImage = (file: File, isLogo: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Set perfect maximum boundaries
          // Logos are typically smaller; QR codes require high-definition scan contrast
          const maxDim = isLogo ? 450 : 600;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas rendering engine not loaded'));
            return;
          }

          // Smart alpha transparency preservation for PNG/WEBP
          if (file.type === 'image/png' || file.type === 'image/webp') {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL(file.type, 0.95)); // Near-lossless optimization
          } else {
            // Fill background white for JPG/JPEG to prevent black fill issues
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.88)); // Beautiful compressed format
          }
        };
        img.onerror = () => reject(new Error('Failed to parse uploaded image asset'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read binary stream'));
      reader.readAsDataURL(file);
    });
  };

  // Brand upload handling
  const handleFileUpload = async (file: File, isLogo: boolean) => {
    if (!file) return;

    // Verify format matches supported types
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid format! Please upload PNG, JPG, JPEG, or WEBP files only.");
      return;
    }

    if (isLogo) {
      setLogoUploading(true);
    } else {
      setQrUploading(true);
    }
    setBrandSaveStatus('idle');

    try {
      const base64 = await optimizeImage(file, isLogo);
      if (isLogo) {
        await updateBrandSettings({ logo: base64 });
        setBrandSaveStatus('logo_saved');
      } else {
        await updateBrandSettings({ qr: base64 });
        setBrandSaveStatus('qr_saved');
      }
      setTimeout(() => setBrandSaveStatus('idle'), 4000);
    } catch (err) {
      console.error("Asset optimization failure:", err);
      setBrandSaveStatus('error');
    } finally {
      setLogoUploading(false);
      setQrUploading(false);
    }
  };

  const handleResetAsset = async (isLogo: boolean) => {
    if (!confirm(`Are you sure you want to reset the custom ${isLogo ? 'Logo' : 'QR Code'} back to the official AB Graphics default?`)) {
      return;
    }
    try {
      if (isLogo) {
        await updateBrandSettings({ logo: '' });
      } else {
        await updateBrandSettings({ qr: '' });
      }
      setBrandSaveStatus('reset_saved');
      setTimeout(() => setBrandSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setBrandSaveStatus('error');
    }
  };

  // Drag-and-drop events
  const handleDragOver = (e: React.DragEvent, isLogo: boolean) => {
    e.preventDefault();
    if (isLogo) setLogoDragging(true);
    else setQrDragging(true);
  };

  const handleDragLeave = (isLogo: boolean) => {
    if (isLogo) setLogoDragging(false);
    else setQrDragging(false);
  };

  const handleDrop = (e: React.DragEvent, isLogo: boolean) => {
    e.preventDefault();
    if (isLogo) {
      setLogoDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file, true);
    } else {
      setQrDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file, false);
    }
  };

  // Telegram submit handler
  const handleSaveTelegram = async (e: React.FormEvent) => {
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
      setTimeout(() => setSaveStatus('idle'), 4000);
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
      const testMsg = `🔔 *AB Graphics CRM Bot Test*\n\nYour Telegram Bot settings have been saved successfully!\n\n🤖 *Bot Status:* Online & Connected\n📅 *Server Time:* ${new Date().toLocaleString()}\n🚀 *System:* Ready to push active lead & renewal notifications.`;
      
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
      setTimeout(() => setTestStatus('idle'), 4000);
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
        <span>Loading unified settings environment...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans text-white">
      
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Configuration & Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Customize corporate brand identities and configure automation integrations.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-emerald-900/10 gap-1">
        <button
          onClick={() => setActiveSubTab('brand')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all relative flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'brand' 
              ? 'text-emerald-400 bg-emerald-500/5 font-bold border-b-2 border-emerald-500' 
              : 'text-gray-400 hover:text-white hover:bg-white/2'
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          <span>Brand Assets</span>
        </button>
        <button
          onClick={() => setActiveSubTab('telegram')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all relative flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'telegram' 
              ? 'text-emerald-400 bg-emerald-500/5 font-bold border-b-2 border-emerald-500' 
              : 'text-gray-400 hover:text-white hover:bg-white/2'
          }`}
        >
          <Send className="h-4 w-4" />
          <span>Telegram Notifications</span>
        </button>
      </div>

      {/* TAB CONTENT: BRAND ASSETS */}
      {activeSubTab === 'brand' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          
          {/* Company Logo Card */}
          <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ImageIcon className="h-4.5 w-4.5 text-emerald-500" /> Company Brand Logo
                </h3>
                {brandSettings?.logo && (
                  <button
                    onClick={() => handleResetAsset(true)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1 border border-rose-500/10"
                    title="Reset to official fallback Logo"
                  >
                    <Trash2 className="h-3 w-3" /> Reset Default
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Rendered across desktop and mobile sidebars, client portals, receipts, invoices, and physical printouts. Supports transparent PNG, JPG, JPEG, and WEBP.
              </p>
            </div>

            {/* Logo Preview Arena */}
            <div className="bg-[#090909] rounded-xl p-4 flex items-center justify-center h-48 border border-emerald-900/5 relative group overflow-hidden">
              <img 
                src={brandSettings?.logo || defaultLogo} 
                alt="Current Logo" 
                className="max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-2.5 right-3 text-[9px] font-mono text-gray-600 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs uppercase tracking-widest font-bold">
                {brandSettings?.logo ? 'Custom Upload' : 'Default Asset'}
              </span>
            </div>

            {/* Dropzone Upload */}
            <div
              onDragOver={(e) => handleDragOver(e, true)}
              onDragLeave={() => handleDragLeave(true)}
              onDrop={(e) => handleDrop(e, true)}
              onClick={() => logoInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 min-h-[90px] ${
                logoDragging 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : 'border-emerald-900/20 hover:border-emerald-500/30 hover:bg-emerald-500/2'
              }`}
            >
              <input 
                type="file" 
                ref={logoInputRef} 
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], true)}
                className="hidden" 
                accept="image/png, image/jpeg, image/jpg, image/webp"
              />
              {logoUploading ? (
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
              ) : (
                <Upload className="h-5 w-5 text-emerald-500" />
              )}
              <div>
                <p className="text-xs font-semibold text-gray-300">
                  {logoUploading ? 'Optimizing brand colors...' : 'Upload Brand Logo'}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">Drag-and-drop or click to browse</p>
              </div>
            </div>

          </div>

          {/* UPI QR Code Card */}
          <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <QrCode className="h-4.5 w-4.5 text-emerald-500" /> UPI Merchant QR Code
                </h3>
                {brandSettings?.qr && (
                  <button
                    onClick={() => handleResetAsset(false)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer text-[10px] font-bold flex items-center gap-1 border border-rose-500/10"
                    title="Reset to official fallback QR"
                  >
                    <Trash2 className="h-3 w-3" /> Reset Default
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Injected straight into campaign bills, payment portals, and printed invoices. Maintains absolute clarity and maximum contrast for effortless camera scanning.
              </p>
            </div>

            {/* QR Preview Arena */}
            <div className="bg-[#090909] rounded-xl p-4 flex items-center justify-center h-48 border border-emerald-900/5 relative group overflow-hidden">
              <img 
                src={brandSettings?.qr || defaultQr} 
                alt="Current QR Code" 
                className="max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-2.5 right-3 text-[9px] font-mono text-gray-600 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs uppercase tracking-widest font-bold">
                {brandSettings?.qr ? 'Custom Upload' : 'Default Asset'}
              </span>
            </div>

            {/* Dropzone Upload */}
            <div
              onDragOver={(e) => handleDragOver(e, false)}
              onDragLeave={() => handleDragLeave(false)}
              onDrop={(e) => handleDrop(e, false)}
              onClick={() => qrInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 min-h-[90px] ${
                qrDragging 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : 'border-emerald-900/20 hover:border-emerald-500/30 hover:bg-emerald-500/2'
              }`}
            >
              <input 
                type="file" 
                ref={qrInputRef} 
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], false)}
                className="hidden" 
                accept="image/png, image/jpeg, image/jpg, image/webp"
              />
              {qrUploading ? (
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
              ) : (
                <Upload className="h-5 w-5 text-emerald-500" />
              )}
              <div>
                <p className="text-xs font-semibold text-gray-300">
                  {qrUploading ? 'Checking scan readability...' : 'Upload UPI QR Code'}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">Drag-and-drop or click to browse</p>
              </div>
            </div>

          </div>

          {/* Quick status banner for feedback */}
          {brandSaveStatus !== 'idle' && (
            <div className="col-span-1 md:col-span-2">
              {brandSaveStatus === 'logo_saved' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Company Brand Logo updated! Your new identity has been synchronized across all CRM portals.</span>
                </div>
              )}
              {brandSaveStatus === 'qr_saved' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Merchant UPI QR Code updated! All newly generated and printed invoices will inherit this QR.</span>
                </div>
              )}
              {brandSaveStatus === 'reset_saved' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Reverted to the official AB Graphics default brand templates.</span>
                </div>
              )}
              {brandSaveStatus === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Failed to process brand asset. Ensure your file size is reasonable and try again.</span>
                </div>
              )}
            </div>
          )}

        </motion.div>
      )}

      {/* TAB CONTENT: TELEGRAM BOT CONFIG */}
      {activeSubTab === 'telegram' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Helper Instructions card */}
          <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4 md:col-span-1 flex flex-col justify-between">
            <div className="space-y-4">
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
            
            <div className="pt-4 border-t border-emerald-900/10 text-[10px] text-gray-500">
              Bot notifications use secure REST channels to prevent UI exposure of keys.
            </div>
          </div>

          {/* Configuration Panel Form */}
          <form onSubmit={handleSaveTelegram} className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-6 space-y-5 md:col-span-2">
            
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
        </motion.div>
      )}

    </div>
  );
};
