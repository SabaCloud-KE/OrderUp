import React, { useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ThemeToggle, useTheme } from '@orderup/ui';
import {
  Wine, LayoutDashboard, ClipboardList, BookOpen, Users, TrendingUp,
  Settings, Bell, LogOut, ChevronDown, ChevronLeft, ChevronRight, Search, Plus, Download,
  Eye, EyeOff, Trash2, Edit2, CheckCircle2, X, RefreshCcw, Filter,
  AlertCircle, ArrowUpRight, RotateCcw, Key, UserX, UserCheck,
  Phone, Mail, Hash, Lock, Clock, Briefcase, Shield, QrCode, Copy, ExternalLink,
  Tag, Layers, FolderPlus, Camera, Image, Upload, Printer, Sparkles, Flame, Gift, Percent, Zap,
  Menu, Grid, List, Smartphone, Check, ChevronUp, Maximize2, ZoomIn,
} from 'lucide-react';
import { resolveImageUrl, getApiUrl, getSocketUrl } from '../config/api';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/*           Toast           */
const Toast = ({ msg, type = 'success', onDone }: { msg: string; type?: 'success' | 'error'; onDone: () => void }) => {
  React.useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-[999] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl"
      style={{ background: type === 'success' ? '#0F172A' : '#7F1D1D', border: '1px solid rgba(255,255,255,0.1)', minWidth: 260 }}>
      {type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
      {msg}
    </div>
  );
};

/*           Modal           */
const Modal = ({ open, onClose, title, size = 'md', zIndex = 'z-50', children }: { open: boolean; onClose: () => void; title: string; size?: 'sm' | 'md' | 'lg'; zIndex?: string; children: React.ReactNode }) => {
  React.useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  if (!open) return null;
  const w = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/50 backdrop-blur-sm`} onClick={onClose}>
      <div className={`w-full ${w} rounded-2xl p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto`} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }} onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--text-muted)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-body)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

/*           Form Primitives           */
const FL = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);
const FE = ({ msg }: { msg?: string }) => msg ? <p className="text-xs text-red-500 mt-1 font-medium">{msg}</p> : null;

const SI = ({ error, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) => (
  <div>
    <input {...p} className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 outline-none transition ${error ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300' : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`} />
    <FE msg={error} />
  </div>
);
const STA = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" />
);
const SS = ({ options, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { v: string; l: string }[] }) => (
  <select {...p} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition">
    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

/* Phone field with +254 prefix */
const PhoneInput = ({ error, value, onChange, placeholder }: { error?: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div>
    <div className="flex">
      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 select-none">+254</span>
      <input
        type="tel"
        value={value}
        onChange={e => onChange(e.target.value.replace(/^\+?254/, '').replace(/^0/, ''))}
        placeholder={placeholder ?? '7XX XXX XXX'}
        className={`flex-1 rounded-r-lg border px-3 py-2.5 text-sm text-slate-900 outline-none transition ${error ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300' : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'}`}
      />
    </div>
    {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
  </div>
);

/*           Shared UI           */
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

const getStatusConfig = (rawStatus: string) => {
  const key = (rawStatus ?? '').toUpperCase().trim();
  switch (key) {
    case 'PENDING':
      return {
        label: 'PENDING',
        dot: 'bg-amber-500 animate-pulse',
        badge: 'bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60 shadow-sm shadow-amber-500/10',
        activeFilter: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm shadow-amber-500/30',
        inactiveFilter: 'hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300',
      };
    case 'CLAIMED':
      return {
        label: 'CLAIMED',
        dot: 'bg-sky-500',
        badge: 'bg-sky-50 text-sky-800 border-sky-300/80 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-700/60 shadow-sm shadow-sky-500/10',
        activeFilter: 'bg-sky-600 hover:bg-sky-700 text-white border-sky-600 shadow-sm shadow-sky-500/30',
        inactiveFilter: 'hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 text-sky-700 dark:text-sky-300',
      };
    case 'PREPARING':
      return {
        label: 'PREPARING',
        dot: 'bg-indigo-500',
        badge: 'bg-indigo-50 text-indigo-800 border-indigo-300/80 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-700/60 shadow-sm shadow-indigo-500/10',
        activeFilter: 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-sm shadow-indigo-500/30',
        inactiveFilter: 'hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      };
    case 'READY':
      return {
        label: 'READY',
        dot: 'bg-teal-500',
        badge: 'bg-teal-50 text-teal-800 border-teal-300/80 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-700/60 shadow-sm shadow-teal-500/10',
        activeFilter: 'bg-teal-600 hover:bg-teal-700 text-white border-teal-600 shadow-sm shadow-teal-500/30',
        inactiveFilter: 'hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 text-teal-700 dark:text-teal-300',
      };
    case 'DELIVERED':
    case 'COMPLETED':
      return {
        label: 'DELIVERED',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60 shadow-sm shadow-emerald-500/10',
        activeFilter: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm shadow-emerald-500/30',
        inactiveFilter: 'hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
      };
    case 'CANCELLED':
      return {
        label: 'CANCELLED',
        dot: 'bg-rose-500',
        badge: 'bg-rose-50 text-rose-800 border-rose-300/80 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700/60 shadow-sm shadow-rose-500/10',
        activeFilter: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm shadow-rose-500/30',
        inactiveFilter: 'hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-300',
      };
    case 'ACTIVE':
    case 'ONLINE':
    case 'AVAILABLE':
      return {
        label: rawStatus,
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60',
        activeFilter: 'bg-emerald-600 text-white border-emerald-600',
        inactiveFilter: 'hover:border-emerald-400',
      };
    case 'INACTIVE':
    case 'OFFLINE':
      return {
        label: rawStatus,
        dot: 'bg-slate-400',
        badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        activeFilter: 'bg-slate-600 text-white border-slate-600',
        inactiveFilter: 'hover:border-slate-400',
      };
    case 'ON LEAVE':
      return {
        label: 'On Leave',
        dot: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60',
        activeFilter: 'bg-amber-600 text-white border-amber-600',
        inactiveFilter: 'hover:border-amber-400',
      };
    case 'OUT OF STOCK':
      return {
        label: 'Out of Stock',
        dot: 'bg-rose-500',
        badge: 'bg-rose-50 text-rose-800 border-rose-300/80 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700/60',
        activeFilter: 'bg-rose-600 text-white border-rose-600',
        inactiveFilter: 'hover:border-rose-400',
      };
    default:
      return {
        label: rawStatus,
        dot: 'bg-slate-400',
        badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        activeFilter: 'bg-blue-600 text-white border-blue-600',
        inactiveFilter: 'hover:border-slate-400',
      };
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const config = getStatusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border transition-colors whitespace-nowrap ${config.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};

const KPI = ({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) => (
  <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
    <div className="flex items-start justify-between mb-3">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-body)' }}>{icon}</div>
    </div>
    <div className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{value}</div>
    <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{label}</div>
    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>
  </div>
);

const SectionHeader = ({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-6">
    <div>
      <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

/*           Utilities           */
const csvExport = (headers: string[], rows: (string | number | boolean)[][], filename: string) => {
  const e = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
  const content = [headers.map(e).join(','), ...rows.map(r => r.map(e).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const generatePassword = (): string => {
  const u = 'ABCDEFGHJKLMNPQRSTUVWXYZ', l = 'abcdefghjkmnpqrstuvwxyz', d = '23456789', s = '@#$!';
  const all = u + l + d + s;
  const pwd = [u, l, d, s].map(c => c[Math.floor(Math.random() * c.length)]);
  for (let i = 0; i < 8; i++) pwd.push(all[Math.floor(Math.random() * all.length)]);
  for (let i = pwd.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pwd[i], pwd[j]] = [pwd[j], pwd[i]]; }
  return pwd.join('');
};

const getClubUuid = (): string | null => {
  try {
    const userStr = localStorage.getItem('orderup_user') || localStorage.getItem('drinkhub_user');
    if (!userStr) return null;
    const u = JSON.parse(userStr);
    return (
      u.businessUuid ||
      u.clubUuid ||
      u.tenantId ||
      u.business?.uuid ||
      u.club?.uuid ||
      u.club?.clubUuid ||
      null
    );
  } catch {
    return null;
  }
};

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('orderup_token') || localStorage.getItem('drinkhub_token');
  const clubUuid = getClubUuid();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(clubUuid ? { 'X-Tenant-Id': clubUuid, 'X-Business-Uuid': clubUuid } : {}),
  };
};

/* --- Data types --- */
interface Waiter {
  id: string; firstName: string; lastName: string; phone: string;
  email: string; username: string; employeeNo: string; status: 'Active' | 'Inactive' | 'On Leave';
  shift: string; onlineStatus: 'Online' | 'Offline'; lastLogin: string; notes: string;
}

/* Empty initial arrays - data is loaded from the API in each section */
const initWaiters: Waiter[] = [];
type OrderRow = { id: string; table: string; item: string; waiter: string; amount: number; status: string; time: string };
type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  imageUrl?: string | null;
  description?: string | null;
};



/* ------------------------------------------------ 
   ADD WAITER MODAL
------------------------------------------------ */
interface WaiterForm {
  firstName: string; lastName: string; phone: string; email: string;
  username: string; employeeNo: string; tempPwd: string;
  requirePwdChange: boolean; status: string; shift: string; notes: string;
}
const defaultWaiterForm: WaiterForm = {
  firstName: '', lastName: '', phone: '', email: '', username: '', employeeNo: '',
  tempPwd: '', requirePwdChange: true, status: 'Active', shift: 'Evening', notes: '',
};

const AddWaiterModal = ({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (w: Waiter) => void;
  onError?: (msg: string) => void;
}) => {
  const [form, setForm] = React.useState<WaiterForm>({ ...defaultWaiterForm, tempPwd: generatePassword() });
  const [errors, setErrors] = React.useState<Partial<Record<keyof WaiterForm | 'api', string>>>({});
  const [showPwd, setShowPwd] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const validateField = (k: keyof WaiterForm, v: string): string => {
    if (k === 'firstName' || k === 'lastName') {
      if (!String(v).trim()) return 'Required';
      if (!/^[a-zA-Z\s]+$/.test(String(v))) return 'Letters only';
      if (String(v).trim().length < 2) return 'Min 2 characters';
    }
    if (k === 'phone') {
      if (!String(v).trim()) return 'Required';
      if (!/^\d+$/.test(String(v).trim())) return 'Numbers only';
    }
    if (k === 'email') {
      if (!String(v).trim()) return 'Email is required for login';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) return 'Enter a valid email address';
    }
    return '';
  };

  const set = (k: keyof WaiterForm, v: string | boolean) => {
    setForm(p => ({ ...p, [k]: v }));
    if (typeof v === 'string') {
      setErrors(p => ({ ...p, [k]: validateField(k, v) }));
    } else {
      setErrors(p => ({ ...p, [k]: '' }));
    }
  };

  const validate = () => {
    const e: Partial<Record<keyof WaiterForm, string>> = {};
    const fnErr = validateField('firstName', form.firstName); if (fnErr) e.firstName = fnErr;
    const lnErr = validateField('lastName', form.lastName); if (lnErr) e.lastName = lnErr;
    const phErr = validateField('phone', form.phone); if (phErr) e.phone = phErr;
    const emErr = validateField('email', form.email); if (emErr) e.email = emErr;
    if (form.tempPwd.length < 8) e.tempPwd = 'Min. 8 characters';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch(getApiUrl('/auth/register'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.tempPwd,
          fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
          phone: form.phone.trim() || undefined,
          role: 'WAITER',
          mustChangePassword: form.requirePwdChange,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ api: data?.error?.message ?? data?.message ?? 'Failed to create waiter' });
        return;
      }
      const u = data.data;
      const parts = (u.fullName ?? '').split(' ');
      const idx = Math.floor(Math.random() * 900 + 100);
      onAdd({
        id: u.id ?? u.userUuid ?? `w${Date.now()}`,
        firstName: parts[0] ?? form.firstName,
        lastName: parts.slice(1).join(' ') || form.lastName,
        phone: form.phone.trim(),
        email: u.email ?? form.email,
        username: u.email?.split('@')[0] ?? form.username,
        employeeNo: form.employeeNo || `EMP-${idx}`,
        status: 'Active' as Waiter['status'],
        shift: form.shift,
        onlineStatus: 'Offline' as const,
        lastLogin: 'Never',
        notes: form.notes,
      });
      setForm({ ...defaultWaiterForm, tempPwd: generatePassword() });
      setErrors({});
      onClose();
    } catch {
      setErrors({ api: 'Network error — please try again' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Waiter" size="lg">
      <div className="space-y-6">

        {/* Section 1     Personal Information */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-6 rounded-md bg-blue-100 flex items-center justify-center"><Users className="h-3.5 w-3.5 text-blue-600" /></div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Personal Information</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><FL required>First Name</FL><SI value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jane" error={errors.firstName} /></div>
            <div><FL required>Last Name</FL><SI value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Wanjiku" error={errors.lastName} /></div>
            <div><FL required>Phone Number</FL><PhoneInput value={form.phone} onChange={v => set('phone', v)} error={errors.phone} /></div>
            <div><FL required>Email</FL><SI type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@club.co.ke" error={errors.email} /></div>
            <div><FL>Employee No. <span className="text-slate-400 font-normal normal-case">(optional)</span></FL><SI value={form.employeeNo} onChange={e => set('employeeNo', e.target.value)} placeholder="EMP-006" /></div>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: '#E2E8F0' }} />

        {/* Section 2     Authentication */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-6 rounded-md bg-purple-100 flex items-center justify-center"><Lock className="h-3.5 w-3.5 text-purple-600" /></div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Authentication</h4>
          </div>
          <div className="space-y-3">
            <div>
              <FL required>Temporary Password</FL>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <SI type={showPwd ? 'text' : 'password'} value={form.tempPwd} onChange={e => set('tempPwd', e.target.value)} placeholder="Min. 8 characters" error={errors.tempPwd} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => set('tempPwd', generatePassword())} className="flex-shrink-0 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-blue-300 transition-all flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Generate
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
              <input type="checkbox" checked={form.requirePwdChange} onChange={e => set('requirePwdChange', e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
              <div>
                <div className="text-xs font-bold text-slate-700">Require password change on first login</div>
                <div className="text-[11px] text-slate-400 mt-0.5">The waiter must create a new password when they first sign in.</div>
              </div>
            </label>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: '#E2E8F0' }} />

        {/* Section 3     Employment */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center"><Briefcase className="h-3.5 w-3.5 text-emerald-600" /></div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Employment</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FL>Employment Status</FL>
              <SS value={form.status} onChange={e => set('status', e.target.value)} options={[{ v: 'Active', l: 'Active' }, { v: 'Inactive', l: 'Inactive' }, { v: 'On Leave', l: 'On Leave' }]} />
            </div>
            <div>
              <FL>Shift <span className="text-slate-400 font-normal normal-case">(optional)</span></FL>
              <SS value={form.shift} onChange={e => set('shift', e.target.value)} options={[{ v: '', l: '    Not assigned    ' }, { v: 'Morning', l: 'Morning (6am   2pm)' }, { v: 'Afternoon', l: 'Afternoon (2pm   10pm)' }, { v: 'Evening', l: 'Evening (6pm   2am)' }, { v: 'Night', l: 'Night (10pm   6am)' }]} />
            </div>
            <div className="col-span-2">
              <FL>Notes <span className="text-slate-400 font-normal normal-case">(optional)</span></FL>
              <STA value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any additional notes about this staff member   " />
            </div>
          </div>
        </div>

        {errors.api && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-xs font-medium text-red-700">{errors.api}</p>
          </div>
        )}
        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: '#E2E8F0' }}>
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50" style={{ borderColor: '#E2E8F0' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60" style={{ background: '#2563EB' }}>
            {saving ? 'Creating…' : <><Users className="h-4 w-4 inline mr-1.5" />Add Waiter</>}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/*                                                                                                                   
   STAFF MANAGEMENT PAGE
                                                                                                                   */
const StaffManagementPage = ({ showToast }: { showToast: (m: string) => void }) => {
  const [waiters, setWaiters] = React.useState<Waiter[]>([]);
  const [loadingWaiters, setLoadingWaiters] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [showAdd, setShowAdd] = React.useState(false);

  /* Fetch staff from API with live polling */
  const fetchStaff = React.useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingWaiters(true);
    try {
      const res = await fetch(getApiUrl('/auth/staff?role=WAITER'), { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load staff');
      const data = await res.json();
      const raw: any[] = data.data?.staff ?? data.data ?? [];
      setWaiters(raw.map((u: any, i: number) => {
        const parts = (u.fullName ?? '').split(' ');
        const isOnline = Boolean(u.isOnline || u.onlineStatus === 'Online');
        return {
          id: u.uuid ?? u.userUuid ?? u.id,
          firstName: parts[0] ?? '',
          lastName: parts.slice(1).join(' ') ?? '',
          phone: u.phone ?? '',
          email: u.email ?? '',
          username: u.email?.split('@')[0] ?? `staff-${i + 1}`,
          employeeNo: `EMP-${String(i + 1).padStart(3, '0')}`,
          status: (u.isActive ? 'Active' : 'Inactive') as Waiter['status'],
          shift: '',
          onlineStatus: (isOnline ? 'Online' : 'Offline') as 'Online' | 'Offline',
          lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-KE') : (u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-KE') : 'Never'),
          notes: '',
        };
      }));
    } catch {
      setWaiters([]);
    } finally {
      if (showLoading) setLoadingWaiters(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStaff(true);
    const interval = setInterval(() => {
      fetchStaff(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStaff]);

  const filtered = waiters.filter(w => {
    const matchSearch = `${w.firstName} ${w.lastName} ${w.username} ${w.phone}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || w.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const online = waiters.filter(w => w.onlineStatus === 'Online').length;
  const onLeave = waiters.filter(w => w.status === 'On Leave').length;

  const toggleStatus = async (id: string) => {
    const target = waiters.find(w => w.id === id);
    if (!target) return;
    const nextActive = target.status !== 'Active';
    try {
      const res = await fetch(getApiUrl(`/auth/users/${id}/status`), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setWaiters(prev => prev.map(w => w.id === id ? { ...w, status: nextActive ? 'Active' : 'Inactive' } : w));
      showToast(`${target.firstName}'s account ${nextActive ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      showToast(err.message || 'Error updating account status');
    }
  };

  const deleteWaiter = async (id: string) => {
    const target = waiters.find(w => w.id === id);
    if (!target) return;
    if (!confirm(`Are you sure you want to remove ${target.firstName} ${target.lastName}?`)) return;
    try {
      const res = await fetch(getApiUrl(`/auth/users/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete staff member');
      setWaiters(prev => prev.filter(w => w.id !== id));
      showToast(`${target.firstName} ${target.lastName} removed`);
    } catch (err: any) {
      showToast(err.message || 'Error removing staff member');
    }
  };

  const handleResetPassword = async (waiter: Waiter) => {
    if (!waiter.email) {
      showToast('No email address on file for this waiter');
      return;
    }
    try {
      const res = await fetch(getApiUrl('/auth/request-password-reset'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email: waiter.email }),
      });
      if (res.ok) {
        showToast(`Password reset link sent to ${waiter.email}`);
      } else {
        showToast('Failed to dispatch password reset link');
      }
    } catch {
      showToast('Network error dispatching reset link');
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      {/* Top section: Title, KPIs, Filters */}
      <div className="flex-shrink-0 space-y-4">
        <SectionHeader title="Staff Management" subtitle="Manage waiters for your venue — only managers can create staff" action={
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 transition-opacity" style={{ background: '#2563EB' }}>
            <Plus className="h-3.5 w-3.5" /> Add Waiter
          </button>
        } />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Total Waiters" value={String(waiters.length)} sub="Registered staff" icon={<Users className="h-5 w-5 text-blue-500" />} />
          <KPI label="Online Now" value={String(online)} sub="Currently active" icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} />
          <KPI label="On Leave" value={String(onLeave)} sub="Away from shift" icon={<Clock className="h-5 w-5 text-amber-500" />} />
          <KPI label="Offline" value={String(waiters.length - online)} sub="Not logged in" icon={<UserX className="h-5 w-5 text-slate-400" />} />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-lg border px-3.5 py-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, username or phone…" className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text-primary)' }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            {['All', 'Active', 'Inactive', 'On Leave'].map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => { csvExport(['Name', 'Username', 'Phone', 'Email', 'Status', 'Shift', 'Online', 'Last Login'], filtered.map(w => [`${w.firstName} ${w.lastName}`, w.username, w.phone, w.email, w.status, w.shift, w.onlineStatus, w.lastLogin]), 'staff-export.csv'); showToast('Staff list exported'); }}
            className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-[300px] max-h-[calc(100vh-280px)] rounded-xl border overflow-hidden shadow-sm flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'thin' }}>
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr style={{ background: 'var(--bg-card)' }}>
                {['Waiter', 'Username', 'Phone', 'Status', 'Online', 'Shift', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="sticky top-0 z-20 px-4 py-3 text-left text-xs font-bold border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>No staff members found.</td></tr>
              ) : filtered.map(w => (
                <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors" style={{ background: 'var(--bg-card)' }}>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {w.firstName[0]}{w.lastName[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{w.firstName} {w.lastName}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{w.employeeNo}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>@{w.username}</td>
                  <td className="px-4 py-3.5 text-xs border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>{w.phone}</td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}><StatusBadge status={w.status} /></td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${w.onlineStatus === 'Online' ? 'bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse' : 'bg-slate-300'}`} />
                      <span className={`text-xs ${w.onlineStatus === 'Online' ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                        {w.onlineStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>{w.shift || '—'}</td>
                  <td className="px-4 py-3.5 text-xs border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{w.lastLogin}</td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleResetPassword(w)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Reset Password">
                        <Key className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                      <button onClick={() => toggleStatus(w.id)} className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors" title={w.status === 'Active' ? 'Deactivate' : 'Activate'}>
                        {w.status === 'Active' ? <UserX className="h-3.5 w-3.5 text-amber-500" /> : <UserCheck className="h-3.5 w-3.5 text-emerald-500" />}
                      </button>
                      <button onClick={() => deleteWaiter(w.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Remove">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security note */}
      <div className="flex-shrink-0 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <Shield className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <p className="text-xs text-slate-500">
          Only <strong>Managers</strong> can create and manage waiter accounts. Platform Admins do not have access to staff management.
        </p>
      </div>

      <AddWaiterModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={(w) => { setWaiters(p => [w, ...p]); showToast(`${w.firstName} ${w.lastName} added successfully`); }} />
    </div>
  );
};

/*                                                                                                                   
   ORDERS PAGE
                                                                                                                   */
const OrdersPage = ({ showToast }: { showToast: (m: string) => void }) => {
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [filter, setFilter] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [isLiveActive, setIsLiveActive] = React.useState(false);

  const fetchOrders = React.useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const res = await fetch(getApiUrl('/orders'), { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      const raw: any[] = data.data?.orders ?? data.data ?? [];
      setOrders(raw.map((o: any) => ({
        id: o.orderNumber ?? o.uuid?.slice(0, 8).toUpperCase() ?? '-',
        table: getOrderTableDisplay(o),
        item: (o.items ?? o.orderItems ?? []).map((i: any) => `${i.product?.name ?? i.name} x ${i.quantity}`).join(', ') || '-',
        waiter: o.waiter ? `${(o.waiter.fullName ?? '').split(' ')[0]} ${(o.waiter.fullName ?? '').split(' ').slice(-1)[0]?.charAt(0) ?? ''}.` : 'Unclaimed',
        amount: Number(o.totalAmount ?? 0),
        status: o.status ?? '-',
        time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '-',
      })));
    } catch {
      // Keep existing on error
    } finally {
      if (!isBackground) setRefreshing(false);
    }
  }, []);

  // Initial load on mount
  React.useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  // Real-time Socket.IO Connection + 3-Second Background Auto-refresher
  React.useEffect(() => {
    const clubUuid = getClubUuid();
    let socket: Socket | null = null;

    try {
      socket = io(getSocketUrl(), {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        setIsLiveActive(true);
        if (clubUuid) {
          socket?.emit('join_tenant', clubUuid);
        }
      });

      socket.on('disconnect', () => {
        setIsLiveActive(false);
      });

      // Realtime Order events: status updated, order claimed, new order created
      const handleRealtimeUpdate = () => {
        fetchOrders(true);
      };

      socket.on('new_order', handleRealtimeUpdate);
      socket.on('order_claimed', handleRealtimeUpdate);
      socket.on('order_status_updated', handleRealtimeUpdate);
      socket.on('notification', handleRealtimeUpdate);
    } catch {
      // Fallback to active polling
    }

    // High frequency 3-second background polling to guarantee seamless zero-refresh live updates
    const pollInterval = setInterval(() => {
      fetchOrders(true);
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (socket) socket.disconnect();
    };
  }, [fetchOrders]);

  const doRefresh = async () => { await fetchOrders(false); showToast('Orders refreshed'); };

  const statuses = ['All', 'PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
  const filtered = orders.filter(o => (filter === 'All' || o.status === filter) && (search === '' || o.id.toLowerCase().includes(search.toLowerCase()) || o.table.toLowerCase().includes(search.toLowerCase()) || o.waiter.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      <div className="flex-shrink-0 space-y-4">
        <SectionHeader
          title={
            <div className="flex items-center gap-2.5">
              <span>Live Orders</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Live Sync Active</span>
              </span>
            </div>
          }
          subtitle="Real-time order feed for your venue — auto updates instantly on status changes"
          action={
          <div className="flex items-center gap-2">
            <button onClick={doRefresh} disabled={refreshing} className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button onClick={() => { csvExport(['Order', 'Table', 'Item', 'Waiter', 'Amount (KES)', 'Status', 'Time'], filtered.map(o => [o.id, o.table, o.item, o.waiter, o.amount, o.status, o.time]), 'orders-export.csv'); showToast('Orders exported'); }}
              className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        } />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48 flex items-center gap-2 rounded-lg border px-3.5 py-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, table, waiter…" className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text-primary)' }} />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            {statuses.map(s => {
              const count = s === 'All' ? orders.length : orders.filter(o => (o.status ?? '').toUpperCase() === s).length;
              const isSelected = filter === s;
              const config = s === 'All' ? null : getStatusConfig(s);

              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all border ${
                    isSelected
                      ? (config ? config.activeFilter : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm shadow-blue-500/20')
                      : (config ? `${config.inactiveFilter} border-[var(--border)] bg-[var(--bg-card)]` : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-secondary)] border-[var(--border)] bg-[var(--bg-card)]')
                  }`}
                >
                  {config && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : config.dot}`} />}
                  <span>{s}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[300px] max-h-[calc(100vh-260px)] rounded-xl border overflow-hidden flex flex-col shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr style={{ background: 'var(--bg-card)' }}>
                {['Order ID', 'Table', 'Item', 'Waiter', 'Amount', 'Status', 'Time'].map(h => (
                  <th key={h} className="sticky top-0 z-20 px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-xs text-slate-400">No orders found</td></tr>
            ) : filtered.map(o => (
              <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors" style={{ background: 'var(--bg-card)' }}>
                <td className="px-5 py-3.5 font-mono text-xs font-bold border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>{o.id}</td>
                <td className="px-5 py-3.5 text-xs font-medium border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>{o.table}</td>
                <td className="px-5 py-3.5 text-xs font-medium border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>{o.item}</td>
                <td className="px-5 py-3.5 text-xs border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>{o.waiter}</td>
                <td className="px-5 py-3.5 text-xs font-bold text-emerald-600 border-b" style={{ borderColor: 'var(--border)' }}>KES {o.amount.toLocaleString()}</td>
                <td className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}><StatusBadge status={o.status} /></td>
                <td className="px-5 py-3.5 text-xs font-mono border-b" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{o.time}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* --- MENU PAGE --- */
interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  count: number;
}

interface ManagerOffer {
  id: string;
  title: string;
  description?: string;
  discountValue: number;
  promoCode?: string;
  offerType: string;
  badge?: string;
  imageUrl?: string;
  originalPrice?: number;
  dealPrice?: number;
  productId?: string;
  isActive: boolean;
}

/* Module-level cache — survives re-renders and tab navigation */
let _menuCache: { categories: CategoryItem[]; items: MenuItem[]; offers: ManagerOffer[] } | null = null;

const MenuPage = ({ showToast }: { showToast: (m: string) => void }) => {
  // Seed from cache immediately so the tab appears instant on revisit
  const [items, setItems] = React.useState<MenuItem[]>(_menuCache?.items ?? []);
  const [categories, setCategories] = React.useState<CategoryItem[]>(_menuCache?.categories ?? []);
  const [offers, setOffers] = React.useState<ManagerOffer[]>(_menuCache?.offers ?? []);
  const [selectedCatFilter, setSelectedCatFilter] = React.useState<string>('All');
  
  // Modals
  const [showAdd, setShowAdd] = React.useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = React.useState(false);
  const [showOffersModal, setShowOffersModal] = React.useState(false);
  const [showAddOfferModal, setShowAddOfferModal] = React.useState(false);
  const [showAddCatModal, setShowAddCatModal] = React.useState(false);
  const [showEditCatModal, setShowEditCatModal] = React.useState(false);
  const [showEditItemModal, setShowEditItemModal] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Forms
  const [addForm, setAddForm] = React.useState({ name: '', category: '', price: '', imageUrl: '', description: '' });
  const [newCatForm, setNewCatForm] = React.useState({ name: '', description: '' });
  const [editCatForm, setEditCatForm] = React.useState({ id: '', name: '', description: '' });
  const [editItemForm, setEditItemForm] = React.useState({ id: '', name: '', category: '', price: '', imageUrl: '', description: '' });
  const [offerForm, setOfferForm] = React.useState({
    title: '',
    description: '',
    discountValue: '20',
    promoCode: '',
    offerType: 'PERCENTAGE_DISCOUNT',
    badge: '🔥 TODAY\'S SPECIAL',
    imageUrl: '',
    originalPrice: '',
    dealPrice: '',
    selectedProductId: '',
  });

  const [loading, setLoading] = React.useState(false);
  // True only on first load when there's no cached data yet
  const [fetching, setFetching] = React.useState(_menuCache === null);

  /* ── Offer Image Upload & Compression ── */
  const handleOfferImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setOfferForm(p => ({ ...p, imageUrl: compressedDataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  /* ── Image Upload & Canvas Compression ── */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image file size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          if (isEdit) {
            setEditItemForm(p => ({ ...p, imageUrl: compressedDataUrl }));
          } else {
            setAddForm(p => ({ ...p, imageUrl: compressedDataUrl }));
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const fetchMenu = React.useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/menu'), { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const rawCats: any[] = (data.data ?? data).categories ?? [];
      const rawOffers: any[] = (data.data ?? data).offers ?? [];
      
      const parsedCats: CategoryItem[] = rawCats.map((cat: any) => ({
        id: cat.categoryUuid ?? cat.uuid ?? cat.id,
        name: cat.name,
        description: cat.description,
        count: (cat.products ?? []).length,
      }));
      setCategories(parsedCats);

      const parsedOffers: ManagerOffer[] = rawOffers.map((o: any) => {
        let cleanDesc = o.description;
        let img = undefined;
        let badgeText = undefined;
        let origPrice = undefined;
        let dPrice = undefined;
        let prodId = undefined;

        if (o.description && typeof o.description === 'string' && o.description.startsWith('{') && o.description.endsWith('}')) {
          try {
            const parsed = JSON.parse(o.description);
            cleanDesc = parsed.desc ?? '';
            img = parsed.imageUrl;
            badgeText = parsed.badge;
            origPrice = parsed.originalPrice ? Number(parsed.originalPrice) : undefined;
            dPrice = parsed.dealPrice ? Number(parsed.dealPrice) : undefined;
            prodId = parsed.productId;
          } catch {}
        }

        return {
          id: o.offerUuid ?? o.uuid ?? o.id,
          title: o.title,
          description: cleanDesc,
          discountValue: Number(o.discountValue ?? 0),
          promoCode: o.promoCode,
          offerType: o.offerType ?? 'PERCENTAGE_DISCOUNT',
          badge: badgeText,
          imageUrl: img,
          originalPrice: origPrice,
          dealPrice: dPrice,
          productId: prodId,
          isActive: o.isActive !== false,
        };
      });
      setOffers(parsedOffers);

      setAddForm(p => ({
        ...p,
        category: p.category || parsedCats[0]?.name || '',
      }));

      const flat: MenuItem[] = [];
      rawCats.forEach((cat: any) => {
        (cat.products ?? []).forEach((p: any) => {
          flat.push({
            id: p.productUuid ?? p.uuid ?? p.id,
            name: p.name,
            category: cat.name,
            price: Number(p.price),
            status: p.isAvailable !== false ? 'Available' : 'Out of Stock',
            imageUrl: p.imageUrl ?? null,
            description: p.description ?? null,
          });
        });
      });
      setItems(flat);

      // Populate module-level cache for instant revisits
      _menuCache = { categories: parsedCats, items: flat, offers: parsedOffers };
    } catch { /* keep previous state on error */ }
    finally {
      setFetching(false);
    }
  }, []);

  const handleCreateOffer = async () => {
    if (!offerForm.title.trim() || !offerForm.discountValue) {
      showToast('Offer title and discount value are required');
      return;
    }
    setLoading(true);
    try {
      const richDesc = JSON.stringify({
        desc: offerForm.description.trim(),
        imageUrl: offerForm.imageUrl || undefined,
        badge: offerForm.badge || '🔥 TODAY\'S SPECIAL',
        originalPrice: offerForm.originalPrice ? Number(offerForm.originalPrice) : undefined,
        dealPrice: offerForm.dealPrice ? Number(offerForm.dealPrice) : undefined,
        productId: offerForm.selectedProductId || undefined,
      });

      const res = await fetch(getApiUrl('/menu/offers'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: offerForm.title.trim(),
          description: richDesc,
          offerType: offerForm.offerType,
          discountValue: Number(offerForm.discountValue),
          promoCode: offerForm.promoCode.trim().toUpperCase() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to create offer');
      showToast(`Special offer "${offerForm.title}" published!`);
      setOfferForm({
        title: '',
        description: '',
        discountValue: '20',
        promoCode: '',
        offerType: 'PERCENTAGE_DISCOUNT',
        badge: '🔥 TODAY\'S SPECIAL',
        imageUrl: '',
        originalPrice: '',
        dealPrice: '',
        selectedProductId: '',
      });
      setShowAddOfferModal(false);
      fetchMenu();
    } catch (err: any) {
      showToast(err.message || 'Error creating offer');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOffer = async (id: string, currentActive: boolean) => {
    try {
      const nextActive = !currentActive;
      setOffers(prev => prev.map(o => o.id === id ? { ...o, isActive: nextActive } : o));
      await fetch(getApiUrl(`/menu/offers/${id}/toggle`), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: nextActive }),
      });
      showToast(`Offer ${nextActive ? 'activated' : 'paused'}`);
    } catch {
      showToast('Failed to update offer status');
      fetchMenu();
    }
  };

  const handleDeleteOffer = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete offer "${title}"?`)) return;
    try {
      setOffers(prev => prev.filter(o => o.id !== id));
      await fetch(getApiUrl(`/menu/offers/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      showToast(`Offer "${title}" deleted`);
    } catch {
      showToast('Failed to delete offer');
      fetchMenu();
    }
  };

  React.useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const toggle = (id: string) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const next = i.status === 'Available' ? 'Out of Stock' : 'Available';
      fetch(getApiUrl(`/menu/products/${id}/availability`), { method: 'PATCH', headers: authHeaders() }).catch(() => {});
      showToast(`${i.name} marked as ${next}`);
      return { ...i, status: next };
    }));
  };

  const del = async (id: string) => {
    const item = items.find(i => i.id === id);
    setItems(p => p.filter(i => i.id !== id));
    try {
      await fetch(getApiUrl(`/menu/products/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (item) showToast(`${item.name} removed from menu`);
    } catch {
      if (item) showToast(`Removed ${item.name}`);
    }
  };

  const handleAddItem = async () => {
    if (!addForm.name.trim() || !addForm.price) return;
    const categoryToUse = addForm.category.trim() || categories[0]?.name;
    if (!categoryToUse) {
      showToast('Please create or select a category for this business first');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/menu/products'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: addForm.name.trim(),
          categoryName: categoryToUse,
          price: Number(addForm.price),
          imageUrl: addForm.imageUrl || undefined,
          description: addForm.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to add menu item');
      showToast(`${addForm.name} added to menu`);
      setShowAdd(false);
      setAddForm({ name: '', category: categoryToUse, price: '', imageUrl: '', description: '' });
      fetchMenu();
    } catch (err: any) {
      showToast(err.message || 'Error adding menu item');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (nameOverride?: string) => {
    const catName = (nameOverride || newCatForm.name).trim();
    if (!catName) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/menu/categories'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: catName,
          description: nameOverride ? undefined : (newCatForm.description.trim() || undefined),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to create category');
      showToast(`Category "${catName}" created successfully`);
      setNewCatForm({ name: '', description: '' });
      setShowAddCatModal(false);
      setAddForm(p => ({ ...p, category: catName }));
      fetchMenu();
    } catch (err: any) {
      showToast(err.message || 'Error creating category');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editCatForm.id || !editCatForm.name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/menu/categories/${editCatForm.id}`), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: editCatForm.name.trim(),
          description: editCatForm.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to update category');
      showToast(`Category renamed to "${editCatForm.name}"`);
      setShowEditCatModal(false);
      fetchMenu();
    } catch (err: any) {
      showToast(err.message || 'Error updating category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;
    try {
      const res = await fetch(getApiUrl(`/menu/categories/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Failed to delete category');
      }
      showToast(`Category "${name}" deleted`);
      fetchMenu();
    } catch (err: any) {
      showToast(err.message || 'Error deleting category');
    }
  };

  const handleUpdateItem = async () => {
    if (!editItemForm.id || !editItemForm.name.trim() || !editItemForm.price) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/menu/products/${editItemForm.id}`), {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: editItemForm.name.trim(),
          price: Number(editItemForm.price),
          imageUrl: editItemForm.imageUrl || null,
          description: editItemForm.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to update menu item');
      showToast(`Item "${editItemForm.name}" updated`);
      setShowEditItemModal(false);
      fetchMenu();
    } catch (err: any) {
      showToast(err.message || 'Error updating item');
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = React.useMemo(() => {
    if (categories.length > 0) {
      return [
        { v: '', l: 'Select a category...' },
        ...categories.map(c => ({ v: c.name, l: c.name }))
      ];
    }
    return [{ v: '', l: 'No categories yet — click + New Category' }];
  }, [categories]);

  const filteredItems = React.useMemo(() => {
    let list = items;
    if (selectedCatFilter !== 'All') {
      list = list.filter(i => i.category.toLowerCase() === selectedCatFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, selectedCatFilter, searchQuery]);

  if (fetching) {
    return (
      <div className="space-y-5 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-44 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-72 rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-36 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-8 w-24 rounded-lg bg-blue-200 dark:bg-blue-900" />
          </div>
        </div>
        {/* Pills skeleton */}
        <div className="flex gap-2">
          {[80, 70, 90, 75, 85].map((w, i) => (
            <div key={i} className="h-7 rounded-full bg-slate-200 dark:bg-slate-700" style={{ width: w }} />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="h-10 bg-slate-100 dark:bg-slate-800" />
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="flex items-center gap-4 px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-2.5 w-56 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="h-5 w-20 rounded-md bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="h-6 w-6 rounded-lg bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      <div className="flex-shrink-0 space-y-4">
      <SectionHeader title="Menu Management" subtitle="Manage your venue's categories, food, drink items, and daily offers in real-time" action={
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowOffersModal(true)}
            className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-all hover:bg-amber-500/10 hover:border-amber-400 text-amber-600 dark:text-amber-400"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Deals & Offers ({offers.filter(o => o.isActive).length})
          </button>
          <button onClick={() => setShowCategoriesModal(true)} className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors hover:bg-slate-50" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}>
            <Layers className="h-3.5 w-3.5 text-blue-600" /> Manage Categories ({categories.length})
          </button>
          <button onClick={() => { setAddForm({ name: '', category: categories[0]?.name || '', price: '', imageUrl: '', description: '' }); setShowAdd(true); }} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity" style={{ background: '#2563EB' }}>
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        </div>
      } />

      {/* ── Deals & Daily Offers Preview Strip ── */}
      {offers.length > 0 && (
        <div className="rounded-2xl border p-4 transition-all" style={{ background: 'var(--bg-card)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Flame className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Active Customer Deals of the Day ({offers.filter(o => o.isActive).length})
              </span>
            </div>
            <button
              onClick={() => setShowOffersModal(true)}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              Manage Deals <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {offers.slice(0, 3).map(offer => (
              <div
                key={offer.id}
                className="flex items-center justify-between p-3 rounded-xl border transition-all"
                style={{
                  background: offer.isActive ? 'rgba(245,158,11,0.06)' : 'var(--bg-body)',
                  borderColor: offer.isActive ? 'rgba(245,158,11,0.25)' : 'var(--border)',
                  opacity: offer.isActive ? 1 : 0.6,
                }}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{offer.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {offer.offerType === 'BUY_ONE_GET_ONE' ? 'Buy 1 Get 1' : `${offer.discountValue}% Discount`}
                    {offer.promoCode ? ` · Code: ${offer.promoCode}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleOffer(offer.id, offer.isActive)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                    offer.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  {offer.isActive ? 'Active' : 'Paused'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar Row */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Category Pills Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
          <button
            onClick={() => setSelectedCatFilter('All')}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-all flex-shrink-0 ${selectedCatFilter === 'All' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'hover:bg-slate-100'}`}
            style={selectedCatFilter === 'All' ? {} : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
          >
            <span>All Items</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCatFilter === 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{items.length}</span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatFilter(cat.name)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0 ${selectedCatFilter === cat.name ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'hover:bg-slate-100'}`}
              style={selectedCatFilter === cat.name ? {} : { borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}
            >
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCatFilter === cat.name ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{cat.count}</span>
            </button>
          ))}
          <button
            onClick={() => { setNewCatForm({ name: '', description: '' }); setShowAddCatModal(true); }}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-blue-600 border border-dashed border-blue-300 hover:bg-blue-50 transition-colors whitespace-nowrap flex-shrink-0 ml-1"
          >
            <Plus className="h-3 w-3" /> Add Category
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-72 flex-shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, drinks, food..."
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium border outline-none transition-all focus:ring-2 focus:ring-blue-500 shadow-sm"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Menu Items Scrollable Table */}
      <div className="flex-1 min-h-[300px] max-h-[calc(100vh-280px)] rounded-xl border overflow-hidden shadow-sm flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'thin' }}>
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr style={{ background: 'var(--bg-card)' }}>
                {['Item', 'Category', 'Price', 'Status', 'Actions'].map(h => (
                  <th key={h} className="sticky top-0 z-20 px-5 py-3 text-left text-xs font-bold whitespace-nowrap border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    {searchQuery ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">No items match "{searchQuery}"</p>
                        <p className="text-xs text-slate-400">Try checking for typos or clear search.</p>
                      </div>
                    ) : (
                      `No items found in ${selectedCatFilter === 'All' ? 'this venue' : `"${selectedCatFilter}"`}. Click "+ Add Item" to add drinks or food with photos.`
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors" style={{ background: 'var(--bg-card)' }}>
                    <td className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-sm" />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-base flex-shrink-0 text-slate-400">
                            🍸
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                          {item.description && <div className="text-[11px] line-clamp-1" style={{ color: 'var(--text-muted)' }}>{item.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>
                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Tag className="h-2.5 w-2.5 text-slate-500" /> {item.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>KES {item.price.toLocaleString()}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>
                      <button onClick={() => toggle(item.id)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-all ${item.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 hover:bg-emerald-100' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 hover:bg-red-100'}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${item.status === 'Available' ? 'bg-emerald-500' : 'bg-red-500'}`} />{item.status}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap border-b" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setEditItemForm({ id: item.id, name: item.name, category: item.category, price: String(item.price), imageUrl: item.imageUrl || '', description: item.description || '' }); setShowEditItemModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit Item">
                          <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors" title="Delete Item"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Manage Categories ── */}
      <Modal open={showCategoriesModal} onClose={() => setShowCategoriesModal(false)} title="Manage Menu Categories" size="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs text-slate-500">Edit or reorganize categories that appear when building menus.</p>
            <button
              onClick={() => { setNewCatForm({ name: '', description: '' }); setShowAddCatModal(true); }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background: '#2563EB' }}
            >
              <Plus className="h-3 w-3" /> New Category
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {categories.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Layers className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No categories created yet for this business.</p>
                <p className="text-[11px] text-slate-400">Every business creates its own unique menu categories. Click "+ New Category" to add one.</p>
              </div>
            ) : (
              categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-50/50 hover:bg-slate-100/50 transition-colors" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {cat.name}
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">{cat.count} items</span>
                    </h4>
                    {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditCatForm({ id: cat.id, name: cat.name, description: cat.description || '' }); setShowEditCatModal(true); }}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Edit / Rename Category"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button onClick={() => setShowCategoriesModal(false)} className="rounded-xl border px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors" style={{ borderColor: '#E2E8F0' }}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Add Category ── */}
      <Modal open={showAddCatModal} onClose={() => setShowAddCatModal(false)} title="Create New Category" size="sm" zIndex="z-[60]">
        <div className="space-y-4">
          <div><FL required>Category Name</FL><SI value={newCatForm.name} onChange={e => setNewCatForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Starters, Main Dishes, Hot Beverages, Desserts" /></div>
          <div><FL>Description (Optional)</FL><SI value={newCatForm.description} onChange={e => setNewCatForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Fresh house specialties and signature dishes" /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowAddCatModal(false)} className="flex-1 rounded-xl border py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors" style={{ borderColor: '#E2E8F0' }}>Cancel</button>
            <button disabled={loading || !newCatForm.name.trim()} onClick={() => handleCreateCategory()} className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ background: '#2563EB' }}>
              {loading ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Edit Category ── */}
      <Modal open={showEditCatModal} onClose={() => setShowEditCatModal(false)} title="Edit Category" size="sm" zIndex="z-[60]">
        <div className="space-y-4">
          <div><FL required>Category Name</FL><SI value={editCatForm.name} onChange={e => setEditCatForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Starters, Main Course, Beverages" /></div>
          <div><FL>Description (Optional)</FL><SI value={editCatForm.description} onChange={e => setEditCatForm(p => ({ ...p, description: e.target.value }))} placeholder="Short category description" /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowEditCatModal(false)} className="flex-1 rounded-xl border py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors" style={{ borderColor: '#E2E8F0' }}>Cancel</button>
            <button disabled={loading || !editCatForm.name.trim()} onClick={handleUpdateCategory} className="flex-1 rounded-xl py-2.5 text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50" style={{ background: '#2563EB' }}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Add Menu Item ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Menu Item">
        <div className="space-y-4">
          {/* Item Photo Upload */}
          <div>
            <FL>Item Photo (Optional)</FL>
            {addForm.imageUrl ? (
              <div className="relative rounded-xl border p-2.5 flex items-center gap-3 bg-slate-50" style={{ borderColor: '#CBD5E1' }}>
                <img src={addForm.imageUrl} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">Photo selected</p>
                  <p className="text-[11px] text-slate-400">Ready to save with menu item</p>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="cursor-pointer text-xs font-bold text-blue-600 hover:underline">
                      Change Photo
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, false)} />
                    </label>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => setAddForm(p => ({ ...p, imageUrl: '' }))} className="text-xs font-bold text-red-500 hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all text-center">
                <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Click or tap to upload item photo</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 10MB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, false)} />
              </label>
            )}
          </div>

          <div><FL required>Item Name</FL><SI value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Whisky Sour, Grilled Ribeye" /></div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <FL required>Category</FL>
              <button
                type="button"
                onClick={() => { setNewCatForm({ name: '', description: '' }); setShowAddCatModal(true); }}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> New Category
              </button>
            </div>
            {categories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-700/60 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">No categories created yet</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      Categories are unique to every business. Create your first category before adding items.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setNewCatForm({ name: '', description: '' }); setShowAddCatModal(true); }}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Category
                </button>
              </div>
            ) : (
              <SS value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))} options={categoryOptions} />
            )}
          </div>

          <div><FL required>Price (KES)</FL><SI type="number" value={addForm.price} onChange={e => setAddForm(p => ({ ...p, price: e.target.value }))} placeholder="0" min="0" /></div>
          
          <div><FL>Description (Optional)</FL><SI value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Craft bourbon, fresh lemon juice, sugar & egg white" /></div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowAdd(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors" style={{ borderColor: '#E2E8F0' }}>Cancel</button>
            <button disabled={loading} onClick={handleAddItem} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: '#2563EB' }}>
              {loading ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Edit Menu Item ── */}
      <Modal open={showEditItemModal} onClose={() => setShowEditItemModal(false)} title="Edit Menu Item">
        <div className="space-y-4">
          {/* Item Photo Upload */}
          <div>
            <FL>Item Photo (Optional)</FL>
            {editItemForm.imageUrl ? (
              <div className="relative rounded-xl border p-2.5 flex items-center gap-3 bg-slate-50" style={{ borderColor: '#CBD5E1' }}>
                <img src={editItemForm.imageUrl} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">Item photo</p>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="cursor-pointer text-xs font-bold text-blue-600 hover:underline">
                      Replace Photo
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, true)} />
                    </label>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => setEditItemForm(p => ({ ...p, imageUrl: '' }))} className="text-xs font-bold text-red-500 hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all text-center">
                <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Click or tap to upload photo</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 10MB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, true)} />
              </label>
            )}
          </div>

          <div><FL required>Item Name</FL><SI value={editItemForm.name} onChange={e => setEditItemForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Whisky Sour" /></div>
          <div>
            <FL>Category</FL>
            <SI value={editItemForm.category} disabled placeholder="Category" />
          </div>
          <div><FL required>Price (KES)</FL><SI type="number" value={editItemForm.price} onChange={e => setEditItemForm(p => ({ ...p, price: e.target.value }))} placeholder="0" min="0" /></div>
          <div><FL>Description (Optional)</FL><SI value={editItemForm.description} onChange={e => setEditItemForm(p => ({ ...p, description: e.target.value }))} placeholder="Short item description" /></div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowEditItemModal(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors" style={{ borderColor: '#E2E8F0' }}>Cancel</button>
            <button disabled={loading} onClick={handleUpdateItem} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity" style={{ background: '#2563EB' }}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Manage Daily Deals & Offers ── */}
      <Modal open={showOffersModal} onClose={() => setShowOffersModal(false)} title="Manage Special Deals & Offers of the Day" size="lg">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs text-slate-500">
              Create and toggle daily promotional banners that appear directly on your customers' mobile menu.
            </p>
            <button
              onClick={() => {
                setOfferForm({
                  title: '',
                  description: '',
                  discountValue: '20',
                  promoCode: '',
                  offerType: 'PERCENTAGE_DISCOUNT',
                  badge: '🔥 TODAY\'S SPECIAL',
                  imageUrl: '',
                  originalPrice: '',
                  dealPrice: '',
                  selectedProductId: '',
                });
                setShowAddOfferModal(true);
              }}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ background: '#F59E0B' }}
            >
              <Plus className="h-3.5 w-3.5" /> New Deal
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {offers.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Sparkles className="h-8 w-8 text-amber-400 mx-auto opacity-40" />
                <p className="text-xs text-slate-400">No active deals or offers yet.</p>
                <button
                  onClick={() => setShowAddOfferModal(true)}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Create your first Special Deal or Daily Offer →
                </button>
              </div>
            ) : (
              offers.map(offer => (
                <div
                  key={offer.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border bg-slate-50/50 dark:bg-slate-900/50 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        {offer.offerType === 'BUY_ONE_GET_ONE' ? '🎁 BUY 1 GET 1' : `${offer.discountValue}% OFF`}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {offer.title}
                      </h4>
                      {offer.promoCode && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {offer.promoCode}
                        </span>
                      )}
                    </div>
                    {offer.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{offer.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleOffer(offer.id, offer.isActive)}
                      className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
                        offer.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      {offer.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button
                      onClick={() => handleDeleteOffer(offer.id, offer.title)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 transition-colors"
                      title="Delete Offer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button onClick={() => setShowOffersModal(false)} className="rounded-xl border px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors" style={{ borderColor: '#E2E8F0' }}>
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Create Special Deal / Offer of the Day ── */}
      <Modal open={showAddOfferModal} onClose={() => setShowAddOfferModal(false)} title="Create Special Deal of the Day" size="lg">
        <div className="space-y-4">
          {/* Quick presets */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quick Presets (For Any Business)</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: '🎁 Buy 1 Get 1 Free', title: 'Buy 1 Get 1 Free Special', type: 'BUY_ONE_GET_ONE', val: '1', code: 'BOGO', badge: '🎁 BUY 1 GET 1', desc: 'Order any qualifying item and get an extra one on the house!' },
                { label: '🔥 20% Off Featured', title: '20% Off Today\'s Featured Specials', type: 'PERCENTAGE_DISCOUNT', val: '20', code: 'SAVE20', badge: '🔥 20% OFF', desc: 'Enjoy a 20% discount on selected menu specials.' },
                { label: '⚡ KES 300 Off Combo', title: 'Combo Deal: KES 300 Off Order', type: 'FIXED_AMOUNT_DISCOUNT', val: '300', code: 'DEAL300', badge: '⚡ FLASH DEAL', desc: 'Save KES 300 on meals and combo orders.' },
                { label: '✨ 15% House Pick', title: 'House Special: 15% Off Favorites', type: 'PERCENTAGE_DISCOUNT', val: '15', code: 'HOUSE15', badge: '✨ HOUSE SPECIAL', desc: 'Handcrafted favorites at a special 15% promotional discount.' },
                { label: '🎉 Happy Hour 25%', title: 'Happy Hour: 25% Off Refreshments & Bites', type: 'PERCENTAGE_DISCOUNT', val: '25', code: 'HAPPY25', badge: '🎉 HAPPY HOUR', desc: 'Special discount during promotional hours.' },
              ].map(preset => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => setOfferForm(p => ({
                    ...p,
                    title: preset.title,
                    description: preset.desc,
                    offerType: preset.type,
                    discountValue: preset.val,
                    promoCode: preset.code,
                    badge: preset.badge,
                  }))}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Link to Existing Menu Item (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <FL>Auto-fill from Menu Item (Optional)</FL>
              <span className="text-[10px] text-slate-400">Pulls item photo & original price</span>
            </div>
            <select
              value={offerForm.selectedProductId}
              onChange={e => {
                const pId = e.target.value;
                const found = items.find(it => it.id === pId);
                if (found) {
                  const isFixed = offerForm.offerType === 'FIXED_AMOUNT_DISCOUNT';
                  const disc = Number(offerForm.discountValue || 0);
                  const calculatedDeal = isFixed ? Math.max(0, found.price - disc) : Math.round(found.price * (1 - disc / 100));
                  setOfferForm(p => ({
                    ...p,
                    selectedProductId: pId,
                    title: `${found.name} Deal`,
                    imageUrl: found.imageUrl || p.imageUrl,
                    originalPrice: String(found.price),
                    dealPrice: String(calculatedDeal),
                  }));
                } else {
                  setOfferForm(p => ({ ...p, selectedProductId: '' }));
                }
              }}
              className="w-full rounded-xl border px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Choose an item to link photo & price --</option>
              {items.map(it => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.category}) — KES {it.price.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {/* Deal Photo Upload / Preview */}
          <div>
            <FL>Featured Offer Photo</FL>
            {offerForm.imageUrl ? (
              <div className="relative rounded-xl border p-2.5 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50" style={{ borderColor: 'var(--border)' }}>
                <img src={offerForm.imageUrl} alt="Preview" className="h-16 w-16 rounded-xl object-cover border border-amber-500/30 flex-shrink-0 shadow-md" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">Special Deal Photo Set</p>
                  <p className="text-[11px] text-slate-400">Will be featured on the customer's moving banner</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <label className="cursor-pointer text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">
                      Change Photo
                      <input type="file" accept="image/*" className="hidden" onChange={handleOfferImageUpload} />
                    </label>
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => setOfferForm(p => ({ ...p, imageUrl: '' }))} className="text-xs font-bold text-red-500 hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-400/50 p-4 cursor-pointer hover:border-amber-500 hover:bg-amber-50/20 transition-all text-center">
                <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Upload high-res item photo</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 10MB</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleOfferImageUpload} />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <FL required>Deal / Offer Title</FL>
              <SI
                value={offerForm.title}
                onChange={e => setOfferForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. 20% Off Main Meals, Buy 1 Get 1 Coffee, Weekend Special"
              />
            </div>
            <div>
              <FL>Glowing Badge / Tag</FL>
              <SS
                value={offerForm.badge}
                onChange={e => setOfferForm(p => ({ ...p, badge: e.target.value }))}
                options={[
                  { v: '🔥 TODAY\'S SPECIAL', l: '🔥 TODAY\'S SPECIAL' },
                  { v: '⚡ FLASH DEAL', l: '⚡ FLASH DEAL' },
                  { v: '🎁 BUY 1 GET 1', l: '🎁 BUY 1 GET 1' },
                  { v: '✨ HOUSE SPECIAL', l: '✨ HOUSE SPECIAL' },
                  { v: '👨‍🍳 CHEF\'S PICK', l: '👨‍🍳 CHEF\'S PICK' },
                  { v: '🎉 LIMITED TIME OFFER', l: '🎉 LIMITED TIME OFFER' },
                  { v: '💰 SPECIAL DISCOUNT', l: '💰 SPECIAL DISCOUNT' },
                  { v: '☕ MORNING SPECIAL', l: '☕ MORNING SPECIAL' },
                  { v: '🍽️ COMBO SPECIAL', l: '🍽️ COMBO SPECIAL' },
                  { v: '🌟 VIP DEAL', l: '🌟 VIP DEAL' },
                  { v: '🍹 HAPPY HOUR', l: '🍹 HAPPY HOUR' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FL required>Offer Type</FL>
              <SS
                value={offerForm.offerType}
                onChange={e => setOfferForm(p => ({ ...p, offerType: e.target.value }))}
                options={[
                  { v: 'PERCENTAGE_DISCOUNT', l: 'Percentage Discount (%)' },
                  { v: 'FIXED_AMOUNT_DISCOUNT', l: 'Fixed Amount (KES)' },
                  { v: 'BUY_ONE_GET_ONE', l: 'Buy 1 Get 1 Free' },
                ]}
              />
            </div>
            <div>
              <FL required>{offerForm.offerType === 'PERCENTAGE_DISCOUNT' ? 'Discount Percentage (%)' : offerForm.offerType === 'FIXED_AMOUNT_DISCOUNT' ? 'Discount Amount (KES)' : 'Bonus Quantity'}</FL>
              <SI
                type="number"
                value={offerForm.discountValue}
                onChange={e => setOfferForm(p => ({ ...p, discountValue: e.target.value }))}
                placeholder={offerForm.offerType === 'PERCENTAGE_DISCOUNT' ? '20' : '500'}
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <FL>Promo Code (Optional)</FL>
              <SI
                value={offerForm.promoCode}
                onChange={e => setOfferForm(p => ({ ...p, promoCode: e.target.value.toUpperCase() }))}
                placeholder="e.g. SAVE20, SPECIAL15, DEAL300"
              />
            </div>
            <div>
              <FL>Original Price in KES (Optional)</FL>
              <SI
                type="number"
                value={offerForm.originalPrice}
                onChange={e => setOfferForm(p => ({ ...p, originalPrice: e.target.value }))}
                placeholder="e.g. 1500"
              />
            </div>
          </div>

          <div>
            <FL>Description & Terms (Optional)</FL>
            <SI
              value={offerForm.description}
              onChange={e => setOfferForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Valid today on all qualifying items while stocks last."
            />
          </div>

          {/* Futuristic Live Preview Card */}
          <div className="p-3.5 rounded-2xl border bg-slate-950 text-white space-y-2 relative overflow-hidden" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Live Customer Banner Preview
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500 text-white uppercase tracking-wider">
                  {offerForm.badge || '🔥 TODAY\'S SPECIAL'}
                </span>
                <p className="text-xs font-black truncate">{offerForm.title || 'Deal Title Preview'}</p>
                <p className="text-[11px] text-slate-300 truncate">{offerForm.description || 'Special limited-time deal for our guests.'}</p>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs font-black text-amber-400">
                    {offerForm.offerType === 'BUY_ONE_GET_ONE' ? 'Buy 1 Get 1' : `${offerForm.discountValue || '20'}% OFF`}
                  </span>
                  {offerForm.promoCode && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      {offerForm.promoCode}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-amber-500/40 bg-slate-900 flex-shrink-0 flex items-center justify-center">
                {offerForm.imageUrl ? (
                  <img src={offerForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">✨</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddOfferModal(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors" style={{ borderColor: '#E2E8F0' }}>Cancel</button>
            <button
              disabled={loading || !offerForm.title.trim() || !offerForm.discountValue}
              onClick={handleCreateOffer}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ background: '#F59E0B' }}
            >
              {loading ? 'Publishing...' : 'Publish Special Deal'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/*                                                                                                                   
   DASHBOARD PAGE
                                                                                                                   */
const DashboardPage = ({ showToast }: { showToast: (m: string) => void }) => {
  const [refreshing, setRefreshing] = React.useState(false);
  const [kpis, setKpis] = React.useState({
    revenue: 'KES 0',
    orders: '0',
    waiters: '0',
    avgOrder: 'KES 0',
    completedCount: 0,
  });
  const [revChart, setRevChart] = React.useState<{ day: string; rev: number }[]>([]);
  const [hourChart, setHourChart] = React.useState<{ h: number; n: number }[]>([]);

  const fetchDashboard = React.useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const [analyticsRes, ordersRes] = await Promise.all([
        fetch(getApiUrl('/reports/analytics?period=WEEKLY'), { headers: authHeaders() }),
        fetch(getApiUrl('/orders'), { headers: authHeaders() }),
      ]);

      let reportData: any = null;
      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        reportData = d.data?.report ?? d.data ?? {};
      }

      if (ordersRes.ok) {
        const od = await ordersRes.json();
        const raw: any[] = od.data?.orders ?? od.data ?? [];

        // 1. Calculate Real KPIs
        const paidOrCompletedOrders = raw.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED' || o.paymentStatus === 'PAID');
        const totalRev = paidOrCompletedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) || Number(reportData?.kpis?.totalRevenue || 0);
        const completedCount = paidOrCompletedOrders.length;
        const avgVal = completedCount > 0 ? Math.round(totalRev / completedCount) : (reportData?.kpis?.averageOrderValue || 0);
        const activeWaitersSet = new Set(raw.map(o => o.waiterUuid || o.waiterId || o.waiter?.userUuid).filter(Boolean));

        setKpis({
          revenue: `KES ${totalRev.toLocaleString()}`,
          orders: String(raw.length || reportData?.kpis?.totalOrders || 0),
          waiters: String(activeWaitersSet.size > 0 ? activeWaitersSet.size : (reportData?.kpis?.activeWaitersCount ?? 0)),
          avgOrder: `KES ${avgVal.toLocaleString()}`,
          completedCount,
        });

        // 2. Calculate Weekly Revenue (Mon-Sun)
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayRevMap: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

        paidOrCompletedOrders.forEach((o: any) => {
          if (o.createdAt) {
            const day = dayNames[new Date(o.createdAt).getDay()];
            if (dayRevMap[day] !== undefined) {
              dayRevMap[day] += Number(o.totalAmount || 0);
            }
          }
        });

        // Use report dailyRevenue if populated, or fallback to real calculated dayRevMap
        if (reportData?.dailyRevenue?.some((d: any) => Number(d.revenue || d.rev || 0) > 0)) {
          setRevChart(reportData.dailyRevenue.map((d: any) => ({
            day: d.day ?? d.date,
            rev: Number(d.revenue ?? d.rev ?? 0),
          })));
        } else {
          setRevChart(daysOrder.map(day => ({
            day,
            rev: dayRevMap[day] || 0,
          })));
        }

        // 3. Calculate Hourly Orders (00:00 - 23:00)
        const hourMap: Record<number, number> = {};
        for (let i = 0; i < 24; i++) hourMap[i] = 0;

        raw.forEach((o: any) => {
          if (o.createdAt) {
            const h = new Date(o.createdAt).getHours();
            hourMap[h] = (hourMap[h] || 0) + 1;
          }
        });

        if (reportData?.hourlyOrders?.some((h: any) => Number(h.count || h.n || 0) > 0)) {
          setHourChart(reportData.hourlyOrders.map((h: any) => ({
            h: Number(h.hour ?? h.h),
            n: Number(h.count ?? h.n ?? 0),
          })));
        } else {
          setHourChart(Object.keys(hourMap).map(h => ({
            h: Number(h),
            n: hourMap[Number(h)] || 0,
          })));
        }

      }
    } catch {
      /* keep current state on error */
    } finally {
      if (!isBackground) setRefreshing(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  // Real-time Socket.IO Connection + 3-Second Background Auto-refresher
  React.useEffect(() => {
    const clubUuid = getClubUuid();
    let socket: Socket | null = null;

    try {
      socket = io(getSocketUrl(), {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        if (clubUuid) {
          socket?.emit('join_tenant', clubUuid);
        }
      });

      const handleRealtimeUpdate = () => {
        fetchDashboard(true);
      };

      socket.on('new_order', handleRealtimeUpdate);
      socket.on('order_claimed', handleRealtimeUpdate);
      socket.on('order_status_updated', handleRealtimeUpdate);
      socket.on('notification', handleRealtimeUpdate);
    } catch {}

    const pollInterval = setInterval(() => {
      fetchDashboard(true);
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (socket) socket.disconnect();
    };
  }, [fetchDashboard]);

  const doRefresh = async () => {
    await fetchDashboard(false);
    showToast('Dashboard refreshed');
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Club Overview"
        subtitle="Live dashboard"
        action={
          <button
            onClick={doRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI
          label="Revenue (Period)"
          value={kpis.revenue}
          sub={`From ${kpis.completedCount} completed order${kpis.completedCount === 1 ? '' : 's'}`}
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
        />
        <KPI
          label="Total Orders"
          value={kpis.orders}
          sub="All active & past orders"
          icon={<ClipboardList className="h-5 w-5 text-blue-500" />}
        />
        <KPI
          label="Active Waiters"
          value={kpis.waiters}
          sub="Staff taking orders"
          icon={<Users className="h-5 w-5 text-purple-500" />}
        />
        <KPI
          label="Avg Order Value"
          value={kpis.avgOrder}
          sub="Per completed order"
          icon={<ArrowUpRight className="h-5 w-5 text-amber-500" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Revenue Area Chart */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Weekly Revenue (KES)</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Revenue breakdown for the current week</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revChart}>
              <defs>
                <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                domain={[0, (dataMax: number) => Math.max(1000, dataMax > 0 ? Math.ceil(dataMax * 1.15) : 1000)]}
                tickFormatter={(v: number) => (v === 0 ? '0' : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-primary)' }}
                formatter={(v: any) => [`KES ${Number(v || 0).toLocaleString()}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="rev" stroke="#2563EB" strokeWidth={2.5} fill="url(#revG)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Hour Bar Chart */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Orders by Hour</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Order volume distributed across the day</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="h"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(h: number | string) => `${String(h).padStart(2, '0')}:00`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(4, dataMax > 0 ? Math.ceil(dataMax * 1.2) : 4)]}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-primary)' }}
                labelFormatter={(label) => `Time: ${String(label).padStart(2, '0')}:00`}
                formatter={(v: any) => [`${v} order${v === 1 ? '' : 's'}`, 'Order Count']}
              />
              <Bar dataKey="n" name="Orders" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

/* --- REPORTS PAGE --- */
const ReportsPage = ({ showToast }: { showToast: (m: string, type?: 'success' | 'error') => void }) => {
  const exportReport = async (title: string, type: string) => {
    showToast(`Generating ${title}...`);
    try {
      if (type === 'revenue') {
        const res = await fetch(getApiUrl('/reports/analytics?period=WEEKLY'), { headers: authHeaders() });
        const d = await res.json();
        const report = d.data?.report ?? d.data ?? {};
        const rows = (report.dailyRevenue ?? []).map((r: any) => [r.day ?? r.date, r.revenue ?? 0]);
        csvExport(['Day', 'Revenue (KES)'], rows, 'daily-revenue.csv');
      } else if (type === 'weekly') {
        const res = await fetch(getApiUrl('/reports/analytics?period=WEEKLY'), { headers: authHeaders() });
        const d = await res.json();
        const report = d.data?.report ?? d.data ?? {};
        const rows = (report.hourlyOrders ?? []).map((h: any) => [`${String(h.hour ?? h.h).padStart(2, '0')}:00`, h.count ?? h.n ?? 0]);
        csvExport(['Hour', 'Orders Count'], rows, 'hourly-orders.csv');
      } else if (type === 'orders') {
        const res = await fetch(getApiUrl('/orders'), { headers: authHeaders() });
        const d = await res.json();
        const raw: any[] = d.data?.orders ?? d.data ?? [];
        const rows = raw.map((o: any) => [
          o.orderNumber ?? o.uuid?.slice(0, 8),
          getOrderTableDisplay(o),
          (o.items ?? o.orderItems ?? []).map((i: any) => `${i.product?.name ?? i.name} x ${i.quantity ?? 1}`).join('; '),
          o.waiter?.fullName ?? 'Unassigned',
          o.totalAmount,
          o.status,
          o.createdAt ? new Date(o.createdAt).toLocaleString('en-KE') : '-',
        ]);
        csvExport(['Order', 'Table', 'Item', 'Waiter', 'Amount (KES)', 'Status', 'Date'], rows, 'order-summary.csv');
      } else if (type === 'menu') {
        const res = await fetch(getApiUrl('/menu'), { headers: authHeaders() });
        const d = await res.json();
        const rawCats: any[] = (d.data ?? d).categories ?? [];
        const rows: any[] = [];
        rawCats.forEach((cat: any) => {
          (cat.products ?? []).forEach((p: any) => {
            rows.push([p.name, cat.name, p.price, p.isAvailable ? 'Available' : 'Out of Stock']);
          });
        });
        csvExport(['Item', 'Category', 'Price (KES)', 'Status'], rows, 'menu-performance.csv');
      } else if (type === 'staff') {
        const res = await fetch(getApiUrl('/reports/analytics?period=WEEKLY'), { headers: authHeaders() });
        const d = await res.json();
        const report = d.data?.report ?? d.data ?? {};
        const rows = (report.waiterPerformance ?? []).map((w: any) => [
          w.name,
          w.ordersServed,
          w.revenueGenerated,
          w.avgFulfillmentMins,
        ]);
        csvExport(['Waiter Name', 'Orders Served', 'Revenue Generated (KES)', 'Avg Fulfillment Time (Mins)'], rows, 'staff-performance.csv');
      } else {
        const res = await fetch(getApiUrl('/reports/analytics?period=WEEKLY'), { headers: authHeaders() });
        const d = await res.json();
        const report = d.data?.report ?? d.data ?? {};
        const pb = report.paymentBreakdown ?? {};
        const rows = [
          ['M-Pesa STK', pb.mpesa?.count ?? 0, `${pb.mpesa?.percentage ?? 0}%`],
          ['Card POS', pb.card?.count ?? 0, `${pb.card?.percentage ?? 0}%`],
          ['Cash', pb.cash?.count ?? 0, `${pb.cash?.percentage ?? 0}%`],
        ];
        csvExport(['Method', 'Transactions Count', 'Share (%)'], rows, 'payment-methods.csv');
      }
      showToast(`${title} exported successfully`);
    } catch {
      showToast(`Failed to export ${title}`, 'error');
    }
  };

  const reports = [
    { title: 'Daily Revenue', desc: 'Revenue breakdown by day for current week', type: 'revenue' },
    { title: 'Hourly Orders', desc: 'Order volume distributed across operating hours', type: 'weekly' },
    { title: 'Order Summary', desc: 'Full list of all orders with status, waiters and amounts', type: 'orders' },
    { title: 'Menu Performance', desc: 'Sales volume, pricing, and availability per menu item', type: 'menu' },
    { title: 'Staff Performance', desc: 'Waiter order counts, revenue generated, and fulfillment speeds', type: 'staff' },
    { title: 'Payment Methods', desc: 'Breakdown of transactions by method (M-Pesa, Card, Cash)', type: 'payment' },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader title="Reports" subtitle="Download detailed reports for your venue" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(r => (
          <div
            key={r.title}
            className="rounded-xl border p-5 flex items-start justify-between"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{r.title}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.desc}</div>
            </div>
            <button
              onClick={() => exportReport(r.title, r.type)}
              className="ml-4 flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* --- Settings Page --- */
const ManagerSettingsPage = ({ showToast }: { showToast: (m: string, type?: 'success' | 'error') => void; user?: any; onSettingsSaved?: (oh: string, ch: string) => void }) => {
  const [orderNotifs, setOrderNotifs] = React.useState(() => {
    try {
      const saved = localStorage.getItem('orderup_manager_notifs') || localStorage.getItem('drinkhub_manager_notifs');
      return saved ? JSON.parse(saved).orderNotifs ?? true : true;
    } catch {
      return true;
    }
  });
  const [soundAlerts, setSoundAlerts] = React.useState(() => {
    try {
      const saved = localStorage.getItem('orderup_manager_notifs') || localStorage.getItem('drinkhub_manager_notifs');
      return saved ? JSON.parse(saved).soundAlerts ?? true : true;
    } catch {
      return true;
    }
  });
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('orderup_manager_notifs', JSON.stringify({ orderNotifs, soundAlerts }));
      showToast('✅ Settings saved successfully!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader title="Club Settings" subtitle="Venue configuration" />

      {/* Notification Toggles */}
      {[{ label: 'Order Notifications', desc: 'Get notified when new orders arrive.', val: orderNotifs, set: setOrderNotifs }, { label: 'Sound Alerts', desc: 'Play a chime when an order status changes.', val: soundAlerts, set: setSoundAlerts }].map(item => (
        <div key={item.label} className="rounded-xl border p-5 flex items-center justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div><div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{item.label}</div><div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</div></div>
          <button onClick={() => item.set((v: boolean) => !v)} className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${item.val ? 'bg-blue-600' : 'bg-slate-300'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${item.val ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
        style={{ background: '#2563EB' }}
      >
        {saving ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" /></svg> Saving…</> : 'Save Changes'}
      </button>
    </div>
  );
};

/* --- QR Codes Page --- */
const QrCodesPage = ({
  user,
  showToast,
  clubName: propClubName,
  clubLogoUrl: propClubLogoUrl,
  clubThemeColor: propClubThemeColor,
}: {
  user: any;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  clubName?: string;
  clubLogoUrl?: string | null;
  clubThemeColor?: string;
}) => {
  const clubSlug =
    user.club?.slug ||
    user.business?.slug ||
    user.clubSlug ||
    user.tenantSlug ||
    (user.club?.name ? user.club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '') ||
    (user.business?.name ? user.business.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : '');
  const clubName = propClubName || user.club?.name || user.business?.name || 'Your Venue';
  const clubThemeColor = propClubThemeColor || user.club?.themeColor || user.business?.themeColor || '#2563EB';
  const clubLogoUrl = propClubLogoUrl ?? (user.club?.logoUrl || user.business?.logoUrl || null);
  const clubUuid = user.club?.clubUuid || user.club?.uuid || user.business?.uuid || user.businessUuid || user.clubUuid || user.tenantId || '';
  const pwaBase = (import.meta as any).env?.VITE_CUSTOMER_PWA_URL || 'https://orderup-ke-customer-pwa.vercel.app';
  const cleanPwaBase = pwaBase.endsWith('/') ? pwaBase.slice(0, -1) : pwaBase;
  const fullBaseUrl = `${cleanPwaBase}/v/${clubSlug}`;

  const storageKey = `orderup_qr_tables_${clubSlug}`;
  const legacyStorageKey = `drinkhub_qr_tables_${clubSlug}`;

  const [tableCount, setTableCount] = useState<string>('10');
  const [startTable, setStartTable] = useState<string>('1');
  const [section, setSection] = useState<string>('Main Lounge');
  const [genMode, setGenMode] = useState<'replace' | 'append'>('replace');
  const [showGenerator, setShowGenerator] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [qrSize, setQrSize] = useState<'normal' | 'large'>('large');
  const [copiedTableId, setCopiedTableId] = useState<number | null>(null);
  const [copiedVenueLink, setCopiedVenueLink] = useState<boolean>(false);

  // Fullscreen Zoom & Scan Modal
  const [zoomModalData, setZoomModalData] = useState<{
    title: string;
    subtitle: string;
    url: string;
    tableId?: number;
    section?: string;
  } | null>(null);

  // Single Table Add Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [singleTableNum, setSingleTableNum] = useState<string>('');
  const [singleTableSection, setSingleTableSection] = useState<string>('Main Lounge');

  // Print Stand Modal (for single table tent card preview)
  const [previewStandTable, setPreviewStandTable] = useState<{ id: number; section: string } | null>(null);

  const [tables, setTables] = useState<{ id: number; section: string }[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return Array.from({ length: 10 }, (_, i) => ({ id: i + 1, section: 'Main Lounge' }));
  });

  // Auto-open generator if no tables exist
  React.useEffect(() => {
    if (tables.length === 0) {
      setShowGenerator(true);
    }
  }, [tables.length]);

  // Initial load from backend API if available
  React.useEffect(() => {
    if (!clubUuid) return;
    fetch(getApiUrl(`/tenants/${clubUuid}/tables`), { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const raw = data?.data;
        if (Array.isArray(raw) && raw.length > 0) {
          const apiTables = raw
            .map((t: any) => ({
              id: Number(t.tableNumber),
              section: t.sectionName || 'Main Lounge',
            }))
            .sort((a: any, b: any) => a.id - b.id);
          setTables(apiTables);
          try {
            localStorage.setItem(storageKey, JSON.stringify(apiTables));
          } catch {}
        }
      })
      .catch(() => {});
  }, [clubUuid, storageKey]);

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const count = Math.min(Math.max(parseInt(tableCount) || 1, 1), 100);
    const start = Math.max(parseInt(startTable) || 1, 1);
    const sectionName = section.trim() || 'Main Lounge';

    const generated = Array.from({ length: count }, (_, i) => ({
      id: start + i,
      section: sectionName,
    }));

    let updated: { id: number; section: string }[];
    if (genMode === 'append') {
      const existingWithoutOverlap = tables.filter(t => !generated.some(g => g.id === t.id));
      updated = [...existingWithoutOverlap, ...generated].sort((a, b) => a.id - b.id);
    } else {
      updated = generated;
    }

    setTables(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}

    // Synchronize with backend in background
    if (clubUuid) {
      fetch(getApiUrl(`/tenants/${clubUuid}/generate-qr`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          tableCount: count,
          sectionName: sectionName,
          startFrom: start,
        }),
      }).catch(() => {});
    }

    showToast(`Generated ${count} QR codes for ${sectionName} (Tables ${start}–${start + count - 1})`);
    setShowGenerator(false);
  };

  const handleAddSingleTable = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(singleTableNum);
    if (isNaN(num) || num < 1) {
      showToast('Please enter a valid table number', 'error');
      return;
    }
    const targetSection = singleTableSection.trim() || 'Main Lounge';

    if (tables.some(t => t.id === num)) {
      showToast(`Table ${num} already exists!`, 'error');
      return;
    }

    const updated = [...tables, { id: num, section: targetSection }].sort((a, b) => a.id - b.id);
    setTables(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}

    // Synchronize with backend in background
    if (clubUuid) {
      fetch(getApiUrl(`/tenants/${clubUuid}/generate-qr`), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          tableCount: 1,
          sectionName: targetSection,
          startFrom: num,
        }),
      }).catch(() => {});
    }

    showToast(`Table ${num} added to ${targetSection}`);
    setAddModalOpen(false);
    setSingleTableNum('');
  };

  const handleReset = () => {
    const defaults = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, section: 'Main Lounge' }));
    setTables(defaults);
    setTableCount('10');
    setStartTable('1');
    setSection('Main Lounge');
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaults));
    } catch {}
    showToast('Reset to default 10 tables');
  };

  const handleDeleteTable = async (id: number) => {
    const next = tables.filter(t => t.id !== id);
    setTables(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}

    // Synchronize deletion with backend in background
    if (clubUuid) {
      fetch(getApiUrl(`/tenants/${clubUuid}/tables/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
      }).catch(() => {});
    }

    showToast(`Table ${id} deleted successfully`);
  };

  const [qrSearchQuery, setQrSearchQuery] = useState<string>('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('All');

  const distinctSections = React.useMemo(() => {
    const set = new Set<string>();
    tables.forEach(t => {
      if (t.section) set.add(t.section);
    });
    return Array.from(set);
  }, [tables]);

  const filteredTables = React.useMemo(() => {
    let list = tables;
    if (selectedSectionFilter !== 'All') {
      list = list.filter(t => t.section.toLowerCase() === selectedSectionFilter.toLowerCase());
    }
    if (qrSearchQuery.trim()) {
      const q = qrSearchQuery.toLowerCase().trim();
      list = list.filter(
        t =>
          String(t.id).includes(q) ||
          `table ${t.id}`.toLowerCase().includes(q) ||
          t.section.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tables, selectedSectionFilter, qrSearchQuery]);

  const copyToClipboard = (text: string, label: string, tableId?: number) => {
    navigator.clipboard.writeText(text);
    if (tableId !== undefined) {
      setCopiedTableId(tableId);
      setTimeout(() => setCopiedTableId(null), 2000);
    } else {
      setCopiedVenueLink(true);
      setTimeout(() => setCopiedVenueLink(false), 2000);
    }
    showToast(`${label} copied to clipboard!`);
  };

  const downloadQrImage = async (tableId: number, sectionName: string) => {
    const tableUrl = `${fullBaseUrl}/t/${tableId}`;
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(tableUrl)}`;
    try {
      const res = await fetch(qrImgUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${clubSlug}-Table-${tableId}-${sectionName.replace(/\s+/g, '_')}-QR.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast(`Downloaded QR code for Table ${tableId}`);
    } catch {
      window.open(qrImgUrl, '_blank');
    }
  };

  const handlePrintAll = () => {
    setPreviewStandTable(null);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintSingle = (t: { id: number; section: string }) => {
    setPreviewStandTable(t);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const parsedCount = Math.min(Math.max(parseInt(tableCount) || 1, 1), 100);
  const nextTableNumber = tables.length > 0 ? Math.max(...tables.map(t => t.id)) + 1 : 1;

  return (
    <div className="space-y-6 pb-16">
      {/* Print Styles for Restaurant Table Tent Cards */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          aside, nav, header, .no-print { display: none !important; }
          .printable-qr-area { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .print-card-stand {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 2px dashed #CBD5E1 !important;
            border-radius: 20px !important;
            padding: 28px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            margin-bottom: 24px !important;
            text-align: center !important;
          }
        }
      `}</style>

      {/* Screen View */}
      <div className="no-print space-y-3">
        {/* Sticky Top Header Section (Reduced Hero + Filters) */}
        <div
          className="sticky top-0 z-20 space-y-2.5 pb-2 -mt-1 pt-1 backdrop-blur-md"
          style={{ background: 'var(--bg-body)' }}
        >
          {/* Compact Top Hero Command Center */}
          <div
            className="rounded-2xl border px-4 py-3 sm:px-5 sm:py-3 transition-all shadow-sm relative"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Left: Title + Status + Venue Link */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  QR Code Table Ordering
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Active
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  ({tables.length} tables)
                </span>
              </div>

              {/* Compact URL & Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(fullBaseUrl, 'Customer Storefront Link')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-body)' }}
                  title={fullBaseUrl}
                >
                  {copiedVenueLink ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-slate-400" />}
                  <span className="truncate max-w-[130px] sm:max-w-[170px] font-mono text-[11px]">{fullBaseUrl.replace(/^https?:\/\//, '')}</span>
                  <span className="text-[10px] text-blue-500">{copiedVenueLink ? 'Copied!' : 'Copy'}</span>
                </button>

                <a
                  href={fullBaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg border text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-500"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-body)' }}
                  title="Preview Digital Menu"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Center / Right: Master QR preview button + Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
              {/* Sleek Master QR Button */}
              <button
                type="button"
                onClick={() =>
                  setZoomModalData({
                    title: `${clubName} — Master Menu`,
                    subtitle: 'Official Venue-Wide Menu QR Code (for bar counters, entrance & flyers)',
                    url: fullBaseUrl,
                  })
                }
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all hover:border-blue-500 hover:bg-blue-50/10 text-xs font-bold group"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)' }}
                title="Click to view & scan full-size Venue QR Code"
              >
                <div className="p-0.5 bg-white rounded-md border border-slate-200 shadow-sm flex-shrink-0">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=1&data=${encodeURIComponent(fullBaseUrl)}`}
                    alt="Venue Master QR"
                    className="w-5 h-5 object-contain"
                    crossOrigin="anonymous"
                  />
                </div>
                <span style={{ color: 'var(--text-primary)' }}>Venue QR</span>
                <ZoomIn className="h-3 w-3 text-slate-400 group-hover:text-blue-500" />
              </button>

              {/* Action buttons */}
              <button
                type="button"
                onClick={() => {
                  setSingleTableNum(String(nextTableNumber));
                  setSingleTableSection(distinctSections[0] || 'Main Lounge');
                  setAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
              >
                <Plus className="h-3.5 w-3.5 text-emerald-500" />
                <span>Add Single Table</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGenerator(!showGenerator)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                  showGenerator
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                style={showGenerator ? {} : { borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Batch Generator</span>
                {showGenerator ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              <button
                type="button"
                onClick={handlePrintAll}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-md hover:shadow-lg"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print All Stands</span>
              </button>
            </div>
          </div>

          {/* Expandable Batch Generator */}
          {showGenerator && (
            <div
              className="mt-6 pt-6 border-t animate-in fade-in slide-in-from-top-2 duration-200"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    Batch Table QR Code Generator
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Quickly configure a range of tables and areas with custom table numbering.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center p-1 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-body)' }}>
                    <button
                      type="button"
                      onClick={() => setGenMode('replace')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        genMode === 'replace'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Replace All
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenMode('append')}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        genMode === 'append'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      + Add to Existing
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl border text-slate-400 hover:text-red-500 hover:border-red-500/40 transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                    title="Reset to default 10 tables"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              {/* Presets Row */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 text-xs">
                <span className="font-semibold text-slate-400 text-[11px] flex-shrink-0">Quick Presets:</span>
                {[5, 10, 15, 20, 30].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setTableCount(String(cnt))}
                    className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] transition-all flex-shrink-0 ${
                      tableCount === String(cnt)
                        ? 'bg-blue-500/15 text-blue-500 border-blue-500/40'
                        : 'text-slate-400 border-slate-700/60 hover:border-slate-500'
                    }`}
                  >
                    {cnt} Tables
                  </button>
                ))}

                <span className="font-semibold text-slate-400 text-[11px] ml-2 flex-shrink-0">Sections:</span>
                {['Main Lounge', 'VIP Lounge', 'Terrace', 'Bar Counter', 'Garden', 'Balcony'].map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSection(sec)}
                    className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] transition-all flex-shrink-0 ${
                      section === sec
                        ? 'bg-blue-500/15 text-blue-500 border-blue-500/40'
                        : 'text-slate-400 border-slate-700/60 hover:border-slate-500'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>

              {/* Generator Form */}
              <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs font-bold block mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Number of Tables
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={tableCount}
                    onChange={e => setTableCount(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none font-semibold transition-all focus:ring-2 focus:ring-blue-500"
                    style={{
                      background: 'var(--bg-body)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Starting Table #
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={startTable}
                    onChange={e => setStartTable(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none font-semibold transition-all focus:ring-2 focus:ring-blue-500"
                    style={{
                      background: 'var(--bg-body)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Section / Area Name
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    placeholder="e.g. Main Lounge, VIP"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none font-semibold transition-all focus:ring-2 focus:ring-blue-500"
                    style={{
                      background: 'var(--bg-body)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md hover:shadow-lg h-[42px] flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate {parsedCount} QR Codes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGenerator(false)}
                    className="rounded-xl border px-3 py-2.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    title="Close generator"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Compact Filter, Search & View Toolbar */}
        <div
          className="rounded-xl border px-3 py-2 sm:px-4 sm:py-2 flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {/* Section Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setSelectedSectionFilter('All')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition-all flex-shrink-0 ${
                selectedSectionFilter === 'All'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={selectedSectionFilter === 'All' ? {} : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <span>All Tables</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  selectedSectionFilter === 'All' ? 'bg-white/25 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {tables.length}
              </span>
            </button>

            {distinctSections.map(sec => {
              const secCount = tables.filter(t => t.section === sec).length;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSectionFilter(sec)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0 ${
                    selectedSectionFilter === sec
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  style={selectedSectionFilter === sec ? {} : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <span>{sec}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      selectedSectionFilter === sec ? 'bg-white/25 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {secCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Toolbar: Search & View Mode Switcher */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={qrSearchQuery}
                onChange={e => setQrSearchQuery(e.target.value)}
                placeholder="Search table # or area..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs font-medium border outline-none transition-all focus:ring-2 focus:ring-blue-500 shadow-sm"
                style={{ background: 'var(--bg-body)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              {qrSearchQuery && (
                <button
                  onClick={() => setQrSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* QR Size Density Selector (Grid Mode Only) */}
            {viewMode === 'grid' && (
              <div className="flex items-center p-0.5 rounded-xl border text-xs font-bold" style={{ borderColor: 'var(--border)', background: 'var(--bg-body)' }}>
                <button
                  type="button"
                  onClick={() => setQrSize('normal')}
                  className={`px-2 py-1 rounded-lg transition-all text-[11px] font-bold ${
                    qrSize === 'normal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Standard QR Size"
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setQrSize('large')}
                  className={`px-2 py-1 rounded-lg transition-all text-[11px] font-bold ${
                    qrSize === 'large' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Large QR Codes (Maximum visibility & scan ease)"
                >
                  Large ⚡
                </button>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-body)' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid Card View"
              >
                <Grid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Compact Table View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Info Bar */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            Showing <span className="font-bold text-blue-500">{filteredTables.length}</span> of {tables.length} Active Table QR Codes
          </p>
          {filteredTables.length > 0 && (
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Click <span className="font-bold text-slate-300">Print</span> on any card to generate a tent card.
            </p>
          )}
        </div>
      </div>

        {/* Main Content View (No Cut-off, Natural Page Flow) */}
        {filteredTables.length === 0 ? (
          <div
            className="text-center py-20 px-4 space-y-3 rounded-2xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="h-16 w-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto border border-blue-500/20">
              <QrCode className="h-8 w-8" />
            </div>
            <p className="font-black text-base" style={{ color: 'var(--text-primary)' }}>
              {qrSearchQuery ? `No table QR codes match "${qrSearchQuery}"` : 'No table QR codes created yet.'}
            </p>
            <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
              {qrSearchQuery
                ? 'Try checking for typos or clear your search query.'
                : 'Click Batch Generator above to automatically generate QR codes for all your restaurant tables.'}
            </p>
            {qrSearchQuery ? (
              <button
                type="button"
                onClick={() => setQrSearchQuery('')}
                className="mt-2 text-xs font-bold text-blue-500 hover:underline inline-flex items-center gap-1"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowGenerator(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700"
              >
                <Sparkles className="h-3.5 w-3.5" /> Open Generator
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* Cards Grid View — Scrollable container calibrated so at least 2 full rows show at a go */
          <div
            className="overflow-y-auto max-h-[calc(100vh-235px)] min-h-[480px] pr-1 pb-4"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div
              className={`grid gap-4 ${
                qrSize === 'large'
                  ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5'
              }`}
            >
              {filteredTables.map(t => {
                const tableUrl = `${fullBaseUrl}/t/${t.id}`;
                const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=2&data=${encodeURIComponent(tableUrl)}`;
                const isCopied = copiedTableId === t.id;

                return (
                  <div
                    key={t.id}
                    className="rounded-xl border p-3 flex flex-col justify-between transition-all hover:shadow-xl hover:border-blue-500/60 group relative"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                  >
                    {/* Card Header: Section & Table # */}
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 truncate max-w-[120px]">
                          {t.section}
                        </span>

                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            Table {t.id}
                          </span>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete Table ${t.id}?`)) {
                                handleDeleteTable(t.id);
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title={`Delete Table ${t.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* QR Code Canvas with Camera Frame Design & Click-to-Zoom */}
                      <div
                        onClick={() =>
                          setZoomModalData({
                            title: `Table ${t.id} • ${t.section}`,
                            subtitle: `Direct Table Ordering QR Code for Table ${t.id}`,
                            url: tableUrl,
                            tableId: t.id,
                            section: t.section,
                          })
                        }
                        className="relative p-2 sm:p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 my-1 flex flex-col items-center justify-center cursor-pointer group/qr transition-all hover:border-blue-500 hover:shadow-md"
                        title="Click to view full-size & scan directly from screen"
                      >
                        {/* Scanner Frame Corner Accents */}
                        <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-blue-600 rounded-tl-sm" />
                        <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-blue-600 rounded-tr-sm" />
                        <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-blue-600 rounded-bl-sm" />
                        <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-blue-600 rounded-br-sm" />

                        <img
                          src={qrImgUrl}
                          alt={`QR Table ${t.id}`}
                          className={`object-contain transition-transform duration-300 group-hover/qr:scale-105 ${
                            qrSize === 'large' ? 'w-32 h-32 sm:w-36 sm:h-36' : 'w-24 h-24 sm:w-28 sm:h-28'
                          }`}
                          crossOrigin="anonymous"
                          loading="lazy"
                        />

                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-blue-900/15 backdrop-blur-[1px] rounded-xl opacity-0 group-hover/qr:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 pointer-events-none">
                          <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow flex items-center gap-1 text-[11px] font-bold">
                            <Maximize2 className="h-3 w-3" />
                            <span>Enlarge</span>
                          </div>
                        </div>
                      </div>

                      {/* Table Details */}
                      <div className="text-center my-1.5">
                        <div className="text-xs font-black truncate" style={{ color: 'var(--text-primary)' }}>
                          Table {t.id} · {t.section}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="grid grid-cols-4 gap-1 pt-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => handlePrintSingle(t)}
                        className="flex items-center justify-center py-1 rounded-lg text-[10px] font-bold transition-colors border hover:bg-slate-100 dark:hover:bg-slate-800"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        title="Print single table tent stand"
                      >
                        <Printer className="h-3 w-3 text-blue-500 mr-0.5" />
                        <span>Print</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadQrImage(t.id, t.section)}
                        className="flex items-center justify-center py-1 rounded-lg text-[10px] font-bold transition-colors border hover:bg-slate-100 dark:hover:bg-slate-800"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        title="Download PNG image"
                      >
                        <Download className="h-3 w-3 text-emerald-500 mr-0.5" />
                        <span>Save</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(tableUrl, `Table ${t.id} direct link`, t.id)}
                        className="flex items-center justify-center py-1 rounded-lg text-[10px] font-bold transition-colors border hover:bg-slate-100 dark:hover:bg-slate-800"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        title="Copy table direct ordering link"
                      >
                        {isCopied ? <Check className="h-3 w-3 text-emerald-500 mr-0.5" /> : <Copy className="h-3 w-3 text-amber-500 mr-0.5" />}
                        <span>{isCopied ? 'Done' : 'Copy'}</span>
                      </button>

                      <a
                        href={tableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center py-1 rounded-lg text-[10px] font-bold transition-colors border text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        style={{ borderColor: 'var(--border)' }}
                        title="Open digital menu for this table"
                      >
                        <ExternalLink className="h-3 w-3 mr-0.5" />
                        <span>Open</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Compact Table / List View */
          <div
            className="rounded-2xl border overflow-hidden shadow-sm flex flex-col"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[300px]" style={{ scrollbarWidth: 'thin' }}>
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 shadow-sm">
                  <tr style={{ background: 'var(--bg-card)' }}>
                    <th className="sticky top-0 z-20 py-3 px-4 font-black uppercase text-[10px] border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Table #</th>
                    <th className="sticky top-0 z-20 py-3 px-4 font-black uppercase text-[10px] border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Section / Area</th>
                    <th className="sticky top-0 z-20 py-3 px-4 font-black uppercase text-[10px] border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>QR Preview</th>
                    <th className="sticky top-0 z-20 py-3 px-4 font-black uppercase text-[10px] border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Ordering Route</th>
                    <th className="sticky top-0 z-20 py-3 px-4 font-black uppercase text-[10px] text-right border-b backdrop-blur-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredTables.map(t => {
                    const tableUrl = `${fullBaseUrl}/t/${t.id}`;
                    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=2&data=${encodeURIComponent(tableUrl)}`;
                    const isCopied = copiedTableId === t.id;

                    return (
                      <tr key={t.id} className="hover:bg-slate-500/5 transition-colors">
                        <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
                          <span className="font-black text-sm text-blue-500">#{t.id}</span>
                        </td>
                        <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
                          <span className="font-bold px-2.5 py-1 rounded-full text-[11px] bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {t.section}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
                          <div
                            onClick={() =>
                              setZoomModalData({
                                title: `Table ${t.id} • ${t.section}`,
                                subtitle: `Direct Table Ordering QR Code for Table ${t.id}`,
                                url: tableUrl,
                                tableId: t.id,
                                section: t.section,
                              })
                            }
                            className="p-1.5 bg-white rounded-xl border border-slate-200 w-14 h-14 flex items-center justify-center cursor-pointer hover:border-blue-500 shadow-sm transition-all group/listqr relative"
                            title="Click to view & scan full-size QR code"
                          >
                            <img src={qrImgUrl} alt={`QR ${t.id}`} className="w-11 h-11 object-contain" />
                            <div className="absolute inset-0 bg-blue-600/15 rounded-xl opacity-0 group-hover/listqr:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px] border-b" style={{ borderColor: 'var(--border)' }}>
                          <span className="truncate max-w-xs block">{tableUrl}</span>
                        </td>
                        <td className="py-3 px-4 text-right border-b" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintSingle(t)}
                              className="p-1.5 rounded-lg border text-slate-400 hover:text-blue-500 transition-colors"
                              style={{ borderColor: 'var(--border)' }}
                              title="Print Table Stand"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadQrImage(t.id, t.section)}
                              className="p-1.5 rounded-lg border text-slate-400 hover:text-emerald-500 transition-colors"
                              style={{ borderColor: 'var(--border)' }}
                              title="Download PNG"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(tableUrl, `Table ${t.id} link`, t.id)}
                              className="p-1.5 rounded-lg border text-slate-400 hover:text-amber-500 transition-colors"
                              style={{ borderColor: 'var(--border)' }}
                              title="Copy URL"
                            >
                              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <a
                              href={tableUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border text-slate-400 hover:text-blue-500 transition-colors"
                              style={{ borderColor: 'var(--border)' }}
                              title="Open in new tab"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete Table ${t.id}?`)) handleDeleteTable(t.id);
                              }}
                              className="p-1.5 rounded-lg border text-slate-400 hover:text-red-500 transition-colors"
                              style={{ borderColor: 'var(--border)' }}
                              title="Delete table"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {addModalOpen && (() => {
        const isNewSection = !distinctSections.includes(singleTableSection) && singleTableSection !== '';
        const showNewInput = isNewSection || distinctSections.length === 0;
        const closeModal = () => { setAddModalOpen(false); setSingleTableSection(distinctSections[0] || 'Main Lounge'); setSingleTableNum(''); };
        return (
          <Modal open={addModalOpen} onClose={closeModal} title="Add Single Table QR Code" size="md">
            <form onSubmit={handleAddSingleTable} className="space-y-6">

              {/* Table Number */}
              <div>
                <label className="text-sm font-extrabold uppercase tracking-widest block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Table Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={singleTableNum}
                  onChange={e => setSingleTableNum(e.target.value)}
                  placeholder="e.g. 12"
                  required
                  autoFocus
                  className="w-full rounded-2xl border-2 px-5 py-4 text-2xl font-black outline-none focus:ring-4 focus:ring-blue-500/30 transition-all"
                  style={{ background: 'var(--bg-body)', borderColor: singleTableNum ? '#3b82f6' : 'var(--border)', color: 'var(--text-primary)' }}
                />
                {singleTableNum && (
                  <p className="text-xs font-semibold mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Table {singleTableNum} will be created
                  </p>
                )}
              </div>

              {/* Section / Area */}
              <div>
                <label className="text-sm font-extrabold uppercase tracking-widest block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Section / Area <span className="text-red-500">*</span>
                </label>

                {/* Existing section pills */}
                {distinctSections.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {distinctSections.map(sec => {
                      const isSelected = singleTableSection === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setSingleTableSection(sec)}
                          className="text-sm font-bold px-4 py-2 rounded-xl transition-all"
                          style={isSelected
                            ? { background: '#3b82f6', color: '#fff', border: '2px solid #3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,0.25)' }
                            : { background: 'var(--bg-body)', color: 'var(--text-primary)', border: '2px solid var(--border)' }
                          }
                        >
                          {sec}
                        </button>
                      );
                    })}

                    {/* + New Section toggle */}
                    <button
                      type="button"
                      onClick={() => setSingleTableSection('')}
                      className="text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                      style={isNewSection || singleTableSection === ''
                        ? { background: '#10b981', color: '#fff', border: '2px solid #10b981', boxShadow: '0 0 0 3px rgba(16,185,129,0.25)' }
                        : { background: 'var(--bg-body)', color: 'var(--text-muted)', border: '2px dashed var(--border)' }
                      }
                    >
                      <span className="text-base leading-none">+</span> New Section
                    </button>
                  </div>
                )}

                {/* New section text input */}
                {(showNewInput || distinctSections.length === 0) && (
                  <input
                    type="text"
                    value={singleTableSection}
                    onChange={e => setSingleTableSection(e.target.value)}
                    placeholder="e.g. VIP, Terrace, Main Lounge"
                    required
                    autoFocus={distinctSections.length === 0}
                    className="w-full rounded-2xl border-2 px-5 py-4 text-base font-semibold outline-none focus:ring-4 focus:ring-emerald-500/30 transition-all"
                    style={{ background: 'var(--bg-body)', borderColor: singleTableSection ? '#10b981' : 'var(--border)', color: 'var(--text-primary)' }}
                  />
                )}

                {/* Hidden required guard when pill selected */}
                {!showNewInput && distinctSections.length > 0 && (
                  <input type="hidden" value={singleTableSection} required />
                )}

                {singleTableSection && (
                  <p className="text-xs font-semibold mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${distinctSections.includes(singleTableSection) ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                    {distinctSections.includes(singleTableSection)
                      ? `Adding to existing section "${singleTableSection}"`
                      : `Will create new section "${singleTableSection}"`
                    }
                  </p>
                )}
              </div>

              {/* Summary preview */}
              {singleTableNum && singleTableSection && (
                <div className="rounded-2xl px-5 py-4 flex items-center gap-4 border-2" style={{ background: 'var(--bg-body)', borderColor: '#3b82f6' }}>
                  <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-black text-lg">{singleTableNum}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ready to add</p>
                    <p className="text-base font-black" style={{ color: 'var(--text-primary)' }}>Table {singleTableNum} · {singleTableSection}</p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-body)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!singleTableSection.trim() || !singleTableNum}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-black shadow-lg shadow-blue-500/30 transition-all"
                >
                  Add Table →
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}


      {/* Fullscreen High-Visibility QR Zoom & Scan Modal */}
      {zoomModalData && (
        <Modal
          open={Boolean(zoomModalData)}
          onClose={() => setZoomModalData(null)}
          title={zoomModalData.title}
          size="md"
        >
          <div className="flex flex-col items-center text-center space-y-4 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Smartphone className="h-4 w-4 text-blue-600" />
              <span>Scan directly from your screen with phone camera</span>
            </div>

            {/* Large high-contrast QR display */}
            <div className="relative p-6 bg-white rounded-3xl shadow-2xl border-4 border-slate-200 flex items-center justify-center">
              {/* Large scanner frame corner accents */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-4 border-l-4 border-blue-600 rounded-tl-lg" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-4 border-r-4 border-blue-600 rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-4 border-l-4 border-blue-600 rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-4 border-r-4 border-blue-600 rounded-br-lg" />

              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=2&data=${encodeURIComponent(zoomModalData.url)}`}
                alt="QR Code Enlarge"
                className="w-72 h-72 sm:w-80 sm:h-80 object-contain"
                crossOrigin="anonymous"
              />
            </div>

            <div className="space-y-1.5 w-full">
              <p className="text-xs text-slate-500 font-semibold">{zoomModalData.subtitle}</p>
              <div className="px-3.5 py-2 rounded-xl bg-slate-100 font-mono text-xs text-slate-700 break-all select-all border">
                {zoomModalData.url}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-center gap-2 pt-2 w-full flex-wrap">
              <button
                type="button"
                onClick={() => copyToClipboard(zoomModalData.url, 'QR link')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5 text-slate-500" />
                Copy Direct Link
              </button>
              {zoomModalData.tableId && (
                <button
                  type="button"
                  onClick={() => downloadQrImage(zoomModalData.tableId!, zoomModalData.section || 'Lounge')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PNG
                </button>
              )}
              <a
                href={zoomModalData.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Digital Menu
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Area (Hospitality Table Tent Cards) */}
      <div className="hidden print:block printable-qr-area">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black">{clubName}</h2>
          <p className="text-xs text-slate-500">Official Table QR Ordering Cards • Fold in half or cut to stand</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {(previewStandTable ? [previewStandTable] : tables).map(t => {
            const tableUrl = `${fullBaseUrl}/t/${t.id}`;
            const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=2&data=${encodeURIComponent(tableUrl)}`;

            return (
              <div
                key={t.id}
                className="print-card-stand border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-white text-slate-900 flex flex-col items-center justify-between text-center min-h-[380px]"
              >
                {/* Header */}
                <div className="w-full flex items-center justify-between border-b pb-3 mb-2">
                  <div className="flex items-center gap-2">
                    {clubLogoUrl ? (
                      <img src={resolveImageUrl(clubLogoUrl)} alt={clubName} className="h-7 w-7 object-contain rounded-md" />
                    ) : (
                      <div className="h-7 w-7 rounded-md bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                        {clubName.charAt(0)}
                      </div>
                    )}
                    <span className="font-black text-sm tracking-tight text-slate-900">{clubName}</span>
                  </div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {t.section}
                  </span>
                </div>

                {/* Table Highlight */}
                <div className="my-1">
                  <span className="text-3xl font-black tracking-tight text-slate-900 block">
                    TABLE {t.id}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Scan to browse menu & order</span>
                </div>

                {/* QR Code */}
                <div className="p-3 bg-white border border-slate-200 rounded-2xl my-2 shadow-sm">
                  <img src={qrImgUrl} alt={`Table ${t.id} QR`} className="w-44 h-44 object-contain mx-auto" crossOrigin="anonymous" />
                </div>

                {/* Instructions */}
                <div className="w-full space-y-1 text-xs text-slate-600 border-t pt-2 mt-1">
                  <p className="font-bold text-slate-800">1. Open Camera  •  2. Scan QR  •  3. Order & Pay</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{tableUrl}</p>
                  <p className="text-[9px] text-slate-400 font-medium">No app download required • Orders delivered to Table {t.id}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* --- Nav --- */
type NavKey = 'dashboard' | 'orders' | 'menu' | 'staff' | 'qr' | 'reports' | 'settings';
const NAV_ITEMS: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'orders', label: 'Live Orders', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'menu', label: 'Menu', icon: <BookOpen className="h-4 w-4" /> },
  { key: 'staff', label: 'Staff', icon: <Users className="h-4 w-4" /> },
  { key: 'qr', label: 'QR Codes', icon: <QrCode className="h-4 w-4" /> },
  { key: 'reports', label: 'Reports', icon: <TrendingUp className="h-4 w-4" /> },
  { key: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];
const PAGE_TITLES: Record<NavKey, string> = { dashboard: 'Overview', orders: 'Live Orders', menu: 'Menu', staff: 'Staff Management', qr: 'QR Code Table Ordering', reports: 'Reports', settings: 'Settings' };

/*           Notification Data           */
interface MgrNotif { id: string; title: string; body: string; time: string; read: boolean; icon: React.ReactNode; }
const INIT_MGR_NOTIFS: MgrNotif[] = [];

/*           Main Export           */
export const ManagerDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { applyClubBranding } = useTheme();
  const [page, setPage] = React.useState<NavKey>('dashboard');
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type }), []);

  /* Read logged-in manager & venue from localStorage */
  const user = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('orderup_user') || localStorage.getItem('drinkhub_user') || '{}'); }
    catch { return {}; }
  }, []);

  const [currentClub, setCurrentClub] = React.useState<any>(() => user.club || user.business || null);
  const [openingHours, setOpeningHours] = React.useState<string>(user.club?.openingHours || user.business?.openingHours || '18:00');
  const [closingHours, setClosingHours] = React.useState<string>(user.club?.closingHours || user.business?.closingHours || '04:00');
  const [logoError, setLogoError] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCurrentBusiness = async () => {
      try {
        const res = await fetch(getApiUrl('/tenants/current'), { headers: authHeaders() });
        if (res.ok) {
          const json = await res.json();
          const biz = json.data?.business || json.data?.club || json.data;
          if (isMounted && biz) {
            setCurrentClub(biz);
            if (biz.openingHours) setOpeningHours(biz.openingHours);
            if (biz.closingHours) setClosingHours(biz.closingHours);
          }
        }
      } catch {}
    };
    fetchCurrentBusiness();
    return () => { isMounted = false; };
  }, []);

  const clubName = currentClub?.name || user.club?.name || user.business?.name || 'Venue Portal';
  const clubCity = currentClub?.city || user.club?.city || user.business?.city || 'Nairobi';
  const clubCounty = currentClub?.county || user.club?.county || user.business?.county || 'Kenya';
  const clubLocation = `${clubCity}, ${clubCounty}`;
  const clubLogoUrl = currentClub?.logoUrl || user.club?.logoUrl || user.business?.logoUrl || null;
  const clubThemeColor = currentClub?.themeColor || user.club?.themeColor || user.business?.themeColor || '#2563EB';

  React.useEffect(() => {
    setLogoError(false);
  }, [clubLogoUrl]);

  React.useEffect(() => {
    if (clubThemeColor) {
      document.documentElement.style.setProperty('--brand-primary', clubThemeColor);
      document.documentElement.style.setProperty('--primary', clubThemeColor);
      document.documentElement.style.setProperty('--club-primary', clubThemeColor);
      applyClubBranding({
        primaryColor: clubThemeColor,
        name: clubName,
      });
    }
  }, [clubThemeColor, clubName, applyClubBranding]);

  // Compute open/closed status from current time vs stored hours
  const isOpenNow = React.useMemo(() => {
    try {
      const now = new Date();
      const [oH, oM] = openingHours.split(':').map(Number);
      const [cH, cM] = closingHours.split(':').map(Number);
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const openMins = oH * 60 + oM;
      const closeMins = cH * 60 + cM;
      // Handle overnight (e.g. 18:00 – 02:00)
      if (closeMins <= openMins) {
        return nowMins >= openMins || nowMins < closeMins;
      }
      return nowMins >= openMins && nowMins < closeMins;
    } catch {
      return true;
    }
  }, [openingHours, closingHours]);

  const handleSettingsSaved = React.useCallback((oh: string, ch: string) => {
    setOpeningHours(oh);
    setClosingHours(ch);
  }, []);

  const fullName = user.fullName || 'Manager';
  const nameParts = fullName.trim().split(' ');
  const firstName = nameParts[0] || 'Manager';
  const lastName = nameParts.slice(1).join(' ');
  const displayName = `${firstName} ${lastName ? lastName.charAt(0) + '.' : ''}`;
  const initials = `${firstName[0] || 'M'}${lastName[0] ? lastName[0] : ''}`;
  const userEmail = user.email || 'manager@orderup.co.ke';
  const userRoleDisplay = 'Manager';

  /* Dropdowns */
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState<MgrNotif[]>(INIT_MGR_NOTIFS);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  /* Click-outside to close */
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.read).length;
  const markAllRead = () => setNotifs(p => p.map(n => ({ ...n, read: true })));
  const dismiss = (id: string) => setNotifs(p => p.filter(n => n.id !== id));

  const renderPage = () => {
    const p = { showToast };
    switch (page) {
      case 'dashboard': return <DashboardPage {...p} />;
      case 'orders':    return <OrdersPage {...p} />;
      case 'menu':      return <MenuPage {...p} />;
      case 'staff':     return <StaffManagementPage {...p} />;
      case 'qr':        return <QrCodesPage user={user} showToast={showToast} clubName={clubName} clubLogoUrl={clubLogoUrl} clubThemeColor={clubThemeColor} />;
      case 'reports':   return <ReportsPage {...p} />;
      case 'settings':  return <ManagerSettingsPage {...p} user={user} onSettingsSaved={handleSettingsSaved} />;
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

      <aside className={`flex-shrink-0 flex flex-col h-full transition-all duration-200 fixed inset-y-0 left-0 lg:static z-50 lg:z-30 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} style={{ width: collapsed ? '64px' : '210px', background: 'var(--bg-sidebar)', borderRight: '1px solid #1E293B' }}>
        <div
          className={`flex ${collapsed ? 'flex-col items-center gap-2 p-2.5' : 'items-center gap-2.5 p-3.5'} border-b`}
          style={{ borderColor: '#1E293B' }}
        >
          <div
            onClick={() => {
              if (collapsed) setCollapsed(false);
            }}
            title={collapsed ? 'Click to expand sidebar' : clubName}
            className={`h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-all overflow-hidden shadow-sm border border-slate-700/60 relative group ${collapsed ? 'cursor-pointer hover:border-blue-500' : ''}`}
            style={{ backgroundColor: clubThemeColor }}
          >
            {clubLogoUrl && !logoError ? (
              <img
                src={resolveImageUrl(clubLogoUrl)}
                alt={clubName}
                className="h-full w-full object-cover rounded-xl"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-white font-black text-base uppercase tracking-wider">
                {clubName ? clubName.charAt(0) : <Wine className="h-5 w-5 text-white" />}
              </span>
            )}
            {collapsed && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                <ChevronRight className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
          {!collapsed ? (
            <>
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="text-sm font-black text-white truncate" title={clubName}>
                  {clubName}
                </div>
                <div className="text-[10px] font-bold truncate" style={{ color: clubThemeColor }}>Manager Portal</div>
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
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={() => { setPage(item.key); setMobileOpen(false); }} title={collapsed ? item.label : undefined}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: page === item.key ? clubThemeColor : 'transparent',
                color: page === item.key ? '#FFFFFF' : '#94A3B8',
                justifyContent: collapsed ? 'center' : 'flex-start',
                boxShadow: page === item.key ? `0 4px 12px ${clubThemeColor}40` : 'none',
              }}>
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="flex-shrink-0 p-2 border-t" style={{ borderColor: '#1E293B' }}>
          <button onClick={onLogout} title={collapsed ? 'Sign Out' : undefined} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <LogOut className="h-4 w-4 flex-shrink-0" />{!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-20 flex-shrink-0 border-b px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between backdrop-blur-md" style={{ background: 'var(--bg-body)', borderColor: 'var(--border)' }}>
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
              <h1 className="text-base font-black truncate" style={{ color: 'var(--text-primary)' }}>{PAGE_TITLES[page]}</h1>
              <p className="text-xs truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>{clubName} ({clubLocation}) | {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${isOpenNow ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isOpenNow ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {isOpenNow ? 'Open' : 'Closed'} | {openingHours} – {closingHours}
            </div>
            <ThemeToggle />

            {/*        Notifications        */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }}
                className="relative h-8 w-8 rounded-lg border flex items-center justify-center transition-colors"
                style={{ borderColor: 'var(--border)', background: notifOpen ? 'var(--bg-muted)' : 'transparent' }}
              >
                <Bell className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">{unread}</span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-2xl z-50 overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Notifications</span>
                      {unread > 0 && <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread} new</span>}
                    </div>
                    {unread > 0 && <button onClick={markAllRead} className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors">Mark all read</button>}
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No notifications</div>
                    ) : notifs.map(n => (
                      <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0 hover:opacity-90 transition-opacity group"
                        style={{ borderColor: 'var(--border)', background: n.read ? 'transparent' : 'color-mix(in srgb, var(--primary) 5%, transparent)' }}>
                        <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: 'var(--bg-muted)' }}>{n.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</span>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                          </div>
                          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.body}</p>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{n.time}</span>
                        </div>
                        <button onClick={() => dismiss(n.id)} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200">
                          <X className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="border-t px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => { setPage('orders'); setNotifOpen(false); }} className="w-full text-center text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors py-0.5">
                      View live orders    
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/*        Profile        */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors"
                style={{ borderColor: 'var(--border)', background: profileOpen ? 'var(--bg-muted)' : 'transparent' }}
              >
                <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ backgroundColor: clubThemeColor }}><span className="text-[10px] font-black text-white">{initials}</span></div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ color: 'var(--text-muted)', transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border shadow-2xl z-50 overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  {/* Identity */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: clubThemeColor }}><span className="text-sm font-black text-white">{initials}</span></div>
                      <div className="min-w-0">
                        <div className="text-sm font-black truncate" style={{ color: 'var(--text-primary)' }}>{fullName}</div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{userEmail}</div>
                        <span className="inline-block mt-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{userRoleDisplay}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-1.5 space-y-0.5">
                    {[
                      { icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: 'Dashboard', nav: 'dashboard' as NavKey },
                      { icon: <Users className="h-3.5 w-3.5" />, label: 'Staff Management', nav: 'staff' as NavKey },
                      { icon: <Settings className="h-3.5 w-3.5" />, label: 'Settings', nav: 'settings' as NavKey },
                    ].map(item => (
                      <button key={item.label} onClick={() => { setPage(item.nav); setProfileOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-slate-100 text-left"
                        style={{ color: 'var(--text-secondary)' }}>
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="border-t p-1.5" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => { setProfileOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors text-left">
                      <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 pb-12">{renderPage()}</main>
      </div>
    </div>
  );
};
