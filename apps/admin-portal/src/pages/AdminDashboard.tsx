import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ThemeToggle } from '@orderup/ui';
import { validateStrongPassword, STRONG_PASSWORD_MESSAGE, generateStrongPassword } from '@orderup/shared';
import {
  LayoutDashboard, Building2, Users, CreditCard, TrendingUp, Settings,
  Bell, LogOut, ChevronDown, ArrowUpRight, ArrowDownRight, Server,
  ShieldCheck, AlertCircle, Activity, Database, Zap, Search,
  Plus, Download, Eye, EyeOff, Trash2, Edit2, CheckCircle2, X,
  Key, RefreshCcw, HardDrive, Cpu, Wifi, Upload, ClipboardList,
  ChevronLeft, Check, UserCog, Mail, Phone, MapPin,
  RotateCcw, UserX, UserCheck, Calendar, Lock, ShieldAlert,
  UtensilsCrossed, Store, Coffee, Hotel, Filter, SlidersHorizontal,
  UserPlus, Menu, FileText,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
} from 'recharts';

/* ─── Types ─── */
export type BusinessType = 'RESTAURANT' | 'CLUB' | 'BAR' | 'LOUNGE' | 'CAFE' | 'FAST_FOOD' | 'HOTEL' | 'FOOD_COURT' | 'OTHER';
export type BusinessStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'INACTIVE' | 'CANCELLED';

export interface Business {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  description: string;
  address: string;
  city: string;
  county: string;
  phone: string;
  email: string;
  openingTime: string;
  closingTime: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
  plan: string;
  status: string;
  isActive: boolean;
  mrr: number;
  orders: number;
  adminId: string;
  adminName?: string;
  adminEmail?: string;
  createdAt: string;
  trialDays: number;
  startDate: string;
  expiryDate: string;
  // Model B: Independent Daraja M-Pesa Credentials
  mpesaConsumerKey?: string | null;
  mpesaConsumerSecret?: string | null;
  mpesaShortcode?: string | null;
  mpesaPasskey?: string | null;
  mpesaTransactionType?: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  mpesaEnvironment?: 'sandbox' | 'production';
  isMpesaActive?: boolean;
  hasMpesaConfig?: boolean;
}

export interface BusinessAdmin {
  id: string;
  userUuid: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  businessUuid: string;
  businessName: string;
  businessType: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  isActive: boolean;
  lastLogin: string;
  createdAt: string;
}

export interface PlatformUser {
  id: string;
  userUuid: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  businessUuid?: string;
  businessName?: string;
  businessType?: string;
  isActive: boolean;
  isOnline: boolean;
  onlineStatus: string;
  lastLogin: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  role: string;
  resource: string;
  businessName?: string;
  ip: string;
  time: string;
  level: string;
}

export interface PlatformStatsData {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  totalUsers: number;
  totalAdmins: number;
  totalManagers: number;
  totalWaiters: number;
  totalOrders: number;
  totalRevenue: number;
  businessesByType: Record<string, number>;
  recentBusinesses: Array<{
    businessUuid: string;
    name: string;
    slug: string;
    businessType: BusinessType;
    status: string;
    city: string;
    county: string;
    createdAt: string;
    admin?: {
      fullName: string;
      email: string;
      phone?: string | null;
    } | null;
  }>;
}

/* ─── Utilities ─── */
const csvExport = (headers: string[], rows: (string | number | boolean)[][], filename: string) => {
  const e = (v: string | number | boolean) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const content = [headers.map(e).join(','), ...rows.map(r => r.map(e).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const getApiUrl = (path: string): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  let base = envUrl ? envUrl.trim() : 'http://localhost:5000/api/v1';
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (!base.includes('/api/v1')) base = `${base}/api/v1`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const resolveImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  let base = envUrl ? envUrl.trim() : 'http://localhost:5000';
  base = base.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  return `${base}${cleanPath}`;
};

const authHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem('orderup_token') ||
    localStorage.getItem('orderup_admin_token') ||
    localStorage.getItem('drinkhub_token') ||
    localStorage.getItem('drinkhub_admin_token') ||
    localStorage.getItem('accessToken');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const getToken = () =>
    localStorage.getItem('orderup_token') ||
    localStorage.getItem('orderup_admin_token') ||
    localStorage.getItem('drinkhub_token') ||
    localStorage.getItem('drinkhub_admin_token') ||
    localStorage.getItem('accessToken');

  let token = getToken();

  const baseHeaders: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  let response = await fetch(url, { ...options, headers: baseHeaders });

  if (response.status === 401) {
    const refreshToken =
      localStorage.getItem('orderup_refresh_token') ||
      localStorage.getItem('drinkhub_refresh_token') ||
      localStorage.getItem('refreshToken');

    if (refreshToken && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(getApiUrl('/auth/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const refreshData = await refreshRes.json().catch(() => ({}));
          if (refreshRes.ok && refreshData.success && refreshData.data?.accessToken) {
            const newToken = refreshData.data.accessToken;
            localStorage.setItem('orderup_token', newToken);
            if (refreshData.data.refreshToken) {
              localStorage.setItem('orderup_refresh_token', refreshData.data.refreshToken);
            }
            isRefreshing = false;
            onRefreshed(newToken);
            return fetch(url, {
              ...options,
              headers: {
                ...baseHeaders,
                Authorization: `Bearer ${newToken}`,
              },
            });
          }
        } catch {
          // refresh failed
        }
        isRefreshing = false;
      } else {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            fetch(url, {
              ...options,
              headers: {
                ...baseHeaders,
                Authorization: `Bearer ${newToken}`,
              },
            })
              .then(resolve)
              .catch(reject);
          });
        });
      }
    }

    if (token === 'demo-platform-admin-token') {
      localStorage.removeItem('orderup_token');
      localStorage.removeItem('drinkhub_token');
    }
  }

  return response;
};

const generatePassword = (): string => {
  return generateStrongPassword();
};

const readFile = (e: React.ChangeEvent<HTMLInputElement>, cb: (url: string) => void) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // 1. Instant local preview
  const reader = new FileReader();
  reader.onload = ev => {
    if (ev.target?.result) cb(ev.target.result as string);
  };
  reader.readAsDataURL(file);

  // 2. Upload to server in background for static persistent asset URL
  const formData = new FormData();
  formData.append('file', file);
  apiFetch(getApiUrl('/tenants/upload'), {
    method: 'POST',
    body: formData,
  })
    .then(res => res.json())
    .then(data => {
      const returnedUrl = data.data?.imageUrl || data.data?.url || data.data?.logoUrl;
      if (data.success && returnedUrl) {
        cb(resolveImageUrl(returnedUrl));
      }
    })
    .catch(() => {
      // Keep existing base64 preview on network failure
    });
};

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RESTAURANT: 'Restaurant',
  CLUB: 'Club / Nightclub',
  BAR: 'Bar',
  LOUNGE: 'Lounge',
  CAFE: 'Café',
  FAST_FOOD: 'Fast Food',
  HOTEL: 'Hotel',
  FOOD_COURT: 'Food Court',
  OTHER: 'Other Hospitality',
};

const BUSINESS_TYPE_ICONS: Record<BusinessType, React.ReactNode> = {
  RESTAURANT: <UtensilsCrossed className="h-3.5 w-3.5" />,
  CLUB: <Activity className="h-3.5 w-3.5" />,
  BAR: <Zap className="h-3.5 w-3.5" />,
  LOUNGE: <Coffee className="h-3.5 w-3.5" />,
  CAFE: <Coffee className="h-3.5 w-3.5" />,
  FAST_FOOD: <Store className="h-3.5 w-3.5" />,
  HOTEL: <Hotel className="h-3.5 w-3.5" />,
  FOOD_COURT: <Store className="h-3.5 w-3.5" />,
  OTHER: <Building2 className="h-3.5 w-3.5" />,
};

/* ─── Toast ─── */
const Toast = ({ msg, type = 'success', onDone }: { msg: string; type?: 'success' | 'error'; onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  // Sanitize any raw Prisma or base64 dumps that might slip into error messages
  const cleanMsg = (msg || '')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[a-zA-Z0-9+/=]+/g, '[image]')
    .replace(/Invalid `prisma\.[^`]+` invocation:[\s\S]*?(?=(Unknown argument|Argument|Invalid|\n\n|$))/gi, '')
    .trim();

  return (
    <div
      onClick={onDone}
      className="fixed bottom-6 right-6 z-[999] flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 max-w-md break-words cursor-pointer transition-all hover:opacity-95"
      style={{ background: type === 'success' ? '#0F172A' : '#7F1D1D', border: '1px solid rgba(255,255,255,0.1)', minWidth: 280 }}
    >
      {type === 'success' ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
      )}
      <span className="flex-1 text-xs leading-relaxed">{cleanMsg || 'An error occurred'}</span>
      <button onClick={(e) => { e.stopPropagation(); onDone(); }} className="text-white/60 hover:text-white text-xs ml-1 flex-shrink-0">✕</button>
    </div>
  );
};

/* ─── Modal ─── */
const Modal = ({ open, onClose, title, size = 'md', children }: { open: boolean; onClose: () => void; title: string; size?: 'sm' | 'md' | 'lg' | 'xl'; children: React.ReactNode }) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : size === 'xl' ? 'max-w-4xl' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <div className={`w-full ${w} rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800`} onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/* ─── Confirmation Modal ─── */
const ConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  loading?: boolean;
}) => {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {message}
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg text-white transition disabled:opacity-50 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20'
            }`}
          >
            {loading && <RefreshCcw className="h-3 w-3 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ─── Form Primitives ─── */
const FL = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);
const FE = ({ msg }: { msg?: string }) => msg ? <p className="text-xs text-red-500 mt-1 font-medium">{msg}</p> : null;
const FG = ({ children, span = 1 }: { children: React.ReactNode; span?: 1 | 2 }) => (
  <div className={span === 2 ? 'col-span-2' : ''}>{children}</div>
);

const SI = ({ error, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) => (
  <div>
    <input
      {...p}
      className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition text-slate-900 dark:text-white dark:bg-slate-800 ${
        error
          ? 'border-red-400 bg-red-50 dark:bg-red-950/20 focus:ring-2 focus:ring-red-300'
          : 'border-slate-200 dark:border-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
      }`}
    />
    <FE msg={error} />
  </div>
);

const STA = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...p}
    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
  />
);

const SS = ({ options, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { v: string; l: string }[] }) => (
  <select
    {...p}
    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition"
  >
    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

const PhoneInput = ({ error, value, onChange }: { error?: string; value: string; onChange: (v: string) => void }) => {
  // Extract digits only, strip any +254 or leading zeroes, clamp strictly to max 9 digits
  const cleanDigits = (value || '').replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9);

  return (
    <div>
      <div className="flex">
        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 select-none">
          +254
        </span>
        <input
          type="tel"
          maxLength={9}
          value={cleanDigits}
          onChange={e => {
            const raw = e.target.value.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '');
            onChange(raw.slice(0, 9));
          }}
          placeholder="7XX XXX XXX"
          className={`flex-1 rounded-r-lg border px-3 py-2.5 text-sm text-slate-900 dark:text-white dark:bg-slate-800 outline-none transition ${
            error
              ? 'border-red-400 bg-red-50 dark:bg-red-950/20 focus:ring-2 focus:ring-red-300'
              : 'border-slate-200 dark:border-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          }`}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <FE msg={error} />
        <span className="text-[10px] text-slate-400 font-mono ml-auto">
          {cleanDigits.length}/9 digits
        </span>
      </div>
    </div>
  );
};

/* ─── Legal & Compliance Modals ─── */
const PrivacyPolicyModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  return (
    <Modal open={open} onClose={onClose} title="Platform Privacy Policy" size="lg">
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[65vh] overflow-y-auto pr-2">
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-slate-900 dark:text-white">Kenya Data Protection Act, 2019 Compliance</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              This policy governs data collection, processing, and merchant obligations for establishments operating on OrderUp (OrderUp Kenya).
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">1. Scope & Applicability</h4>
          <p>
            This Privacy Policy applies specifically to Business Administrators, venue operators, and staff accounts onboarded to the OrderUp multi-tenant platform. By accepting these terms during business admin onboarding, the establishment agrees to lawful processing of institutional and customer order data.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">2. Information Collected</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Business Entity Information:</strong> Business name, premises address, county, licensing details, logo, and brand parameters.</li>
            <li><strong>Business Admin & Staff Data:</strong> Full names, official email addresses, 9-digit Kenyan mobile phone numbers (+254), and role permissions.</li>
            <li><strong>Order & Transaction Records:</strong> Table assignments, items ordered, order fulfillment timestamps, and M-Pesa STK push receipt references. (Note: Customer M-Pesa PINs are strictly handled by Safaricom and never recorded on this platform).</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">3. Purpose of Processing</h4>
          <p>
            Data processed within the platform is strictly utilized for:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Operating digital menus, QR ordering, and table management workflows.</li>
            <li>Facilitating automated Lipa Na M-Pesa STK push and payment reconciliation.</li>
            <li>Maintaining tenant audit trails, revenue reporting, and operational analytics.</li>
            <li>Preventing fraudulent access and enforcing multi-tenant data boundaries.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">4. Data Isolation & Security Measures</h4>
          <p>
            All establishment records are partitioned using row-level tenant security and cryptographic authentication tokens. Passwords utilize one-way cryptographic salting and hashing. Transmission of data across public networks is secured using TLS 1.3 encryption.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">5. Merchant Responsibilities</h4>
          <p>
            The Business Administrator is responsible for ensuring that all staff accounts (Managers and Waiters) created under their establishment adhere to data confidentiality standards and do not disclose customer order history or phone numbers to unauthorized third parties.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">6. Contact & Data Protection Officer</h4>
          <p>
            For privacy queries, data subject access requests, or regulatory compliance verification, contact the Data Protection Office via <strong>compliance@orderup.co.ke</strong> or <strong>+254 700 000 000</strong>.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-xs transition"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

const TermsAndConditionsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  return (
    <Modal open={open} onClose={onClose} title="Terms and Conditions of Service" size="lg">
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[65vh] overflow-y-auto pr-2">
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 flex items-start gap-3">
          <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-slate-900 dark:text-white">Master Service Agreement for Business Administrators</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              These terms must be reviewed and accepted by the Business Administrator prior to business onboarding.
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">1. Acceptance of Terms</h4>
          <p>
            By onboarding an establishment to OrderUp (OrderUp Kenya), the Business Administrator confirms they possess full legal authority to bind the establishment to these Terms and Conditions. This agreement takes effect immediately upon account creation.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">2. Multi-Tenant Platform Licensing</h4>
          <p>
            OrderUp provides a cloud-based software-as-a-service (SaaS) solution granting the merchant non-exclusive access to table ordering, waiter notifications, kitchen display, catalog management, and payment reconciliation modules.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">3. Business Administrator Fiduciary Duties</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Credential Confidentiality:</strong> The Business Administrator must safeguard administrative login credentials and ensure initial temporary passwords are reset immediately.</li>
            <li><strong>Staff Management:</strong> The administrator is responsible for provisioning and revoking staff access (Managers, Waiters) in compliance with internal operational protocols.</li>
            <li><strong>Catalogue & Pricing Integrity:</strong> The business is solely responsible for maintaining accurate product availability, pricing, alcohol licensing compliance, and opening hours.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">4. Payment Processing & M-Pesa Integration</h4>
          <p>
            All electronic payments initiated via Safaricom Lipa Na M-Pesa STK push are subject to standard telecommunication network availability and Daraja API settlement policies. The establishment agrees to promptly fulfill orders once automated confirmation is received on the platform.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">5. Service Uptime & Maintenance</h4>
          <p>
            OrderUp strives for 99.9% platform availability. Routine maintenance windows will be communicated in advance. The platform is not liable for indirect losses arising from third-party cellular network failures or local power disruptions.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">6. Subscription, Trials & Billing</h4>
          <p>
            Accounts provisioned under promotional or trial periods will transition to standard monthly subscription fees upon trial expiration. Failure to remit subscription dues may result in automated storefront restriction until accounts are normalized.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">7. Termination & Suspension</h4>
          <p>
            Platform administrators reserve the right to suspend or terminate business tenants engaged in fraudulent activities, money laundering, or willful breach of platform terms. Merchants may export their business data and terminate access with 30 days notice.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 text-xs transition"
          >
            I Accept & Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ─── Badges ─── */
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Trial: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    TRIAL: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    Inactive: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    INACTIVE: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    Suspended: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    SUSPENDED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    Pro: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    Standard: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    Starter: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    INFO: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    WARN: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    ERROR: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    Healthy: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    Degraded: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border inline-flex items-center gap-1 ${map[status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
};

const BusinessTypeBadge = ({ type }: { type: BusinessType | string }) => {
  const t = (type || 'RESTAURANT').toUpperCase() as BusinessType;
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      {BUSINESS_TYPE_ICONS[t] || <Building2 className="h-3 w-3" />}
      {BUSINESS_TYPE_LABELS[t] || t}
    </span>
  );
};

const RoleBadge = ({ role }: { role: string }) => {
  const map: Record<string, { cls: string; label: string }> = {
    SUPER_ADMIN: { cls: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300', label: 'Super Admin' },
    ADMIN: { cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300', label: 'Business Admin' },
    MANAGER: { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300', label: 'Manager' },
    WAITER: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300', label: 'Waiter' },
    CUSTOMER: { cls: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300', label: 'Customer' },
  };
  const c = map[role] || { cls: 'bg-slate-50 text-slate-600 border-slate-200', label: role };
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${c.cls}`}>{c.label}</span>;
};

const KPI = ({ label, value, change, positive, icon, sub }: { label: string; value: string | number; change?: string; positive?: boolean; icon: React.ReactNode; sub?: string }) => (
  <div className="rounded-xl border p-5 transition hover:shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
    <div className="flex items-start justify-between mb-3">
      <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>{icon}</div>
      {change ? (
        <div className={`flex items-center gap-0.5 text-xs font-bold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{change}
        </div>
      ) : sub ? (
        <span className="text-[11px] font-semibold text-slate-400">{sub}</span>
      ) : null}
    </div>
    <div className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</div>
    <div className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
  </div>
);

const SectionHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
    <div>
      <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const UploadBox = ({ label, preview, onUpload }: { label: string; preview: string; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
  const displaySrc = resolveImageUrl(preview);
  return (
    <label className="block cursor-pointer">
      <div className={`relative rounded-xl border-2 border-dashed transition-all hover:border-blue-400 overflow-hidden ${displaySrc ? 'border-blue-300' : 'border-slate-200 dark:border-slate-700'}`} style={{ height: displaySrc ? 110 : 75 }}>
        {displaySrc ? (
          <img src={displaySrc} alt="preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1 text-slate-400">
            <Upload className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </div>
        )}
        {displaySrc && (
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
            <span className="text-white text-xs font-bold">Change</span>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
    </label>
  );
};

const ThemePreview = ({ color, businessName, businessType }: { color: string; businessName: string; businessType?: string }) => (
  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-white text-center shadow-sm" style={{ background: color || '#1D4ED8' }}>
    <div className="px-4 py-4">
      <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-1.5">
        <Store className="h-4 w-4 text-white" />
      </div>
      <div className="font-black text-xs truncate">{businessName || 'Business Name'}</div>
      <div className="text-[10px] opacity-75 mt-0.5">{businessType || 'Hospitality Venue'}</div>
    </div>
  </div>
);

/* ══════════════════════════════════════
   CREATE BUSINESS STEPPER (Unified Provisioning)
══════════════════════════════════════ */
const STEPS = [
  { n: 1, label: 'Business Information', icon: <Building2 className="h-4 w-4" /> },
  { n: 2, label: 'Admin Account', icon: <UserCog className="h-4 w-4" /> },
  { n: 3, label: 'Subscription', icon: <CreditCard className="h-4 w-4" /> },
  { n: 4, label: 'M-Pesa Gateway', icon: <Zap className="h-4 w-4" /> },
];

const StepProgress = ({ current }: { current: number }) => (
  <div className="flex items-center justify-center mb-8">
    {STEPS.map((s, i) => {
      const done = s.n < current;
      const active = s.n === current;
      return (
        <React.Fragment key={s.n}>
          <div className="flex flex-col items-center gap-1.5">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all ${done ? 'bg-blue-600 border-blue-600 text-white' : active ? 'bg-white dark:bg-slate-900 border-blue-600 text-blue-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
              {done ? <Check className="h-4 w-4" /> : s.n}
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${active ? 'text-blue-600' : done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-16 sm:w-24 mx-2 mb-5 transition-all ${done ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

type BusinessFormState = {
  name: string;
  businessType: BusinessType;
  description: string;
  address: string;
  city: string;
  county: string;
  phone: string;
  email: string;
  openingTime: string;
  closingTime: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  tempPwd: string;
  plan: string;
  trialDays: string;
  subStatus: string;
  startDate: string;
  expiryDate: string;
  // Model B: Independent Daraja M-Pesa Credentials
  isMpesaActive: boolean;
  mpesaEnvironment: 'sandbox' | 'production';
  mpesaTransactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  mpesaShortcode: string;
  mpesaConsumerKey: string;
  mpesaConsumerSecret: string;
  mpesaPasskey: string;
};

const defaultBusinessForm: BusinessFormState = {
  name: '',
  businessType: 'RESTAURANT',
  description: '',
  address: '',
  city: 'Nairobi',
  county: 'Nairobi',
  phone: '',
  email: '',
  openingTime: '08:00',
  closingTime: '23:00',
  logoUrl: '',
  bannerUrl: '',
  themeColor: '#2563EB',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPhone: '',
  tempPwd: '',
  plan: 'Pro',
  trialDays: '14',
  subStatus: 'Trial',
  startDate: new Date().toISOString().split('T')[0],
  expiryDate: '',
  isMpesaActive: false,
  mpesaEnvironment: 'sandbox',
  mpesaTransactionType: 'CustomerPayBillOnline',
  mpesaShortcode: '',
  mpesaConsumerKey: '',
  mpesaConsumerSecret: '',
  mpesaPasskey: '',
};

/* Step 1 */
const Step1 = ({ f, set, errors }: { f: BusinessFormState; set: (k: keyof BusinessFormState, v: any) => void; errors: Partial<Record<keyof BusinessFormState, string>> }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 sm:col-span-1">
        <FL required>Business Name</FL>
        <SI value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Java House Westlands" error={errors.name} />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <FL required>Business Type</FL>
        <SS
          value={f.businessType}
          onChange={e => set('businessType', e.target.value as BusinessType)}
          options={Object.entries(BUSINESS_TYPE_LABELS).map(([k, l]) => ({ v: k, l }))}
        />
      </div>
      <div className="col-span-2">
        <FL>Description</FL>
        <STA value={f.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Brief description of the establishment…" />
      </div>
      <div>
        <FL>Physical Address / Location</FL>
        <SI value={f.address} onChange={e => set('address', e.target.value)} placeholder="e.g. Mpaka Road, Westlands" />
      </div>
      <div>
        <FL>City / Town</FL>
        <SI value={f.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Nairobi" />
      </div>
      <div>
        <FL>County</FL>
        <SS value={f.county} onChange={e => set('county', e.target.value)} options={['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Eldoret', 'Thika', 'Nyeri', 'Machakos', 'Kajiado', 'Kilifi'].map(c => ({ v: c, l: c }))} />
      </div>
      <div>
        <FL>Business Phone</FL>
        <PhoneInput value={f.phone} onChange={v => set('phone', v)} />
      </div>
      <div className="col-span-2">
        <FL>Contact Email</FL>
        <SI value={f.email} onChange={e => set('email', e.target.value)} placeholder="info@business.co.ke" type="email" />
      </div>
      <div>
        <FL>Opening Hours</FL>
        <SI type="time" value={f.openingTime} onChange={e => set('openingTime', e.target.value)} />
      </div>
      <div>
        <FL>Closing Hours</FL>
        <SI type="time" value={f.closingTime} onChange={e => set('closingTime', e.target.value)} />
      </div>
    </div>

    <div className="border-t pt-5 border-slate-200 dark:border-slate-700">
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Branding & Visuals</h4>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <FL>Logo</FL>
          <UploadBox label="Logo" preview={f.logoUrl} onUpload={e => readFile(e, v => set('logoUrl', v))} />
        </div>
        <div className="col-span-2">
          <FL>Banner</FL>
          <UploadBox label="Cover Banner" preview={f.bannerUrl} onUpload={e => readFile(e, v => set('bannerUrl', v))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <FL>Brand Accent Color</FL>
          <div className="flex items-center gap-2">
            <input type="color" value={f.themeColor} onChange={e => set('themeColor', e.target.value)} className="h-9 w-9 rounded-lg border border-slate-200 cursor-pointer p-1 bg-white" />
            <input type="text" value={f.themeColor} onChange={e => set('themeColor', e.target.value)} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono dark:bg-slate-800" />
          </div>
        </div>
        <div>
          <FL>Preview</FL>
          <ThemePreview color={f.themeColor} businessName={f.name} businessType={BUSINESS_TYPE_LABELS[f.businessType]} />
        </div>
      </div>
    </div>
  </div>
);

/* Step 2 */
const Step2 = ({ f, set, errors }: { f: BusinessFormState; set: (k: keyof BusinessFormState, v: any) => void; errors: Partial<Record<keyof BusinessFormState, string>> }) => {
  const [showPwd, setShowPwd] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 flex gap-3">
        <Lock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          The <strong>Business Admin</strong> will have full management control over this business, menus, tables, and staff. They will be required to change their temporary password upon first sign in.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FL required>Admin First Name</FL>
          <SI value={f.adminFirstName} onChange={e => set('adminFirstName', e.target.value)} placeholder="e.g. John" error={errors.adminFirstName} />
        </div>
        <div>
          <FL required>Admin Last Name</FL>
          <SI value={f.adminLastName} onChange={e => set('adminLastName', e.target.value)} placeholder="e.g. Ochieng" error={errors.adminLastName} />
        </div>
        <div className="col-span-2">
          <FL required>Admin Email Address</FL>
          <SI type="email" value={f.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@business.co.ke" error={errors.adminEmail} />
        </div>
        <div className="col-span-2">
          <FL required>Admin Phone Number</FL>
          <PhoneInput value={f.adminPhone} onChange={v => set('adminPhone', v)} error={errors.adminPhone} />
        </div>
        <div className="col-span-2">
          <FL required>Temporary Password</FL>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <SI
                type={showPwd ? 'text' : 'password'}
                value={f.tempPwd}
                onChange={e => set('tempPwd', e.target.value)}
                placeholder="Min. 8 characters"
                error={errors.tempPwd}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => set('tempPwd', generatePassword())}
              className="flex-shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Step 3 */
const Step3 = ({ f, set }: { f: BusinessFormState; set: (k: keyof BusinessFormState, v: any) => void }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <FL>Subscription Plan</FL>
        <div className="grid grid-cols-2 gap-3 mt-1">
          {[
            { v: 'Starter', price: 'KES 3,900 / mo', features: ['Up to 6 staff accounts', 'Up to 1,000 orders/mo', 'QR table ordering', 'Email support'] },
            { v: 'Pro', price: 'KES 8,900 / mo', features: ['Unlimited staff & waiters', 'Unlimited orders', 'Real-time kitchen/bar display', 'Advanced analytics & export'] },
          ].map(p => (
            <button
              key={p.v}
              type="button"
              onClick={() => set('plan', p.v)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                f.plan === p.v ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black text-slate-900 dark:text-white text-sm">{p.v}</span>
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${f.plan === p.v ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                  {f.plan === p.v && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">{p.price}</div>
              <ul className="space-y-0.5">
                {p.features.map(feat => (
                  <li key={feat} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-500" /> {feat}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>
      <div>
        <FL>Account Initial Status</FL>
        <SS
          value={f.subStatus}
          onChange={e => set('subStatus', e.target.value)}
          options={[{ v: 'Trial', l: 'Trial' }, { v: 'Active', l: 'Active' }]}
        />
      </div>
      <div>
        <FL>Trial Duration (Days)</FL>
        <SI type="number" value={f.trialDays} onChange={e => set('trialDays', e.target.value)} min="0" max="90" />
      </div>
    </div>
    <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
        ✓ Upon completion, the business and initial Admin account will be created atomically and linked.
      </p>
    </div>
  </div>
);

/* Step 4: Daraja Model B Gateway */
const Step4 = ({ f, set }: { f: BusinessFormState; set: (k: keyof BusinessFormState, v: any) => void }) => {
  const [showSecret, setShowSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3.5 flex gap-3">
        <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            Model B: Independent Daraja Credentials
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
            Configure this venue's Safaricom Daraja M-Pesa account. Consumer Secret and Passkey are encrypted using <strong>AES-256-GCM authenticated encryption</strong> before being stored in the database. Super Admin can update these credentials at any time.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div>
          <span className="text-sm font-black text-slate-900 dark:text-white block">Enable M-Pesa STK Push Gateway</span>
          <span className="text-xs text-slate-500">Allow customers to pay via automated M-Pesa prompt routed to this venue's Till or PayBill</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={f.isMpesaActive}
            onChange={e => set('isMpesaActive', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FL>Daraja Environment</FL>
          <SS
            value={f.mpesaEnvironment}
            onChange={e => set('mpesaEnvironment', e.target.value as 'sandbox' | 'production')}
            options={[
              { v: 'sandbox', l: 'Sandbox (Testing / Simulator)' },
              { v: 'production', l: 'Production (Live Safaricom)' },
            ]}
          />
        </div>

        <div>
          <FL>Transaction Type</FL>
          <SS
            value={f.mpesaTransactionType}
            onChange={e => set('mpesaTransactionType', e.target.value as 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline')}
            options={[
              { v: 'CustomerPayBillOnline', l: 'PayBill (CustomerPayBillOnline)' },
              { v: 'CustomerBuyGoodsOnline', l: 'Buy Goods / Till (CustomerBuyGoodsOnline)' },
            ]}
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <FL>Business Shortcode / Till Number</FL>
          <SI
            value={f.mpesaShortcode}
            onChange={e => set('mpesaShortcode', e.target.value.trim())}
            placeholder="e.g. 174379 (Sandbox) or 7-digit Till"
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <FL>Consumer Key</FL>
          <SI
            value={f.mpesaConsumerKey}
            onChange={e => set('mpesaConsumerKey', e.target.value.trim())}
            placeholder="Safaricom App Consumer Key"
          />
        </div>

        <div className="col-span-2">
          <FL>Consumer Secret</FL>
          <div className="relative">
            <SI
              type={showSecret ? 'text' : 'password'}
              value={f.mpesaConsumerSecret}
              onChange={e => set('mpesaConsumerSecret', e.target.value.trim())}
              placeholder="Safaricom App Consumer Secret"
            />
            <button
              type="button"
              onClick={() => setShowSecret(v => !v)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Encrypted with AES-256-GCM before saving in the database.</p>
        </div>

        <div className="col-span-2">
          <FL>Online Passkey (Lipa Na M-Pesa Online Passkey)</FL>
          <div className="relative">
            <SI
              type={showPasskey ? 'text' : 'password'}
              value={f.mpesaPasskey}
              onChange={e => set('mpesaPasskey', e.target.value.trim())}
              placeholder="bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
            />
            <button
              type="button"
              onClick={() => setShowPasskey(v => !v)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Provided in Daraja portal under Lipa Na M-Pesa Online. Encrypted with AES-256-GCM.</p>
        </div>
      </div>
    </div>
  );
};

const CreateBusinessStepper = ({ onSuccess, onCancel }: { onSuccess: (b: Business, a: BusinessAdmin) => void; onCancel: () => void }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<BusinessFormState>({ ...defaultBusinessForm, tempPwd: generatePassword() });
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessFormState, string>>>({});

  const validateAdminField = (k: keyof BusinessFormState, v: string): string => {
    if (k === 'adminFirstName' || k === 'adminLastName') {
      const label = k === 'adminFirstName' ? 'First name' : 'Last name';
      if (!v.trim()) return `${label} is required`;
      if (!/^[a-zA-Z\s]+$/.test(v)) return 'Name can only contain letters';
      if (v.trim().length < 2) return 'Must be at least 2 characters';
    }
    if (k === 'adminEmail') {
      if (!v.trim()) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
    }
    if (k === 'adminPhone') {
      if (!v.trim()) return 'Phone number is required';
      const digits = v.replace(/\D/g, '');
      if (!/^\d+$/.test(digits)) return 'Phone must contain numbers only';
      if (digits.length !== 9) return 'Phone number must be exactly 9 digits (e.g. 712345678)';
    }
    return '';
  };

  const set = (k: keyof BusinessFormState, v: any) => {
    setForm(p => ({ ...p, [k]: v }));
    setSubmitError(null);
    if (k === 'adminFirstName' || k === 'adminLastName' || k === 'adminEmail' || k === 'adminPhone') {
      const err = validateAdminField(k, String(v));
      setErrors(p => ({ ...p, [k]: err }));
    } else {
      setErrors(p => ({ ...p, [k]: '' }));
    }
  };

  const validate1 = () => {
    const e: Partial<Record<keyof BusinessFormState, string>> = {};
    if (!form.name.trim()) e.name = 'Business name is required';
    if (form.phone.trim()) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length !== 9) e.phone = 'Business phone must be exactly 9 digits (e.g. 712345678)';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validate2 = () => {
    const e: Partial<Record<keyof BusinessFormState, string>> = {};
    const fnErr = validateAdminField('adminFirstName', form.adminFirstName);
    if (fnErr) e.adminFirstName = fnErr;
    const lnErr = validateAdminField('adminLastName', form.adminLastName);
    if (lnErr) e.adminLastName = lnErr;
    const combinedName = `${form.adminFirstName} ${form.adminLastName}`.trim();
    if (!fnErr && !lnErr && combinedName.replace(/\s+/g, '').length < 3) {
      e.adminFirstName = 'Full name must be at least 3 letters';
    }
    const emErr = validateAdminField('adminEmail', form.adminEmail);
    if (emErr) e.adminEmail = emErr;
    const phErr = validateAdminField('adminPhone', form.adminPhone);
    if (phErr) e.adminPhone = phErr;
    const pwdVal = validateStrongPassword(form.tempPwd);
    if (!pwdVal.isValid) e.tempPwd = pwdVal.error || 'Password must be at least 8 chars with uppercase, lowercase, numbers, and symbols';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (step === 1 && !validate1()) return;
    if (step === 2 && !validate2()) return;
    if (step < 4) {
      setStep(s => s + 1);
      return;
    }
    if (step === 4) {
      setLoading(true);
      setSubmitError(null);
      try {
        const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `biz-${Date.now()}`;
        const adminFullName = `${form.adminFirstName} ${form.adminLastName}`.trim();

        const payload = {
          name: form.name.trim(),
          slug,
          businessType: form.businessType,
          description: form.description.trim(),
          city: form.city.trim(),
          county: form.county.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          openingHours: form.openingTime,
          closingHours: form.closingTime,
          themeColor: form.themeColor,
          brandColor: form.themeColor,
          logoUrl: form.logoUrl || null,
          bannerUrl: form.bannerUrl || null,
          adminFullName,
          adminEmail: form.adminEmail.trim().toLowerCase(),
          adminPhone: form.adminPhone.trim(),
          adminPassword: form.tempPwd,
          // Compatibility aliases
          managerFullName: adminFullName,
          managerEmail: form.adminEmail.trim().toLowerCase(),
          managerPhone: form.adminPhone.trim(),
          managerPassword: form.tempPwd,
          // Model B: Independent Daraja M-Pesa Credentials
          mpesaConsumerKey: form.mpesaConsumerKey.trim() || null,
          mpesaConsumerSecret: form.mpesaConsumerSecret.trim() || null,
          mpesaShortcode: form.mpesaShortcode.trim() || null,
          mpesaPasskey: form.mpesaPasskey.trim() || null,
          mpesaTransactionType: form.mpesaTransactionType,
          mpesaEnvironment: form.mpesaEnvironment,
          isMpesaActive: form.isMpesaActive,
        };

        const res = await apiFetch(getApiUrl('/tenants/provision'), {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          const msg = data.error?.message || data.message || (res.status === 401 ? 'Session expired. Please log out and log back in.' : 'Failed to provision business');
          setSubmitError(msg);
          throw new Error(msg);
        }

        const bData = data.data?.business || data.data?.club || {};
        const aData = data.data?.admin || data.data?.manager || {};

        const newBusiness: Business = {
          id: bData.businessUuid || bData.clubUuid || bData.uuid || `b-${Date.now()}`,
          name: bData.name || form.name,
          slug: bData.slug || slug,
          businessType: bData.businessType || form.businessType,
          description: form.description,
          address: form.address,
          city: form.city,
          county: bData.county || form.county,
          phone: form.phone,
          email: form.email,
          openingTime: form.openingTime,
          closingTime: form.closingTime,
          logoUrl: form.logoUrl,
          bannerUrl: form.bannerUrl,
          themeColor: bData.themeColor || bData.brandColor || form.themeColor,
          plan: form.plan,
          status: 'Active',
          isActive: true,
          mrr: form.plan === 'Pro' ? 8900 : 3900,
          orders: 0,
          adminId: aData.userUuid || aData.uuid || '',
          adminName: adminFullName,
          adminEmail: form.adminEmail,
          createdAt: new Date().toISOString().split('T')[0],
          trialDays: parseInt(form.trialDays, 10) || 14,
          startDate: form.startDate,
          expiryDate: form.expiryDate,
          // Model B fields
          mpesaConsumerKey: bData.mpesaConsumerKey || form.mpesaConsumerKey,
          mpesaConsumerSecret: bData.mpesaConsumerSecret || form.mpesaConsumerSecret,
          mpesaShortcode: bData.mpesaShortcode || form.mpesaShortcode,
          mpesaPasskey: bData.mpesaPasskey || form.mpesaPasskey,
          mpesaTransactionType: bData.mpesaTransactionType || form.mpesaTransactionType,
          mpesaEnvironment: bData.mpesaEnvironment || form.mpesaEnvironment,
          isMpesaActive: bData.isMpesaActive ?? form.isMpesaActive,
          hasMpesaConfig: Boolean(form.mpesaConsumerKey && form.mpesaShortcode && form.isMpesaActive),
        };

        const newAdmin: BusinessAdmin = {
          id: aData.userUuid || aData.uuid || `a-${Date.now()}`,
          userUuid: aData.userUuid || aData.uuid || `a-${Date.now()}`,
          fullName: adminFullName,
          firstName: form.adminFirstName,
          lastName: form.adminLastName,
          email: form.adminEmail,
          phone: form.adminPhone,
          businessUuid: newBusiness.id,
          businessName: newBusiness.name,
          businessType: newBusiness.businessType,
          role: 'ADMIN',
          status: 'Active',
          isActive: true,
          lastLogin: 'Never',
          createdAt: new Date().toISOString().split('T')[0],
        };

        onSuccess(newBusiness, newAdmin);
      } catch (err: any) {
        setSubmitError(err.message || 'Error creating business.');
      } finally {
        setLoading(false);
      }
      return;
    }
    setStep(s => s + 1);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Businesses
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Register New Business</h2>
        <p className="text-sm mt-1 text-slate-500">Provision a new multi-tenant business and create its initial Business Admin.</p>
      </div>

      <StepProgress current={step} />

      <div className="rounded-2xl border p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        {submitError && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-semibold text-red-500 flex items-center justify-between">
            <span>{submitError}</span>
            <button onClick={() => setSubmitError(null)} className="text-xs underline text-red-400">Dismiss</button>
          </div>
        )}

        <div className="mb-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-white">{STEPS[step - 1].label}</h3>
          <span className="text-xs font-bold text-slate-400">Step {step} of {STEPS.length}</span>
        </div>

        {step === 1 && <Step1 f={form} set={set} errors={errors} />}
        {step === 2 && <Step2 f={form} set={set} errors={errors} />}
        {step === 3 && <Step3 f={form} set={set} />}
        {step === 4 && <Step4 f={form} set={set} />}

        <div className="flex items-center justify-between mt-7 pt-5 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 rounded-xl border px-5 py-2.5 text-sm font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ background: '#2563EB' }}
            >
              {loading ? (
                <><RefreshCcw className="h-4 w-4 animate-spin" /> Provisioning…</>
              ) : step === STEPS.length ? (
                <><Check className="h-4 w-4" /> Complete Registration</>
              ) : (
                <>Next Step <ChevronDown className="h-4 w-4 -rotate-90" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   EDIT BUSINESS MODAL
══════════════════════════════════════ */
const EditBusinessModal = ({
  business,
  open,
  onClose,
  onSaved,
  showToast,
}: {
  business: Business | null;
  open: boolean;
  onClose: () => void;
  onSaved: (b: Business) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  const [form, setForm] = useState({
    name: '',
    businessType: 'RESTAURANT' as BusinessType,
    description: '',
    address: '',
    city: 'Nairobi',
    county: 'Nairobi',
    phone: '',
    email: '',
    openingTime: '08:00',
    closingTime: '23:00',
    themeColor: '#2563EB',
    logoUrl: '',
    bannerUrl: '',
    mpesaConsumerKey: '',
    mpesaConsumerSecret: '',
    mpesaShortcode: '',
    mpesaPasskey: '',
    mpesaTransactionType: 'CustomerPayBillOnline' as 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline',
    mpesaEnvironment: 'sandbox' as 'sandbox' | 'production',
    isMpesaActive: false,
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name || '',
        businessType: business.businessType || 'RESTAURANT',
        description: business.description || '',
        address: business.address || '',
        city: business.city || 'Nairobi',
        county: business.county || 'Nairobi',
        phone: business.phone || '',
        email: business.email || '',
        openingTime: business.openingTime || '08:00',
        closingTime: business.closingTime || '23:00',
        themeColor: business.themeColor || '#2563EB',
        logoUrl: business.logoUrl || '',
        bannerUrl: business.bannerUrl || '',
        mpesaConsumerKey: business.mpesaConsumerKey || '',
        mpesaConsumerSecret: business.mpesaConsumerSecret || '',
        mpesaShortcode: business.mpesaShortcode || '',
        mpesaPasskey: business.mpesaPasskey || '',
        mpesaTransactionType: business.mpesaTransactionType || 'CustomerPayBillOnline',
        mpesaEnvironment: business.mpesaEnvironment || 'sandbox',
        isMpesaActive: business.isMpesaActive ?? false,
      });
      setShowSecret(false);
      setShowPasskey(false);
    }
  }, [business]);

  if (!business) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.phone.trim()) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length !== 9) {
        showToast('Phone number must be exactly 9 digits (e.g. 712345678)', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const res = await apiFetch(getApiUrl(`/tenants/${business.id}`), {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          businessType: form.businessType,
          description: form.description.trim() || null,
          address: form.address.trim(),
          city: form.city.trim(),
          county: form.county.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          openingHours: form.openingTime,
          closingHours: form.closingTime,
          themeColor: form.themeColor,
          logoUrl: form.logoUrl.trim() || null,
          bannerUrl: form.bannerUrl.trim() || null,
          // Model B: Independent Daraja M-Pesa Credentials
          mpesaConsumerKey: form.mpesaConsumerKey.trim() || null,
          mpesaConsumerSecret: form.mpesaConsumerSecret.trim() || null,
          mpesaShortcode: form.mpesaShortcode.trim() || null,
          mpesaPasskey: form.mpesaPasskey.trim() || null,
          mpesaTransactionType: form.mpesaTransactionType,
          mpesaEnvironment: form.mpesaEnvironment,
          isMpesaActive: form.isMpesaActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to update business');
      }

      const updated: Business = {
        ...business,
        name: form.name.trim(),
        businessType: form.businessType,
        description: form.description.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        county: form.county.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        openingTime: form.openingTime,
        closingTime: form.closingTime,
        themeColor: form.themeColor,
        logoUrl: form.logoUrl.trim(),
        bannerUrl: form.bannerUrl.trim(),
        mpesaConsumerKey: form.mpesaConsumerKey.trim() || null,
        mpesaConsumerSecret: form.mpesaConsumerSecret.trim() || null,
        mpesaShortcode: form.mpesaShortcode.trim() || null,
        mpesaPasskey: form.mpesaPasskey.trim() || null,
        mpesaTransactionType: form.mpesaTransactionType,
        mpesaEnvironment: form.mpesaEnvironment,
        isMpesaActive: form.isMpesaActive,
        hasMpesaConfig: Boolean(form.mpesaConsumerKey && form.mpesaShortcode && form.isMpesaActive),
      };

      onSaved(updated);
      showToast('Business details updated successfully');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update business', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Business: ${business.name}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FG span={2}>
            <FL required>Business Name</FL>
            <SI required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </FG>
          <FG>
            <FL required>Business Type</FL>
            <SS
              value={form.businessType}
              onChange={e => setForm(p => ({ ...p, businessType: e.target.value as BusinessType }))}
              options={Object.entries(BUSINESS_TYPE_LABELS).map(([k, l]) => ({ v: k, l }))}
            />
          </FG>
          <FG>
            <FL>County</FL>
            <SS
              value={form.county}
              onChange={e => setForm(p => ({ ...p, county: e.target.value }))}
              options={['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Eldoret', 'Thika', 'Nyeri', 'Machakos', 'Kajiado', 'Kilifi'].map(c => ({ v: c, l: c }))}
            />
          </FG>
          <FG>
            <FL>Address / Street</FL>
            <SI value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          </FG>
          <FG>
            <FL>City</FL>
            <SI value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
          </FG>
          <FG>
            <FL>Phone</FL>
            <PhoneInput value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} />
          </FG>
          <FG>
            <FL>Email</FL>
            <SI type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </FG>
          <FG>
            <FL>Opening Hours</FL>
            <SI type="time" value={form.openingTime} onChange={e => setForm(p => ({ ...p, openingTime: e.target.value }))} />
          </FG>
          <FG>
            <FL>Closing Hours</FL>
            <SI type="time" value={form.closingTime} onChange={e => setForm(p => ({ ...p, closingTime: e.target.value }))} />
          </FG>
        </div>

        <div className="border-t pt-4 border-slate-100 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Branding</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FL>Logo</FL>
              <UploadBox label="Logo" preview={form.logoUrl} onUpload={e => readFile(e, v => setForm(p => ({ ...p, logoUrl: v })))} />
            </div>
            <div className="col-span-2">
              <FL>Banner</FL>
              <UploadBox label="Banner" preview={form.bannerUrl} onUpload={e => readFile(e, v => setForm(p => ({ ...p, bannerUrl: v })))} />
            </div>
          </div>
        </div>

        {/* M-Pesa Payment Gateway (Daraja Model B) */}
        <div className="border-t pt-4 border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                M-Pesa Payment Gateway (Daraja Model B)
              </h4>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              AES-256-GCM Encrypted
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Enable M-Pesa STK Push</span>
              <span className="text-[11px] text-slate-400">Activate independent Daraja credential routing for this venue</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isMpesaActive}
                onChange={e => setForm(p => ({ ...p, isMpesaActive: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FG>
              <FL>Environment</FL>
              <SS
                value={form.mpesaEnvironment}
                onChange={e => setForm(p => ({ ...p, mpesaEnvironment: e.target.value as 'sandbox' | 'production' }))}
                options={[
                  { v: 'sandbox', l: 'Sandbox (Testing)' },
                  { v: 'production', l: 'Production (Live)' },
                ]}
              />
            </FG>
            <FG>
              <FL>Transaction Type</FL>
              <SS
                value={form.mpesaTransactionType}
                onChange={e => setForm(p => ({ ...p, mpesaTransactionType: e.target.value as 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline' }))}
                options={[
                  { v: 'CustomerPayBillOnline', l: 'PayBill (CustomerPayBillOnline)' },
                  { v: 'CustomerBuyGoodsOnline', l: 'Buy Goods / Till (CustomerBuyGoodsOnline)' },
                ]}
              />
            </FG>
            <FG>
              <FL>Shortcode / Till</FL>
              <SI
                value={form.mpesaShortcode}
                onChange={e => setForm(p => ({ ...p, mpesaShortcode: e.target.value.trim() }))}
                placeholder="e.g. 174379 or Till Number"
              />
            </FG>
            <FG>
              <FL>Consumer Key</FL>
              <SI
                value={form.mpesaConsumerKey}
                onChange={e => setForm(p => ({ ...p, mpesaConsumerKey: e.target.value.trim() }))}
                placeholder="Daraja App Consumer Key"
              />
            </FG>
            <FG span={2}>
              <FL>Consumer Secret</FL>
              <div className="relative">
                <SI
                  type={showSecret ? 'text' : 'password'}
                  value={form.mpesaConsumerSecret}
                  onChange={e => setForm(p => ({ ...p, mpesaConsumerSecret: e.target.value.trim() }))}
                  placeholder="•••••••••••• (Leave as is to retain existing encrypted secret)"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Leave masked bullets to keep currently stored encrypted secret.</p>
            </FG>
            <FG span={2}>
              <FL>Lipa Na M-Pesa Passkey</FL>
              <div className="relative">
                <SI
                  type={showPasskey ? 'text' : 'password'}
                  value={form.mpesaPasskey}
                  onChange={e => setForm(p => ({ ...p, mpesaPasskey: e.target.value.trim() }))}
                  placeholder="•••••••••••• (Leave as is to retain existing encrypted passkey)"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey(v => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Leave masked bullets to keep currently stored encrypted passkey.</p>
            </FG>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
            {saving ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ══════════════════════════════════════
   BUSINESS DETAILS VIEW
══════════════════════════════════════ */
const BusinessDetailsView = ({
  business,
  admins,
  onBack,
  onUpdateBusiness,
  onToggleStatus,
  showToast,
}: {
  business: Business;
  admins: BusinessAdmin[];
  onBack: () => void;
  onUpdateBusiness: (b: Business) => void;
  onToggleStatus: (b: Business) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  const [showEdit, setShowEdit] = useState(false);
  const admin = admins.find(a => a.businessUuid === business.id || a.id === business.adminId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Businesses
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-100 transition shadow-sm"
          >
            <Edit2 className="h-3.5 w-3.5" /> Edit Business
          </button>
          <button
            onClick={() => onToggleStatus(business)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition ${
              business.status === 'Active' || business.status === 'ACTIVE'
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
            }`}
          >
            {business.status === 'Active' || business.status === 'ACTIVE' ? (
              <><ShieldAlert className="h-3.5 w-3.5" /> Suspend Business</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Activate Business</>
            )}
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden h-36" style={{ background: business.themeColor || '#2563EB' }}>
        {business.bannerUrl && <img src={resolveImageUrl(business.bannerUrl)} alt="banner" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-end p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 overflow-hidden">
              {business.logoUrl ? (
                <img src={resolveImageUrl(business.logoUrl)} alt="logo" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-7 w-7 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-white">{business.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <BusinessTypeBadge type={business.businessType} />
                <StatusBadge status={business.status} />
                <span className="text-white/80 text-xs">{business.city}, {business.county}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Business & Admin Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">Business Profile</h3>
            <dl className="grid grid-cols-2 gap-4">
              {[
                { k: 'Business Slug', v: business.slug },
                { k: 'Business Type', v: BUSINESS_TYPE_LABELS[business.businessType] || business.businessType },
                { k: 'Address', v: `${business.address || '—'}, ${business.city}` },
                { k: 'County', v: business.county || 'Nairobi' },
                { k: 'Phone', v: business.phone || '—' },
                { k: 'Email', v: business.email || '—' },
                { k: 'Operating Hours', v: `${business.openingTime} – ${business.closingTime}` },
                { k: 'Registered On', v: business.createdAt },
              ].map(({ k, v }) => (
                <div key={k}>
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">{k}</dt>
                  <dd className="text-sm font-semibold text-slate-800 dark:text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

            {/* Primary Business Admin */}
            <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">Primary Business Admin</h3>
              {admin ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black text-sm flex items-center justify-center">
                      {admin.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{admin.fullName}</div>
                      <div className="text-xs text-slate-400">{admin.email}</div>
                    </div>
                    <div className="ml-auto">
                      <StatusBadge status={admin.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div><span className="text-slate-400 font-bold block">Phone</span><span className="font-semibold text-slate-700 dark:text-slate-300">{admin.phone || '—'}</span></div>
                    <div><span className="text-slate-400 font-bold block">Last Login</span><span className="font-semibold text-slate-700 dark:text-slate-300">{admin.lastLogin}</span></div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No primary admin assigned yet.</p>
              )}
            </div>

            {/* M-Pesa Payment Gateway (Daraja Model B) */}
            <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">M-Pesa Gateway (Daraja Model B)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${business.isMpesaActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${business.isMpesaActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    {business.isMpesaActive ? 'Gateway Active' : 'Gateway Inactive'}
                  </span>
                  <button
                    onClick={() => setShowEdit(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="h-3 w-3" /> Edit Credentials
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Environment</dt>
                  <dd className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${business.mpesaEnvironment === 'production' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}`}>
                      {business.mpesaEnvironment === 'production' ? 'Live Production' : 'Sandbox Simulator'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Transaction Type</dt>
                  <dd className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {business.mpesaTransactionType === 'CustomerBuyGoodsOnline' ? 'Buy Goods (Till Number)' : 'PayBill (CustomerPayBillOnline)'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Business Shortcode</dt>
                  <dd className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                    {business.mpesaShortcode || 'Not Configured'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">Consumer Key</dt>
                  <dd className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {business.mpesaConsumerKey ? `${business.mpesaConsumerKey.slice(0, 8)}••••••••` : 'Not Configured'}
                  </dd>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>Consumer Secret & Passkey are secured with <strong>AES-256-GCM authenticated encryption</strong></span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">Model B Independent Routing</span>
                </div>
              </dl>
            </div>
          </div>

        {/* Right Column: High-Level Activity */}
        <div className="space-y-5">
          <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Live Metrics</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Total Orders', val: business.orders },
                { label: 'Estimated MRR', val: `KES ${business.mrr.toLocaleString()}` },
                { label: 'Subscription Plan', val: <StatusBadge status={business.plan} /> },
                { label: 'Account Status', val: <StatusBadge status={business.status} /> },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500">{s.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <EditBusinessModal
        business={business}
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={onUpdateBusiness}
        showToast={showToast}
      />
    </div>
  );
};

/* ══════════════════════════════════════
   FEATURE 1: DASHBOARD OVERVIEW
══════════════════════════════════════ */
const DashboardOverviewPage = ({
  stats,
  loading,
  onNavigate,
  showToast,
}: {
  stats: PlatformStatsData | null;
  loading: boolean;
  onNavigate: (key: NavKey) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await apiFetch(getApiUrl('/reports/analytics?period=WEEKLY&businessUuid=ALL'));
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data.data);
        }
      } catch {
        /* ignore */
      }
    };
    fetchAnalytics();
  }, []);

  const weeklyData = analytics?.dailyRevenue?.map((d: any) => ({
    day: d.day,
    revenue: Number(d.revenue || 0),
    orders: Number(d.orders ?? d.orderCount ?? d.count ?? 0),
  })) || [];

  const typeData = useMemo(() => {
    if (!stats?.businessesByType) return [];
    return Object.entries(stats.businessesByType).map(([k, count]) => ({
      name: BUSINESS_TYPE_LABELS[k as BusinessType] || k,
      count,
    }));
  }, [stats]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Super Admin Dashboard"
        subtitle="Platform-wide telemetry, multi-tenant businesses, and operations overview"
        action={
          <button
            onClick={() => onNavigate('businesses')}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:opacity-90 transition"
            style={{ background: '#2563EB' }}
          >
            <Plus className="h-3.5 w-3.5" /> Register Business
          </button>
        }
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="Total Businesses"
          value={loading ? '—' : stats?.totalBusinesses ?? 0}
          sub={`${stats?.activeBusinesses ?? 0} active · ${stats?.suspendedBusinesses ?? 0} suspended`}
          icon={<Building2 className="h-5 w-5 text-blue-500" />}
        />
        <KPI
          label="Total Orders"
          value={loading ? '—' : stats?.totalOrders ?? 0}
          sub="Platform Completed Orders"
          icon={<ClipboardList className="h-5 w-5 text-purple-500" />}
        />
        <KPI
          label="Platform Revenue"
          value={loading ? '—' : `KES ${(stats?.totalRevenue ?? 0).toLocaleString()}`}
          sub="Gross Paid Settlements"
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
        />
        <KPI
          label="Total Platform Users"
          value={loading ? '—' : stats?.totalUsers ?? 0}
          sub={`${stats?.totalAdmins ?? 0} Admins · ${stats?.totalManagers ?? 0} Mgrs · ${stats?.totalWaiters ?? 0} Waiters`}
          icon={<Users className="h-5 w-5 text-amber-500" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Trend */}
        <div className="lg:col-span-2 rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Platform Weekly Revenue & Orders</h3>
            <span className="text-xs text-slate-400 font-medium">Real-Time Database</span>
          </div>
          {weeklyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">No order revenue data recorded this week</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `KES ${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }} formatter={(v: number) => [`KES ${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Breakdown by Business Type */}
        <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">Businesses by Type</h3>
            <p className="text-xs text-slate-400 mb-4">Distribution across hospitality verticals</p>
            {typeData.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No registered businesses</div>
            ) : (
              <div className="space-y-2.5">
                {typeData.map(t => (
                  <div key={t.name} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
                      <Store className="h-3 w-3 text-blue-500" /> {t.name}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      {t.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('businesses')}
            className="w-full mt-4 text-center text-xs font-bold text-blue-600 hover:text-blue-700 py-2 border-t border-slate-100 dark:border-slate-800"
          >
            Manage All Businesses →
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   FEATURE 2: BUSINESS MANAGEMENT
══════════════════════════════════════ */
const BusinessesPage = ({
  businesses,
  admins,
  onRefresh,
  showToast,
}: {
  businesses: Business[];
  admins: BusinessAdmin[];
  onRefresh: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    business: Business | null;
    action: 'suspend' | 'activate' | 'delete';
  }>({ open: false, business: null, action: 'suspend' });
  const [actionLoading, setActionLoading] = useState(false);

  const filtered = useMemo(() => {
    return businesses.filter(b => {
      const matchSearch =
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.city.toLowerCase().includes(search.toLowerCase()) ||
        b.county.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'ALL' || b.businessType === typeFilter;
      const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [businesses, search, typeFilter, statusFilter]);

  const handleConfirmAction = async () => {
    const { business, action } = confirmModal;
    if (!business) return;
    setActionLoading(true);
    try {
      if (action === 'suspend') {
        const res = await apiFetch(getApiUrl(`/tenants/${business.id}/suspend`), {
          method: 'PATCH',
        });
        if (!res.ok) throw new Error('Failed to suspend business');
        showToast(`${business.name} suspended successfully`);
      } else if (action === 'activate') {
        const res = await apiFetch(getApiUrl(`/tenants/${business.id}/activate`), {
          method: 'PATCH',
        });
        if (!res.ok) throw new Error('Failed to activate business');
        showToast(`${business.name} activated successfully`);
      } else if (action === 'delete') {
        const res = await apiFetch(getApiUrl(`/tenants/${business.id}`), {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete business');
        showToast(`${business.name} deleted successfully`);
      }
      setConfirmModal({ open: false, business: null, action: 'suspend' });
      onRefresh();
      if (view === 'details') setView('list');
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (view === 'create') {
    return (
      <CreateBusinessStepper
        onSuccess={(newB) => {
          showToast(`Business '${newB.name}' registered successfully!`);
          onRefresh();
          setSelectedBusiness(newB);
          setView('details');
        }}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'details' && selectedBusiness) {
    return (
      <BusinessDetailsView
        business={selectedBusiness}
        admins={admins}
        onBack={() => { setView('list'); setSelectedBusiness(null); }}
        onUpdateBusiness={(updated) => {
          setSelectedBusiness(updated);
          onRefresh();
        }}
        onToggleStatus={(b) => {
          const isAct = b.status === 'Active' || b.status === 'ACTIVE';
          setConfirmModal({ open: true, business: b, action: isAct ? 'suspend' : 'activate' });
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      {/* Top sticky controls */}
      <div className="flex-shrink-0 space-y-4">
        <SectionHeader
          title="Businesses & Establishments"
          subtitle={`${businesses.length} registered hospitality businesses`}
          action={
            <button
              onClick={() => setView('create')}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:opacity-90 transition"
              style={{ background: '#2563EB' }}
            >
              <Plus className="h-3.5 w-3.5" /> Register Business
            </button>
          }
        />

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-lg border px-3.5 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by business name or location…"
              className="flex-1 bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="ALL">All Business Types</option>
              {Object.entries(BUSINESS_TYPE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Trial">Trial</option>
            </select>

            <button
              onClick={() => {
                csvExport(
                  ['Business Name', 'Type', 'City', 'County', 'Plan', 'M-Pesa Gateway', 'Shortcode', 'Status', 'Orders', 'Created Date'],
                  filtered.map(b => [b.name, b.businessType, b.city, b.county, b.plan, b.isMpesaActive ? 'Active' : 'Inactive', b.mpesaShortcode || '—', b.status, b.orders, b.createdAt]),
                  'businesses-export.csv'
                );
                showToast('Businesses exported to CSV');
              }}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-[300px] rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 w-full">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm" style={{ background: 'var(--bg-card)' }}>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Business Name</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Type</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Location</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Admin</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">M-Pesa Gateway</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Created</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    No businesses match your search filters
                  </td>
                </tr>
              ) : (
                filtered.map(business => {
                  const admin = admins.find(a => a.businessUuid === business.id || a.id === business.adminId);
                  const isAct = business.status === 'Active' || business.status === 'ACTIVE';
                  return (
                    <tr
                      key={business.id}
                      className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => { setSelectedBusiness(business); setView('details'); }}
                          className="flex items-center gap-3 hover:text-blue-600 transition text-left"
                        >
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700"
                            style={{ background: business.logoUrl ? undefined : (business.themeColor || '#2563EB') }}
                          >
                            {business.logoUrl ? (
                              <img src={resolveImageUrl(business.logoUrl)} alt={business.name} className="h-full w-full object-cover" />
                            ) : (
                              <Store className="h-4 w-4 text-white" />
                            )}
                          </div>
                          <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-blue-600">
                            {business.name}
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5"><BusinessTypeBadge type={business.businessType} /></td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{business.city} · {business.county}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {admin ? admin.fullName : '—'}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={business.plan} /></td>
                      <td className="px-5 py-3.5">
                        {business.isMpesaActive ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              <Zap className="h-3 w-3 text-emerald-600 fill-emerald-500" />
                              {business.mpesaShortcode || 'Active'}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              {business.mpesaEnvironment === 'production' ? 'Live' : 'Sandbox'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={business.status} /></td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{business.createdAt}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedBusiness(business); setView('details'); }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
                            title="View Business Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingBusiness(business)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 transition"
                            title="Edit Business"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmModal({ open: true, business, action: isAct ? 'suspend' : 'activate' })}
                            className={`p-1.5 rounded-lg transition ${
                              isAct
                                ? 'hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600'
                                : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600'
                            }`}
                            title={isAct ? 'Suspend Business' : 'Activate Business'}
                          >
                            {isAct ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setConfirmModal({ open: true, business, action: 'delete' })}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition"
                            title="Delete Business"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Edit Business Modal */}
      <EditBusinessModal
        business={editingBusiness}
        open={!!editingBusiness}
        onClose={() => setEditingBusiness(null)}
        onSaved={() => {
          setEditingBusiness(null);
          onRefresh();
        }}
        showToast={showToast}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, business: null, action: 'suspend' })}
        onConfirm={handleConfirmAction}
        loading={actionLoading}
        title={
          confirmModal.action === 'suspend'
            ? 'Suspend Business'
            : confirmModal.action === 'activate'
            ? 'Reactivate Business'
            : 'Delete Business'
        }
        isDestructive={confirmModal.action === 'suspend' || confirmModal.action === 'delete'}
        confirmText={
          confirmModal.action === 'suspend'
            ? 'Suspend Access'
            : confirmModal.action === 'activate'
            ? 'Activate Access'
            : 'Delete Permanently'
        }
        message={
          confirmModal.action === 'suspend' ? (
            <p>
              Are you sure you want to suspend <strong>{confirmModal.business?.name}</strong>? Staff and customers will not be able to access menus or place orders until reactivated. Historical data is preserved.
            </p>
          ) : confirmModal.action === 'activate' ? (
            <p>
              Reactivate <strong>{confirmModal.business?.name}</strong>? Normal business operations, staff logins, and QR ordering will be restored.
            </p>
          ) : (
            <p>
              Are you sure you want to delete <strong>{confirmModal.business?.name}</strong>? This action soft-deletes the business and cancels its subscriptions.
            </p>
          )
        }
      />
    </div>
  );
};

/* Create User Modal */
const CreateUserModal = ({
  businesses,
  defaultRole = 'ADMIN',
  onClose,
  onSuccess,
}: {
  businesses: Business[];
  defaultRole?: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'WAITER';
  onClose: () => void;
  onSuccess: (message: string) => void;
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; phone?: string }>({});
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'WAITER'>(defaultRole);
  const [businessUuid, setBusinessUuid] = useState(businesses[0]?.id || '');
  const [password, setPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUserField = (field: 'fullName' | 'email' | 'phone', value: string): string => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateUserField('fullName', fullName);
    const emailErr = validateUserField('email', email);
    const phoneErr = validateUserField('phone', phone);
    if (nameErr || emailErr || phoneErr) {
      setFieldErrors({ fullName: nameErr, email: emailErr, phone: phoneErr });
      return;
    }
    if (role !== 'SUPER_ADMIN' && !businessUuid) {
      setError('Please select a business for this user.');
      return;
    }

    const pwdVal = validateStrongPassword(password);
    if (!pwdVal.isValid) {
      setError(pwdVal.error || STRONG_PASSWORD_MESSAGE);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        password,
        mustChangePassword,
      };
      if (phone.trim()) {
        payload.phone = phone.trim();
      }
      if (role !== 'SUPER_ADMIN' && businessUuid) {
        payload.businessUuid = businessUuid;
      }

      const res = await apiFetch(getApiUrl('/auth/register'), {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to create user');
      }

      onSuccess(`User "${fullName}" created successfully.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Platform User</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Provision a new user account with assigned role and business</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs font-semibold text-red-500 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-xs underline text-red-400">Dismiss</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => {
                  setFullName(e.target.value);
                  setFieldErrors(prev => ({ ...prev, fullName: validateUserField('fullName', e.target.value) }));
                }}
                placeholder="e.g. Peter Otieno"
                className={`w-full rounded-xl border ${
                  fieldErrors.fullName
                    ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400 bg-red-50/30 dark:bg-red-950/20'
                    : 'border-slate-200 dark:border-slate-700 focus:border-orange-500 bg-slate-50/50 dark:bg-slate-800/50'
                } px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition`}
              />
              {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1 font-medium">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setFieldErrors(prev => ({ ...prev, email: validateUserField('email', e.target.value) }));
                }}
                placeholder="user@example.com"
                className={`w-full rounded-xl border ${
                  fieldErrors.email
                    ? 'border-red-400 focus:border-red-400 focus:ring-1 focus:ring-red-400 bg-red-50/30 dark:bg-red-950/20'
                    : 'border-slate-200 dark:border-slate-700 focus:border-orange-500 bg-slate-50/50 dark:bg-slate-800/50'
                } px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none transition`}
              />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1 font-medium">{fieldErrors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Phone Number (Optional)</label>
              <PhoneInput
                value={phone}
                onChange={v => {
                  setPhone(v);
                  setFieldErrors(prev => ({ ...prev, phone: validateUserField('phone', v) }));
                }}
                error={fieldErrors.phone}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Platform Role *</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500 transition"
              >
                <option value="ADMIN">Business Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="WAITER">Waiter</option>
                <option value="SUPER_ADMIN">Platform Super Admin</option>
              </select>
            </div>
          </div>

          {role !== 'SUPER_ADMIN' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Assigned Business *</label>
              <select
                value={businessUuid}
                onChange={e => setBusinessUuid(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-orange-500 transition"
              >
                {businesses.length === 0 && <option value="">No businesses available</option>}
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.businessType})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Initial Password *</label>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="text-xs font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1"
              >
                <RefreshCcw className="h-3 w-3" /> Regenerate
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 pr-10 text-sm font-mono text-slate-900 dark:text-white outline-none focus:border-orange-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={mustChangePassword}
              onChange={e => setMustChangePassword(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 select-none">
              Require user to change password on first login
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {loading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {loading ? 'Creating User…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   EDIT USER / ADMIN MODAL
══════════════════════════════════════ */
const EditUserModal = ({
  user,
  businesses,
  isBusinessAdminContext = false,
  onClose,
  onSuccess,
  showToast,
}: {
  user: {
    userUuid: string;
    fullName: string;
    email: string;
    phone?: string;
    role: string;
    businessUuid?: string;
    businessName?: string;
    isActive: boolean;
  } | null;
  businesses: Business[];
  isBusinessAdminContext?: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  if (!user) return null;

  const [fullName, setFullName] = useState(user.fullName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(
    user.phone ? user.phone.replace(/^\+?254/, '').replace(/^0+/, '').replace(/\D/g, '').slice(0, 9) : ''
  );
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; phone?: string }>({});
  const [role, setRole] = useState<string>(user.role || (isBusinessAdminContext ? 'ADMIN' : 'WAITER'));
  const [businessUuid, setBusinessUuid] = useState(user.businessUuid || (businesses[0]?.id || ''));
  const [isActive, setIsActive] = useState<boolean>(user.isActive !== false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateUserField = (field: 'fullName' | 'email' | 'phone', value: string): string => {
    if (field === 'fullName') {
      if (!value.trim()) return 'Full name is required';
      if (!/^[a-zA-Z\s]+$/.test(value)) return 'Name can only contain letters and spaces';
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

  const handleGeneratePassword = () => {
    try {
      const pwd = generatePassword();
      setPassword(pwd);
      setShowPassword(true);
    } catch {
      setPassword('Admin@OrderUp2026!');
      setShowPassword(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateUserField('fullName', fullName);
    const emailErr = validateUserField('email', email);
    const phoneErr = validateUserField('phone', phone);
    if (nameErr || emailErr || phoneErr) {
      setFieldErrors({ fullName: nameErr, email: emailErr, phone: phoneErr });
      return;
    }

    if (role !== 'SUPER_ADMIN' && !businessUuid) {
      setError('Please select an assigned business for this user.');
      return;
    }

    if (password.trim()) {
      const pwdVal = validateStrongPassword(password);
      if (!pwdVal.isValid) {
        setError(pwdVal.error || STRONG_PASSWORD_MESSAGE);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        businessUuid: role === 'SUPER_ADMIN' ? (businessUuid || null) : businessUuid,
        isActive,
      };
      if (phone.trim()) {
        payload.phone = phone.trim();
      } else {
        payload.phone = null;
      }
      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await apiFetch(getApiUrl(`/auth/users/${user.userUuid}`), {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to update user');
      }

      onSuccess(`${isBusinessAdminContext ? 'Business Admin' : 'User'} "${fullName}" updated successfully.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(getApiUrl(`/auth/users/${user.userUuid}`), {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Failed to delete account');
      }
      showToast(`Account for "${fullName}" was deleted successfully.`);
      onSuccess(`Account deleted.`);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Edit2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit {isBusinessAdminContext ? 'Business Admin' : 'Platform User'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update account profile, business assignment, role, or credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs font-semibold text-red-500 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-xs underline text-red-400">
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => {
                  setFullName(e.target.value);
                  setFieldErrors(prev => ({ ...prev, fullName: validateUserField('fullName', e.target.value) }));
                }}
                className={`w-full rounded-xl border ${
                  fieldErrors.fullName ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                } px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition`}
              />
              {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1 font-medium">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setFieldErrors(prev => ({ ...prev, email: validateUserField('email', e.target.value) }));
                }}
                className={`w-full rounded-xl border ${
                  fieldErrors.email ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                } px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition`}
              />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1 font-medium">{fieldErrors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Phone Number (Optional)</label>
              <PhoneInput
                value={phone}
                onChange={v => {
                  setPhone(v);
                  setFieldErrors(prev => ({ ...prev, phone: validateUserField('phone', v) }));
                }}
                error={fieldErrors.phone}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Platform Role *</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
              >
                <option value="ADMIN">Business Admin (ADMIN)</option>
                <option value="MANAGER">Manager (MANAGER)</option>
                <option value="WAITER">Waiter (WAITER)</option>
                <option value="SUPER_ADMIN">Platform Super Admin (SUPER_ADMIN)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Assigned Business *</label>
              <select
                value={businessUuid}
                onChange={e => setBusinessUuid(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
              >
                {role === 'SUPER_ADMIN' && <option value="">Platform-wide (No specific business)</option>}
                {businesses.length === 0 && <option value="">No businesses available</option>}
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.businessType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Account Status *</label>
              <select
                value={isActive ? 'ACTIVE' : 'SUSPENDED'}
                onChange={e => setIsActive(e.target.value === 'ACTIVE')}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
              >
                <option value="ACTIVE">Active (Login Enabled)</option>
                <option value="SUSPENDED">Suspended (Login Disabled)</option>
              </select>
            </div>
          </div>

          {/* Optional Password Reset */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Reset Password (Optional)</label>
                <span className="block text-[11px] text-slate-400">Leave blank to keep existing password</span>
              </div>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                <RefreshCcw className="h-3 w-3" /> Generate Password
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password or leave blank"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 pr-10 text-sm font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Delete Danger Zone */}
          {user.role !== 'SUPER_ADMIN' && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              {showDeleteConfirm ? (
                <div className="rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400">
                    <ShieldAlert className="h-4 w-4" /> Permanently delete this account?
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400/90">
                    Are you sure? User "{fullName}" will be deactivated and marked as deleted.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDeleteUser}
                      className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold transition flex items-center gap-1"
                    >
                      {deleting ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Remove user access permanently</span>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete User Account
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {loading ? 'Saving Changes…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   FEATURE 6: BUSINESS ADMINS
══════════════════════════════════════ */
const BusinessAdminsPage = ({
  admins,
  businesses,
  onRefresh,
  showToast,
}: {
  admins: BusinessAdmin[];
  businesses: Business[];
  onRefresh: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<BusinessAdmin | null>(null);
  const [search, setSearch] = useState('');
  const [businessFilter, setBusinessFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return admins.filter(a => {
      const matchSearch =
        a.fullName.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase()) ||
        a.phone.includes(search);
      const matchBusiness = businessFilter === 'ALL' || a.businessUuid === businessFilter;
      return matchSearch && matchBusiness;
    });
  }, [admins, search, businessFilter]);

  const toggleAdminStatus = async (admin: BusinessAdmin) => {
    setActionLoading(admin.userUuid);
    try {
      const newStatus = !admin.isActive;
      const res = await apiFetch(getApiUrl(`/auth/users/${admin.userUuid}/status`), {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update admin account status');
      showToast(`${admin.fullName} is now ${newStatus ? 'Active' : 'Suspended'}`);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Status update failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      {/* Top sticky controls */}
      <div className="flex-shrink-0 space-y-4">
        {showAddAdmin && (
          <CreateUserModal
            businesses={businesses}
            defaultRole="ADMIN"
            onClose={() => setShowAddAdmin(false)}
            onSuccess={msg => {
              showToast(msg);
              onRefresh();
            }}
          />
        )}

        {editingAdmin && (
          <EditUserModal
            user={editingAdmin}
            businesses={businesses}
            isBusinessAdminContext={true}
            onClose={() => setEditingAdmin(null)}
            onSuccess={msg => {
              showToast(msg);
              onRefresh();
            }}
            showToast={showToast}
          />
        )}

        <SectionHeader
          title="Business Admins"
          subtitle="Manage primary administrator accounts provisioned for each business"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddAdmin(true)}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-600 transition"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add Admin
              </button>
              <button
                onClick={() => {
                  csvExport(
                    ['Admin Name', 'Email', 'Phone', 'Business', 'Role', 'Status', 'Last Login', 'Created Date'],
                    filtered.map(a => [a.fullName, a.email, a.phone, a.businessName, a.role, a.status, a.lastLogin, a.createdAt]),
                    'business-admins-export.csv'
                  );
                  showToast('Admins list exported');
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          }
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-lg border px-3.5 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by admin name, email, or phone…"
              className="flex-1 bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          <select
            value={businessFilter}
            onChange={e => setBusinessFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="ALL">All Businesses</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-[300px] rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 w-full">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm" style={{ background: 'var(--bg-card)' }}>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Admin Name</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Contact Info</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Business</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Last Login</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    No business admins found
                  </td>
                </tr>
              ) : (
                filtered.map(admin => (
                  <tr
                    key={admin.userUuid}
                    className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                          {admin.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {admin.fullName}
                          </div>
                          <div className="text-[11px] text-slate-400">{admin.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      <div>{admin.email}</div>
                      <div className="text-slate-400">{admin.phone || '—'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {admin.businessName || '—'}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={admin.status} /></td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{admin.lastLogin}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingAdmin(admin)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition shadow-sm"
                          title="Edit Admin"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => toggleAdminStatus(admin)}
                          disabled={actionLoading === admin.userUuid}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                            admin.isActive
                              ? 'border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                        >
                          {actionLoading === admin.userUuid ? (
                            <RefreshCcw className="h-3 w-3 animate-spin" />
                          ) : admin.isActive ? (
                            <><UserX className="h-3 w-3" /> Deactivate</>
                          ) : (
                            <><UserCheck className="h-3 w-3" /> Activate</>
                          )}
                        </button>
                      </div>
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

/* ══════════════════════════════════════
   FEATURE 7: PLATFORM USERS
══════════════════════════════════════ */
const PlatformUsersPage = ({
  businesses,
  showToast,
}: {
  businesses: Business[];
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [businessFilter, setBusinessFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(getApiUrl('/auth/users'));
      if (res.ok) {
        const data = await res.json();
        const rawUsers: any[] = data.data?.users ?? [];
        setUsers(
          rawUsers.map(u => ({
            id: u.userUuid || u.uuid,
            userUuid: u.userUuid || u.uuid,
            fullName: u.fullName || 'User',
            email: u.email,
            phone: u.phone,
            role: u.role,
            businessUuid: u.businessUuid,
            businessName: u.business?.name ?? '—',
            businessType: u.business?.businessType ?? '—',
            isActive: u.isActive !== false,
            isOnline: Boolean(u.isOnline),
            onlineStatus: u.onlineStatus || (u.isActive ? 'Active' : 'Inactive'),
            lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never',
            createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
          }))
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.phone && u.phone.includes(search));
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchBusiness = businessFilter === 'ALL' || u.businessUuid === businessFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive);
      return matchSearch && matchRole && matchBusiness && matchStatus;
    });
  }, [users, search, roleFilter, businessFilter, statusFilter]);

  const toggleUserStatus = async (user: PlatformUser) => {
    setActionLoading(user.userUuid);
    try {
      const newStatus = !user.isActive;
      const res = await apiFetch(getApiUrl(`/auth/users/${user.userUuid}/status`), {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update account status');
      showToast(`${user.fullName} is now ${newStatus ? 'Active' : 'Suspended'}`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Status update failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      {/* Top sticky controls */}
      <div className="flex-shrink-0 space-y-4">
        {showAddUser && (
          <CreateUserModal
            businesses={businesses}
            onClose={() => setShowAddUser(false)}
            onSuccess={msg => {
              showToast(msg);
              fetchUsers();
            }}
          />
        )}

        {editingUser && (
          <EditUserModal
            user={editingUser}
            businesses={businesses}
            isBusinessAdminContext={false}
            onClose={() => setEditingUser(null)}
            onSuccess={msg => {
              showToast(msg);
              fetchUsers();
            }}
            showToast={showToast}
          />
        )}

        <SectionHeader
          title="Platform Users"
          subtitle="Platform-wide user directory across all businesses and roles"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-600 transition"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add Platform User
              </button>
              <button
                onClick={() => {
                  csvExport(
                    ['Name', 'Email', 'Phone', 'Role', 'Business', 'Status', 'Created At'],
                    filtered.map(u => [u.fullName, u.email, u.phone || '', u.role, u.businessName || '', u.isActive ? 'Active' : 'Inactive', u.createdAt]),
                    'platform-users.csv'
                  );
                  showToast('Users exported');
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <Download className="h-3.5 w-3.5" /> Export Users
              </button>
            </div>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-lg border px-3.5 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone…"
              className="flex-1 bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Business Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="WAITER">Waiter</option>
          </select>

          <select
            value={businessFilter}
            onChange={e => setBusinessFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none max-w-xs"
          >
            <option value="ALL">All Businesses</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Suspended / Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-[300px] rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 w-full">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm" style={{ background: 'var(--bg-card)' }}>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">User</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Role</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Assigned Business</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Registered</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    <RefreshCcw className="h-4 w-4 animate-spin inline mr-1.5" /> Loading platform users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    No users found matching your filters
                  </td>
                </tr>
              ) : (
                filtered.map(user => (
                  <tr
                    key={user.userUuid}
                    className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {user.fullName}
                      </div>
                      <div className="text-xs text-slate-400">{user.email} {user.phone && `· ${user.phone}`}</div>
                    </td>
                    <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {user.businessName || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={user.isActive ? 'Active' : 'Suspended'} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{user.createdAt}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition shadow-sm"
                          title="Edit User"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                        {user.role !== 'SUPER_ADMIN' && (
                          <button
                            onClick={() => toggleUserStatus(user)}
                            disabled={actionLoading === user.userUuid}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              user.isActive
                                ? 'border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                          >
                            {actionLoading === user.userUuid ? (
                              <RefreshCcw className="h-3 w-3 animate-spin" />
                            ) : user.isActive ? (
                              'Deactivate'
                            ) : (
                              'Activate'
                            )}
                          </button>
                        )}
                      </div>
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

/* ══════════════════════════════════════
   FEATURE 8: PLATFORM ANALYTICS
══════════════════════════════════════ */
const PlatformAnalyticsPage = ({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) => {
  const [report, setReport] = useState<any>(null);
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(getApiUrl(`/reports/analytics?period=${period}&businessUuid=ALL`));
      if (res.ok) {
        const data = await res.json();
        setReport(data.data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const weeklyData = report?.dailyRevenue?.map((d: any) => ({
    day: d.day,
    revenue: Number(d.revenue || 0),
    orders: Number(d.orders ?? d.orderCount ?? d.count ?? 0),
  })) || [];

  const payBreakdown = [
    { name: 'M-Pesa STK', value: report?.paymentBreakdown?.mpesa?.percentage ?? 0, color: '#10B981' },
    { name: 'Card POS', value: report?.paymentBreakdown?.card?.percentage ?? 0, color: '#2563EB' },
    { name: 'Cash', value: report?.paymentBreakdown?.cash?.percentage ?? 0, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Platform Analytics"
        subtitle="Cross-tenant aggregated revenue, orders, and payment performance"
        action={
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="DAILY">Today (Daily)</option>
              <option value="WEEKLY">This Week (Weekly)</option>
              <option value="MONTHLY">This Month (Monthly)</option>
              <option value="YEARLY">This Year (Yearly)</option>
            </select>
            <button
              onClick={() => {
                csvExport(
                  ['Day', 'Revenue (KES)', 'Orders'],
                  weeklyData.map((o: any) => [o.day, o.revenue, o.orders]),
                  `analytics-${period.toLowerCase()}.csv`
                );
                showToast('Analytics exported');
              }}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI label="Total Orders" value={String(report?.kpis?.totalOrdersCount ?? 0)} sub="All Platform Orders" icon={<ClipboardList className="h-5 w-5 text-blue-500" />} />
        <KPI label="Platform Revenue" value={`KES ${(report?.kpis?.totalRevenue ?? 0).toLocaleString()}`} sub="Gross Completed Settlements" icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} />
        <KPI label="Avg Order Value" value={`KES ${(report?.kpis?.averageOrderValue ?? 0).toLocaleString()}`} sub="Per Checkout Average" icon={<Store className="h-5 w-5 text-purple-500" />} />
        <KPI label="Active Staff" value={String(report?.kpis?.activeWaitersCount ?? 0)} sub="Active Waiters & Staff" icon={<Users className="h-5 w-5 text-amber-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">Revenue Breakdown ({period})</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `KES ${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }} formatter={(v: number) => [`KES ${v.toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">Payment Method Split</h3>
          <ResponsiveContainer width="100%" height={150}>
            <RePieChart>
              <Pie data={payBreakdown} innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={4}>
                {payBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={v => `${v}%`} contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid var(--border)' }} />
            </RePieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {payBreakdown.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      {report?.topProducts && report.topProducts.length > 0 && (
        <div className="rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5 space-y-3">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Top Selling Products Across Establishments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  {['Product', 'Category', 'Units Sold', 'Total Revenue'].map(h => (
                    <th key={h} className="pb-2 text-left text-xs font-bold text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.topProducts.map((p: any) => (
                  <tr key={p.name} className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50/50">
                    <td className="py-2.5 font-semibold text-xs text-slate-900 dark:text-white">{p.name}</td>
                    <td className="py-2.5 text-xs text-slate-500">{p.category}</td>
                    <td className="py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">{p.unitsSold} units</td>
                    <td className="py-2.5 text-xs font-bold text-emerald-600">KES {Number(p.revenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════
   FEATURE 9: AUDIT LOGS
══════════════════════════════════════ */
const AuditLogsPage = ({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(getApiUrl('/notifications/audit-logs'));
      if (res.ok) {
        const data = await res.json();
        const raw: any[] = data.data ?? [];
        setLogs(
          raw.map((l, idx) => ({
            id: l.auditUuid || `log-${idx}`,
            action: l.action,
            actor: l.user?.fullName || l.user?.email || 'System Worker',
            role: l.user?.role || 'SYSTEM',
            resource: l.entityType ? `${l.entityType} (${l.entityUuid || 'global'})` : l.resource || '/system',
            businessName: l.business?.name || l.club?.name || 'Platform-Wide',
            ip: l.ipAddress || '127.0.0.1',
            time: l.createdAt ? new Date(l.createdAt).toLocaleString() : 'Just now',
            level: l.action.toLowerCase().includes('suspend') || l.action.toLowerCase().includes('delete') ? 'WARN' : 'INFO',
          }))
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const filtered = useMemo(() => {
    return logs.filter(l =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actor.toLowerCase().includes(search.toLowerCase()) ||
      l.businessName?.toLowerCase().includes(search.toLowerCase()) ||
      l.resource.toLowerCase().includes(search.toLowerCase())
    );
  }, [logs, search]);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      {/* Top sticky controls */}
      <div className="flex-shrink-0 space-y-4">
        <SectionHeader
          title="Audit Logs & Compliance"
          subtitle="Platform security events, admin actions, and state changes recorded in the audit trail"
          action={
            <button
              onClick={() => {
                csvExport(
                  ['Level', 'Action', 'Actor', 'Role', 'Target Resource', 'Business', 'IP Address', 'Timestamp'],
                  filtered.map(l => [l.level, l.action, l.actor, l.role, l.resource, l.businessName || '', l.ip, l.time]),
                  'audit-logs.csv'
                );
                showToast('Audit logs exported');
              }}
              className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <Download className="h-3.5 w-3.5" /> Export Audit Logs
            </button>
          }
        />

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-lg border px-3.5 py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search audit events by action, actor, or business…"
              className="flex-1 bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-[300px] rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 w-full">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 shadow-sm" style={{ background: 'var(--bg-card)' }}>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Severity</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Action / Event</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Actor</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Target Resource</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Business Scope</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">IP Address</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 whitespace-nowrap bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    <RefreshCcw className="h-4 w-4 animate-spin inline mr-1.5" /> Loading audit logs…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    No audit records match your query
                  </td>
                </tr>
              ) : (
                filtered.map(log => (
                  <tr
                    key={log.id}
                    className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition"
                  >
                    <td className="px-5 py-3.5"><StatusBadge status={log.level} /></td>
                    <td className="px-5 py-3.5 font-medium text-xs sm:text-sm text-slate-900 dark:text-white">
                      {log.action}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {log.actor} <span className="text-slate-400">({log.role})</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{log.resource}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 font-medium">{log.businessName}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-400">{log.ip}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{log.time}</td>
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

/* ══════════════════════════════════════
   SUBSCRIPTIONS & BILLING
══════════════════════════════════════ */
const SubscriptionsPage = ({
  businesses,
  showToast,
}: {
  businesses: Business[];
  showToast: (m: string, t?: 'success' | 'error') => void;
}) => {
  const planBreakdown = [
    { plan: 'Pro', price: 8900, count: businesses.filter(b => b.plan === 'Pro').length, mrr: businesses.filter(b => b.plan === 'Pro' && b.status === 'Active').length * 8900 },
    { plan: 'Standard', price: 4900, count: businesses.filter(b => b.plan === 'Standard').length, mrr: businesses.filter(b => b.plan === 'Standard' && b.status === 'Active').length * 4900 },
    { plan: 'Starter', price: 3900, count: businesses.filter(b => b.plan === 'Starter').length, mrr: businesses.filter(b => b.plan === 'Starter' && b.status === 'Active').length * 3900 },
  ];
  const totalMrr = planBreakdown.reduce((s, p) => s + p.mrr, 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Subscriptions & Billing Overview"
        subtitle="Platform subscription tiers and MRR calculations based on active businesses"
        action={
          <button
            onClick={() => {
              csvExport(
                ['Plan', 'Price (KES)', 'Businesses Count', 'MRR (KES)'],
                planBreakdown.map(p => [p.plan, p.price, p.count, p.mrr]),
                'subscriptions-breakdown.csv'
              );
              showToast('Subscriptions exported');
            }}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planBreakdown.map(p => (
          <div key={p.plan} className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <StatusBadge status={p.plan} />
              <span className="text-xs font-bold text-slate-400">{p.count} businesses</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">KES {p.price.toLocaleString()}</div>
              <div className="text-xs text-slate-400">per month</div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-sm font-black text-emerald-600">MRR: KES {p.mrr.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">Total Monthly Recurring Revenue (Estimated)</h3>
        <p className="text-2xl font-black text-emerald-600">KES {totalMrr.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ month</span></p>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   PLATFORM SETTINGS
══════════════════════════════════════ */
const PlatformSettingsPage = ({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) => {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [trialDays, setTrialDays] = useState('14');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader title="Platform Settings" subtitle="Global configuration for the Multi-Tenant Business Platform" />
      <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <div className="font-semibold text-sm mb-1 text-slate-900 dark:text-white">Default Trial Period</div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={trialDays}
              onChange={e => setTrialDays(e.target.value)}
              className="w-20 rounded-lg border px-3 py-2 text-sm text-center font-bold outline-none bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <span className="text-sm text-slate-500">days for newly provisioned businesses</span>
          </div>
        </div>
      </div>

      {/* Legal & Compliance Policies Section */}
      <div className="rounded-xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Platform Legal & Compliance Policies</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Official statutory documents accepted by Business Administrators upon establishment onboarding.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> View Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-600" /> View Terms & Conditions
          </button>
        </div>
      </div>

      {[
        { label: 'Email Security Notifications', desc: 'Send system security alerts and audit summaries to super admins.', val: emailNotifs, set: setEmailNotifs },
        { label: 'Maintenance Mode', desc: 'Temporarily lock public storefronts while platform updates run.', val: maintenance, set: setMaintenance },
      ].map(item => (
        <div key={item.label} className="rounded-xl border p-5 flex items-center justify-between bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div>
            <div className="font-semibold text-sm text-slate-900 dark:text-white">{item.label}</div>
            <div className="text-xs mt-0.5 text-slate-400">{item.desc}</div>
          </div>
          <button
            onClick={() => item.set(!item.val)}
            className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${item.val ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${item.val ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      ))}

      <button
        onClick={() => showToast('Platform configuration saved')}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition shadow-md shadow-blue-500/20"
        style={{ background: '#2563EB' }}
      >
        Save Platform Settings
      </button>

      <PrivacyPolicyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsAndConditionsModal open={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
};

/* ─── Navigation Item Definition ─── */
type NavKey = 'dashboard' | 'businesses' | 'admins' | 'analytics' | 'users' | 'audit-logs' | 'subscriptions' | 'settings';

const NAV_ITEMS: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'businesses', label: 'Businesses', icon: <Building2 className="h-4 w-4" /> },
  { key: 'admins', label: 'Business Admins', icon: <UserCog className="h-4 w-4" /> },
  { key: 'analytics', label: 'Platform Analytics', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { key: 'audit-logs', label: 'Audit Logs', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'subscriptions', label: 'Subscriptions', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'settings', label: 'Platform Settings', icon: <Settings className="h-4 w-4" /> },
];

const PAGE_TITLES: Record<NavKey, string> = {
  dashboard: 'Platform Overview',
  businesses: 'Businesses & Establishments',
  admins: 'Business Admins',
  analytics: 'Platform Analytics',
  users: 'Platform Users Directory',
  'audit-logs': 'Audit Logs & Compliance',
  subscriptions: 'Subscriptions & Billing',
  settings: 'Platform Settings',
};

/* ─── Main Super Admin Dashboard Component ─── */
export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [page, setPage] = useState<NavKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);

  /* Data States */
  const [stats, setStats] = useState<PlatformStatsData | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [admins, setAdmins] = useState<BusinessAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  /* User Info */
  const currentUser = useMemo(() => {
    try {
      const u = localStorage.getItem('orderup_user') || localStorage.getItem('drinkhub_user');
      return u ? JSON.parse(u) : { fullName: 'Super Admin', email: 'superadmin@orderup.co.ke' };
    } catch {
      return { fullName: 'Super Admin', email: 'superadmin@orderup.co.ke' };
    }
  }, []);

  /* Dropdowns */
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  /* Click outside to close */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Data Fetching */
  const loadPlatformData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tenantRes, staffRes] = await Promise.allSettled([
        apiFetch(getApiUrl('/tenants/platform/stats')),
        apiFetch(getApiUrl('/tenants')),
        apiFetch(getApiUrl('/auth/staff?role=ADMIN')),
      ]);

      // 1. Platform Stats
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const sData = await statsRes.value.json();
        setStats(sData.data);
      }

      // 2. All Businesses
      if (tenantRes.status === 'fulfilled' && tenantRes.value.ok) {
        const tenantData = await tenantRes.value.json();
        const rawTenants: any[] = tenantData.data ?? [];
        const parsedBusinesses: Business[] = rawTenants.map(t => {
          const primaryUser = t.users?.find((u: any) => u.role === 'ADMIN' || u.role === 'MANAGER') ?? t.users?.[0];
          return {
            id: t.businessUuid || t.clubUuid || t.uuid || t.id,
            name: t.name,
            slug: t.slug,
            businessType: t.businessType || 'RESTAURANT',
            description: t.description ?? '',
            address: t.address ?? '',
            city: t.city ?? '',
            county: t.county ?? 'Nairobi',
            phone: t.phone ?? '',
            email: t.email ?? '',
            openingTime: t.openingHours ?? '08:00',
            closingTime: t.closingHours ?? '23:00',
            logoUrl: t.logoUrl ?? '',
            bannerUrl: t.bannerUrl ?? '',
            themeColor: t.themeColor || t.brandColor || '#2563EB',
            plan: t.subscriptionStatus === 'TRIAL' ? 'Starter' : t.subscriptionStatus === 'SUSPENDED' ? 'Standard' : 'Pro',
            status: t.isActive === false || t.status === 'SUSPENDED' ? 'Suspended' : (t.status ?? 'Active'),
            isActive: t.isActive !== false && t.status !== 'SUSPENDED',
            mrr: t.isActive === false || t.status === 'SUSPENDED' ? 0 : 8900,
            orders: t._count?.orders ?? t.orders?.length ?? 0,
            adminId: primaryUser ? (primaryUser.userUuid || primaryUser.uuid || '') : '',
            adminName: primaryUser ? primaryUser.fullName : undefined,
            adminEmail: primaryUser ? primaryUser.email : undefined,
            createdAt: t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : '',
            trialDays: 14,
            startDate: '',
            expiryDate: '',
            // Model B: Independent Daraja M-Pesa Credentials
            mpesaConsumerKey: t.mpesaConsumerKey ?? null,
            mpesaConsumerSecret: t.mpesaConsumerSecret ?? null,
            mpesaShortcode: t.mpesaShortcode ?? null,
            mpesaPasskey: t.mpesaPasskey ?? null,
            mpesaTransactionType: t.mpesaTransactionType ?? 'CustomerPayBillOnline',
            mpesaEnvironment: t.mpesaEnvironment ?? 'sandbox',
            isMpesaActive: Boolean(t.isMpesaActive),
            hasMpesaConfig: Boolean(t.hasMpesaConfig ?? (t.mpesaConsumerKey && t.mpesaShortcode && t.isMpesaActive)),
          };
        });
        setBusinesses(parsedBusinesses);
      }

      // 3. Business Admins
      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        const staffData = await staffRes.value.json();
        const rawStaff: any[] = staffData.data?.staff ?? staffData.data ?? [];
        const parsedAdmins: BusinessAdmin[] = rawStaff.map(s => ({
          id: s.uuid ?? s.userUuid,
          userUuid: s.uuid ?? s.userUuid,
          fullName: s.fullName || 'Admin',
          firstName: s.fullName ? s.fullName.split(' ')[0] : 'Admin',
          lastName: s.fullName ? s.fullName.split(' ').slice(1).join(' ') : '',
          email: s.email,
          phone: s.phone ?? '',
          businessUuid: s.businessUuid ?? s.clubUuid ?? '',
          businessName: s.business?.name ?? s.club?.name ?? 'Assigned Business',
          businessType: s.business?.businessType ?? 'RESTAURANT',
          role: s.role,
          status: s.isActive !== false ? 'Active' : 'Suspended',
          isActive: s.isActive !== false,
          lastLogin: s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : 'Never',
          createdAt: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '',
        }));
        setAdmins(parsedAdmins);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatformData();
  }, [loadPlatformData]);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardOverviewPage stats={stats} loading={loading} onNavigate={setPage} showToast={showToast} />;
      case 'businesses':
        return <BusinessesPage businesses={businesses} admins={admins} onRefresh={loadPlatformData} showToast={showToast} />;
      case 'admins':
        return <BusinessAdminsPage admins={admins} businesses={businesses} onRefresh={loadPlatformData} showToast={showToast} />;
      case 'analytics':
        return <PlatformAnalyticsPage showToast={showToast} />;
      case 'users':
        return <PlatformUsersPage businesses={businesses} showToast={showToast} />;
      case 'audit-logs':
        return <AuditLogsPage showToast={showToast} />;
      case 'subscriptions':
        return <SubscriptionsPage businesses={businesses} showToast={showToast} />;
      case 'settings':
        return <PlatformSettingsPage showToast={showToast} />;
      default:
        return <DashboardOverviewPage stats={stats} loading={loading} onNavigate={setPage} showToast={showToast} />;
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

      {/* ─── SIDEBAR ─── */}
      <aside
        className={`flex-shrink-0 flex flex-col h-screen transition-all duration-200 z-50
          fixed lg:sticky top-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ width: collapsed ? '64px' : '230px', background: 'var(--bg-sidebar)', borderRight: '1px solid #1E293B' }}
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-800">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="h-8 w-8 rounded-lg bg-blue-600 flex-shrink-0 flex items-center justify-center hover:bg-blue-700 transition"
            title="Toggle Sidebar"
          >
            <Store className="h-4 w-4 text-white" />
          </button>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-black text-white truncate">OrderUp</div>
              <div className="text-[10px] text-blue-400 font-semibold tracking-wide uppercase">Super Admin</div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => { setPage(item.key); setMobileOpen(false); }}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                page === item.key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-slate-800">
          <button
            onClick={onLogout}
            title={collapsed ? 'Sign Out' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header
          className="flex-shrink-0 border-b px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between z-20 backdrop-blur-md"
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
              <h1 className="text-base font-black tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                {PAGE_TITLES[page]}
              </h1>
              <p className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text-muted)' }}>
                Super Admin Console · Platform Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Zap className="h-3.5 w-3.5 text-emerald-500" /> Platform Operational
            </div>

            <ThemeToggle />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: 'var(--border)', background: profileOpen ? 'var(--bg-muted)' : 'transparent' }}
              >
                <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">SA</span>
                </div>
                <span className="text-xs font-bold hidden sm:inline" style={{ color: 'var(--text-primary)' }}>
                  {currentUser.fullName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform text-slate-400" style={{ transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-2xl z-50 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 animate-in fade-in"
                >
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{currentUser.fullName}</div>
                    <div className="text-xs text-slate-400 truncate">{currentUser.email}</div>
                    <span className="inline-block mt-1.5 rounded-full bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                      Super Administrator
                    </span>
                  </div>

                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setPage('settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" /> Platform Settings
                    </button>
                    <button
                      onClick={() => { setPage('audit-logs'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Audit Trail
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 p-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition text-left"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-0 flex flex-col">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
