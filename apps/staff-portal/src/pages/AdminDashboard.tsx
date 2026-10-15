import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ThemeToggle, useTheme } from '@orderup/ui';
import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardList,
  TrendingUp,
  CreditCard,
  Award,
  FileText,
  Settings,
  User,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  RefreshCcw,
  Filter,
  AlertCircle,
  ArrowUpRight,
  RotateCcw,
  Key,
  UserX,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Clock,
  Briefcase,
  Shield,
  ShieldCheck,
  QrCode,
  Copy,
  ExternalLink,
  DollarSign,
  ShoppingBag,
  TrendingDown,
  Check,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  HelpCircle,
  Lock,
  Menu,
  LayoutGrid,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { getApiUrl, resolveImageUrl } from '../config/api';
import { validateStrongPassword, STRONG_PASSWORD_MESSAGE, generateStrongPassword } from '@orderup/shared';
import { PrivacyPolicyModal, TermsAndConditionsModal, BusinessAdminOnboardingModal } from '../components/LegalModals';

/* ─────────────────────────────────────────────────────────────
   TYPES & INTERFACES
───────────────────────────────────────────────────────────── */
export type AdminNavKey =
  | 'dashboard'
  | 'users'
  | 'orders'
  | 'sales'
  | 'staff'
  | 'reports'
  | 'settings'
  | 'profile'
  | 'auditlogs';

export interface BusinessDetails {
  businessUuid: string;
  name: string;
  slug: string;
  businessType: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  county?: string;
  openingHours?: string;
  closingHours?: string;
  brandColor?: string;
  themeColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  status: string;
  subscriptionStatus?: string;
  mpesaShortcode?: string;
  mpesaPasskey?: string;
  mpesaTransactionType?: string;
  isMpesaActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSummaryData {
  business: BusinessDetails;
  managersCount: number;
  waitersCount: number;
  tablesCount: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}

export interface ManagerUser {
  userUuid: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  isOnline?: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface OrderItemData {
  orderItemUuid: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  product?: {
    name: string;
    category?: { name: string };
  };
}

export interface OrderData {
  orderUuid: string;
  orderNumber: string;
  businessUuid: string;
  tableUuid?: string;
  table?: { tableNumber: number; sectionName: string };
  tableNumber?: number | string;
  notes?: string;
  waiterUuid?: string;
  waiter?: { fullName: string; email: string };
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  payments?: Array<{ paymentMethod: string; paymentStatus: string; amount?: number }>;
  totalAmount: number;
  orderItems: OrderItemData[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentData {
  paymentUuid: string;
  businessUuid: string;
  orderUuid: string;
  order?: {
    orderNumber?: string;
    table?: { tableNumber: number; sectionName: string };
    waiter?: { fullName: string; email: string };
  };
  amount: number;
  paymentMethod: string;
  paymentStatus: string;
  phoneNumber?: string;
  mpesaReceiptNumber?: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  createdAt: string;
}

export interface AnalyticsReportData {
  period: string;
  generatedAt: string;
  kpis: {
    totalRevenue: number;
    totalOrders: number;
    completedOrders: number;
    cancelledOrders?: number;
    averageOrderValue: number;
    activeWaitersCount: number;
  };
  dailyRevenue: Array<{ day: string; date: string; revenue: number }>;
  hourlyOrders: Array<{ hour: number; h?: number; count: number; n?: number }>;
  paymentBreakdown: {
    mpesa: { count: number; percentage: number };
    card: { count: number; percentage: number };
    cash: { count: number; percentage: number };
  };
  topProducts: Array<{
    name: string;
    category: string;
    unitsSold: number;
    revenue: number;
  }>;
  waiterPerformance: Array<{
    name: string;
    ordersServed: number;
    revenueGenerated: number;
    avgFulfillmentMins: number;
  }>;
}

/* ─────────────────────────────────────────────────────────────
   ADMIN DASHBOARD OVERVIEW — DEDICATED ENDPOINT TYPES
   GET /api/v1/dashboard/admin/overview
   Business scope resolved server-side from JWT. No businessId from client.
───────────────────────────────────────────────────────────── */
export interface DashboardTrend {
  today: number;
  previousDay: number;
  /** null when previousDay = 0. Avoids Infinity/NaN. Frontend shows "—" or "New". */
  percentageChange: number | null;
}

export interface DashboardRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentStatus: string | null;
  paymentMethod: string | null;
  tableNumber: number | null;
  sectionName: string | null;
  createdAt: string;
}

export interface DashboardTopMenuItem {
  itemId: string;
  name: string;
  category: string;
  quantitySold: number;
  revenueGenerated: number;
}

export interface DashboardSalesTrendDay {
  date: string;
  dayLabel: string;
  revenue: number;
  orders: number;
}

export interface AdminDashboardOverview {
  business: {
    id: string;
    name: string;
    type: string;
    slug: string;
    city: string;
    county: string;
    status: string;
  };
  summary: {
    todayRevenue: number;
    todayOrders: number;
    pendingOrders: number;
    inProgressOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalManagers: number;
    totalWaiters: number;
  };
  revenue: DashboardTrend;
  orders: DashboardTrend;
  recentOrders: DashboardRecentOrder[];
  topMenuItems: DashboardTopMenuItem[];
  salesTrend: DashboardSalesTrendDay[];
  tableUtilization?: {
    activeTables: number;
    tablesUsedToday: number;
    utilizationRate: number;
  };
  pendingOrderAge?: {
    totalPending: number;
    oldestAgeMinutes: number;
    ordersOver5Min: number;
    ordersOver10Min: number;
  };
}


/* ─────────────────────────────────────────────────────────────
   HELPERS & TOAST COMPONENT
───────────────────────────────────────────────────────────── */
const Toast = ({
  msg,
  type = 'success',
  onDone,
}: {
  msg: string;
  type?: 'success' | 'error';
  onDone: () => void;
}) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed bottom-6 right-6 z-[999] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl transition-all duration-300"
      style={{
        background: type === 'success' ? '#0F172A' : '#7F1D1D',
        border: '1px solid rgba(255,255,255,0.1)',
        minWidth: 280,
      }}
    >
      {type === 'success' ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
      )}
      <span>{msg}</span>
    </div>
  );
};

const Modal = ({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;
  const maxW =
    size === 'sm'
      ? 'max-w-sm'
      : size === 'lg'
      ? 'max-w-2xl'
      : size === 'xl'
      ? 'max-w-4xl'
      : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxW} rounded-2xl p-6 shadow-2xl mx-auto my-8 max-h-[90vh] overflow-y-auto`}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-500/10 transition-colors"
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = (status || '').toUpperCase();
  let bg = 'bg-slate-100 text-slate-700 border-slate-200';
  if (s === 'ACTIVE' || s === 'COMPLETED' || s === 'PAID' || s === 'DELIVERED') {
    bg = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
  } else if (s === 'PENDING' || s === 'TRIAL' || s === 'CLAIMED' || s === 'PREPARING') {
    bg = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  } else if (s === 'SUSPENDED' || s === 'CANCELLED' || s === 'FAILED' || s === 'INACTIVE') {
    bg = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${bg}`}>
      {s}
    </span>
  );
};

/* ─────────────────────────────────────────────────────────────
   AUTHENTICATED API HELPER WITH AUTO REFRESH
───────────────────────────────────────────────────────────── */
let refreshPromise: Promise<string | null> | null = null;

const doRefreshToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('orderup_refresh_token') || localStorage.getItem('drinkhub_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(getApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.data?.accessToken) {
      localStorage.setItem('orderup_token', data.data.accessToken);
      if (data.data.refreshToken) {
        localStorage.setItem('orderup_refresh_token', data.data.refreshToken);
      }
      return data.data.accessToken as string;
    }
  } catch {
    // refresh failed
  }
  return null;
};

const authFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  let token = localStorage.getItem('orderup_token') || localStorage.getItem('drinkhub_token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const buildHeaders = (authToken: string | null) => ({
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  });

  let res = await fetch(getApiUrl(endpoint), { ...options, headers: buildHeaders(token) });

  // If 401 Unauthorized, attempt automatic token refresh and retry
  if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (!refreshPromise) {
      refreshPromise = doRefreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      res = await fetch(getApiUrl(endpoint), { ...options, headers: buildHeaders(newToken) });
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
};

/* ─────────────────────────────────────────────────────────────
   MAIN ADMIN DASHBOARD COMPONENT
───────────────────────────────────────────────────────────── */
export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { applyClubBranding } = useTheme();
  const [page, setPage] = useState<AdminNavKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  }, []);

  /* Auth User Data */
  const user = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem('orderup_user') ||
        localStorage.getItem('drinkhub_user') ||
        '{}'
      );
    } catch {
      return {};
    }
  }, []);

  /* Compliance & Onboarding State */
  const userKey = useMemo(() => {
    return user.userUuid || user.id || user.email || 'admin';
  }, [user]);

  const [policyAccepted, setPolicyAccepted] = useState<boolean>(() => {
    try {
      const key = user.userUuid || user.id || user.email || 'admin';
      return !!(
        localStorage.getItem('orderup_policy_accepted_' + key) ||
        localStorage.getItem('drinkhub_policy_accepted_' + key)
      );
    } catch {
      return false;
    }
  });

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleAcceptPolicy = useCallback(() => {
    try {
      const key = user.userUuid || user.id || user.email || 'admin';
      localStorage.setItem('orderup_policy_accepted_' + key, new Date().toISOString());
      setPolicyAccepted(true);
      showToast('Compliance agreements accepted. Welcome to your Business Dashboard!', 'success');
    } catch {
      setPolicyAccepted(true);
    }
  }, [user, showToast]);

  /* State stores */
  const [businessSummary, setBusinessSummary] = useState<BusinessSummaryData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsReportData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  /* Admin Dashboard Overview — dedicated endpoint state */
  const [overview, setOverview] = useState<AdminDashboardOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  /* Admin Waiter Performance KPI */
  const [adminWaiters, setAdminWaiters] = useState<any[]>([]);
  const [adminWaitersLoading, setAdminWaitersLoading] = useState(false);

  /* Reports & Analytics — Feature 6 state */
  type ReportRangeType =
    | 'TODAY'
    | 'YESTERDAY'
    | 'LAST_7_DAYS'
    | 'LAST_30_DAYS'
    | 'THIS_WEEK'
    | 'LAST_WEEK'
    | 'THIS_MONTH'
    | 'LAST_MONTH'
    | 'CUSTOM';
  const [reportRange, setReportRange] = useState<ReportRangeType>('LAST_7_DAYS');
  const [reportCustomStart, setReportCustomStart] = useState('');
  const [reportCustomEnd, setReportCustomEnd] = useState('');
  const [reportTab, setReportTab] = useState<
    'overview' | 'revenue' | 'orders' | 'payments' | 'products' | 'users'
  >('overview');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  /* ── Audit Logs state ── */
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsSearch, setAuditLogsSearch] = useState('');
  const [auditLogsRoleFilter, setAuditLogsRoleFilter] = useState<'ALL' | 'ADMIN' | 'MANAGER' | 'WAITER' | 'SYSTEM'>('ALL');
  const [auditLogsActionFilter, setAuditLogsActionFilter] = useState<string>('ALL');

  /* Modal state */
  const [createManagerOpen, setCreateManagerOpen] = useState(false);
  const [editBusinessOpen, setEditBusinessOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);

  /* ── State for business profile, branding & settings ── */
  const [businessProfile, setBusinessProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Form states: Profile
  const [profName, setProfName] = useState('');
  const [profDescription, setProfDescription] = useState('');
  const [profEmail, setProfEmail] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profCity, setProfCity] = useState('Nairobi');
  const [profCounty, setProfCounty] = useState('Nairobi');
  const [profCountry, setProfCountry] = useState('Kenya');
  const [profileSaving, setProfileSaving] = useState(false);

  // Form states: Branding
  const [brandThemeColor, setBrandThemeColor] = useState('#2563EB');
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  // Form states: Regional
  const [settingTimezone, setSettingTimezone] = useState('Africa/Nairobi');
  const [settingCurrency, setSettingCurrency] = useState('KES');
  const [settingOpening, setSettingOpening] = useState('08:00');
  const [settingClosing, setSettingClosing] = useState('23:00');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Form states: 7-Day Operating Schedule
  const defaultSchedule = {
    monday: { isOpen: true, openingTime: '08:00', closingTime: '23:00', crossesMidnight: false },
    tuesday: { isOpen: true, openingTime: '08:00', closingTime: '23:00', crossesMidnight: false },
    wednesday: { isOpen: true, openingTime: '08:00', closingTime: '23:00', crossesMidnight: false },
    thursday: { isOpen: true, openingTime: '08:00', closingTime: '23:00', crossesMidnight: false },
    friday: { isOpen: true, openingTime: '08:00', closingTime: '02:00', crossesMidnight: true },
    saturday: { isOpen: true, openingTime: '08:00', closingTime: '02:00', crossesMidnight: true },
    sunday: { isOpen: true, openingTime: '08:00', closingTime: '23:00', crossesMidnight: false },
  };
  const [operatingSchedule, setOperatingSchedule] = useState<any>(defaultSchedule);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Active settings sub-tab
  const [settingsTab, setSettingsTab] = useState<'profile' | 'branding' | 'hours' | 'compliance'>('profile');

  /**
   * Load business profile from GET /api/v1/business/profile
   */
  const loadBusinessProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await authFetch('/business/profile');
      if (res.success && res.data?.profile) {
        const p = res.data.profile;
        setBusinessProfile(p);
        setProfName(p.name || '');
        setProfDescription(p.description || '');
        setProfEmail(p.email || '');
        setProfPhone(p.phone || '');
        setProfAddress(p.address || '');
        setProfCity(p.city || 'Nairobi');
        setProfCounty(p.county || 'Nairobi');
        setProfCountry(p.country || 'Kenya');
        if (p.themeColor) setBrandThemeColor(p.themeColor);
        if (p.logoUrl) {
          setBrandLogoUrl(p.logoUrl);
          setLogoPreviewError(false);
          setLogoError(false);
        }
        setSettingTimezone(p.timezone || 'Africa/Nairobi');
        setSettingCurrency(p.currency || 'KES');
        setSettingOpening(p.openingHours || '08:00');
        setSettingClosing(p.closingHours || '23:00');
        if (p.operatingSchedule) {
          setOperatingSchedule(p.operatingSchedule);
        }
      } else {
        setProfileError(res.error?.message || 'Failed to load business profile');
      }
    } catch (err: any) {
      setProfileError(err.message || 'Failed to load business profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  /* Users Management View State */
  const [userSubTab, setUserSubTab] = useState<'all' | 'managers' | 'waiters'>('all');
  const [allUsersSearch, setAllUsersSearch] = useState('');

  /* Filters */
  const [managerSearch, setManagerSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');

  /* ─────────────────────────────────────────────────────────────
     DASHBOARD OVERVIEW — Dedicated secure endpoint
     GET /api/v1/dashboard/admin/overview
     Business scope is resolved server-side from the JWT.
     No businessId is sent from the frontend.
  ───────────────────────────────────────────────────────────── */
  const loadOverviewData = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await authFetch('/dashboard/admin/overview');
      if (res.success && res.data) {
        setOverview(res.data as AdminDashboardOverview);
      } else {
        setOverviewError(res.error?.message || 'Failed to load dashboard overview.');
      }
    } catch (err: any) {
      setOverviewError(err.message || 'Failed to load dashboard overview. Please try again.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadAdminWaiters = useCallback(async () => {
    setAdminWaitersLoading(true);
    try {
      const res = await authFetch('/reports/admin/waiters?range=LAST_7_DAYS');
      if (res.success && res.data?.waiters) {
        setAdminWaiters(res.data.waiters);
      }
    } catch { /* silent */ } finally {
      setAdminWaitersLoading(false);
    }
  }, []);

  /* Fetch all core business data */

  const loadDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [bizRes, analyticsRes, staffRes, ordersRes, paymentsRes] = await Promise.allSettled([
        authFetch('/tenants/current'),
        authFetch(`/reports/analytics?period=${analyticsPeriod}`),
        authFetch('/auth/staff'),
        authFetch('/orders'),
        authFetch('/payments'),
      ]);

      if (bizRes.status === 'fulfilled' && bizRes.value.success) {
        setBusinessSummary(bizRes.value.data);
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.success) {
        setAnalytics(analyticsRes.value.data);
      }
      if (staffRes.status === 'fulfilled' && staffRes.value.success) {
        const rawStaff = staffRes.value.data?.staff ?? staffRes.value.data ?? [];
        const staff = Array.isArray(rawStaff) ? rawStaff : [];
        setStaffList(staff);
        setManagers(staff.filter((s: any) => s.role === 'MANAGER'));
      }
      if (ordersRes.status === 'fulfilled' && ordersRes.value.success) {
        const rawOrders = ordersRes.value.data?.orders ?? ordersRes.value.data ?? [];
        setOrders(Array.isArray(rawOrders) ? rawOrders : []);
      }
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value.success) {
        const rawPayments = paymentsRes.value.data?.payments ?? paymentsRes.value.data ?? [];
        setPayments(Array.isArray(rawPayments) ? rawPayments : []);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load business data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [analyticsPeriod, showToast]);

  useEffect(() => {
    loadBusinessProfile();
  }, [loadBusinessProfile]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadOverviewData();
    loadAdminWaiters();
  }, [loadOverviewData, loadAdminWaiters]);

  const loadAuditLogsData = useCallback(async () => {
    setAuditLogsLoading(true);
    try {
      const res = await authFetch('/notifications/audit-logs');
      const raw = res?.data ?? [];
      setAuditLogs(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setAuditLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (page === 'auditlogs') {
      loadAuditLogsData();
    }
  }, [page, loadAuditLogsData]);

  /* Formatters & Brand Identity */
  const formatKsh = (amount: number) => `KSh ${Number(amount || 0).toLocaleString('en-KE')}`;
  const getOrderTableDisplay = (o: any): string => {
    const num = o?.table?.tableNumber ?? o?.tableNumber;
    if (num !== undefined && num !== null && num !== '' && !isNaN(Number(num))) {
      return `Table ${num}`;
    }
    if (typeof o?.table === 'number') {
      return `Table ${o.table}`;
    }
    if (typeof o?.table === 'string' && o.table.trim() && o.table !== '-' && o.table.toLowerCase() !== 'takeaway') {
      return o.table.toLowerCase().startsWith('table') ? o.table : `Table ${o.table}`;
    }
    if (o?.notes) {
      const match = String(o.notes).match(/table\s*(?:#|no\.?|num\.?)?\s*(\d+)/i);
      if (match) return `Table ${match[1]}`;
    }
    return 'Takeaway';
  };

  const getOrderPaymentMethodRaw = (o: any): string => {
    let method = o?.paymentMethod || o?.payments?.[0]?.paymentMethod;
    if (!method && o?.notes) {
      const match = String(o.notes).match(/payment:\s*(mpesa_stk|mpesa|card|cash)/i);
      if (match) {
        const m = match[1].toUpperCase();
        method = m === 'MPESA' ? 'MPESA_STK' : m;
      }
    }
    return method || 'MPESA_STK';
  };

  const getOrderPaymentMethodDisplay = (o: any): string => {
    const raw = getOrderPaymentMethodRaw(o);
    const m = String(raw).toUpperCase();
    if (m === 'MPESA_STK' || m === 'MPESA') return 'M-Pesa';
    if (m === 'CARD') return 'Card';
    if (m === 'CASH') return 'Cash';
    return raw.replace('_', ' ');
  };
  const businessName = profName || businessProfile?.name || businessSummary?.business?.name || overview?.business?.name || user.club?.name || user.business?.name || 'My Business';
  const businessType = businessProfile?.businessType || businessSummary?.business?.businessType || overview?.business?.type || user.business?.businessType || 'RESTAURANT';
  const currentLogoUrl = brandLogoUrl || businessProfile?.logoUrl || businessSummary?.business?.logoUrl || (overview?.business as any)?.logoUrl || (user.business as any)?.logoUrl || (user.club as any)?.logoUrl || null;
  const currentThemeColor = brandThemeColor || businessProfile?.themeColor || businessSummary?.business?.themeColor || (user.business as any)?.themeColor || '#2563EB';

  useEffect(() => {
    setLogoError(false);
  }, [currentLogoUrl]);

  useEffect(() => {
    setLogoPreviewError(false);
  }, [brandLogoUrl]);

  useEffect(() => {
    if (currentThemeColor) {
      document.documentElement.style.setProperty('--brand-primary', currentThemeColor);
      document.documentElement.style.setProperty('--primary', currentThemeColor);
      document.documentElement.style.setProperty('--club-primary', currentThemeColor);
      applyClubBranding({
        primaryColor: currentThemeColor,
        name: businessName,
      });
    }
  }, [currentThemeColor, businessName, applyClubBranding]);

  /* ─────────────────────────────────────────────────────────────
     NAVIGATION MENU CONFIGURATION
  ───────────────────────────────────────────────────────────── */
  const NAV_ITEMS: { key: AdminNavKey; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { key: 'orders', label: 'Orders', icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'sales', label: 'Sales & Revenue', icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'staff', label: 'Staff Performance', icon: <Award className="h-4 w-4" /> },
    { key: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" /> },
    { key: 'auditlogs', label: 'Audit Logs', icon: <Shield className="h-4 w-4" /> },
    { key: 'settings', label: 'Business Settings', icon: <Settings className="h-4 w-4" /> },
    { key: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  ];

  /* ─────────────────────────────────────────────────────────────
     FEATURE 1: DASHBOARD OVERVIEW VIEW
     Powered by GET /api/v1/dashboard/admin/overview
     Strictly tenant-isolated: all queries scoped server-side to the authenticated ADMIN's business.
  ───────────────────────────────────────────────────────────── */
  const renderDashboardView = () => {
    // ── Loading Skeleton State ──
    if (overviewLoading && !overview) {
      return (
        <div className="space-y-6 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-6 w-56 rounded-lg bg-slate-500/20" />
              <div className="h-4 w-72 rounded-lg bg-slate-500/10" />
            </div>
            <div className="h-9 w-28 rounded-xl bg-slate-500/20" />
          </div>

          {/* KPI Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="h-4 w-12 rounded bg-slate-500/20 mb-3" />
                <div className="h-7 w-20 rounded bg-slate-500/30 mb-2" />
                <div className="h-3 w-16 rounded bg-slate-500/10" />
              </div>
            ))}
          </div>

          {/* Charts & Lists Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div
              className="lg:col-span-2 h-72 rounded-2xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="h-5 w-40 rounded bg-slate-500/20 mb-4" />
              <div className="h-52 w-full rounded bg-slate-500/10" />
            </div>
            <div
              className="h-72 rounded-2xl border p-5"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="h-5 w-32 rounded bg-slate-500/20 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-10 w-full rounded-xl bg-slate-500/10" />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ── Error State ──
    if (overviewError && !overview) {
      const isAuthError =
        overviewError.toLowerCase().includes('token') ||
        overviewError.toLowerCase().includes('unauthorized') ||
        overviewError.toLowerCase().includes('log in') ||
        overviewError.toLowerCase().includes('session') ||
        overviewError.toLowerCase().includes('401');

      return (
        <div
          className="p-8 rounded-2xl border text-center my-6 flex flex-col items-center justify-center max-w-lg mx-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-black mb-1" style={{ color: 'var(--text-primary)' }}>
            Failed to Load Dashboard
          </h3>
          <p className="text-xs text-slate-500 mb-6 max-w-sm">
            {overviewError}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadOverviewData();
                loadDashboardData();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry Connection
            </button>
            {isAuthError && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign In Again
              </button>
            )}
          </div>
        </div>
      );
    }

    const currentBizName = overview?.business?.name || businessName;
    const currentBizType = overview?.business?.type || businessType;

    // Live database metrics calculation to ensure actual database data is displayed
    const dbTotalRevenue =
      orders
        .filter((o) => o.paymentStatus === 'PAID')
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) ||
      payments
        .filter((p) => p.paymentStatus === 'PAID' || p.paymentStatus === 'COMPLETED')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) ||
      businessSummary?.totalRevenue ||
      0;

    const dbPendingOrders = orders.filter((o) => o.status === 'PENDING').length;
    const dbInProgressOrders = orders.filter((o) => o.status === 'CLAIMED' || o.status === 'PREPARING' || o.status === 'READY').length;
    const dbCompletedOrders = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length || businessSummary?.completedOrders || 0;
    const dbCancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;
    const dbTotalOrders = orders.length || businessSummary?.totalOrders || 0;

    const dbManagersCount =
      (Array.isArray(managers) ? managers : []).length ||
      (Array.isArray(staffList) ? staffList.filter((s: any) => s.role === 'MANAGER').length : 0) ||
      businessSummary?.managersCount ||
      0;

    const dbWaitersCount =
      (Array.isArray(staffList) ? staffList.filter((s: any) => s.role === 'WAITER').length : 0) ||
      businessSummary?.waitersCount ||
      0;

    const summary = {
      todayRevenue: overview?.summary?.todayRevenue || dbTotalRevenue,
      todayOrders: overview?.summary?.todayOrders || dbTotalOrders,
      pendingOrders: overview?.summary?.pendingOrders ?? dbPendingOrders,
      inProgressOrders: overview?.summary?.inProgressOrders ?? dbInProgressOrders,
      completedOrders: overview?.summary?.completedOrders ?? dbCompletedOrders,
      cancelledOrders: overview?.summary?.cancelledOrders ?? dbCancelledOrders,
      totalManagers: overview?.summary?.totalManagers || dbManagersCount,
      totalWaiters: overview?.summary?.totalWaiters || dbWaitersCount,
    };

    const revTrend = overview?.revenue;
    const ordTrend = overview?.orders;

    // Top menu items from overview or derived from database orders
    const topMenuItemsList =
      overview?.topMenuItems && overview.topMenuItems.length > 0
        ? overview.topMenuItems
        : (() => {
            const itemMap: Record<string, { itemId: string; name: string; category: string; quantitySold: number; revenueGenerated: number }> = {};
            orders.forEach((o) => {
              (o.orderItems || []).forEach((item) => {
                const name = item.productName || item.product?.name || 'Item';
                if (!itemMap[name]) {
                  itemMap[name] = {
                    itemId: item.orderItemUuid || name,
                    name,
                    category: item.product?.category?.name || 'Menu',
                    quantitySold: 0,
                    revenueGenerated: 0,
                  };
                }
                itemMap[name].quantitySold += item.quantity || 1;
                itemMap[name].revenueGenerated += Number(item.subtotal || (item.unitPrice * (item.quantity || 1)) || 0);
              });
            });
            return Object.values(itemMap)
              .sort((a, b) => b.quantitySold - a.quantitySold)
              .slice(0, 5);
          })();

    const chartTrendData = overview?.salesTrend && overview.salesTrend.some((d) => d.revenue > 0 || d.orders > 0)
      ? overview.salesTrend.map((d) => ({
          day: d.dayLabel,
          date: d.date,
          revenue: d.revenue,
          orders: d.orders,
        }))
      : (() => {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayMap: Record<string, { day: string; date: string; revenue: number; orders: number }> = {
            Mon: { day: 'Mon', date: '', revenue: 0, orders: 0 },
            Tue: { day: 'Tue', date: '', revenue: 0, orders: 0 },
            Wed: { day: 'Wed', date: '', revenue: 0, orders: 0 },
            Thu: { day: 'Thu', date: '', revenue: 0, orders: 0 },
            Fri: { day: 'Fri', date: '', revenue: 0, orders: 0 },
            Sat: { day: 'Sat', date: '', revenue: 0, orders: 0 },
            Sun: { day: 'Sun', date: '', revenue: 0, orders: 0 },
          };
          orders.forEach((o) => {
            if (o.createdAt) {
              const d = days[new Date(o.createdAt).getDay()];
              if (dayMap[d]) {
                dayMap[d].orders += 1;
                if (o.paymentStatus === 'PAID' || o.status === 'COMPLETED' || o.status === 'DELIVERED') {
                  dayMap[d].revenue += Number(o.totalAmount || 0);
                }
              }
            }
          });
          return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((k) => dayMap[k]);
        })();

    // Status distribution percentages
    const totalStatusOrders =
      summary.pendingOrders +
      summary.inProgressOrders +
      summary.completedOrders +
      summary.cancelledOrders;

    const pendingPct = totalStatusOrders > 0 ? Math.round((summary.pendingOrders / totalStatusOrders) * 100) : 0;
    const inProgressPct = totalStatusOrders > 0 ? Math.round((summary.inProgressOrders / totalStatusOrders) * 100) : 0;
    const completedPct = totalStatusOrders > 0 ? Math.round((summary.completedOrders / totalStatusOrders) * 100) : 0;
    const cancelledPct = totalStatusOrders > 0 ? Math.round((summary.cancelledOrders / totalStatusOrders) * 100) : 0;

    // Derived KPI metrics
    const cancelRate = totalStatusOrders > 0
      ? Math.round((summary.cancelledOrders / totalStatusOrders) * 1000) / 10
      : 0;
    const avgOrderValue = summary.completedOrders > 0
      ? Math.round(summary.todayRevenue / summary.completedOrders)
      : 0;
    const tableUtil = overview?.tableUtilization;
    const pendingAge = overview?.pendingOrderAge;

    return (
      <div className="space-y-6">
        {/* ── Top Header & Live Status ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                Business Performance Dashboard
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {currentBizType}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Real-time operational metrics for <span className="font-bold text-blue-600">{currentBizName}</span>
              {overview?.business?.city ? ` • ${overview.business.city}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadOverviewData();
                loadDashboardData();
                loadAdminWaiters();
              }}
              disabled={overviewLoading || refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-500/10 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${overviewLoading || refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Summary KPI Cards (Consolidated 4 Cards) ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Today's Key Performance Indicators
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold">
              Live UTC Day Scope
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Today Revenue */}
            <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Today's Revenue</span>
                  <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                  </div>
                </div>
                <div className="my-2.5">
                  <div className="text-2xl font-black text-emerald-600 truncate">
                    {formatKsh(summary.todayRevenue)}
                  </div>
                </div>
              </div>
              <div className="pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
                {revTrend?.percentageChange !== null && revTrend?.percentageChange !== undefined ? (
                  <span className={`text-[11px] font-bold ${revTrend.percentageChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {revTrend.percentageChange >= 0 ? '+' : ''}{revTrend.percentageChange}% vs yesterday
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Settled (PAID)</span>
                )}
                <span className="text-[10px] text-slate-400 font-medium">Real-time</span>
              </div>
            </div>

            {/* 2. Consolidated Orders KPI (Pending, In Progress, Completed) */}
            <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Orders & Fulfillment</span>
                  <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-blue-500" />
                  </div>
                </div>

                <div className="my-2 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                      {summary.todayOrders}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">orders today</span>
                  </div>
                  {ordTrend?.percentageChange !== null && ordTrend?.percentageChange !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ordTrend.percentageChange >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'}`}>
                      {ordTrend.percentageChange >= 0 ? '+' : ''}{ordTrend.percentageChange}% vs yday
                    </span>
                  )}
                </div>

                {/* Order Status Stats — Pending / Active / Done */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 truncate">
                      <Clock className="h-3 w-3 text-amber-500 shrink-0" /> Pending
                    </span>
                    <span className="text-sm font-black text-amber-600 dark:text-amber-300 leading-none">{summary.pendingOrders}</span>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1 truncate">
                      <Sliders className="h-3 w-3 text-indigo-500 shrink-0" /> Active
                    </span>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-300 leading-none">{summary.inProgressOrders}</span>
                  </div>

                  <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 truncate">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> Done
                    </span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-300 leading-none">{summary.completedOrders}</span>
                  </div>
                </div>
              </div>

              {/* Mini Segmented Progress Bar */}
              <div className="mt-3">
                <div className="h-1.5 w-full bg-slate-500/10 rounded-full overflow-hidden flex">
                  {totalStatusOrders === 0 ? (
                    <div className="h-full w-full bg-slate-500/20" />
                  ) : (
                    <>
                      <div style={{ width: `${pendingPct}%` }} className="bg-amber-500 transition-all duration-300" title={`Pending: ${summary.pendingOrders} (${pendingPct}%)`} />
                      <div style={{ width: `${inProgressPct}%` }} className="bg-indigo-500 transition-all duration-300" title={`In Progress: ${summary.inProgressOrders} (${inProgressPct}%)`} />
                      <div style={{ width: `${completedPct}%` }} className="bg-emerald-500 transition-all duration-300" title={`Completed: ${summary.completedOrders} (${completedPct}%)`} />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Managers */}
            <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Managers</span>
                  <div className="h-8 w-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-sky-500" />
                  </div>
                </div>
                <div className="my-2.5">
                  <div className="text-2xl font-black text-sky-600">
                    {summary.totalManagers}
                  </div>
                </div>
              </div>
              <div className="pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">Active staff</span>
                <span className="text-[10px] text-slate-400 font-medium">Operations</span>
              </div>
            </div>

            {/* 4. Waiters */}
            <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Waiters</span>
                  <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center">
                    <Award className="h-4 w-4 text-purple-500" />
                  </div>
                </div>
                <div className="my-2.5">
                  <div className="text-2xl font-black text-purple-600">
                    {summary.totalWaiters}
                  </div>
                </div>
              </div>
              <div className="pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">Active floor</span>
                <span className="text-[10px] text-slate-400 font-medium">Service</span>
              </div>
            </div>

            {/* 5. Total Orders (All-Time) */}
            <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total Orders</span>
                  <div className="h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center">
                    <ClipboardList className="h-4 w-4 text-orange-500" />
                  </div>
                </div>
                <div className="my-2.5">
                  <div className="text-2xl font-black text-orange-600">
                    {businessSummary?.totalOrders ?? dbTotalOrders}
                  </div>
                </div>
              </div>
              <div className="pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold">All-time orders</span>
                <span className="text-[10px] text-slate-400 font-medium">Lifetime</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Order Status Overview Progress Bar ── */}
        <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Today's Order Distribution ({totalStatusOrders} Total)
            </h4>
            <div className="flex items-center gap-4 text-[11px] flex-wrap font-semibold">
              <span className="flex items-center gap-1.5 text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Pending: {summary.pendingOrders} ({pendingPct}%)
              </span>
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                In Progress: {summary.inProgressOrders} ({inProgressPct}%)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Completed: {summary.completedOrders} ({completedPct}%)
              </span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="h-2.5 w-full bg-slate-500/10 rounded-full overflow-hidden flex">
            {totalStatusOrders === 0 ? (
              <div className="h-full w-full bg-slate-500/20" />
            ) : (
              <>
                <div style={{ width: `${pendingPct}%` }} className="bg-amber-500 transition-all duration-500" />
                <div style={{ width: `${inProgressPct}%` }} className="bg-indigo-500 transition-all duration-500" />
                <div style={{ width: `${completedPct}%` }} className="bg-emerald-500 transition-all duration-500" />
              </>
            )}
          </div>
        </div>

        {/* ── Additional KPI Row: Avg Order Value, Table Utilization, Pending Alert ── */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Avg Order Value */}
          <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Avg Order Value</span>
                <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-2xl font-black text-amber-600">
                  {formatKsh(avgOrderValue)}
                </div>
              </div>
            </div>
            <div className="pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[11px] text-amber-600 font-semibold">Per completed order</span>
              <span className="text-[10px] text-slate-400 font-medium">Today</span>
            </div>
          </div>

          {/* Table Utilization */}
          <div className="p-4 rounded-2xl border flex flex-col justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Table Utilization</span>
                <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                  <LayoutGrid className="h-4 w-4 text-indigo-500" />
                </div>
              </div>
              <div className="my-2.5">
                <div className="text-2xl font-black text-indigo-600">
                  {tableUtil ? `${tableUtil.utilizationRate}%` : '—'}
                </div>
              </div>
            </div>
            <div className="pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[11px] text-indigo-600 font-semibold">
                {tableUtil ? `${tableUtil.tablesUsedToday}/${tableUtil.activeTables} tables` : 'No data'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Today</span>
            </div>
          </div>

          {/* Pending Order Age Alert */}
          <div
            className="p-4 rounded-2xl border flex flex-col justify-between"
            style={{
              background: 'var(--bg-card)',
              borderColor: pendingAge && pendingAge.ordersOver10Min > 0 ? 'rgba(239,68,68,0.4)'
                : pendingAge && pendingAge.ordersOver5Min > 0 ? 'rgba(245,158,11,0.4)'
                : 'var(--border)',
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Pending Age Alert</span>
                <div className="h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-orange-500" />
                </div>
              </div>
              <div className="my-2.5">
                <div className={`text-2xl font-black ${
                  pendingAge && pendingAge.ordersOver10Min > 0 ? 'text-rose-600'
                  : pendingAge && pendingAge.ordersOver5Min > 0 ? 'text-amber-600'
                  : 'text-emerald-600'
                }`}>
                  {pendingAge ? `${pendingAge.oldestAgeMinutes}m` : '—'}
                </div>
              </div>
            </div>
            <div className="pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[11px] text-orange-500 font-semibold">
                {pendingAge
                  ? pendingAge.ordersOver10Min > 0
                    ? `${pendingAge.ordersOver10Min} urgent (>10m)`
                    : pendingAge.ordersOver5Min > 0
                    ? `${pendingAge.ordersOver5Min} late (>5m)`
                    : `${pendingAge.totalPending} pending`
                  : 'No pending'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Oldest</span>
            </div>
          </div>
        </div>

        {/* ── Staff Performance (7-Day Waiter Leaderboard) ── */}
        <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Staff Performance (Last 7 Days)</h4>
              <p className="text-xs text-slate-500">Waiter completion rates and revenue handled</p>
            </div>
            <button
              onClick={loadAdminWaiters}
              disabled={adminWaitersLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-500/10 transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <RefreshCcw className={`h-3 w-3 ${adminWaitersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {adminWaitersLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200" style={{ borderTopColor: '#2563EB' }} />
            </div>
          ) : adminWaiters.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No waiter activity in the last 7 days
            </div>
          ) : (
            <div className="space-y-2">
              {adminWaiters.slice(0, 8).map((w, idx) => (
                <div
                  key={w.waiterUuid}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: idx === 0 ? 'rgba(37,99,235,0.06)' : 'var(--bg-secondary)' }}
                >
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-black"
                    style={{
                      background: idx === 0 ? '#2563EB' : idx === 1 ? '#94A3B8' : idx === 2 ? '#CD7F32' : 'var(--border)',
                      color: idx <= 2 ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {idx === 0 ? '🏆' : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{w.fullName}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {w.ordersCompleted} completed
                      </span>
                      <span
                        className={`text-[11px] font-bold ${w.completionRate >= 80 ? 'text-emerald-600' : w.completionRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}
                      >
                        {w.completionRate}% rate
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {formatKsh(Number(w.revenueHandled || 0))}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {w.averageCompletionTimeMinutes > 0 ? `~${w.averageCompletionTimeMinutes}m avg` : `${w.ordersClaimed} claimed`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 7-Day Revenue Trend & Top Selling Menu Items ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Continuous Revenue & Orders Chart */}
          <div className="lg:col-span-2 p-5 rounded-2xl border flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                  7-Day Sales & Orders Trend
                </h4>
                <p className="text-xs text-slate-500">Continuous daily settled revenue and total volume</p>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-lg">
                Last 7 Days
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `KSh ${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: any, name: string) => [
                      name === 'revenue' ? formatKsh(Number(value)) : value,
                      name === 'revenue' ? 'Revenue' : 'Orders',
                    ]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      return item?.date ? `${label} (${item.date})` : label;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#adminRevGrad)"
                    name="revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Selling Menu Items (5 Items) */}
          <div className="p-5 rounded-2xl border flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                  Top-Selling Items
                </h4>
                <p className="text-xs text-slate-500">Highest volume menu items</p>
              </div>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>

            {topMenuItemsList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
                <ShoppingBag className="h-8 w-8 mb-2 opacity-40" />
                <p className="font-bold text-slate-400">No sales recorded yet</p>
                <p className="text-[11px] text-slate-400 mt-1">Your top menu items will appear once customer orders are placed.</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto">
                {topMenuItemsList.map((item, idx) => (
                  <div key={item.itemId || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-500/5 hover:bg-slate-500/10 transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-6 w-6 rounded-lg bg-blue-600/10 text-blue-600 text-xs font-black flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-500">{item.category}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-emerald-600">{item.quantitySold} sold</div>
                      <div className="text-[10px] text-slate-500">{formatKsh(item.revenueGenerated)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  /* ─────────────────────────────────────────────────────────────
     FEATURE 2: BUSINESS OVERVIEW VIEW
  ───────────────────────────────────────────────────────────── */
  const renderBusinessOverview = () => {
    const biz = businessSummary?.business;
    if (!biz) {
      return (
        <div className="p-8 text-center text-slate-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30 animate-pulse" />
          Loading business details...
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              Business Profile & Details
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Identity, contact information, and operational summaries
            </p>
          </div>
          <button
            onClick={() => setEditBusinessOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Business Info
          </button>
        </div>

        {/* Business Identity Card */}
        <div className="p-6 rounded-2xl border relative overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div
              className="h-20 w-20 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg flex-shrink-0"
              style={{ background: biz.brandColor || '#2563EB' }}
            >
              {biz.logoUrl ? (
                <img src={resolveImageUrl(biz.logoUrl)} alt={biz.name} className="h-full w-full object-cover rounded-2xl" />
              ) : (
                biz.name.charAt(0).toUpperCase()
              )}
            </div>

            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {biz.name}
                </h3>
                <StatusBadge status={biz.status} />
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  {biz.businessType}
                </span>
              </div>
              <p className="text-xs text-slate-500">{biz.description || 'Full-service hospitality establishment'}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {biz.address || `${biz.city || 'Nairobi'}, ${biz.county || 'Kenya'}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {biz.openingHours || '08:00'} – {biz.closingHours || '23:00'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Created {new Date(biz.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Managers</span>
            <div className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
              {businessSummary.managersCount}
            </div>
            <span className="text-[10px] text-blue-600 font-semibold">Active accounts</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Waiters</span>
            <div className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
              {businessSummary.waitersCount}
            </div>
            <span className="text-[10px] text-purple-600 font-semibold">Registered staff</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Active Tables / QR Codes</span>
            <div className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
              {businessSummary.tablesCount}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">Configured seating</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Total Lifetime Orders</span>
            <div className="text-2xl font-black mt-1 text-emerald-600">
              {businessSummary.totalOrders}
            </div>
            <span className="text-[10px] text-slate-500 font-semibold">{formatKsh(businessSummary.totalRevenue)} settled</span>
          </div>
        </div>

        {/* Contact & Setup Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
              Contact Details
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Email Address</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{biz.email || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Phone Number</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{biz.phone || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">City / County</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{biz.city}, {biz.county}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Public QR Slug</span>
                <span className="font-mono text-blue-600 font-bold">/v/{biz.slug}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl border space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
              Security & Multi-Tenant Scope
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Business UUID</span>
                <span className="font-mono text-slate-400 select-all">{biz.businessUuid}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Tenant Isolation</span>
                <span className="font-bold text-emerald-600">Strictly Enforced</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Subscription Status</span>
                <span className="font-bold text-blue-600">{biz.subscriptionStatus || 'PRO'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Assigned Admin</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.fullName || 'Business Owner'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 3: MANAGER MANAGEMENT VIEW
     API: GET/POST/PATCH/DELETE /api/v1/managers
     - Business scope resolved server-side from JWT (no businessId from client)
     - Server-side pagination, search, status filter, and sorting
     - Full CRUD: create, view, edit, activate/deactivate, reset-password, soft-delete
     - KPI Summary & Manager Activity Metrics
  ───────────────────────────────────────────────────────────── */

  // Manager list state (server-side paged)
  const [managerListData, setManagerListData] = useState<{
    managers: any[];
    summary: { totalManagers: number; activeManagers: number; inactiveManagers: number };
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  const [managerListLoading, setManagerListLoading] = useState(false);
  const [managerListError, setManagerListError] = useState<string | null>(null);

  // Manager list filters (server-side)
  const [managerStatusFilter, setManagerStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [managerSortBy, setManagerSortBy] = useState<'createdAt' | 'updatedAt' | 'fullName' | 'email'>('createdAt');
  const [managerSortOrder, setManagerSortOrder] = useState<'desc' | 'asc'>('desc');
  const [managerPage, setManagerPage] = useState(1);
  const managerLimit = 10;

  // Create manager state
  const [managerFullName, setManagerFullName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerCreating, setManagerCreating] = useState(false);
  const [managerErrors, setManagerErrors] = useState<{ fullName?: string; email?: string; phone?: string }>({});

  const validateManagerField = (field: string, value: string): string => {
    if (field === 'fullName') {
      if (!value.trim()) return 'Full name is required';
      if (!/^[a-zA-Z\s]+$/.test(value)) return 'Name can only contain letters';
      if (value.trim().length < 3) return 'Name must be at least 3 characters';
    }
    if (field === 'email') {
      if (!value.trim()) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
    }
    if (field === 'phone' && value.trim()) {
      const digits = value.replace(/\D/g, '');
      if (!/^\d+$/.test(digits)) return 'Phone must contain numbers only';
      if (digits.length !== 9) return 'Phone number must be exactly 9 digits (e.g. 712345678)';
    }
    return '';
  };

  // Edit manager state
  const [editManagerOpen, setEditManagerOpen] = useState(false);
  const [editManagerData, setEditManagerData] = useState<any | null>(null);
  const [editManagerFullName, setEditManagerFullName] = useState('');
  const [editManagerEmail, setEditManagerEmail] = useState('');
  const [editManagerPhone, setEditManagerPhone] = useState('');
  const [editManagerSaving, setEditManagerSaving] = useState(false);

  // Password reset state
  const [resetPwdOpen, setResetPwdOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<any | null>(null);
  const [resetPwdCustom, setResetPwdCustom] = useState('');
  const [resetPwdResult, setResetPwdResult] = useState<{ temporaryPassword: string; message: string } | null>(null);
  const [resetPwdBusy, setResetPwdBusy] = useState(false);

  // Delete confirmation state
  const [deleteManagerOpen, setDeleteManagerOpen] = useState(false);
  const [deleteManagerTarget, setDeleteManagerTarget] = useState<any | null>(null);
  const [deleteManagerBusy, setDeleteManagerBusy] = useState(false);

  // Status toggle confirmation state
  const [statusManagerOpen, setStatusManagerOpen] = useState(false);
  const [statusManagerTarget, setStatusManagerTarget] = useState<any | null>(null);
  const [statusManagerBusy, setStatusManagerBusy] = useState(false);

  // View manager detail state
  const [viewManagerOpen, setViewManagerOpen] = useState(false);
  const [viewManagerData, setViewManagerData] = useState<any | null>(null);
  const [viewManagerLoading, setViewManagerLoading] = useState(false);

  const generateSecurePassword = () => {
    setManagerPassword(generateStrongPassword());
  };

  /**
   * Load managers from the dedicated /managers API with server-side filtering, sorting & pagination.
   * No businessUuid is sent from the client; scope is derived server-side from JWT.
   */
  const loadManagers = useCallback(
    async (
      page = 1,
      status: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL',
      search = '',
      sortBy = managerSortBy,
      sortOrder = managerSortOrder,
    ) => {
      setManagerListLoading(true);
      setManagerListError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(managerLimit),
          sortBy,
          sortOrder,
          ...(status !== 'ALL' ? { status } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        });
        const res = await authFetch(`/managers?${params.toString()}`);
        if (res.success && res.data) {
          setManagerListData(res.data);
        } else {
          setManagerListError(res.error?.message || 'Failed to load managers.');
        }
      } catch (err: any) {
        setManagerListError(err.message || 'Failed to load managers. Please try again.');
      } finally {
        setManagerListLoading(false);
      }
    },
    [managerLimit, managerSortBy, managerSortOrder],
  );

  // Load when page/filters/sort change
  useEffect(() => {
    if (page === 'users') {
      loadManagers(managerPage, managerStatusFilter, managerSearch, managerSortBy, managerSortOrder);
    }
  }, [page, managerPage, managerStatusFilter, managerSortBy, managerSortOrder]);

  const handleManagerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setManagerPage(1);
    loadManagers(1, managerStatusFilter, managerSearch, managerSortBy, managerSortOrder);
  };

  /**
   * Create Manager — sends only permitted fields. Never sends role or businessUuid.
   */
  const handleCreateManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateManagerField('fullName', managerFullName);
    const emailErr = validateManagerField('email', managerEmail);
    const phoneErr = validateManagerField('phone', managerPhone);
    if (nameErr || emailErr || phoneErr) {
      setManagerErrors({ fullName: nameErr, email: emailErr, phone: phoneErr });
      return;
    }
    const pwdVal = validateStrongPassword(managerPassword);
    if (!pwdVal.isValid) {
      showToast(pwdVal.error || STRONG_PASSWORD_MESSAGE, 'error');
      return;
    }
    try {
      setManagerCreating(true);
      await authFetch('/managers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: managerFullName.trim(),
          email: managerEmail.trim(),
          ...(managerPhone.trim() ? { phone: managerPhone.trim() } : {}),
          password: managerPassword,
        }),
      });
      showToast(`Manager ${managerFullName} created successfully!`, 'success');
      setCreateManagerOpen(false);
      setManagerFullName('');
      setManagerEmail('');
      setManagerPhone('');
      setManagerPassword('');
      setManagerErrors({});
      setManagerPage(1);
      loadManagers(1, managerStatusFilter, managerSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to create manager account', 'error');
    } finally {
      setManagerCreating(false);
    }
  };

  /**
   * Open view detail modal and fetch fresh manager detail from API.
   */
  const openViewManager = async (managerUuid: string) => {
    setViewManagerOpen(true);
    setViewManagerLoading(true);
    setViewManagerData(null);
    try {
      const res = await authFetch(`/managers/${managerUuid}`);
      if (res.success && res.data) {
        setViewManagerData(res.data);
      } else {
        showToast('Failed to load manager details.', 'error');
        setViewManagerOpen(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load manager details.', 'error');
      setViewManagerOpen(false);
    } finally {
      setViewManagerLoading(false);
    }
  };

  /**
   * Open edit modal, pre-populating with current values.
   */
  const openEditManager = (manager: any) => {
    setEditManagerData(manager);
    setEditManagerFullName(manager.fullName);
    setEditManagerEmail(manager.email);
    setEditManagerPhone(manager.phone || '');
    setEditManagerOpen(true);
  };

  /**
   * Save edited Manager. Only sends permitted fields (fullName, email, phone).
   */
  const handleEditManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editManagerData) return;
    if (!editManagerFullName.trim() || !editManagerEmail.trim()) {
      showToast('Full name and email are required.', 'error');
      return;
    }
    if (editManagerPhone.trim()) {
      const digits = editManagerPhone.replace(/\D/g, '');
      if (digits.length !== 9) {
        showToast('Phone number must be exactly 9 digits (e.g. 712345678)', 'error');
        return;
      }
    }
    try {
      setEditManagerSaving(true);
      const managerId = editManagerData.managerUuid || editManagerData.userUuid;
      await authFetch(`/managers/${managerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editManagerFullName.trim(),
          email: editManagerEmail.trim(),
          ...(editManagerPhone.trim() ? { phone: editManagerPhone.trim() } : {}),
        }),
      });
      showToast(`Manager ${editManagerFullName} updated successfully.`, 'success');
      setEditManagerOpen(false);
      setEditManagerData(null);
      loadManagers(managerPage, managerStatusFilter, managerSearch);
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to update manager.', 'error');
    } finally {
      setEditManagerSaving(false);
    }
  };

  /**
   * Initiate Manager Password Reset via POST /api/v1/managers/:managerUuid/reset-password
   */
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPwdCustom.trim()) {
      const val = validateStrongPassword(resetPwdCustom.trim());
      if (!val.isValid) {
        showToast(val.error || STRONG_PASSWORD_MESSAGE, 'error');
        return;
      }
    }
    try {
      setResetPwdBusy(true);
      const managerId = resetPwdTarget.managerUuid || resetPwdTarget.userUuid;
      const res = await authFetch(`/managers/${managerId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          ...(resetPwdCustom.trim() ? { temporaryPassword: resetPwdCustom.trim() } : {}),
        }),
      });

      if (res.success && res.data) {
        setResetPwdResult({
          temporaryPassword: res.data.temporaryPassword,
          message: res.data.message,
        });
        showToast(`Password reset initiated for ${resetPwdTarget.fullName}`, 'success');
        loadManagers(managerPage, managerStatusFilter, managerSearch);
        loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset manager password', 'error');
    } finally {
      setResetPwdBusy(false);
    }
  };

  /**
   * Activate/Deactivate via dedicated /status endpoint.
   */
  const confirmToggleManagerStatus = async () => {
    if (!statusManagerTarget) return;
    const newActive = !statusManagerTarget.isActive;
    try {
      setStatusManagerBusy(true);
      const managerId = statusManagerTarget.managerUuid || statusManagerTarget.userUuid;
      await authFetch(`/managers/${managerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newActive }),
      });
      showToast(
        `Manager ${statusManagerTarget.fullName} is now ${newActive ? 'active' : 'suspended'}.`,
        'success',
      );
      setStatusManagerOpen(false);
      setStatusManagerTarget(null);
      loadManagers(managerPage, managerStatusFilter, managerSearch);
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to update manager status.', 'error');
    } finally {
      setStatusManagerBusy(false);
    }
  };

  /**
   * Soft-delete Manager.
   */
  const confirmDeleteManager = async () => {
    if (!deleteManagerTarget) return;
    try {
      setDeleteManagerBusy(true);
      const managerId = deleteManagerTarget.managerUuid || deleteManagerTarget.userUuid;
      await authFetch(`/managers/${managerId}`, { method: 'DELETE' });
      showToast(`Manager ${deleteManagerTarget.fullName} has been removed.`, 'success');
      setDeleteManagerOpen(false);
      setDeleteManagerTarget(null);
      loadManagers(managerPage, managerStatusFilter, managerSearch);
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove manager.', 'error');
    } finally {
      setDeleteManagerBusy(false);
    }
  };

  const renderManagersView = () => {
    const managerList = managerListData?.managers || [];
    const pagination = managerListData?.pagination;
    const summary = managerListData?.summary || {
      totalManagers: managerList.length,
      activeManagers: managerList.filter((m) => m.isActive).length,
      inactiveManagers: managerList.filter((m) => !m.isActive).length,
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                Manager Management
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                Staff Administration
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Create, oversee, configure permissions, and manage accounts for your operational Managers.
            </p>
          </div>
          <button
            onClick={() => {
              generateSecurePassword();
              setCreateManagerOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add New Manager
          </button>
        </div>

        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500">Total Managers</span>
              <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {summary.totalManagers}
              </div>
              <span className="text-[10px] text-slate-400">Assigned to your business</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500">Active Managers</span>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">
                {summary.activeManagers}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">Active system access</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
              <UserX className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500">Suspended / Inactive</span>
              <div className="text-2xl font-black text-amber-600 mt-0.5">
                {summary.inactiveManagers}
              </div>
              <span className="text-[10px] text-amber-600 font-semibold">Access disabled</span>
            </div>
          </div>
        </div>

        {/* ── Filters & Sort Bar ── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <form onSubmit={handleManagerSearch} className="flex-1 flex items-center gap-2 p-2.5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search managers by name, email, or phone..."
              value={managerSearch}
              onChange={(e) => setManagerSearch(e.target.value)}
              className="bg-transparent text-xs outline-none flex-1"
              style={{ color: 'var(--text-primary)' }}
            />
            {managerSearch && (
              <button
                type="button"
                onClick={() => {
                  setManagerSearch('');
                  setManagerPage(1);
                  loadManagers(1, managerStatusFilter, '', managerSortBy, managerSortOrder);
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
            <button type="submit" className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold">
              Search
            </button>
          </form>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setManagerStatusFilter(s);
                  setManagerPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  managerStatusFilter === s
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-500/10'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <Sliders className="h-3.5 w-3.5 text-slate-400 ml-2" />
            <select
              value={`${managerSortBy}-${managerSortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setManagerSortBy(sb as any);
                setManagerSortOrder(so as any);
                setManagerPage(1);
              }}
              className="bg-transparent text-xs font-semibold p-1.5 outline-none"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="fullName-asc">Name (A–Z)</option>
              <option value="fullName-desc">Name (Z–A)</option>
              <option value="updatedAt-desc">Recently Updated</option>
            </select>
          </div>

          <button
            onClick={() => loadManagers(managerPage, managerStatusFilter, managerSearch, managerSortBy, managerSortOrder)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:bg-slate-500/10 transition"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* ── Managers Table ── */}
        <div className="flex-1 min-h-[300px] p-5 rounded-2xl border shadow-sm flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {managerListError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-500 font-semibold">{managerListError}</p>
              <button
                onClick={() => loadManagers(managerPage, managerStatusFilter, managerSearch)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : managerListLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 w-full rounded-xl bg-slate-500/10" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px]" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full min-w-[750px] text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-20">
                  <tr className="font-bold whitespace-nowrap">
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Manager</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Email Address</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Phone</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Status</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Activity / Last Login</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Date Added</th>
                    <th className="py-3 text-right whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {managerList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-10 w-10 text-slate-300" />
                          <p className="text-sm font-bold text-slate-400">No Managers found</p>
                          <p className="text-xs text-slate-400 max-w-xs">
                            {managerSearch || managerStatusFilter !== 'ALL'
                              ? 'Try adjusting your search query or status filter.'
                              : 'No Managers added yet. Click "Add New Manager" above to create an operational manager account.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    managerList.map((m) => (
                      <tr key={m.managerUuid} className="hover:bg-slate-500/5 transition-colors">
                        <td className="py-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-blue-600/10 text-blue-600 font-black text-sm flex items-center justify-center flex-shrink-0">
                              {m.fullName?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div>{m.fullName}</div>
                              {m.mustChangePassword && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                                  Password Change Required
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-slate-500">{m.email}</td>
                        <td className="py-3 text-slate-500">{m.phone || '—'}</td>
                        <td className="py-3">
                          <StatusBadge status={m.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                        </td>
                        <td className="py-3 text-slate-400">
                          {m.activitySummary?.lastLoginAt ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{new Date(m.activitySummary.lastLoginAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Never logged in</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-400">
                          {new Date(m.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Details */}
                            <button
                              title="View Details"
                              onClick={() => openViewManager(m.managerUuid)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {/* Edit */}
                            <button
                              title="Edit Manager"
                              onClick={() => openEditManager(m)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {/* Reset Password */}
                            <button
                              title="Reset Password"
                              onClick={() => {
                                setResetPwdTarget(m);
                                setResetPwdCustom('');
                                setResetPwdResult(null);
                                setResetPwdOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                            {/* Activate / Deactivate */}
                            <button
                              title={m.isActive ? 'Deactivate Manager' : 'Activate Manager'}
                              onClick={() => {
                                setStatusManagerTarget(m);
                                setStatusManagerOpen(true);
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                m.isActive
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              }`}
                            >
                              {m.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>
                            {/* Soft Delete */}
                            <button
                              title="Remove Manager"
                              onClick={() => {
                                setDeleteManagerTarget(m);
                                setDeleteManagerOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
              <span className="text-slate-400">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} managers
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => {
                    const p = managerPage - 1;
                    setManagerPage(p);
                    loadManagers(p, managerStatusFilter, managerSearch);
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 hover:bg-slate-500/10 transition"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 font-bold text-blue-600">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => {
                    const p = managerPage + 1;
                    setManagerPage(p);
                    loadManagers(p, managerStatusFilter, managerSearch);
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-40 hover:bg-slate-500/10 transition"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Manager Modals (rendered at Users view level so all actions work from all tabs)
   */
  const renderManagerModals = () => {
    return (
      <>
        {/* ── Create Manager Modal ── */}
        <Modal open={createManagerOpen} onClose={() => setCreateManagerOpen(false)} title="Add New Manager">
          <form onSubmit={handleCreateManagerSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <span className="font-bold block flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Tenant Scope Enforced
              </span>
              This Manager will be securely assigned to your business by the server. Role is automatically set to <strong>Manager</strong>.
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Samuel Mutua"
                value={managerFullName}
                onChange={(e) => {
                  setManagerFullName(e.target.value);
                  setManagerErrors(prev => ({ ...prev, fullName: validateManagerField('fullName', e.target.value) }));
                }}
                className={`w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 ${managerErrors.fullName ? 'border-red-400 focus:ring-red-400' : 'focus:ring-blue-500'}`}
                style={{ background: 'var(--bg-body)', borderColor: managerErrors.fullName ? undefined : 'var(--border)', color: 'var(--text-primary)' }}
              />
              {managerErrors.fullName && <p className="text-[10px] text-red-500 mt-0.5 font-semibold">{managerErrors.fullName}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Email Address *</label>
              <input
                type="email"
                required
                placeholder="e.g. manager@yourbusiness.co.ke"
                value={managerEmail}
                onChange={(e) => {
                  setManagerEmail(e.target.value);
                  setManagerErrors(prev => ({ ...prev, email: validateManagerField('email', e.target.value) }));
                }}
                className={`w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 ${managerErrors.email ? 'border-red-400 focus:ring-red-400' : 'focus:ring-blue-500'}`}
                style={{ background: 'var(--bg-body)', borderColor: managerErrors.email ? undefined : 'var(--border)', color: 'var(--text-primary)' }}
              />
              {managerErrors.email && <p className="text-[10px] text-red-500 mt-0.5 font-semibold">{managerErrors.email}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Phone Number (Optional)</label>
              <div className="flex">
                <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 text-xs font-semibold select-none" style={{ background: 'var(--bg-body)', borderColor: managerErrors.phone ? '#f87171' : 'var(--border)', color: 'var(--text-muted)' }}>
                  +254
                </span>
                <input
                  type="tel"
                  maxLength={9}
                  placeholder="7XX XXX XXX"
                  value={managerPhone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9);
                    setManagerPhone(clean);
                    setManagerErrors(prev => ({ ...prev, phone: validateManagerField('phone', clean) }));
                  }}
                  className={`w-full rounded-r-xl border p-2.5 text-xs outline-none focus:ring-2 ${managerErrors.phone ? 'border-red-400 focus:ring-red-400' : 'focus:ring-blue-500'}`}
                  style={{ background: 'var(--bg-body)', borderColor: managerErrors.phone ? undefined : 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex items-center justify-between">
                {managerErrors.phone ? <p className="text-[10px] text-red-500 font-semibold">{managerErrors.phone}</p> : <span />}
                <span className="text-[10px] text-slate-400 font-mono ml-auto">{managerPhone.length}/9 digits</span>
              </div>
            </div>


            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500">Temporary Password *</label>
                <button type="button" onClick={generateSecurePassword} className="text-[11px] font-bold text-blue-600 hover:underline">
                  Generate New
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  className="flex-1 rounded-xl border p-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(managerPassword);
                    showToast('Password copied to clipboard!', 'success');
                  }}
                  className="px-3 py-2 rounded-xl border text-xs font-semibold hover:bg-slate-500/10 transition"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400">The manager will be required to change this password upon first login.</p>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setCreateManagerOpen(false)}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={managerCreating}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-60"
              >
                {managerCreating ? 'Creating...' : 'Create Manager'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Edit Manager Modal ── */}
        <Modal open={editManagerOpen} onClose={() => setEditManagerOpen(false)} title="Edit Manager">
          <form onSubmit={handleEditManagerSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border text-xs text-slate-500 space-y-1" style={{ borderColor: 'var(--border)' }}>
              <span className="font-bold block">Permitted Fields Only</span>
              Role and business assignment cannot be modified through this form.
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Full Name *</label>
              <input
                type="text"
                required
                value={editManagerFullName}
                onChange={(e) => setEditManagerFullName(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Email Address *</label>
              <input
                type="email"
                required
                value={editManagerEmail}
                onChange={(e) => setEditManagerEmail(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Phone Number (Optional)</label>
              <div className="flex">
                <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 text-xs font-semibold select-none" style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  +254
                </span>
                <input
                  type="tel"
                  maxLength={9}
                  placeholder="7XX XXX XXX"
                  value={editManagerPhone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9);
                    setEditManagerPhone(clean);
                  }}
                  className="w-full rounded-r-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex justify-end">
                <span className="text-[10px] text-slate-400 font-mono">{editManagerPhone.length}/9 digits</span>
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setEditManagerOpen(false)}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editManagerSaving}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {editManagerSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── View Manager Detail Modal ── */}
        <Modal open={viewManagerOpen} onClose={() => setViewManagerOpen(false)} title="Manager Details">
          {viewManagerLoading ? (
            <div className="space-y-3 animate-pulse py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 w-full rounded-xl bg-slate-500/10" />
              ))}
            </div>
          ) : viewManagerData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <div className="h-12 w-12 rounded-xl bg-blue-600/20 text-blue-600 font-black text-lg flex items-center justify-center">
                  {viewManagerData.fullName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{viewManagerData.fullName}</div>
                  <div className="text-xs text-slate-500">{viewManagerData.email}</div>
                  <StatusBadge status={viewManagerData.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { label: 'Phone', value: viewManagerData.phone || '—' },
                  { label: 'Role', value: 'Manager' },
                  { label: 'Business', value: viewManagerData.business?.name || '—' },
                  { label: 'Account Age', value: `${viewManagerData.activitySummary?.accountAgeDays ?? 0} days` },
                  { label: 'Email Verified', value: viewManagerData.emailVerified ? 'Yes' : 'No' },
                  { label: 'Password Status', value: viewManagerData.mustChangePassword ? 'Password reset required on login' : 'Active' },
                  { label: 'Date Added', value: new Date(viewManagerData.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) },
                  { label: 'Last Updated', value: new Date(viewManagerData.updatedAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) },
                  { label: 'Last Login', value: viewManagerData.lastLoginAt ? new Date(viewManagerData.lastLoginAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Never logged in' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setViewManagerOpen(false);
                    openEditManager(viewManagerData);
                  }}
                  className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition flex items-center justify-center gap-1.5"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    setViewManagerOpen(false);
                    setResetPwdTarget(viewManagerData);
                    setResetPwdCustom('');
                    setResetPwdResult(null);
                    setResetPwdOpen(true);
                  }}
                  className="flex-1 py-2 rounded-xl border border-purple-200 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" /> Reset Password
                </button>
                <button
                  onClick={() => {
                    setViewManagerOpen(false);
                    setStatusManagerTarget(viewManagerData);
                    setStatusManagerOpen(true);
                  }}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    viewManagerData.isActive
                      ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {viewManagerData.isActive ? (
                    <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                  ) : (
                    <><UserCheck className="h-3.5 w-3.5" /> Activate</>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>

        {/* ── Reset Password Modal ── */}
        <Modal
          open={resetPwdOpen}
          onClose={() => { setResetPwdOpen(false); setResetPwdTarget(null); setResetPwdResult(null); }}
          title={`Reset Password — ${resetPwdTarget?.fullName}`}
          size="md"
        >
          {resetPwdResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Password Reset Successfully Initiated</span>
                </div>
                <p className="text-xs">
                  Share this temporary password with <strong>{resetPwdTarget?.fullName}</strong>. They will be forced to choose a new password upon logging in.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border font-mono font-black text-sm select-all" style={{ borderColor: 'var(--border)' }}>
                    {resetPwdResult.temporaryPassword}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPwdResult.temporaryPassword);
                      showToast('Temporary password copied!', 'success');
                    }}
                    className="p-2.5 rounded-xl border hover:bg-slate-500/10 text-xs font-bold transition flex items-center gap-1.5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setResetPwdOpen(false); setResetPwdTarget(null); setResetPwdResult(null); }}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                <span className="font-bold block flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Security Notice
                </span>
                Resetting the password will immediately invalidate all of <strong>{resetPwdTarget?.fullName}</strong>'s active sessions and tokens.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Custom Temporary Password (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-generate a secure password"
                  value={resetPwdCustom}
                  onChange={(e) => setResetPwdCustom(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="text-[10px] text-slate-400">If left empty, a 10-character secure alphanumeric password will be generated.</p>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setResetPwdOpen(false); setResetPwdTarget(null); }}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPwdBusy}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-60"
                >
                  {resetPwdBusy ? 'Resetting...' : 'Confirm Password Reset'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* ── Activate / Deactivate Confirmation Modal ── */}
        <Modal
          open={statusManagerOpen}
          onClose={() => { setStatusManagerOpen(false); setStatusManagerTarget(null); }}
          title={statusManagerTarget?.isActive ? 'Deactivate Manager' : 'Activate Manager'}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {statusManagerTarget?.isActive ? (
                <>
                  Are you sure you want to <strong className="text-amber-600">deactivate</strong> <strong>{statusManagerTarget?.fullName}</strong>?
                  They will immediately lose access and all active sessions will be revoked.
                </>
              ) : (
                <>
                  Activate <strong>{statusManagerTarget?.fullName}</strong>? They will be able to log in again.
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setStatusManagerOpen(false); setStatusManagerTarget(null); }}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmToggleManagerStatus}
                disabled={statusManagerBusy}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-60 ${
                  statusManagerTarget?.isActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusManagerBusy ? 'Processing...' : statusManagerTarget?.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Confirmation Modal ── */}
        <Modal
          open={deleteManagerOpen}
          onClose={() => { setDeleteManagerOpen(false); setDeleteManagerTarget(null); }}
          title="Remove Manager"
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              <strong>Warning:</strong> This will permanently remove <strong>{deleteManagerTarget?.fullName}</strong> from your business. Their account history will be preserved but they will no longer be able to log in.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteManagerOpen(false); setDeleteManagerTarget(null); }}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteManager}
                disabled={deleteManagerBusy}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-60"
              >
                {deleteManagerBusy ? 'Removing...' : 'Remove Manager'}
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 5: WAITER MANAGEMENT VIEW
     API: GET/POST/PATCH/DELETE /api/v1/waiters
     - Business scope resolved server-side from JWT (no businessId from client)
     - Server-side pagination, search, status filter, and sorting
     - Full CRUD: create, view, edit, activate/deactivate, reset-password, soft-delete
     - Order metrics enabled via waiterUuid foreign key on orders
     - KPI Summary & Waiter Activity Metrics
  ───────────────────────────────────────────────────────────── */

  // Waiter list state (server-side paged)
  const [waiterListData, setWaiterListData] = useState<{
    waiters: any[];
    summary: { totalWaiters: number; activeWaiters: number; inactiveWaiters: number; totalOrdersHandled: number };
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  const [waiterListLoading, setWaiterListLoading] = useState(false);
  const [waiterListError, setWaiterListError] = useState<string | null>(null);

  // Waiter list filters (server-side)
  const [waiterStatusFilter, setWaiterStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [waiterSortBy, setWaiterSortBy] = useState<'createdAt' | 'updatedAt' | 'fullName' | 'email'>('createdAt');
  const [waiterSortOrder, setWaiterSortOrder] = useState<'desc' | 'asc'>('desc');
  const [waiterPage, setWaiterPage] = useState(1);
  const waiterLimit = 10;
  const [waiterSearch, setWaiterSearch] = useState('');

  // Create waiter state
  const [createWaiterOpen, setCreateWaiterOpen] = useState(false);
  const [waiterFullName, setWaiterFullName] = useState('');
  const [waiterEmail, setWaiterEmail] = useState('');
  const [waiterPhone, setWaiterPhone] = useState('');
  const [waiterPassword, setWaiterPassword] = useState('');
  const [waiterCreating, setWaiterCreating] = useState(false);
  const [waiterErrors, setWaiterErrors] = useState<{ fullName?: string; email?: string; phone?: string }>({});

  const validateWaiterField = (field: string, value: string): string => {
    if (field === 'fullName') {
      if (!value.trim()) return 'Full name is required';
      if (!/^[a-zA-Z\s]+$/.test(value)) return 'Name can only contain letters';
      if (value.trim().length < 3) return 'Name must be at least 3 characters';
    }
    if (field === 'email') {
      if (!value.trim()) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
    }
    if (field === 'phone' && value.trim()) {
      const digits = value.replace(/\D/g, '');
      if (!/^\d+$/.test(digits)) return 'Phone must contain numbers only';
      if (digits.length !== 9) return 'Phone number must be exactly 9 digits (e.g. 712345678)';
    }
    return '';
  };

  // Edit waiter state
  const [editWaiterOpen, setEditWaiterOpen] = useState(false);
  const [editWaiterData, setEditWaiterData] = useState<any | null>(null);
  const [editWaiterFullName, setEditWaiterFullName] = useState('');
  const [editWaiterEmail, setEditWaiterEmail] = useState('');
  const [editWaiterPhone, setEditWaiterPhone] = useState('');
  const [editWaiterSaving, setEditWaiterSaving] = useState(false);

  // Password reset state
  const [resetWaiterPwdOpen, setResetWaiterPwdOpen] = useState(false);
  const [resetWaiterPwdTarget, setResetWaiterPwdTarget] = useState<any | null>(null);
  const [resetWaiterPwdCustom, setResetWaiterPwdCustom] = useState('');
  const [resetWaiterPwdResult, setResetWaiterPwdResult] = useState<{ temporaryPassword: string; message: string } | null>(null);
  const [resetWaiterPwdBusy, setResetWaiterPwdBusy] = useState(false);

  // Delete confirmation state
  const [deleteWaiterOpen, setDeleteWaiterOpen] = useState(false);
  const [deleteWaiterTarget, setDeleteWaiterTarget] = useState<any | null>(null);
  const [deleteWaiterBusy, setDeleteWaiterBusy] = useState(false);

  // Status toggle confirmation state
  const [statusWaiterOpen, setStatusWaiterOpen] = useState(false);
  const [statusWaiterTarget, setStatusWaiterTarget] = useState<any | null>(null);
  const [statusWaiterBusy, setStatusWaiterBusy] = useState(false);

  // View waiter detail state
  const [viewWaiterOpen, setViewWaiterOpen] = useState(false);
  const [viewWaiterData, setViewWaiterData] = useState<any | null>(null);
  const [viewWaiterLoading, setViewWaiterLoading] = useState(false);

  const generateSecureWaiterPassword = () => {
    setWaiterPassword(generateStrongPassword());
  };

  /**
   * Load waiters from the dedicated /waiters API with server-side filtering, sorting & pagination.
   * No businessUuid is sent from the client; scope is derived server-side from JWT.
   */
  const loadWaiters = useCallback(
    async (
      page = waiterPage,
      status = waiterStatusFilter,
      search = waiterSearch,
      sortBy = waiterSortBy,
      sortOrder = waiterSortOrder,
    ) => {
      try {
        setWaiterListLoading(true);
        setWaiterListError(null);

        const params = new URLSearchParams({
          page: String(page),
          limit: String(waiterLimit),
          sortBy,
          sortOrder,
        });
        if (status !== 'ALL') params.set('status', status);
        if (search.trim()) params.set('search', search.trim());

        const res = await authFetch(`/waiters?${params.toString()}`);
        if (res.success && res.data) {
          setWaiterListData(res.data);
        } else {
          setWaiterListError(res.error?.message || 'Failed to load waiters.');
        }
      } catch (err: any) {
        setWaiterListError(err.message || 'Failed to load waiters. Please try again.');
      } finally {
        setWaiterListLoading(false);
      }
    },
    [waiterLimit, waiterSortBy, waiterSortOrder],
  );

  useEffect(() => {
    if (page === 'users') {
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch, waiterSortBy, waiterSortOrder);
    }
  }, [page, waiterPage, waiterStatusFilter, waiterSortBy, waiterSortOrder]);

  const handleWaiterSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setWaiterPage(1);
    loadWaiters(1, waiterStatusFilter, waiterSearch, waiterSortBy, waiterSortOrder);
  };

  /**
   * Create Waiter via POST /api/v1/waiters
   */
  const handleCreateWaiterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateWaiterField('fullName', waiterFullName);
    const emailErr = validateWaiterField('email', waiterEmail);
    const phoneErr = validateWaiterField('phone', waiterPhone);
    if (nameErr || emailErr || phoneErr) {
      setWaiterErrors({ fullName: nameErr, email: emailErr, phone: phoneErr });
      return;
    }
    const pwdVal = validateStrongPassword(waiterPassword);
    if (!pwdVal.isValid) {
      showToast(pwdVal.error || STRONG_PASSWORD_MESSAGE, 'error');
      return;
    }
    try {
      setWaiterCreating(true);
      const res = await authFetch('/waiters', {
        method: 'POST',
        body: JSON.stringify({
          fullName: waiterFullName.trim(),
          email: waiterEmail.trim().toLowerCase(),
          phone: waiterPhone.trim() || undefined,
          password: waiterPassword,
        }),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to create waiter.');
      }

      showToast(`Waiter "${waiterFullName}" created successfully!`, 'success');
      setCreateWaiterOpen(false);
      setWaiterFullName('');
      setWaiterEmail('');
      setWaiterPhone('');
      setWaiterPassword('');
      setWaiterErrors({});
      loadWaiters(1, waiterStatusFilter, waiterSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to create waiter', 'error');
    } finally {
      setWaiterCreating(false);
    }
  };

  /**
   * Open Waiter Detail modal via GET /api/v1/waiters/:waiterUuid
   */
  const openViewWaiter = async (waiterUuid: string) => {
    try {
      setViewWaiterLoading(true);
      setViewWaiterOpen(true);
      const res = await authFetch(`/waiters/${waiterUuid}`);
      if (res.success && res.data) {
        setViewWaiterData(res.data);
      } else {
        showToast(res.error?.message || 'Failed to load waiter details', 'error');
        setViewWaiterOpen(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load waiter details', 'error');
      setViewWaiterOpen(false);
    } finally {
      setViewWaiterLoading(false);
    }
  };

  /**
   * Open Edit Waiter modal
   */
  const openEditWaiter = (w: any) => {
    setEditWaiterData(w);
    setEditWaiterFullName(w.fullName || '');
    setEditWaiterEmail(w.email || '');
    setEditWaiterPhone(w.phone || '');
    setEditWaiterOpen(true);
  };

  /**
   * Submit Edit Waiter via PATCH /api/v1/waiters/:waiterUuid
   */
  const handleEditWaiterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWaiterData) return;

    if (editWaiterPhone.trim()) {
      const digits = editWaiterPhone.replace(/\D/g, '');
      if (digits.length !== 9) {
        showToast('Phone number must be exactly 9 digits (e.g. 712345678)', 'error');
        return;
      }
    }

    try {
      setEditWaiterSaving(true);
      const waiterId = editWaiterData.waiterUuid || editWaiterData.userUuid;
      const res = await authFetch(`/waiters/${waiterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editWaiterFullName.trim(),
          email: editWaiterEmail.trim().toLowerCase(),
          phone: editWaiterPhone.trim() || undefined,
        }),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to update waiter.');
      }

      showToast('Waiter updated successfully!', 'success');
      setEditWaiterOpen(false);
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
      loadManagers(managerPage, managerStatusFilter, managerSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to update waiter', 'error');
    } finally {
      setEditWaiterSaving(false);
    }
  };

  /**
   * Initiate Waiter Password Reset via POST /api/v1/waiters/:waiterUuid/reset-password
   */
  const handleResetWaiterPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetWaiterPwdTarget) return;

    if (resetWaiterPwdCustom.trim()) {
      const val = validateStrongPassword(resetWaiterPwdCustom.trim());
      if (!val.isValid) {
        showToast(val.error || STRONG_PASSWORD_MESSAGE, 'error');
        return;
      }
    }

    try {
      setResetWaiterPwdBusy(true);
      const waiterId = resetWaiterPwdTarget.waiterUuid || resetWaiterPwdTarget.userUuid;
      const res = await authFetch(`/waiters/${waiterId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(
          resetWaiterPwdCustom.trim()
            ? { temporaryPassword: resetWaiterPwdCustom.trim() }
            : {},
        ),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to reset password.');
      }

      setResetWaiterPwdResult(res.data);
      showToast(`Password reset initiated for ${resetWaiterPwdTarget.fullName}`, 'success');
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
      loadManagers(managerPage, managerStatusFilter, managerSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setResetWaiterPwdBusy(false);
    }
  };

  /**
   * Toggle Waiter Active / Inactive Status via PATCH /api/v1/waiters/:waiterUuid/status
   */
  const confirmToggleWaiterStatus = async () => {
    if (!statusWaiterTarget) return;
    try {
      setStatusWaiterBusy(true);
      const newStatus = !statusWaiterTarget.isActive;
      const waiterId = statusWaiterTarget.waiterUuid || statusWaiterTarget.userUuid;
      const res = await authFetch(`/waiters/${waiterId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to update waiter status.');
      }

      showToast(
        `Waiter ${statusWaiterTarget.fullName} is now ${newStatus ? 'active' : 'suspended'}.`,
        'success',
      );
      setStatusWaiterOpen(false);
      setStatusWaiterTarget(null);
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
      loadManagers(managerPage, managerStatusFilter, managerSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setStatusWaiterBusy(false);
    }
  };

  /**
   * Soft-delete Waiter via DELETE /api/v1/waiters/:waiterUuid
   */
  const confirmDeleteWaiter = async () => {
    if (!deleteWaiterTarget) return;
    try {
      setDeleteWaiterBusy(true);
      const waiterId = deleteWaiterTarget.waiterUuid || deleteWaiterTarget.userUuid;
      const res = await authFetch(`/waiters/${waiterId}`, { method: 'DELETE' });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to delete waiter.');
      }

      showToast(`Waiter ${deleteWaiterTarget.fullName} removed successfully.`, 'success');
      setDeleteWaiterOpen(false);
      setDeleteWaiterTarget(null);
      loadWaiters(waiterPage, waiterStatusFilter, waiterSearch);
      loadManagers(managerPage, managerStatusFilter, managerSearch);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove waiter', 'error');
    } finally {
      setDeleteWaiterBusy(false);
    }
  };

  const renderWaitersView = () => {
    const waiterList = waiterListData?.waiters || [];
    const pagination = waiterListData?.pagination;
    const summary = waiterListData?.summary || {
      totalWaiters: waiterList.length,
      activeWaiters: waiterList.filter((w) => w.isActive).length,
      inactiveWaiters: waiterList.filter((w) => !w.isActive).length,
      totalOrdersHandled: waiterList.reduce((acc, w) => acc + (w.activitySummary?.ordersClaimed || 0), 0),
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                Waiter Management
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Floor Staff Administration
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Create, configure, oversee, track order performance, and manage floor accounts for your Waiters.
            </p>
          </div>
          <button
            onClick={() => {
              generateSecureWaiterPassword();
              setCreateWaiterOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add New Waiter
          </button>
        </div>

        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500">Total Waiters</span>
              <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {summary.totalWaiters}
              </div>
              <span className="text-[10px] text-slate-400">Assigned to your business</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500">Active Waiters</span>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">
                {summary.activeWaiters}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">Active floor access</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
              <UserX className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500">Suspended / Inactive</span>
              <div className="text-2xl font-black text-amber-600 mt-0.5">
                {summary.inactiveWaiters}
              </div>
              <span className="text-[10px] text-amber-600 font-semibold">Access disabled</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500">Orders Handled</span>
              <div className="text-2xl font-black text-purple-600 mt-0.5">
                {summary.totalOrdersHandled}
              </div>
              <span className="text-[10px] text-purple-600 font-semibold">All-time floor volume</span>
            </div>
          </div>
        </div>

        {/* ── Filters & Sort Bar ── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <form onSubmit={handleWaiterSearch} className="flex-1 flex items-center gap-2 p-2.5 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search waiters by name, email, or phone..."
              value={waiterSearch}
              onChange={(e) => setWaiterSearch(e.target.value)}
              className="bg-transparent text-xs outline-none flex-1"
              style={{ color: 'var(--text-primary)' }}
            />
            {waiterSearch && (
              <button
                type="button"
                onClick={() => {
                  setWaiterSearch('');
                  setWaiterPage(1);
                  loadWaiters(1, waiterStatusFilter, '', waiterSortBy, waiterSortOrder);
                }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
            <button type="submit" className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">
              Search
            </button>
          </form>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setWaiterStatusFilter(s);
                  setWaiterPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  waiterStatusFilter === s
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-500/10'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <Sliders className="h-3.5 w-3.5 text-slate-400 ml-2" />
            <select
              value={`${waiterSortBy}-${waiterSortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setWaiterSortBy(sb as any);
                setWaiterSortOrder(so as any);
                setWaiterPage(1);
              }}
              className="bg-transparent text-xs font-semibold p-1.5 outline-none"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="fullName-asc">Name (A–Z)</option>
              <option value="fullName-desc">Name (Z–A)</option>
              <option value="updatedAt-desc">Recently Updated</option>
            </select>
          </div>

          <button
            onClick={() => loadWaiters(waiterPage, waiterStatusFilter, waiterSearch, waiterSortBy, waiterSortOrder)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:bg-slate-500/10 transition"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* ── Waiters Table ── */}
        <div className="flex-1 min-h-[300px] p-5 rounded-2xl border shadow-sm flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {waiterListError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-500 font-semibold">{waiterListError}</p>
              <button
                onClick={() => loadWaiters(waiterPage, waiterStatusFilter, waiterSearch)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : waiterListLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 w-full rounded-xl bg-slate-500/10" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px]" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full min-w-[850px] text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-20">
                  <tr className="font-bold whitespace-nowrap">
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Waiter</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Email Address</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Phone</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Status</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Orders Handled</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Activity / Last Login</th>
                    <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Date Added</th>
                    <th className="py-3 text-right whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {waiterList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="h-10 w-10 text-slate-300" />
                          <p className="text-sm font-bold text-slate-400">No Waiters found</p>
                          <p className="text-xs text-slate-400 max-w-xs">
                            {waiterSearch || waiterStatusFilter !== 'ALL'
                              ? 'Try adjusting your search query or status filter.'
                              : 'No Waiters added yet. Click "Add New Waiter" above to create a floor staff account.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    waiterList.map((w) => (
                      <tr key={w.waiterUuid} className="hover:bg-slate-500/5 transition-colors">
                        <td className="py-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-emerald-600/10 text-emerald-600 font-black text-sm flex items-center justify-center flex-shrink-0">
                              {w.fullName?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div>{w.fullName}</div>
                              {w.mustChangePassword && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                                  Password Change Required
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-slate-500">{w.email}</td>
                        <td className="py-3 text-slate-500">{w.phone || '—'}</td>
                        <td className="py-3">
                          <StatusBadge status={w.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                              {w.activitySummary?.ordersClaimed ?? 0}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({w.activitySummary?.ordersCompleted ?? 0} completed{w.activitySummary?.activeOrders ? `, ${w.activitySummary.activeOrders} active` : ''})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-400">
                          {w.activitySummary?.lastLoginAt ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{new Date(w.activitySummary.lastLoginAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Never logged in</span>
                          )}
                        </td>
                        <td className="py-3 text-slate-400">
                          {new Date(w.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Details */}
                            <button
                              title="View Details"
                              onClick={() => openViewWaiter(w.waiterUuid)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {/* Edit */}
                            <button
                              title="Edit Waiter"
                              onClick={() => openEditWaiter(w)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {/* Reset Password */}
                            <button
                              title="Reset Password"
                              onClick={() => {
                                setResetWaiterPwdTarget(w);
                                setResetWaiterPwdCustom('');
                                setResetWaiterPwdResult(null);
                                setResetWaiterPwdOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                            {/* Activate / Deactivate */}
                            <button
                              title={w.isActive ? 'Deactivate Waiter' : 'Activate Waiter'}
                              onClick={() => {
                                setStatusWaiterTarget(w);
                                setStatusWaiterOpen(true);
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                w.isActive
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              }`}
                            >
                              {w.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>
                            {/* Soft Delete */}
                            <button
                              title="Remove Waiter"
                              onClick={() => {
                                setDeleteWaiterTarget(w);
                                setDeleteWaiterOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t text-xs" style={{ borderColor: 'var(--border)' }}>
              <span className="text-slate-400">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} waiters
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setWaiterPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-40 hover:bg-slate-500/10 transition"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 font-bold" style={{ color: 'var(--text-primary)' }}>
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setWaiterPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-40 hover:bg-slate-500/10 transition"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Waiter Modals (rendered at Users view level so all actions work from all tabs)
   */
  const renderWaiterModals = () => {
    return (
      <>
        {/* ── Create Waiter Modal ── */}
        <Modal open={createWaiterOpen} onClose={() => setCreateWaiterOpen(false)} title="Add New Waiter">
          <form onSubmit={handleCreateWaiterSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <span className="font-bold block flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                Automatic Role & Tenant Isolation
              </span>
              This account will automatically receive the <strong>WAITER</strong> role and be assigned strictly to your business.
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Kelvin Mutua"
                value={waiterFullName}
                onChange={(e) => {
                  setWaiterFullName(e.target.value);
                  setWaiterErrors(prev => ({ ...prev, fullName: validateWaiterField('fullName', e.target.value) }));
                }}
                className={`w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 ${waiterErrors.fullName ? 'border-red-400 focus:ring-red-400' : 'focus:ring-emerald-500'}`}
                style={{ background: 'var(--bg-body)', borderColor: waiterErrors.fullName ? undefined : 'var(--border)', color: 'var(--text-primary)' }}
              />
              {waiterErrors.fullName && <p className="text-[10px] text-red-500 mt-0.5 font-semibold">{waiterErrors.fullName}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Email Address *</label>
              <input
                type="email"
                required
                placeholder="e.g. kelvin.waiter@yourbusiness.co.ke"
                value={waiterEmail}
                onChange={(e) => {
                  setWaiterEmail(e.target.value);
                  setWaiterErrors(prev => ({ ...prev, email: validateWaiterField('email', e.target.value) }));
                }}
                className={`w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 ${waiterErrors.email ? 'border-red-400 focus:ring-red-400' : 'focus:ring-emerald-500'}`}
                style={{ background: 'var(--bg-body)', borderColor: waiterErrors.email ? undefined : 'var(--border)', color: 'var(--text-primary)' }}
              />
              {waiterErrors.email && <p className="text-[10px] text-red-500 mt-0.5 font-semibold">{waiterErrors.email}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Phone Number (Optional)</label>
              <div className="flex">
                <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 text-xs font-semibold select-none" style={{ background: 'var(--bg-body)', borderColor: waiterErrors.phone ? '#f87171' : 'var(--border)', color: 'var(--text-muted)' }}>
                  +254
                </span>
                <input
                  type="tel"
                  maxLength={9}
                  placeholder="7XX XXX XXX"
                  value={waiterPhone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9);
                    setWaiterPhone(clean);
                    setWaiterErrors(prev => ({ ...prev, phone: validateWaiterField('phone', clean) }));
                  }}
                  className={`w-full rounded-r-xl border p-2.5 text-xs outline-none focus:ring-2 ${waiterErrors.phone ? 'border-red-400 focus:ring-red-400' : 'focus:ring-emerald-500'}`}
                  style={{ background: 'var(--bg-body)', borderColor: waiterErrors.phone ? undefined : 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex items-center justify-between">
                {waiterErrors.phone ? <p className="text-[10px] text-red-500 font-semibold">{waiterErrors.phone}</p> : <span />}
                <span className="text-[10px] text-slate-400 font-mono ml-auto">{waiterPhone.length}/9 digits</span>
              </div>
            </div>


            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500">Initial Password *</label>
                <button
                  type="button"
                  onClick={generateSecureWaiterPassword}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Auto-generate
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Minimum 6 characters"
                value={waiterPassword}
                onChange={(e) => setWaiterPassword(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <p className="text-[10px] text-slate-400">The waiter will be prompted to change this password on their first login.</p>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setCreateWaiterOpen(false)}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={waiterCreating}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {waiterCreating ? 'Creating...' : 'Create Waiter'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Edit Waiter Modal ── */}
        <Modal open={editWaiterOpen} onClose={() => setEditWaiterOpen(false)} title="Edit Waiter">
          <form onSubmit={handleEditWaiterSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border text-xs text-slate-500 space-y-1" style={{ borderColor: 'var(--border)' }}>
              <span className="font-bold block">Permitted Fields Only</span>
              Role and business assignment cannot be modified through this form.
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Full Name *</label>
              <input
                type="text"
                required
                value={editWaiterFullName}
                onChange={(e) => setEditWaiterFullName(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Email Address *</label>
              <input
                type="email"
                required
                value={editWaiterEmail}
                onChange={(e) => setEditWaiterEmail(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Phone Number (Optional)</label>
              <div className="flex">
                <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 text-xs font-semibold select-none" style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  +254
                </span>
                <input
                  type="tel"
                  maxLength={9}
                  placeholder="7XX XXX XXX"
                  value={editWaiterPhone}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9);
                    setEditWaiterPhone(clean);
                  }}
                  className="w-full rounded-r-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex justify-end">
                <span className="text-[10px] text-slate-400 font-mono">{editWaiterPhone.length}/9 digits</span>
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setEditWaiterOpen(false)}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editWaiterSaving}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {editWaiterSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── View Waiter Detail Modal ── */}
        <Modal open={viewWaiterOpen} onClose={() => setViewWaiterOpen(false)} title="Waiter Details">
          {viewWaiterLoading ? (
            <div className="space-y-3 animate-pulse py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 w-full rounded-xl bg-slate-500/10" />
              ))}
            </div>
          ) : viewWaiterData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <div className="h-12 w-12 rounded-xl bg-emerald-600/20 text-emerald-600 font-black text-lg flex items-center justify-center">
                  {viewWaiterData.fullName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{viewWaiterData.fullName}</div>
                  <div className="text-xs text-slate-500">{viewWaiterData.email}</div>
                  <StatusBadge status={viewWaiterData.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                </div>
              </div>

              {/* Order Performance Highlights */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Claimed</span>
                  <span className="text-base font-black text-purple-600">
                    {viewWaiterData.activitySummary?.ordersClaimed ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Completed</span>
                  <span className="text-base font-black text-emerald-600">
                    {viewWaiterData.activitySummary?.ordersCompleted ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Active</span>
                  <span className="text-base font-black text-amber-600">
                    {viewWaiterData.activitySummary?.activeOrders ?? 0}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { label: 'Phone', value: viewWaiterData.phone || '—' },
                  { label: 'Role', value: 'Waiter' },
                  { label: 'Business', value: viewWaiterData.business?.name || '—' },
                  { label: 'Account Age', value: `${viewWaiterData.activitySummary?.accountAgeDays ?? 0} days` },
                  { label: 'Email Verified', value: viewWaiterData.emailVerified ? 'Yes' : 'No' },
                  { label: 'Password Status', value: viewWaiterData.mustChangePassword ? 'Password reset required on login' : 'Active' },
                  { label: 'Date Added', value: new Date(viewWaiterData.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) },
                  { label: 'Last Updated', value: new Date(viewWaiterData.updatedAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) },
                  { label: 'Last Login', value: viewWaiterData.lastLoginAt ? new Date(viewWaiterData.lastLoginAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Never logged in' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setViewWaiterOpen(false);
                    openEditWaiter(viewWaiterData);
                  }}
                  className="flex-1 py-2 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition flex items-center justify-center gap-1.5"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    setViewWaiterOpen(false);
                    setResetWaiterPwdTarget(viewWaiterData);
                    setResetWaiterPwdCustom('');
                    setResetWaiterPwdResult(null);
                    setResetWaiterPwdOpen(true);
                  }}
                  className="flex-1 py-2 rounded-xl border border-purple-200 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" /> Reset Password
                </button>
                <button
                  onClick={() => {
                    setViewWaiterOpen(false);
                    setStatusWaiterTarget(viewWaiterData);
                    setStatusWaiterOpen(true);
                  }}
                  className={`flex-1 py-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    viewWaiterData.isActive
                      ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {viewWaiterData.isActive ? (
                    <><UserX className="h-3.5 w-3.5" /> Deactivate</>
                  ) : (
                    <><UserCheck className="h-3.5 w-3.5" /> Activate</>
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>

        {/* ── Reset Password Modal ── */}
        <Modal
          open={resetWaiterPwdOpen}
          onClose={() => { setResetWaiterPwdOpen(false); setResetWaiterPwdTarget(null); setResetWaiterPwdResult(null); }}
          title={`Reset Password — ${resetWaiterPwdTarget?.fullName}`}
          size="md"
        >
          {resetWaiterPwdResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Password Reset Successfully Initiated</span>
                </div>
                <p className="text-xs">
                  Share this temporary password with <strong>{resetWaiterPwdTarget?.fullName}</strong>. They will be forced to choose a new password upon logging in.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border font-mono font-black text-sm select-all" style={{ borderColor: 'var(--border)' }}>
                    {resetWaiterPwdResult.temporaryPassword}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetWaiterPwdResult.temporaryPassword);
                      showToast('Temporary password copied!', 'success');
                    }}
                    className="p-2.5 rounded-xl border hover:bg-slate-500/10 text-xs font-bold transition flex items-center gap-1.5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setResetWaiterPwdOpen(false); setResetWaiterPwdTarget(null); setResetWaiterPwdResult(null); }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetWaiterPasswordSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                <span className="font-bold block flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Security Notice
                </span>
                Resetting the password will immediately invalidate all of <strong>{resetWaiterPwdTarget?.fullName}</strong>'s active sessions and tokens.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Custom Temporary Password (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-generate a secure password"
                  value={resetWaiterPwdCustom}
                  onChange={(e) => setResetWaiterPwdCustom(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="text-[10px] text-slate-400">If left empty, a 10-character secure alphanumeric password will be generated.</p>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setResetWaiterPwdOpen(false); setResetWaiterPwdTarget(null); }}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetWaiterPwdBusy}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition disabled:opacity-60"
                >
                  {resetWaiterPwdBusy ? 'Resetting...' : 'Confirm Password Reset'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* ── Activate / Deactivate Confirmation Modal ── */}
        <Modal
          open={statusWaiterOpen}
          onClose={() => { setStatusWaiterOpen(false); setStatusWaiterTarget(null); }}
          title={statusWaiterTarget?.isActive ? 'Deactivate Waiter' : 'Activate Waiter'}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {statusWaiterTarget?.isActive ? (
                <>
                  Are you sure you want to <strong className="text-amber-600">deactivate</strong> <strong>{statusWaiterTarget?.fullName}</strong>?
                  They will immediately lose access and all active sessions will be revoked.
                </>
              ) : (
                <>
                  Activate <strong>{statusWaiterTarget?.fullName}</strong>? They will be able to log in again.
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setStatusWaiterOpen(false); setStatusWaiterTarget(null); }}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmToggleWaiterStatus}
                disabled={statusWaiterBusy}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition disabled:opacity-60 ${
                  statusWaiterTarget?.isActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusWaiterBusy ? 'Processing...' : statusWaiterTarget?.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Confirmation Modal ── */}
        <Modal
          open={deleteWaiterOpen}
          onClose={() => { setDeleteWaiterOpen(false); setDeleteWaiterTarget(null); }}
          title="Remove Waiter"
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              <strong>Warning:</strong> This will permanently remove <strong>{deleteWaiterTarget?.fullName}</strong> from your business. Their order history will be preserved but they will no longer be able to log in.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteWaiterOpen(false); setDeleteWaiterTarget(null); }}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-500/10 transition"
                style={{ borderColor: 'var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWaiter}
                disabled={deleteWaiterBusy}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-60"
              >
                {deleteWaiterBusy ? 'Removing...' : 'Remove Waiter'}
              </button>
            </div>
          </div>
        </Modal>
      </>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 6: ORDERS OVERSIGHT VIEW
  ───────────────────────────────────────────────────────────── */
  const renderOrdersView = () => {
    const filteredOrders = orders.filter((o) => {
      const tableDisplay = getOrderTableDisplay(o);
      const paymentRaw = getOrderPaymentMethodRaw(o);
      const paymentDisplay = getOrderPaymentMethodDisplay(o);
      const matchSearch =
        o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
        tableDisplay.toLowerCase().includes(orderSearch.toLowerCase()) ||
        paymentRaw.toLowerCase().includes(orderSearch.toLowerCase()) ||
        paymentDisplay.toLowerCase().includes(orderSearch.toLowerCase()) ||
        String(o.table?.tableNumber || o.tableNumber || '').includes(orderSearch);
      const matchStatus = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
      return matchSearch && matchStatus;
    });

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* Top Header Section (Title + Filters) - Fixed / Sticky */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                Business Orders Oversight
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Complete audit and history of all customer orders in {businessName}
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              {filteredOrders.length} Total Orders Found
            </span>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 px-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Order # or Table..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Status:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="w-full rounded-xl border p-2 text-xs outline-none"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="ALL">All Order Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="CLAIMED">CLAIMED</option>
                <option value="PREPARING">PREPARING</option>
                <option value="READY">READY</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table - Fills remaining viewport height and scrolls */}
        <div className="p-5 rounded-2xl border shadow-sm flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full min-w-[880px] text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="font-bold whitespace-nowrap">
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Order #</th>
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Table Seating</th>
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Items Summary</th>
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Total Amount</th>
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Payment Method</th>
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Order Status</th>
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Waiter</th>
                  <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No orders matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr
                      key={o.orderUuid}
                      onClick={() => setSelectedOrder(o)}
                      className="hover:bg-slate-500/5 cursor-pointer transition-colors"
                    >
                      <td className="py-3 font-bold text-blue-600 whitespace-nowrap">#{o.orderNumber}</td>
                      <td className="py-3 font-semibold whitespace-nowrap">{getOrderTableDisplay(o)}</td>
                      <td className="py-3 text-slate-500">
                        {o.orderItems?.map((i) => `${i.quantity}x ${i.productName || i.product?.name || 'Item'}`).join(', ') || 'No items'}
                      </td>
                      <td className="py-3 font-black text-emerald-600 whitespace-nowrap">{formatKsh(o.totalAmount)}</td>
                      <td className="py-3 font-semibold whitespace-nowrap">
                        {(() => {
                          const pm = getOrderPaymentMethodRaw(o);
                          const label = getOrderPaymentMethodDisplay(o);
                          if (pm === 'CASH') {
                            return <span className="inline-flex items-center gap-1 font-bold text-amber-500 dark:text-amber-400">{label}</span>;
                          }
                          if (pm === 'CARD') {
                            return <span className="inline-flex items-center gap-1 font-bold text-blue-500 dark:text-blue-400">{label}</span>;
                          }
                          return <span className="inline-flex items-center gap-1 font-bold text-emerald-500 dark:text-emerald-400">{label}</span>;
                        })()}
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">{o.waiter?.fullName || 'Unassigned'}</td>
                      <td className="py-3 text-slate-400 whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Details Drawer/Modal */}
        {selectedOrder && (
          <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order Details #${selectedOrder.orderNumber}`} size="lg">
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-500/5 border" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-xs text-slate-500">Table Placement</span>
                  <div className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
                    {getOrderTableDisplay(selectedOrder)}{selectedOrder.table?.sectionName ? ` (${selectedOrder.table.sectionName})` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Total Bill</span>
                  <div className="text-xl font-black text-emerald-600">{formatKsh(selectedOrder.totalAmount)}</div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-400">Itemized Breakdown</h4>
                <div className="divide-y border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {selectedOrder.orderItems?.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs" style={{ background: 'var(--bg-body)' }}>
                      <div>
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                          {item.quantity}x {item.productName || item.product?.name || 'Product'}
                        </span>
                        {item.notes && <p className="text-[10px] text-amber-600">Note: {item.notes}</p>}
                      </div>
                      <span className="font-bold text-emerald-600">{formatKsh(item.subtotal || item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-slate-500">Order Status:</span>
                  <div className="mt-1"><StatusBadge status={selectedOrder.status} /></div>
                </div>
                <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-slate-500">Payment Status:</span>
                  <div className="mt-1"><StatusBadge status={selectedOrder.paymentStatus} /></div>
                </div>
                <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-slate-500">Payment Method:</span>
                  <div className="mt-1 font-bold">
                    {(() => {
                      const pm = getOrderPaymentMethodRaw(selectedOrder);
                      const label = getOrderPaymentMethodDisplay(selectedOrder);
                      if (pm === 'CASH') return <span className="text-amber-500 dark:text-amber-400">{label}</span>;
                      if (pm === 'CARD') return <span className="text-blue-500 dark:text-blue-400">{label}</span>;
                      return <span className="text-emerald-500 dark:text-emerald-400">{label}</span>;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 5: SALES & REVENUE VIEW
  ───────────────────────────────────────────────────────────── */
  const renderSalesView = () => {
    const kpis = analytics?.kpis || {
      totalRevenue: businessSummary?.totalRevenue || 0,
      totalOrders: businessSummary?.totalOrders || 0,
      completedOrders: businessSummary?.completedOrders || 0,
      averageOrderValue: 0,
    };

    const pendingSettlementPayments = payments.filter((p) => p.paymentStatus === 'PENDING' || p.paymentStatus === 'PROCESSING');
    const pendingSettlementOrders = orders.filter((o) => o.paymentStatus === 'PENDING' && o.status !== 'CANCELLED');
    const pendingSettlementsAmount =
      pendingSettlementPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0) ||
      pendingSettlementOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const pendingSettlementsCount = pendingSettlementPayments.length || pendingSettlementOrders.length;

    const paymentBreakdown = analytics?.paymentBreakdown || {
      mpesa: { count: 0, percentage: 0 },
      card: { count: 0, percentage: 0 },
      cash: { count: 0, percentage: 0 },
    };

    const pieData = [
      { name: 'M-Pesa STK', value: paymentBreakdown.mpesa.count, color: '#16A34A' },
      { name: 'Card POS', value: paymentBreakdown.card.count, color: '#2563EB' },
      { name: 'Cash', value: paymentBreakdown.cash.count, color: '#F59E0B' },
    ].filter((d) => d.value > 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              Sales & Financial Revenue
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Business earnings, payment settlement distributions, and category analysis
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAnalyticsPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  analyticsPeriod === p
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Financial KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Total Settled Revenue</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{formatKsh(kpis.totalRevenue)}</div>
            <span className="text-[10px] text-slate-500">Across {kpis.completedOrders} orders</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Pending Settlements</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{formatKsh(pendingSettlementsAmount)}</div>
            <span className="text-[10px] text-amber-600 font-semibold">{pendingSettlementsCount} pending transactions</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Total Orders</span>
            <div className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
              {kpis.totalOrders}
            </div>
            <span className="text-[10px] text-blue-600 font-semibold">{kpis.completedOrders} completed</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Average Order Value</span>
            <div className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
              {formatKsh(kpis.averageOrderValue || Math.round(kpis.totalRevenue / (kpis.completedOrders || 1)))}
            </div>
            <span className="text-[10px] text-purple-600 font-semibold">Per completed basket</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">M-Pesa Share</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {paymentBreakdown.mpesa.percentage}%
            </div>
            <span className="text-[10px] text-slate-500 font-semibold">{paymentBreakdown.mpesa.count} M-Pesa STK pushes</span>
          </div>
        </div>

        {/* Charts: Revenue Timeline & Payment Channels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-5 rounded-2xl border flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-black mb-1" style={{ color: 'var(--text-primary)' }}>
              Revenue Performance ({analyticsPeriod})
            </h4>
            <p className="text-xs text-slate-500 mb-4">Calculated from verified payment settlements</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.dailyRevenue || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `KSh ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                    }}
                    formatter={(val: any) => [formatKsh(Number(val)), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#16A34A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded-2xl border flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-black mb-1" style={{ color: 'var(--text-primary)' }}>
              Payment Methods Breakdown
            </h4>
            <p className="text-xs text-slate-500 mb-4">Volume by payment channel</p>
            <div className="h-52 w-full flex items-center justify-center">
              {pieData.length === 0 ? (
                <div className="text-xs text-slate-400 text-center">No payment data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 6: PAYMENTS VIEW
  ───────────────────────────────────────────────────────────── */
  const renderPaymentsView = () => {
    const filteredPayments = payments.filter((p) => {
      const matchMethod = paymentMethodFilter === 'ALL' || p.paymentMethod === paymentMethodFilter;
      const matchStatus = paymentStatusFilter === 'ALL' || p.paymentStatus === paymentStatusFilter;
      return matchMethod && matchStatus;
    });

    const totalPaid = payments
      .filter((p) => p.paymentStatus === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPending = payments
      .filter((p) => p.paymentStatus === 'PENDING' || p.paymentStatus === 'PROCESSING')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              Payment Transactions & Settlements
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Audit logs for M-Pesa STK pushes, POS card payments, and cash receipts
            </p>
          </div>
        </div>

        {/* Payments Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Total Settled</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{formatKsh(totalPaid)}</div>
            <span className="text-[10px] text-emerald-600 font-semibold">Verified received funds</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Pending Settlements</span>
            <div className="text-2xl font-black text-amber-600 mt-1">{formatKsh(totalPending)}</div>
            <span className="text-[10px] text-amber-600 font-semibold">In processing / awaiting waiter</span>
          </div>

          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-bold text-slate-500">Total Transactions</span>
            <div className="text-2xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
              {payments.length}
            </div>
            <span className="text-[10px] text-blue-600 font-semibold">All channels combined</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Payment Channel:</span>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full rounded-xl border p-2 text-xs outline-none"
              style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">All Methods</option>
              <option value="MPESA_STK">M-Pesa STK Push</option>
              <option value="CARD">Card POS</option>
              <option value="CASH">Cash Settlement</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Settlement Status:</span>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full rounded-xl border p-2 text-xs outline-none"
              style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="p-5 rounded-2xl border flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="max-h-[calc(100vh-300px)] min-h-[300px] overflow-x-auto overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full min-w-[780px] text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="font-bold whitespace-nowrap">
                  <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Receipt / Ref</th>
                  <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Order Ref</th>
                  <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Amount</th>
                  <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Method</th>
                  <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Status</th>
                  <th className="py-3 pr-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Customer Phone / Waiter</th>
                  <th className="py-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No payment records found.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.paymentUuid} className="hover:bg-slate-500/5 transition-colors">
                      <td className="py-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {p.mpesaReceiptNumber || p.checkoutRequestId?.slice(-8) || p.paymentUuid.slice(0, 8)}
                      </td>
                      <td className="py-3 font-semibold whitespace-nowrap">
                        {p.order?.orderNumber ? `#${p.order.orderNumber}` : p.orderUuid.slice(0, 8)}
                      </td>
                      <td className="py-3 font-black text-emerald-600 whitespace-nowrap">{formatKsh(p.amount)}</td>
                      <td className="py-3 font-semibold whitespace-nowrap">{p.paymentMethod}</td>
                      <td className="py-3 whitespace-nowrap">
                        <StatusBadge status={p.paymentStatus} />
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">
                        {p.phoneNumber || p.order?.waiter?.fullName || '—'}
                      </td>
                      <td className="py-3 text-slate-400 whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 7: STAFF PERFORMANCE VIEW
  ───────────────────────────────────────────────────────────── */
  const renderStaffPerformance = () => {
    const waiterStats = (Array.isArray(analytics?.waiterPerformance) && analytics.waiterPerformance.length > 0)
      ? analytics.waiterPerformance
      : (() => {
          const wMap: Record<string, { name: string; ordersServed: number; revenueGenerated: number; avgFulfillmentMins: number }> = {};
          orders.forEach((o) => {
            const wName = o.waiter?.fullName || (o as any).waiterName;
            if (wName) {
              if (!wMap[wName]) {
                wMap[wName] = { name: wName, ordersServed: 0, revenueGenerated: 0, avgFulfillmentMins: 5 };
              }
              wMap[wName].ordersServed += 1;
              if (o.paymentStatus === 'PAID' || o.status === 'COMPLETED' || o.status === 'DELIVERED') {
                wMap[wName].revenueGenerated += Number(o.totalAmount || 0);
              }
            }
          });
          return Object.values(wMap);
        })();
    const waiters = (Array.isArray(staffList) ? staffList : []).filter((s) => s.role === 'WAITER');
    const managerList = Array.isArray(managers) ? managers : [];

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* Top sticky section: Title & Management/Waiter cards */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                Staff Performance & Accountability
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Fulfillment metrics and orders handled across {businessName} staff
              </p>
            </div>
          </div>

          {/* Manager & Waiter Counts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                  Management Team ({managerList.length})
                </h4>
              </div>
              <p className="text-xs text-slate-500 mb-3">Managers oversee waiter dispatch and menu operations.</p>
              <div className="space-y-2">
                {managerList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No managers assigned to this business yet.</p>
                ) : (
                  managerList.map((m) => (
                    <div key={m.userUuid || m.email || String(Math.random())} className="flex items-center justify-between p-2 rounded-xl bg-slate-500/5 text-xs">
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{m.fullName || m.email}</span>
                      <StatusBadge status={m.isActive ? 'ACTIVE' : 'SUSPENDED'} />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 mb-2">
                <Award className="h-5 w-5 text-purple-600" />
                <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                  Waiter Dispatch Force ({waiters.length})
                </h4>
              </div>
              <p className="text-xs text-slate-500 mb-3">Waiters claim table orders and collect POS/Cash payments.</p>
              <div className="text-xs text-slate-400">
                {waiters.length} registered waiters ready for table service.
              </div>
            </div>
          </div>
        </div>

        {/* Waiters Performance Table */}
        <div className="flex-1 min-h-[280px] p-5 rounded-2xl border flex flex-col shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h4 className="text-sm font-black mb-3 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
            Waiter Order Handling Metrics
          </h4>
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 w-full">
            <table className="w-full min-w-[650px] text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="border-b font-bold whitespace-nowrap" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <th className="py-2.5 px-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Waiter Name</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Orders Served</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Revenue Collected</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Avg Fulfillment Time</th>
                  <th className="py-2.5 px-3 whitespace-nowrap border-b sticky top-0 z-10 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {waiterStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No order fulfillment data recorded yet.
                    </td>
                  </tr>
                ) : (
                  waiterStats.map((w, idx) => (
                    <tr key={idx} className="hover:bg-slate-500/5 transition-colors">
                      <td className="py-3 px-3 font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {w.name}
                      </td>
                      <td className="py-3 px-3 font-bold text-blue-600 whitespace-nowrap">{w.ordersServed} orders</td>
                      <td className="py-3 px-3 font-black text-emerald-600 whitespace-nowrap">{formatKsh(w.revenueGenerated)}</td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{w.avgFulfillmentMins} mins</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          High
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 8: REPORTS & ANALYTICS VIEW
     Endpoints:
       GET /api/v1/reports/admin/overview
       GET /api/v1/reports/admin/revenue
       GET /api/v1/reports/admin/orders
       GET /api/v1/reports/admin/payments
       GET /api/v1/reports/admin/products
       GET /api/v1/reports/admin/categories
       GET /api/v1/reports/admin/waiters
       GET /api/v1/reports/admin/export (CSV download)
     - Tenant scope resolved server-side from live DB record
     - No businessUuid sent from frontend
     - Revenue uses paidAt and paymentStatus=PAID only
  ───────────────────────────────────────────────────────────── */

  const REPORT_RANGES: { value: ReportRangeType; label: string }[] = [
    { value: 'TODAY', label: 'Today' },
    { value: 'YESTERDAY', label: 'Yesterday' },
    { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
    { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
    { value: 'THIS_WEEK', label: 'This Week' },
    { value: 'LAST_WEEK', label: 'Last Week' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'LAST_MONTH', label: 'Last Month' },
    { value: 'CUSTOM', label: 'Custom Range' },
  ];

  const REPORT_TABS: { key: typeof reportTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
    { key: 'revenue', label: 'Revenue', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { key: 'orders', label: 'Orders', icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { key: 'payments', label: 'Payments', icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: 'products', label: 'Products', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
    { key: 'users', label: 'Users', icon: <Users className="h-3.5 w-3.5" /> },
  ];

  const EXPORT_TYPE_MAP: Record<typeof reportTab, string> = {
    overview: 'REVENUE',
    revenue: 'REVENUE',
    orders: 'ORDERS',
    payments: 'PAYMENTS',
    products: 'PRODUCTS',
    users: 'WAITERS',
  };

  const buildReportQuery = () => {
    const params = new URLSearchParams({ range: reportRange });
    if (reportRange === 'CUSTOM' && reportCustomStart) params.append('startDate', reportCustomStart);
    if (reportRange === 'CUSTOM' && reportCustomEnd) params.append('endDate', reportCustomEnd);
    return params.toString();
  };

  const loadReportData = useCallback(async () => {
    if (reportRange === 'CUSTOM' && (!reportCustomStart || !reportCustomEnd)) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const qs = buildReportQuery();
      const endpointMap: Record<typeof reportTab, string> = {
        overview: `/reports/admin/overview?${qs}`,
        revenue: `/reports/admin/revenue?${qs}`,
        orders: `/reports/admin/orders?${qs}`,
        payments: `/reports/admin/payments?${qs}`,
        products: `/reports/admin/products?${qs}`,
        users: `/reports/admin/waiters?${qs}`,
      };
      const res = await authFetch(endpointMap[reportTab]);
      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setReportError(res.error?.message || 'Failed to load report data.');
      }
    } catch (err: any) {
      setReportError(err.message || 'Failed to load report data. Please try again.');
    } finally {
      setReportLoading(false);
    }
  }, [reportTab, reportRange, reportCustomStart, reportCustomEnd]);

  const handleExportCsv = async () => {
    if (reportRange === 'CUSTOM' && (!reportCustomStart || !reportCustomEnd)) {
      showToast('Please select both start and end dates for custom range.', 'error');
      return;
    }
    setExportingCsv(true);
    try {
      const qs = buildReportQuery();
      const exportType = EXPORT_TYPE_MAP[reportTab];
      const token = localStorage.getItem('orderup_token') || localStorage.getItem('drinkhub_token');
      const url = getApiUrl(`/reports/admin/export?${qs}&reportType=${exportType}`);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `${exportType.toLowerCase()}-report.csv`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      showToast(`${exportType} report downloaded successfully`, 'success');
    } catch (err: any) {
      showToast(err.message || 'CSV export failed.', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  useEffect(() => {
    if (page === 'reports') {
      loadReportData();
    }
  }, [page, reportTab, reportRange, reportCustomStart, reportCustomEnd, loadReportData]);

  const pct = (value: number | null) => {
    if (value === null || value === undefined) return { text: 'N/A', positive: null };
    return { text: `${value > 0 ? '+' : ''}${value}%`, positive: value >= 0 };
  };

  const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  const renderReportsView = () => {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              Reports & Analytics
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Insights strictly scoped to <span className="font-semibold">{businessName}</span>. Revenue counts only confirmed (paid) payments.
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            {exportingCsv ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-2">
            {REPORT_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => { setReportRange(r.value); setReportData(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  reportRange === r.value
                    ? 'bg-indigo-600 text-white'
                    : 'border text-sm'
                }`}
                style={reportRange !== r.value ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : {}}
              >
                {r.label}
              </button>
            ))}
          </div>
          {reportRange === 'CUSTOM' && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="date"
                  value={reportCustomStart}
                  onChange={(e) => setReportCustomStart(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border bg-transparent"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>End Date</label>
                <input
                  type="date"
                  value={reportCustomEnd}
                  onChange={(e) => setReportCustomEnd(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border bg-transparent"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <button
                onClick={loadReportData}
                disabled={!reportCustomStart || !reportCustomEnd}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Report Tabs */}
        <div className="flex overflow-x-auto gap-1 pb-1">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setReportTab(tab.key); setReportData(null); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                reportTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'border'
              }`}
              style={reportTab !== tab.key ? { borderColor: 'var(--border)', color: 'var(--text-secondary)' } : {}}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error State */}
        {reportError && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{reportError}</span>
            <button onClick={loadReportData} className="ml-auto font-bold underline">Retry</button>
          </div>
        )}

        {/* Loading Skeleton */}
        {reportLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
              ))}
            </div>
            <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
          </div>
        )}

        {/* Report Content */}
        {!reportLoading && !reportError && reportData && (
          <>
            {/* ── OVERVIEW TAB ── */}
            {reportTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Total Revenue',
                      value: formatKsh(reportData.revenue?.totalRevenue ?? 0),
                      sub: pct(reportData.revenue?.percentageChange),
                      icon: <DollarSign className="h-5 w-5" />,
                      color: 'text-emerald-600',
                    },
                    {
                      label: 'Total Orders',
                      value: reportData.orders?.totalOrders ?? 0,
                      sub: pct(reportData.orders?.percentageChange),
                      icon: <ClipboardList className="h-5 w-5" />,
                      color: 'text-blue-600',
                    },
                    {
                      label: 'Completed Orders',
                      value: reportData.orders?.completedOrders ?? 0,
                      sub: null,
                      icon: <CheckCircle2 className="h-5 w-5" />,
                      color: 'text-green-600',
                    },
                    {
                      label: 'Avg Order Value',
                      value: formatKsh(reportData.averageOrderValue ?? 0),
                      sub: null,
                      icon: <TrendingUp className="h-5 w-5" />,
                      color: 'text-indigo-600',
                    },
                  ].map((kpi, i) => (
                    <div key={i} className="p-4 rounded-2xl border space-y-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className={`${kpi.color} mb-1`}>{kpi.icon}</div>
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                      <div className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
                      {kpi.sub && kpi.sub.text !== 'N/A' && (
                        <div className={`text-xs font-semibold ${kpi.sub.positive ? 'text-green-600' : 'text-red-500'}`}>
                          {kpi.sub.positive ? <ArrowUpRight className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                          {kpi.sub.text} vs last period
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-2xl border text-xs" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <span className="font-semibold text-indigo-600">Period: </span>
                  {new Date(reportData.dateRange?.startDate).toLocaleDateString('en-KE')} — {new Date(reportData.dateRange?.endDate).toLocaleDateString('en-KE')}
                </div>
              </div>
            )}

            {/* ── REVENUE TAB ── */}
            {reportTab === 'revenue' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Revenue', value: formatKsh(reportData.totalRevenue ?? 0) },
                    { label: 'Prev Period', value: formatKsh(reportData.previousPeriodRevenue ?? 0) },
                    { label: 'Change', value: reportData.percentageChange !== null ? `${reportData.percentageChange}%` : 'N/A' },
                    { label: 'Avg Daily Revenue', value: formatKsh(reportData.averageDailyRevenue ?? 0) },
                  ].map((kpi, i) => (
                    <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                      <div className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
                {reportData.revenueTrend?.length > 0 && (
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="text-sm font-black mb-3" style={{ color: 'var(--text-primary)' }}>Revenue Trend</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={reportData.revenueTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `KSh ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} width={60} />
                        <Tooltip formatter={(v: any) => formatKsh(v)} labelFormatter={(l) => `Date: ${l}`} />
                        <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f120" strokeWidth={2} name="Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {(reportData.highestRevenueDay || reportData.lowestRevenueDay) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportData.highestRevenueDay && (
                      <div className="p-4 rounded-2xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                        <div className="text-xs font-bold text-green-700 dark:text-green-300 mb-1">Best Day</div>
                        <div className="text-sm font-black text-green-800 dark:text-green-200">{reportData.highestRevenueDay.date}</div>
                        <div className="text-xs text-green-600 dark:text-green-400">{formatKsh(reportData.highestRevenueDay.revenue)}</div>
                      </div>
                    )}
                    {reportData.lowestRevenueDay && (
                      <div className="p-4 rounded-2xl border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                        <div className="text-xs font-bold text-red-700 dark:text-red-300 mb-1">Lowest Day</div>
                        <div className="text-sm font-black text-red-800 dark:text-red-200">{reportData.lowestRevenueDay.date}</div>
                        <div className="text-xs text-red-600 dark:text-red-400">{formatKsh(reportData.lowestRevenueDay.revenue)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ORDERS TAB ── */}
            {reportTab === 'orders' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Orders', value: reportData.totalOrders ?? 0 },
                    { label: 'Completed', value: reportData.completedOrders ?? 0 },
                    { label: 'Cancelled', value: reportData.cancelledOrders ?? 0 },
                    { label: 'Avg / Day', value: reportData.averageOrdersPerDay ?? 0 },
                  ].map((kpi, i) => (
                    <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                      <div className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
                {reportData.orderTrend?.length > 0 && (
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="text-sm font-black mb-3" style={{ color: 'var(--text-primary)' }}>Order Trend</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reportData.orderTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip labelFormatter={(l) => `Date: ${l}`} />
                        <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="count" name="Total" fill="#6366f1" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="completedCount" name="Completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="cancelledCount" name="Cancelled" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {reportData.statusDistribution?.length > 0 && (
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="text-sm font-black mb-3" style={{ color: 'var(--text-primary)' }}>Status Distribution</div>
                    <div className="space-y-2">
                      {reportData.statusDistribution.filter((s: any) => s.count > 0).map((s: any, i: number) => (
                        <div key={s.status} className="flex items-center gap-3">
                          <div className="text-xs w-28 font-semibold" style={{ color: 'var(--text-secondary)' }}>{s.status}</div>
                          <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                            <div className="h-2 rounded-full" style={{ width: `${s.percentage}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                          <div className="text-xs w-16 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>{s.count} ({s.percentage}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PAYMENTS TAB ── */}
            {reportTab === 'payments' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Settled Revenue', value: formatKsh(reportData.totalSettledRevenue ?? 0), color: 'text-emerald-600' },
                    { label: 'Successful', value: reportData.successfulPayments ?? 0, color: 'text-green-600' },
                    { label: 'Failed', value: reportData.failedPayments ?? 0, color: 'text-red-600' },
                    { label: 'Refunded', value: reportData.refundedPayments ?? 0, color: 'text-orange-600' },
                  ].map((kpi, i) => (
                    <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                      <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
                {reportData.paymentMethodBreakdown?.length > 0 && (
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="text-sm font-black mb-3" style={{ color: 'var(--text-primary)' }}>By Payment Method</div>
                    <div className="overflow-x-auto overflow-y-auto max-h-[360px] w-full" style={{ scrollbarWidth: 'thin' }}>
                      <table className="w-full min-w-[480px] text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                          <tr style={{ color: 'var(--text-muted)' }} className="font-bold whitespace-nowrap">
                            <th className="text-left py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Method</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Transactions</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Revenue</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {reportData.paymentMethodBreakdown.map((m: any, i: number) => (
                            <tr key={m.method} className="hover:bg-slate-500/5 transition-colors">
                              <td className="py-2.5 px-3 font-semibold whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>{m.method.replace('_', ' ')}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>{m.transactions}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b font-bold text-emerald-600" style={{ borderColor: 'var(--border)' }}>{formatKsh(m.revenue)}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>{m.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PRODUCTS TAB ── */}
            {reportTab === 'products' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Items Sold', value: reportData.totalProductsSold ?? 0 },
                    { label: 'Total Product Revenue', value: formatKsh(reportData.totalProductRevenue ?? 0) },
                  ].map((kpi, i) => (
                    <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                      <div className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
                {reportData.topProducts?.length > 0 && (
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="text-sm font-black mb-3" style={{ color: 'var(--text-primary)' }}>Top 10 Products</div>
                    <div className="overflow-x-auto overflow-y-auto max-h-[380px] w-full" style={{ scrollbarWidth: 'thin' }}>
                      <table className="w-full min-w-[640px] text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                          <tr style={{ color: 'var(--text-muted)' }} className="font-bold whitespace-nowrap">
                            <th className="text-left py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>#</th>
                            <th className="text-left py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Product</th>
                            <th className="text-left py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Category</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Qty Sold</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Revenue</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {reportData.topProducts.map((p: any, i: number) => (
                            <tr key={p.productUuid} className="hover:bg-slate-500/5 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-indigo-600 whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>{i + 1}</td>
                              <td className="py-2.5 px-3 font-semibold whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>{p.productName}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>{p.category}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b font-bold" style={{ borderColor: 'var(--border)' }}>{p.quantitySold}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b font-black text-emerald-600" style={{ borderColor: 'var(--border)' }}>{formatKsh(p.revenue)}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>{p.percentageOfTotalRevenue}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── USERS TAB ── */}
            {reportTab === 'users' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Claimed', value: reportData.totalOrdersClaimed ?? 0 },
                    { label: 'Total Completed', value: reportData.totalOrdersCompleted ?? 0 },
                    { label: 'Overall Completion Rate', value: `${reportData.overallCompletionRate ?? 0}%` },
                    { label: 'Active Users', value: reportData.waiters?.length ?? 0 },
                  ].map((kpi, i) => (
                    <div key={i} className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                      <div className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
                {reportData.waiters?.length > 0 && (
                  <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                    <div className="text-sm font-black mb-3" style={{ color: 'var(--text-primary)' }}>User / Staff Performance</div>
                    <div className="overflow-x-auto overflow-y-auto max-h-[420px] w-full" style={{ scrollbarWidth: 'thin' }}>
                      <table className="w-full min-w-[850px] text-xs border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                          <tr style={{ color: 'var(--text-muted)' }} className="font-bold whitespace-nowrap">
                            <th className="text-left py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>User</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Claimed</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Completed</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Cancelled</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Active</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Rate</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Revenue</th>
                            <th className="text-right py-2 px-3 font-semibold whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>Avg Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {reportData.waiters.map((w: any) => (
                            <tr key={w.waiterUuid} className="hover:bg-slate-500/5 transition-colors">
                              <td className="py-2.5 px-3 whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>
                                <div className="font-semibold">{w.fullName}</div>
                                <div style={{ color: 'var(--text-muted)' }}>{w.email}</div>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b font-semibold" style={{ borderColor: 'var(--border)' }}>{w.ordersClaimed}</td>
                              <td className="py-2.5 px-3 text-right text-green-600 whitespace-nowrap border-b font-bold" style={{ borderColor: 'var(--border)' }}>{w.ordersCompleted}</td>
                              <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap border-b font-bold" style={{ borderColor: 'var(--border)' }}>{w.ordersCancelled}</td>
                              <td className="py-2.5 px-3 text-right text-indigo-500 whitespace-nowrap border-b font-bold" style={{ borderColor: 'var(--border)' }}>{w.activeOrders}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>
                                <span className={`font-bold ${w.completionRate >= 80 ? 'text-green-600' : w.completionRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {w.completionRate}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b font-black text-emerald-600" style={{ borderColor: 'var(--border)' }}>{formatKsh(w.revenueHandled)}</td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                                {w.averageCompletionTimeMinutes > 0 ? `${w.averageCompletionTimeMinutes}m` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {(!reportData.waiters || reportData.waiters.length === 0) && (
                  <div className="p-8 text-center text-xs rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    No user performance data recorded for this period.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state: no data loaded yet */}
        {!reportLoading && !reportError && !reportData && (
          <div className="p-10 text-center text-xs rounded-2xl border space-y-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <div className="font-semibold">Select a date range to load report data</div>
            {reportRange === 'CUSTOM' && (!reportCustomStart || !reportCustomEnd) && (
              <div className="text-red-500">Please enter both start and end dates for custom range.</div>
            )}
          </div>
        )}

        {/* Data isolation notice */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-800">
          <Shield className="h-4 w-4 shrink-0" />
          <span>All report data is strictly scoped to <span className="font-bold">{businessName}</span>. No data from other businesses is ever included. Revenue counts only confirmed payments (paidAt timestamp).</span>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 9: BUSINESS PROFILE & SETTINGS VIEW
     Endpoints:
       GET   /api/v1/business/profile
       PATCH /api/v1/business/profile
       PATCH /api/v1/business/settings
       POST  /api/v1/business/logo
     - Scoped server-side to the authenticated ADMIN's live DB record
     - No businessUuid is sent from the frontend
  ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (page === 'settings') {
      loadBusinessProfile();
    }
  }, [page, loadBusinessProfile]);

  /**
   * Save Profile Information via PATCH /api/v1/business/profile
   */
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) {
      showToast('Business name is required.', 'error');
      return;
    }
    if (profPhone.trim()) {
      const digits = profPhone.replace(/\D/g, '');
      if (digits.length !== 9) {
        showToast('Phone number must be exactly 9 digits (e.g. 712345678)', 'error');
        return;
      }
    }

    try {
      setProfileSaving(true);
      const res = await authFetch('/business/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profName.trim(),
          description: profDescription.trim() || null,
          email: profEmail.trim() || null,
          phone: profPhone.trim() || null,
          address: profAddress.trim() || null,
          city: profCity.trim(),
          county: profCounty.trim(),
          country: profCountry.trim(),
        }),
      });

      if (res.success && res.data?.profile) {
        setBusinessProfile(res.data.profile);
        showToast('Business profile updated successfully!', 'success');
        loadDashboardData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update business profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  /**
   * Save Branding (Theme Color) via PATCH /api/v1/business/profile
   */
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (!hexRegex.test(brandThemeColor)) {
      showToast('Invalid hex color format. Example: #2563EB or #FFF', 'error');
      return;
    }

    try {
      setBrandingSaving(true);
      const res = await authFetch('/business/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          themeColor: brandThemeColor,
        }),
      });

      if (res.success && res.data?.profile) {
        setBusinessProfile(res.data.profile);
        showToast('Brand theme color updated successfully!', 'success');
        loadDashboardData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update branding settings', 'error');
    } finally {
      setBrandingSaving(false);
    }
  };

  /**
   * Resize image file to data URL (max 512px) to ensure crisp, lightweight display
   */
  const resizeImageToDataUrl = (file: File, maxDim = 512): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawUrl = e.target?.result as string;
        if (!rawUrl) return resolve('');
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/png', 0.92));
          } else {
            resolve(rawUrl);
          }
        };
        img.onerror = () => resolve(rawUrl);
        img.src = rawUrl;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  /**
   * Handle Logo File Upload via POST /api/v1/business/logo
   */
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showToast('Only image files (PNG, JPEG, WebP, GIF) are allowed.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Logo file size must be less than 5MB.', 'error');
      return;
    }

    try {
      setLogoUploading(true);
      // 1. Instant client-side resize and preview
      const dataUrl = await resizeImageToDataUrl(file, 512);
      if (dataUrl) {
        setBrandLogoUrl(dataUrl);
        setLogoPreviewError(false);
        setLogoError(false);
      }

      const formData = new FormData();
      formData.append('logo', file);
      if (dataUrl) {
        formData.append('logoUrl', dataUrl);
      }

      const res = await authFetch('/business/logo', {
        method: 'POST',
        body: formData,
      });

      const returnedUrl = res.data?.logoUrl || res.data?.imageUrl || res.data?.url || dataUrl;
      if (res.success && returnedUrl) {
        setBrandLogoUrl(returnedUrl);
        setLogoPreviewError(false);
        setLogoError(false);
        setBusinessProfile((prev: any) => (prev ? { ...prev, logoUrl: returnedUrl } : prev));
        showToast('Logo uploaded and saved successfully!', 'success');
        loadDashboardData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to upload business logo', 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  /**
   * Save 7-Day Operating Schedule via PATCH /api/v1/business/settings
   */
  const handleSaveOperatingSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verify all open days have valid times
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      const schedule = operatingSchedule[day];
      if (schedule.isOpen) {
        if (!schedule.openingTime || !schedule.closingTime) {
          showToast(`Please specify opening and closing times for ${day.charAt(0).toUpperCase() + day.slice(1)}.`, 'error');
          return;
        }
      }
    }

    try {
      setScheduleSaving(true);

      // Derive opening and closing hours from today's schedule (or first open day)
      // so legacy clients reading openingHours/closingHours stay in sync with the weekly schedule
      const now = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayKey = dayNames[now.getDay()];
      const todaySchedule = operatingSchedule[currentDayKey];
      const fallbackDay = days.find((d) => operatingSchedule[d]?.isOpen) || 'monday';
      const fallbackSchedule = operatingSchedule[fallbackDay] || operatingSchedule.monday;
      const resolvedSchedule = (todaySchedule && todaySchedule.isOpen) ? todaySchedule : fallbackSchedule;
      const computedOpening = resolvedSchedule?.openingTime || settingOpening || '08:00';
      const computedClosing = resolvedSchedule?.closingTime || settingClosing || '23:00';

      const res = await authFetch('/business/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          operatingSchedule,
          openingHours: computedOpening,
          closingHours: computedClosing,
        }),
      });

      if (res.success && res.data?.profile) {
        setBusinessProfile(res.data.profile);
        setSettingOpening(computedOpening);
        setSettingClosing(computedClosing);
        showToast('Operating hours updated successfully!', 'success');
        loadDashboardData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update operating hours', 'error');
    } finally {
      setScheduleSaving(false);
    }
  };

  const updateDaySchedule = (
    day: string,
    field: 'isOpen' | 'openingTime' | 'closingTime',
    value: any,
  ) => {
    setOperatingSchedule((prev: any) => {
      const currentDay = { ...prev[day], [field]: value };
      // Check overnight (closingTime < openingTime)
      if (currentDay.openingTime && currentDay.closingTime) {
        currentDay.crossesMidnight = currentDay.closingTime < currentDay.openingTime;
      }
      return { ...prev, [day]: currentDay };
    });
  };

  const renderBusinessSettings = () => {
    if (profileLoading && !businessProfile) {
      return (
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-64 rounded-xl bg-slate-500/20" />
          <div className="h-12 w-full rounded-2xl bg-slate-500/10" />
          <div className="h-96 w-full rounded-2xl bg-slate-500/10" />
        </div>
      );
    }

    if (profileError && !businessProfile) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm font-bold text-red-500">{profileError}</p>
          <button
            onClick={loadBusinessProfile}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      );
    }

    const DAYS_OF_WEEK = [
      { key: 'monday', label: 'Monday' },
      { key: 'tuesday', label: 'Tuesday' },
      { key: 'wednesday', label: 'Wednesday' },
      { key: 'thursday', label: 'Thursday' },
      { key: 'friday', label: 'Friday' },
      { key: 'saturday', label: 'Saturday' },
      { key: 'sunday', label: 'Sunday' },
    ];

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* ── Sticky Top Header & Tabs ── */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                  Business Profile & Settings
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Tenant Scoped
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Configure your public business profile, branding, and operating schedule.
              </p>
            </div>
            <button
              onClick={loadBusinessProfile}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:bg-slate-500/10 transition"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {/* ── Sub-Navigation Tabs ── */}
          <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            {[
              { key: 'profile', label: 'Profile & Location', icon: <Building2 className="h-4 w-4" /> },
              { key: 'branding', label: 'Branding & Theme', icon: <Sparkles className="h-4 w-4" /> },
              { key: 'hours', label: 'Operating Schedule', icon: <Clock className="h-4 w-4" /> },
              { key: 'compliance', label: 'Compliance & Legal', icon: <Shield className="h-4 w-4" /> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSettingsTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 ${
                  settingsTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-500/10'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable Tab Content Container ── */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">

        {/* ── Tab 1: Profile & Location ── */}
        {settingsTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="p-6 rounded-2xl border space-y-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                Business Profile Information
              </h3>
              <p className="text-xs text-slate-500">Public information displayed on QR menus and customer receipts</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Business Name *</label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Business Type</label>
                  <span className="text-[10px] text-slate-400">Set during provisioning (Read-only)</span>
                </div>
                <div
                  className="w-full rounded-xl border p-2.5 text-xs font-bold text-slate-500 bg-slate-500/10 flex items-center justify-between"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span>{businessProfile?.businessType || 'RESTAURANT'}</span>
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your venue, atmosphere, or dining specialties..."
                  value={profDescription}
                  onChange={(e) => setProfDescription(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Public Contact Email</label>
                <input
                  type="email"
                  placeholder="e.g. info@business.co.ke"
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Public Contact Phone</label>
                <div className="flex">
                  <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 text-xs font-semibold select-none" style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    +254
                  </span>
                  <input
                    type="tel"
                    maxLength={9}
                    placeholder="7XX XXX XXX"
                    value={profPhone.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9);
                      setProfPhone(clean);
                    }}
                    className="w-full rounded-r-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex justify-end">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {profPhone.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9).length}/9 digits
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-400">
                Physical Location
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">Street / Physical Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Parklands Road, Westlands"
                    value={profAddress}
                    onChange={(e) => setProfAddress(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">City</label>
                  <input
                    type="text"
                    value={profCity}
                    onChange={(e) => setProfCity(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">County / State</label>
                  <input
                    type="text"
                    value={profCounty}
                    onChange={(e) => setProfCounty(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">Country</label>
                  <input
                    type="text"
                    value={profCountry}
                    onChange={(e) => setProfCountry(e.target.value)}
                    className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-60"
              >
                {profileSaving ? 'Saving Profile...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab 2: Branding & Theme ── */}
        {settingsTab === 'branding' && (
          <div className="space-y-6">
            {/* Logo Upload Card */}
            <div className="p-6 rounded-2xl border space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                  Business Logo
                </h3>
                <p className="text-xs text-slate-500">Upload your logo (PNG, JPEG, WebP up to 5MB) for QR menus and receipts</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="h-24 w-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-slate-500/5 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                  {brandLogoUrl && !logoPreviewError ? (
                    <img
                      src={resolveImageUrl(brandLogoUrl)}
                      alt="Logo"
                      className="h-full w-full object-cover"
                      onError={() => setLogoPreviewError(true)}
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-slate-400" />
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition">
                    <Plus className="h-4 w-4" />
                    <span>{logoUploading ? 'Uploading Logo...' : 'Upload New Logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                    />
                  </label>
                  <p className="text-[11px] text-slate-400">Recommended size: 512x512 PNG with transparent background</p>
                </div>
              </div>
            </div>

            {/* Theme Accent Color Card */}
            <form onSubmit={handleSaveBranding} className="p-6 rounded-2xl border space-y-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                  Primary Brand Theme Color
                </h3>
                <p className="text-xs text-slate-500">Used to personalize the customer ordering UI, navigation bar, and active buttons</p>
              </div>

              <div className="space-y-4 max-w-xl">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Hex Color Code</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandThemeColor}
                      onChange={(e) => setBrandThemeColor(e.target.value)}
                      className="h-10 w-16 rounded-xl cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={brandThemeColor}
                      onChange={(e) => setBrandThemeColor(e.target.value)}
                      placeholder="#2563EB"
                      className="flex-1 rounded-xl border p-2.5 text-xs font-mono font-bold outline-none uppercase"
                      style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {/* Preset Colors */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400">Popular Presets</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0F172A', '#D97706'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBrandThemeColor(c)}
                        className={`h-7 w-7 rounded-lg border-2 transition ${
                          brandThemeColor.toUpperCase() === c.toUpperCase() ? 'border-blue-500 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={brandingSaving}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {brandingSaving ? 'Saving Theme...' : 'Save Brand Theme'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab 3: Operating Schedule ── */}
        {settingsTab === 'hours' && (
          <form onSubmit={handleSaveOperatingSchedule} className="p-6 rounded-2xl border space-y-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                7-Day Weekly Operating Schedule
              </h3>
              <p className="text-xs text-slate-500">Configure daily opening and closing hours. Overnight businesses closing past midnight are automatically supported.</p>
            </div>

            <div className="space-y-3 divide-y" style={{ borderColor: 'var(--border)' }}>
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const dayConfig = operatingSchedule[key] || { isOpen: true, openingTime: '08:00', closingTime: '23:00', crossesMidnight: false };
                const isOvernight = dayConfig.isOpen && dayConfig.openingTime && dayConfig.closingTime && dayConfig.closingTime < dayConfig.openingTime;

                return (
                  <div key={key} className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-[130px]">
                      <button
                        type="button"
                        onClick={() => updateDaySchedule(key, 'isOpen', !dayConfig.isOpen)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          dayConfig.isOpen ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            dayConfig.isOpen ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-xs font-bold ${dayConfig.isOpen ? '' : 'text-slate-400 line-through'}`} style={{ color: dayConfig.isOpen ? 'var(--text-primary)' : undefined }}>
                        {label}
                      </span>
                    </div>

                    {dayConfig.isOpen ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Opens:</span>
                          <input
                            type="time"
                            value={dayConfig.openingTime || '08:00'}
                            onChange={(e) => updateDaySchedule(key, 'openingTime', e.target.value)}
                            className="rounded-xl border p-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                            style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                          />
                        </div>

                        <span className="text-slate-400 text-xs">to</span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Closes:</span>
                          <input
                            type="time"
                            value={dayConfig.closingTime || '23:00'}
                            onChange={(e) => updateDaySchedule(key, 'closingTime', e.target.value)}
                            className="rounded-xl border p-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                            style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                          />
                        </div>

                        {isOvernight && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                            🌙 Overnight (Closes next day)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 italic">
                        Closed all day
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={scheduleSaving}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-60"
              >
                {scheduleSaving ? 'Saving Schedule...' : 'Save Operating Schedule'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab 4: Compliance & Legal ── */}
        {settingsTab === 'compliance' && (
          <div className="p-6 rounded-2xl border space-y-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                Business Compliance & Legal Agreements
              </h3>
              <p className="text-xs text-slate-500">
                Statutory regulatory governance under the Kenya Data Protection Act, 2019 and OrderUp Master Service Agreement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Privacy Policy Card */}
              <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Privacy Policy</h4>
                    <p className="text-[11px] text-slate-500">Kenya DPA 2019 Merchant Obligations</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Defines lawful data processing, merchant fiduciary duties, order record security, and customer privacy controls for this establishment.
                </p>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Accepted upon Onboarding
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                  >
                    View Policy
                  </button>
                </div>
              </div>

              {/* Terms of Service Card */}
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Terms of Service</h4>
                    <p className="text-[11px] text-slate-500">Master Service Agreement</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Defines multi-tenant licensing, administrative authority, M-Pesa automated reconciliation, catalog integrity, and service level standards.
                </p>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Accepted upon Onboarding
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                  >
                    View Terms
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  };


  /* ─────────────────────────────────────────────────────────────
     FEATURE 10: PROFILE VIEW
  ───────────────────────────────────────────────────────────── */
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdChanging, setPwdChanging] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPwd || !newPwd) {
      showToast('Please enter both current and new passwords', 'error');
      return;
    }
    const pwdVal = validateStrongPassword(newPwd);
    if (!pwdVal.isValid) {
      showToast(pwdVal.error || STRONG_PASSWORD_MESSAGE, 'error');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('New passwords do not match', 'error');
      return;
    }

    try {
      setPwdChanging(true);
      await authFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: currentPwd,
          newPassword: newPwd,
        }),
      });

      showToast('Password updated successfully!', 'success');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password', 'error');
    } finally {
      setPwdChanging(false);
    }
  };

  const renderProfileView = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
            Admin Account & Credentials
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Your account security and personal profile settings
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
              Personal Information
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Full Name</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{user.fullName || 'Business Admin'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Email Address</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-slate-500">Assigned Role</span>
                <span className="font-bold text-blue-600">ADMIN (Business Owner)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Assigned Business</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{businessName}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 rounded-2xl border space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
              Change Password
            </h4>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Current Password</label>
              <input
                type="password"
                required
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">New Password (Min 8 chars)</label>
              <input
                type="password"
                required
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <button
              type="submit"
              disabled={pwdChanging}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-60"
            >
              {pwdChanging ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE: CONSOLIDATED USERS VIEW (Managers + Waiters)
  ───────────────────────────────────────────────────────────── */
  const renderUsersView = () => {
    const managerList = managerListData?.managers || [];
    const waiterList = waiterListData?.waiters || [];
    const totalUsersCount =
      (managerListData?.summary?.totalManagers ?? managerList.length) +
      (waiterListData?.summary?.totalWaiters ?? waiterList.length);
    const activeManagersCount =
      managerListData?.summary?.activeManagers ?? managerList.filter((m) => m.isActive).length;
    const activeWaitersCount =
      waiterListData?.summary?.activeWaiters ?? waiterList.filter((w) => w.isActive).length;
    const totalOrdersCount = waiterList.reduce(
      (acc, w) => acc + (w.activitySummary?.ordersClaimed || 0),
      0,
    );

    const combinedUsers = [
      ...managerList.map((m) => ({
        ...m,
        userType: 'MANAGER' as const,
        managerUuid: m.managerUuid || m.userUuid,
        userUuid: m.userUuid || m.managerUuid,
      })),
      ...waiterList.map((w) => ({
        ...w,
        userType: 'WAITER' as const,
        waiterUuid: w.waiterUuid || w.userUuid,
        userUuid: w.userUuid || w.waiterUuid,
      })),
    ].filter((u) => {
      if (!allUsersSearch) return true;
      const q = allUsersSearch.toLowerCase();
      return (
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        u.userType.toLowerCase().includes(q)
      );
    });

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* Top Header & Sub-Navigation Tabs - Fixed at top */}
        <div className="flex-shrink-0 space-y-4">
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                  Users & Staff Management
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                  Staff Administration
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Manage accounts, roles, access permissions, and performance for managers and waiters in {businessName}.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  generateSecurePassword();
                  setCreateManagerOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add Manager
              </button>
              <button
                onClick={() => {
                  generateSecureWaiterPassword();
                  setCreateWaiterOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add Waiter
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl border w-fit shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <button
              onClick={() => setUserSubTab('all')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                userSubTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              All Users ({totalUsersCount})
            </button>
            <button
              onClick={() => setUserSubTab('managers')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                userSubTab === 'managers'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Managers ({managerListData?.summary?.totalManagers ?? managerList.length})
            </button>
            <button
              onClick={() => setUserSubTab('waiters')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                userSubTab === 'waiters'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Waiters ({waiterListData?.summary?.totalWaiters ?? waiterList.length})
            </button>
          </div>
        </div>

        {/* View based on sub-tab */}
        {userSubTab === 'managers' && renderManagersView()}
        {userSubTab === 'waiters' && renderWaitersView()}
        {userSubTab === 'all' && (
          <div className="flex-1 min-h-0 flex flex-col space-y-4">
            {/* KPI Summary Cards */}
            <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500">Total Users</span>
                  <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {totalUsersCount}
                  </div>
                  <span className="text-[10px] text-slate-400">Assigned staff accounts</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500">Active Managers</span>
                  <div className="text-2xl font-black text-blue-600 mt-0.5">
                    {activeManagersCount}
                  </div>
                  <span className="text-[10px] text-blue-600 font-semibold">Operational control</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500">Active Waiters</span>
                  <div className="text-2xl font-black text-emerald-600 mt-0.5">
                    {activeWaitersCount}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">Floor fulfillment staff</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border flex items-center gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500">Orders Handled</span>
                  <div className="text-2xl font-black text-purple-600 mt-0.5">
                    {totalOrdersCount}
                  </div>
                  <span className="text-[10px] text-purple-600 font-semibold">Total service activity</span>
                </div>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex-shrink-0 flex items-center gap-3 p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name, email, phone, or role..."
                value={allUsersSearch}
                onChange={(e) => setAllUsersSearch(e.target.value)}
                className="bg-transparent text-xs outline-none flex-1"
                style={{ color: 'var(--text-primary)' }}
              />
              {allUsersSearch && (
                <button
                  onClick={() => setAllUsersSearch('')}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Combined Users Table - Fills remaining height and scrolls */}
            <div className="p-5 rounded-2xl border shadow-sm flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)] min-h-[300px]" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full min-w-[760px] text-left text-xs border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20">
                    <tr className="font-bold whitespace-nowrap">
                      <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>User</th>
                      <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Role</th>
                      <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Phone</th>
                      <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Status</th>
                      <th className="py-3 px-3 whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Added</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap border-b sticky top-0 z-20 backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {combinedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="font-bold">No users found</p>
                          <p className="text-[11px] mt-1">Use the buttons above to add managers or waiters.</p>
                        </td>
                      </tr>
                    ) : (
                      combinedUsers.map((u: any) => {
                        const isMgr = u.userType === 'MANAGER';
                        const uuid = isMgr ? (u.managerUuid || u.userUuid) : (u.waiterUuid || u.userUuid);
                        return (
                          <tr key={`${u.userType}-${uuid}`} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                    isMgr
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  }`}
                                >
                                  {(u.fullName || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {u.fullName}
                                  </div>
                                  <div className="text-[11px] text-slate-400">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isMgr
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                }`}
                              >
                                {isMgr ? <Shield className="h-3 w-3" /> : <Award className="h-3 w-3" />}
                                {u.userType}
                              </span>
                            </td>
                            <td className="py-3 whitespace-nowrap text-slate-500">{u.phone || '—'}</td>
                            <td className="py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.isActive
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    u.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                />
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-3 whitespace-nowrap text-slate-400">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* View Details */}
                                <button
                                  onClick={() => {
                                    if (isMgr) {
                                      openViewManager(uuid);
                                    } else {
                                      openViewWaiter(uuid);
                                    }
                                  }}
                                  title="View Details"
                                  className="p-1.5 rounded-lg border hover:bg-blue-500/10 transition-colors"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <Eye className="h-3.5 w-3.5 text-blue-500" />
                                </button>
                                {/* Reset Password */}
                                <button
                                  onClick={() => {
                                    if (isMgr) {
                                      setResetPwdTarget(u);
                                      setResetPwdCustom('');
                                      setResetPwdResult(null);
                                      setResetPwdOpen(true);
                                    } else {
                                      setResetWaiterPwdTarget(u);
                                      setResetWaiterPwdCustom('');
                                      setResetWaiterPwdResult(null);
                                      setResetWaiterPwdOpen(true);
                                    }
                                  }}
                                  title="Reset Password"
                                  className="p-1.5 rounded-lg border hover:bg-amber-500/10 transition-colors"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <Key className="h-3.5 w-3.5 text-amber-600" />
                                </button>
                                {/* Edit User */}
                                <button
                                  onClick={() => {
                                    if (isMgr) {
                                      openEditManager(u);
                                    } else {
                                      openEditWaiter(u);
                                    }
                                  }}
                                  title="Edit User"
                                  className="p-1.5 rounded-lg border hover:bg-blue-500/10 transition-colors"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                                </button>
                                {/* Activate / Deactivate */}
                                <button
                                  onClick={() => {
                                    if (isMgr) {
                                      setStatusManagerTarget(u);
                                      setStatusManagerOpen(true);
                                    } else {
                                      setStatusWaiterTarget(u);
                                      setStatusWaiterOpen(true);
                                    }
                                  }}
                                  title={u.isActive ? 'Deactivate User' : 'Activate User'}
                                  className={`p-1.5 rounded-lg border transition-colors ${
                                    u.isActive ? 'hover:bg-amber-500/10 text-amber-600' : 'hover:bg-emerald-500/10 text-emerald-600'
                                  }`}
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                </button>
                                {/* Remove User */}
                                <button
                                  onClick={() => {
                                    if (isMgr) {
                                      setDeleteManagerTarget(u);
                                      setDeleteManagerOpen(true);
                                    } else {
                                      setDeleteWaiterTarget(u);
                                      setDeleteWaiterOpen(true);
                                    }
                                  }}
                                  title="Remove User"
                                  className="p-1.5 rounded-lg border hover:bg-red-500/10 transition-colors"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* User Management Modals (Mounted at Users level so all actions work across All Users, Managers, and Waiters) */}
        {renderManagerModals()}
        {renderWaiterModals()}
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     FEATURE 9: AUDIT LOGS VIEW
     Comprehensive audit trail capturing events for Admin, Manager, and Waiter
  ───────────────────────────────────────────────────────────── */
  const renderAuditLogsView = () => {
    const filteredLogs = auditLogs.filter(log => {
      const actorName = log.user?.fullName || log.user?.email || 'System';
      const actorRole = (log.user?.role || 'SYSTEM').toUpperCase();
      const action = (log.action || '').toUpperCase();
      const entity = (log.entityType || '').toUpperCase();
      const ip = log.ipAddress || '';
      const notes = JSON.stringify(log.newValues || '') + JSON.stringify(log.oldValues || '');

      // Role filter
      if (auditLogsRoleFilter !== 'ALL') {
        if (auditLogsRoleFilter === 'ADMIN' && actorRole !== 'ADMIN') return false;
        if (auditLogsRoleFilter === 'MANAGER' && actorRole !== 'MANAGER') return false;
        if (auditLogsRoleFilter === 'WAITER' && actorRole !== 'WAITER') return false;
        if (auditLogsRoleFilter === 'SYSTEM' && actorRole !== 'SYSTEM' && actorRole !== 'SUPER_ADMIN') return false;
      }

      // Action category filter
      if (auditLogsActionFilter !== 'ALL') {
        if (auditLogsActionFilter === 'ORDERS' && !action.includes('ORDER')) return false;
        if (auditLogsActionFilter === 'PAYMENTS' && !action.includes('PAYMENT')) return false;
        if (auditLogsActionFilter === 'USERS' && !action.includes('USER') && !action.includes('WAITER') && !action.includes('MANAGER')) return false;
        if (auditLogsActionFilter === 'MENU' && !action.includes('MENU')) return false;
        if (auditLogsActionFilter === 'BUSINESS' && !action.includes('BUSINESS')) return false;
      }

      // Search filter
      if (auditLogsSearch.trim()) {
        const q = auditLogsSearch.toLowerCase();
        return (
          action.toLowerCase().includes(q) ||
          actorName.toLowerCase().includes(q) ||
          actorRole.toLowerCase().includes(q) ||
          entity.toLowerCase().includes(q) ||
          ip.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q)
        );
      }

      return true;
    });

    const totalEvents = auditLogs.length;
    const adminEvents = auditLogs.filter(l => (l.user?.role || '').toUpperCase() === 'ADMIN').length;
    const managerEvents = auditLogs.filter(l => (l.user?.role || '').toUpperCase() === 'MANAGER').length;
    const waiterEvents = auditLogs.filter(l => (l.user?.role || '').toUpperCase() === 'WAITER').length;

    const handleExportAuditLogs = () => {
      const rows = filteredLogs.map(l => [
        l.action,
        l.user?.fullName || l.user?.email || 'System Worker',
        l.user?.role || 'SYSTEM',
        l.entityType ? `${l.entityType} (${l.entityUuid || 'N/A'})` : 'N/A',
        JSON.stringify(l.newValues || {}).replace(/"/g, '""'),
        l.ipAddress || '127.0.0.1',
        l.createdAt ? new Date(l.createdAt).toLocaleString() : 'N/A',
      ]);
      const headers = ['Action / Event', 'Actor', 'Role', 'Target Resource', 'Details', 'IP Address', 'Timestamp'];
      const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Audit logs exported successfully');
    };

    const getActionBadgeColor = (action: string) => {
      const act = (action || '').toUpperCase();
      if (act.includes('DELETE') || act.includes('SUSPEND') || act.includes('CANCEL') || act.includes('FAILED')) {
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
      }
      if (act.includes('UPDATE') || act.includes('STATUS') || act.includes('RESET')) {
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      }
      if (act.includes('CREATE') || act.includes('CLAIM') || act.includes('LOGIN') || act.includes('PAID') || act.includes('COMPLETED')) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      }
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    };

    const getRoleBadgeColor = (role?: string) => {
      const r = (role || '').toUpperCase();
      if (r === 'ADMIN') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      if (r === 'MANAGER') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      if (r === 'WAITER') return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {/* Top Header & Sticky Controls */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                  Audit Logs & Activity Trail
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Compliance & Security
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Real-time security events and staff operations across Admin (Owner), Managers, and Waiters in {businessName}.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={loadAuditLogsData}
                disabled={auditLogsLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border hover:bg-slate-500/10 transition shadow-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                title="Refresh logs"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${auditLogsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExportAuditLogs}
                disabled={filteredLogs.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total Audited Events</span>
              <span className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{totalEvents}</span>
            </div>
            <div className="p-3.5 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Admin Actions</span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{adminEvents}</span>
            </div>
            <div className="p-3.5 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Manager Actions</span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400">{managerEvents}</span>
            </div>
            <div className="p-3.5 rounded-xl border flex flex-col gap-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Waiter Actions</span>
              <span className="text-xl font-black text-teal-600 dark:text-teal-400">{waiterEvents}</span>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full flex items-center gap-2 rounded-xl border px-3.5 py-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <input
                value={auditLogsSearch}
                onChange={e => setAuditLogsSearch(e.target.value)}
                placeholder="Search audit trail by event, actor name, role, resource, or details..."
                className="flex-1 bg-transparent text-xs sm:text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {auditLogsSearch && (
                <button onClick={() => setAuditLogsSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={auditLogsRoleFilter}
                onChange={e => setAuditLogsRoleFilter(e.target.value as any)}
                className="text-xs font-medium px-3 py-2 rounded-xl border bg-transparent outline-none cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Admin (Owner)</option>
                <option value="MANAGER">Manager</option>
                <option value="WAITER">Waiter</option>
                <option value="SYSTEM">System / Worker</option>
              </select>

              <select
                value={auditLogsActionFilter}
                onChange={e => setAuditLogsActionFilter(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-xl border bg-transparent outline-none cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
              >
                <option value="ALL">All Event Types</option>
                <option value="ORDERS">Orders</option>
                <option value="PAYMENTS">Payments</option>
                <option value="USERS">Staff & Users</option>
                <option value="MENU">Menu Management</option>
                <option value="BUSINESS">Business Settings</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sticky and Scrollable Table Container */}
        <div
          className="flex-1 min-h-[350px] rounded-2xl border overflow-hidden shadow-sm flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 w-full max-h-[600px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 shadow-sm backdrop-blur-sm" style={{ background: 'var(--bg-card)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Event / Action</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Actor</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Role</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Target Resource</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Details & Context</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">IP Address</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 whitespace-nowrap">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs" style={{ borderColor: 'var(--border)' }}>
                {auditLogsLoading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <RefreshCcw className="h-5 w-5 animate-spin inline mr-2" />
                      Loading audit logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Shield className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      No audit events found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => {
                    const actorName = log.user?.fullName || log.user?.email || 'System Worker';
                    const actorEmail = log.user?.email || '';
                    const role = log.user?.role || 'SYSTEM';
                    const newVals = log.newValues ? (typeof log.newValues === 'string' ? log.newValues : JSON.stringify(log.newValues)) : null;
                    const oldVals = log.oldValues ? (typeof log.oldValues === 'string' ? log.oldValues : JSON.stringify(log.oldValues)) : null;

                    return (
                      <tr
                        key={log.auditUuid || `log-${idx}`}
                        className="hover:bg-slate-500/5 transition-colors border-b last:border-b-0"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>
                            {actorName}
                          </div>
                          {actorEmail && actorEmail !== actorName && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              {actorEmail}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeColor(role)}`}>
                            {role}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {log.entityType ? (
                            <span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{log.entityType}</span>
                              {log.entityUuid && (
                                <span className="text-[10px] text-slate-400 ml-1">
                                  ({log.entityUuid.substring(0, 8)}...)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span>General</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-300 max-w-[280px] truncate" title={newVals || oldVals || ''}>
                          {newVals ? (
                            <span className="font-mono bg-slate-500/10 px-1.5 py-0.5 rounded text-[10px]">
                              {newVals.length > 50 ? newVals.substring(0, 50) + '...' : newVals}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No value payload</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER PAGE ROUTER
  ───────────────────────────────────────────────────────────── */
  const renderCurrentPage = () => {
    switch (page) {
      case 'dashboard':
        return renderDashboardView();
      case 'users':
        return renderUsersView();
      case 'orders':
        return renderOrdersView();
      case 'sales':
        return renderSalesView();
      case 'staff':
        return renderStaffPerformance();
      case 'reports':
        return renderReportsView();
      case 'auditlogs':
        return renderAuditLogsView();
      case 'settings':
        return renderBusinessSettings();
      case 'profile':
        return renderProfileView();
      default:
        return renderDashboardView();
    }
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-body)' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      {/* ── Mobile Sidebar Backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar Navigation ── */}
      <aside
        className={`flex-shrink-0 flex flex-col h-full transition-all duration-200
          fixed inset-y-0 left-0 lg:static z-50 lg:z-30
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{
          width: collapsed ? '64px' : '230px',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid #1E293B',
        }}
      >
        <div
          className={`flex ${collapsed ? 'flex-col items-center gap-2 p-2.5' : 'items-center gap-2.5 p-3.5'} border-b`}
          style={{ borderColor: '#1E293B' }}
        >
          <button
            onClick={() => {
              if (collapsed) {
                setCollapsed(false);
              } else {
                setSettingsTab('branding');
                setPage('settings');
              }
            }}
            title={collapsed ? 'Click to expand sidebar' : 'Click to edit Business Logo & Brand Theme'}
            className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-all overflow-hidden shadow-sm relative group cursor-pointer border border-slate-700/60"
            style={{ backgroundColor: currentThemeColor }}
          >
            {currentLogoUrl && !logoError ? (
              <img
                src={resolveImageUrl(currentLogoUrl)}
                alt={businessName}
                className="h-full w-full object-cover rounded-xl"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-white font-black text-base uppercase tracking-wider">
                {businessName ? businessName.charAt(0) : <Building2 className="h-5 w-5 text-white" />}
              </span>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
              {collapsed ? <ChevronRight className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-white" />}
            </div>
          </button>
          {!collapsed ? (
            <>
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="text-sm font-black text-white truncate" title={businessName}>
                  {businessName}
                </div>
                <div className="text-[10px] font-bold truncate" style={{ color: currentThemeColor }}>Business Admin Portal</div>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Expand sidebar"
              className="w-8 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-700 border border-slate-700/70 transition-all shadow-sm group"
            >
              <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-white transition-colors" />
            </button>
          )}
        </div>

        <nav className="flex-1 min-h-0 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setPage(item.key); setMobileOpen(false); }}
              title={collapsed ? item.label : undefined}
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: page === item.key ? currentThemeColor : 'transparent',
                color: page === item.key ? '#FFFFFF' : '#94A3B8',
                justifyContent: collapsed ? 'center' : 'flex-start',
                boxShadow: page === item.key ? `0 4px 12px ${currentThemeColor}40` : 'none',
              }}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="flex-shrink-0 p-2 border-t" style={{ borderColor: '#1E293B' }}>
          <button
            onClick={onLogout}
            title={collapsed ? 'Sign Out' : undefined}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ── Main Workspace Body ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="sticky top-0 z-20 flex-shrink-0 border-b px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between backdrop-blur-md"
          style={{ background: 'var(--bg-body)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Hamburger — only on mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-1.5 -ml-0.5 mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden flex-shrink-0"
              title="Open Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-black truncate" style={{ color: 'var(--text-primary)' }}>
                {NAV_ITEMS.find((n) => n.key === page)?.label}
              </h1>
              <p className="text-xs truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                {businessName} ({businessType}) | {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="h-8 px-2.5 sm:px-3 rounded-xl border flex items-center gap-1.5 sm:gap-2 text-xs font-bold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
              <Shield className="h-3.5 w-3.5" style={{ color: currentThemeColor }} />
              <span className="hidden sm:inline">{user.fullName || 'Admin'}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 pb-12">
          {page !== 'dashboard' && loading ? (
            <div className="h-96 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Building2 className="h-10 w-10 animate-bounce" style={{ color: currentThemeColor }} />
              <p className="text-xs font-bold">Loading {NAV_ITEMS.find((n) => n.key === page)?.label || 'Page'}...</p>
            </div>
          ) : (
            renderCurrentPage()
          )}
        </main>
      </div>

      {/* ── Business Admin Onboarding Compliance Modal ── */}
      <BusinessAdminOnboardingModal
        open={!policyAccepted}
        businessName={businessName}
        onAccept={handleAcceptPolicy}
      />

      <PrivacyPolicyModal open={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
      <TermsAndConditionsModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
};
