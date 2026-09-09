import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { createClient, request } from '../lib/api';
import { clientAuth } from '../lib/auth';
import { useSocket } from '../lib/socket';
import { useToast } from '../components/Toast';
import SuspendedPage from '../pages/SuspendedPage';
import WelcomeScreen from './WelcomeScreen';
import MenuScreen from './MenuScreen';
import CartScreen from './CartScreen';
import TrackScreen from './TrackScreen';
import DemoBanner from './DemoBanner';
import { DEMO_MENU, DEMO_PLACE, DEMO_FLOW } from './demoData';

// Mijoz ilovasi (Telegram Mini App).
//
// Uch xil kirish:
//   mode="qr"     — /t/:slug/:qrToken — stol ustidagi QR skanerlangan
//   mode="picker" — /m/:slug          — bot orqali, stolni o'zi tanlaydi
//                   (bot allaqachon stolni band qilgan bo'lsa, token
//                    query'da keladi va ism so'ralmaydi)
//   mode="demo"   — /demo             — NAMUNA. Serverga bitta ham so'rov
//                   ketmaydi, hech qanday haqiqiy muassasa ochilmaydi.
//                   Ro'yxatdan o'tmagan odam ilovani shu yerda ko'radi.
//
// Namuna rejimida ekranlar HAQIQIYSINING O'ZI — faqat ma'lumot manbasi
// boshqa. Shu sababli demo har doim ilovaning haqiqiy holatini ko'rsatadi:
// menyu ekranini o'zgartirsak, demo ham o'zi bilan o'zgaradi.

export default function ClientApp({ mode }) {
  const { slug: routeSlug, qrToken } = useParams();
  const demo = mode === 'demo';
  const slug = demo ? DEMO_PLACE.slug : routeSlug;
  const [query] = useSearchParams();
  // Namuna sessiyasi saqlanmaydi: har safar kirgan odam ilovani boshidan,
  // kirish ekranidan ko'rsin
  const [session, setSession] = useState(() => (demo ? null : clientAuth.get(slug)));
  const [screen, setScreen] = useState('welcome');
  const [direction, setDirection] = useState('right');
  const [menu, setMenu] = useState(demo ? DEMO_MENU : null);
  const [place, setPlace] = useState(demo ? DEMO_PLACE : null);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [pastOrders, setPastOrders] = useState([]);
  const [suspended, setSuspended] = useState(null);
  const [fatalError, setFatalError] = useState('');
  // Ekran tanlovi bir marta — birinchi yuklashda — qilinadi
  const initialRouteDone = useRef(false);
  const toast = useToast();

  const clearSession = useCallback(() => {
    clientAuth.clear(slug);
    setSession(null);
    setScreen('welcome');
    setActiveOrder(null);
    setCart([]);
    initialRouteDone.current = false;
    toast.error('Sessiya tugadi, qaytadan kiriting');
  }, [slug, toast]);

  // Namuna rejimida server yo'q: ilova chaqiradigan har bir amal shu yerda
  // taqlid qilinadi. Shu bilan ekranlarga birorta ham `if (demo)` shart
  // qo'shilmaydi — ular baribir "api" bilan gaplashadi.
  const api = useMemo(() => {
    if (demo) {
      return {
        get: async () => [],
        post: async () => ({}),
        patch: async (path) => {
          if (/\/cancel$/.test(path)) setActiveOrder((o) => (o ? { ...o, status: 'cancelled' } : o));
          return {};
        },
        del: async () => ({}),
        blob: async () => null,
        upload: async () => ({}),
        raw: async () => ({}),
      };
    }
    return createClient({
      getToken: () => (clientAuth.get(slug) || {}).token,
      getSlug: () => slug,
      onUnauthorized: clearSession,
    });
  }, [demo, slug, clearSession]);

  // Telegram Mini App ichida bo'lsak — to'liq ekranga o'tamiz
  useEffect(() => {
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch (_) {
      /* oddiy brauzerda ochilgan — e'tiborsiz qoldiramiz */
    }
  }, []);

  // Bot yuborgan tayyor sessiya (token query'da)
  useEffect(() => {
    if (session || mode !== 'picker') return;
    const token = query.get('token');
    const tableId = query.get('table');
    const name = query.get('name');
    if (token && tableId) {
      const s = {
        token,
        table: { id: tableId, tableNumber: Number(query.get('n')) || null },
        clientName: name || 'Mehmon',
      };
      clientAuth.set(slug, s);
      setSession(s);
    }
  }, [mode, query, session, slug]);

  // Menyuni yuklash (namunada u allaqachon xotirada)
  const loadMenu = useCallback(async () => {
    if (demo) return;
    try {
      setMenu(await request('/menu', { slug }));
    } catch (err) {
      if (err.status === 403) setSuspended(err.data && err.data.message);
      else if (err.status === 404) setFatalError('Restoran topilmadi');
      else setFatalError(err.message);
    }
  }, [demo, slug]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Muassasa nomi — sarlavhada slug ("delish") emas, haqiqiy nom tursin
  useEffect(() => {
    if (demo) return undefined;
    let alive = true;
    request('/client/place', { slug })
      .then((data) => alive && setPlace(data))
      .catch(() => {
        /* nom kelmasa ham ilova ishlashda davom etadi */
      });
    return () => {
      alive = false;
    };
  }, [demo, slug]);

  // Sessiya bor bo'lsa — mavjud buyurtmalarni tiklaymiz.
  //
  // Ekranni FAQAT birinchi yuklashda almashtiramiz. Aks holda mijoz ikkinchi
  // buyurtma uchun menyuni ko'rib turganda aloqa uzilib-ulansa, uni kuzatuv
  // ekraniga majburan tortib ketardi.
  const loadOrders = useCallback(async () => {
    if (demo) return;
    if (!clientAuth.get(slug)) return;
    try {
      const orders = await api.get('/client/orders');
      setPastOrders(orders);

      const open = orders.find((o) => !['delivered', 'paid', 'cancelled'].includes(o.status));
      if (open) setActiveOrder((current) => current || open);

      if (!initialRouteDone.current) {
        initialRouteDone.current = true;
        setScreen(open ? 'track' : 'menu');
      }
    } catch (_) {
      /* 401 bo'lsa onUnauthorized allaqachon sessiyani tozalaydi */
    }
  }, [api, demo, slug]);

  useEffect(() => {
    if (session) loadOrders();
  }, [session, loadOrders]);

  const handlers = useMemo(
    () => ({
      order_status_changed: (order) => {
        setActiveOrder((current) => (current && current.id === order.id ? order : current));
        setPastOrders((list) => list.map((o) => (o.id === order.id ? order : o)));
      },
    }),
    []
  );

  useSocket(session && session.token, handlers, loadOrders);

  function go(next, dir = 'right') {
    setDirection(dir);
    setScreen(next);
  }

  // ---- Savat amallari ----
  const addToCart = useCallback((item, quantity = 1, note = '') => {
    setCart((list) => {
      const existing = list.find((c) => c.menuItemId === item.id && (c.note || '') === (note || ''));
      if (existing) {
        return list.map((c) => (c === existing ? { ...c, quantity: c.quantity + quantity } : c));
      }
      return [
        ...list,
        { menuItemId: item.id, name: item.name, price: Number(item.price), imageUrl: item.imageUrl, quantity, note: note || '' },
      ];
    });
  }, []);

  const setQuantity = useCallback((menuItemId, note, quantity) => {
    setCart((list) =>
      quantity <= 0
        ? list.filter((c) => !(c.menuItemId === menuItemId && (c.note || '') === (note || '')))
        : list.map((c) =>
            c.menuItemId === menuItemId && (c.note || '') === (note || '') ? { ...c, quantity } : c
          )
    );
  }, []);

  async function startSession(clientName, tableId) {
    if (demo) {
      // Namunada stol "7" — bironta ham haqiqiy stol band qilinmaydi
      const data = { token: null, table: { id: 'demo-table', tableNumber: 7 }, clientName };
      setSession(data);
      initialRouteDone.current = true;
      go('menu', 'right');
      return data;
    }

    const data =
      mode === 'qr'
        ? await request('/client/session', { method: 'POST', slug, body: { qrToken, clientName } })
        : await request(`/client/tables/${tableId}/claim`, { method: 'POST', slug, body: { clientName } });
    clientAuth.set(slug, data);
    setSession(data);
    initialRouteDone.current = true;
    go('menu', 'right');
    return data;
  }

  // Namuna buyurtmasi: oshxona va ofitsiant o'rniga taymer "bosadi", shunda
  // odam kuzatuv ekranining butun yo'lini — qabuldan yetkazishgacha — ko'radi
  const demoTimers = useRef([]);
  useEffect(() => () => demoTimers.current.forEach(clearTimeout), []);

  function startDemoFlow(order) {
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    let delay = 0;
    for (const step of DEMO_FLOW) {
      delay += step.afterMs;
      demoTimers.current.push(
        setTimeout(() => {
          const next = { ...order, status: step.status };
          setActiveOrder((current) => (current && current.id === order.id ? next : current));
          setPastOrders((list) => list.map((o) => (o.id === order.id ? next : o)));
        }, delay)
      );
    }
  }

  async function submitOrder() {
    if (demo) {
      const order = {
        id: `demo-${Date.now()}`,
        status: 'new',
        createdAt: new Date().toISOString(),
        totalPrice: cart.reduce((sum, c) => sum + c.price * c.quantity, 0),
        items: cart.map((c, i) => ({
          id: `demo-line-${i}`,
          quantity: c.quantity,
          note: c.note || null,
          priceAtOrderTime: c.price,
          menuItem: { name: c.name },
        })),
      };
      setCart([]);
      setActiveOrder(order);
      setPastOrders((list) => [order, ...list]);
      startDemoFlow(order);
      go('track', 'right');
      return order;
    }

    const order = await api.post('/client/orders', {
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        note: c.note || undefined,
      })),
    });
    setCart([]);
    setActiveOrder(order);
    setPastOrders((list) => [order, ...list]);
    go('track', 'right');
    return order;
  }

  if (suspended) return <SuspendedPage message={suspended} />;

  if (fatalError) {
    return (
      <div className="app-client">
        <div className="c-screen" style={{ justifyContent: 'center' }}>
          <div className="c-error-box">{fatalError}</div>
        </div>
      </div>
    );
  }

  const animClass = direction === 'right' ? 'enter-right' : 'enter-left';

  return (
    <div className="app-client">
      {(!session || screen === 'welcome') && (
        <WelcomeScreen
          mode={mode}
          slug={slug}
          placeName={place && place.name}
          session={session}
          onStart={startSession}
          onContinue={() => go('menu', 'right')}
        />
      )}

      {session && screen === 'menu' && (
        <MenuScreen
          key="menu"
          animClass={animClass}
          menu={menu}
          restaurantName={place && place.name}
          session={session}
          cart={cart}
          api={api}
          onAdd={addToCart}
          onSetQuantity={setQuantity}
          onOpenCart={() => go('cart', 'right')}
          onOpenTrack={activeOrder ? () => go('track', 'right') : null}
        />
      )}

      {session && screen === 'cart' && (
        <CartScreen
          key="cart"
          animClass={animClass}
          cart={cart}
          onBack={() => go('menu', 'left')}
          onSetQuantity={setQuantity}
          onSubmit={submitOrder}
        />
      )}

      {session && screen === 'track' && (
        <TrackScreen
          key="track"
          animClass={animClass}
          order={activeOrder}
          pastOrders={pastOrders}
          session={session}
          api={api}
          onSelectOrder={setActiveOrder}
          onBackToMenu={() => go('menu', 'left')}
        />
      )}

      {/* Eng oxirida: shunda savat paneli chiqqanda CSS uni ko'tara oladi */}
      {demo && <DemoBanner />}
    </div>
  );
}
