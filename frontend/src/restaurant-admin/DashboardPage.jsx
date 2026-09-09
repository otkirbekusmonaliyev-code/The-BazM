import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
// Three.js alohida bo'lakda — sahifa ochilganda yuklanadi
const FoodBanner = lazy(() => import('../components/three/FoodBanner'));
import { money, moneyShort, time, initials, ORDER_STATUS_LABELS } from '../lib/format';

const WEEKDAYS = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];

export default function DashboardPage({ api, liveTick }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // Yangi kelgan buyurtmalarni ajratib ko'rsatish uchun (sariq flash animatsiyasi)
  const knownIds = useRef(new Set());
  const [freshIds, setFreshIds] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const d = await api.get('/admin/dashboard');
      const fresh = new Set();
      // Birinchi yuklashda hech narsa "yangi" hisoblanmaydi
      if (knownIds.current.size > 0) {
        d.recentOrders.forEach((o) => {
          if (!knownIds.current.has(o.id)) fresh.add(o.id);
        });
      }
      d.recentOrders.forEach((o) => knownIds.current.add(o.id));
      setData(d);
      if (fresh.size > 0) {
        setFreshIds(fresh);
        setTimeout(() => setFreshIds(new Set()), 1400);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load, liveTick]);

  if (error) return <div className="form-error">{error}</div>;
  if (!data) {
    return (
      <div className="loading-screen" style={{ minHeight: 300 }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const { kpi, salesChart, topItems, recentOrders, waiters } = data;
  const maxSales = Math.max(1, ...salesChart.map((d) => d.total));

  return (
    <>
      {/* 3D banner — Delish oltin rangida aylanuvchi taom shakllari */}
      <div className="dl-banner">
        <Suspense fallback={<div className="three-banner banner-food three-fallback" style={{ height: 120 }} />}>
          <FoodBanner height={120} />
        </Suspense>
        <div className="dl-banner-overlay">
          <h2>Bugungi kun</h2>
          <p>
            {kpi.ordersToday} ta buyurtma · {money(kpi.revenueToday)} savdo
          </p>
        </div>
      </div>

      <div className="dl-kpi-grid">
        <Kpi label="Bugungi buyurtma" value={kpi.ordersToday} />
        <Kpi label="Bugungi savdo" value={moneyShort(kpi.revenueToday)} accent />
        <Kpi label="Faol buyurtma" value={kpi.activeOrders} />
        <Kpi label="Band stollar" value={`${kpi.occupiedTables}/${kpi.tables}`} />
        <Kpi label="Kutayotgan bron" value={kpi.pendingReservations} />
      </div>

      <div className="dl-grid-2">
        <div className="dl-panel">
          <div className="dl-panel-head">
            <h2>Jonli buyurtmalar</h2>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
              real vaqtda yangilanadi
            </span>
          </div>
          {recentOrders.length === 0 ? (
            <div className="dl-list-empty">Hozircha faol buyurtma yo'q</div>
          ) : (
            recentOrders.map((o) => (
              <div key={o.id} className={`dl-order-row${freshIds.has(o.id) ? ' fresh' : ''}`}>
                <div className="dl-table-chip">{o.table ? o.table.tableNumber : '—'}</div>
                <div className="grow">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{o.clientName}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>
                    {o.items.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(', ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 13.5 }}>{money(o.totalPrice)}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{time(o.createdAt)}</div>
                </div>
                <span className={`dl-status-pill ${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="dl-panel">
            <div className="dl-panel-head">
              <h2>Oxirgi 7 kun savdosi</h2>
            </div>
            <div className="dl-panel-body">
              <div className="dl-chart">
                {salesChart.map((d) => (
                  <div className="dl-chart-col" key={d.date}>
                    <div
                      className="dl-chart-bar"
                      style={{ height: `${Math.max(3, (d.total / maxSales) * 100)}%` }}
                      title={`${d.date}: ${money(d.total)}`}
                    />
                    <span className="dl-chart-label">{WEEKDAYS[new Date(d.date).getDay()]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dl-panel">
            <div className="dl-panel-head">
              <h2>Bugun eng ko'p sotilgan</h2>
            </div>
            {topItems.length === 0 ? (
              <div className="dl-list-empty">Bugun hali sotuv yo'q</div>
            ) : (
              topItems.map((item, i) => (
                <div className="dl-staff-row" key={item.id}>
                  <div className="dl-avatar">{i + 1}</div>
                  <div className="grow" style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                  <div className="mono" style={{ color: 'var(--gold)', fontWeight: 700 }}>×{item.quantity}</div>
                </div>
              ))
            )}
          </div>

          <div className="dl-panel">
            <div className="dl-panel-head">
              <h2>Ofitsiantlar</h2>
            </div>
            {waiters.length === 0 ? (
              <div className="dl-list-empty">Ofitsiant qo'shilmagan</div>
            ) : (
              waiters.map((w) => (
                <div className="dl-staff-row" key={w.id}>
                  <div className="dl-avatar">{initials(w.fullName)}</div>
                  <div className="grow">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{w.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {w.status === 'busy'
                        ? `${w.busyWithTableNumber || '?'}-stol bilan band`
                        : 'Bo\'sh'}
                    </div>
                  </div>
                  <span className={`dl-presence${w.status === 'free' ? ' online' : ''}`} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="dl-kpi">
      <div className="dl-kpi-label">{label}</div>
      <div className="dl-kpi-value" style={accent ? { color: 'var(--gold)' } : undefined}>
        {value}
      </div>
    </div>
  );
}
