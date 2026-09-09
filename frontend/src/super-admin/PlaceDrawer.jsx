import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../components/Toast';
import { money, dateOnly, SUBSCRIPTION_LABELS, PLAN_LABELS } from '../lib/format';

// O'ngdan chiqadigan tafsilot paneli — restoran ham, kafe ham shu yerda
// ochiladi. Fon xiralashadi, lekin yo'qolmaydi: qaysi ro'yxatdan kelganing
// ko'rinib tursin. Yopilishda teskari animatsiya tugagach DOM'dan chiqadi,
// shuning uchun `leaving` holati kerak.

export default function PlaceDrawer({ api, restaurantId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(null); // 'suspend' | 'delete' | null
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api
      .get(`/super-admin/restaurants/${restaurantId}`)
      .then((r) => alive && setData(r))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [api, restaurantId]);

  function close() {
    setLeaving(true);
    setTimeout(onClose, 300);
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(path, method = 'PATCH') {
    setBusy(true);
    try {
      const updated = await api.raw(`/super-admin/restaurants/${restaurantId}${path}`, { method });
      if (updated) setData((d) => ({ ...d, ...updated }));
      setConfirming(null);
      onChanged();
      toast.success('Bajarildi');
      if (method === 'DELETE') close();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Xodimlar yagona login sahifasidan kiradi — alohida manzil kerak emas
  const staffUrl = window.location.origin;
  const isCafe = data && data.businessType === 'cafe';

  return createPortal(
    <>
      <div className={`drawer-overlay${leaving ? ' leaving' : ''}`} onClick={close} />
      <aside className={`drawer${leaving ? ' leaving' : ''}`}>
        {!data && !error && (
          <div className="loading-screen" style={{ minHeight: 240 }}>
            <span className="spinner spinner-lg" />
          </div>
        )}
        {error && (
          <div className="drawer-body">
            <div className="form-error">{error}</div>
          </div>
        )}

        {data && (
          <>
            <div className="drawer-head">
              <div className="row-between">
                <div>
                  <h2 style={{ fontSize: 19, fontWeight: 700 }}>{data.name}</h2>
                  <div className="mono" style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 3 }}>
                    {data.slug}
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={close} aria-label="Yopish">
                  ✕
                </button>
              </div>
              <div className="row" style={{ marginTop: 12, gap: 8 }}>
                <span className={`status-badge ${data.subscriptionStatus}`}>
                  {SUBSCRIPTION_LABELS[data.subscriptionStatus]}
                </span>
                <span className="bazm-chip">{isCafe ? '☕ Kafe' : '🍽 Restoran'}</span>
              </div>
            </div>

            <div className="drawer-body">
              {data.stats && (
                <div className="drawer-section">
                  <h3>Bugungi holat</h3>
                  <div className="mini-grid">
                    <div className="mini-stat">
                      <b>{data.stats.ordersToday}</b>
                      <span>buyurtma</span>
                    </div>
                    <div className="mini-stat">
                      <b>{Math.round(data.stats.revenueToday / 1000)}k</b>
                      <span>savdo</span>
                    </div>
                    <div className="mini-stat">
                      <b>{data.stats.tableCount}</b>
                      <span>stol</span>
                    </div>
                    <div className="mini-stat">
                      <b>{data.stats.staffCount}</b>
                      <span>xodim</span>
                    </div>
                    <div className="mini-stat">
                      <b>{data.stats.menuItemCount}</b>
                      <span>taom</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <h3>Obuna</h3>
                <div className="kv">
                  <span>Tarif</span>
                  <span>{PLAN_LABELS[data.subscriptionPlan]}</span>
                </div>
                <div className="kv">
                  <span>Oylik to'lov</span>
                  <span>{money(data.monthlyFee)}</span>
                </div>
                <div className="kv">
                  <span>Keyingi to'lov</span>
                  <span>{data.nextBillingDate ? dateOnly(data.nextBillingDate) : '—'}</span>
                </div>
                <div className="kv">
                  <span>Ro'yxatdan o'tgan</span>
                  <span>{dateOnly(data.createdAt)}</span>
                </div>
              </div>

              <div className="drawer-section">
                <h3>Texnik ma'lumot</h3>
                <div className="kv">
                  <span>Baza</span>
                  <span className="mono">{data.dbName}</span>
                </div>
                <div className="kv">
                  <span>Server</span>
                  <span className="mono">{data.dbHost}</span>
                </div>
                <div className="kv">
                  <span>Telegram bot</span>
                  <span>{data.telegramBotToken ? 'Ulangan' : 'Ulanmagan'}</span>
                </div>
                <div className="kv">
                  <span>Xodim paneli</span>
                  <span>
                    <a href={staffUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--amber)' }}>
                      Ochish ↗
                    </a>
                  </span>
                </div>
              </div>

              {data.billingHistory && data.billingHistory.length > 0 && (
                <div className="drawer-section">
                  <h3>To'lovlar tarixi</h3>
                  {data.billingHistory.map((b) => (
                    <div className="kv" key={b.id}>
                      <span>{dateOnly(b.createdAt)}</span>
                      <span>
                        {money(b.amount)} · {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="drawer-section">
                <h3>Amallar</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.subscriptionStatus !== 'active' && (
                    <button
                      type="button"
                      className="btn btn-success btn-block"
                      disabled={busy}
                      onClick={() => act('/activate')}
                    >
                      Faollashtirish
                    </button>
                  )}

                  {data.subscriptionStatus !== 'suspended' &&
                    (confirming === 'suspend' ? (
                      <div className="inline-confirm">
                        <span>Ishonchingiz komilmi?</span>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busy}
                          onClick={() => act('/suspend')}
                        >
                          Ha
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                          Yo'q
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-danger btn-block" onClick={() => setConfirming('suspend')}>
                        Xizmatni to'xtatish
                      </button>
                    ))}

                  {confirming === 'delete' ? (
                    <div className="inline-confirm">
                      <span>Baza bilan birga o'chirilsinmi?</span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => act('', 'DELETE')}
                      >
                        Ha, o'chir
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                        Yo'q
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-block"
                      style={{ color: 'var(--red)' }}
                      onClick={() => setConfirming('delete')}
                    >
                      Butunlay o'chirish
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>,
    document.body
  );
}
