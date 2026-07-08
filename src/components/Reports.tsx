import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { formatCurrency, formatDate } from '../utils';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  AlertCircle, 
  Calendar, 
  Building, 
  ArrowUpRight, 
  MessageSquare, 
  Phone,
  Briefcase,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap,
  Award,
  Crown
} from 'lucide-react';
import { motion } from 'motion/react';

export const Reports: React.FC = () => {
  const { clients } = useCRM();
  
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthYear = todayStr.substring(0, 7); // YYYY-MM
  
  // 1. Calculate Daily Revenue
  // Extract all payments received today
  let dailyRevenue = 0;
  clients.forEach(c => {
    (c.payments || []).forEach(p => {
      if (p.date === todayStr) {
        dailyRevenue += p.amount;
      }
    });
  });

  // 2. Calculate Monthly Revenue
  // Extract all payments received this month
  let monthlyRevenue = 0;
  clients.forEach(c => {
    (c.payments || []).forEach(p => {
      if (p.date && p.date.startsWith(currentMonthYear)) {
        monthlyRevenue += p.amount;
      }
    });
  });

  // 3. Calculate Pending Payments
  const totalPendingPayments = clients.reduce((sum, c) => sum + (c.pendingAmount || 0), 0);
  const clientsWithPending = clients.filter(c => (c.pendingAmount || 0) > 0);

  // 4. Active & Expired Packages metrics
  const activeClients = clients.filter(c => c.status === 'Active');
  const expiredClients = clients.filter(c => c.status === 'Expired');

  const getPackageBreakdown = (clientList: typeof clients) => {
    const breakdown = { Basic: 0, Advance: 0, Pro: 0, Custom: 0 };
    clientList.forEach(c => {
      const type = c.packageDetails?.type || 'Custom';
      if (type === 'Basic') breakdown.Basic++;
      else if (type === 'Advance') breakdown.Advance++;
      else if (type === 'Pro') breakdown.Pro++;
      else breakdown.Custom++;
    });
    return breakdown;
  };

  const activeBreakdown = getPackageBreakdown(activeClients);
  const expiredBreakdown = getPackageBreakdown(expiredClients);

  // 5. Client Wise Revenue Summary
  const [clientSearch, setClientSearch] = useState('');
  const filteredClientRevenue = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.businessName.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans text-white">
      
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Revenue & Campaigns Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Deep visual auditing of graphics campaign ledger accounts, active subscriptions, and cashflows.</p>
      </div>

      {/* Financial Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: dailyRevenue, desc: "Direct payment captures today", icon: Zap, color: "text-amber-400 border-amber-900/15 bg-amber-500/5" },
          { label: "This Month's Revenue", value: monthlyRevenue, desc: "Sum of this month's payments", icon: TrendingUp, color: "text-emerald-400 border-emerald-900/15 bg-emerald-500/5" },
          { label: "Total Outstanding Balance", value: totalPendingPayments, desc: "Pending balances across clients", icon: AlertCircle, color: "text-rose-400 border-rose-900/15 bg-rose-500/5" },
          { label: "Lifetime Logged Cash", value: clients.reduce((sum, c) => sum + (c.revenue || 0), 0), desc: "All-time accumulated revenue", icon: ShieldCheck, color: "text-sky-400 border-sky-900/15 bg-sky-500/5" }
        ].map((metric, i) => (
          <div key={i} className={`bg-[#141414] border ${metric.color.split(' ')[1]} rounded-2xl p-5 flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{metric.label}</span>
              <metric.icon className={`h-5 w-5 ${metric.color.split(' ')[0]}`} />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold font-mono tracking-tight">{formatCurrency(metric.value)}</h3>
              <p className="text-[11px] text-gray-400 mt-1.5">{metric.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active vs Expired Packages split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Active Packages breakdown */}
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-900/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-400" /> Active Subscriptions ({activeClients.length})
            </h3>
            <span className="text-xs text-gray-500 font-mono">Running Campaigns</span>
          </div>

          <div className="space-y-3.5">
            {[
              { type: 'Basic', count: activeBreakdown.Basic, icon: Award, color: 'bg-emerald-500', total: activeClients.length },
              { type: 'Advance', count: activeBreakdown.Advance, icon: Crown, color: 'bg-indigo-500', total: activeClients.length },
              { type: 'Pro', count: activeBreakdown.Pro, icon: Crown, color: 'bg-purple-500', total: activeClients.length },
              { type: 'Custom', count: activeBreakdown.Custom, icon: Layers, color: 'bg-gray-400', total: activeClients.length }
            ].map((item, i) => {
              const pct = item.total > 0 ? (item.count / item.total) * 100 : 0;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <item.icon className="h-3.5 w-3.5 text-gray-500" /> {item.type} Package
                    </span>
                    <span>{item.count} Active</span>
                  </div>
                  <div className="w-full bg-[#0d0d0d] h-2 rounded-full overflow-hidden">
                    <div className={`${item.color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expired Packages breakdown */}
        <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-900/10 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" /> Expired Subscriptions ({expiredClients.length})
            </h3>
            <span className="text-xs text-gray-500 font-mono">Renewal Pipeline</span>
          </div>

          <div className="space-y-3.5">
            {[
              { type: 'Basic', count: expiredBreakdown.Basic, icon: Award, color: 'bg-emerald-500/50', total: expiredClients.length },
              { type: 'Advance', count: expiredBreakdown.Advance, icon: Crown, color: 'bg-indigo-500/50', total: expiredClients.length },
              { type: 'Pro', count: expiredBreakdown.Pro, icon: Crown, color: 'bg-purple-500/50', total: expiredClients.length },
              { type: 'Custom', count: expiredBreakdown.Custom, icon: Layers, color: 'bg-gray-400/50', total: expiredClients.length }
            ].map((item, i) => {
              const pct = item.total > 0 ? (item.count / item.total) * 100 : 0;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <item.icon className="h-3.5 w-3.5 text-gray-500" /> {item.type} Package
                    </span>
                    <span className="text-rose-400">{item.count} Expired</span>
                  </div>
                  <div className="w-full bg-[#0d0d0d] h-2 rounded-full overflow-hidden">
                    <div className={`${item.color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Pending Balances & Debt collection */}
      <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4">
        <div className="border-b border-emerald-900/10 pb-3">
          <h3 className="text-base font-bold text-white">Pending Receivables</h3>
          <p className="text-xs text-gray-500 mt-1">Contact accounts to collect pending graphical project balances.</p>
        </div>

        {clientsWithPending.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-500">
            🎉 Awesome! All customer accounts are fully paid with zero outstanding balances.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientsWithPending.map((c) => {
              const ratio = Math.round(((c.revenue || 0) / ((c.packageDetails?.price || (c.revenue + c.pendingAmount)) || 1)) * 100);
              return (
                <div key={c.id} className="bg-[#0d0d0d] border border-emerald-900/5 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{c.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{c.businessName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-rose-400 font-bold font-mono">₹{c.pendingAmount}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Outstanding</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Received Ledger: ₹{c.revenue || 0}</span>
                      <span>{ratio}% Collected</span>
                    </div>
                    <div className="w-full bg-[#141414] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>

                  {/* Actions to reach client */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-900/10">
                    <a
                      href={`https://wa.me/${c.whatsApp.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(c.name)},%20this%20is%20regarding%20the%20pending%20payment%20of%20₹${c.pendingAmount}%20for%20your%20campaign.%20Please%20process%20at%20your%20earliest.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Ping WA
                    </a>
                    <a
                      href={`tel:${c.mobile}`}
                      className="px-3 py-1.5 bg-slate-900 border border-emerald-900/10 text-gray-300 hover:text-white font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call Mobile
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client-Wise Revenue Detail Directory */}
      <div className="bg-[#141414] border border-emerald-900/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-900/10 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Client Ledger Directory</h3>
            <p className="text-xs text-gray-500 mt-1">Audit billing, package subscriptions, and outstanding ledgers for all campaigns.</p>
          </div>
          <div>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Filter by business or client..."
              className="px-4 py-2 bg-[#0d0d0d] border border-emerald-900/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#0d0d0d] text-gray-400 font-semibold border-b border-emerald-900/10">
                <th className="px-4 py-3">Client details</th>
                <th className="px-4 py-3">Business name</th>
                <th className="px-4 py-3">Package value</th>
                <th className="px-4 py-3">Total paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/5">
              {filteredClientRevenue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">
                    No clients found matching directory search.
                  </td>
                </tr>
              ) : (
                filteredClientRevenue.map((c) => {
                  const packagePriceVal = c.packageDetails?.price || (c.revenue + c.pendingAmount) || 0;
                  return (
                    <tr key={c.id} className="hover:bg-emerald-500/5 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white">{c.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{c.mobile}</div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-emerald-500/45 shrink-0" />
                          <span className="truncate max-w-[150px]">{c.businessName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-medium">{formatCurrency(packagePriceVal)}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">{formatCurrency(c.revenue || 0)}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-right text-rose-400">
                        {c.pendingAmount > 0 ? formatCurrency(c.pendingAmount) : <span className="text-emerald-500 font-bold">Paid</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
