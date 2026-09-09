import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { money, dateTime, ORDER_STATUS_LABELS } from '../lib/format';

const FILTERS = [
  { key: '', label: 'Barchasi' },
  { key: 'new', label: 'Yangi' },
  { key: 'preparing', label: 'Tayyorlanmoqda' },
  { key: 'ready', label: 'Tayyor' },
  { key: 'delivered', label: 'Yetkazilgan' },
  { key: 'paid', label: 'To\'langan' },
  { key: 'cancelled', label: 'Bekor qilingan' },
];

export default function OrdersPage({ api, liveTick }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ orders: [], total: 0, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get(`/admin/orders?page=${page}${status ? `&status=${status}` : ''}`));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, page, status]);

  useEffect(() => {
    load();
  }, [load, liveTick]);

  async function changeStatus(order, nextStatus) {
    try {
      await api.patch(`/admin/orders/${order.id}/status`, { status: nextStatus });
      toast.success('Yangilandi');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22 }}>Buyurtmalar</h1>
        <div className="bazm-chips">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              className={`bazm-chip${status === f.key ? ' active' : ''}`}
              onClick={() => {
                setStatus(f.key);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dl-panel">
        {loading && (
          <div className="dl-list-empty">
            <span className="spinner" /> Yuklanmoqda…
          </div>
        )}

        {!loading && data.orders.length === 0 && <div className="dl-list-empty">Buyurtma topilmadi</div>}

        {data.orders.map((o) => (
          <div key={o.id}>
            <div
              className="dl-order-row"
              style={{ cursor: 'pointer' }}
              onClick={() => setExpanded(expanded === o.id ? null : o.id)}
            >
              <div className="dl-table-chip">{o.table ? o.table.tableNumber : '—'}</div>
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 14 }}>{o.clientName}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>
                  {dateTime(o.createdAt)}
                  {o.assignedWaiter && ` · ${o.assignedWaiter.fullName}`}
                </div>
              </div>
              <div className="mono" style={{ fontWeight: 700 }}>{money(o.totalPrice)}</div>
              <span className={`dl-status-pill ${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span>
            </div>

            {expanded === o.id && (
              <div style={{ padding: '4px 18px 18px 74px', borderBottom: '1px solid var(--border-soft)' }}>
                {o.items.map((i) => (
                  <div key={i.id} className="row-between" style={{ padding: '5px 0', fontSize: 13.5 }}>
                    <span>
                      {i.menuItem.name} <span style={{ color: 'var(--muted)' }}>×{i.quantity}</span>
                      {i.note && (
                        <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}> — {i.note}</span>
                      )}
                    </span>
                    <span className="mono">{money(Number(i.priceAtOrderTime) * i.quantity)}</span>
                  </div>
                ))}

                <div className="row" style={{ marginTop: 12 }}>
                  {o.status === 'delivered' && (
                    <button type="button" className="btn btn-success btn-sm" onClick={() => changeStatus(o, 'paid')}>
                      To'landi deb belgilash
                    </button>
                  )}
                  {!['delivered', 'paid', 'cancelled'].includes(o.status) && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => changeStatus(o, 'cancelled')}>
                      Bekor qilish
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Oldingi
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {page} / {pages}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Keyingi →
          </button>
        </div>
      )}
    </>
  );
}
