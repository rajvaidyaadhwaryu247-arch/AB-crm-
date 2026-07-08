import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Sparkles, 
  Menu, 
  X, 
  LogOut, 
  User as UserIcon,
  Sparkle,
  ClipboardList,
  BarChart3,
  Send
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut, User } from 'firebase/auth';

interface CRMLayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'clients' | 'leads' | 'tasks' | 'reports' | 'telegram';
  setActiveTab: (tab: 'dashboard' | 'clients' | 'leads' | 'tasks' | 'reports' | 'telegram') => void;
  user: User;
}

export const CRMLayout: React.FC<CRMLayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  user 
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', value: 'dashboard' as const, icon: LayoutDashboard },
    { name: 'Client Management', value: 'clients' as const, icon: Users },
    { name: 'Lead Management', value: 'leads' as const, icon: Sparkles },
    { name: 'Task Management', value: 'tasks' as const, icon: ClipboardList },
    { name: 'Reports', value: 'reports' as const, icon: BarChart3 },
    { name: 'Telegram Settings', value: 'telegram' as const, icon: Send },
  ];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await signOut(auth);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909] text-gray-100 flex font-sans">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#0d0d0d] border-r border-emerald-900/30 z-30">
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-emerald-900/20">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black text-sm shrink-0">AB</div>
          <span className="text-lg font-bold tracking-tight text-emerald-400">Graphics CRM</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer border ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-md' 
                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-emerald-500/5'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer User Profile */}
        <div className="p-4 border-t border-emerald-900/20 bg-[#0d0d0d]">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="h-9 w-9 rounded-full bg-gray-800 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold uppercase shrink-0">
              {user.displayName ? user.displayName.charAt(0) : <UserIcon className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-200 truncate">
                {user.displayName || 'CRM Admin'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user.email}
              </p>
            </div>
            <button 
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Backing & Slider */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 w-64 bg-[#0d0d0d] border-r border-emerald-900/30 z-50 transform md:hidden transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-emerald-900/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-black text-sm shrink-0">AB</div>
            <span className="text-lg font-bold tracking-tight text-emerald-400">Graphics CRM</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.value);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer border ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-md' 
                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-emerald-500/5'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-900/20 absolute bottom-0 w-full bg-[#0d0d0d]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gray-800 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold uppercase shrink-0">
              {user.displayName ? user.displayName.charAt(0) : <UserIcon className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-200 truncate">
                {user.displayName || 'CRM Admin'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user.email}
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        
        {/* Top Header/Navigation */}
        <header className="h-16 border-b border-emerald-900/20 bg-[#090909]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-emerald-500/10 md:hidden cursor-pointer"
            >
              <Menu className="h-5.5 w-5.5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-white capitalize tracking-tight">
              {navigation.find(item => item.value === activeTab)?.name}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick stats indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Agency Operations Active</span>
            </div>
            <div className="text-xs font-mono text-emerald-400/80">
              UTC: {new Date().toISOString().substring(11, 16)}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
