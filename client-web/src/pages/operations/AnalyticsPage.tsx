export default function AnalyticsPage() {
  const topDestinations = [
    { name: 'Tokyo', bookings: 847, revenue: 4240000, growth: 22 },
    { name: 'Bali', bookings: 624, revenue: 3120000, growth: 18 },
    { name: 'Dubai', bookings: 512, revenue: 5120000, growth: 15 },
    { name: 'Paris', bookings: 389, revenue: 3890000, growth: 8 },
    { name: 'Maldives', bookings: 214, revenue: 6420000, growth: 28 },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl text-slate-900 mb-6">Analytics & Intelligence</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Bookings (MTD)', value: '8,471', change: '+14.2%' },
          { label: 'Total Revenue (MTD)', value: '₹42.8 Cr', change: '+12.4%' },
          { label: 'Avg. Booking Value', value: '₹50,524', change: '-1.6%' },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-slate-900">{m.value}</p>
            <p className={`text-sm font-medium mt-1 ${m.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>{m.change} vs last month</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Top Destinations</h3>
          <div className="space-y-3">
            {topDestinations.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800">{d.name}</span>
                    <span className="text-xs font-bold text-emerald-600">+{d.growth}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(d.bookings / 900) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{d.bookings} bookings</span>
                    <span>₹{(d.revenue / 100000).toFixed(1)}L revenue</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Demand Forecast</h3>
          <div className="space-y-3">
            {[
              { dest: 'Maldives', forecast: 'Demand trending 28% above forecast', signal: 'high', confidence: 94 },
              { dest: 'Tokyo', forecast: 'Cherry blossom season driving +22% demand', signal: 'high', confidence: 91 },
              { dest: 'Goa', forecast: 'Off-season — demand 12% below forecast', signal: 'low', confidence: 87 },
              { dest: 'Dubai', forecast: 'Business travel recovering — +15% trend', signal: 'medium', confidence: 82 },
            ].map((d) => (
              <div key={d.dest} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900">{d.dest}</span>
                  <span className="text-xs text-slate-500">Confidence: {d.confidence}%</span>
                </div>
                <p className="text-xs text-slate-600">{d.forecast}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">AI INSIGHT</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
