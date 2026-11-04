import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { controlTowerJourneys, suppliers } from '../../data/mockData';

const riskColors = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  high: 'bg-red-50 text-red-700 border-red-100',
};

export default function JourneyControlTower() {
  const { journeys, resolveDisruption, disruptionSimulated, navigate } = useApp();
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(controlTowerJourneys[0]?.id || null);
  const [filter, setFilter] = useState<'all' | 'at-risk' | 'in-travel'>('all');

  const selectedCtJourney = controlTowerJourneys.find(j => j.id === selectedJourneyId);
  const fullJourney = journeys.find(j => j.id === selectedJourneyId);
  const disruption = fullJourney?.disruptions[0];

  const filtered = controlTowerJourneys.filter(j =>
    filter === 'all' ? true :
    filter === 'at-risk' ? j.risk !== 'low' :
    j.status === 'in-travel'
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-slate-900">Journey Control Tower</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-600 text-sm font-medium">Monitoring {controlTowerJourneys.length} active journeys</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Journey list */}
        <div className="w-full xl:w-80 flex-shrink-0">
          {/* Filter */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
            {[{ key: 'all', label: 'All' }, { key: 'in-travel', label: 'In Travel' }, { key: 'at-risk', label: 'At Risk' }].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {filtered.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJourneyId(j.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedJourneyId === j.id ? 'border-orange-400 bg-orange-50' : 'bg-white border-slate-200 hover:border-orange-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{j.traveler}</p>
                    <p className="text-xs text-slate-500">{j.destination}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${riskColors[j.risk as keyof typeof riskColors]}`}>
                    {j.risk}
                  </span>
                </div>
                {j.disruption && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 bg-red-50 rounded-lg border border-red-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-[10px] text-red-700 font-medium leading-tight">{j.disruption}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-slate-400 capitalize">{j.status}</span>
                  <span className="text-[10px] text-slate-400">{new Date(j.lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Journey detail panel */}
        <div className="flex-1 min-w-0">
          {selectedCtJourney ? (
            <div className="space-y-4">
              {/* Header */}
              <div className={`rounded-2xl p-5 border ${selectedCtJourney.risk === 'high' ? 'bg-red-50 border-red-200' : selectedCtJourney.risk === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${riskColors[selectedCtJourney.risk as keyof typeof riskColors]}`}>
                        {selectedCtJourney.risk.toUpperCase()} RISK
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{selectedCtJourney.status}</span>
                    </div>
                    <h2 className="font-display text-xl text-slate-900">{selectedCtJourney.traveler}</h2>
                    <p className="text-slate-600 text-sm mt-0.5">Journey to {selectedCtJourney.destination}</p>
                  </div>
                  <button
                    onClick={() => navigate('journey', { selectedJourneyId: selectedCtJourney.id })}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
                  >
                    Open Journey
                  </button>
                </div>

                {selectedCtJourney.disruption && (
                  <div className="mt-4 p-4 bg-white rounded-xl border border-red-200">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Active Disruption</p>
                    <p className="font-semibold text-slate-900 text-sm">{selectedCtJourney.disruption}</p>
                  </div>
                )}
              </div>

              {/* Journey detail */}
              {fullJourney && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bookings */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h3 className="font-semibold text-slate-900 mb-3">Bookings</h3>
                    <div className="space-y-2 text-sm">
                      {fullJourney.bookings.map((bId) => {
                        const b = fullJourney.notifications; // dummy
                        return (
                          <div key={bId} className="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
                            <span className="text-slate-400 text-xs font-mono">{bId}</span>
                          </div>
                        );
                      })}
                      {fullJourney.bookings.length === 0 && <p className="text-slate-400 text-xs">No bookings</p>}
                      <div className="text-xs text-slate-500 pt-2">{fullJourney.bookings.length} booking(s) · ₹{fullJourney.totalSpend.toLocaleString()} total</div>
                    </div>
                  </div>

                  {/* Disruptions */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h3 className="font-semibold text-slate-900 mb-3">Disruptions</h3>
                    {fullJourney.disruptions.length === 0 ? (
                      <p className="text-xs text-slate-400">No active disruptions</p>
                    ) : (
                      fullJourney.disruptions.map((d) => (
                        <div key={d.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full ${d.status === 'resolved' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                            <span className="text-xs font-semibold capitalize">{d.status}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">{d.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{d.description}</p>
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs font-semibold text-blue-700 mb-0.5">Recommendation</p>
                            <p className="text-xs text-blue-700">{d.recommendation}</p>
                          </div>
                          {d.status !== 'resolved' && (
                            <button
                              onClick={() => resolveDisruption(d.id)}
                              className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Notifications */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:col-span-2">
                    <h3 className="font-semibold text-slate-900 mb-3">Communications & Alerts</h3>
                    <div className="space-y-2">
                      {fullJourney.notifications.map((n) => (
                        <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border ${n.type === 'alert' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                          <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${n.type === 'alert' ? 'bg-red-500' : 'bg-blue-500'}`} />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                          </div>
                        </div>
                      ))}
                      {fullJourney.notifications.length === 0 && <p className="text-xs text-slate-400">No notifications</p>}
                    </div>

                    {/* Operator actions */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Operator Actions</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          'Contact Traveler',
                          'Notify Supplier',
                          'Rebook Flight',
                          'Escalate to Manager',
                          'Send Travel Alert',
                        ].map((action) => (
                          <button key={action} className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Supplier info */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Suppliers for this Journey</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {suppliers.slice(0, 3).map((s) => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${s.riskLevel === 'low' ? 'bg-emerald-500' : s.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-semibold text-slate-700">{s.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <div className="flex justify-between"><span>Quality</span><span className="font-medium text-slate-700">{s.qualityScore}/100</span></div>
                        <div className="flex justify-between"><span>Fulfillment</span><span className="font-medium text-slate-700">{s.fulfillmentRate}%</span></div>
                        <div className="flex justify-between"><span>Risk</span><span className={`font-medium capitalize ${s.riskLevel === 'low' ? 'text-emerald-600' : s.riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'}`}>{s.riskLevel}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Select a journey to inspect
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
