import React from 'react';

export function NotFoundPage() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm max-w-lg mx-auto mt-12">
      <h1 className="text-xl font-bold text-slate-900 mb-2">Page Not Found</h1>
      <p className="text-sm text-slate-600 mb-6">
        The requested administrative route does not exist.
      </p>
      <a
        href="#/"
        className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
      >
        Return to Dashboard
      </a>
    </div>
  );
}

