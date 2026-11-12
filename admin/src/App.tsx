import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Layout } from './components/Layout.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { AuditLogPage } from './pages/AuditLogPage.tsx';
import { AdminsPage } from './pages/AdminsPage.tsx';
import { ChangePasswordPage } from './pages/ChangePasswordPage.tsx';
import { PlacesListPage } from './pages/PlacesListPage.tsx';
import { PlaceFormPage } from './pages/PlaceFormPage.tsx';
import { HotelsListPage } from './pages/HotelsListPage.tsx';
import { HotelFormPage } from './pages/HotelFormPage.tsx';
import { CollectionsListPage } from './pages/CollectionsListPage.tsx';
import { CollectionEditorPage } from './pages/CollectionEditorPage.tsx';
import { SupportPage } from './pages/SupportPage.tsx';
import { NotPermittedPage } from './pages/NotPermittedPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { isRouteAllowed, normalizeRoute } from './lib/permissions.ts';
import { isValidStyleKey } from './lib/styleLabels.ts';

function AdminRouter() {
  const { admin, isLoading } = useAuth();
  const [currentHash, setCurrentHash] = useState<string>(() => window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm font-medium">
        <div className="flex items-center space-x-2">
          <svg
            className="animate-spin h-5 w-5 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>Initializing admin console...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated: show login screen
  if (!admin) {
    if (currentHash !== '#/login') {
      window.location.hash = '#/login';
    }
    return <LoginPage />;
  }

  // Forced password change lockdown: every route redirects to #/change-password, hide navigation
  if (admin.mustChangePassword) {
    if (currentHash !== '#/change-password') {
      window.location.hash = '#/change-password';
    }
    return (
      <Layout currentPath="/change-password" hideNavigation>
        <ChangePasswordPage />
      </Layout>
    );
  }

  // If authenticated and no forced password change, but on #/login: redirect to root dashboard
  if (currentHash === '#/login') {
    window.location.hash = '#/';
    return null;
  }

  // Normalize hash route
  const normalizedPath = normalizeRoute(currentHash);

  // Route matching & permissions guard
  if (normalizedPath === '/') {
    return (
      <Layout currentPath="/">
        <DashboardPage />
      </Layout>
    );
  }

  if (normalizedPath === '/places') {
    if (!isRouteAllowed(admin.role, '/places')) {
      return (
        <Layout currentPath="/places">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/places">
        <PlacesListPage />
      </Layout>
    );
  }

  if (normalizedPath === '/places/new') {
    if (!isRouteAllowed(admin.role, '/places/new')) {
      return (
        <Layout currentPath="/places/new">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/places/new">
        <PlaceFormPage mode="create" />
      </Layout>
    );
  }

  if (normalizedPath.startsWith('/places/')) {
    if (!isRouteAllowed(admin.role, normalizedPath)) {
      return (
        <Layout currentPath={normalizedPath}>
          <NotPermittedPage />
        </Layout>
      );
    }
    const placeId = normalizedPath.slice('/places/'.length).trim();
    if (!placeId) {
      return (
        <Layout currentPath={normalizedPath}>
          <NotFoundPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath={normalizedPath}>
        <PlaceFormPage mode="edit" placeId={placeId} />
      </Layout>
    );
  }

  if (normalizedPath === '/hotels') {
    if (!isRouteAllowed(admin.role, '/hotels')) {
      return (
        <Layout currentPath="/hotels">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/hotels">
        <HotelsListPage />
      </Layout>
    );
  }

  if (normalizedPath === '/hotels/new') {
    if (!isRouteAllowed(admin.role, '/hotels/new')) {
      return (
        <Layout currentPath="/hotels/new">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/hotels/new">
        <HotelFormPage mode="create" />
      </Layout>
    );
  }

  if (normalizedPath.startsWith('/hotels/')) {
    if (!isRouteAllowed(admin.role, normalizedPath)) {
      return (
        <Layout currentPath={normalizedPath}>
          <NotPermittedPage />
        </Layout>
      );
    }
    const hotelId = normalizedPath.slice('/hotels/'.length).trim();
    if (!hotelId) {
      return (
        <Layout currentPath={normalizedPath}>
          <NotFoundPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath={normalizedPath}>
        <HotelFormPage mode="edit" hotelId={hotelId} />
      </Layout>
    );
  }

  if (normalizedPath === '/collections') {
    if (!isRouteAllowed(admin.role, '/collections')) {
      return (
        <Layout currentPath="/collections">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/collections">
        <CollectionsListPage />
      </Layout>
    );
  }

  if (normalizedPath.startsWith('/collections/')) {
    if (!isRouteAllowed(admin.role, normalizedPath)) {
      return (
        <Layout currentPath={normalizedPath}>
          <NotPermittedPage />
        </Layout>
      );
    }
    const collectionKey = normalizedPath.slice('/collections/'.length).trim();
    if (!collectionKey || !isValidStyleKey(collectionKey)) {
      return (
        <Layout currentPath={normalizedPath}>
          <NotFoundPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath={normalizedPath}>
        <CollectionEditorPage collectionKey={collectionKey} />
      </Layout>
    );
  }

  if (normalizedPath === '/support') {
    if (!isRouteAllowed(admin.role, '/support')) {
      return (
        <Layout currentPath="/support">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/support">
        <SupportPage />
      </Layout>
    );
  }

  if (normalizedPath === '/admins') {
    if (!isRouteAllowed(admin.role, '/admins')) {
      return (
        <Layout currentPath="/admins">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/admins">
        <AdminsPage />
      </Layout>
    );
  }

  if (normalizedPath === '/audit') {
    if (!isRouteAllowed(admin.role, '/audit')) {
      return (
        <Layout currentPath="/audit">
          <NotPermittedPage />
        </Layout>
      );
    }
    return (
      <Layout currentPath="/audit">
        <AuditLogPage />
      </Layout>
    );
  }

  if (normalizedPath === '/change-password') {
    return (
      <Layout currentPath="/change-password">
        <ChangePasswordPage />
      </Layout>
    );
  }

  // Unrecognized route -> 404 Not Found
  return (
    <Layout currentPath={normalizedPath}>
      <NotFoundPage />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdminRouter />
    </AuthProvider>
  );
}
