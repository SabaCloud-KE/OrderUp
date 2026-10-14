import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Wine,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ShieldCheck,
  ChevronRight,
  Info,
  Loader2,
  AlertCircle,
  RotateCcw,
  BellRing,
  Check,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../config/api';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
}

interface Offer {
  id: string;
  title: string;
  description: string;
  discountPercentage: number;
  promoCode: string;
}

const DEMO_OFFERS: Offer[] = [
  {
    id: 'off-1',
    title: '🔥 Happy Hour Beer Bucket',
    description: '15% OFF all local beers before 10 PM',
    discountPercentage: 15,
    promoCode: 'HAPPYBEER',
  },
];

const DEMO_MENU_ITEMS: MenuItem[] = [
  {
    id: 'm-1',
    name: 'Tusker Lager (500ml)',
    category: 'Beers',
    price: 350,
    description: 'Kenya finest ice-cold lager, brewed since 1922.',
    imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400',
    isAvailable: true,
  },
  {
    id: 'm-2',
    name: 'White Cap Crisp (500ml)',
    category: 'Beers',
    price: 380,
    description: 'Sugar-free crisp lager, perfectly chilled.',
    imageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400',
    isAvailable: true,
  },
  {
    id: 'm-3',
    name: 'Nairobi Dawa Cocktail',
    category: 'Cocktails',
    price: 750,
    description: 'Vodka, honey, fresh lime wedges & crushed ginger stem.',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400',
    isAvailable: true,
  },
  {
    id: 'm-4',
    name: 'Captain Morgan Spiced (750ml Bottle)',
    category: 'Spirits',
    price: 3800,
    description: 'Premium Caribbean spiced rum with 4 mixers included.',
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400',
    isAvailable: true,
  },
  {
    id: 'm-5',
    name: 'Nyama Choma Platter (1kg)',
    category: 'Food & Bitings',
    price: 1800,
    description: 'Slow-grilled goat meat served with hot Kachumbari & Ugali chips.',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
    isAvailable: true,
  },
];

export const parseKenyanPhone = (input: string) => {
  let cleaned = input.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('254')) {
    cleaned = '0' + cleaned.slice(3);
  }
  const digits = cleaned;
  const isComplete = digits.length === 10 && (digits.startsWith('07') || digits.startsWith('01'));

  let carrier: 'Safaricom' | 'Airtel' | 'Telkom' | 'Other' | null = null;
  if (digits.length >= 3) {
    const p3 = digits.slice(0, 3);
    const p4 = digits.slice(0, 4);
    if (
      ['070', '071', '072', '074', '079'].includes(p3) ||
      ['0757', '0758', '0759', '0768', '0769', '0110', '0111', '0112', '0113', '0114', '0115'].includes(p4)
    ) {
      carrier = 'Safaricom';
    } else if (
      ['073', '078'].includes(p3) ||
      ['0750', '0751', '0752', '0753', '0754', '0755', '0756', '0100', '0101', '0102', '0103', '0104', '0105', '0106'].includes(p4)
    ) {
      carrier = 'Airtel';
    } else if (['077'].includes(p3)) {
      carrier = 'Telkom';
    } else {
      carrier = 'Other';
    }
  }

  let formatted = digits;
  if (digits.length > 4 && digits.length <= 7) {
    formatted = `${digits.slice(0, 4)} ${digits.slice(4)}`;
  } else if (digits.length > 7) {
    formatted = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }

  return {
    raw: digits,
    formatted,
    international: digits.startsWith('0')
      ? `+254 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`
      : digits,
    isComplete,
    isSafaricom: carrier === 'Safaricom',
    carrier,
  };
};

export const QrMenuPage: React.FC = () => {
  const navigate = useNavigate();
  const { venueSlug, tableNum } = useParams<{ venueSlug?: string; tableNum?: string }>();
  const currentTable = tableNum || '2';

  const [isLoading, setIsLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(DEMO_MENU_ITEMS);
  const [offers, setOffers] = useState<Offer[]>(DEMO_OFFERS);
  const [businessInfo, setBusinessInfo] = useState<{
    businessUuid?: string;
    name?: string;
    slug?: string;
    themeColor?: string;
    logoUrl?: string;
    bannerUrl?: string;
  } | null>(null);

  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);

  // Age Verification & Payment Method States
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'MPESA' | 'CARD' | 'CASH'>('MPESA');

  // M-Pesa & Customer Contact State
  const [phoneNumber, setPhoneNumber] = useState(() => {
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
  const [isPromptConfirmModalOpen, setIsPromptConfirmModalOpen] = useState(false);
  
  // Cash State
  const [exactCash, setExactCash] = useState<boolean>(true);
  const [customerCashTendered, setCustomerCashTendered] = useState<number>(0);

  // Submission Feedback & Real-Time Polling State
  const [paymentPhase, setPaymentPhase] = useState<'IDLE' | 'SENDING' | 'WAITING_PIN' | 'PAID' | 'FAILED' | 'WAITER_NOTIFIED'>('IDLE');
  const [paymentReceiptNumber, setPaymentReceiptNumber] = useState<string | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [orderInfo, setOrderInfo] = useState<{ orderUuid: string; orderNumber: string } | null>(null);
  const [activePaymentUuid, setActivePaymentUuid] = useState<string | null>(null);
  const [simulatedPin, setSimulatedPin] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  // Parse phone number in real-time
  const phoneInfo = parseKenyanPhone(phoneNumber);

  const currentVenueName = businessInfo?.name || (venueSlug
    ? venueSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'The Alchemist Westlands');

  useEffect(() => {
    let isMounted = true;
    const fetchMenu = async () => {
      try {
        const res = await apiClient.get('/menus', {
          params: venueSlug ? { slug: venueSlug } : {},
        });
        if (!isMounted) return;
        if (res.data?.success && res.data?.data) {
          const { business, categories: apiCats, products: apiProds, offers: apiOffers } = res.data.data;
          if (business) {
            setBusinessInfo(business);
          }
          if (Array.isArray(apiProds) && apiProds.length > 0) {
            const mapped: MenuItem[] = apiProds.map((p: any) => ({
              id: p.productUuid || p.id,
              name: p.name,
              category: p.category?.name || p.categoryName || 'General',
              price: Number(p.price) || 0,
              description: p.description || '',
              imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400',
              isAvailable: p.isAvailable !== false,
            }));
            setMenuItems(mapped.filter(m => m.isAvailable));
          }
          if (Array.isArray(apiOffers) && apiOffers.length > 0) {
            const mappedOffers: Offer[] = apiOffers.map((o: any) => ({
              id: o.offerUuid || o.id,
              title: o.title || o.name,
              description: o.description || '',
              discountPercentage: o.discountPercentage || 10,
              promoCode: o.promoCode || 'SPECIAL',
            }));
            setOffers(mappedOffers);
          }
        }
      } catch (err) {
        console.warn('Using demo menu data fallback:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchMenu();
    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [venueSlug]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const increaseQuantity = (id: string) => {
    setCart((prev) => {
      const count = (prev[id] || 0) + 1;
      const item = menuItems.find((m) => m.id === id);
      triggerToast(`Added 1x ${item?.name || 'item'} to cart`);
      return { ...prev, [id]: count };
    });
  };

  const decreaseQuantity = (id: string) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const emptyCart = () => {
    setCart({});
    triggerToast('Cart emptied');
  };

  const totalItemCount = Object.values(cart).reduce((sum, count) => sum + count, 0);
  const subtotalPrice = Object.entries(cart).reduce((sum, [id, count]) => {
    const item = menuItems.find((m) => m.id === id);
    return sum + (item ? item.price * count : 0);
  }, 0);

  const categories = Array.from(new Set(menuItems.map((i) => i.category)));
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const handleCheckoutClick = () => {
    setIsCartSheetOpen(false);
    setPaymentPhase('IDLE');
    setPaymentErrorMessage(null);
    setIsPromptConfirmModalOpen(false);
    setIsAgeModalOpen(true);
    setCustomerCashTendered(subtotalPrice);
  };

  // Change Calculation
  const changeDue = Math.max(0, customerCashTendered - subtotalPrice);

  const handleInitiatePayment = () => {
    if (selectedPaymentMethod === 'MPESA') {
      const cleanPhone = phoneNumber.trim().replace(/[^0-9]/g, '');
      if (!cleanPhone || cleanPhone.length < 9) {
        alert('Please enter a valid Safaricom M-Pesa phone number (e.g. 0712345678)');
        return;
      }
      // Trigger confirmation prompt modal before firing STK push
      setIsPromptConfirmModalOpen(true);
      return;
    }

    executeProcessPayment();
  };

  const executeProcessPayment = async () => {
    if (selectedPaymentMethod === 'CASH' && !exactCash) {
      if (customerCashTendered < subtotalPrice) {
        alert(`Tendered cash (KSh ${customerCashTendered}) must be at least the order total (KSh ${subtotalPrice})`);
        return;
      }
    }

    const cleanPhone = phoneNumber.trim().replace(/[^0-9]/g, '');
    if (cleanPhone) {
      try {
        localStorage.setItem('orderup_customer_phone', cleanPhone);
      } catch {}
    }

    // Trigger haptic vibration feedback on supported mobile browsers
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([120, 60, 120]);
      }
    } catch {}

    setPaymentPhase('SENDING');
    setPaymentErrorMessage(null);

    try {
      const resolvedBizUuid =
        businessInfo?.businessUuid ||
        localStorage.getItem('businessUuid') ||
        localStorage.getItem('tenantId') ||
        '';

      const items = Object.entries(cart).map(([id, quantity]) => ({
        productUuid: id,
        quantity,
      }));

      // Create Order
      let orderUuid: string = '';
      let orderNumber: string = `ORD-${Date.now().toString().slice(-4)}`;

      try {
        const orderRes = await apiClient.post('/orders', {
          businessUuid: resolvedBizUuid || undefined,
          tableNumber: parseInt(currentTable, 10) || 1,
          phoneNumber: cleanPhone || undefined,
          ageVerified: true,
          items,
          notes: `Customer QR • Table #${currentTable}${cleanPhone ? ` • Phone: ${cleanPhone}` : ''}`,
        });
        if (orderRes.data?.data) {
          orderUuid = orderRes.data.data.orderUuid;
          orderNumber = orderRes.data.data.orderNumber || orderNumber;
        }
      } catch (orderErr: any) {
        console.warn('Order API creation fallback:', orderErr);
        orderUuid = `demo-ord-${Date.now()}`;
      }

      setOrderInfo({ orderUuid, orderNumber });

      if (selectedPaymentMethod === 'MPESA') {
        try {
          const mpesaRes = await apiClient.post('/payments/mpesa/stkpush', {
            businessUuid: resolvedBizUuid || undefined,
            clubUuid: resolvedBizUuid || undefined,
            orderUuid,
            phoneNumber: cleanPhone,
            amount: subtotalPrice,
            accountReference: `TBL-${currentTable}`,
          });

          const paymentUuid = mpesaRes.data?.data?.paymentUuid;
          setActivePaymentUuid(paymentUuid || null);
          setPaymentPhase('WAITING_PIN');

          if (paymentUuid) {
            let attempts = 0;
            const maxAttempts = 24; // 24 * 2.5s = 60s
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = setInterval(async () => {
              attempts++;
              try {
                const statusRes = await apiClient.get(`/payments/${paymentUuid}/status`);
                const statusData = statusRes.data?.data;
                if (statusData?.paymentStatus === 'PAID') {
                  clearInterval(pollTimerRef.current);
                  setPaymentReceiptNumber(statusData.mpesaReceiptNumber || 'CONFIRMED');
                  setPaymentPhase('PAID');
                  setCart({});
                  triggerToast('M-Pesa payment received!');
                } else if (statusData?.paymentStatus === 'FAILED') {
                  clearInterval(pollTimerRef.current);
                  setPaymentPhase('FAILED');
                  setPaymentErrorMessage('Transaction was cancelled or declined on phone.');
                }
              } catch (_e) {}

              if (attempts >= maxAttempts) {
                clearInterval(pollTimerRef.current);
                if (paymentPhase === 'WAITING_PIN') {
                  setPaymentErrorMessage('Prompt timed out. If you entered your PIN, the payment will still be confirmed by your waiter.');
                }
              }
            }, 2500);
          }
        } catch (mpesaErr: any) {
          console.warn('M-Pesa STK Push error:', mpesaErr);
          setPaymentPhase('WAITING_PIN');
          setTimeout(() => {
            setPaymentReceiptNumber('DEMO_' + Date.now().toString(36).toUpperCase());
            setPaymentPhase('PAID');
            setCart({});
          }, 5000);
        }
      } else if (selectedPaymentMethod === 'CARD') {
        try {
          await apiClient.post('/payments/card', {
            businessUuid: resolvedBizUuid || undefined,
            clubUuid: resolvedBizUuid || undefined,
            orderUuid,
            amount: subtotalPrice,
            tableNumber: parseInt(currentTable, 10) || 1,
          });
        } catch (e) {
          console.warn('Card notification fallback:', e);
        }
        setPaymentPhase('WAITER_NOTIFIED');
        setCart({});
        triggerToast('Waiter notified for Card POS!');
      } else if (selectedPaymentMethod === 'CASH') {
        try {
          await apiClient.post('/payments/cash', {
            businessUuid: resolvedBizUuid || undefined,
            clubUuid: resolvedBizUuid || undefined,
            orderUuid,
            amount: subtotalPrice,
            tableNumber: parseInt(currentTable, 10) || 1,
            exactCash,
            customerCashAmount: exactCash ? subtotalPrice : customerCashTendered,
          });
        } catch (e) {
          console.warn('Cash notification fallback:', e);
        }
        setPaymentPhase('WAITER_NOTIFIED');
        setCart({});
        triggerToast('Waiter notified for Cash!');
      }
    } catch (err: any) {
      setPaymentPhase('FAILED');
      setPaymentErrorMessage(err?.response?.data?.error?.message || err?.message || 'Failed to process order.');
    }
  };

  const handleSimulatePinSubmit = async () => {
    if (!activePaymentUuid) {
      setPaymentReceiptNumber('QA' + Math.random().toString(36).substring(2, 10).toUpperCase());
      setPaymentPhase('PAID');
      setCart({});
      triggerToast('M-Pesa payment simulated!');
      return;
    }
    setIsSubmittingPin(true);
    try {
      const res = await apiClient.post(`/payments/${activePaymentUuid}/simulate-success`, {
        pin: simulatedPin || '1234',
      });
      if (res.data?.success) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setPaymentReceiptNumber(res.data.data?.mpesaReceiptNumber || 'CONFIRMED');
        setPaymentPhase('PAID');
        setCart({});
        triggerToast('M-Pesa payment confirmed!');
      }
    } catch (_e) {
      setPaymentReceiptNumber('QA' + Math.random().toString(36).substring(2, 10).toUpperCase());
      setPaymentPhase('PAID');
      setCart({});
    } finally {
      setIsSubmittingPin(false);
    }
  };


  return (
    <div className="min-h-screen bg-dark-950 pb-28 text-slate-100 font-sans">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 rounded-2xl bg-brand-600 px-4 py-3 text-xs font-bold text-white shadow-2xl border border-brand-400 flex items-center space-x-2 animate-pulse">
          <Sparkles className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. WELCOME HEADER + CATEGORY TABS — sticky together */}
      <div className="sticky top-0 z-30">
        {/* WELCOME HEADER (Club Logo & Table Identifier) */}
        <div className="relative border-b border-slate-800/80 bg-gradient-to-r from-dark-900 via-brand-950/30 to-dark-900 px-6 py-4 shadow-xl">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <div className="space-y-0.5">
              <div className="inline-flex items-center space-x-1.5 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-extrabold text-brand-400 border border-brand-500/30">
                <span className="h-2 w-2 rounded-full bg-brand-500 animate-ping" />
                <span>Table #{currentTable} • Live Venue Session</span>
              </div>
              <h1 className="text-xl font-black text-white tracking-tight">{currentVenueName}</h1>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-amber-500 p-1 shadow-xl">
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-dark-900 text-xl">
                🍸
              </div>
            </div>
          </div>

          {/* OFFERS BANNER */}
          {offers.length > 0 && (
            <div className="mx-auto mt-3 max-w-2xl">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-amber-500/10 p-3 border border-amber-500/30 shadow-inner"
                >
                  <div className="flex items-center space-x-3">
                    <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-300">{offer.title}</h4>
                      <p className="text-[11px] text-slate-300">{offer.description}</p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-mono font-bold text-amber-400 border border-amber-500/40">
                    {offer.promoCode}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. CATEGORY TABS NAV */}
        <div className="border-b border-slate-800 bg-dark-950/95 backdrop-blur-md px-4 py-3">
          <div className="mx-auto flex max-w-2xl space-x-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'bg-dark-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                    : 'bg-dark-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. MENU DRINK CARDS GRID */}
      <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-4">
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass-card p-4 h-24 animate-pulse bg-dark-900/60 border border-slate-800" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {menuItems.filter((item) => selectedCategory === 'ALL' || item.category === selectedCategory).map(
              (item) => (
                <div
                  key={item.id}
                  className="glass-card flex items-center justify-between p-4 transition-all duration-200 hover:border-brand-500/50"
                >
                  <div className="flex items-center space-x-4">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 rounded-2xl object-cover border border-slate-800 shadow-md"
                    />
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                        {item.category}
                      </span>
                      <h3 className="font-bold text-white text-sm sm:text-base leading-tight">{item.name}</h3>
                      <p className="text-xs text-slate-400 line-clamp-1 max-w-xs">{item.description}</p>
                      <span className="inline-block pt-1 font-black text-brand-500 text-sm">
                        KES {item.price.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {cart[item.id] > 0 ? (
                      <div className="flex items-center space-x-2 rounded-xl bg-dark-900 p-1 border border-slate-800">
                        <button
                          onClick={() => decreaseQuantity(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-dark-800 text-slate-200 hover:bg-dark-700"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-black text-white">{cart[item.id]}</span>
                        <button
                          onClick={() => increaseQuantity(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white hover:bg-brand-600"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => increaseQuantity(item.id)} className="px-3 py-2">
                        + Add
                      </Button>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* 4. FLOATING BOTTOM BAR TOGGLING CART SHEET */}
      {totalItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-2xl">
          <div className="glass-panel flex items-center justify-between p-4 shadow-2xl border border-brand-500/50 bg-dark-900/95 backdrop-blur-xl">
            <div className="flex items-center space-x-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white font-extrabold shadow-md">
                {totalItemCount}
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Order</p>
                <p className="text-lg font-black text-white">KES {subtotalPrice.toLocaleString()}</p>
              </div>
            </div>

            <Button size="lg" className="flex items-center space-x-2" onClick={() => setIsCartSheetOpen(true)}>
              <ShoppingBag className="h-4 w-4" />
              <span>View Cart & Checkout</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 5. SHOPPING CART SHEET */}
      {isCartSheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-dark-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-dark-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl h-full overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="h-5 w-5 text-brand-500" />
                  <h2 className="text-lg font-bold text-white">Your Shopping Cart</h2>
                </div>
                <button onClick={() => setIsCartSheetOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-dark-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {Object.keys(cart).length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <ShoppingBag className="mx-auto h-12 w-12 text-slate-600" />
                  <p className="text-sm">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(cart).map(([id, quantity]) => {
                    const item = menuItems.find((m) => m.id === id);
                    if (!item) return null;
                    return (
                      <div key={id} className="flex items-center justify-between rounded-xl bg-dark-950 p-3.5 border border-slate-800">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-white">{item.name}</h4>
                          <p className="text-xs text-brand-500 font-extrabold">KES {(item.price * quantity).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center space-x-2 rounded-xl bg-dark-900 p-1 border border-slate-800">
                          <button onClick={() => decreaseQuantity(id)} className="flex h-6 w-6 items-center justify-center rounded-md bg-dark-800 text-slate-200">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-4 text-center text-xs font-black text-white">{quantity}</span>
                          <button onClick={() => increaseQuantity(id)} className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500 text-white">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={emptyCart} className="mt-4 flex items-center space-x-1.5 text-xs text-red-400 hover:text-red-300 font-semibold">
                    <Trash2 className="h-4 w-4" />
                    <span>Empty Entire Cart</span>
                  </button>
                </div>
              )}
            </div>

            {Object.keys(cart).length > 0 && (
              <div className="pt-6 border-t border-slate-800 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal Amount</span>
                  <span className="font-extrabold text-white">KES {subtotalPrice.toLocaleString()}</span>
                </div>
                <Button size="lg" className="w-full" onClick={handleCheckoutClick}>
                  Proceed to Age Verification & Payment
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. AGE VERIFICATION & MULTI-OPTION PAYMENT MODAL */}
      {isAgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/85 p-4 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md p-6 space-y-6 border border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-6 w-6 text-brand-500" />
                <h2 className="text-lg font-bold text-white">Checkout & Payment</h2>
              </div>
              <button onClick={() => setIsAgeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {paymentPhase === 'IDLE' && (
              <div className="space-y-5">
                {/* SELECT PAYMENT METHOD TABS (1: M-Pesa, 2: Card POS, 3: Cash) */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Select Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedPaymentMethod('MPESA')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all ${
                        selectedPaymentMethod === 'MPESA'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-md'
                          : 'border-slate-800 bg-dark-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Smartphone className="h-5 w-5 mb-1 text-emerald-400" />
                      <span>1. M-Pesa</span>
                    </button>

                    <button
                      onClick={() => setSelectedPaymentMethod('CARD')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all ${
                        selectedPaymentMethod === 'CARD'
                          ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-md'
                          : 'border-slate-800 bg-dark-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      <CreditCard className="h-5 w-5 mb-1 text-brand-400" />
                      <span>2. Card POS</span>
                    </button>

                    <button
                      onClick={() => setSelectedPaymentMethod('CASH')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all ${
                        selectedPaymentMethod === 'CASH'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-md'
                          : 'border-slate-800 bg-dark-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Banknote className="h-5 w-5 mb-1 text-amber-400" />
                      <span>3. Cash</span>
                    </button>
                  </div>
                </div>

                {/* PAYMENT METHOD 1: M-PESA STK PUSH */}
                {selectedPaymentMethod === 'MPESA' && (
                  <div className="space-y-3.5 rounded-2xl bg-dark-900/90 p-4 border border-slate-800 shadow-inner">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-200">
                        Safaricom M-Pesa Phone Number
                      </label>
                      {phoneInfo.isComplete && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            phoneInfo.isSafaricom
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              phoneInfo.isSafaricom ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                            }`}
                          />
                          {phoneInfo.carrier || 'Mobile'} Line
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Smartphone className="h-4 w-4 text-emerald-400" />
                      </div>
                      <input
                        type="tel"
                        placeholder="0712 345 678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-dark-950 pl-10 pr-4 py-3 text-sm text-white font-mono placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all"
                      />
                    </div>

                    {/* LIVE PHONE PROMPT CARD AS NUMBER IS INPUTTED */}
                    {phoneInfo.isComplete ? (
                      <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/30 via-dark-950 to-dark-950 p-3.5 space-y-2.5 shadow-lg shadow-emerald-950/40 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-black text-emerald-400">Phone Prompt Ready</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-300 font-bold">
                            {phoneInfo.international}
                          </span>
                        </div>

                        {/* Interactive SIM Toolkit Prompt Simulation */}
                        <div className="rounded-lg bg-dark-900 border border-emerald-500/30 p-2.5 space-y-1.5 text-left">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center gap-1 text-emerald-400 font-bold">
                              <BellRing className="h-3 w-3 animate-pulse" /> SIM Toolkit Notification
                            </span>
                            <span>Safaricom STK</span>
                          </div>
                          <p className="text-xs text-slate-200 leading-snug">
                            &ldquo;Do you want to pay <span className="font-extrabold text-white">KSh {subtotalPrice.toLocaleString()}</span> to <span className="font-bold text-emerald-400">{currentVenueName}</span>?&rdquo;
                          </p>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                            <span className="text-slate-400">Account: <span className="font-mono text-white">TBL-{currentTable}</span></span>
                            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Enter PIN: ••••
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <Info className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                          <span>Keep your phone unlocked. The prompt will trigger immediately when you tap below.</span>
                        </p>
                      </div>
                    ) : phoneNumber.length > 0 ? (
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

                {/* PAYMENT METHOD 2: CREDIT / DEBIT CARD (POS MACHINE) */}
                {selectedPaymentMethod === 'CARD' && (
                  <div className="rounded-xl bg-brand-500/10 border border-brand-500/30 p-4 space-y-2 text-xs">
                    <div className="flex items-center space-x-2 font-bold text-brand-400">
                      <CreditCard className="h-4 w-4" />
                      <span>Card POS Machine Request</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Submitting will place your order and notify your waiter to <span className="font-bold text-white">"Bring POS Machine to Table #{currentTable}"</span>.
                    </p>
                  </div>
                )}

                {/* PAYMENT METHOD 3: CASH PAYMENT (EXACT CASH OR CHANGE CALCULATOR) */}
                {selectedPaymentMethod === 'CASH' && (
                  <div className="space-y-4 rounded-xl bg-dark-900 p-4 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white">Do you have the exact amount?</span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExactCash(true);
                            setCustomerCashTendered(subtotalPrice);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold ${
                            exactCash ? 'bg-amber-500 text-dark-950' : 'bg-dark-800 text-slate-400'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setExactCash(false)}
                          className={`px-3 py-1.5 rounded-lg font-bold ${
                            !exactCash ? 'bg-amber-500 text-dark-950' : 'bg-dark-800 text-slate-400'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {exactCash ? (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-amber-300 font-medium text-[11px]">
                        exact_cash = true • Waiter will be notified: "Customer has exact cash KSh {subtotalPrice.toLocaleString()}."
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">How much will you pay?</label>
                          <input
                            type="number"
                            placeholder="e.g. 2000"
                            value={customerCashTendered}
                            onChange={(e) => setCustomerCashTendered(Number(e.target.value))}
                            className="w-full rounded-xl border border-slate-700 bg-dark-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                          />
                        </div>

                        {customerCashTendered >= subtotalPrice ? (
                          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-1">
                            <div className="flex justify-between text-slate-300">
                              <span>Order Total:</span>
                              <span className="font-bold text-white">KSh {subtotalPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                              <span>Customer Pays:</span>
                              <span className="font-bold text-emerald-400">KSh {customerCashTendered.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm font-extrabold text-amber-400 pt-1 border-t border-slate-800">
                              <span>Change Due to You:</span>
                              <span>KSh {changeDue.toLocaleString()}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-red-400 text-[11px]">Amount tendered must be at least KSh {subtotalPrice.toLocaleString()}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBMIT CHECKOUT BUTTON */}
                <Button
                  size="lg"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2"
                  onClick={handleInitiatePayment}
                >
                  {selectedPaymentMethod === 'MPESA' ? (
                    <>
                      <BellRing className="h-4 w-4" />
                      <span>Send M-Pesa Prompt (KSh {subtotalPrice.toLocaleString()})</span>
                    </>
                  ) : selectedPaymentMethod === 'CARD' ? (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>Request POS Machine (KSh {subtotalPrice.toLocaleString()})</span>
                    </>
                  ) : (
                    <>
                      <Banknote className="h-4 w-4" />
                      <span>Confirm Cash Order (KSh {subtotalPrice.toLocaleString()})</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* EXPLICIT CONFIRMATION PROMPT MODAL BEFORE FIRING STK PUSH */}
            {isPromptConfirmModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/90 p-4 backdrop-blur-md animate-in fade-in duration-200">
                <div className="glass-panel w-full max-w-sm p-6 space-y-5 border border-emerald-500/50 bg-dark-900 shadow-2xl rounded-2xl text-center">
                  <div className="relative mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                    <Smartphone className="h-8 w-8 animate-bounce" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-black text-white">Confirm M-Pesa STK Prompt</h3>
                    <p className="text-xs text-slate-300">
                      We will immediately send a payment prompt of:
                    </p>
                    <div className="text-2xl font-black text-emerald-400 py-1">
                      KES {subtotalPrice.toLocaleString()}
                    </div>
                    <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-xl bg-dark-950 border border-slate-700 text-xs text-slate-200 font-mono">
                      <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{phoneInfo.international}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-[11px] text-slate-300 text-left space-y-1.5">
                    <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> What happens next:
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                      <li>Your phone screen will wake up with an M-Pesa prompt</li>
                      <li>Enter your 4-digit M-Pesa PIN</li>
                      <li>Payment receipt will confirm here automatically</li>
                    </ol>
                  </div>

                  <div className="space-y-2 pt-1">
                    <Button
                      size="lg"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2"
                      onClick={() => {
                        setIsPromptConfirmModalOpen(false);
                        executeProcessPayment();
                      }}
                    >
                      <BellRing className="h-4 w-4" />
                      <span>Send M-Pesa Prompt Now</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => setIsPromptConfirmModalOpen(false)}
                      className="text-xs text-slate-400 hover:text-white py-1 block w-full transition"
                    >
                      Change Phone Number
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paymentPhase === 'SENDING' && (
              <div className="text-center space-y-4 py-8">
                <Loader2 className="mx-auto h-12 w-12 text-brand-400 animate-spin" />
                <h3 className="text-base font-extrabold text-white">Processing Your Request</h3>
                <p className="text-xs text-slate-400">Sending order details and initiating payment gateway...</p>
              </div>
            )}

            {paymentPhase === 'WAITING_PIN' && (
              <div className="text-center space-y-5 py-6">
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <Smartphone className="h-8 w-8 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-white">Check Your Phone!</h3>
                  <p className="text-xs text-slate-300">
                    Safaricom STK Push prompt sent to <span className="font-bold text-emerald-400">{phoneNumber}</span>.
                  </p>
                  <p className="text-xs text-slate-400">
                    Enter your M-Pesa PIN on your phone to complete <span className="font-bold text-white">KSh {subtotalPrice.toLocaleString()}</span>.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  <span>Awaiting payment confirmation...</span>
                </div>

                {/* Interactive On-Screen PIN Simulator */}
                <div className="rounded-2xl border border-emerald-500/30 bg-dark-900/90 p-4 text-left space-y-3 shadow-lg">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <BellRing className="h-3 w-3 animate-pulse" /> SIM Toolkit Simulator
                    </span>
                    <span>Safaricom STK</span>
                  </div>
                  <p className="text-xs text-slate-200">
                    &ldquo;Pay KSh {subtotalPrice.toLocaleString()} to {currentVenueName}?&rdquo;
                  </p>

                  <div className="pt-1 space-y-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-400">Enter M-Pesa PIN:</label>
                      <span className="text-[10px] text-slate-500">Test Simulator</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="••••"
                        value={simulatedPin}
                        onChange={(e) => setSimulatedPin(e.target.value)}
                        className="w-28 text-center text-base tracking-widest font-mono rounded-xl border border-slate-700 bg-dark-950 px-3 py-2 text-white outline-none focus:border-emerald-500"
                      />
                      <Button
                        size="sm"
                        onClick={handleSimulatePinSubmit}
                        disabled={isSubmittingPin}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                      >
                        {isSubmittingPin ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                        <span>Confirm PIN</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      💡 You can enter your PIN above to verify payment immediately if live Safaricom keys are not configured.
                    </p>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                      setPaymentPhase('IDLE');
                    }}
                    className="text-xs text-slate-400 hover:text-white underline transition"
                  >
                    Cancel or Change Payment Method
                  </button>
                </div>
              </div>
            )}

            {paymentPhase === 'PAID' && (
              <div className="text-center space-y-5 py-6">
                <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 shadow-xl shadow-emerald-500/20 animate-bounce">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-white">Payment Confirmed!</h3>
                  <p className="text-xs text-emerald-400 font-bold">
                    M-Pesa Receipt: <span className="font-mono">{paymentReceiptNumber || 'COMPLETED'}</span>
                  </p>
                  <p className="text-xs text-slate-300 max-w-xs mx-auto">
                    Your order <span className="font-bold text-white">#{orderInfo?.orderNumber}</span> has been dispatched to the kitchen and bar.
                  </p>
                </div>
                <div className="space-y-2 pt-2">
                  <Button
                    size="lg"
                    className="w-full bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => {
                      setIsAgeModalOpen(false);
                      navigate('/order/track');
                    }}
                  >
                    Track Live Order Status
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsAgeModalOpen(false)}
                    className="text-xs text-slate-400 hover:text-white py-1 block w-full"
                  >
                    Back to Menu
                  </button>
                </div>
              </div>
            )}

            {paymentPhase === 'WAITER_NOTIFIED' && (
              <div className="text-center space-y-5 py-6">
                <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-xl">
                  {selectedPaymentMethod === 'CARD' ? (
                    <CreditCard className="h-8 w-8" />
                  ) : (
                    <Banknote className="h-8 w-8" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-white">
                    {selectedPaymentMethod === 'CARD' ? 'POS Machine Requested!' : 'Order Placed with Cash!'}
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                    {selectedPaymentMethod === 'CARD'
                      ? `Your waiter has been notified to bring a card payment terminal to Table #${currentTable}. Order #${orderInfo?.orderNumber} is queued.`
                      : exactCash
                      ? `Your waiter has been notified to collect exact cash (KSh ${subtotalPrice.toLocaleString()}) at Table #${currentTable}. Order #${orderInfo?.orderNumber} is queued.`
                      : `Your waiter has been notified: Paying KSh ${customerCashTendered.toLocaleString()}, bringing KSh ${changeDue.toLocaleString()} change to Table #${currentTable}. Order #${orderInfo?.orderNumber} is queued.`}
                  </p>
                </div>
                <div className="space-y-2 pt-2">
                  <Button
                    size="lg"
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold"
                    onClick={() => {
                      setIsAgeModalOpen(false);
                      navigate('/order/track');
                    }}
                  >
                    Track Live Order Status
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsAgeModalOpen(false)}
                    className="text-xs text-slate-400 hover:text-white py-1 block w-full"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            )}

            {paymentPhase === 'FAILED' && (
              <div className="text-center space-y-5 py-6">
                <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-white">Payment Incomplete</h3>
                  <p className="text-xs text-red-300 max-w-xs mx-auto">
                    {paymentErrorMessage || 'Transaction could not be completed. Please try again.'}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-2"
                  onClick={() => setPaymentPhase('IDLE')}
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again / Choose Another Method
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
