import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { haptic } from '../lib/sound';
import { money, time, ORDER_STATUS_LABELS } from '../lib/format';

// Ekran 4 — buyurtma holatini kuzatish.
// Socket orqali `order_status_changed` kelganda progress to'ldiriladi,
// sarlavha fade bilan almashadi, "tayyor" bo'lganda vibratsiya beriladi.

const STEPS = [
  { key: 'accepted', label: 'Qabul\nqilindi', statuses: ['accepted'] },
  { key: 'preparing', label: 'Tayyor-\nlanmoqda', statuses: ['preparing'] },
  { key: 'ready', label: 'Tayyor', statuses: ['ready', 'picked_up'] },
  { key: 'delivered', label: 'Yetkazildi', statuses: ['delivered', 'paid'] },
];

const STATUS_ORDER = ['new', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'paid'];

const STATUS_EMOJI = {
  new: '📝',
  accepted: '👨‍🍳',
  preparing: '🍳',
  ready: '🔔',
  picked_up: '🏃',
  delivered: '✅',
  paid: '✅',
  cancelled: '✕',
};

const STATUS_HINT = {
  new: 'Oshxona buyurtmangizni ko\'rdi, hozir qabul qiladi',
  accepted: 'Buyurtmangiz qabul qilindi, tez orada tayyorlash boshlanadi',
  preparing: 'Oshpaz taomlaringizni tayyorlamoqda',
  ready: 'Taomlaringiz tayyor! Ofitsiant hozir olib keladi',
  picked_up: 'Ofitsiant taomlaringizni olib kelmoqda',
  delivered: 'Yoqimli ishtaha! 🍽',
  paid: 'Rahmat, yana kutamiz!',
  cancelled: 'Bu buyurtma bekor qilindi',
};

export default function TrackScreen({ animClass, order, pastOrders, session, api, onSelectOrder, onBackToMenu }) {
  const [swapping, setSwapping] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const previousStatus = useRef(order && order.status);
  const toast = useToast();

  useEffect(() => {
    if (!order) return;
    if (previousStatus.current && previousStatus.current !== order.status) {
      setSwapping(true);
      setTimeout(() => setSwapping(false), 320);
      if (order.status === 'ready') haptic('success');
    }
    previousStatus.current = order.status;
  }, [order]);

  if (!order) {
    return (
      <div className={`c-screen ${animClass}`}>
        <div className="c-loading">
          <span className="spinner spinner-lg" />
        </div>
      </div>
    );
  }

  const currentIndex = STATUS_ORDER.indexOf(order.status);
  const isFinished = ['delivered', 'paid'].includes(order.status);
  const isCancelled = order.status === 'cancelled';

  function stepState(step) {
    if (isCancelled) return '';
    const stepIndex = Math.min(...step.statuses.map((s) => STATUS_ORDER.indexOf(s)));
    if (currentIndex > Math.max(...step.statuses.map((s) => STATUS_ORDER.indexOf(s)))) return 'done';
    if (currentIndex >= stepIndex) return 'current';
    return '';
  }

  async function cancel() {
    setCancelling(true);
    try {
      await api.patch(`/client/orders/${order.id}/cancel`);
      toast.info('Buyurtma bekor qilindi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  }

  const others = pastOrders.filter((o) => o.id !== order.id);

  return (
    <div className={`c-screen ${animClass}`}>
      <header className="c-header">
        <div className="c-header-top">
          <button type="button" className="c-back" onClick={onBackToMenu} aria-label="Menyu">
            ←
          </button>
          <div className="grow">
            <div className="c-header-title">Buyurtmangiz</div>
            <div className="c-header-sub">
              {session.table && session.table.tableNumber ? `${session.table.tableNumber}-stol · ` : ''}
              {time(order.createdAt)}
            </div>
          </div>
        </div>
      </header>

      <div className="c-track">
        <div className="c-track-emoji">{STATUS_EMOJI[order.status]}</div>
        <div className={`c-track-status${swapping ? ' swapping' : ''}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </div>
        <div className="c-track-hint">{STATUS_HINT[order.status]}</div>

        {!isCancelled && (
          <div className="c-steps">
            {STEPS.map((step) => (
              <div key={step.key} className={`c-step ${stepState(step)}`}>
                <span className="c-step-line" />
                <span className="c-step-dot" />
                <span className="c-step-label" style={{ whiteSpace: 'pre-line' }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="c-order-card">
          <h3>Buyurtma tarkibi</h3>
          {order.items.map((item) => (
            <div className="c-order-line" key={item.id}>
              <span>
                {item.menuItem.name} <span style={{ color: 'var(--muted)' }}>×{item.quantity}</span>
                {item.note && (
                  <span style={{ display: 'block', color: 'var(--gold)', fontSize: 12.5, fontStyle: 'italic' }}>
                    {item.note}
                  </span>
                )}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>
                {money(Number(item.priceAtOrderTime) * item.quantity)}
              </span>
            </div>
          ))}
          <div className="c-summary-total" style={{ marginTop: 10 }}>
            <span>Jami</span>
            <b>{money(order.totalPrice)}</b>
          </div>
        </div>

        {order.status === 'new' && (
          <button
            type="button"
            className="c-btn c-btn-ghost"
            style={{ marginTop: 16 }}
            onClick={cancel}
            disabled={cancelling}
          >
            {cancelling ? <span className="spinner" /> : 'Buyurtmani bekor qilish'}
          </button>
        )}

        {(isFinished || isCancelled) && (
          <button type="button" className="c-btn" style={{ marginTop: 16 }} onClick={onBackToMenu}>
            ← Menyuga qaytish
          </button>
        )}

        {others.length > 0 && (
          <div className="c-past-orders">
            <h3 style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
              Boshqa buyurtmalar
            </h3>
            {others.map((o) => (
              <button type="button" className="c-past-order" key={o.id} onClick={() => onSelectOrder(o)}>
                <span style={{ fontSize: 20 }}>{STATUS_EMOJI[o.status]}</span>
                <span className="grow">
                  <span style={{ display: 'block', fontSize: 14 }}>{ORDER_STATUS_LABELS[o.status]}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {time(o.createdAt)} · {o.items.length} ta taom
                  </span>
                </span>
                <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 13.5 }}>
                  {money(o.totalPrice)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
