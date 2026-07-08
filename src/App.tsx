import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { CRMProvider } from './context/CRMContext';
import { CRMLayout } from './components/CRMLayout';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { ClientManagement } from './components/ClientManagement';
import { LeadManagement } from './components/LeadManagement';
import { TaskManagement } from './components/TaskManagement';
import { Reports } from './components/Reports';
import { TelegramSettings } from './components/TelegramSettings';
import { Sparkle, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authResolving, setAuthResolving] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'leads' | 'tasks' | 'reports' | 'telegram'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthResolving(false);
    });
    return unsubscribe;
  }, []);

  // Show premium loading screen during initial authentication resolve
  if (authResolving) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center animate-pulse">
            <Sparkle className="h-5 w-5 text-slate-950" />
          </div>
          <span className="text-2xl font-extrabold text-white tracking-tight">
            AB Graphics <span className="text-emerald-500">CRM</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Synchronizing security credentials...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, present the beautiful dark Auth gate
  if (!user) {
    return <Auth />;
  }

  // Authenticated layout with active CRM Provider context state
  return (
    <CRMProvider>
      <CRMLayout activeTab={activeTab} setActiveTab={setActiveTab} user={user}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'clients' && <ClientManagement />}
        {activeTab === 'leads' && <LeadManagement />}
        {activeTab === 'tasks' && <TaskManagement />}
        {activeTab === 'reports' && <Reports />}
        {activeTab === 'telegram' && <TelegramSettings />}
      </CRMLayout>
    </CRMProvider>
  );
}

