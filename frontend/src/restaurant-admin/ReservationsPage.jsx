import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { dateTime, relativeDay, time, RESERVATION_STATUS_LABELS } from '../lib/format';

const SCOPES = [
  { key: 'today', label: 'Bugungi' },
  { key: 'upcoming', label: 'Kelgusi' },
  { key: 'all', label: 'Barchasi' },
];

export default function ReservationsPage({ api, liveTick }) {
  const [scope, setScope] = useState('upcoming');
  const [rows, setRows] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null); // reservation.id
  const [chosenTable, setChosenTable] = useState('');
  const knownIds = useRef(new Set());
  const [freshIds, setFreshIds] = useState(new Set());
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [list, tableList] = await Promise.all([
        api.get(`/kitchen/reservations?scope=${scope}`),
        api.get('/tables/admin'),
      ]);

      const fresh = new Set();
      if (knownIds.current.size > 0) {
        list.forEach((r) => {
          if (!knownIds.current.has(r.id)) fresh.add(r.id);
        });
      }
      list.forEach((r) => knownIds.current.add(r.id));

      setRows(list);
      setTables(tableList);
      if (fresh.size > 0) {
        setFreshIds(fresh);
        setTimeout(() => setFreshIds(new Set()), 900);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, scope]);

  useEffect(() => {
    load();
  }, [load, liveTick]);

  async function update(reservation, status, tableId) {
    try {
      await api.patch(`/kitchen/reservations/${reservation.id}`, {
        status,
        ...(tableId !== undefined ? { tableId } : {}),
      });
      toast.success(status === 'confirmed' ? 'Bron tasdiqlandi' : 'Yangilandi');
      setAssigning(null);
      setChosenTable('');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22 }}>Bronlar</h1>
        <div className="bazm-chips">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`bazm-chip${scope === s.key ? ' active' : ''}`}
              onClick={() => setScope(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="dl-list-empty">
          <span className="spinner" /> Yuklanmoqda…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="dl-panel">
          <div className="dl-list-empty">
            Bu davr uchun bron yo'q. Mijozlar Telegram bot orqali yoki saytdan bron qila oladi.
          </div>
        </div>
      )}

      {rows.map((r) => (
        <div key={r.id} className={`dl-res-card${freshIds.has(r.id) ? ' fresh' : ''}`}>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="dl-res-when">
                {relativeDay(r.reservationDate)} · {time(r.reservationDate)}
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 6 }}>{r.clientName}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
                <span className="mono">{r.phone}</span> · {r.partySize} kishi
                {r.table && ` · ${r.table.tableNumber}-stol`}
              </div>
              {r.note && (
                <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 6, fontStyle: 'italic' }}>
                  {r.note}
                </div>
              )}
            </div>
            <span className={`dl-status-pill ${r.status === 'pending' ? 'new' : r.status === 'confirmed' ? 'ready' : 'cancelled'}`}>
              {RESERVATION_STATUS_LABELS[r.status]}
            </span>
          </div>

          {r.status === 'pending' && (
            <div style={{ marginTop: 14 }}>
              {assigning === r.id ? (
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <select
                    value={chosenTable}
                    onChange={(e) => setChosenTable(e.target.value)}
                    style={{ height: 38, borderRadius: 10, padding: '0 12px', background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="">Stol tanlanmasin</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>{t.tableNumber}-stol</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => update(r, 'confirmed', chosenTable || null)}
                  >
                    Tasdiqlash
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAssigning(null)}>
                    Bekor
                  </button>
                </div>
              ) : (
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => {
                      setAssigning(r.id);
                      setChosenTable(r.tableId || '');
                    }}
                  >
                    Tasdiqlash
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => update(r, 'cancelled')}>
                    Bekor qilish
                  </button>
                </div>
              )}
            </div>
          )}

          {r.status === 'confirmed' && (
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(r, 'completed')}>
                Kelib ketdi
              </button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => update(r, 'cancelled')}>
                Bekor qilish
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                {dateTime(r.reservationDate)}
              </span>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
