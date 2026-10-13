import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Users,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Award,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  MapPin,
  RefreshCcw,
} from 'lucide-react';
import { apiClient } from '../../config/api';

interface RevenueTrendPoint {
  month: string;
  revenue: number;
  orders: number;
}

export const PlatformAdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);

  const fetchPlatformData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, analyticsRes, tenantsRes] = await Promise.allSettled([
        apiClient.get('/tenants/platform/stats'),
        apiClient.get('/reports/analytics?period=MONTHLY'),
        apiClient.get('/tenants'),
      ]);

      let hasSuccess = false;

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data?.data);
        hasSuccess = true;
      }
      if (analyticsRes.status === 'fulfilled') {
        const d = analyticsRes.value.data?.data;
        setAnalytics(d?.report || d);
        hasSuccess = true;
      }
      if (tenantsRes.status === 'fulfilled') {
        const d = tenantsRes.value.data?.data;
        setTenants(Array.isArray(d) ? d : d?.businesses || []);
        hasSuccess = true;
      }

      if (!hasSuccess && (statsRes.status === 'rejected' || tenantsRes.status === 'rejected')) {
        setError('Failed to load platform dashboard data. Please check your connection.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const totalBusinesses = stats?.totalBusinesses ?? tenants.length ?? 0;
  const activeBusinesses = stats?.activeBusinesses ?? tenants.filter((t) => t.isActive).length ?? 0;
  const suspendedBusinesses = stats?.suspendedBusinesses ?? tenants.filter((t) => !t.isActive).length ?? 0;
  const totalRevenue = stats?.totalRevenue ?? Number(analytics?.kpis?.totalRevenue || 0);
  const totalUsers = stats?.totalUsers ?? 0;
  const totalOrders = stats?.totalOrders ?? Number(analytics?.kpis?.totalOrders || 0);

  // Monthly Revenue Growth from actual database daily/monthly analytics
  const revenueTrend = useMemo<RevenueTrendPoint[]>(() => {
    if (Array.isArray(analytics?.dailyRevenue) && analytics.dailyRevenue.length > 0) {
      return analytics.dailyRevenue.slice(-7).map((d: any) => ({
        month: d.day ? d.day.slice(5) : d.date ? d.date.slice(5) : 'Day',
        revenue: Number(d.revenue || 0),
        orders: Number(d.orders || d.orderCount || d.count || 0),
      }));
    }
    return [
      { month: 'Wk 1', revenue: 0, orders: 0 },
      { month: 'Wk 2', revenue: 0, orders: 0 },
      { month: 'Wk 3', revenue: 0, orders: 0 },
      { month: 'Wk 4', revenue: 0, orders: 0 },
    ];
  }, [analytics]);

  const maxMonthlyRevenue = Math.max(...revenueTrend.map((d: RevenueTrendPoint) => d.revenue), 1);

  // Real County Distribution from loaded database tenants
  const countyDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    tenants.forEach((t) => {
      const c = t.county || t.city || 'Unspecified';
      map[c] = (map[c] || 0) + 1;
    });

    const entries = Object.entries(map);
    if (entries.length === 0) {
      return [{ county: 'No Venues Registered', count: 0, percent: 0 }];
    }

    const total = tenants.length || 1;
    return entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([county, count]) => ({
        county,
        count,
        percent: Math.round((count / total) * 100),
      }));
  }, [tenants]);

  return (
    <div className="min-h-screen bg-dark-950 p-6 space-y-8 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Super Admin Analytics</h1>
          <p className="text-xs text-slate-400">OrderUp SaaS Platform Telemetry & Multi-Tenant Database</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPlatformData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 transition"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="flex items-center space-x-2 rounded-full bg-brand-500/10 px-4 py-1.5 text-xs font-extrabold text-brand-400 border border-brand-500/30">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-ping" />
            <span>Database Live Feed</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-semibold text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchPlatformData}
            className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-500/30 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. METRIC STAT CARDS GRID */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="glass-panel p-5 space-y-2 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Total Businesses</span>
            <Building2 className="h-4 w-4 text-brand-400" />
          </div>
          <p className="text-2xl font-black text-white">{totalBusinesses}</p>
          <p className="text-[11px] text-emerald-400 font-bold flex items-center">
            {activeBusinesses} active registered
          </p>
        </div>

        <div className="glass-panel p-5 space-y-2 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Active Venues</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">{activeBusinesses} Active</p>
          <p className="text-[11px] text-slate-400">{suspendedBusinesses} Suspended</p>
        </div>

        <div className="glass-panel p-5 space-y-2 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Platform Revenue</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white">KES {totalRevenue.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-400 font-bold flex items-center">
            Gross database settled
          </p>
        </div>

        <div className="glass-panel p-5 space-y-2 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Total Users</span>
            <Users className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{totalUsers}</p>
          <p className="text-[11px] text-slate-400">
            {stats?.totalAdmins || 0} Admins · {stats?.totalManagers || 0} Mgrs · {stats?.totalWaiters || 0} Waiters
          </p>
        </div>

        <div className="glass-panel p-5 space-y-2 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-white">{totalOrders}</p>
          <p className="text-[11px] text-emerald-400 font-bold">Processed in database</p>
        </div>
      </div>

      {/* 2. CHARTS SECTION */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* CHART 1: MONTHLY REVENUE GROWTH */}
        <div className="glass-panel p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-white">Platform Revenue Trend</h3>
              <p className="text-xs text-slate-400">Aggregated database settlements & customer orders</p>
            </div>
            <BarChart3 className="h-5 w-5 text-brand-500" />
          </div>

          <div className="h-56 flex items-end justify-between space-x-3 pt-6 px-2">
            {revenueTrend.map((d: RevenueTrendPoint, i: number) => {
              const heightPercent = d.revenue > 0 ? Math.max(10, (d.revenue / maxMonthlyRevenue) * 100) : 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center space-y-2 group">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-dark-900 text-brand-400 text-[10px] font-bold py-1 px-2 rounded border border-slate-800">
                    KES {d.revenue.toLocaleString()}
                  </div>
                  <div className="w-full bg-dark-900 rounded-t-xl overflow-hidden h-40 flex items-end">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-gradient-to-t from-brand-600 to-amber-400 rounded-t-xl transition-all duration-500 group-hover:from-brand-500 group-hover:to-amber-300"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHART 2: SUBSCRIPTION DISTRIBUTION */}
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-extrabold text-white">Subscription Status</h3>
            <PieIcon className="h-5 w-5 text-amber-400" />
          </div>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-tr from-brand-500 via-emerald-500 to-amber-500 p-4 shadow-xl">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-dark-950 text-center">
                <span className="text-2xl font-black text-white">{totalBusinesses}</span>
                <span className="text-[10px] text-slate-400">Total Venues</span>
              </div>
            </div>

            <div className="w-full space-y-2 text-xs">
              <div className="flex justify-between items-center bg-dark-900 p-2 rounded-lg border border-slate-800">
                <span className="flex items-center font-bold text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 mr-2" /> Active
                </span>
                <span className="font-extrabold text-white">
                  {activeBusinesses} ({totalBusinesses > 0 ? Math.round((activeBusinesses / totalBusinesses) * 100) : 0}%)
                </span>
              </div>

              <div className="flex justify-between items-center bg-dark-900 p-2 rounded-lg border border-slate-800">
                <span className="flex items-center font-bold text-red-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 mr-2" /> Suspended
                </span>
                <span className="font-extrabold text-white">
                  {suspendedBusinesses} ({totalBusinesses > 0 ? Math.round((suspendedBusinesses / totalBusinesses) * 100) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CLUBS BY COUNTY REGIONAL BREAKDOWN */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-brand-500" />
            <h3 className="text-base font-extrabold text-white">Venues Distribution by Kenyan County</h3>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          {countyDistribution.map((c) => (
            <div key={c.county} className="rounded-xl bg-dark-900 p-4 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-300">{c.county} County</span>
              <p className="text-xl font-black text-brand-400">{c.count} Venues</p>
              <div className="w-full bg-dark-950 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${c.percent}%` }} className="bg-brand-500 h-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
