import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { dateOnly, PLAN_LABELS } from '../lib/format';

const FILTERS = [
  { key: 'pending', label: 'Kutmoqda' },
  { key: 'approved', label: 'Tasdiqlangan' },
  { key: 'rejected', label: 'Rad etilgan' },
  { key: '', label: 'Barchasi' },
];

const STATUS_LABELS = { pending: 'Kutmoqda', approved: 'Tasdiqlangan', rejected: 'Rad etilgan' };
const TYPE_LABELS = { restaurant: 'Restoran', cafe: 'Kafe' };

export default function ApplicationsPage({ api, onChanged }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [result, setResult] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get(`/super-admin/applications${filter ? `?status=${filter}` : ''}`));
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function reject(id) {
    setBusyId(id);
    try {
      await api.patch(`/super-admin/applications/${id}/reject`);
      toast.info('Ariza rad etildi');
      await load();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="bazm-panel">
        <div className="bazm-panel-head">
          <h2>Qo'shilish arizalari</h2>
          <div className="bazm-chips">
            {FILTERS.map((f) => (
              <button
                key={f.key || 'all'}
                type="button"
                className={`bazm-chip${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bazm-table-wrap">
          <table className="bazm-table">
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Turi</th>
                <th>Hudud</th>
                <th>Telefon</th>
                <th>Tarif</th>
                <th>Holat</th>
                <th>Sana</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} style={{ cursor: 'default' }}>
                  <td style={{ fontWeight: 600 }}>
                    {a.name}
                    {a.description && (
                      <div style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12, whiteSpace: 'normal', maxWidth: 240, marginTop: 3 }}>
                        {a.description}
                      </div>
                    )}
                  </td>
                  <td>{TYPE_LABELS[a.businessType]}</td>
                  <td style={{ color: 'var(--muted)' }}>
                    {a.city}
                    <div style={{ fontSize: 11.5 }}>{a.region}</div>
                  </td>
                  <td className="mono">
                    {a.phone}
                    {a.email && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{a.email}</div>}
                  </td>
                  <td>{PLAN_LABELS[a.plan]}</td>
                  <td>
                    <span className={`status-badge ${a.status}`}>{STATUS_LABELS[a.status]}</span>
                  </td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{dateOnly(a.createdAt)}</td>
                  <td>
                    {a.status === 'pending' && (
                      <div className="row" style={{ gap: 6 }}>
                        <button type="button" className="btn btn-success btn-sm" onClick={() => setApproving(a)}>
                          Tasdiqlash
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={busyId === a.id}
                          onClick={() => reject(a.id)}
                        >
                          Rad etish
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="bazm-empty">
            <span className="spinner" /> Yuklanmoqda…
          </div>
        )}
        {!loading && rows.length === 0 && <div className="bazm-empty">Ariza yo'q</div>}
      </div>

      <ApproveModal
        api={api}
        application={approving}
        onClose={() => setApproving(null)}
        onDone={async (data) => {
          setApproving(null);
          setResult(data);
          await load();
          onChanged();
        }}
      />

      <Modal open={!!result} onClose={() => setResult(null)} className="bazm-modal">
        {result && (
          <>
            <div className="modal-head">
              <h2>{result.restaurant.businessType === 'cafe' ? 'Kafe' : 'Restoran'} ishga tushdi</h2>
              <button type="button" className="icon-btn" onClick={() => setResult(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-note">Kirish ma'lumotlarini muassasa egasiga uzating.</div>
              <div className="credentials-box">
                <div>Nomi: {result.restaurant.name}</div>
                <div>Manzil: {window.location.origin}</div>
                {result.adminCredentials && (
                  <>
                    <div>Telefon: {result.adminCredentials.phone}</div>
                    <div>Parol: {result.adminCredentials.password}</div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-primary" onClick={() => setResult(null)}>
                Tushunarli
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function ApproveModal({ api, application, onClose, onDone }) {
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSlug('');
    setPassword('');
    setError('');
  }, [application]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {};
      if (slug.trim()) body.slug = slug.trim();
      if (password.trim()) body.adminPassword = password.trim();
      onDone(await api.post(`/super-admin/applications/${application.id}/approve`, body));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!application} onClose={onClose} className="bazm-modal">
      {application && (
        <form onSubmit={submit}>
          <div className="modal-head">
            <h2>Arizani tasdiqlash</h2>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="form-note">
              <b>{application.name}</b> uchun alohida baza yaratiladi va{' '}
              <span className="mono">{application.phone}</span> raqami bilan admin ochiladi.
            </div>
            <div className="field">
              <label>Slug (ixtiyoriy — nomdan avtomatik yasaladi)</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="avtomatik" />
            </div>
            <div className="field">
              <label>Admin paroli (ixtiyoriy)</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="avtomatik yasaladi" />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Bekor qilish
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Tasdiqlash va ishga tushirish'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
