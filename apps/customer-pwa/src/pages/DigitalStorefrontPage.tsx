import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Plus, Minus, X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2,
  Clock, AlertCircle, ShoppingCart, MapPin, Wifi, WifiOff,
  Smartphone, Banknote, CreditCard, ArrowLeft, Star, Loader2,
  User, Check, RefreshCw, Flame, Gift, Tag, Copy, Zap,
  Wine, ShieldCheck, ChevronDown, Info, MessageSquare, BellRing,
} from 'lucide-react';
import { ThemeToggleSimple } from '@orderup/ui';

/* ─────────────────────────────────────────────
   API CONFIG
───────────────────────────────────────────── */
const getApiUrl = (path: string): string => {
  const envUrl = import.meta.env?.VITE_API_URL || (import.meta as any).env?.VITE_API_URL;
  let base = envUrl ? envUrl.trim() : 'http://localhost:5000/api/v1';
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (!base.includes('/api/v1')) base = `${base}/api/v1`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Parses and formats Kenyan mobile phone numbers for Daraja M-Pesa STK push.
 * Identifies network operator (Safaricom vs. Airtel vs. Telkom).
 */
const parseKenyanPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('254')) {
    normalized = '0' + digits.slice(3);
  } else if (digits.startsWith('0')) {
    normalized = digits;
  } else if (digits.length > 0) {
    normalized = '0' + digits;
  }

  let carrier: 'Safaricom' | 'Airtel' | 'Telkom' | 'Unknown' = 'Unknown';
  let isSafaricom = false;

  if (normalized.length >= 3) {
    const prefix2 = normalized.slice(0, 3);
    const prefix3 = normalized.slice(0, 4);

    if (
      ['070', '071', '072', '074', '079'].includes(prefix2) ||
      ['0757', '0758', '0759', '0768', '0769'].includes(prefix3) ||
      ['0110', '0111', '0112', '0113', '0114', '0115'].includes(prefix3)
    ) {
      carrier = 'Safaricom';
      isSafaricom = true;
    } else if (
      ['073', '075', '078'].includes(prefix2) ||
      ['0100', '0101', '0102', '0103', '0104', '0105', '0106'].includes(prefix3)
    ) {
      carrier = 'Airtel';
    } else if (['077'].includes(prefix2)) {
      carrier = 'Telkom';
    }
  }

  let formatted = normalized;
  if (normalized.length >= 4) {
    formatted = `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)}`.trim();
  }

  const international = normalized.startsWith('0') && normalized.length === 10
    ? `+254 ${normalized.slice(1, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`
    : raw ? `+254 ${raw.replace(/\D/g, '')}` : '+254 ...';

  return {
    raw,
    normalized,
    formatted,
    international,
    carrier,
    isSafaricom,
    isComplete: normalized.length === 10,
    clean12Digit: normalized.startsWith('0') && normalized.length === 10 ? '254' + normalized.slice(1) : (digits.startsWith('254') ? digits : '254' + digits),
  };
};

/**
 * Synthesizes the authentic Safaricom SIM Toolkit push notification chime
 * using the Web Audio API.
 */
const playSimToolkitChime = () => {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // First tone (900 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(900, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Second tone (1250 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1250, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (_e) {}
};



const resolveImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    if (url.startsWith('http://') && (url.includes('onrender.com') || (typeof window !== 'undefined' && window.location.protocol === 'https:'))) {
      return url.replace('http://', 'https://');
    }
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const envUrl = ((import.meta.env?.VITE_API_URL || (import.meta as any).env?.VITE_API_URL) || '').trim();
  const base = envUrl
    ? envUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '')
    : 'http://localhost:5000';
  return `${base}${cleanPath}`;
};

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface DaySchedule {
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
  crossesMidnight?: boolean;
}

interface BrandingConfig {
  name: string;
  tagline: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primary: string;
  primaryDark: string;
  accent: string;
  openingHours: string;
  closingHours: string;
  operatingSchedule?: Record<string, DaySchedule> | null;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  desc: string;
  img: string | null;
  badge?: string;
  isAvailable: boolean;
}

interface Offer {
  id: string;
  title: string;
  description: string | null;
  promoCode: string | null;
  discountValue?: number;
  offerType?: string;
  badge?: string;
  imageUrl?: string | null;
  originalPrice?: number | null;
  dealPrice?: number | null;
  productId?: string | null;
  isActive?: boolean;
}

type CartMap = Record<string, number>;

const DEFAULT_BRAND: BrandingConfig = {
  name: 'OrderUp Venue',
  tagline: 'Nairobi, Kenya',
  description: null,
  address: null,
  phone: null,
  logoUrl: null,
  bannerUrl: null,
  primary: '#DC2626',
  primaryDark: '#991B1B',
  accent: '#F59E0B',
  openingHours: '14:00',
  closingHours: '04:00',
  operatingSchedule: null,
};

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export const DigitalStorefrontPage: React.FC = () => {
  const { venueSlug, tableNum } = useParams<{ venueSlug?: string; tableNum?: string }>();
  const [searchParams] = useSearchParams();

  // Robust table detection from path param, query param, or session storage
  const table = useMemo(() => {
    const raw =
      tableNum ||
      searchParams.get('table') ||
      searchParams.get('t') ||
      searchParams.get('tableNum') ||
      searchParams.get('table_number') ||
      '';
    if (raw) {
      try {
        sessionStorage.setItem(`orderup_table_${venueSlug || 'venue'}`, raw);
      } catch {}
      return raw;
    }
    try {
      return (
        sessionStorage.getItem(`orderup_table_${venueSlug || 'venue'}`) ||
        sessionStorage.getItem(`drinkhub_table_${venueSlug || 'venue'}`) ||
        ''
      );
    } catch {
      return '';
    }
  }, [tableNum, searchParams, venueSlug]);

  /* ── State ────────────────────────────────── */
  const [brand, setBrand] = useState<BrandingConfig>(DEFAULT_BRAND);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [tableUuid, setTableUuid] = useState<string | null>(null);
  const [clubUuid, setClubUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cat, setCat] = useState<string>('All');

  // ── sessionStorage keys scoped to this venue + table ──
  // Computed once here (not inside useState lazily) so they can be used
  // in the useState initializer closures that run synchronously on mount.
  const CART_KEY   = `orderup_cart_${venueSlug || 'venue'}_${table || '0'}`;
  const SCREEN_KEY = `orderup_screen_${venueSlug || 'venue'}_${table || '0'}`;

  // Cart persisted in sessionStorage — restored on refresh
  const [cart, setCart] = useState<CartMap>(() => {
    try {
      const saved = sessionStorage.getItem(CART_KEY);
      return saved ? (JSON.parse(saved) as CartMap) : {};
    } catch {
      return {};
    }
  });

  // Screen persisted in sessionStorage — restored on refresh
  // 'success' is never restored (order already placed; start fresh next visit)
  const [screen, setScreen] = useState<'menu' | 'cart' | 'checkout' | 'success'>(() => {
    try {
      const saved = sessionStorage.getItem(SCREEN_KEY) as 'menu' | 'cart' | 'checkout' | 'success' | null;
      if (saved && saved !== 'success') return saved;
    } catch {}
    return 'menu';
  });

  // Sync cart → sessionStorage on every change
  // CART_KEY is derived from venueSlug + table which never change during a session
  useEffect(() => {
    try {
      if (Object.keys(cart).length === 0) {
        sessionStorage.removeItem(CART_KEY);
      } else {
        sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
      }
    } catch {}
  }, [cart, CART_KEY]);

  // Sync screen → sessionStorage on every change
  // When the order is placed ('success'), clear both keys so the next visit is clean
  useEffect(() => {
    try {
      if (screen === 'success') {
        sessionStorage.removeItem(SCREEN_KEY);
        sessionStorage.removeItem(CART_KEY);
      } else {
        sessionStorage.setItem(SCREEN_KEY, screen);
      }
    } catch {}
  }, [screen, SCREEN_KEY, CART_KEY]);



  const [payment, setPayment] = useState<'mpesa' | 'card' | 'cash'>('mpesa');
  const [phone, setPhone] = useState(() => {
    try {
      return (
        localStorage.getItem('orderup_customer_phone') ||
        localStorage.getItem('drinkhub_customer_phone') ||
        ''
      );
    } catch {
      return '';
    }
  });
  const phoneInfo = useMemo(() => parseKenyanPhone(phone), [phone]);

  // STK Prompt & Simulation States
  const [isPromptConfirmOpen, setIsPromptConfirmOpen] = useState(false);
  const [stkPromptModal, setStkPromptModal] = useState<{
    isOpen: boolean;
    paymentUuid: string | null;
    isSimulated: boolean;
    countdown: number;
    receiptNumber: string | null;
    status: 'SENDING' | 'WAITING_PIN' | 'PAID' | 'FAILED';
    errorMessage: string | null;
  }>({
    isOpen: false,
    paymentUuid: null,
    isSimulated: false,
    countdown: 60,
    receiptNumber: null,
    status: 'SENDING',
    errorMessage: null,
  });
  const [simulatedPin, setSimulatedPin] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const stkPollTimerRef = useRef<any>(null);

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (stkPollTimerRef.current) clearInterval(stkPollTimerRef.current);
    };
  }, []);
  const [customerNotes, setCustomerNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const heroRef = useRef<HTMLDivElement>(null);
  const menuSectionRef = useRef<HTMLDivElement>(null);
  const [heroOpacity, setHeroOpacity] = useState(1);

  // Offers Banner Carousel
  const [activeOfferIdx, setActiveOfferIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Optional Venue Description & About states
  const [descExpanded, setDescExpanded] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Auto-rotate offers every 5 seconds if multiple offers exist
  useEffect(() => {
    if (offers.length <= 1) return;
    const timer = setInterval(() => {
      setActiveOfferIdx((prev) => (prev + 1) % offers.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [offers.length]);


  // Active Order Live Tracking
  const [activeOrderUuid, setActiveOrderUuid] = useState<string | null>(() => {
    return (
      localStorage.getItem('orderup_active_order_uuid') ||
      localStorage.getItem('drinkhub_active_order_uuid') ||
      null
    );
  });
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  /* ── Live Poll Order Status (every 3s) ── */
  useEffect(() => {
    if (!activeOrderUuid) return;

    let isMounted = true;
    const pollOrderStatus = async () => {
      try {
        const res = await fetch(getApiUrl(`/orders/${activeOrderUuid}`));
        if (!res.ok) return;
        const data = await res.json();
        const order = data.data?.order ?? data.data;
        if (isMounted && order) {
          setActiveOrder(order);

          // Auto-dismiss and return user to menu 5 seconds after delivery confirmation
          if (order.status === 'DELIVERED' || order.status === 'COMPLETED') {
            setTimeout(() => {
              if (isMounted) {
                setActiveOrder(null);
                setActiveOrderUuid(null);
                localStorage.removeItem('orderup_active_order_uuid');
                localStorage.removeItem('drinkhub_active_order_uuid');
                setScreen('menu');
              }
            }, 5000);
          }
        }
      } catch {
        /* keep previous order state */
      }
    };

    pollOrderStatus();
    const interval = setInterval(pollOrderStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeOrderUuid]);

  /* ── Fetch venue & menu on mount ─────────── */
  useEffect(() => {
    if (!venueSlug) {
      setLoadError('No venue specified. Please scan your table QR code again.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // 1. Fetch venue branding
        const tenantRes = await fetch(getApiUrl(`/tenants/${venueSlug}`));
        if (!tenantRes.ok) {
          const err = await tenantRes.json().catch(() => ({}));
          throw new Error(err?.error?.message || `Venue "${venueSlug}" not found.`);
        }
        const tenantData = await tenantRes.json();
        const club = tenantData.data?.club ?? tenantData.data ?? tenantData;
        // Support both local backend (businessUuid) and Render backend (clubUuid)
        const resolvedClubUuid = club.clubUuid ?? club.businessUuid ?? club.uuid ?? club.id ?? null;
        setClubUuid(resolvedClubUuid);

        const fallbackLogo =
          venueSlug.toLowerCase().includes('g-place') || venueSlug.toLowerCase().includes('gplace')
            ? 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=400&auto=format&fit=crop&q=80'
            : venueSlug.toLowerCase().includes('alchemist')
            ? 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&auto=format&fit=crop&q=80'
            : null;

        setBrand({
          name: club.name ?? 'OrderUp Venue',
          tagline: club.tagline ?? club.county ?? 'Kenya',
          description: club.description ?? null,
          address: club.address ?? null,
          phone: club.phone ?? null,
          logoUrl: club.logoUrl || fallbackLogo,
          bannerUrl: club.bannerUrl ?? null,
          primary: club.brandColor ?? club.themeColor ?? '#DC2626',
          primaryDark: adjustColor(club.brandColor ?? club.themeColor ?? '#DC2626', -20),
          accent: '#F59E0B',
          openingHours: club.openingHours ?? '14:00',
          closingHours: club.closingHours ?? '04:00',
          operatingSchedule: club.operatingSchedule ?? null,
        });

        // Resolve table UUID from venueTables/tables array
        const tablesList: any[] = club.venueTables ?? club.tables ?? [];
        let matchedTableUuid: string | null = null;
        if (table && tablesList.length > 0) {
          const match = tablesList.find(
            (t: any) => String(t.tableNumber) === String(table)
          );
          if (match) matchedTableUuid = match.tableUuid ?? match.uuid ?? match.id ?? null;
        }

        if (!matchedTableUuid && table && resolvedClubUuid) {
          try {
            const tablesRes = await fetch(getApiUrl(`/tenants/${resolvedClubUuid}/tables`));
            if (tablesRes.ok) {
              const tablesData = await tablesRes.json();
              const fetchedTables = tablesData.data || [];
              const match = fetchedTables.find(
                (t: any) => String(t.tableNumber) === String(table)
              );
              if (match) matchedTableUuid = match.tableUuid ?? match.uuid ?? match.id ?? null;
            }
          } catch {}
        }
        setTableUuid(matchedTableUuid);

        // 2. Fetch menu with X-Tenant-Id header
        const menuRes = await fetch(getApiUrl('/menu'), {
          headers: {
            ...(resolvedClubUuid ? { 'X-Tenant-Id': resolvedClubUuid } : {}),
          },
        });
        if (!menuRes.ok) throw new Error('Failed to load the menu. Please try again.');
        const menuData = await menuRes.json();

        // Flatten categories + products
        const cats: string[] = ['All'];
        const items: MenuItem[] = [];
        const rawOffers: Offer[] = [];

        const menuPayload = menuData.data ?? menuData;
        const rawCategories: any[] = menuPayload.categories ?? [];
        const rawOfferList: any[] = menuPayload.offers ?? [];

        rawCategories.forEach((cat: any) => {
          if (cat.name && !cats.includes(cat.name)) cats.push(cat.name);
          (cat.products ?? []).forEach((p: any) => {
            items.push({
              id: p.productUuid ?? p.uuid ?? p.id,
              name: p.name,
              category: cat.name,
              price: Number(p.price),
              desc: p.description ?? '',
              img: p.imageUrl ?? null,
              badge: p.badge ?? undefined,
              isAvailable: p.isAvailable !== false,
            });
          });
        });

        rawOfferList.forEach((o: any) => {
          if (o.isActive !== false) {
            let cleanDesc = o.description ?? '';
            let img: string | null = null;
            let badgeText: string | null = null;
            let origPrice: number | null = null;
            let dealPrice: number | null = null;
            let prodId: string | null = null;

            if (o.description && typeof o.description === 'string' && o.description.startsWith('{') && o.description.endsWith('}')) {
              try {
                const parsed = JSON.parse(o.description);
                cleanDesc = parsed.desc ?? '';
                img = parsed.imageUrl ?? null;
                badgeText = parsed.badge ?? null;
                origPrice = parsed.originalPrice ? Number(parsed.originalPrice) : null;
                dealPrice = parsed.dealPrice ? Number(parsed.dealPrice) : null;
                prodId = parsed.productId ?? null;
              } catch {}
            }

            // Fallback: match offer title with menu items to auto-attach item photo & price!
            if (!img || !origPrice) {
              const match = items.find(item =>
                o.title.toLowerCase().includes(item.name.toLowerCase()) ||
                item.name.toLowerCase().includes(o.title.toLowerCase())
              );
              if (match) {
                if (!img) img = match.img;
                if (!origPrice) origPrice = match.price;
                if (!prodId) prodId = match.id;
              }
            }

            // Fallback visuals if no custom image was set
            if (!img) {
              const t = o.title.toLowerCase();
              if (t.includes('whisky') || t.includes('whiskey') || t.includes('scotch') || t.includes('bourbon')) {
                img = 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80';
              } else if (t.includes('cocktail') || t.includes('sour') || t.includes('mojito') || t.includes('margarita')) {
                img = 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80';
              } else if (t.includes('beer') || t.includes('cider') || t.includes('lager') || t.includes('draught')) {
                img = 'https://images.unsplash.com/photo-1608270190989-c5c8297b83d8?w=600&auto=format&fit=crop&q=80';
              } else if (t.includes('wine') || t.includes('champagne') || t.includes('prosecco')) {
                img = 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80';
              } else if (t.includes('grill') || t.includes('rib') || t.includes('burger') || t.includes('meat') || t.includes('wings')) {
                img = 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80';
              } else {
                img = 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80';
              }
            }

            const isBogo = o.offerType === 'BUY_ONE_GET_ONE';
            const isFixed = o.offerType === 'FIXED_AMOUNT_DISCOUNT';
            const discVal = Number(o.discountValue ?? 0);
            const badge = badgeText || (isBogo
              ? '🎁 BUY 1 GET 1'
              : isFixed && discVal > 0
                ? `💰 KES ${discVal.toLocaleString()} OFF`
                : discVal > 0
                  ? `⚡ ${discVal}% OFF`
                  : '🔥 TODAY\'S SPECIAL');

            // Calculate deal price if originalPrice exists
            if (origPrice && !dealPrice) {
              if (isFixed) dealPrice = Math.max(0, origPrice - discVal);
              else if (discVal > 0 && !isBogo) dealPrice = Math.round(origPrice * (1 - discVal / 100));
              else if (isBogo) dealPrice = origPrice;
            }

            rawOffers.push({
              id: o.offerUuid ?? o.uuid ?? o.id,
              title: o.title,
              description: cleanDesc || null,
              promoCode: o.promoCode ?? null,
              discountValue: discVal,
              offerType: o.offerType,
              badge,
              imageUrl: img,
              originalPrice: origPrice,
              dealPrice: dealPrice,
              productId: prodId,
              isActive: o.isActive !== false,
            });
          }
        });

        // Insert '🔥 Deals' tab if there are active offers
        if (rawOffers.length > 0 && !cats.includes('🔥 Deals')) {
          cats.splice(1, 0, '🔥 Deals');
        }

        // Also ensure any offer without an existing product has a menu item so customer can order it
        rawOffers.forEach((o: Offer) => {
          const hasMatch = items.some(
            (it) => it.id === o.productId ||
            it.name.toLowerCase().includes(o.title.toLowerCase()) ||
            o.title.toLowerCase().includes(it.name.toLowerCase())
          );
          if (!hasMatch) {
            items.push({
              id: o.productId || o.id,
              name: o.title,
              category: '🔥 Deals',
              price: o.dealPrice || o.originalPrice || o.discountValue || 1000,
              desc: o.description || 'Special Exclusive Deal',
              img: o.imageUrl ?? null,
              badge: o.badge || 'DEAL',
              isAvailable: true,
            });
          }
        });

        setCategories(cats);
        setMenuItems(items);
        setOffers(rawOffers);
      } catch (err: any) {
        setLoadError(err.message || 'Failed to load menu. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [venueSlug, table]);

  /* ── Inject brand CSS vars ────────────────── */
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--primary', brand.primary);
    r.style.setProperty('--primary-dark', brand.primaryDark);
    r.style.setProperty('--accent', brand.accent);
  }, [brand]);

  /* ── Compute venue open/closed from operating hours ── */
  const isVenueOpen = useCallback((): boolean => {
    try {
      const now = new Date();
      const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayIndex = now.getDay();
      const todayKey = DAY_KEYS[todayIndex];
      const yesterdayIndex = (todayIndex + 6) % 7;
      const yesterdayKey = DAY_KEYS[yesterdayIndex];

      const nowMins = now.getHours() * 60 + now.getMinutes();

      // 1. Prefer per-day operatingSchedule set in admin
      const schedule = brand.operatingSchedule;
      if (schedule) {
        // A. Check if yesterday had an overnight shift that is still open right now (e.g. closes at 02:00, now is 01:15)
        const yesterdayConfig = schedule[yesterdayKey];
        if (yesterdayConfig && yesterdayConfig.isOpen && yesterdayConfig.openingTime && yesterdayConfig.closingTime) {
          const [yOh, yOm] = yesterdayConfig.openingTime.split(':').map(Number);
          const [yCh, yCm] = yesterdayConfig.closingTime.split(':').map(Number);
          const yOpenMins = yOh * 60 + yOm;
          const yCloseMins = yCh * 60 + yCm;
          // If yesterday crossed midnight (closingTime <= openingTime) and now is before closing:
          if (yCloseMins <= yOpenMins && nowMins < yCloseMins) {
            return true;
          }
        }

        // B. Check today's schedule
        const dayConfig = schedule[todayKey];
        if (dayConfig) {
          if (!dayConfig.isOpen) return false;
          const [oH, oM] = (dayConfig.openingTime || '00:00').split(':').map(Number);
          const [cH, cM] = (dayConfig.closingTime || '23:59').split(':').map(Number);
          const openMins = oH * 60 + oM;
          const closeMins = cH * 60 + cM;
          // Handle overnight (e.g. 08:00 – 01:00 closes next day)
          if (closeMins <= openMins) {
            return nowMins >= openMins || nowMins < closeMins;
          }
          return nowMins >= openMins && nowMins < closeMins;
        }
      }

      // 2. Fallback: legacy global openingHours / closingHours
      const oh = brand.openingHours || '00:00';
      const ch = brand.closingHours || '23:59';
      const [oH, oM] = oh.split(':').map(Number);
      const [cH, cM] = ch.split(':').map(Number);
      const openMins = oH * 60 + oM;
      const closeMins = cH * 60 + cM;
      if (closeMins <= openMins) {
        return nowMins >= openMins || nowMins < closeMins;
      }
      return nowMins >= openMins && nowMins < closeMins;
    } catch {
      return true;
    }
  }, [brand.openingHours, brand.closingHours, brand.operatingSchedule]);

  const venueOpen = isVenueOpen();

  /* ── Compute active hours text for today ── */
  const todayHours = useMemo(() => {
    try {
      const now = new Date();
      const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayKey = DAY_KEYS[now.getDay()];
      const schedule = brand.operatingSchedule;
      if (schedule && schedule[todayKey]) {
        const d = schedule[todayKey];
        if (!d.isOpen) {
          return {
            open: d.openingTime || '08:00',
            close: d.closingTime || '23:00',
            displayText: 'Closed Today',
          };
        }
        return {
          open: d.openingTime || '08:00',
          close: d.closingTime || '23:00',
          displayText: `${d.openingTime || '08:00'} to ${d.closingTime || '23:00'}`,
        };
      }
    } catch {}
    return {
      open: brand.openingHours || '08:00',
      close: brand.closingHours || '23:00',
      displayText: `${brand.openingHours || '08:00'} to ${brand.closingHours || '23:00'}`,
    };
  }, [brand.operatingSchedule, brand.openingHours, brand.closingHours]);

  /* ── Offer Matcher & Item Pricing Helper ──── */
  const getOfferForItem = useCallback((item: MenuItem): Offer | null => {
    if (!offers || offers.length === 0) return null;
    // 1. Direct productId match
    const directMatch = offers.find(o => o.productId === item.id || o.id === item.id);
    if (directMatch) return directMatch;

    // 2. Name / title match
    const itName = item.name.toLowerCase().trim();
    const nameMatch = offers.find(o => {
      const offTitle = o.title.toLowerCase().trim();
      return offTitle.includes(itName) || itName.includes(offTitle);
    });
    if (nameMatch) return nameMatch;

    return null;
  }, [offers]);

  const getItemPricing = useCallback((item: MenuItem, quantity: number = 1) => {
    const offer = getOfferForItem(item);
    if (!offer) {
      return {
        originalPrice: item.price,
        unitPrice: item.price,
        totalPrice: item.price * quantity,
        discountAmount: 0,
        offer: null,
        isBogo: false,
      };
    }

    const isBogo = offer.offerType === 'BUY_ONE_GET_ONE';
    const isFixed = offer.offerType === 'FIXED_AMOUNT_DISCOUNT';
    const discVal = Number(offer.discountValue || 0);

    let unitPrice = item.price;
    let totalPrice = item.price * quantity;
    let discountAmount = 0;

    if (isBogo) {
      // Buy 1 Get 1 Free: customer pays for ceil(quantity / 2)
      const billableQty = Math.ceil(quantity / 2);
      totalPrice = item.price * billableQty;
      discountAmount = (item.price * quantity) - totalPrice;
      unitPrice = quantity > 1 ? Math.round(totalPrice / quantity) : item.price;
    } else if (isFixed && discVal > 0) {
      unitPrice = Math.max(0, item.price - discVal);
      totalPrice = unitPrice * quantity;
      discountAmount = (item.price - unitPrice) * quantity;
    } else if (discVal > 0) {
      unitPrice = Math.round(item.price * (1 - discVal / 100));
      totalPrice = unitPrice * quantity;
      discountAmount = (item.price - unitPrice) * quantity;
    }

    return {
      originalPrice: item.price,
      unitPrice,
      totalPrice,
      discountAmount,
      offer,
      isBogo,
    };
  }, [getOfferForItem]);

  /* ── Cart helpers ─────────────────────────── */
  const filtered = cat === 'All'
    ? menuItems
    : cat === '🔥 Deals' || cat === 'Offers' || cat === 'Deals'
      ? menuItems.filter((m) => getOfferForItem(m) !== null || m.category === '🔥 Deals')
      : menuItems.filter((m) => m.category === cat);
  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);

  const cartCalculations = Object.entries(cart).map(([id, qty]) => {
    const item = menuItems.find((m) => m.id === id);
    if (!item) return null;
    const pricing = getItemPricing(item, qty);
    return {
      item,
      qty,
      ...pricing,
    };
  }).filter(Boolean) as {
    item: MenuItem;
    qty: number;
    originalPrice: number;
    unitPrice: number;
    totalPrice: number;
    discountAmount: number;
    offer: Offer | null;
    isBogo: boolean;
  }[];

  const cartSubtotal = cartCalculations.reduce((s, c) => s + (c.originalPrice * c.qty), 0);
  const cartTotalDiscount = cartCalculations.reduce((s, c) => s + c.discountAmount, 0);
  const cartFinalTotal = Math.max(0, cartSubtotal - cartTotalDiscount);
  const appliedOffer = cartCalculations.find(c => c.offer)?.offer ?? null;

  const add = (id: string) => setCart((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));
  const dec = (id: string) => setCart((p) => {
    if ((p[id] ?? 0) <= 1) { const c = { ...p }; delete c[id]; return c; }
    return { ...p, [id]: p[id] - 1 };
  });

  /* ── Place order & STK push initiation ───────────────── */
  const handleInitiateOrder = () => {
    if (!isOnline) return;
    setPlaceError(null);

    if (payment === 'mpesa') {
      if (!phoneInfo.isComplete) {
        setPlaceError('Please enter a valid 10-digit Safaricom phone number (e.g. 0712 345 678).');
        return;
      }
      if (!phoneInfo.isSafaricom) {
        setPlaceError('M-Pesa STK Push requires a Safaricom number (070, 071, 072, 074, 079, 0110-0115). For Airtel or Telkom, please select Cash or Card.');
        return;
      }
      // Play authentic SIM Toolkit notification chime & trigger mobile vibration
      playSimToolkitChime();
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {}

      // Prompt customer immediately
      executePlaceOrder();
    } else {
      executePlaceOrder();
    }
  };

  const executePlaceOrder = async () => {
    if (!isOnline) return;
    setPlacing(true);
    setPlaceError(null);
    setIsPromptConfirmOpen(false);

    // Play SIM toolkit chime if M-Pesa
    if (payment === 'mpesa') {
      playSimToolkitChime();
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {}
    }

    try {
      const items = Object.entries(cart).map(([productUuid, quantity]) => ({ productUuid, quantity }));
      
      const formattedPhone = phoneInfo.clean12Digit ? `+${phoneInfo.clean12Digit}` : undefined;
      const parsedTableNum = table ? parseInt(String(table).replace(/[^0-9]/g, ''), 10) : undefined;
      const resolvedPaymentMethod = payment === 'cash' ? 'CASH' : payment === 'card' ? 'CARD' : 'MPESA_STK';

      const body: Record<string, any> = {
        ...(clubUuid ? { clubUuid } : {}),
        ageVerified: true,
        items,
        paymentMethod: resolvedPaymentMethod,
      };
      if (tableUuid) body.tableUuid = tableUuid;
      if (table) {
        body.table = table;
        if (parsedTableNum && !isNaN(parsedTableNum)) {
          body.tableNumber = parsedTableNum;
        }
      }

      // Include customer's additional instructions alongside table & payment
      const trimmedNotes = customerNotes.trim();
      const metaParts: string[] = [];
      if (table) metaParts.push(`Table #${table}`);
      metaParts.push(`Payment: ${resolvedPaymentMethod}`);
      if (trimmedNotes) metaParts.push(`Note: ${trimmedNotes}`);
      body.notes = metaParts.join(' | ');

      if (formattedPhone) body.phoneNumber = formattedPhone;
      if (appliedOffer) body.offerUuid = appliedOffer.id;

      // 1. Create order
      const res = await fetch(getApiUrl('/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clubUuid ? { 'X-Tenant-Id': clubUuid } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to place order.');
      
      const placedOrder = data.data?.order ?? data.data;
      const resolvedUuid = placedOrder.orderUuid ?? placedOrder.uuid ?? placedOrder.id;
      setActiveOrderUuid(resolvedUuid);
      setActiveOrder(placedOrder);
      localStorage.setItem('orderup_active_order_uuid', resolvedUuid);

      // 2. If M-Pesa STK Push selected, trigger Daraja STK Push & show prompt modal
      if (payment === 'mpesa') {
        try {
          localStorage.setItem('orderup_customer_phone', phone);
        } catch {}

        setStkPromptModal({
          isOpen: true,
          paymentUuid: null,
          isSimulated: false,
          countdown: 60,
          receiptNumber: null,
          status: 'SENDING',
          errorMessage: null,
        });

        try {
          const stkRes = await fetch(getApiUrl('/payments/mpesa/stkpush'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(clubUuid ? { 'X-Tenant-Id': clubUuid } : {}),
            },
            body: JSON.stringify({
              clubUuid: clubUuid || undefined,
              businessUuid: clubUuid || undefined,
              orderUuid: resolvedUuid,
              phoneNumber: phoneInfo.clean12Digit,
              amount: cartFinalTotal,
              accountReference: `TBL-${table || '1'}`,
            }),
          });
          const stkData = await stkRes.json();

          if (!stkRes.ok || !stkData.success) {
            const errorMsg =
              stkData?.error?.message ||
              stkData?.message ||
              'Failed to dispatch M-Pesa prompt. Please verify your phone number and try again.';
            setStkPromptModal((prev) => ({
              ...prev,
              status: 'FAILED',
              errorMessage: errorMsg,
            }));
            return;
          }

          const paymentUuid = stkData?.data?.paymentUuid;
          const isSimulated = stkData?.data?.isSimulated ?? false;

          setStkPromptModal((prev) => ({
            ...prev,
            paymentUuid,
            isSimulated,
            status: 'WAITING_PIN',
          }));

          // Start polling status
          if (paymentUuid) {
            let elapsed = 0;
            if (stkPollTimerRef.current) clearInterval(stkPollTimerRef.current);
            stkPollTimerRef.current = setInterval(async () => {
              elapsed += 2.5;
              setStkPromptModal((prev) => ({
                ...prev,
                countdown: Math.max(0, 60 - Math.floor(elapsed)),
              }));

              try {
                const pollRes = await fetch(getApiUrl(`/payments/${paymentUuid}/status`));
                const pollData = await pollRes.json();
                if (pollData?.data?.paymentStatus === 'PAID') {
                  clearInterval(stkPollTimerRef.current);
                  setStkPromptModal((prev) => ({
                    ...prev,
                    status: 'PAID',
                    receiptNumber: pollData.data.mpesaReceiptNumber || 'CONFIRMED',
                  }));
                  setTimeout(() => {
                    setStkPromptModal((prev) => ({ ...prev, isOpen: false }));
                    setCart({});
                    setCustomerNotes('');
                    setScreen('success');
                  }, 2000);
                } else if (pollData?.data?.paymentStatus === 'FAILED') {
                  clearInterval(stkPollTimerRef.current);
                  setStkPromptModal((prev) => ({
                    ...prev,
                    status: 'FAILED',
                    errorMessage: 'Transaction was cancelled or declined on phone.',
                  }));
                }
              } catch {}

              if (elapsed >= 60) {
                clearInterval(stkPollTimerRef.current);
                setStkPromptModal((prev) => ({
                  ...prev,
                  countdown: 0,
                  errorMessage: 'Prompt timed out. If you entered your PIN, confirmation will update shortly.',
                }));
              }
            }, 2500);
          }
        } catch (stkErr: any) {
          console.warn('STK Push dispatch error:', stkErr);
          setStkPromptModal((prev) => ({
            ...prev,
            status: 'FAILED',
            errorMessage: stkErr.message || 'Unable to connect to M-Pesa payment service.',
          }));
        }
      } else {
        setCart({});
        setCustomerNotes('');
        setScreen('success');
      }
    } catch (err: any) {
      setPlaceError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const handleSimulatePinSubmit = async () => {
    if (!stkPromptModal.paymentUuid) {
      setStkPromptModal((prev) => ({
        ...prev,
        status: 'PAID',
        receiptNumber: 'QA' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      }));
      if (stkPollTimerRef.current) clearInterval(stkPollTimerRef.current);
      setTimeout(() => {
        setStkPromptModal((prev) => ({ ...prev, isOpen: false }));
        setCart({});
        setCustomerNotes('');
        setScreen('success');
      }, 1800);
      return;
    }

    setIsSubmittingPin(true);
    try {
      const res = await fetch(getApiUrl(`/payments/${stkPromptModal.paymentUuid}/simulate-success`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: simulatedPin || '1234' }),
      });
      const data = await res.json();
      if (res.ok) {
        if (stkPollTimerRef.current) clearInterval(stkPollTimerRef.current);
        setStkPromptModal((prev) => ({
          ...prev,
          status: 'PAID',
          receiptNumber: data?.data?.mpesaReceiptNumber || 'SIMULATED',
        }));
        setTimeout(() => {
          setStkPromptModal((prev) => ({ ...prev, isOpen: false }));
          setCart({});
          setCustomerNotes('');
          setScreen('success');
        }, 1800);
      }
    } catch (e) {
      console.warn('Simulation submit error:', e);
    } finally {
      setIsSubmittingPin(false);
    }
  };

  /* ────── OFFLINE GUARD ────── */
  if (!isOnline) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-8 text-center" style={{ background: 'var(--bg)' }}>
        <WifiOff className="w-14 h-14 opacity-40" />
        <div>
          <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>No Internet Connection</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Please connect to Wi-Fi or mobile data to browse the menu and place orders.</p>
        </div>
      </div>
    );
  }

  /* ────── LOADING STATE ────── */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--primary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading menu…</p>
      </div>
    );
  }

  /* ────── LOAD ERROR STATE ────── */
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-8 text-center" style={{ background: 'var(--bg)' }}>
        <AlertCircle className="w-14 h-14 text-red-400" />
        <div>
          <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>Unable to Load Menu</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{loadError}</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-primary px-6 py-3 text-sm font-bold" style={{ background: 'var(--primary)' }}>
          Try Again
        </button>
      </div>
    );
  }

  /* ────── SUCCESS / LIVE ORDER STATUS SCREEN ────── */
  if (screen === 'success') {
    const currentStatus = activeOrder?.status || 'PENDING';
    const stepIndex = 
      currentStatus === 'CLAIMED' ? 1 :
      currentStatus === 'PREPARING' ? 2 :
      currentStatus === 'READY' ? 3 :
      (currentStatus === 'DELIVERED' || currentStatus === 'COMPLETED') ? 4 : 0;

    const orderItemsList = activeOrder?.orderItems ?? [];
    const displayTable = activeOrder?.table?.tableNumber ?? table;

    return (
      <div className="h-screen overflow-y-auto flex flex-col justify-between py-6 px-4 fade-up" style={{ background: 'var(--bg)', scrollbarWidth: 'thin' }}>
        <div className="max-w-md mx-auto w-full space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setScreen('menu')}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Menu
            </button>
            <div className="flex items-center gap-2">
              {brand.logoUrl && (
                <img src={resolveImageUrl(brand.logoUrl)} alt={brand.name} className="h-6 w-6 rounded-lg object-cover border border-white/10" />
              )}
              <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{brand.name}</span>
              <ThemeToggleSimple />
            </div>
          </div>

          {/* ── 4-STEP TRACKER CARD (Exact Image Design) ── */}
          <div className="card p-6 rounded-2xl border space-y-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            
            {/* Status Pulse Banner */}
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                {currentStatus === 'PENDING' ? 'Order Placed · Awaiting Waiter' :
                 currentStatus === 'CLAIMED' ? 'Order Claimed by Waiter' :
                 currentStatus === 'PREPARING' ? 'Drinks & Food In Preparation' :
                 currentStatus === 'READY' ? 'Order Ready for Delivery' :
                 'Order Delivered · Cheers! 🥂'}
              </div>
              <h2 className="text-xl font-black" style={{ color: 'var(--text)' }}>
                {activeOrder?.orderNumber ? `Order #${activeOrder.orderNumber}` : 'Order Status'}
              </h2>
              {displayTable && (
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Table #{displayTable}
                </p>
              )}
            </div>

            {/* ── Exact 4-Step Stepper Component from Uploaded Image ── */}
            <div className="py-4 px-2">
              <div className="flex items-center justify-between relative">
                {/* Background Line */}
                <div className="absolute top-[22px] left-6 right-6 h-0.5 -translate-y-1/2 bg-slate-700/60 -z-0" />
                
                {/* Active Progress Fill Line */}
                <div 
                  className="absolute top-[22px] left-6 h-0.5 -translate-y-1/2 bg-blue-600 transition-all duration-700 -z-0"
                  style={{
                    width: stepIndex <= 1 ? '0%' : stepIndex === 2 ? '33%' : stepIndex === 3 ? '66%' : 'calc(100% - 48px)',
                  }}
                />

                {[
                  { num: 1, label: 'CLAIMED' },
                  { num: 2, label: 'PREPARING' },
                  { num: 3, label: 'READY' },
                  { num: 4, label: 'DELIVERED' },
                ].map(({ num, label }) => {
                  const isReached = stepIndex >= num;
                  const isCurrent = stepIndex === num;

                  return (
                    <div key={num} className="flex flex-col items-center gap-2 z-10">
                      <div
                        className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                          isReached
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                            : 'bg-slate-800 border-2 border-slate-700 text-slate-400'
                        } ${isCurrent ? 'ring-4 ring-blue-500/30 scale-105' : ''}`}
                      >
                        {num}
                      </div>
                      <span
                        className={`text-[10px] font-black tracking-wider transition-colors uppercase ${
                          isReached ? 'text-blue-500' : 'text-slate-500'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Waiter Info if assigned */}
            {activeOrder?.waiter && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-blue-500/5 border-blue-500/20 text-left">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Assigned Waiter</p>
                  <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>{activeOrder.waiter.fullName}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Order Summary Card ── */}
          <div className="card p-5 text-left space-y-3 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ordered Items</p>

            {/* Applied offer banner on receipt */}
            {activeOrder?.offer && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(251,191,36,0.12)', color: '#F59E0B', border: '1px solid rgba(251,191,36,0.3)' }}>
                <Flame className="w-3.5 h-3.5 flex-shrink-0" />
                Deal Applied: {activeOrder.offer.title}
              </div>
            )}

            <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1" style={{ scrollbarWidth: 'thin' }}>
              {orderItemsList.length > 0 ? (
                orderItemsList.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {item.quantity}× {item.product?.name ?? item.name ?? 'Drink / Food Item'}
                    </span>
                    <span className="font-bold" style={{ color: 'var(--text)' }}>
                      KES {Number(item.subtotal ?? (item.unitPrice ? item.unitPrice * item.quantity : 0)).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                Object.entries(cart).map(([id, qty]) => {
                  const item = menuItems.find((m) => m.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex justify-between items-center text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>{qty}× {item.name}</span>
                      <span className="font-bold" style={{ color: 'var(--text)' }}>KES {(item.price * qty).toLocaleString()}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Discount row on receipt */}
            {Number(activeOrder?.discountAmount) > 0 && (
              <div className="flex justify-between items-center text-sm border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                <span className="font-bold text-emerald-400">Discount Applied</span>
                <span className="font-black text-emerald-400">-KES {Number(activeOrder.discountAmount).toLocaleString()}</span>
              </div>
            )}

            {/* Confirmed instructions / notes */}
            {(() => {
              const rawNotes = activeOrder?.notes || '';
              const customerInstruction = rawNotes.includes('Note: ')
                ? rawNotes.split('Note: ')[1]
                : (!rawNotes.includes('Table #') && !rawNotes.startsWith('Payment: '))
                  ? rawNotes
                  : null;
              if (!customerInstruction) return null;
              return (
                <div className="pt-2.5 border-t text-xs space-y-1" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                    <MessageSquare className="w-3 h-3" />
                    <span>Special Instructions</span>
                  </div>
                  <p className="font-medium italic" style={{ color: 'var(--text-secondary)' }}>
                    "{customerInstruction}"
                  </p>
                </div>
              );
            })()}

            <div className="flex justify-between pt-3 border-t font-bold" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text)' }}>Total Amount</span>
              <span className="text-base font-black" style={{ color: brand.accent }}>
                KES {Number(activeOrder?.totalAmount ?? cartFinalTotal).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => setScreen('menu')}
              className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: brand.primary }}
            >
              <Plus className="w-4 h-4" /> Browse Menu / Order More
            </button>
            {stepIndex === 4 && (
              <button
                onClick={() => {
                  localStorage.removeItem('orderup_active_order_uuid');
                  localStorage.removeItem('drinkhub_active_order_uuid');
                  setActiveOrderUuid(null);
                  setActiveOrder(null);
                  setScreen('menu');
                }}
                className="w-full py-3 text-xs font-semibold rounded-xl border text-slate-300 hover:bg-slate-800 transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                Start a New Order
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  /* ────── CHECKOUT SCREEN ────── */
  if (screen === 'checkout') {
    return (
      <div className="h-screen overflow-y-auto flex flex-col" style={{ background: 'var(--bg)', scrollbarWidth: 'thin' }}>
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('cart')} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface)' }}>
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text)' }} />
            </button>
            <div>
              <h2 className="font-black text-base leading-none" style={{ color: 'var(--text)' }}>Checkout</h2>
              {table && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Table #{table}</p>}
            </div>
          </div>
          <ThemeToggleSimple />
        </div>

        <div className="max-w-md mx-auto w-full px-4 py-6 space-y-5 pb-36 flex-1">
          {/* Payment method */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'mpesa', label: 'M-Pesa', icon: <Smartphone className="w-5 h-5" /> },
                { key: 'card', label: 'Card', icon: <CreditCard className="w-5 h-5" /> },
                { key: 'cash', label: 'Cash', icon: <Banknote className="w-5 h-5" /> },
              ] as const).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setPayment(key)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all"
                  style={{
                    background: payment === key ? `${brand.primary}15` : 'var(--surface)',
                    borderColor: payment === key ? brand.primary : 'var(--border)',
                    color: payment === key ? brand.primary : 'var(--text-secondary)',
                  }}
                >
                  {icon}
                  <span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* M-Pesa phone */}
          {payment === 'mpesa' && (
            <div className="space-y-3 rounded-2xl border p-4 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Safaricom M-Pesa Number
                </p>
                {phoneInfo.isComplete && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      phoneInfo.isSafaricom
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        phoneInfo.isSafaricom ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                      }`}
                    />
                    {phoneInfo.carrier} Line
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:border-emerald-500" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-slate-400">+254</span>
                </div>
                <input
                  type="tel"
                  placeholder="0712 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-mono outline-none placeholder:opacity-40"
                  style={{ color: 'var(--text)' }}
                />
              </div>

              {/* LIVE PHONE PROMPT CARD AS NUMBER IS INPUTTED */}
              {phoneInfo.isComplete ? (
                <div className="rounded-xl border p-3.5 space-y-2.5 shadow-md animate-in fade-in slide-in-from-top-1 duration-200" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.35)' }}>
                  <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                    <div className="flex items-center space-x-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-black text-emerald-400">Phone Prompt Ready</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-300">
                      {phoneInfo.international}
                    </span>
                  </div>

                  {/* Interactive SIM Toolkit Prompt Simulation Preview */}
                  <div className="rounded-lg p-2.5 space-y-1.5 text-left border" style={{ background: 'var(--surface)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <BellRing className="h-3 w-3 animate-pulse" /> SIM Toolkit Notification
                      </span>
                      <span>Safaricom STK</span>
                    </div>
                    <p className="text-xs leading-snug" style={{ color: 'var(--text)' }}>
                      &ldquo;Do you want to pay <span className="font-extrabold text-white">KES {cartFinalTotal.toLocaleString()}</span> to <span className="font-bold text-emerald-400">{brand.name}</span>?&rdquo;
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t text-[10px]" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-slate-400">Account: <span className="font-mono text-white">TBL-{table || '1'}</span></span>
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Enter PIN: ••••
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={executePlaceOrder}
                    disabled={placing}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    {placing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending STK Prompt…</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="w-4 h-4 animate-pulse" />
                        <span>Send M-Pesa Prompt to {phoneInfo.formatted}</span>
                      </>
                    )}
                  </button>
                </div>

              ) : phone.length > 0 ? (
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                  <span>Enter a 10-digit Safaricom number (e.g. 0712 345 678 or 0110 123 456).</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                  <span>A SIM Toolkit PIN prompt will pop up on your phone screen to complete payment.</span>
                </p>
              )}
            </div>
          )}

          {payment === 'card' && (
            <div className="rounded-2xl border p-4 space-y-1" style={{ background: 'var(--surface)', borderColor: 'rgba(251,191,36,0.3)' }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm font-bold text-amber-400">POS Machine Required</p>
              </div>
              <p className="text-xs pl-6" style={{ color: 'var(--text-secondary)' }}>
                {table ? `Your waiter will bring the POS terminal to Table #${table}.` : 'Your waiter will bring the POS terminal to you.'}
              </p>
            </div>
          )}

          {/* ── Additional Information / Instructions Description Box ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span>Additional Information / Instructions</span>
              </label>
              <span className="text-[10px] font-semibold text-slate-400">Optional</span>
            </div>
            <div
              className="rounded-2xl border transition-all focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Specify any special requests, dietary needs, table location, or delivery instructions..."
                rows={3}
                maxLength={300}
                className="w-full bg-transparent p-3.5 text-xs outline-none resize-none placeholder:opacity-40"
                style={{ color: 'var(--text)' }}
              />
              <div className="flex justify-between items-center px-3.5 py-1.5 border-t text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <span>Passed directly to your server & bartender</span>
                <span>{customerNotes.length}/300</span>
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div className="card p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Order Summary</p>

            {/* Active offer banner in checkout */}
            {appliedOffer && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(251,191,36,0.12)', color: '#F59E0B', border: '1px solid rgba(251,191,36,0.3)' }}>
                <Flame className="w-3.5 h-3.5 flex-shrink-0" />
                {appliedOffer.badge || appliedOffer.title} — Deal Active!
              </div>
            )}

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin' }}>
              {cartCalculations.map((c) => (
                <div key={c.item.id} className="space-y-0.5">
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{c.qty}× {c.item.name}</span>
                    <div className="text-right">
                      {c.discountAmount > 0 && (
                        <span className="text-xs line-through block" style={{ color: 'var(--text-muted)' }}>KES {(c.originalPrice * c.qty).toLocaleString()}</span>
                      )}
                      <span className="font-bold" style={{ color: c.discountAmount > 0 ? '#F59E0B' : 'var(--text)' }}>KES {c.totalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                  {c.offer && (
                    <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#34D399' }}>
                      <Tag className="w-2.5 h-2.5" />
                      {c.isBogo ? 'Buy 1 Get 1 Free' : c.offer.badge || c.offer.title}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {cartTotalDiscount > 0 && (
              <div className="flex justify-between items-center text-sm border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                <span className="font-bold text-emerald-400">🎉 You're saving</span>
                <span className="font-black text-emerald-400">-KES {cartTotalDiscount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between pt-3 border-t font-bold" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text)' }}>Total</span>
              <span style={{ color: brand.accent }}>KES {cartFinalTotal.toLocaleString()}</span>
            </div>
          </div>

          {placeError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {placeError}
            </div>
          )}

          {!venueOpen && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold mb-1" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
              🔒 <span>{brand.name} is currently closed. Opens at {todayHours.open}.</span>
            </div>
          )}

          <button
            disabled={placing || !venueOpen || (payment === 'mpesa' && !phoneInfo.isComplete)}
            onClick={handleInitiateOrder}
            className="btn-primary w-full py-4 text-sm font-black flex items-center justify-center gap-2 text-white shadow-lg transition-all"
            style={{ background: venueOpen ? (payment === 'mpesa' ? '#10B981' : brand.primary) : undefined }}
          >
            {placing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Order…</span>
              </span>
            ) : !venueOpen ? (
              <>🔒 Closed · Opens at {todayHours.open}</>
            ) : payment === 'mpesa' ? (
              <>
                <BellRing className="w-4 h-4 animate-pulse" />
                <span>Send M-Pesa Prompt · KES {cartFinalTotal.toLocaleString()}</span>
              </>
            ) : (
              <>Confirm Order · KES {cartFinalTotal.toLocaleString()}</>
            )}
          </button>

          {/* ── PRE-FLIGHT M-PESA CONFIRMATION PROMPT MODAL ── */}
          {isPromptConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
              <div
                className="w-full max-w-sm rounded-3xl p-6 space-y-5 border shadow-2xl text-center animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--surface)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
              >
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <Smartphone className="w-8 h-8 animate-bounce" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-black" style={{ color: 'var(--text)' }}>Confirm M-Pesa Prompt</h3>
                  <p className="text-xs text-slate-300">
                    We will send an immediate SIM Toolkit push prompt of:
                  </p>
                  <div className="text-2xl font-black text-emerald-400 py-0.5">
                    KES {cartFinalTotal.toLocaleString()}
                  </div>
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-xl border text-xs font-mono font-bold" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{phoneInfo.international}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-[11px] text-slate-300 text-left space-y-1.5">
                  <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> What happens next:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
                    <li>Your phone screen will wake up with an M-Pesa prompt</li>
                    <li>Enter your 4-digit Safaricom M-Pesa PIN</li>
                    <li>Payment will confirm automatically on this screen</li>
                  </ol>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={executePlaceOrder}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <BellRing className="w-4 h-4" />
                    <span>Send M-Pesa Prompt Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPromptConfirmOpen(false)}
                    className="text-xs text-slate-400 hover:text-white py-1 block w-full transition"
                  >
                    Change Phone Number
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── ACTIVE M-PESA STK WAITING & PIN PROMPT SIMULATOR MODAL ── */}
          {stkPromptModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div
                className="w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl text-left animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
                style={{ background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {stkPromptModal.status === 'SENDING' && (
                  <div className="space-y-4 py-4">
                    <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto" />
                    <h3 className="text-base font-black" style={{ color: 'var(--text)' }}>Contacting Safaricom Gateway</h3>
                    <p className="text-xs text-slate-400">Dispatching STK prompt to your phone...</p>
                  </div>
                )}

                {stkPromptModal.status === 'WAITING_PIN' && (
                  <div className="space-y-4">
                    {/* Progress header — mirrors Cellulant/Safaricom STK screen */}
                    <div className="space-y-2 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-emerald-400">Details submitted</span>
                      </div>
                      <div className="ml-3.5 border-l-2 border-dashed border-slate-600 h-4" />
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full border-2 border-slate-500 flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                        </div>
                        <span className="text-sm text-slate-400">Waiting for confirmation</span>
                      </div>
                    </div>

                    {!stkPromptModal.isSimulated ? (
                      /* ── Live Daraja Production Phone Prompt ── */
                      <div
                        className="rounded-2xl p-5 space-y-4 text-center"
                        style={{ background: '#1c1c1c' }}
                      >
                        <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 mx-auto flex items-center justify-center">
                          <Smartphone className="w-7 h-7 animate-pulse" />
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-white">M-Pesa Prompt Sent!</h4>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            Please check your phone screen for the prompt from Safaricom and enter your <strong className="text-white">M-Pesa PIN</strong> to authorize payment.
                          </p>
                        </div>

                        <div className="rounded-xl bg-white/5 p-3 text-xs space-y-1">
                          <div className="flex justify-between text-slate-400">
                            <span>Amount:</span>
                            <span className="font-bold text-white">
                              KES {cartFinalTotal.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Phone:</span>
                            <span className="font-mono text-emerald-400">{phoneInfo.international}</span>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (stkPollTimerRef.current) clearInterval(stkPollTimerRef.current);
                              setStkPromptModal((prev) => ({ ...prev, isOpen: false }));
                            }}
                            className="text-slate-400 hover:text-white transition underline"
                          >
                            Cancel Payment
                          </button>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Expires in {stkPromptModal.countdown}s
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* ── Simulated Sandbox Fallback Dialog ── */
                      <div
                        className="rounded-2xl p-5 space-y-5 text-left"
                        style={{ background: '#1c1c1c' }}
                      >
                        <div className="flex items-center justify-between text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                          <span>🧪 Sandbox / Simulated Mode</span>
                          <span>Test PIN Prompt</span>
                        </div>

                        <p className="text-base text-white leading-relaxed">
                          Do you want to pay{' '}
                          <span className="font-semibold">
                            Kshs. {cartFinalTotal.toLocaleString('en-KE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </span>{' '}
                          to{' '}
                          <span className="font-semibold">{brand.name}</span>
                          {' '}Account no.{' '}
                          <span className="font-semibold">{brand.name}</span>?
                        </p>

                        <div className="space-y-1.5">
                          <p className="text-base text-white">Enter M-PESA PIN:</p>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            autoFocus
                            placeholder=""
                            value={simulatedPin}
                            onChange={(e) => setSimulatedPin(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-transparent text-white text-lg tracking-[0.5em] outline-none py-1"
                            style={{ borderBottom: '2px solid #ffffff' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && simulatedPin.length >= 4) handleSimulatePinSubmit();
                            }}
                          />
                        </div>

                        {/* Cancel | Send */}
                        <div
                          className="flex items-center"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '0.75rem' }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (stkPollTimerRef.current) clearInterval(stkPollTimerRef.current);
                              setStkPromptModal((prev) => ({ ...prev, isOpen: false }));
                            }}
                            className="flex-1 text-center text-base font-semibold text-white py-1 opacity-80 hover:opacity-100 transition"
                          >
                            Cancel
                          </button>
                          <div style={{ width: '1px', background: 'rgba(255,255,255,0.15)', height: '20px' }} />
                          <button
                            type="button"
                            onClick={handleSimulatePinSubmit}
                            disabled={isSubmittingPin}
                            className="flex-1 text-center text-base font-bold text-white py-1 flex items-center justify-center gap-1.5 transition"
                          >
                            {isSubmittingPin ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Send'
                            )}
                          </button>
                        </div>

                        {/* Countdown pill */}
                        <p className="text-center text-[11px] text-slate-500 -mt-2">
                          Prompt expires in {stkPromptModal.countdown}s · {phoneInfo.international}
                        </p>
                      </div>
                    )}
                  </div>
                )}


                {stkPromptModal.status === 'PAID' && (
                  <div className="space-y-4 py-4">
                    <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 shadow-xl animate-bounce">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-emerald-400">Payment Confirmed!</h3>
                      <p className="text-xs font-mono text-slate-300">
                        Receipt: <span className="font-bold text-white">{stkPromptModal.receiptNumber || 'COMPLETED'}</span>
                      </p>
                      <p className="text-xs text-slate-400">Loading your order status tracker...</p>
                    </div>
                  </div>
                )}

                {stkPromptModal.status === 'FAILED' && (
                  <div className="space-y-4 py-2">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-red-400">Payment Incomplete</h3>
                      <p className="text-xs text-slate-300">{stkPromptModal.errorMessage || 'Transaction cancelled or timed out.'}</p>
                    </div>
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={executePlaceOrder}
                        className="btn-primary w-full py-3 text-xs font-bold"
                        style={{ background: brand.primary }}
                      >
                        Try Sending Prompt Again
                      </button>
                      <button
                        onClick={() => {
                          if (stkPollTimerRef.current) clearInterval(stkPollTimerRef.current);
                          setStkPromptModal((prev) => ({ ...prev, isOpen: false }));
                          setPayment('cash');
                        }}
                        className="w-full py-2.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-xl"
                      >
                        Pay Cash to Waiter Instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  /* ────── CART SCREEN ────── */
  if (screen === 'cart') {
    return (
      <div className="h-screen overflow-y-auto flex flex-col" style={{ background: 'var(--bg)', scrollbarWidth: 'thin' }}>
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-4 border-b flex-shrink-0" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen('menu')} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface)' }}>
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text)' }} />
            </button>
            <div>
              <h2 className="font-black text-base leading-none" style={{ color: 'var(--text)' }}>Your Order</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{table ? `Table #${table} · ` : ''}{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <ThemeToggleSimple />
        </div>

        <div className="max-w-md mx-auto w-full px-4 py-6 space-y-3 pb-40 flex-1">
          {/* Active offer banner in cart */}
          {appliedOffer && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold" style={{ background: 'rgba(251,191,36,0.12)', color: '#F59E0B', border: '1px solid rgba(251,191,36,0.3)' }}>
              <Flame className="w-4 h-4 flex-shrink-0" />
              <span>{appliedOffer.badge || appliedOffer.title} — Active!</span>
            </div>
          )}

          {/* Scrollable Cart Items Container */}
          <div className="max-h-[58vh] overflow-y-auto space-y-3 pr-1 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
            {cartCalculations.map((c) => (
              <div key={c.item.id} className="card flex items-center gap-4 p-4">
                {c.item.img
                  ? <img src={c.item.img} alt={c.item.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: 'var(--surface-2)' }}>🍸</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{c.item.name}</p>
                  {c.offer && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold" style={{ color: '#34D399' }}>
                      <Tag className="w-2.5 h-2.5" />
                      {c.isBogo ? 'Buy 1 Get 1 Free' : c.offer.badge || c.offer.title}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {c.discountAmount > 0 && (
                      <span className="text-xs line-through" style={{ color: 'var(--text-muted)' }}>KES {(c.originalPrice * c.qty).toLocaleString()}</span>
                    )}
                    <span className="font-black text-sm" style={{ color: c.discountAmount > 0 ? '#F59E0B' : brand.accent }}>KES {c.totalPrice.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => dec(c.item.id)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                    <Minus className="w-4 h-4" style={{ color: 'var(--text)' }} />
                  </button>
                  <span className="w-5 text-center font-black text-sm" style={{ color: 'var(--text)' }}>{c.qty}</span>
                  <button onClick={() => add(c.item.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: brand.primary }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Special Instructions / Additional Information */}
            <div className="rounded-2xl border p-4 space-y-2 mt-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                  <span>Special Instructions / Requests</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400">Optional</span>
              </div>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="e.g. Less ice, extra lime, table location preferences, allergies..."
                rows={2}
                maxLength={300}
                className="w-full bg-transparent text-xs outline-none resize-none placeholder:opacity-40 rounded-xl p-3 border"
                style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--bg)' }}
              />
              <div className="flex justify-between items-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span>Passed directly to your server</span>
                {customerNotes.length > 0 && <span>{customerNotes.length}/300</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 p-4 border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="max-w-md mx-auto space-y-2">
            {cartTotalDiscount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-emerald-400">🎉 Savings</span>
                <span className="font-black text-emerald-400">-KES {cartTotalDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Total</span>
              <span className="text-xl font-black" style={{ color: brand.accent }}>KES {cartFinalTotal.toLocaleString()}</span>
            </div>
            <button onClick={() => setScreen('checkout')} className="btn-primary w-full py-4 text-sm font-black flex items-center justify-center gap-2 text-white" style={{ background: brand.primary }}>
              Continue to Checkout <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ────── MENU SCREEN (MAIN) ────── */
  return (
    <div className="h-screen overflow-y-auto pb-28" style={{ background: 'var(--bg)', scrollbarWidth: 'none' }}>

      {/* ── STICKY TOP HEADER & CATEGORY NAVIGATION ─────────────────── */}
      <div
        className="sticky top-0 z-30 shadow-xl border-b border-white/10 backdrop-blur-md"
        style={{ background: 'var(--bg)' }}
      >
        {/* ── HERO BANNER ─────────────────────── */}
        <div ref={heroRef} className="relative h-44 sm:h-52 md:h-56 overflow-hidden">
          {brand.bannerUrl
            ? <img
                src={brand.bannerUrl}
                alt={brand.name}
                className="w-full h-full object-cover"
                style={{ opacity: heroOpacity, transform: `scale(${1 + (1 - heroOpacity) * 0.08})`, transition: 'transform 0.05s linear' }}
              />
            : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${brand.primary}CC 0%, ${brand.primaryDark} 100%)` }} />
          }
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.2) 0%, rgba(10,10,15,0.85) 70%, rgba(10,10,15,1) 100%)' }} />

          {/* Top bar with OrderUp Company Logo & Venue Status */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2 rounded-full px-3.5 py-1.5 backdrop-blur-md border shadow-lg" style={{ background: 'rgba(10,10,15,0.7)', borderColor: 'rgba(255,255,255,0.15)' }}>
              {/* OrderUp Official Company Logo Emblem */}
              <div className="h-6 w-6 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-blue-600 flex items-center justify-center shadow-md flex-shrink-0">
                <Wine className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs tracking-wider text-white">Order<span className="text-amber-400">Up</span></span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">KE</span>
              </div>
            </div>

            {/* Right: Online status chip + Theme Toggle */}
            <div className="flex items-center gap-2">
              {venueOpen ? (
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase backdrop-blur-md shadow-lg" style={{ background: 'rgba(10,10,15,0.7)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Open Now
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase backdrop-blur-md shadow-lg" style={{ background: 'rgba(10,10,15,0.7)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Closed
                </div>
              )}
              <ThemeToggleSimple className="!bg-[rgba(10,10,15,0.7)] !border-[rgba(255,255,255,0.15)] !text-white !p-1.5 !rounded-full backdrop-blur-md shadow-lg hover:!bg-black/80" />
            </div>
          </div>

          {/* Club identity row */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div className="flex items-center gap-3">
              {brand.logoUrl ? (
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 shadow-xl flex-shrink-0 bg-slate-900" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent) {
                        parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xl font-black text-white bg-gradient-to-tr from-blue-600 to-indigo-600">${brand.name.charAt(0)}</div>`;
                      }
                    }}
                  />
                </div>
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white border-2 shadow-xl flex-shrink-0 bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500"
                  style={{ borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  {brand.name.charAt(0) || 'D'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl font-black text-white leading-none">{brand.name}</h1>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Check className="w-2.5 h-2.5" /> Verified
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 opacity-60 text-amber-400" />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{brand.tagline}</span>
                  </div>
                  {brand.description && (
                    <button
                      onClick={() => setShowAboutModal(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all hover:bg-white/20 active:scale-95"
                      style={{
                        background: 'rgba(255,255,255,0.12)',
                        borderColor: 'rgba(255,255,255,0.25)',
                        color: '#FFFFFF',
                      }}
                      title="View venue info & description"
                    >
                      <Info className="w-2.5 h-2.5 text-amber-400" />
                      About
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Table badge */}
            {table && (
              <div className="rounded-2xl px-3.5 py-2 text-center shadow-lg border border-white/10" style={{ background: brand.primary }}>
                <p className="text-[9px] font-black uppercase opacity-80 text-white leading-none tracking-wider">Table</p>
                <p className="text-lg font-black text-white leading-tight">#{table}</p>
              </div>
            )}
          </div>
        </div>


        {/* ── CLOSED NOTICE BANNER ── */}
        {!venueOpen && (
          <div className="px-4 pt-3 fade-up">
            <div
              className="rounded-2xl p-4 flex items-center gap-3 border"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.06) 100%)',
                borderColor: 'rgba(239,68,68,0.3)',
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg" style={{ background: 'rgba(239,68,68,0.15)' }}>🔒</div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm" style={{ color: '#F87171' }}>We're Currently Closed</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {todayHours.displayText === 'Closed Today'
                    ? `${brand.name} is closed today. You can still browse the menu.`
                    : `${brand.name} is open today from ${todayHours.open} to ${todayHours.close}. You can still browse the menu.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVE ORDER BANNER ── */}
        {activeOrder && activeOrder.status !== 'CANCELLED' && (
          <div className="px-4 pt-3 fade-up">
            <div
              onClick={() => setScreen('success')}
              className="rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] shadow-lg border"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(37,99,235,0.1) 100%)',
                borderColor: 'rgba(37,99,235,0.4)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-600/30 text-blue-400">
                  <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">
                      {activeOrder.status}
                    </span>
                    <p className="text-xs font-bold text-white">
                      {activeOrder.orderNumber ? `Order #${activeOrder.orderNumber}` : 'Active Order'}
                    </p>
                  </div>
                  <p className="text-[11px] mt-0.5 text-blue-200">
                    {activeOrder.status === 'PENDING' ? 'Waiting for waiter to claim...' :
                     activeOrder.status === 'CLAIMED' ? (activeOrder.waiter ? `Claimed by ${activeOrder.waiter.fullName}` : 'Claimed by waiter') :
                     activeOrder.status === 'PREPARING' ? 'Preparing drinks & food...' :
                     activeOrder.status === 'READY' ? 'Ready for pickup & delivery' :
                     'Delivered to your table ✓'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-blue-400">
                {activeOrder.status !== 'DELIVERED' && (
                  <>
                    <span>View Tracker</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── CATEGORY PILLS ───────────────────── */}
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {categories.map((c) => {
              const isDeals = c === '🔥 Deals' || c === 'Offers';
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isDeals && cat !== c ? 'animate-pulse' : ''
                  }`}
                  style={{
                    background: cat === c
                      ? (isDeals ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : brand.primary)
                      : (isDeals ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface)'),
                    color: cat === c ? '#fff' : (isDeals ? '#F59E0B' : 'var(--text-secondary)'),
                    border: `1px solid ${cat === c ? 'transparent' : (isDeals ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)')}`,
                    boxShadow: isDeals && cat === c ? '0 4px 15px rgba(245, 158, 11, 0.4)' : undefined,
                  }}
                >
                  {c}
                  {isDeals && offers.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      cat === c ? 'bg-black/30 text-white' : 'bg-amber-500 text-slate-950'
                    }`}>
                      {offers.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── STICKY CATEGORY BAR (stays pinned while hero scrolls away) ── */}
      <div
        className="sticky top-0 z-20 border-b backdrop-blur-md shadow-sm"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="px-4 py-2.5">
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {categories.map((c) => {
              const isDeals = c === '🔥 Deals' || c === 'Offers';
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isDeals && cat !== c ? 'animate-pulse' : ''
                  }`}
                  style={{
                    background: cat === c
                      ? (isDeals ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : brand.primary)
                      : (isDeals ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface)'),
                    color: cat === c ? '#fff' : (isDeals ? '#F59E0B' : 'var(--text-secondary)'),
                    border: `1px solid ${cat === c ? 'transparent' : (isDeals ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)')}`,
                    boxShadow: isDeals && cat === c ? '0 4px 15px rgba(245, 158, 11, 0.4)' : undefined,
                  }}
                >
                  {c}
                  {isDeals && offers.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      cat === c ? 'bg-black/30 text-white' : 'bg-amber-500 text-slate-950'
                    }`}>
                      {offers.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── FUTURISTIC MOVING SPECIAL DEALS & OFFERS BANNER ─────────────────────── */}
      {offers.length > 0 && (
        <div className="px-4 pt-4 fade-up">
          <div
            onClick={() => {
              setCat('🔥 Deals');
              menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group relative overflow-hidden rounded-3xl border transition-all duration-500 shadow-2xl cursor-pointer active:scale-[0.99] hover:border-amber-400/70"
            style={{
              borderColor: 'rgba(245, 158, 11, 0.45)',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.92) 50%, rgba(15, 23, 42, 0.98) 100%)',
              boxShadow: '0 8px 32px -4px rgba(245, 158, 11, 0.25), 0 0 20px 0 rgba(239, 68, 68, 0.15)',
            }}
          >
            {/* Ambient cyber neon glow & particle shimmer backdrop */}
            <div
              className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-40 animate-pulse"
              style={{ background: 'radial-gradient(circle, #F59E0B 0%, #EC4899 50%, transparent 70%)' }}
            />
            <div
              className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-30 animate-pulse"
              style={{ background: 'radial-gradient(circle, #3B82F6 0%, #8B5CF6 50%, transparent 70%)', animationDelay: '1.5s' }}
            />

            {/* Top Animated Cyber Slide Timer Progress Line */}
            {offers.length > 1 && (
              <div className="absolute top-0 inset-x-0 h-1 bg-slate-800/80 overflow-hidden">
                <div
                  key={activeOfferIdx}
                  className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 animate-[progress_5s_linear_infinite]"
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div className="relative p-4 sm:p-5 space-y-3.5">
              {/* Header row with Cyber Beacon and slider navigation */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exclusive Deal of the Day · Tap to View All</span>
                </div>

                {/* Slider Controls */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {offers.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveOfferIdx((prev) => (prev - 1 + offers.length) % offers.length)}
                        className="w-6 h-6 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
                        aria-label="Previous deal"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveOfferIdx((prev) => (prev + 1) % offers.length)}
                        className="w-6 h-6 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
                        aria-label="Next deal"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Current Featured Offer Card */}
              {(() => {
                const current = offers[activeOfferIdx % offers.length];
                if (!current) return null;

                const matchItem = menuItems.find(
                  (m) =>
                    m.id === current.productId ||
                    m.id === current.id ||
                    current.title.toLowerCase().includes(m.name.toLowerCase()) ||
                    m.name.toLowerCase().includes(current.title.toLowerCase())
                );

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Offer Details & Actions */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/30 uppercase tracking-wide">
                            {current.badge || '🔥 TODAY\'S SPECIAL'}
                          </span>
                        </div>

                        <h3 className="font-black text-base sm:text-lg text-white leading-tight truncate tracking-tight">
                          {current.title}
                        </h3>

                        {current.description && (
                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed opacity-90">
                            {current.description}
                          </p>
                        )}

                        {/* Pricing Tag */}
                        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                          {current.dealPrice ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-black text-amber-400">
                                KES {current.dealPrice.toLocaleString()}
                              </span>
                              {current.originalPrice && current.originalPrice > current.dealPrice && (
                                <span className="text-xs font-semibold text-slate-400 line-through opacity-75">
                                  KES {current.originalPrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-black text-amber-400">
                              {current.offerType === 'BUY_ONE_GET_ONE' ? 'Buy 1 Get 1 Free' : `${current.discountValue}% Off`}
                            </span>
                          )}

                          {/* Interactive Promo Code Pill */}
                          {current.promoCode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (current.promoCode) {
                                  navigator.clipboard?.writeText(current.promoCode);
                                  setCopiedCode(current.promoCode);
                                  setTimeout(() => setCopiedCode(null), 2500);
                                }
                              }}
                              title="Click to copy promo code"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-400/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-mono font-bold tracking-wide transition-all active:scale-95 shadow-sm"
                            >
                              <Copy className="w-3 h-3 text-amber-400" />
                              <span>{copiedCode === current.promoCode ? 'Copied! 🎉' : current.promoCode}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right: Floating Product Image with Holographic Glow */}
                      <div className="relative flex-shrink-0">
                        {/* Holographic glowing ambient back-ring */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 blur-md opacity-70 animate-pulse pointer-events-none scale-105" />
                        
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                          {current.imageUrl ? (
                            <img
                              src={current.imageUrl}
                              alt={current.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-950/80 to-purple-950/80 text-3xl">
                              🍸
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                          <span className="absolute bottom-1 right-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-amber-300 border border-white/10">
                            Special
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Order Actions Row Inside Banner */}
                    <div className="flex items-center gap-2 pt-1 border-t border-white/10 flex-wrap">
                      {matchItem ? (
                        (cart[matchItem.id] ?? 0) > 0 ? (
                          <div
                            className="flex items-center gap-2 rounded-xl p-1 bg-white/10 backdrop-blur-md border border-white/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => dec(matchItem.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/40 text-white hover:bg-black/60 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-4 text-center text-xs font-black text-white">
                              {cart[matchItem.id]}
                            </span>
                            <button
                              onClick={() => add(matchItem.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500 text-white hover:bg-amber-600 font-bold transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              add(matchItem.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-amber-500/30 flex items-center gap-1.5 transition-all active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Order This Deal
                          </button>
                        )
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCat('🔥 Deals');
                            menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-xs shadow-lg shadow-amber-500/30 flex items-center gap-1.5 transition-all active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          View Deals Menu
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCat('🔥 Deals');
                          menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/15 text-slate-200 text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <span>All Deals ({offers.length})</span>
                        <ChevronRight className="w-3 h-3 opacity-70" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Bottom Pagination Dots */}
              {offers.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                  {offers.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveOfferIdx(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        activeOfferIdx === i
                          ? 'w-6 bg-gradient-to-r from-amber-400 to-rose-500 shadow-sm shadow-amber-500/50'
                          : 'w-1.5 bg-white/20 hover:bg-white/40'
                      }`}
                      aria-label={`Deal ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OPTIONAL ADDITIONAL VENUE DESCRIPTION CARD ── */}
      {brand.description && (
        <div className="px-4 pt-3.5 fade-up">
          <div
            className="rounded-2xl p-4 border transition-all shadow-sm relative overflow-hidden group"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            {/* Brand decorative left accent line */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              style={{ background: brand.primary }}
            />
            <div className="flex items-start gap-3 pl-1">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm shadow-sm"
                style={{
                  background: `${brand.primary}18`,
                  color: brand.primary,
                }}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                    About {brand.name}
                  </h4>
                  <button
                    onClick={() => setShowAboutModal(true)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all hover:opacity-80 flex items-center gap-1"
                    style={{
                      background: `${brand.primary}15`,
                      color: brand.primary,
                      border: `1px solid ${brand.primary}30`,
                    }}
                  >
                    <span>Venue Details</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                </div>
                <p
                  className={`text-xs mt-1.5 leading-relaxed ${
                    descExpanded ? '' : 'line-clamp-2'
                  }`}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {brand.description}
                </p>
                {brand.description.length > 120 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-[11px] font-bold mt-1.5 flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ color: brand.primary }}
                  >
                    <span>{descExpanded ? 'Show less' : 'Read more'}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${
                        descExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MENU ITEMS ───────────────────────── */}
      <div ref={menuSectionRef} className="px-4 pt-3 space-y-3 fade-up-delay-2">
        {/* Special Header when in Deals Tab */}
        {cat === '🔥 Deals' && (
          <div
            className="rounded-2xl p-3.5 mb-2 flex items-center justify-between border"
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.1) 100%)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔥</span>
              <div>
                <p className="text-xs font-black text-amber-400">Exclusive Deals & Offers</p>
                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Special prices & discounts applied automatically to your cart</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
              {filtered.length} Deals
            </span>
          </div>
        )}

        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </p>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No items available in this category.</p>
          </div>
        )}

        {filtered.filter((i) => i.isAvailable).map((item) => {
          const itemOffer = getOfferForItem(item);
          const itemPricing = itemOffer ? getItemPricing(item, 1) : null;
          return (
          <div key={item.id} className="card flex items-center gap-4 p-4 transition-all active:scale-[0.98]">
            <div className="relative flex-shrink-0">
              {item.img
                ? <img src={item.img} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />
                : <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl" style={{ background: 'var(--surface)' }}>🍸</div>
              }
              {itemOffer && (
                <span
                  className="absolute -top-2 -right-2 text-[8px] font-black rounded-full px-1.5 py-0.5 text-white animate-pulse"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                >
                  {itemOffer.badge ? itemOffer.badge.slice(0, 8) : 'DEAL'}
                </span>
              )}
              {!itemOffer && item.badge && (
                <span
                  className="absolute -top-2 -right-2 text-[8px] font-black rounded-full px-1.5 py-0.5 text-white"
                  style={{ background: brand.primary }}
                >
                  {item.badge}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text)' }}>{item.name}</p>
              {item.desc && <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>}
              {/* Offer label */}
              {itemOffer && (
                <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#34D399' }}>
                  <Tag className="w-2.5 h-2.5" />
                  {itemOffer.offerType === 'BUY_ONE_GET_ONE' ? 'Buy 1 Get 1 Free' : itemOffer.badge || itemOffer.title}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  {itemPricing && itemPricing.discountAmount > 0 && (
                    <span className="text-xs line-through" style={{ color: 'var(--text-muted)' }}>KES {item.price.toLocaleString()}</span>
                  )}
                  <span className="font-black text-sm" style={{ color: itemPricing && itemPricing.discountAmount > 0 ? '#F59E0B' : brand.accent }}>
                    KES {itemPricing ? itemPricing.unitPrice.toLocaleString() : item.price.toLocaleString()}
                  </span>
                </div>

                {(cart[item.id] ?? 0) > 0 ? (
                  <div className="flex items-center gap-2 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
                    <button onClick={() => dec(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                      <Minus className="w-3.5 h-3.5" style={{ color: 'var(--text)' }} />
                    </button>
                    <span className="w-4 text-center text-xs font-black" style={{ color: 'var(--text)' }}>{cart[item.id]}</span>
                    <button onClick={() => add(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: brand.primary }}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => add(item.id)}
                    className="btn-primary px-4 py-2 flex items-center gap-1.5"
                    style={{ background: brand.primary }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* ── ORDERUP COMPANY BRANDING FOOTER ── */}
      <div className="py-12 px-4 text-center border-t border-white/5 mt-10 space-y-2">
        <div className="inline-flex items-center justify-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-blue-600 flex items-center justify-center shadow-md">
            <Wine className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-sm text-white tracking-wider">
            Order<span className="text-amber-400">Up</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          Smart Digital Menu & Table Ordering • {brand.name}
        </p>
      </div>

      {/* ── FLOATING CART BAR ────────────────── */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <button
            onClick={() => setScreen('cart')}
            className="w-full flex items-center justify-between p-4 rounded-2xl text-white shadow-2xl font-bold transition-all active:scale-[0.97]"
            style={{
              background: venueOpen ? brand.primary : '#6B7280',
              boxShadow: venueOpen ? `0 8px 32px ${brand.primary}55` : '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm" style={{ background: 'rgba(0,0,0,0.25)' }}>
                {cartCount}
              </div>
              <div>
                <span className="text-sm font-bold block leading-tight">{venueOpen ? 'View Order' : 'Venue Closed'}</span>
                {!venueOpen && <span className="text-[10px] opacity-70">Opens {todayHours.open}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cartTotalDiscount > 0 && (
                <span className="text-xs font-bold line-through opacity-60">KES {cartSubtotal.toLocaleString()}</span>
              )}
              <span className="text-sm font-black">KES {cartFinalTotal.toLocaleString()}</span>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </div>
          </button>
        </div>
      )}

      {/* ── ABOUT VENUE MODAL ── */}
      {showAboutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-up"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4 relative overflow-hidden"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors border"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pt-1">
              {brand.logoUrl ? (
                <div
                  className="w-12 h-12 rounded-2xl overflow-hidden border flex-shrink-0 shadow-md"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 shadow-md"
                  style={{ background: brand.primary }}
                >
                  {brand.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 pr-8">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-black truncate" style={{ color: 'var(--text)' }}>
                    {brand.name}
                  </h3>
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Check className="w-2 h-2" /> Verified
                  </span>
                </div>
                <p className="text-xs truncate flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{brand.address || brand.tagline}</span>
                </p>
              </div>
            </div>

            {/* Description Body */}
            {brand.description && (
              <div
                className="p-3.5 rounded-2xl border space-y-1.5"
                style={{
                  background: 'var(--bg)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: brand.primary }}>
                  <Sparkles className="w-3 h-3" />
                  <span>About & Atmosphere</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                  {brand.description}
                </p>
              </div>
            )}

            {/* Hours & Contact */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div
                className="p-3 rounded-xl border space-y-0.5"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Hours</span>
                </div>
                <p className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                  {todayHours.displayText}
                </p>
              </div>
              <div
                className="p-3 rounded-xl border space-y-0.5"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Service</span>
                </div>
                <p className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                  {venueOpen ? 'Open Now' : 'Closed'}
                </p>
              </div>
            </div>

            {brand.phone && (
              <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                Questions or reservations? Call <span className="font-bold" style={{ color: 'var(--text)' }}>{brand.phone}</span>
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

/* ── Utility: lighten/darken a hex color ── */
function adjustColor(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
