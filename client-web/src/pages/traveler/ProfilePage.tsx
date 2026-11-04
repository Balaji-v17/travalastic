import { useState } from 'react';
import { useApp } from '../../store/AppContext';

type ProfileTab = 'personal' | 'travel-identity' | 'preferences' | 'security' | 'loyalty';

function isExpiringSoon(expiryDateStr: string): boolean {
  const expiry = new Date(expiryDateStr);
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
  return expiry <= sixMonthsFromNow;
}

function isExpired(expiryDateStr: string): boolean {
  return new Date(expiryDateStr) < new Date();
}

function PassportStatusBadge({ expiry }: { expiry: string }) {
  if (isExpired(expiry)) {
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Expired</span>;
  }
  if (isExpiringSoon(expiry)) {
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Expiring soon</span>;
  }
  return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Valid</span>;
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
            value === opt.value
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      style={{ width: 40, height: 22 }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'travel-identity', label: 'Travel Identity' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'security', label: 'Security' },
  { key: 'loyalty', label: 'Loyalty' },
];

const TIER_NEXT: Record<string, string> = {
  standard: 'Silver',
  silver: 'Gold',
  gold: 'Platinum',
  platinum: 'Platinum',
};

const TIER_BADGE: Record<string, string> = {
  standard: 'bg-slate-100 text-slate-600',
  silver: 'bg-slate-200 text-slate-700',
  gold: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  platinum: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white',
};

const TIER_PROGRESS: Record<string, number> = {
  standard: 15,
  silver: 40,
  gold: 72,
  platinum: 100,
};

export default function ProfilePage() {
  const { traveler, journeys } = useApp();
  const [tab, setTab] = useState<ProfileTab>('personal');

  // Personal form
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: traveler.name,
    email: traveler.email,
    phone: traveler.phone,
    dob: '1990-04-15',
    nationality: traveler.nationality,
  });
  const [saved, setSaved] = useState(false);

  // Preferences
  const [seatPref, setSeatPref] = useState<'aisle' | 'window' | 'none'>('aisle');
  const [mealPref, setMealPref] = useState<'veg-indian' | 'jain' | 'vegan' | 'non-veg'>('veg-indian');
  const [cabinPref, setCabinPref] = useState<'economy' | 'business'>('economy');
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR'>('INR');
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);

  // Security
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  const completedTrips = journeys.filter((j) => j.status === 'completed').length;
  const totalSpend = journeys.reduce((s, j) => s + j.totalSpend, 0);
  const countriesVisited = new Set(journeys.map((j) => j.destination)).size;
  const homeCity = 'Mumbai, India';

  const passportExpiry = '2026-11-14';
  const emergencyContact = { name: 'Priya Mehta', relation: 'Spouse', phone: '+91 98765 00000' };

  const recentActivity = [
    { desc: 'Earned 2,400 miles — Tokyo flight', date: 'Dec 2024', miles: 2400 },
    { desc: 'Earned 800 miles — Bali hotel stay', date: 'Nov 2024', miles: 800 },
    { desc: 'Redeemed 5,000 miles — seat upgrade', date: 'Oct 2024', miles: -5000 },
  ];

  function handleSave() {
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8">

      {/* ── Profile Hero ── */}
      <div className="relative rounded-xl overflow-hidden mb-6 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 sm:p-8">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/10">
              {traveler.avatar}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-sans font-bold text-2xl text-white">{traveler.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${TIER_BADGE[traveler.tier]}`}>
                {traveler.tier} Member
              </span>
            </div>
            <p className="text-white/50 text-sm mt-1 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2"/><path d="M6 1a4 4 0 014 4c0 3-4 7-4 7S2 8 2 5a4 4 0 014-4z" strokeLinecap="round"/></svg>
              {homeCity}
            </p>
            <p className="text-white/40 text-sm">{traveler.email}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/10">
          {[
            { label: 'Total trips', value: traveler.totalTrips },
            { label: 'Countries', value: countriesVisited },
            { label: 'Total spend', value: `₹${(totalSpend / 1000).toFixed(0)}K` },
            { label: 'Member since', value: '2022' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab strip ── */}
      <div className="border-b border-slate-200 mb-6 flex gap-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Personal ── */}
      {tab === 'personal' && (
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-sans font-semibold text-slate-900 text-base">Personal Information</h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all">
                  Save changes
                </button>
              </div>
            )}
          </div>

          {saved && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 7l3.5 3.5L12 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Changes saved successfully.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { key: 'name', label: 'Full name', type: 'text' },
              { key: 'email', label: 'Email address', type: 'email' },
              { key: 'phone', label: 'Phone number', type: 'tel' },
              { key: 'dob', label: 'Date of birth', type: 'date' },
              { key: 'nationality', label: 'Nationality', type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{label}</label>
                {editing ? (
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                  />
                ) : (
                  <p className="text-sm text-slate-800 py-2.5">{form[key as keyof typeof form] || '—'}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Travel Identity ── */}
      {tab === 'travel-identity' && (
        <div className="space-y-4">
          {/* Passport */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <h2 className="font-sans font-semibold text-slate-900 text-base mb-4">Passport</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Number</p>
                <p className="text-sm text-slate-800">{traveler.passportNumber}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Country</p>
                <p className="text-sm text-slate-800">{traveler.nationality}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Expiry</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-800">{passportExpiry}</p>
                  <PassportStatusBadge expiry={passportExpiry} />
                </div>
              </div>
            </div>
          </div>

          {/* Travel Documents */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <h2 className="font-sans font-semibold text-slate-900 text-base mb-4">Travel Documents</h2>
            <div className="space-y-3">
              {[
                { type: 'Passport', name: 'Indian Passport', number: traveler.passportNumber, expiry: '2026-11-14' },
                { type: 'Visa', name: 'Japan Tourist Visa', number: 'JP-2847-T', expiry: '2025-09-30' },
                { type: 'Insurance', name: 'World Nomads Annual', number: 'WN-8821-A', expiry: '2025-12-31' },
              ].map((doc) => (
                <div key={doc.number} className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{doc.type}</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{doc.name}</p>
                    <p className="text-xs text-slate-400">{doc.number} · Expires {doc.expiry}</p>
                  </div>
                  <PassportStatusBadge expiry={doc.expiry} />
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <h2 className="font-sans font-semibold text-slate-900 text-base mb-4">Emergency Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Name</p>
                <p className="text-sm text-slate-800">{emergencyContact.name}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Relation</p>
                <p className="text-sm text-slate-800">{emergencyContact.relation}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Phone</p>
                <p className="text-sm text-slate-800">{emergencyContact.phone}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Preferences ── */}
      {tab === 'preferences' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">Seat preference</p>
              <ChipGroup
                options={[
                  { label: 'Aisle', value: 'aisle' },
                  { label: 'Window', value: 'window' },
                  { label: 'No preference', value: 'none' },
                ]}
                value={seatPref}
                onChange={setSeatPref}
              />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">Meal preference</p>
              <ChipGroup
                options={[
                  { label: 'Veg Indian', value: 'veg-indian' },
                  { label: 'Jain', value: 'jain' },
                  { label: 'Vegan', value: 'vegan' },
                  { label: 'Non-veg', value: 'non-veg' },
                ]}
                value={mealPref}
                onChange={setMealPref}
              />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">Cabin class</p>
              <ChipGroup
                options={[
                  { label: 'Economy', value: 'economy' },
                  { label: 'Business', value: 'business' },
                ]}
                value={cabinPref}
                onChange={setCabinPref}
              />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">Currency display</p>
              <ChipGroup
                options={[
                  { label: 'INR ₹', value: 'INR' },
                  { label: 'USD $', value: 'USD' },
                  { label: 'EUR €', value: 'EUR' },
                ]}
                value={currency}
                onChange={setCurrency}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <h3 className="font-sans font-semibold text-slate-900 text-base mb-4">Notifications</h3>
            <div className="space-y-4">
              {[
                { label: 'Email notifications', sub: 'Booking confirmations, alerts, and offers', checked: emailNotif, toggle: () => setEmailNotif(!emailNotif) },
                { label: 'Push notifications', sub: 'Real-time flight alerts and trip reminders', checked: pushNotif, toggle: () => setPushNotif(!pushNotif) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                  <Toggle checked={item.checked} onChange={item.toggle} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Security ── */}
      {tab === 'security' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <h2 className="font-sans font-semibold text-slate-900 text-base mb-4">Password</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-800">••••••••••••</p>
                <p className="text-xs text-slate-400 mt-0.5">Last changed 3 months ago</p>
              </div>
              <button className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
                Change
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-sans font-semibold text-slate-900 text-base">Two-factor authentication</h2>
                <p className="text-xs text-slate-400 mt-1">Add an extra layer of security to your account</p>
              </div>
              <Toggle checked={twoFAEnabled} onChange={() => setTwoFAEnabled(!twoFAEnabled)} />
            </div>
            {twoFAEnabled && (
              <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">
                Two-factor authentication is active. You will be prompted for a code on new logins.
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <h2 className="font-sans font-semibold text-slate-900 text-base mb-4">Active Sessions</h2>
            <div className="space-y-3">
              {[
                { location: 'Mumbai, India', browser: 'Chrome 120', device: 'MacBook Pro', time: 'Today 14:32', current: true },
                { location: 'Mumbai, India', browser: 'Safari 17', device: 'iPhone 15', time: 'Yesterday 09:15', current: false },
              ].map((session, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{session.browser} · {session.device}</p>
                      {session.current && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700">Current</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{session.location} · {session.time}</p>
                  </div>
                  {!session.current && (
                    <button className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Loyalty ── */}
      {tab === 'loyalty' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Miles balance</p>
                <p className="text-3xl font-bold text-slate-900">{traveler.loyaltyPoints.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-0.5">points available</p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${TIER_BADGE[traveler.tier]}`}>
                {traveler.tier}
              </span>
            </div>

            {traveler.tier !== 'platinum' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500">Progress to {TIER_NEXT[traveler.tier]}</p>
                  <p className="text-xs font-semibold text-slate-700">{TIER_PROGRESS[traveler.tier]}%</p>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all"
                    style={{ width: `${TIER_PROGRESS[traveler.tier]}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Earn {Math.round((1 - TIER_PROGRESS[traveler.tier] / 100) * 10000).toLocaleString()} more points to reach {TIER_NEXT[traveler.tier]}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
            <h3 className="font-sans font-semibold text-slate-900 text-base mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.map((act, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm text-slate-800">{act.desc}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{act.date}</p>
                  </div>
                  <span className={`text-sm font-semibold ${act.miles > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {act.miles > 0 ? '+' : ''}{act.miles.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completed trips summary */}
      {completedTrips > 0 && (
        <p className="text-xs text-slate-400 text-center mt-6">{completedTrips} trips completed with Travalastic</p>
      )}
    </div>
  );
}
