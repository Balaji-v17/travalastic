import { useApp } from '../../store/AppContext';
import { operationsMetrics, recentAlerts, suppliers } from '../../data/mockData';

const severityColors = {
  high: 'border-red-200 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low: 'border-blue-100 bg-blue-50',
  critical: 'border-red-300 bg-red-100',
};

const alertTypeIcons: Record<string, string> = {
  'flight-delay': '✈️',
  weather: '🌩️',
  supplier: '🏢',
  payment: '💳',
};

export default function CommandCenter() {
  const { navigate, simulateDisruption, disruptionSimulated } = useApp();

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-slate-900">Command Center</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-600 text-sm font-medium">Live · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        {!disruptionSimulated && (
          <button
            onClick={simulateDisruption}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Simulate Disruption
          </button>
        )}
      </div>

      {/* Live metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {[
          { label: 'Active Journeys', value: operationsMetrics.activeJourneys.toLocaleString(), color: 'text-blue-700', icon: '🗺️' },
          { label: 'At Risk', value: operationsMetrics.atRiskJourneys, color: 'text-amber-700', icon: '⚠️' },
          { label: 'Critical Alerts', value: operationsMetrics.criticalAlerts, color: 'text-red-700', icon: '🚨' },
          { label: 'Resolved Today', value: operationsMetrics.resolvedToday, color: 'text-emerald-700', icon: '✅' },
          { label: 'Bookings Today', value: operationsMetrics.bookingsToday.toLocaleString(), color: 'text-blue-700', icon: '📋' },
          { label: 'Revenue Today', value: '₹4.28Cr', color: 'text-emerald-700', icon: '💰' },
          { label: 'Supplier Alerts', value: operationsMetrics.supplierAlerts, color: 'text-amber-700', icon: '🏢' },
          { label: 'Support Cases', value: operationsMetrics.supportCases, color: 'text-violet-700', icon: '💬' },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <div className="text-lg mb-1">{m.icon}</div>
            <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Active Alerts</h2>
            <button
              onClick={() => navigate('journey-control-tower')}
              className="text-sm text-orange-600 font-medium hover:text-orange-700"
            >
              Open Control Tower →
            </button>
          </div>

          {recentAlerts.map((alert) => (
            <div key={alert.id} className={`rounded-2xl border p-5 ${severityColors[alert.severity as keyof typeof severityColors]}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{alertTypeIcons[alert.type] || '⚡'}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                        alert.severity === 'high' ? 'bg-red-100 text-red-700' :
                        alert.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{alert.status}</span>
                    </div>
                    <p className="font-semibold text-slate-900">{alert.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(alert.timestamp).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {alert.journeyId && (
                    <button
                      onClick={() => navigate('journey-control-tower')}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      View Journey
                    </button>
                  )}
                  <button className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 transition-colors">
                    Resolve
                  </button>
                </div>
              </div>
            </div>
          ))}

          {disruptionSimulated && (
            <div className="rounded-2xl border border-red-300 bg-red-100 p-5 animate-slide-up">
              <div className="flex items-start gap-3">
                <span className="text-xl">✈️</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-bold uppercase rounded-full">CRITICAL</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-red-700 font-semibold">LIVE</span>
                  </div>
                  <p className="font-semibold text-red-900">IndiGo 6E-812 delayed 45min — Journey jrn-001 affected</p>
                  <p className="text-xs text-red-700 mt-1">Traveler: Arjun Mehta · Destination: Tokyo NRT · Transfer reviewed: no impact</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => navigate('journey-control-tower')} className="px-3 py-1.5 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800">Open in Control Tower</button>
                    <button className="px-3 py-1.5 bg-white border border-red-300 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50">Notify Traveler</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Supplier health */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Supplier Health</h3>
            <div className="space-y-3">
              {suppliers.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    s.riskLevel === 'low' ? 'bg-emerald-500' :
                    s.riskLevel === 'medium' ? 'bg-amber-500' :
                    'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{s.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{s.qualityScore}</p>
                    <p className="text-xs text-slate-400">score</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('supplier-intelligence')} className="w-full mt-3 text-sm text-orange-600 font-medium hover:text-orange-700 text-center">
              View all suppliers →
            </button>
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Journey Control Tower', icon: '🗺️', page: 'journey-control-tower' as const },
                { label: 'Supplier Intelligence', icon: '🏢', page: 'supplier-intelligence' as const },
                { label: 'Finance Overview', icon: '💰', page: 'finance' as const },
                { label: 'Analytics', icon: '📊', page: 'analytics' as const },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => navigate(a.page)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <span>{a.icon}</span>
                  <span className="text-sm text-slate-700 font-medium">{a.label}</span>
                  <svg className="ml-auto" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
