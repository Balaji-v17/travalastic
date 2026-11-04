import { useState } from 'react';
import { corporateAccounts } from '../../data/mockData';

const account = corporateAccounts[2]; // TCS

const travelerList = [
  { name: 'Rajesh Kumar', dept: 'Engineering', destination: 'London', dates: 'Mar 18–24', status: 'in-travel', spend: 245000 },
  { name: 'Meena Rajan', dept: 'Sales', destination: 'Singapore', dates: 'Mar 20–22', status: 'booked', spend: 128000 },
  { name: 'Suresh Babu', dept: 'Finance', destination: 'Dubai', dates: 'Mar 25–28', status: 'pending-approval', spend: 95000 },
  { name: 'Divya Nair', dept: 'HR', destination: 'Mumbai (Internal)', dates: 'Mar 19', status: 'completed', spend: 8500 },
  { name: 'Arjun Pillai', dept: 'Engineering', destination: 'Tokyo', dates: 'Apr 2–10', status: 'pending-approval', spend: 320000 },
];

const approvals = [
  { traveler: 'Suresh Babu', destination: 'Dubai', dates: 'Mar 25–28', amount: 95000, policy: 'Within policy', urgency: 'normal' },
  { traveler: 'Arjun Pillai', destination: 'Tokyo', dates: 'Apr 2–10', amount: 320000, policy: 'Above ₹3L limit — requires CFO approval', urgency: 'high' },
  { traveler: 'Kavitha Suresh', destination: 'New York', dates: 'Apr 8–15', amount: 480000, policy: 'International premium — requires MD approval', urgency: 'high' },
];

const tabs = ['Dashboard', 'Travelers', 'Approvals', 'Policies', 'Reports'] as const;
type Tab = typeof tabs[number];

export default function CorporateDashboard() {
  const [tab, setTab] = useState<Tab>('Dashboard');

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold text-sm">TCS</div>
            <div>
              <h1 className="font-display text-2xl text-slate-900">{account.name}</h1>
              <p className="text-slate-500 text-sm">{account.industry} · Corporate Travel Management</p>
            </div>
          </div>
        </div>
        <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors">
          + Book Travel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t}
            {t === 'Approvals' && account.pendingApprovals > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">{account.pendingApprovals}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Active Travelers', value: account.activeTravelers, icon: '👤', color: 'text-blue-700' },
              { label: 'Upcoming Trips', value: account.upcomingTrips, icon: '✈️', color: 'text-violet-700' },
              { label: 'Pending Approvals', value: account.pendingApprovals, icon: '⏳', color: 'text-amber-700' },
              { label: 'MTD Spend', value: `₹${(account.monthlySpend / 100000).toFixed(1)}L`, icon: '💰', color: 'text-emerald-700' },
              { label: 'Policy Compliance', value: `${account.policyCompliance}%`, icon: '✅', color: 'text-emerald-700' },
              { label: 'Annual Budget', value: `₹${(account.annualBudget / 10000000).toFixed(0)}Cr`, icon: '📊', color: 'text-slate-700' },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xl mb-1">{m.icon}</div>
                <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Budget tracker */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Annual Budget Utilisation</h3>
              <span className="text-sm font-bold text-slate-700">{Math.round((account.monthlySpend * 3 / account.annualBudget) * 100)}% used</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all"
                style={{ width: `${Math.round((account.monthlySpend * 3 / account.annualBudget) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>₹{(account.monthlySpend * 3 / 100000).toFixed(1)}L spent (Q1)</span>
              <span>₹{(account.annualBudget / 10000000).toFixed(0)}Cr annual budget</span>
            </div>
          </div>

          {/* Pending approvals alert */}
          {account.pendingApprovals > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-amber-900">{account.pendingApprovals} Trip Approvals Pending</h3>
                  <p className="text-amber-700 text-sm mt-0.5">Review and approve employee travel requests</p>
                </div>
                <button onClick={() => setTab('Approvals')} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0">
                  Review Now
                </button>
              </div>
            </div>
          )}

          {/* Spend by department */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Spend by Department (MTD)</h3>
            <div className="space-y-3">
              {[
                { dept: 'Engineering', spend: 3200000, percent: 36 },
                { dept: 'Sales', spend: 2800000, percent: 31 },
                { dept: 'Operations', spend: 1600000, percent: 18 },
                { dept: 'Finance', spend: 800000, percent: 9 },
                { dept: 'HR & Admin', spend: 500000, percent: 6 },
              ].map((d) => (
                <div key={d.dept} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 w-24 flex-shrink-0">{d.dept}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.percent}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-20 text-right flex-shrink-0">₹{(d.spend / 100000).toFixed(1)}L</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'Travelers' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Active Travelers</h3>
            <input placeholder="Search travelers..." className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-400 w-48" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {['Traveler', 'Department', 'Destination', 'Dates', 'Status', 'Spend', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {travelerList.map((t) => (
                  <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                          {t.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium text-slate-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.dept}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{t.destination}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{t.dates}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === 'in-travel' ? 'bg-emerald-50 text-emerald-700' :
                        t.status === 'booked' ? 'bg-blue-50 text-blue-700' :
                        t.status === 'pending-approval' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {t.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">₹{t.spend.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Approvals' && (
        <div className="space-y-4">
          {approvals.map((a, i) => (
            <div key={i} className={`bg-white border rounded-2xl p-5 ${a.urgency === 'high' ? 'border-amber-200' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    {a.urgency === 'high' && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">Escalation Required</span>}
                  </div>
                  <h3 className="font-semibold text-slate-900">{a.traveler} — {a.destination}</h3>
                  <p className="text-slate-500 text-sm mt-0.5">{a.dates} · ₹{a.amount.toLocaleString()}</p>
                  <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs font-medium text-slate-600">Policy: {a.policy}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  ✓ Approve
                </button>
                <button className="flex-1 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors">
                  ✗ Decline
                </button>
                <button className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'Policies' && (
        <div className="space-y-4">
          {[
            { name: 'Flight Class Policy', rule: 'Economy only for domestic. Business class permitted for international > 8 hours.', status: 'active' },
            { name: 'Hotel Spend Limit', rule: 'Max ₹8,000/night domestic. Max ₹20,000/night international.', status: 'active' },
            { name: 'International Approval', rule: 'All international travel > ₹3L requires CFO approval.', status: 'active' },
            { name: 'Advance Booking', rule: 'Flights must be booked minimum 7 days in advance. Exceptions require manager approval.', status: 'active' },
          ].map((p) => (
            <div key={p.name} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">{p.status}</span>
                </div>
                <p className="text-slate-600 text-sm">{p.rule}</p>
              </div>
              <button className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex-shrink-0">Edit</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'Reports' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'Monthly Expense Report', period: 'March 2025', size: '284 KB', type: 'PDF' },
            { name: 'Q1 Travel Summary', period: 'Jan–Mar 2025', size: '1.2 MB', type: 'Excel' },
            { name: 'Policy Compliance Report', period: 'March 2025', size: '156 KB', type: 'PDF' },
            { name: 'Vendor Analysis', period: 'Q1 2025', size: '842 KB', type: 'Excel' },
          ].map((r) => (
            <div key={r.name} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${r.type === 'PDF' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {r.type}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.period} · {r.size}</p>
                </div>
              </div>
              <button className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50">Download</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
