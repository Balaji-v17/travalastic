import { useState } from 'react';
import { suppliers } from '../../data/mockData';

export default function SupplierIntelligence() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedSupplier = suppliers.find(s => s.id === selected);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl text-slate-900 mb-2">Supplier Intelligence</h1>
      <p className="text-slate-500 text-sm mb-6">Monitor, review, and manage your supplier ecosystem</p>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                {['Supplier', 'Type', 'Status', 'Quality', 'Fulfillment', 'Complaint Rate', 'Risk', 'Active Bookings', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${selected === s.id ? 'bg-orange-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-700 font-bold text-xs flex-shrink-0">
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{s.type}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.verificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' :
                      s.verificationStatus === 'pending' ? 'bg-amber-50 text-amber-700' :
                      s.verificationStatus === 'suspended' ? 'bg-red-50 text-red-700' :
                      'bg-orange-50 text-orange-700'
                    }`}>
                      {s.verificationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.qualityScore >= 90 ? 'bg-emerald-500' : s.qualityScore >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.qualityScore}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{s.qualityScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.fulfillmentRate}%</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${s.complaintRate > 4 ? 'text-red-600' : s.complaintRate > 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {s.complaintRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      s.riskLevel === 'low' ? 'bg-emerald-50 text-emerald-700' :
                      s.riskLevel === 'medium' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {s.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.activeBookings}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setSelected(s.id === selected ? null : s.id)} className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 font-medium">Review</button>
                      {s.verificationStatus === 'verified' && (
                        <button className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded-md hover:bg-red-100 font-medium">Restrict</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSupplier && (
        <div className="mt-4 bg-white border border-orange-200 rounded-2xl p-5 animate-slide-up">
          <h3 className="font-semibold text-slate-900 mb-4">Supplier Detail — {selectedSupplier.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Revenue', value: `₹${(selectedSupplier.revenue / 100000).toFixed(0)}L` },
              { label: 'Quality Score', value: `${selectedSupplier.qualityScore}/100` },
              { label: 'Fulfillment', value: `${selectedSupplier.fulfillmentRate}%` },
              { label: 'Active Bookings', value: selectedSupplier.activeBookings },
            ].map((m) => (
              <div key={m.label} className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                <p className="text-lg font-bold text-slate-900">{m.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <button className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700">Approve</button>
            <button className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700">Restrict</button>
            <button className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700">Suspend</button>
            <button onClick={() => setSelected(null)} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
