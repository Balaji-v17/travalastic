import React, { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { getNavRoutes } from '../lib/routes.ts';

interface LayoutProps {
  currentPath: string;
  children: ReactNode;
  hideNavigation?: boolean;
}

export function Layout({ currentPath, children, hideNavigation = false }: LayoutProps) {
  const { admin, logout } = useAuth();
  const shouldHideNav = hideNavigation || admin?.mustChangePassword === true;
  const navRoutes = shouldHideNav ? [] : getNavRoutes(admin?.role, admin?.mustChangePassword);

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'content_editor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'support_agent':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-lg tracking-tight text-slate-900">
              Travalastic <span className="text-slate-500 font-normal text-sm ml-1">Admin Panel</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {admin && (
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-slate-700 hidden sm:inline" title={admin.email}>
                  {admin.email}
                </span>
                {!shouldHideNav && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getRoleBadgeColor(
                      admin.role
                    )}`}
                  >
                    {admin.role.replace('_', ' ')}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              className="text-sm text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Side Navigation (hidden when forced password change or explicitly hidden) */}
        {!shouldHideNav && navRoutes.length > 0 && (
          <nav aria-label="Sidebar" className="w-56 shrink-0 hidden md:block">
            <div className="bg-white rounded-lg border border-slate-200 p-2 space-y-1">
              {navRoutes.map((route) => {
                const isActive =
                  currentPath === route.path ||
                  (route.path === '/' && (currentPath === '' || currentPath === '/')) ||
                  (route.path !== '/' && currentPath.startsWith(route.path));
                return (
                  <a
                    key={route.id}
                    href={`#${route.path}`}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {route.label}
                  </a>
                );
              })}
            </div>
          </nav>
        )}

        {/* Main Content Area */}
        <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
