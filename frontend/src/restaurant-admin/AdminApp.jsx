import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '../lib/api';
import { staffAuth, ROLE_LABELS, loginPathFrom, panelPathForRole } from '../lib/auth';
import { ThemeToggle } from '../lib/theme';
import { useSocket } from '../lib/socket';
import DashboardPage from './DashboardPage';
import MenuPage from './MenuPage';
import TablesPage from './TablesPage';
import StaffPage from './StaffPage';
import ReservationsPage from './ReservationsPage';
import OrdersPage from './OrdersPage';
import BrandPage from './BrandPage';
import BillingPage from './BillingPage';
import BillingBanner from './BillingBanner';

export default function AdminApp() {
  const { slug } = useParams();
  const navigate = useNavigate();
  // Sessiya tugaganda qayerda turganimizni shu manzil aytadi.
  // `window.location` EMAS: u yo'naltirishdan keyin darhol o'zgaradi va
  // effekt ikkinchi marta ishlaganda manzil o'z ichiga o'ralib ketardi.
  // Ref orqali olinadi, chunki har bo'lim almashganda `api` qayta
  // yaratilib, sahifalar behuda qayta yuklanmasligi kerak.
  const routeHere = useLocation();
  const hereRef = useRef(routeHere);
  hereRef.current = routeHere;
  const [session, setSession] = useState(() => staffAuth.getFor(slug, ['admin']));
  const [restaurant, setRestaurant] = useState(null);
  const [pendingReservations, setPendingReservations] = useState(0);
  const [billing, setBilling] = useState(null);
  // Yangi buyurtma/bron hodisalari sahifalarga shu hisoblagich orqali uzatiladi:
  // qiymati o'zgarganda tegishli sahifa ro'yxatini qayta yuklaydi
  const [liveTick, setLiveTick] = useState(0);

  // Yon paneldagi havolalar MUTLAQ yo'l bilan yoziladi.
  // Nisbiy yo'l ("orders") splat marshrut ichida joriy manzilga qo'shilib
  // ketardi: /delish/admin/orders -> /delish/admin/orders/reservations,
  // ya'ni birinchi o'tishdan keyin hech qaysi bo'lim ochilmay qolardi.
  const base = `/${slug}/admin`;

  // Chiqishda ham, token eskirganda ham shu ishlaydi. Farqi: `keepPlace`
  // bo'lsa, odam turgan manzil `?next=` da saqlanadi va u qaytadan
  // kirgach aynan o'sha bo'limga qaytadi.
  const leave = useCallback(
    (keepPlace) => {
      staffAuth.clear(slug, 'admin');
      setSession(null);
      navigate(keepPlace ? loginPathFrom(hereRef.current) : '/', { replace: true });
    },
    [slug, navigate]
  );

  const logout = useCallback(() => leave(false), [leave]);
  const sessionExpired = useCallback(() => leave(true), [leave]);

  const api = useMemo(
    () =>
      createClient({
        // Tokenni localStorage'dan emas, shu panelning o'z holatidan olamiz:
        // bitta brauzerda boshqa rol (masalan ofitsiant) kirsa ham, bu panel
        // o'z sessiyasi bilan ishlashda davom etadi
        getToken: () => session && session.token,
        getSlug: () => slug,
        onUnauthorized: sessionExpired,
      }),
    [slug, session, sessionExpired]
  );

  // SAHIFA YANGILANGANDA (F5) NIMA BO'LADI.
  //
  // Sessiya localStorage'da turadi, shuning uchun yangilanish uni
  // yo'qotmaydi — odam o'zi turgan bo'limda qoladi, sahifa esa yangilanadi.
  // Sessiya haqiqatan yo'q bo'lsagina login sahifasiga chiqamiz, va o'shanda
  // ham qayerda turganini `?next=` da olib ketamiz.
  useEffect(() => {
    if (!session) {
      // Shu muassasada boshqa rol bilan kirilgan bo'lsa — login emas,
      // o'sha odamning O'Z paneliga yuboramiz
      const other = staffAuth.anyFor(slug);
      if (other) {
        navigate(panelPathForRole(slug, other.user.role), { replace: true });
        return;
      }
      navigate(loginPathFrom(hereRef.current), { replace: true });
      return;
    }
    if (session.user.role !== 'admin') {
      navigate(`/${slug}/${session.user.role}`, { replace: true });
    }
  }, [session, slug, navigate]);

  useEffect(() => {
    if (!session) return;
    api.get('/admin/restaurant').then(setRestaurant).catch(() => {});
  }, [api, session]);

  // TO'LOV ESLATMASI har kirishda tekshiriladi — "har kuni loyihaga
  // kirilganda eslatilsin" degani aynan shu. Xizmat to'xtatilgan bo'lsa
  // ham bu so'rov o'tadi (server `/billing` yo'lini alohida o'tkazadi).
  const loadBilling = useCallback(() => {
    api.get('/admin/billing').then(setBilling).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (session) loadBilling();
  }, [session, loadBilling]);

  // Yon paneldagi bron belgisi. Hisob SERVERDAN olinadi — avval u faqat
  // socket hodisalaridan o'sardi va sahifa ochilganda doim 0 ko'rinardi.
  useEffect(() => {
    if (!session) return;
    api
      .get('/kitchen/reservations?scope=upcoming')
      .then((list) => setPendingReservations(list.filter((r) => r.status === 'pending').length))
      .catch(() => {});
  }, [api, session, liveTick]);

  const handlers = useMemo(
    () => ({
      new_order: () => setLiveTick((t) => t + 1),
      order_updated: () => setLiveTick((t) => t + 1),
      order_status_changed: () => setLiveTick((t) => t + 1),
      new_reservation: () => setLiveTick((t) => t + 1),
      reservation_updated: () => setLiveTick((t) => t + 1),
      table_claimed: () => setLiveTick((t) => t + 1),
      table_released: () => setLiveTick((t) => t + 1),
      waiter_status_changed: () => setLiveTick((t) => t + 1),
    }),
    []
  );

  const { connected } = useSocket(session && session.token, handlers, () => setLiveTick((t) => t + 1));

  if (!session) return null;

  return (
    <div className="app-delish app-surface">

      <div className="surface-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
      </div>

      <div className="dl-shell">
        <aside className="dl-side">
          <div className="dl-brand">
            <b>{restaurant ? restaurant.name : slug}</b>
            <span>Admin panel</span>
          </div>

          <NavLink to={base} end className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>◈</span> Boshqaruv
          </NavLink>
          <NavLink to={`${base}/orders`} className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>▤</span> Buyurtmalar
          </NavLink>
          <NavLink to={`${base}/menu`} className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>🍽</span> Menyu
          </NavLink>
          <NavLink to={`${base}/tables`} className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>⬚</span> Stollar
          </NavLink>
          <NavLink to={`${base}/reservations`} className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>📅</span> Bronlar
            {pendingReservations > 0 && <span className="dl-nav-badge">{pendingReservations}</span>}
          </NavLink>
          <NavLink to={`${base}/staff`} className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>👥</span> Xodimlar
          </NavLink>
          <NavLink to={`${base}/brand`} className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>🎨</span> Brend
          </NavLink>
          <NavLink to={`${base}/billing`} className={({ isActive }) => `dl-nav-link${isActive ? ' active' : ''}`}>
            <span>💳</span> To'lov
            {billing && billing.state !== 'ok' && <span className="dl-nav-badge">!</span>}
          </NavLink>

          <div className="dl-side-foot">
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{session.user.fullName}</div>
            <div style={{ marginTop: 2 }}>{ROLE_LABELS[session.user.role]}</div>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={logout}>
              Chiqish
            </button>
          </div>
        </aside>

        <main className="dl-main">
          <header className="dl-topbar">
            <span className={`live-dot${connected ? '' : ' off'}`}>
              {connected ? 'Jonli ulanish' : 'Aloqa uzildi'}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {restaurant && (
                <span className={`status-badge ${restaurant.subscriptionStatus}`}>
                  {restaurant.subscriptionPlan}
                </span>
              )}
              <ThemeToggle />
            </div>
          </header>

          <div className="dl-content">
            <BillingBanner billing={billing} base={base} />
            <Routes>
              <Route path="/" element={<DashboardPage api={api} liveTick={liveTick} />} />
              <Route path="orders" element={<OrdersPage api={api} liveTick={liveTick} />} />
              <Route path="menu" element={<MenuPage api={api} />} />
              <Route path="tables" element={<TablesPage api={api} slug={slug} liveTick={liveTick} />} />
              <Route path="reservations" element={<ReservationsPage api={api} liveTick={liveTick} />} />
              <Route path="billing" element={<BillingPage billing={billing} />} />
              <Route
                path="brand"
                element={
                  <BrandPage
                    api={api}
                    restaurant={restaurant}
                    onSaved={() => api.get('/admin/restaurant').then(setRestaurant).catch(() => {})}
                  />
                }
              />
              <Route path="staff" element={<StaffPage api={api} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
