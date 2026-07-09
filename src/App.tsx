import { useState } from 'react';
import { CRMProvider } from './context/CRMContext';
import { CRMLayout } from './components/CRMLayout';
import { Dashboard } from './components/Dashboard';
import { ClientManagement } from './components/ClientManagement';
import { LeadManagement } from './components/LeadManagement';
import { TaskManagement } from './components/TaskManagement';
import { Reports } from './components/Reports';
import { TelegramSettings } from './components/TelegramSettings';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'leads' | 'tasks' | 'reports' | 'telegram'>('dashboard');

  const mockUser = {
    uid: 'default_user',
    email: 'admin@abgraphics.com',
    displayName: 'AB Graphics Admin',
  };

  return (
    <CRMProvider>
      <CRMLayout activeTab={activeTab} setActiveTab={setActiveTab} user={mockUser}>
        <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}><Dashboard /></div>
        <div className={activeTab === 'clients' ? 'block' : 'hidden'}><ClientManagement /></div>
        <div className={activeTab === 'leads' ? 'block' : 'hidden'}><LeadManagement /></div>
        <div className={activeTab === 'tasks' ? 'block' : 'hidden'}><TaskManagement /></div>
        <div className={activeTab === 'reports' ? 'block' : 'hidden'}><Reports /></div>
        <div className={activeTab === 'telegram' ? 'block' : 'hidden'}><TelegramSettings /></div>
      </CRMLayout>
    </CRMProvider>
  );
}

