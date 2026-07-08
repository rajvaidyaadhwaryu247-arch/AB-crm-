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

