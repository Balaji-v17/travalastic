import { useState } from 'react';
import { suppliers, bookings } from '../../data/mockData';

const partner = suppliers[1]; // Park Hyatt Tokyo

const metrics = [
  { label: 'Active Bookings', value: '142', change: '+12', up: true, icon: '📋' },
  { label: 'Revenue (MTD)', value: '₹2.24 Cr', change: '+8.4%', up: true, icon: '💰' },
  { label: 'Occupancy Rate', value: '87%', change: '+3%', up: true, icon: '🏨' },
  { label: 'Avg. Rating', value: '4.8★', change: '+0.1', up: true, icon: '⭐' },
  { label: 'Pending Payouts', value: '₹18.2 L', change: '-', up: false, icon: '💳' },
  { label: 'Fulfillment Rate', value: '99.1%', change: '+0.2%', up: true, icon: '✅' },
];

const inventoryItems = [
  { room: 'Deluxe King', total: 30, available: 8, booked: 22, rate: 32000 },
  { room: 'Park Suite', total: 12, available: 3, booked: 9, rate: 68000 },
  { room: 'Executive Twin', total: 20, available: 12, booked: 8, rate: 28000 },
  { room: 'Corner Suite', total: 8, available: 1, booked: 7, rate: 95000 },
  { room: 'Presidential Suite', total: 2, available: 0, booked: 2, rate: 210000 },
];

const recentBookings = [
  { ref: 'TRV-HT-1924', guest: 'Arjun Mehta', room: 'Deluxe King', checkIn: '2025-03-15', checkOut: '2025-03-22', nights: 7, amount: 224000, status: 'confirmed' },
  { ref: 'TRV-HT-2047', guest: 'Priya Sharma', room: 'Park Suite', checkIn: '2025-03-18', checkOut: '2025-03-21', nights: 3, amount: 204000, status: 'confirmed' },
  { ref: 'TRV-HT-2031', guest: 'Vikram Nair', room: 'Executive Twin', checkIn: '2025-03-20', checkOut: '2025-03-25', nights: 5, amount: 140000, status: 'pending' },
  { ref: 'TRV-HT-2019', guest: 'Ananya Krishnan', room: 'Corner Suite', checkIn: '2025-03-22', checkOut: '2025-03-24', nights: 2, amount: 190000, status: 'confirmed' },
];

const tabs = ['Dashboard', 'Inventory', 'Bookings', 'Payouts', 'Performance'] as const;
type Tab = typeof tabs[number];

export default function PartnerDashboard() {
  const [tab, setTab] = useState<Tab>('Dashboard');

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-700 font-bold text-sm">PH</div>
            <div>
              <h1 className="font-display text-2xl text-slate-900">{partner.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-700 font-medium capitalize">{partner.verificationStatus}</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500 capitalize">{partner.type}</span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500">{partner.country}</span>
              </div>
            </div>
          </div>
        </div>
        <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors">
          + Add Inventory
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
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xl mb-1">{m.icon}</div>
                <div className="text-lg font-bold text-slate-900">{m.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
                {m.change !== '-' && (
                  <div className={`text-xs font-medium mt-1 ${m.up ? 'text-emerald-600' : 'text-red-600'}`}>{m.up ? '↑' : '↓'} {m.change}</div>
                )}
              </div>
            ))}
          </div>

          {/* Pending actions */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-semibold text-amber-900 mb-3">Pending Actions</h3>
            <div className="space-y-2">
              {[
                { msg: '3 booking modification requests awaiting approval', urgency: 'high' },
                { msg: '2 guest special requests not yet confirmed', urgency: 'medium' },
                { msg: 'Update room inventory for April 5-12 (low availability)', urgency: 'low' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.urgency === 'high' ? 'bg-red-500' : item.urgency === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <span className="text-sm text-slate-700">{item.msg}</span>
                  </div>
                  <button className="text-xs text-violet-600 font-semibold hover:text-violet-700 flex-shrink-0 ml-3">Action →</button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent bookings table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Recent Bookings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {['Reference', 'Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Amount', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentBookings.map((b) => (
                    <tr key={b.ref} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.ref}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{b.guest}</td>
                      <td className="px-4 py-3 text-slate-600">{b.room}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{b.checkIn}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{b.checkOut}</td>
                      <td className="px-4 py-3 text-slate-600">{b.nights}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">₹{b.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'Inventory' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Room Inventory</h3>
              <button className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700">Update</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {['Room Type', 'Total Rooms', 'Available', 'Booked', 'Occupancy', 'Rate/Night'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryItems.map((room) => {
                    const occ = Math.round((room.booked / room.total) * 100);
                    return (
                      <tr key={room.room} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{room.room}</td>
                        <td className="px-4 py-3 text-slate-600">{room.total}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${room.available === 0 ? 'text-red-600' : room.available <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {room.available}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{room.booked}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${occ >= 90 ? 'bg-red-500' : occ >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${occ}%` }} />
                            </div>
                            <span className="text-xs text-slate-600">{occ}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">₹{room.rate.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'Bookings' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">All Bookings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {['Reference', 'Guest', 'Room', 'Check-in', 'Nights', 'Amount', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentBookings.map((b) => (
                  <tr key={b.ref} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{b.ref}</td>
                    <td className="px-4 py-3 font-medium">{b.guest}</td>
                    <td className="px-4 py-3 text-slate-600">{b.room}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.checkIn}</td>
                    <td className="px-4 py-3">{b.nights}</td>
                    <td className="px-4 py-3 font-semibold">₹{b.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-violet-600 font-medium hover:text-violet-700">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Performance' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Quality Score', value: partner.qualityScore, max: 100, color: 'bg-blue-500' },
            { label: 'Fulfillment Rate', value: partner.fulfillmentRate, max: 100, color: 'bg-emerald-500' },
            { label: 'Complaint Rate', value: partner.complaintRate, max: 10, color: 'bg-red-500', reverse: true },
            { label: 'Incident Rate', value: partner.incidentRate, max: 5, color: 'bg-amber-500', reverse: true },
          ].map((metric) => (
            <div key={metric.label} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">{metric.label}</h3>
                <span className="text-2xl font-bold text-slate-900">{metric.value}{metric.max === 100 ? '%' : ''}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${metric.color}`}
                  style={{ width: `${(metric.value / metric.max) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">{(metric as any).reverse ? 'Lower is better' : 'Higher is better'}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Payouts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Pending Payout', value: '₹18,24,000', color: 'bg-amber-50 border-amber-200 text-amber-900' },
              { label: 'Paid This Month', value: '₹1.04 Cr', color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
              { label: 'Annual Revenue', value: '₹2.24 Cr', color: 'bg-blue-50 border-blue-200 text-blue-900' },
            ].map((s) => (
              <div key={s.label} className={`border rounded-2xl p-5 ${s.color}`}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Payout History</h3>
            <div className="space-y-3">
              {[
                { date: '2025-02-28', amount: '₹84,20,000', status: 'paid', ref: 'PAY-2025-02' },
                { date: '2025-01-31', amount: '₹72,80,000', status: 'paid', ref: 'PAY-2025-01' },
                { date: '2024-12-31', amount: '₹96,40,000', status: 'paid', ref: 'PAY-2024-12' },
              ].map((p) => (
                <div key={p.ref} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{p.date}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.ref}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{p.amount}</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
