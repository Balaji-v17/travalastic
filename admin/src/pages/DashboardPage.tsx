import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';

export function DashboardPage() {
  const { admin, dashboardNotification, setDashboardNotification } = useAuth();

  const getRoleCapabilities = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return [
          'Manage administrator accounts, assign roles, deactivate and reset credentials',
          'View and inspect the append-only system audit log',
          'Audit administrative mutations and user authentication events',
          'Manage future platform collections, destinations, and settings',
        ];
      case 'content_editor':
        return [
          'Search, create, edit, hide, and restore tourist place catalog records',
          'Review hotel pricing, tiers, and manage curated accommodation records',
          'Review place coordinates, categories, and AI search indexing state',
        ];
      case 'support_agent':
        return [
          'Assist travelers with bookings and disruption guardian status',
          'Review support tickets and travel assistance escalations',
        ];
      default:
        return ['Access general administrative utilities'];
    }
  };

  return (
    <div className="space-y-6">
      {/* Password changed banner or notification */}
      {dashboardNotification && (
        <div
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between shadow-xs"
          role="status"
        >
          <div className="flex items-center space-x-2.5">
            <svg
              className="h-5 w-5 text-emerald-600 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold">{dashboardNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setDashboardNotification(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 ml-4 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          Welcome back, {admin?.email}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          You are signed in with the role of{' '}
          <span className="font-semibold text-slate-900">
            {admin?.role.replace('_', ' ')}
          </span>
          .
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-3">
          Available Capabilities for Your Role
        </h2>
        <ul className="space-y-2">
          {getRoleCapabilities(admin?.role).map((capability, idx) => (
            <li key={idx} className="flex items-start text-sm text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-2 mr-2.5 shrink-0" />
              <span>{capability}</span>
            </li>
          ))}
        </ul>

        {(admin?.role === 'super_admin' || admin?.role === 'content_editor') && (
          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-4">
            <a
              href="#/places"
              className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Manage Places &rarr;
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="#/hotels"
              className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Manage Hotels &rarr;
            </a>
            {admin?.role === 'super_admin' && (
              <>
                <span className="text-slate-300">|</span>
                <a
                  href="#/admins"
                  className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Manage Admin Accounts &rarr;
                </a>
                <span className="text-slate-300">|</span>
                <a
                  href="#/audit"
                  className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Open Audit Log &rarr;
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
