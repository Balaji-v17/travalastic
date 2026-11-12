import React from 'react';

export function NotPermittedPage() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm max-w-lg mx-auto mt-12">
      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
        !
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Not Permitted</h1>
      <p className="text-sm text-slate-600 mb-6">
        You do not have the required permissions to view this administrative resource.
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

