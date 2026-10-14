import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/query-client';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/layout/Navbar';
import { OfflineScreen } from './components/pwa/OfflineScreen';
import { InstallPromptBanner } from './components/pwa/InstallPromptBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Button } from './components/ui/Button';
import { Wine, Sparkles } from 'lucide-react';

// Code Splitting & Lazy-Loaded Route Components for Lighthouse 90+ Performance Score
const QrMenuPage = lazy(() =>
  import('./features/qr-customer/QrMenuPage').then((m) => ({ default: m.QrMenuPage })),
);
const KitchenDisplayPage = lazy(() =>
  import('./features/kitchen/KitchenDisplayPage').then((m) => ({ default: m.KitchenDisplayPage })),
);
const WaiterDashboardPage = lazy(() =>
  import('./features/waiter/WaiterDashboardPage').then((m) => ({ default: m.WaiterDashboardPage })),
);
const ClubManagementPage = lazy(() =>
  import('./features/admin/ClubManagementPage').then((m) => ({ default: m.ClubManagementPage })),
);
const ManagerMenuPage = lazy(() =>
  import('./features/admin/ManagerMenuPage').then((m) => ({ default: m.ManagerMenuPage })),
);
const PlatformAdminDashboardPage = lazy(() =>
  import('./features/admin/PlatformAdminDashboardPage').then((m) => ({ default: m.PlatformAdminDashboardPage })),
);
const ManagerAnalyticsDashboardPage = lazy(() =>
  import('./features/admin/ManagerAnalyticsDashboardPage').then((m) => ({ default: m.ManagerAnalyticsDashboardPage })),
);
const CustomerOrderStatusPage = lazy(() =>
  import('./features/customer/CustomerOrderStatusPage').then((m) => ({ default: m.CustomerOrderStatusPage })),
);
const ReportingAnalyticsPage = lazy(() =>
  import('./features/admin/ReportingAnalyticsPage').then((m) => ({ default: m.ReportingAnalyticsPage })),
);

// Fallback Loading Skeleton Component
const PageLoadingSkeleton: React.FC = () => (
  <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 space-y-4 animate-pulse">
    <div className="h-16 w-16 rounded-2xl bg-dark-900 border border-slate-800 flex items-center justify-center">
      <Wine className="h-8 w-8 text-brand-500 animate-spin" />
    </div>
    <p className="text-xs text-slate-400 font-semibold">Loading OrderUp PWA...</p>
  </div>
);

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-dark-950 via-dark-900 to-dark-950">
      <div className="glass-panel max-w-2xl p-8 space-y-6 border border-slate-800">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-amber-400">OrderUp</span>
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Production-Ready Progressive Web Application (PWA) for Kenya's restaurants, bars, hotels, lounges & entertainment venues. Real-time QR table ordering, waiter dispatch, M-Pesa STK Push, and multi-tenant analytics dashboards.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <Button size="lg" onClick={() => (window.location.href = '/v/alchemist-westlands')}>
            Customer QR Menu Demo
          </Button>
          <Button variant="secondary" size="lg" onClick={() => (window.location.href = '/order/track')}>
            Customer Order Tracker
          </Button>
          <Button variant="secondary" size="lg" onClick={() => (window.location.href = '/waiter/dashboard')}>
            Waiter Dashboard Demo
          </Button>
          <Button variant="secondary" size="lg" onClick={() => (window.location.href = '/kitchen')}>
            Kitchen KDS View Demo
          </Button>
          <Button variant="outline" size="lg" onClick={() => (window.location.href = '/admin/reports')}>
            BI & Export Reports
          </Button>
          <Button variant="outline" size="lg" onClick={() => (window.location.href = '/manager/dashboard')}>
            Manager Operations
          </Button>
          <Button variant="outline" size="lg" onClick={() => (window.location.href = '/manager/menu')}>
            Manager Menu Portal
          </Button>
          <Button variant="outline" size="lg" onClick={() => (window.location.href = '/admin/dashboard')}>
            Platform Admin Analytics
          </Button>
          <Button variant="outline" size="lg" onClick={() => (window.location.href = '/admin/clubs')}>
            Admin Club Management
          </Button>
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TenantProvider>
          <AuthProvider>
            <OfflineScreen>
              <Router>
                <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col font-sans">
                  <Navbar />
                  <main className="flex-1">
                    <Suspense fallback={<PageLoadingSkeleton />}>
                      <Routes>
                        {/* ── Public / Customer routes (no WebSocket needed) ── */}
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/v/:venueSlug" element={<QrMenuPage />} />
                        <Route path="/v/:venueSlug/t/:tableNum" element={<QrMenuPage />} />
                        <Route path="/order/track" element={<CustomerOrderStatusPage />} />

                        {/* ── Staff routes (WebSocket required for real-time updates) ── */}
                        <Route
                          path="/kitchen"
                          element={
                            <SocketProvider>
                              <KitchenDisplayPage />
                            </SocketProvider>
                          }
                        />
                        <Route
                          path="/waiter/dashboard"
                          element={
                            <SocketProvider>
                              <WaiterDashboardPage />
                            </SocketProvider>
                          }
                        />
                        <Route path="/manager/dashboard" element={<ManagerAnalyticsDashboardPage />} />
                        <Route path="/manager/menu" element={<ManagerMenuPage />} />
                        <Route path="/admin/reports" element={<ReportingAnalyticsPage />} />
                        <Route path="/admin/dashboard" element={<PlatformAdminDashboardPage />} />
                        <Route path="/admin/clubs" element={<ClubManagementPage />} />
                      </Routes>
                    </Suspense>
                  </main>
                  <InstallPromptBanner />
                </div>
              </Router>
            </OfflineScreen>
          </AuthProvider>
        </TenantProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
