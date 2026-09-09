import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createClient } from '../lib/api';
import { staffAuth } from '../lib/auth';
import { useSocket } from '../lib/socket';
import { useToast } from '../components/Toast';
import { playNewOrderSound, unlockAudio } from '../lib/sound';
import { elapsedMinutes, time, relativeDay, initials, shortName } from '../lib/format';

// Oshpaz paneli — planshet uchun. DOIM qorong'i (tungi/kunduzgi tugma yo'q).
//
// Buyurtma oqimi:
//   new -> QABUL QILISH -> accepted -> TAYYORLANMOQDA -> preparing -> TAYYOR -> ready
//   ready bo'lgach kartochka ro'yxatdan CHIQMAYDI: pastida "Ofitsiant tanlash"
//   qismi ochiladi. Ofitsiant qabul qilsa — kartochka chiqib ketadi.

const NEXT_ACTION = {
  new: { status: 'accepted', label: 'QABUL QILISH', cls: 'accept' },
  accepted: { status: 'preparing', label: 'TAYYORLANMOQDA', cls: 'prepare' },
  preparing: { status: 'ready', label: 'TAYYOR', cls: 'ready' },
};

// Buyurtma oshxona taxtasida turishi kerakmi?
// Serverdagi GET /kitchen/orders shartining aynan o'zi — real-time
// yangilanishlar ro'yxatni sahifa yangilangandagidan farqli qilib
// qo'ymasligi uchun mantiq bir xil bo'lishi shart.
function belongsOnBoard(order) {
  if (['new', 'accepted', 'preparing'].includes(order.status)) return true;
  return order.status === 'ready' && ['none', 'pending', 'declined'].includes(order.assignmentStatus);
}

export default function KitchenApp() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [session] = useState(() => staffAuth.getFor(slug, ['kitchen', 'admin']));
  const [orders, setOrders] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [leavingIds, setLeavingIds] = useState(new Set());
  const [declineNotes, setDeclineNotes] = useState({}); // orderId -> matn
  const [waiterFlash, setWaiterFlash] = useState({}); // waiterId -> 'free'|'busy'
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  soundOnRef.current = soundOn;
  const toast = useToast();

  const logout = useCallback(() => {
    staffAuth.clear(slug, session && session.user.role);
    navigate('/', { replace: true });
  }, [slug, session, navigate]);

  const api = useMemo(
    () =>
      createClient({
        // Tokenni localStorage'dan emas, shu panelning o'z holatidan olamiz:
        // bitta brauzerda boshqa rol (masalan ofitsiant) kirsa ham, bu panel
        // o'z sessiyasi bilan ishlashda davom etadi
        getToken: () => session && session.token,
        getSlug: () => slug,
        onUnauthorized: logout,
      }),
    [slug, session, logout]
  );

  useEffect(() => {
    if (!session) navigate('/', { replace: true });
  }, [session, slug, navigate]);

  const reload = useCallback(async () => {
    try {
      const [o, w, r] = await Promise.all([
        api.get('/kitchen/orders'),
        api.get('/kitchen/waiters'),
        api.get('/kitchen/reservations?scope=today'),
      ]);
      setOrders(o);
      setWaiters(w);
      setReservations(r.filter((x) => x.status !== 'cancelled'));
    } catch (_) {
      /* aloqa tiklanganda qayta urinamiz */
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (session) reload();
  }, [session, reload]);

  // Vaqt hisoblagichlari uchun soniyalik yangilanish
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const flashWaiter = useCallback((waiterId, status) => {
    setWaiterFlash((m) => ({ ...m, [waiterId]: status }));
    setTimeout(() => setWaiterFlash((m) => ({ ...m, [waiterId]: null })), 550);
  }, []);

  const handlers = useMemo(
    () => ({
      new_order: (order) => {
        setOrders((list) => (list.some((o) => o.id === order.id) ? list : [...list, order]));
        if (soundOnRef.current) playNewOrderSound();
      },
      // Buyurtma boshqa joyda o'zgardi (masalan admin bekor qildi yoki
      // ofitsiant oldi) — taxtada qolishi kerakmi yoki yo'qmi, qayta qaraymiz
      order_updated: (order) => {
        setOrders((list) =>
          belongsOnBoard(order)
            ? list.map((o) => (o.id === order.id ? order : o))
            : list.filter((o) => o.id !== order.id)
        );
      },
      order_ready: (order) => {
        setOrders((list) => (list.some((o) => o.id === order.id) ? list.map((o) => (o.id === order.id ? order : o)) : [...list, order]));
      },
      waiter_response: ({ orderId, waiterName, accepted, order }) => {
        if (accepted) {
          // Ofitsiant oldi — kartochka slayd bilan chiqib ketadi
          setLeavingIds((s) => new Set(s).add(orderId));
          setTimeout(() => {
            setOrders((list) => list.filter((o) => o.id !== orderId));
            setLeavingIds((s) => {
              const next = new Set(s);
              next.delete(orderId);
              return next;
            });
          }, 350);
        } else {
          setOrders((list) => list.map((o) => (o.id === orderId ? order : o)));
          setDeclineNotes((m) => ({ ...m, [orderId]: `${waiterName} rad etdi, boshqasini tanlang` }));
          setTimeout(() => setDeclineNotes((m) => ({ ...m, [orderId]: null })), 3000);
        }
      },
      waiter_status_changed: ({ waiterId, status, assignmentStatus, tableNumber, orderId }) => {
        setWaiters((list) =>
          list.map((w) =>
            w.id === waiterId
              ? {
                  ...w,
                  status,
                  assignmentStatus: assignmentStatus || 'none',
                  busyWithTableNumber: status === 'busy' ? tableNumber : null,
                  busyWithOrderId: status === 'busy' ? orderId : null,
                }
              : w
          )
        );
        flashWaiter(waiterId, status);
      },
      new_reservation: (reservation) => setReservations((list) => [...list, reservation]),
      reservation_updated: () => reload(),
    }),
    [flashWaiter, reload]
  );

  const { connected } = useSocket(session && session.token, handlers, reload);

  async function advance(order) {
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    try {
      const updated = await api.patch(`/kitchen/orders/${order.id}/status`, { status: action.status });
      setOrders((list) => list.map((o) => (o.id === order.id ? updated : o)));
    } catch (err) {
      toast.error(err.message);
      reload();
    }
  }

  async function cancel(order) {
    if (!window.confirm(`${order.table.tableNumber}-stol buyurtmasi bekor qilinsinmi?`)) return;
    try {
      await api.patch(`/kitchen/orders/${order.id}/status`, { status: 'cancelled' });
      setOrders((list) => list.filter((o) => o.id !== order.id));
    } catch (err) {
      toast.error(err.message);
      reload();
    }
  }

  async function assign(order, waiter) {
    try {
      const updated = await api.patch(`/kitchen/orders/${order.id}/assign-waiter`, { waiterId: waiter.id });
      setOrders((list) => list.map((o) => (o.id === order.id ? updated : o)));
      setDeclineNotes((m) => ({ ...m, [order.id]: null }));
    } catch (err) {
      toast.error(err.message);
      reload();
    }
  }

  if (!session) return null;

  const freeWaiters = waiters.filter((w) => w.status === 'free');

  return (
    <div className="app-kitchen app-surface" onPointerDown={unlockAudio}>
      <div className="surface-aurora" aria-hidden="true">
        <span className="aurora-blob a1" />
        <span className="aurora-blob a2" />
      </div>

      <header className="k-topbar">
        <h1>OSHXONA</h1>
        <span className={`k-live${connected ? '' : ' off'}`}>
          {connected ? 'JONLI' : 'ALOQA YO\'Q'}
        </span>
        <span style={{ fontSize: 17, color: 'var(--k-dim)' }}>{orders.length} ta buyurtma</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="k-clock">{time(now)}</span>
          <button
            type="button"
            className="k-topbtn"
            onClick={() => {
              unlockAudio();
              setSoundOn((v) => !v);
            }}
            title="Ovozli signal"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button type="button" className="k-topbtn" onClick={logout}>
            Chiqish
          </button>
        </div>
      </header>

      <div className="k-body">
        <div className="k-board">
          {loading && <div className="k-empty">Yuklanmoqda…</div>}
          {!loading && orders.length === 0 && <div className="k-empty">Hozircha buyurtma yo'q ✓</div>}

          {orders.map((order) => {
            const action = NEXT_ACTION[order.status];
            const minutes = elapsedMinutes(order.createdAt, now);
            const timerClass = minutes >= 10 ? 'danger' : minutes >= 5 ? 'warn' : '';
            const waitingFor =
              order.assignmentStatus === 'pending' && order.assignedWaiter ? order.assignedWaiter : null;

            return (
              <article
                key={order.id}
                className={`k-card status-${order.status}${leavingIds.has(order.id) ? ' leaving' : ''}`}
              >
                <div className="k-card-head">
                  <span className="k-table-no">{order.table ? order.table.tableNumber : '—'}</span>
                  <span className="k-client">{order.clientName}</span>
                  <span className={`k-timer ${timerClass}`}>{minutes}′</span>
                </div>

                <div className="k-items">
                  {order.items.map((item) => (
                    <div className="k-item" key={item.id}>
                      <span className="k-item-qty">×{item.quantity}</span>
                      <span>
                        {item.menuItem.name}
                        {item.note && <span className="k-item-note">↳ {item.note}</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {action && (
                  <button type="button" className={`k-action ${action.cls}`} onClick={() => advance(order)}>
                    {action.label}
                  </button>
                )}

                {order.status === 'ready' && (
                  <div className="k-assign">
                    {waitingFor ? (
                      <>
                        <div className="row" style={{ gap: 12 }}>
                          {/* Tanlangan ofitsiant — sariq aylanuvchi "kutilmoqda" halqasi bilan */}
                          <div className="k-avatar waiting">
                            <span className="k-avatar-circle">{initials(waitingFor.fullName)}</span>
                          </div>
                          <div className="k-waiting-text">⏳ {waitingFor.fullName} javobini kutmoqda…</div>
                        </div>
                        <div className="k-assign-label" style={{ marginTop: 10 }}>
                          Boshqasini tanlash:
                        </div>
                        <WaiterAvatars
                          waiters={freeWaiters.filter((w) => w.id !== waitingFor.id)}
                          onPick={(w) => assign(order, w)}
                        />
                      </>
                    ) : (
                      <>
                        <div className="k-assign-label">OFITSIANT TANLASH</div>
                        {freeWaiters.length === 0 ? (
                          <div className="k-no-waiters">Hozir bo'sh ofitsiant yo'q — kuting</div>
                        ) : (
                          <WaiterAvatars waiters={freeWaiters} onPick={(w) => assign(order, w)} />
                        )}
                      </>
                    )}
                    {declineNotes[order.id] && <div className="k-declined-text">{declineNotes[order.id]}</div>}
                  </div>
                )}

                {order.status !== 'ready' && (
                  <button type="button" className="k-cancel" onClick={() => cancel(order)}>
                    Bekor qilish
                  </button>
                )}
              </article>
            );
          })}
        </div>

        <aside className="k-waiters">
          <h2>Ofitsiantlar</h2>
          {waiters.length === 0 && <div className="k-no-waiters">Ofitsiant qo'shilmagan</div>}
          {waiters.map((w) => (
            <div
              key={w.id}
              className={`k-waiter-card${w.status === 'busy' ? ' busy' : ''}${
                waiterFlash[w.id] ? ` flash-${waiterFlash[w.id]}` : ''
              }`}
            >
              <div className="k-waiter-avatar">{initials(w.fullName)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="k-waiter-name">{w.fullName}</div>
                <div className="k-waiter-sub">
                  {w.status === 'busy'
                    ? w.busyWithTableNumber
                      ? `${w.busyWithTableNumber}-stol bilan band`
                      : 'Band'
                    : 'Bo\'sh'}
                </div>
              </div>
              <span className={`k-dot ${w.status}`} />
            </div>
          ))}

          {reservations.length > 0 && (
            <>
              <h2 style={{ marginTop: 22 }}>Bugungi bronlar</h2>
              {reservations.map((r) => (
                <div className="k-res-item" key={r.id}>
                  <b>{time(r.reservationDate)}</b> · {r.clientName}
                  <div style={{ color: 'var(--k-dim)', fontSize: 12.5, marginTop: 3 }}>
                    {r.partySize} kishi · {relativeDay(r.reservationDate)}
                    {r.status === 'pending' && ' · tasdiqlanmagan'}
                  </div>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function WaiterAvatars({ waiters, onPick }) {
  if (waiters.length === 0) return null;
  return (
    <div className="k-avatars">
      {waiters.map((w) => (
        <button type="button" className="k-avatar" key={w.id} onClick={() => onPick(w)}>
          <span className="k-avatar-circle">{initials(w.fullName)}</span>
          <span className="k-avatar-name">{shortName(w.fullName)}</span>
        </button>
      ))}
    </div>
  );
}
