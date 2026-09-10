import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { createClient } from '../lib/api';
import { staffAuth, loginPathFrom, panelPathForRole } from '../lib/auth';
import { ThemeToggle } from '../lib/theme';
import { useSocket } from '../lib/socket';
import { useToast } from '../components/Toast';
import { Sheet } from '../components/Modal';
import { playAssignmentSound, unlockAudio, haptic } from '../lib/sound';
import { money, elapsed } from '../lib/format';

// Ofitsiant paneli — telefon uchun.
//
// Oqim: oshpaz taklif yuboradi -> to'liq ekranli taklif kartasi + ovoz
//       -> [QABUL QILISH] yoki [O'TKAZIB YUBORISH]
//       -> qabul qilinsa asosiy ro'yxatga tushadi, tugmasi "YETKAZDIM"

export default function WaiterApp() {
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
  const [session] = useState(() => staffAuth.getFor(slug, ['waiter', 'admin']));
  const [orders, setOrders] = useState([]);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busySubmit, setBusySubmit] = useState(false);
  const [leavingIds, setLeavingIds] = useState(new Set());
  const [calls, setCalls] = useState([]);
  const toast = useToast();
  const offerRef = useRef(null);
  offerRef.current = offer;

  // Chiqishda ham, token eskirganda ham shu ishlaydi. Farqi: `keepPlace`
  // bo'lsa, turgan manzil `?next=` da saqlanadi va odam qaytadan kirgach
  // aynan o'sha yerga qaytadi.
  const leave = useCallback(
    (keepPlace) => {
      staffAuth.clear(slug, session && session.user.role);
      navigate(keepPlace ? loginPathFrom(hereRef.current) : '/', { replace: true });
    },
    [slug, session, navigate]
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

  // F5 sessiyani yo'qotmaydi — u localStorage'da. Sessiya haqiqatan yo'q
  // bo'lsagina chiqamiz, o'shanda ham qayerda turganini olib ketamiz.
  useEffect(() => {
    if (session) return;
    const other = staffAuth.anyFor(slug);
    if (other) {
      navigate(panelPathForRole(slug, other.user.role), { replace: true });
      return;
    }
    navigate(loginPathFrom(hereRef.current), { replace: true });
  }, [session, slug, navigate]);

  const reload = useCallback(async () => {
    try {
      const list = await api.get('/waiter/orders');
      setOrders(list.filter((o) => o.assignmentStatus === 'accepted'));
      // Sahifa yangilangan bo'lsa ham javob berilmagan taklif yo'qolib ketmasin
      const pending = list.find((o) => o.assignmentStatus === 'pending');
      if (pending && !offerRef.current) setOffer(pending);
    } catch (_) {
      /* aloqa tiklanganda qayta urinamiz */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (session) reload();
  }, [session, reload]);

  const handlers = useMemo(
    () => ({
      order_assigned: (order) => {
        setOffer(order);
        playAssignmentSound();
        haptic('warning');
      },
      // Buyurtma endi bu ofitsiantniki emas: oshpaz boshqasini tanladi
      // yoki admin buyurtmani bekor qildi. Ikkala holatda ham taklif
      // modalini yopamiz VA kartochkani ro'yxatdan olib tashlaymiz.
      assignment_revoked: ({ orderId }) => {
        setOffer((current) => (current && current.id === orderId ? null : current));
        setOrders((list) => list.filter((o) => o.id !== orderId));
      },
      waiter_called: (payload) => {
        setCalls((list) => [...list, { ...payload, key: `${payload.tableId}-${payload.at}` }]);
        haptic('impact');
        setTimeout(
          () => setCalls((list) => list.filter((c) => c.key !== `${payload.tableId}-${payload.at}`)),
          12000
        );
      },
    }),
    []
  );

  const { connected } = useSocket(session && session.token, handlers, reload);

  async function respond(accept) {
    if (!offer) return;
    setBusySubmit(true);
    try {
      const updated = await api.patch(`/waiter/orders/${offer.id}/respond`, { accept });
      setOffer(null);
      if (accept) {
        setOrders((list) => (list.some((o) => o.id === updated.id) ? list : [...list, updated]));
        haptic('success');
      }
    } catch (err) {
      toast.error(err.message);
      setOffer(null);
      reload();
    } finally {
      setBusySubmit(false);
    }
  }

  async function deliver(order) {
    setLeavingIds((s) => new Set(s).add(order.id));
    try {
      await api.patch(`/waiter/orders/${order.id}/status`, { status: 'delivered' });
      haptic('success');
      setTimeout(() => {
        setOrders((list) => list.filter((o) => o.id !== order.id));
        setLeavingIds((s) => {
          const next = new Set(s);
          next.delete(order.id);
          return next;
        });
      }, 300);
    } catch (err) {
      toast.error(err.message);
      setLeavingIds((s) => {
        const next = new Set(s);
        next.delete(order.id);
        return next;
      });
    }
  }

  if (!session) return null;

  return (
    <div className="app-waiter app-surface" onPointerDown={unlockAudio}>
      <div className="surface-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
      </div>

      <header className="w-topbar">
        <h1>{session.user.fullName.split(' ')[0]}</h1>
        <span className={`w-live${connected ? '' : ' off'}`}>{connected ? 'Jonli' : 'Aloqa yo\'q'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <ThemeToggle />
          <button type="button" className="w-iconbtn" onClick={logout} aria-label="Chiqish">
            ⏻
          </button>
        </div>
      </header>

      <div className={`w-status-strip${orders.length > 0 ? ' busy' : ''}`}>
        {orders.length > 0 ? `${orders.length} ta buyurtma sizda` : 'Bo\'shsiz — taklif kutilmoqda'}
      </div>

      {calls.length > 0 && (
        <div style={{ paddingTop: 12, display: 'grid', gap: 8 }}>
          {calls.map((c) => (
            <div className="w-call-banner" key={c.key}>
              🔔 {c.tableNumber}-stol sizni chaqirmoqda ({c.clientName})
            </div>
          ))}
        </div>
      )}

      <div className="w-list">
        {loading && (
          <div className="w-empty">
            <span className="spinner spinner-lg" />
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="w-empty">
            <div className="w-empty-icon">🍽</div>
            Hozircha sizda buyurtma yo'q.
            <br />
            Oshpaz taklif yuborganda ekran o'zi ochiladi.
          </div>
        )}

        {orders.map((order) => (
          <article key={order.id} className={`w-card${leavingIds.has(order.id) ? ' leaving' : ''}`}>
            <div className="w-card-head">
              <span className="w-table-no">{order.table ? order.table.tableNumber : '—'}</span>
              <span className="w-client">{order.clientName}</span>
              <span className="w-since">{elapsed(order.updatedAt)}</span>
            </div>

            <div className="w-items">
              {order.items.map((item) => (
                <div className="w-item" key={item.id}>
                  <span className="w-item-qty">×{item.quantity}</span>
                  <span>
                    {item.menuItem.name}
                    {item.note && <span className="w-item-note">↳ {item.note}</span>}
                  </span>
                </div>
              ))}
            </div>

            <div className="w-total">
              <span>Jami</span>
              <b>{money(order.totalPrice)}</b>
            </div>

            <button type="button" className="w-action" onClick={() => deliver(order)}>
              YETKAZDIM
            </button>
          </article>
        ))}
      </div>

      <Sheet open={!!offer} onClose={() => {}} className="w-offer">
        {offer && (
          <>
            <div className="w-offer-head">
              <div className="w-offer-badge">Yangi taklif</div>
              <div className="w-offer-table">{offer.table ? offer.table.tableNumber : '—'}</div>
              <div className="w-offer-client">{offer.clientName}</div>
            </div>

            <div className="w-offer-items">
              {offer.items.map((item) => (
                <div className="w-item" key={item.id}>
                  <span className="w-item-qty">×{item.quantity}</span>
                  <span>
                    {item.menuItem.name}
                    {item.note && <span className="w-item-note">↳ {item.note}</span>}
                  </span>
                </div>
              ))}
              <div className="w-total" style={{ paddingLeft: 0, paddingRight: 0, marginTop: 8 }}>
                <span>Jami</span>
                <b>{money(offer.totalPrice)}</b>
              </div>
            </div>

            <div className="w-offer-actions">
              <button
                type="button"
                className="w-offer-btn accept"
                disabled={busySubmit}
                onClick={() => respond(true)}
              >
                ✓ QABUL QILISH
              </button>
              <button
                type="button"
                className="w-offer-btn skip"
                disabled={busySubmit}
                onClick={() => respond(false)}
              >
                ✕ O'TKAZIB YUBORISH
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
