export default function FinancePage() {
  const transactions = [
    { id: 'TXN-4829', traveler: 'Arjun Mehta', type: 'Flight', amount: 48500, status: 'successful', date: '2025-01-22' },
    { id: 'TXN-5841', traveler: 'Arjun Mehta', type: 'Hotel', amount: 224000, status: 'successful', date: '2025-01-22' },
    { id: 'TXN-6192', traveler: 'Arjun Mehta', type: 'Hotel', amount: 315000, status: 'pending', date: '2025-02-10' },
    { id: 'TXN-7021', traveler: 'Priya Sharma', type: 'Flight', amount: 38200, status: 'successful', date: '2025-02-14' },
    { id: 'TXN-7842', traveler: 'Vikram Nair', type: 'Package', amount: 480000, status: 'successful', date: '2025-02-20' },
    { id: 'TXN-8121', traveler: 'Ananya Krishnan', type: 'Hotel', amount: 190000, status: 'refunded', date: '2025-03-01' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl text-slate-900 mb-6">Finance Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Revenue (MTD)', value: '₹4.28 Cr', change: '+12.4%', up: true },
          { label: 'Pending Settlements', value: '₹31.5 L', change: '-8.2%', up: false },
          { label: 'Refunds (MTD)', value: '₹1.9 L', change: '+2.1%', up: false },
          { label: 'Supplier Payouts Due', value: '₹2.14 Cr', change: '-', up: true },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className="text-xl font-bold text-slate-900">{m.value}</p>
            {m.change !== '-' && (
              <p className={`text-xs font-medium mt-1 ${m.up ? 'text-emerald-600' : 'text-red-600'}`}>{m.change} vs last month</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                {['Transaction ID', 'Traveler', 'Type', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t.traveler}</td>
                  <td className="px-4 py-3 text-slate-600">{t.type}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">₹{t.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.status === 'successful' ? 'bg-emerald-50 text-emerald-700' :
                      t.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
